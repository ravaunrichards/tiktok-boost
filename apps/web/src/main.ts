import './style.css';

type Objective={id:string;name:string;tagline:string;description:string;platformSetup:string;primaryMetric:string;trackedMetrics:string[];note:string};
type CampaignPackage={id:string;objectiveId:string;objectiveName:string;tierId:string;tierName:string;budgetUsd:number;displayPrice:string;includes:string[];notIncluded:string[]};
type Catalog={objectives:Objective[];packages:CampaignPackage[];followerGoalMilestones:number[];trackedMetricChoices:string[];currency:string};
type CampaignAccess={id:string;token:string};
type PayPalButtonOptions={
  createOrder:()=>Promise<string>;
  onApprove:(data:{orderID:string})=>Promise<void>;
  onError:(error:unknown)=>void;
};
declare global {
  interface Window {
    paypal?:{Buttons:(options:PayPalButtonOptions)=>{render:(selector:string)=>Promise<void>}};
  }
}
const byId=<T extends HTMLElement>(id:string):T=>{const element=document.getElementById(id);if(!element)throw new Error('Missing page element: '+id);return element as T;};
let catalog:Catalog;let currentObjective='follower-growth';let currentPackage:CampaignPackage|undefined;
function safe(value:string):string{return value.replace(/[&<>"']/g,(c)=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]||c));}
function sessionKey(id:string):string{return 'tikboost:campaign:'+id;}
function saveCampaignAccess(access:CampaignAccess):void{sessionStorage.setItem(sessionKey(access.id),access.token);sessionStorage.setItem('tikboost:last-campaign',access.id);}
function loadCampaignAccess(id:string):CampaignAccess|null{const token=sessionStorage.getItem(sessionKey(id));return token?{id,token}:null;}
async function loadCatalog():Promise<void>{const response=await fetch('/api/catalog');if(!response.ok)throw new Error('Campaign catalog could not be loaded.');catalog=await response.json() as Catalog;renderObjectives();renderMilestones();chooseObjective(currentObjective);restoreCampaignRequest();}
function renderObjectives():void{
 const grid=byId<HTMLDivElement>('objectiveGrid');
 grid.innerHTML=catalog.objectives.map((item,index)=>'<button class="objective-card '+(item.id===currentObjective?'active':'')+'" type="button" data-objective="'+safe(item.id)+'"><span class="objective-number">0'+(index+1)+'</span><b>'+safe(item.name)+'</b><span>'+safe(item.tagline)+'</span><i>Explore packages ↗</i></button>').join('');
 grid.querySelectorAll<HTMLButtonElement>('[data-objective]').forEach((button)=>button.addEventListener('click',()=>chooseObjective(button.dataset.objective||'follower-growth')));
}
function renderMilestones():void{byId<HTMLSelectElement>('milestone').innerHTML='<option value="">Choose a goal milestone</option>'+catalog.followerGoalMilestones.map((n)=>'<option value="'+n+'">'+n.toLocaleString()+' followers — planning goal</option>').join('');}
function chooseObjective(id:string):void{
 const objective=catalog.objectives.find((item)=>item.id===id);if(!objective)return;currentObjective=id;
 byId<HTMLHeadingElement>('packageHeading').textContent=objective.name+' packages';byId<HTMLParagraphElement>('packageSub').textContent=objective.description;
 byId<HTMLDivElement>('objectiveGrid').querySelectorAll<HTMLElement>('[data-objective]').forEach((node)=>node.classList.toggle('active',node.dataset.objective===id));
 byId<HTMLLabelElement>('milestoneWrap').classList.toggle('hidden',id!=='follower-growth');
 const available=catalog.packages.filter((item)=>item.objectiveId===id);
 byId<HTMLDivElement>('packageGrid').innerHTML=available.map((item)=>{
  const list=item.includes.map((line)=>'<li>'+safe(line)+'</li>').join('');
  return '<article class="package-card '+(currentPackage?.id===item.id?'chosen':'')+'"><div class="package-tier">'+safe(item.tierName)+'</div><h3>'+safe(item.objectiveName)+'</h3><div class="package-price">'+safe(item.displayPrice)+'<small> USD budget</small></div><p class="package-description">'+safe(objective.tagline)+'</p><div class="package-meta"><span>'+safe(objective.platformSetup)+'</span><span>Primary metric: '+safe(objective.primaryMetric)+'</span></div><p class="package-note">'+safe(objective.note)+'</p><ul>'+list+'</ul><button type="button" class="button '+(currentPackage?.id===item.id?'primary':'secondary')+'" data-package="'+safe(item.id)+'">'+(currentPackage?.id===item.id?'Selected ✓':'Choose '+safe(item.tierName))+'</button></article>';
 }).join('');
 byId<HTMLDivElement>('packageGrid').querySelectorAll<HTMLButtonElement>('[data-package]').forEach((button)=>button.addEventListener('click',()=>choosePackage(button.dataset.package||'')));
 if(!available.some((item)=>item.id===currentPackage?.id))choosePackage(available[0]?.id||'');updateSummary();
}
function choosePackage(id:string):void{
 const found=catalog.packages.find((item)=>item.id===id&&item.objectiveId===currentObjective);if(!found)return;currentPackage=found;
 byId<HTMLDivElement>('packageGrid').querySelectorAll<HTMLElement>('.package-card').forEach((card)=>{
  const button=card.querySelector<HTMLButtonElement>('[data-package]');const selected=button?.dataset.package===id;
  card.classList.toggle('chosen',Boolean(selected));
  if(button){button.classList.toggle('primary',Boolean(selected));button.classList.toggle('secondary',!selected);button.textContent=selected?'Selected ✓':'Choose '+(button.dataset.package?.split('-').at(-1)||'tier');}
 });updateSummary();
}
function updateSummary():void{
 if(!currentPackage)return;const mode=byId<HTMLSelectElement>('startMode').value;const pacing=byId<HTMLSelectElement>('pacing');
 byId('selectedPackage').innerHTML='<b>'+safe(currentPackage.objectiveName)+' · '+safe(currentPackage.tierName)+'</b><span>'+safe(currentPackage.displayPrice)+' USD suggested media budget</span>';
 byId('summaryObjective').textContent=currentPackage.objectiveName;byId('summaryPackage').textContent=currentPackage.tierName;
 byId('summaryBudget').textContent=currentPackage.displayPrice;byId('summaryTotal').textContent=currentPackage.displayPrice+' USD';
 byId('summaryStart').textContent=mode==='scheduled'?'Scheduled':'As soon as eligible';
 byId('summaryPacing').textContent=pacing.options[pacing.selectedIndex].text.split(' — ')[0];
 byId('summaryWindow').textContent=byId<HTMLSelectElement>('requestedWindowDays').value+' days';
 byId('scheduledWrap').classList.toggle('hidden',mode!=='scheduled');
}
function renderRequestPanel(id:string):void{
 const result=byId<HTMLDivElement>('requestResult');
 result.classList.remove('hidden');
 result.innerHTML='<b>Campaign request recorded</b><p>Reference: '+safe(id)+'</p><p>Current status: pending review</p><p>Checkout is unlocked only after staff review. PayPal handles the full checkout flow; no card details are collected by TikBoost.</p><button class="button secondary" type="button" id="checkPaymentStatusButton">Check review & PayPal status</button><div id="paypalCheckoutStatus" class="payment-status" role="status"></div><div id="paypalButtonContainer" class="paypal-button-box"></div>';
 byId<HTMLButtonElement>('checkPaymentStatusButton').addEventListener('click',()=>void checkPaymentStatus(id));
}
function restoreCampaignRequest():void{
 const id=sessionStorage.getItem('tikboost:last-campaign');
 if(id&&loadCampaignAccess(id))renderRequestPanel(id);
}
async function loadPayPalSdk(clientId:string):Promise<void>{
 if(window.paypal)return;
 const existing=document.querySelector<HTMLScriptElement>('script[data-tikboost-paypal]');
 if(existing){
  await new Promise<void>((resolve,reject)=>{existing.addEventListener('load',()=>resolve(),{once:true});existing.addEventListener('error',()=>reject(new Error('PayPal checkout failed to load.')),{once:true});});
  if(!window.paypal)throw new Error('PayPal checkout SDK did not initialize.');
  return;
 }
 await new Promise<void>((resolve,reject)=>{
  const script=document.createElement('script');
  script.dataset.tikboostPaypal='true';
  script.src='https://www.paypal.com/sdk/js?client-id='+encodeURIComponent(clientId)+'&currency=USD&intent=capture&components=buttons';
  script.async=true;script.onload=()=>resolve();script.onerror=()=>reject(new Error('PayPal checkout failed to load.'));
  document.head.appendChild(script);
 });
 if(!window.paypal)throw new Error('PayPal checkout SDK did not initialize.');
}
async function checkPaymentStatus(id:string):Promise<void>{
 const statusBox=byId<HTMLDivElement>('paypalCheckoutStatus');const container=byId<HTMLDivElement>('paypalButtonContainer');
 const access=loadCampaignAccess(id);if(!access){statusBox.textContent='This browser session no longer has the private campaign access token. Submit a new request or contact support.';return;}
 statusBox.textContent='Checking campaign review status…';container.replaceChildren();
 try{
  const response=await fetch('/api/campaigns/'+encodeURIComponent(id)+'/status',{headers:{Authorization:'Bearer '+access.token}});
  const body=await response.json() as {status?:string;paymentStatus?:string;canPay?:boolean;error?:string};
  if(!response.ok)throw new Error(body.error||'Status lookup failed.');
  if(body.paymentStatus==='paid'){statusBox.textContent='PayPal payment is confirmed. Your campaign is awaiting setup; this does not mean ads are live.';return;}
  if(body.status==='rejected'){statusBox.textContent='This campaign request was not approved. Contact support for next steps.';return;}
  if(!body.canPay){statusBox.textContent='Your campaign is '+(body.status||'pending review').replaceAll('_',' ')+'. PayPal checkout becomes available once the request is approved.';return;}
  const configResponse=await fetch('/api/paypal/config');
  const config=await configResponse.json() as {enabled:boolean;clientId?:string|null};
  if(!configResponse.ok||!config.enabled||!config.clientId){statusBox.textContent='The campaign is approved, but PayPal credentials are not configured on the server yet.';return;}
  statusBox.textContent='Approved. Complete the secure PayPal checkout below.';
  await loadPayPalSdk(config.clientId);
  if(!window.paypal)throw new Error('PayPal checkout is unavailable.');
  await window.paypal.Buttons({
    createOrder:async()=>{
      const orderResponse=await fetch('/api/campaigns/'+encodeURIComponent(id)+'/paypal/order',{method:'POST',headers:{Authorization:'Bearer '+access.token,'Content-Type':'application/json'},body:'{}'});
      const order=await orderResponse.json() as {orderId?:string;error?:string};
      if(!orderResponse.ok||!order.orderId)throw new Error(order.error||'Unable to create PayPal order.');
      return order.orderId;
    },
    onApprove:async(data)=>{
      const captureResponse=await fetch('/api/campaigns/'+encodeURIComponent(id)+'/paypal/capture',{method:'POST',headers:{Authorization:'Bearer '+access.token,'Content-Type':'application/json'},body:JSON.stringify({orderId:data.orderID})});
      const capture=await captureResponse.json() as {paymentStatus?:string;message?:string;error?:string};
      if(!captureResponse.ok)throw new Error(capture.error||'PayPal could not confirm this payment.');
      statusBox.textContent=capture.message||'Payment confirmed. Campaign setup is pending.';
      container.replaceChildren();
    },
    onError:(error)=>{statusBox.textContent=error instanceof Error?error.message:'PayPal checkout encountered an error.';}
  }).render('#paypalButtonContainer');
 }catch(error){statusBox.textContent=error instanceof Error?error.message:'Could not check payment status.';}
}
async function submitCampaign(event:SubmitEvent):Promise<void>{
 event.preventDefault();const error=byId<HTMLDivElement>('formError');const result=byId<HTMLDivElement>('requestResult');const button=byId<HTMLButtonElement>('submitButton');
 error.textContent='';result.classList.add('hidden');if(!currentPackage){error.textContent='Choose a campaign package before continuing.';return;}
 const mode=byId<HTMLSelectElement>('startMode').value;const value=byId<HTMLInputElement>('scheduledFor').value;
 if(mode==='scheduled'&&!value){error.textContent='Choose the date and time you want to request.';return;}
 const date=mode==='scheduled'?new Date(value):null;if(date&&(Number.isNaN(date.getTime())||date.getTime()<=Date.now())){error.textContent='The scheduled start must be in the future.';return;}
 const milestone=byId<HTMLSelectElement>('milestone').value;
 const trackingMetrics=Array.from(document.querySelectorAll<HTMLInputElement>('input[name="metrics"]:checked')).map((item)=>item.value);
 const payload={
  tiktokUsername:byId<HTMLInputElement>('username').value.trim().replace(/^@+/,''),email:byId<HTMLInputElement>('email').value.trim(),
  objectiveId:currentObjective,packageId:currentPackage.id,region:byId<HTMLInputElement>('region').value.trim(),
  startMode:mode,scheduledFor:date?date.toISOString():null,pacing:byId<HTMLSelectElement>('pacing').value,requestedWindowDays:Number(byId<HTMLSelectElement>('requestedWindowDays').value),
  goalMilestone:currentObjective==='follower-growth'&&milestone?Number(milestone):null,
  postUrl:byId<HTMLInputElement>('postUrl').value.trim()||null,trackingMetrics,
  notes:byId<HTMLTextAreaElement>('notes').value.trim(),consent:byId<HTMLInputElement>('consent').checked
 };
 button.disabled=true;button.textContent='Submitting request…';
 try{
  const response=await fetch('/api/campaigns',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});
  const body=await response.json() as {id?:string;status?:string;error?:string;message?:string;paymentAccessToken?:string};
  if(!response.ok||!body.id||!body.paymentAccessToken)throw new Error(body.error||'The campaign request could not be submitted.');
  saveCampaignAccess({id:body.id,token:body.paymentAccessToken});
  renderRequestPanel(body.id);
  result.scrollIntoView({behavior:'smooth',block:'nearest'});
 }catch(submissionError){error.textContent=submissionError instanceof Error?submissionError.message:'Unexpected request error.';}
 finally{button.disabled=false;button.innerHTML='Create campaign request →';}
}
byId<HTMLFormElement>('campaignForm').addEventListener('submit',(event)=>void submitCampaign(event));
byId<HTMLSelectElement>('startMode').addEventListener('change',updateSummary);
byId<HTMLSelectElement>('pacing').addEventListener('change',updateSummary);
byId<HTMLSelectElement>('requestedWindowDays').addEventListener('change',updateSummary);
loadCatalog().catch((error:unknown)=>{byId('objectiveGrid').textContent=error instanceof Error?error.message:'Campaign catalog unavailable.';byId('packageGrid').textContent='Please check the API service and reload.';});
