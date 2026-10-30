import 'dotenv/config';
import express,{Request,Response,NextFunction} from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import path from 'node:path';
import {z} from 'zod';
import {objectives,packages,followerGoalMilestones,trackedMetricChoices,findPackage,findObjective} from '@tikboost/catalog';
import {pool,databaseReady} from './db';

const app=express();
const port=Number(process.env.PORT||4000);
const webOrigin=process.env.WEB_ORIGIN||'http://localhost:5173';
app.disable('x-powered-by');
app.use(helmet({
  crossOriginResourcePolicy:{policy:'cross-origin'},
  contentSecurityPolicy:{directives:{
    defaultSrc:["'self'"],baseUri:["'self'"],formAction:["'self'"],frameAncestors:["'self'"],
    fontSrc:["'self'",'https://fonts.gstatic.com'],styleSrc:["'self'","'unsafe-inline'",'https://fonts.googleapis.com'],
    imgSrc:["'self'",'data:','https:'],scriptSrc:["'self'"],connectSrc:["'self'"],objectSrc:["'none'"]
  }}
}));
app.use(cors({origin:webOrigin.split(',').map((value)=>value.trim()),methods:['GET','POST'],allowedHeaders:['Content-Type']}));
app.use(express.json({limit:'32kb'}));
app.use('/api/',rateLimit({windowMs:Number(process.env.RATE_LIMIT_WINDOW_MS||60000),limit:Number(process.env.RATE_LIMIT_MAX||30),standardHeaders:'draft-7',legacyHeaders:false}));

const campaignSchema=z.object({
  tiktokUsername:z.string().trim().min(2).max(24).regex(/^[A-Za-z0-9._]+$/),
  email:z.string().trim().email().max(254),
  objectiveId:z.string().min(2),packageId:z.string().min(3),
  region:z.string().trim().min(2).max(80),
  startMode:z.enum(['immediate','scheduled']),
  scheduledFor:z.string().datetime({offset:true}).nullable().optional(),
  pacing:z.enum(['accelerated','balanced','steady']),
  goalMilestone:z.number().int().positive().nullable().optional(),
  postUrl:z.string().trim().url().max(500).nullable().optional(),
  trackingMetrics:z.array(z.string()).max(12).default([]),
  notes:z.string().trim().max(1000).default(''),
  consent:z.literal(true)
});

app.get('/api/health',async(_req:Request,res:Response)=>{
  const ready=await databaseReady();
  res.status(ready?200:503).json({status:ready?'ready':'database_not_configured_or_unavailable',database:ready?'connected':'unavailable',time:new Date().toISOString()});
});
app.get('/api/catalog',(_req:Request,res:Response)=>{
  res.json({objectives,packages,tiers:['Micro','Small','Medium','Large','Enterprise'],followerGoalMilestones,trackedMetricChoices,currency:'USD'});
});
app.post('/api/campaigns',async(req:Request,res:Response,next:NextFunction)=>{
  try{
    const parsed=campaignSchema.safeParse(req.body);
    if(!parsed.success){res.status(400).json({error:'Please correct the campaign details.',fields:parsed.error.flatten().fieldErrors});return;}
    const input=parsed.data;
    const selectedPackage=findPackage(input.packageId);
    const selectedObjective=findObjective(input.objectiveId);
    if(!selectedPackage||!selectedObjective||selectedPackage.objectiveId!==input.objectiveId)
      {res.status(400).json({error:'The selected package does not match the campaign objective.'});return;}
    const allowedMetrics=new Set(trackedMetricChoices);
    if(input.trackingMetrics.some((metric)=>!allowedMetrics.has(metric)))
      {res.status(400).json({error:'One or more reporting metrics are not supported.'});return;}
    if(input.objectiveId==='follower-growth'&&input.goalMilestone&&!followerGoalMilestones.includes(input.goalMilestone))
      {res.status(400).json({error:'Select a listed follower-growth planning milestone.'});return;}
    let scheduledFor:Date|null=null;
    if(input.startMode==='scheduled'){
      if(!input.scheduledFor){res.status(400).json({error:'Choose a future start date and time.'});return;}
      scheduledFor=new Date(input.scheduledFor);
      if(Number.isNaN(scheduledFor.getTime())||scheduledFor.getTime()<=Date.now())
        {res.status(400).json({error:'The scheduled start must be in the future.'});return;}
    }
    if(!pool){res.status(503).json({error:'Campaign intake is unavailable until DATABASE_URL is configured.'});return;}
    const client=await pool.connect();
    let record:{id:string;status:string;created_at:Date};
    try{
      await client.query('BEGIN');
      const result=await client.query(
        "INSERT INTO campaigns (email,tiktok_username,objective_id,package_id,package_name,tier_name,budget_usd,region,start_mode,scheduled_for,pacing,goal_milestone,post_url,tracking_metrics,notes,consent_at,status) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,NOW(),'pending_review') RETURNING id,status,created_at",
        [input.email,input.tiktokUsername.replace(/^@+/,''),input.objectiveId,selectedPackage.id,selectedPackage.objectiveName,selectedPackage.tierName,selectedPackage.budgetUsd,input.region,input.startMode,scheduledFor,input.pacing,input.goalMilestone??null,input.postUrl??null,input.trackingMetrics,input.notes]
      );
      record=result.rows[0] as {id:string;status:string;created_at:Date};
      await client.query('INSERT INTO campaign_events (campaign_id,event_type,detail) VALUES ($1,$2,$3)',[record.id,'request_created','Campaign request received; awaiting manual review and advertiser/payment integration.']);
      await client.query('COMMIT');
    }catch(error){await client.query('ROLLBACK');throw error;}
    finally{client.release();}
    res.status(201).json({id:record.id,status:record.status,createdAt:record.created_at,package:selectedPackage.id,budgetUsd:selectedPackage.budgetUsd,paymentReady:false,campaignLive:false,message:'Your campaign request has been recorded for review. It is not paid, approved, or live yet.'});
  }catch(error){next(error);}
});

const webDist=path.resolve(__dirname,'../../web/dist');
app.use(express.static(webDist));
app.get('*',(_req:Request,res:Response)=>{
  res.sendFile(path.join(webDist,'index.html'),(error)=>{if(error)res.status(404).send('TikBoost web app has not been built. Run the workspace build first.');});
});
app.use((error:unknown,_req:Request,res:Response,_next:NextFunction)=>{
  process.stderr.write((error instanceof Error?error.stack:String(error))+'\\n');
  res.status(500).json({error:'An unexpected server error occurred.'});
});
app.listen(port,()=>process.stdout.write('TikBoost API listening on port '+port+'\\n'));
