import 'dotenv/config';
import express,{Request,Response,NextFunction} from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import path from 'node:path';
import {createHash,randomBytes,randomUUID,timingSafeEqual} from 'node:crypto';
import {z} from 'zod';
import {objectives,packages,followerGoalMilestones,trackedMetricChoices,findPackage,findObjective} from '@tikboost/catalog';
import {pool,databaseReady} from './db';

const app=express();
const port=Number(process.env.PORT||4000);
const webOrigin=process.env.WEB_ORIGIN||'http://localhost:5173';
const paypalMode=process.env.PAYPAL_MODE==='live'?'live':'sandbox';
const paypalBase=paypalMode==='live'?'https://api-m.paypal.com':'https://api-m.sandbox.paypal.com';
const paypalClientId=process.env.PAYPAL_CLIENT_ID||'';
const paypalClientSecret=process.env.PAYPAL_CLIENT_SECRET||'';
let cachedPaypalToken:{value:string;expiresAt:number}|null=null;

app.disable('x-powered-by');
app.set('trust proxy',1);
app.use(helmet({
  crossOriginResourcePolicy:{policy:'cross-origin'},
  contentSecurityPolicy:{directives:{
    defaultSrc:["'self'"],baseUri:["'self'"],formAction:["'self'",'https://www.paypal.com'],frameAncestors:["'self'"],
    fontSrc:["'self'",'https://fonts.gstatic.com'],styleSrc:["'self'","'unsafe-inline'",'https://fonts.googleapis.com'],
    imgSrc:["'self'",'data:','https:'],scriptSrc:["'self'",'https://www.paypal.com'],
    connectSrc:["'self'",'https://api-m.paypal.com','https://api-m.sandbox.paypal.com','https://www.paypal.com'],
    frameSrc:["'self'",'https://www.paypal.com','https://www.sandbox.paypal.com'],objectSrc:["'none'"]
  }}
}));
app.use(cors({
  origin:webOrigin.split(',').map((value)=>value.trim()),
  methods:['GET','POST'],
  allowedHeaders:['Content-Type','Authorization','X-Admin-API-Key']
}));
app.use(express.json({limit:'64kb'}));
app.use('/api/',rateLimit({windowMs:Number(process.env.RATE_LIMIT_WINDOW_MS||60000),limit:Number(process.env.RATE_LIMIT_MAX||30),standardHeaders:'draft-7',legacyHeaders:false}));

const campaignSchema=z.object({
  tiktokUsername:z.string().trim().min(2).max(24).regex(/^[A-Za-z0-9._]+$/),
  email:z.string().trim().email().max(254),
  objectiveId:z.string().min(2),packageId:z.string().min(3),
  region:z.string().trim().min(2).max(80),
  startMode:z.enum(['immediate','scheduled']),
  scheduledFor:z.string().datetime({offset:true}).nullable().optional(),
  pacing:z.enum(['accelerated','balanced','steady']),
  requestedWindowDays:z.number().int().refine((days)=>[1,2,3,5,7,14,30].includes(days)),
  goalMilestone:z.number().int().positive().nullable().optional(),
  postUrl:z.string().trim().url().max(500).nullable().optional(),
  trackingMetrics:z.array(z.string()).max(12).default([]),
  notes:z.string().trim().max(1000).default(''),
  consent:z.literal(true)
});

function sha256(value:string):string{return createHash('sha256').update(value).digest('hex');}
function constantTimeEqual(left:string,right:string):boolean{
  const a=Buffer.from(left);const b=Buffer.from(right);
  return a.length===b.length&&timingSafeEqual(a,b);
}
function requirePool(res:Response):boolean{
  if(!pool){res.status(503).json({error:'Database is not configured. Configure DATABASE_URL and apply migrations.'});return false;}
  return true;
}
function requireAdmin(req:Request,res:Response,next:NextFunction):void{
  const expected=process.env.ADMIN_API_KEY||'';
  const supplied=req.header('x-admin-api-key')||'';
  if(!expected){res.status(503).json({error:'Admin operations are disabled until ADMIN_API_KEY is configured.'});return;}
  if(!constantTimeEqual(expected,supplied)){res.status(401).json({error:'Unauthorized.'});return;}
  next();
}
async function getCustomerCampaign(campaignId:string,req:Request,res:Response){
  if(!requirePool(res))return null;
  const bearer=(req.header('authorization')||'').replace(/^Bearer\s+/i,'').trim();
  if(!/^[a-f0-9]{64}$/i.test(bearer)){res.status(401).json({error:'A valid campaign access token is required.'});return null;}
  const result=await pool!.query(
    'SELECT id,status,payment_status,budget_usd,package_name,tier_name FROM campaigns WHERE id=$1 AND access_token_hash=$2',
    [campaignId,sha256(bearer)]
  );
  if(!result.rowCount){res.status(404).json({error:'Campaign request not found.'});return null;}
  return result.rows[0] as {id:string;status:string;payment_status:string;budget_usd:string;package_name:string;tier_name:string};
}
async function paypalAccessToken():Promise<string>{
  if(!paypalClientId||!paypalClientSecret)throw new Error('PayPal credentials are not configured.');
  if(cachedPaypalToken&&cachedPaypalToken.expiresAt>Date.now()+60000)return cachedPaypalToken.value;
  const response=await fetch(paypalBase+'/v1/oauth2/token',{
    method:'POST',
    headers:{Authorization:'Basic '+Buffer.from(paypalClientId+':'+paypalClientSecret).toString('base64'),'Content-Type':'application/x-www-form-urlencoded'},
    body:'grant_type=client_credentials'
  });
  const payload=await response.json() as {access_token?:string;expires_in?:number;error_description?:string};
  if(!response.ok||!payload.access_token)throw new Error('PayPal authentication failed: '+(payload.error_description||response.status));
  cachedPaypalToken={value:payload.access_token,expiresAt:Date.now()+Number(payload.expires_in||300)*1000};
  return payload.access_token;
}
async function paypalRequest<T>(resource:string,init:RequestInit,requestId?:string):Promise<T>{
  const token=await paypalAccessToken();
  const headers=new Headers(init.headers);
  headers.set('Authorization','Bearer '+token);
  headers.set('Content-Type','application/json');
  if(requestId)headers.set('PayPal-Request-Id',requestId);
  const response=await fetch(paypalBase+resource,{...init,headers});
  const body=await response.json().catch(()=>({})) as Record<string,unknown>;
  if(!response.ok)throw new Error('PayPal request failed with HTTP '+response.status+': '+String(body.message||body.name||'provider_error'));
  return body as T;
}
function publicAppUrl():string{
  return (process.env.PUBLIC_APP_URL||webOrigin.split(',')[0]||'https://example.invalid').replace(/\/$/,'');
}

app.get('/api/health',async(_req:Request,res:Response)=>{
  const ready=await databaseReady();
  res.status(200).json({
    status:'online',
    ready,
    database:ready?'connected':'unavailable',
    payments:paypalClientId&&paypalClientSecret?'paypal_configured':'paypal_credentials_missing',
    time:new Date().toISOString()
  });
});
app.get('/api/ready',async(_req:Request,res:Response)=>{
  const ready=await databaseReady();
  res.status(ready?200:503).json({status:ready?'ready':'database_unavailable',database:ready?'connected':'unavailable'});
});
app.get('/api/catalog',(_req:Request,res:Response)=>{
  res.json({objectives,packages,tiers:['Micro','Small','Medium','Large','Enterprise'],followerGoalMilestones,trackedMetricChoices,currency:'USD'});
});
app.get('/api/paypal/config',(_req:Request,res:Response)=>{
  const enabled=Boolean(paypalClientId&&paypalClientSecret);
  res.json({enabled,clientId:enabled?paypalClientId:null,currency:'USD',mode:paypalMode});
});

app.post('/api/campaigns',async(req:Request,res:Response,next:NextFunction)=>{
  try{
    const parsed=campaignSchema.safeParse(req.body);
    if(!parsed.success){res.status(400).json({error:'Please correct the campaign details.',fields:parsed.error.flatten().fieldErrors});return;}
    const input=parsed.data;
    const selectedPackage=findPackage(input.packageId);
    const selectedObjective=findObjective(input.objectiveId);
    if(!selectedPackage||!selectedObjective||selectedPackage.objectiveId!==input.objectiveId){
      res.status(400).json({error:'The selected package does not match the campaign objective.'});return;
    }
    const allowedMetrics=new Set(trackedMetricChoices);
    if(input.trackingMetrics.some((metric)=>!allowedMetrics.has(metric))){
      res.status(400).json({error:'One or more reporting metrics are not supported.'});return;
    }
    if(input.objectiveId==='follower-growth'&&input.goalMilestone&&!followerGoalMilestones.includes(input.goalMilestone)){
      res.status(400).json({error:'Select a listed follower-growth planning milestone.'});return;
    }
    let scheduledFor:Date|null=null;
    if(input.startMode==='scheduled'){
      if(!input.scheduledFor){res.status(400).json({error:'Choose a future start date and time.'});return;}
      scheduledFor=new Date(input.scheduledFor);
      if(Number.isNaN(scheduledFor.getTime())||scheduledFor.getTime()<=Date.now()){
        res.status(400).json({error:'The scheduled start must be in the future.'});return;
      }
    }
    if(!requirePool(res))return;
    const accessToken=randomBytes(32).toString('hex');
    const client=await pool!.connect();
    let record:{id:string;status:string;created_at:Date};
    try{
      await client.query('BEGIN');
      const result=await client.query(
        "INSERT INTO campaigns (email,tiktok_username,objective_id,package_id,package_name,tier_name,budget_usd,region,start_mode,scheduled_for,pacing,requested_window_days,goal_milestone,post_url,tracking_metrics,notes,consent_at,status,access_token_hash) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,NOW(),'pending_review',$17) RETURNING id,status,created_at",
        [input.email,input.tiktokUsername.replace(/^@+/,''),input.objectiveId,selectedPackage.id,selectedPackage.objectiveName,selectedPackage.tierName,selectedPackage.budgetUsd,input.region,input.startMode,scheduledFor,input.pacing,input.requestedWindowDays,input.goalMilestone??null,input.postUrl??null,input.trackingMetrics,input.notes,sha256(accessToken)]
      );
      record=result.rows[0] as {id:string;status:string;created_at:Date};
      await client.query('INSERT INTO campaign_events (campaign_id,event_type,detail) VALUES ($1,$2,$3)',[
        record.id,'request_created','Campaign request received; awaiting review. PayPal checkout is enabled only after approval.'
      ]);
      await client.query('COMMIT');
    }catch(error){await client.query('ROLLBACK');throw error;}
    finally{client.release();}
    res.status(201).json({
      id:record.id,status:record.status,createdAt:record.created_at,
      package:selectedPackage.id,budgetUsd:selectedPackage.budgetUsd,
      paymentProvider:'paypal',paymentStatus:'not_started',
      paymentAccessToken:accessToken,
      message:'Campaign request recorded. Staff review is required before PayPal checkout becomes available.'
    });
  }catch(error){next(error);}
});

app.get('/api/campaigns/:id/status',async(req:Request,res:Response,next:NextFunction)=>{
  try{
    const campaign=await getCustomerCampaign(req.params.id,req,res);
    if(!campaign)return;
    res.json({id:campaign.id,status:campaign.status,paymentStatus:campaign.payment_status,budgetUsd:Number(campaign.budget_usd),canPay:campaign.status==='awaiting_payment'&&campaign.payment_status!=='paid'});
  }catch(error){next(error);}
});

app.get('/api/admin/campaigns',requireAdmin,async(req:Request,res:Response,next:NextFunction)=>{
  try{
    if(!requirePool(res))return;
    const status=typeof req.query.status==='string'?req.query.status:null;
    const result=await pool!.query(
      'SELECT id,email,tiktok_username,objective_id,package_name,tier_name,budget_usd,region,start_mode,scheduled_for,pacing,requested_window_days,status,payment_status,created_at FROM campaigns WHERE ($1::text IS NULL OR status=$1) ORDER BY created_at DESC LIMIT 200',
      [status]
    );
    res.json({campaigns:result.rows});
  }catch(error){next(error);}
});
app.post('/api/admin/campaigns/:id/approve',requireAdmin,async(req:Request,res:Response,next:NextFunction)=>{
  try{
    if(!requirePool(res))return;
    const client=await pool!.connect();
    try{
      await client.query('BEGIN');
      const updated=await client.query(
        "UPDATE campaigns SET status='awaiting_payment' WHERE id=$1 AND status='pending_review' RETURNING id",
        [req.params.id]
      );
      if(!updated.rowCount){await client.query('ROLLBACK');res.status(404).json({error:'Pending campaign not found.'});return;}
      await client.query('INSERT INTO campaign_events(campaign_id,event_type,detail,actor) VALUES($1,$2,$3,$4)',[
        req.params.id,'approved_for_payment','Campaign reviewed and approved for PayPal checkout.','admin'
      ]);
      await client.query('COMMIT');
      res.json({id:req.params.id,status:'awaiting_payment',paymentProvider:'paypal'});
    }catch(error){await client.query('ROLLBACK');throw error;}
    finally{client.release();}
  }catch(error){next(error);}
});
app.post('/api/admin/campaigns/:id/reject',requireAdmin,async(req:Request,res:Response,next:NextFunction)=>{
  try{
    if(!requirePool(res))return;
    const updated=await pool!.query(
      "UPDATE campaigns SET status='rejected' WHERE id=$1 AND status='pending_review' RETURNING id",
      [req.params.id]
    );
    if(!updated.rowCount){res.status(404).json({error:'Pending campaign not found.'});return;}
    await pool!.query('INSERT INTO campaign_events(campaign_id,event_type,detail,actor) VALUES($1,$2,$3,$4)',[
      req.params.id,'request_rejected','Campaign request declined during review.','admin'
    ]);
    res.json({id:req.params.id,status:'rejected'});
  }catch(error){next(error);}
});

app.post('/api/campaigns/:id/paypal/order',async(req:Request,res:Response,next:NextFunction)=>{
  try{
    const campaign=await getCustomerCampaign(req.params.id,req,res);
    if(!campaign)return;
    if(campaign.status!=='awaiting_payment'||campaign.payment_status==='paid'){
      res.status(409).json({error:'PayPal checkout becomes available after campaign review and approval.'});return;
    }
    if(!paypalClientId||!paypalClientSecret){res.status(503).json({error:'PayPal is not configured yet. Add PayPal app credentials to the service environment.'});return;}
    if(!pool)return;
    const invoiceId='TB-'+campaign.id.replace(/-/g,'').slice(0,20)+'-'+randomUUID().slice(0,8);
    const value=Number(campaign.budget_usd).toFixed(2);
    const order=await paypalRequest<{id:string;status:string}>('/v2/checkout/orders',{
      method:'POST',
      body:JSON.stringify({
        intent:'CAPTURE',
        purchase_units:[{
          reference_id:campaign.id,
          custom_id:campaign.id,
          invoice_id:invoiceId,
          description:'TikBoost '+campaign.package_name+' / '+campaign.tier_name+' campaign budget',
          amount:{currency_code:'USD',value}
        }],
        application_context:{
          brand_name:'TikBoost',
          user_action:'PAY_NOW',
          shipping_preference:'NO_SHIPPING',
          return_url:publicAppUrl()+'/?payment=success',
          cancel_url:publicAppUrl()+'/?payment=cancelled'
        }
      })
    },'tikboost-order-'+randomUUID());
    await pool.query(
      "INSERT INTO campaign_payments(campaign_id,paypal_order_id,amount_usd,status,provider_payload) VALUES($1,$2,$3,'created',$4::jsonb)",
      [campaign.id,order.id,value,JSON.stringify(order)]
    );
    res.status(201).json({orderId:order.id,status:order.status,currency:'USD',amount:value,provider:'paypal'});
  }catch(error){next(error);}
});

app.post('/api/campaigns/:id/paypal/capture',async(req:Request,res:Response,next:NextFunction)=>{
  try{
    const campaign=await getCustomerCampaign(req.params.id,req,res);
    if(!campaign)return;
    const parsed=z.object({orderId:z.string().min(5).max(80)}).safeParse(req.body);
    if(!parsed.success){res.status(400).json({error:'A valid PayPal order ID is required.'});return;}
    if(!pool)return;
    const paymentResult=await pool.query(
      'SELECT paypal_order_id,amount_usd,status FROM campaign_payments WHERE campaign_id=$1 AND paypal_order_id=$2',
      [campaign.id,parsed.data.orderId]
    );
    if(!paymentResult.rowCount){res.status(404).json({error:'PayPal order not found for this campaign.'});return;}
    if(campaign.status!=='awaiting_payment'&&campaign.payment_status!=='paid'){
      res.status(409).json({error:'This campaign is not currently approved for payment.'});return;
    }
    const payment=paymentResult.rows[0] as {paypal_order_id:string;amount_usd:string;status:string};
    if(payment.status==='completed'){res.json({status:'COMPLETED',paymentStatus:'paid'});return;}
    const capture=await paypalRequest<{
      id:string;status:string;
      purchase_units?:Array<{payments?:{captures?:Array<{id:string;status:string;amount?:{value:string;currency_code:string}}>}}>
    }>('/v2/checkout/orders/'+encodeURIComponent(payment.paypal_order_id)+'/capture',{
      method:'POST',body:'{}'
    },'tikboost-capture-'+payment.paypal_order_id);
    const captured=capture.purchase_units?.[0]?.payments?.captures?.[0];
    if(capture.status!=='COMPLETED'||!captured||captured.status!=='COMPLETED'){
      res.status(409).json({error:'PayPal has not confirmed a completed capture.',providerStatus:capture.status});return;
    }
    if(captured.amount?.currency_code!=='USD'||Number(captured.amount.value)!==Number(payment.amount_usd)){
      res.status(409).json({error:'Captured amount does not match the approved campaign invoice.'});return;
    }
    await pool.query(
      "UPDATE campaign_payments SET status='completed',paypal_capture_id=$1,provider_payload=$2::jsonb WHERE paypal_order_id=$3",
      [captured.id,JSON.stringify(capture),payment.paypal_order_id]
    );
    await pool.query(
      "UPDATE campaigns SET payment_status='paid',status=CASE WHEN status='awaiting_payment' THEN 'approved_for_setup' ELSE status END WHERE id=$1",
      [campaign.id]
    );
    await pool.query('INSERT INTO campaign_events(campaign_id,event_type,detail) VALUES($1,$2,$3)',[
      campaign.id,'paypal_payment_completed','PayPal confirmed payment capture '+captured.id+'. Awaiting campaign setup; this does not mean an ad is live.'
    ]);
    res.json({status:'COMPLETED',paymentStatus:'paid',captureId:captured.id,message:'PayPal payment confirmed. Campaign setup is the next step.'});
  }catch(error){next(error);}
});

app.post('/api/paypal/webhook',async(req:Request,res:Response,next:NextFunction)=>{
  try{
    if(!requirePool(res))return;
    const webhookId=process.env.PAYPAL_WEBHOOK_ID||'';
    if(!webhookId){res.status(503).json({error:'PAYPAL_WEBHOOK_ID is not configured.'});return;}
    const headers={
      auth_algo:req.header('paypal-auth-algo')||'',
      cert_url:req.header('paypal-cert-url')||'',
      transmission_id:req.header('paypal-transmission-id')||'',
      transmission_sig:req.header('paypal-transmission-sig')||'',
      transmission_time:req.header('paypal-transmission-time')||''
    };
    if(Object.values(headers).some((value)=>!value)){res.status(400).json({error:'PayPal signature headers are incomplete.'});return;}
    const verification=await paypalRequest<{verification_status:string}>('/v1/notifications/verify-webhook-signature',{
      method:'POST',
      body:JSON.stringify({...headers,webhook_id:webhookId,webhook_event:req.body})
    });
    if(verification.verification_status!=='SUCCESS'){res.status(400).json({error:'PayPal webhook signature verification failed.'});return;}
    const event=req.body as {id?:string;event_type?:string;resource?:Record<string,any>};
    if(!event.id||!event.event_type){res.status(400).json({error:'PayPal webhook event is missing its ID or type.'});return;}
    const client=await pool!.connect();
    try{
      await client.query('BEGIN');
      const inserted=await client.query(
        "INSERT INTO paypal_webhook_events(event_id,event_type,verification_status,payload) VALUES($1,$2,'SUCCESS',$3::jsonb) ON CONFLICT(event_id) DO NOTHING RETURNING event_id",
        [event.id,event.event_type,JSON.stringify(event)]
      );
      if(!inserted.rowCount){await client.query('COMMIT');res.status(200).json({received:true,duplicate:true});return;}
      const resource=event.resource||{};
      const orderId=resource.supplementary_data?.related_ids?.order_id||resource.order_id;
      if(event.event_type==='PAYMENT.CAPTURE.COMPLETED'&&orderId){
        const payment=await client.query('SELECT campaign_id FROM campaign_payments WHERE paypal_order_id=$1',[orderId]);
        if(payment.rowCount){
          await client.query("UPDATE campaign_payments SET status='completed',paypal_capture_id=$1,provider_payload=$2::jsonb WHERE paypal_order_id=$3",[
            resource.id||null,JSON.stringify(event),orderId
          ]);
          await client.query("UPDATE campaigns SET payment_status='paid',status=CASE WHEN status='awaiting_payment' THEN 'approved_for_setup' ELSE status END WHERE id=$1",[payment.rows[0].campaign_id]);
          await client.query('INSERT INTO campaign_events(campaign_id,event_type,detail) VALUES($1,$2,$3)',[
            payment.rows[0].campaign_id,'paypal_webhook_payment_completed','Verified PayPal capture webhook received.'
          ]);
        }
      }else if(event.event_type==='PAYMENT.CAPTURE.REFUNDED'&&orderId){
        const payment=await client.query('SELECT campaign_id FROM campaign_payments WHERE paypal_order_id=$1',[orderId]);
        if(payment.rowCount){
          await client.query("UPDATE campaign_payments SET status='refunded',provider_payload=$1::jsonb WHERE paypal_order_id=$2",[JSON.stringify(event),orderId]);
          await client.query("UPDATE campaigns SET payment_status='refunded' WHERE id=$1",[payment.rows[0].campaign_id]);
          await client.query('INSERT INTO campaign_events(campaign_id,event_type,detail) VALUES($1,$2,$3)',[
            payment.rows[0].campaign_id,'paypal_webhook_refunded','Verified PayPal refund webhook received.'
          ]);
        }
      }else if(event.event_type==='PAYMENT.CAPTURE.DENIED'&&orderId){
        const payment=await client.query('SELECT campaign_id FROM campaign_payments WHERE paypal_order_id=$1',[orderId]);
        if(payment.rowCount){
          await client.query(
            "UPDATE campaign_payments SET status='failed',provider_payload=$1::jsonb WHERE paypal_order_id=$2 AND status<>'completed'",
            [JSON.stringify(event),orderId]
          );
          await client.query(
            "UPDATE campaigns SET payment_status='failed' WHERE id=$1 AND payment_status<>'paid'",
            [payment.rows[0].campaign_id]
          );
          await client.query('INSERT INTO campaign_events(campaign_id,event_type,detail) VALUES($1,$2,$3)',[
            payment.rows[0].campaign_id,'paypal_webhook_capture_denied','Verified PayPal capture-denied webhook received.'
          ]);
        }
      }
      await client.query('COMMIT');
      res.status(200).json({received:true});
    }catch(error){await client.query('ROLLBACK');throw error;}
    finally{client.release();}
  }catch(error){next(error);}
});

const webDist=path.resolve(__dirname,'../../web/dist');
app.use(express.static(webDist));
app.get('*',(_req:Request,res:Response)=>{
  res.sendFile(path.join(webDist,'index.html'),(error)=>{
    if(error)res.status(404).send('TikBoost web app has not been built. Run the workspace build first.');
  });
});
app.use((error:unknown,_req:Request,res:Response,_next:NextFunction)=>{
  process.stderr.write((error instanceof Error?error.stack:String(error))+'\n');
  res.status(500).json({error:'An unexpected server error occurred.'});
});
app.listen(port,()=>process.stdout.write('TikBoost API listening on port '+port+'\n'));
