export type TierId = 'micro' | 'small' | 'medium' | 'large' | 'enterprise';
export type ObjectiveId = 'follower-growth' | 'video-views' | 'reach' | 'profile-visits' | 'website-traffic' | 'lead-generation' | 'creator-collaborations';
export interface Objective {
  id: ObjectiveId; name: string; tagline: string; description: string; platformSetup: string;
  primaryMetric: string; trackedMetrics: string[]; note: string; budgets: Record<TierId, number>;
}
export interface CampaignPackage {
  id: string; objectiveId: ObjectiveId; objectiveName: string; tierId: TierId; tierName: string;
  budgetUsd: number; displayPrice: string; includes: string[]; notIncluded: string[];
}
export const tiers: Array<{id:TierId;name:string;description:string}> = [
  {id:'micro',name:'Micro',description:'A first test with a controlled budget'},
  {id:'small',name:'Small',description:'A focused single-campaign launch'},
  {id:'medium',name:'Medium',description:'More room for audience and creative testing'},
  {id:'large',name:'Large',description:'A larger multi-ad-group campaign plan'},
  {id:'enterprise',name:'Enterprise',description:'A high-budget campaign requiring manual review'}
];
export const objectives: Objective[] = [
  {id:'follower-growth',name:'Follower growth',tagline:'Build a real community',description:'Plan a TikTok Community Interaction campaign optimized for follows, using eligible Spark Ads and an audience that fits your content.',platformSetup:'Community Interaction · Follows',primaryMetric:'Follows attributed by the ad platform',trackedMetrics:['follows','profile visits','video views','likes','comments','shares'],note:'Follower milestones are campaign goals only. No follower quantity or cost per follower is guaranteed.',budgets:{micro:25,small:75,medium:150,large:350,enterprise:900}},
  {id:'video-views',name:'Video views',tagline:'Earn attention on a specific video',description:'Plan a Video Views campaign that optimizes eligible delivery for TikTok focused views. Add a public post URL for review.',platformSetup:'Video Views · Focused View',primaryMetric:'Focused views and watch attention',trackedMetrics:['focused views','video views','likes','comments','shares','saves'],note:'View totals are not guaranteed; account-specific estimates require TikTok Ads Manager data.',budgets:{micro:15,small:40,medium:100,large:250,enterprise:650}},
  {id:'reach',name:'Reach & awareness',tagline:'Introduce your content to more people',description:'Plan a Reach campaign with audience, geography, frequency, and creative considerations documented before launch.',platformSetup:'Reach',primaryMetric:'Impressions and reach',trackedMetrics:['reach','impressions','video views','profile visits','likes','shares'],note:'Reach estimates require an eligible advertiser account, audience, geography, and live auction forecast.',budgets:{micro:20,small:50,medium:125,large:300,enterprise:800}},
  {id:'profile-visits',name:'Profile visits',tagline:'Bring interested viewers to your page',description:'Plan a Community Interaction campaign optimized for profile or page visits, where supported by the ad account.',platformSetup:'Community Interaction · Page Visits',primaryMetric:'TikTok profile visits',trackedMetrics:['profile visits','follows','video views','likes','comments','shares'],note:'Profile visits are an optimization goal, not a promise of followers or downstream engagement.',budgets:{micro:20,small:50,medium:125,large:300,enterprise:800}},
  {id:'website-traffic',name:'Website traffic',tagline:'Send interested people to your link',description:'Plan a traffic campaign for a website or landing page. Destination, tracking, and consent requirements are reviewed first.',platformSetup:'Traffic',primaryMetric:'Landing page visits and clicks',trackedMetrics:['clicks','landing page views','video views','likes','shares'],note:'A destination URL and suitable tracking setup are required before activation.',budgets:{micro:25,small:75,medium:175,large:450,enterprise:1200}},
  {id:'lead-generation',name:'Lead generation',tagline:'Turn attention into enquiries',description:'Plan a lead campaign with a clear offer, privacy notice, lead destination, and follow-up process.',platformSetup:'Lead Generation',primaryMetric:'Valid leads',trackedMetrics:['leads','clicks','landing page views','video views'],note:'Lead form, privacy, destination, and advertiser eligibility must be reviewed before activation.',budgets:{micro:50,small:125,medium:300,large:750,enterprise:1800}},
  {id:'creator-collaborations',name:'Creator collaborations',tagline:'Work with relevant creators',description:'Prepare a creator partnership brief, audience fit criteria, deliverables, usage rights, and approval checklist.',platformSetup:'Creator partnership · Manual sourcing',primaryMetric:'Contracted creator deliverables',trackedMetrics:['views','likes','comments','shares','profile visits','clicks'],note:'Manual review only. Creator availability, rates, rights, and deliverables are confirmed before payment.',budgets:{micro:100,small:250,medium:600,large:1500,enterprise:4000}}
];
export const packages: CampaignPackage[] = objectives.flatMap((objective) => tiers.map((tier) => {
  const budgetUsd = objective.budgets[tier.id];
  return {
    id: objective.id + '-' + tier.id, objectiveId: objective.id, objectiveName: objective.name,
    tierId: tier.id, tierName: tier.name, budgetUsd,
    displayPrice: new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',maximumFractionDigits:0}).format(budgetUsd),
    includes:['Campaign brief and objective setup','Audience and creative checklist','Start-time and pacing preferences','Campaign request and status reference','Outcome reporting fields'],
    notIncluded:['Guaranteed follower, like, share, comment, or view counts','TikTok ad spend beyond the selected budget','Ad approval or a guaranteed live-delivery time']
  };
}));
export const followerGoalMilestones = [100,500,1000,5000,10000,50000,100000,250000,500000,1000000];
export const trackedMetricChoices = ['follows','profile visits','reach','impressions','focused views','video views','likes','comments','shares','saves','clicks','leads'];
export function findPackage(id:string):CampaignPackage|undefined{return packages.find((item)=>item.id===id);}
export function findObjective(id:string):Objective|undefined{return objectives.find((item)=>item.id===id);}
