export const STATUSES=['backlog','ready','doing','verify','done'];
export const CATEGORIES=['Python','SQL','API','AI','DSA','Software','Backend','Career','General'];
export const uid=()=>crypto.randomUUID();
export function initialState(plan){return {schemaVersion:2,activeWeek:1,notes:'',weekly:{},legacyMigrated:false,tasks:plan.tasks.map(t=>({...t,status:t.order===1?'ready':'backlog',priority:t.order===1?'high':'medium',due:'',notes:'',actualMinutes:0,evidence:'',nextAction:'',checked:[]}))};}
export function normalizeState(raw,plan){
 if(!raw||raw.schemaVersion!==2||!Array.isArray(raw.tasks)||raw.tasks.length>400)throw new Error('Choose a complete Buildboard backup (version 2, up to 400 tasks).');
 const ids=new Set(),base=new Map(plan.tasks.map(t=>[t.id,t]));
 const tasks=raw.tasks.map(t=>{
  if(!t||typeof t.id!=='string'||!t.id||t.id.length>150||ids.has(t.id)||typeof t.title!=='string'||!t.title.trim()||!STATUSES.includes(t.status))throw new Error('The backup contains an invalid or duplicate task.');
  ids.add(t.id);const original=base.get(t.id);
  const week=Math.round(Number(t.week));if(week<1||week>24||!Number.isFinite(week))throw new Error('Every task needs a week from 1 to 24.');
  const definition=original||{id:t.id,key:String(t.key||'CUSTOM').slice(0,25),week,month:Math.ceil(week/4),session:0,order:1000,title:t.title.slice(0,180),description:String(t.description||'').slice(0,5000),input:'',stop:'',blocks:[],modules:[],category:CATEGORIES.includes(t.category)?t.category:'General',hours:Math.min(24,Math.max(0,Number(t.hours)||0)),sourcePage:null,custom:true};
  const allowedChecks=new Set(definition.blocks.map(b=>b.id));
  return {...definition,title:t.title.trim().slice(0,180),status:t.status,priority:['low','medium','high'].includes(t.priority)?t.priority:'medium',due:/^\d{4}-\d{2}-\d{2}$/.test(t.due||'')?t.due:'',notes:String(t.notes||'').slice(0,6000),nextAction:String(t.nextAction||'').slice(0,600),evidence:String(t.evidence||'').slice(0,1000),actualMinutes:Math.max(0,Math.min(60000,Number(t.actualMinutes)||0)),checked:Array.isArray(t.checked)?[...new Set(t.checked.filter(v=>allowedChecks.has(v)))].slice(0,30):[],legacyChecklist:Array.isArray(t.legacyChecklist)?t.legacyChecklist.slice(0,20).map(c=>({text:String(c.text||'').slice(0,500),done:c.done===true})):undefined};
 });
 for(const id of base.keys())if(!ids.has(id))throw new Error('This backup is missing part of the 144-session curriculum.');
 const weekly={};for(let w=1;w<=24;w++){const item=raw.weekly?.[w];if(item)weekly[w]={readingDone:item.readingDone===true,reviewDone:item.reviewDone===true,readingNotes:String(item.readingNotes||'').slice(0,3000),reviewNotes:String(item.reviewNotes||'').slice(0,3000)};}
 return {schemaVersion:2,activeWeek:Math.min(24,Math.max(1,Math.round(Number(raw.activeWeek)||1))),notes:String(raw.notes||'').slice(0,12000),weekly,legacyMigrated:raw.legacyMigrated===true,tasks};
}
export function migrateLegacy(state,old){
 if(!old||old.schemaVersion!==1||!Array.isArray(old.tasks)||state.legacyMigrated)return state;
 for(const t of old.tasks){let current=state.tasks.find(n=>n.id===t.id);if(!current){if(!t.id||!t.title)continue;current={id:t.id,key:t.key||'CUSTOM',week:1,month:1,session:0,order:1000,title:t.title,description:t.description||'',input:'',stop:'',blocks:[],modules:[],category:CATEGORIES.includes(t.category)?t.category:'General',hours:Number(t.hours)||1,sourcePage:null,custom:true,status:'backlog',priority:'medium',notes:'',due:'',checked:[],actualMinutes:0,evidence:'',nextAction:''};state.tasks.push(current);}if(STATUSES.includes(t.status))current.status=t.status;current.notes=String(t.notes||'').slice(0,6000);current.due=t.due||'';current.priority=t.priority||current.priority;if(Array.isArray(t.checklist)&&t.checklist.some(c=>c.done))current.legacyChecklist=t.checklist.map(c=>({text:String(c.text||''),done:c.done===true}));}
 state.legacyMigrated=true;return state;
}
export function stats(state,week=null){const tasks=state.tasks.filter(t=>week===null||t.week===week);return {total:tasks.length,done:tasks.filter(t=>t.status==='done').length,hours:tasks.reduce((n,t)=>n+t.hours,0),logged:tasks.reduce((n,t)=>n+t.actualMinutes,0),doing:tasks.filter(t=>t.status==='doing').length};}
export function nextTask(state,week){const items=state.tasks.filter(t=>t.week===week&&t.status!=='done');return items.find(t=>t.status==='doing')||items.find(t=>t.status==='verify')||items.find(t=>t.status==='ready')||items.sort((a,b)=>a.order-b.order)[0]||null;}
export function safeEvidence(value){try{const u=new URL(value);return ['https:','http:'].includes(u.protocol)?u.href:null;}catch{return null;}}
