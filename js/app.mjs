import { getHealth, getCrmState, persistCrmJobs, getAutomatedInbox, summarizeCall } from './services/api.mjs';

const STATUS_ORDER = ['New','Waiting on Quote','Waiting on Yes','Needs Scheduling','Scheduled','Done'];
const ACTIVE_FILTERS = ['All','New','Waiting on Quote','Waiting on Yes','Needs Scheduling','Scheduled'];
const state = { jobs: [], filter: 'All', search: '', selectedJobId: '', demoStep: 0, activeCallJobId: '', callStartedAt: 0, callTimer: null, transcriptTimer: null, transcript: '' };

const today = () => new Date().toISOString().slice(0,10);
const addDays = (n, base = new Date()) => { const d=new Date(base); d.setDate(d.getDate()+n); return d.toISOString().slice(0,10); };
const daysAgo = n => addDays(-n);
const uid = () => crypto.randomUUID();
const esc = v => String(v??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
const humanDate = iso => !iso ? '—' : new Date(`${iso}T12:00:00`).toLocaleDateString(undefined,{month:'short',day:'numeric'});
const humanDateTime = value => !value ? '—' : new Date(value).toLocaleString(undefined,{month:'short',day:'numeric',hour:'numeric',minute:'2-digit'});

const DEMO_JOBS = [
  {customer:'Luis Mendoza',company:'Casa Verde Restaurant',phone:'(555) 014-8821',source:'Phone',issue:'Walk-in freezer down; box temperature climbing',status:'Waiting on Quote',priority:'Urgent',createdAt:daysAgo(3),lastContact:daysAgo(2),nextFollowup:daysAgo(1),nextAction:'Send quote today',notes:'Friday emergency call. High risk of lost product.'},
  {customer:'Rachel Kim',company:'Green Basket Market',phone:'(555) 013-2198',source:'Email',issue:'Produce cooler cycling warm every few hours',status:'Waiting on Yes',priority:'Normal',createdAt:daysAgo(4),lastContact:daysAgo(2),nextFollowup:today(),nextAction:'Follow up on quote',notes:'Quote sent. Waiting for store manager approval.'},
  {customer:'Sam Patel',company:'North Dock Warehouse',phone:'(555) 010-4387',source:'SMS',issue:'Commercial ice machine leaking onto prep area',status:'New',priority:'Normal',createdAt:daysAgo(1),lastContact:daysAgo(1),nextFollowup:today(),nextAction:'Call and confirm service details',notes:'Repeat customer. Asked for earliest diagnosis.'},
  {customer:'Maya Brooks',company:'Pine & Stone Bistro',phone:'(555) 019-6614',source:'Referral',issue:'Reach-in refrigerator making loud compressor noise',status:'Scheduled',priority:'Normal',createdAt:daysAgo(5),lastContact:daysAgo(1),nextFollowup:addDays(1),nextAction:'Service visit tomorrow at 9:00 AM',appointment:`${addDays(1)}T09:00:00`,notes:'Manager will meet technician at back entrance.'},
  {customer:'Angela Morris',company:'Eastside Grocery',phone:'(555) 018-4402',source:'Phone',issue:'Frozen display case temperature rising',status:'Waiting on Quote',priority:'Urgent',createdAt:daysAgo(2),lastContact:daysAgo(2),nextFollowup:daysAgo(1),nextAction:'Prepare and send estimate',notes:'Customer is concerned about product loss.'},
  {customer:'Jordan Lee',company:'Harbor Fish Market',phone:'(555) 011-3350',source:'Website',issue:'Walk-in cooler door icing and not sealing',status:'Waiting on Yes',priority:'Normal',createdAt:daysAgo(6),lastContact:daysAgo(3),nextFollowup:daysAgo(1),nextAction:'Call about estimate',notes:'Estimate sent. No reply yet.'},
  {customer:'Nina Carter',company:'West End Bakery',phone:'(555) 016-7820',source:'SMS',issue:'Retarder showing intermittent high-temperature alarm',status:'New',priority:'Normal',createdAt:today(),lastContact:today(),nextFollowup:addDays(1),nextAction:'Review photo and call customer',notes:'Customer sent a photo of the controller alarm.'},
  {customer:'Omar Haddad',company:'Central Deli',phone:'(555) 011-0409',source:'Phone',issue:'Quote approved for undercounter cooler repair',status:'Needs Scheduling',priority:'Normal',createdAt:daysAgo(3),lastContact:today(),nextFollowup:today(),nextAction:'Choose service date',notes:'Customer approved the quote this morning.'}
].map((j,i)=>({...j,id:`demo-${i+1}`,activities:[{id:uid(),title:'Request captured',detail:`${j.source} request added to ServiceFlow.`,at:new Date(`${j.createdAt}T10:00:00`).toISOString()}]}));

function normalizeStatus(status='New') {
  const map = {'Quote Needed':'Waiting on Quote','Awaiting Approval':'Waiting on Yes'};
  return STATUS_ORDER.includes(map[status]||status) ? (map[status]||status) : 'New';
}
function normalizeJob(job){
  return {
    ...job,
    id: job.id || uid(),
    customer: job.customer || 'Customer',
    company: job.company || '',
    phone: job.phone || '',
    issue: job.issue || 'Service request',
    source: job.source || 'Manual',
    status: normalizeStatus(job.status),
    priority: job.priority === 'Urgent' ? 'Urgent' : 'Normal',
    createdAt: job.createdAt || today(),
    lastContact: job.lastContact || job.createdAt || today(),
    nextFollowup: job.nextFollowup || today(),
    nextAction: job.nextAction || nextActionForStatus(normalizeStatus(job.status)),
    notes: job.notes || '',
    activities: Array.isArray(job.activities) ? job.activities : []
  };
}
function nextActionForStatus(status){
  return ({'New':'Call customer','Waiting on Quote':'Prepare / send quote','Waiting on Yes':'Follow up on quote','Needs Scheduling':'Choose service date','Scheduled':'Complete service visit','Done':'No action'})[status] || 'Review job';
}
function dueJobs(){ return state.jobs.filter(j=>!['Done','Scheduled'].includes(j.status) && j.nextFollowup<=today()); }
function statusClass(status){ return status==='Waiting on Quote'?'quote':status==='Waiting on Yes'?'waiting':status==='Needs Scheduling'||status==='Scheduled'?'schedule':status==='Done'?'done':''; }
function toast(message){ const el=document.getElementById('toast'); el.textContent=message; el.classList.add('show'); clearTimeout(toast.t); toast.t=setTimeout(()=>el.classList.remove('show'),2300); }
async function save(){
  try{
    const remote=await getCrmState();
    const remoteJobs=Array.isArray(remote.jobs)?remote.jobs.map(normalizeJob):[];
    for(const remoteJob of remoteJobs){
      const exists=state.jobs.some(local=>local.id===remoteJob.id||(local.externalId&&remoteJob.externalId&&local.externalId===remoteJob.externalId));
      if(!exists) state.jobs.push(remoteJob);
    }
    await persistCrmJobs(state.jobs);
  }catch{}
}

async function init(){
  document.getElementById('todayDate').textContent = new Date().toLocaleDateString(undefined,{weekday:'long',month:'long',day:'numeric'});
  try{
    const remote=await getCrmState();
    if(Array.isArray(remote.jobs)&&remote.jobs.length) state.jobs=remote.jobs.map(normalizeJob);
    else { state.jobs=DEMO_JOBS.map(normalizeJob); await save(); }
  }catch{ state.jobs=DEMO_JOBS.map(normalizeJob); }
  bindEvents(); render(); refreshAutomationStatus();
  setInterval(()=>{
    const modalOpen=document.getElementById('addModal').getAttribute('aria-hidden')==='false';
    const demoOpen=document.getElementById('demoOverlay').getAttribute('aria-hidden')==='false';
    if(!state.selectedJobId&&!modalOpen&&!demoOpen) syncAutomatedJobs(false);
  },15000);
}

async function syncAutomatedJobs(showToast=false){
  try{
    const remote=await getCrmState();
    if(Array.isArray(remote.jobs)){
      const before=state.jobs.length;
      state.jobs=remote.jobs.map(normalizeJob);
      render();
      if(showToast) toast(state.jobs.length>before ? `${state.jobs.length-before} new request(s) captured.` : 'Jobs are up to date.');
    }
  }catch{ if(showToast) toast('Could not refresh from the server.'); }
}
async function refreshAutomationStatus(){
  const pill=document.getElementById('automationStatus');
  try{
    await getHealth(); const data=await getAutomatedInbox().catch(()=>null);
    const configured = data?.channels?.gmail?.configured;
    pill.innerHTML=`<span class="status-dot"></span>${configured?'Email + web/SMS intake ready':'Web/SMS intake ready · email optional'}`;
  }catch{ pill.innerHTML='<span class="status-dot"></span>Local demo mode'; }
}

function render(){ renderStats(); renderAttention(); renderFilters(); renderTable(); if(state.selectedJobId) renderDrawer(); }
function renderStats(){
  const open=state.jobs.filter(j=>j.status!=='Done');
  const due=dueJobs();
  const quote=open.filter(j=>j.status==='Waiting on Quote').length;
  const yes=open.filter(j=>j.status==='Waiting on Yes').length;
  const scheduling=open.filter(j=>j.status==='Needs Scheduling').length;
  document.getElementById('stats').innerHTML=[
    ['Need attention',due.length,'today / overdue'],['Waiting on quote',quote,'quote still needed'],['Waiting on yes',yes,'customer decision'],['Needs scheduling',scheduling,'approved jobs']
  ].map(([a,b,c])=>`<article class="stat-card"><span>${a}</span><strong>${b}</strong><small>${c}</small></article>`).join('');
}
function renderAttention(){
  const jobs=dueJobs().sort((a,b)=>((a.priority==='Urgent'?-1:0)-(b.priority==='Urgent'?-1:0)) || a.nextFollowup.localeCompare(b.nextFollowup));
  document.getElementById('attentionCount').textContent=jobs.length;
  document.getElementById('attentionList').innerHTML=jobs.length?jobs.map(j=>{
    const overdue=j.nextFollowup<today();
    return `<article class="attention-card ${overdue?'overdue':''} ${j.priority==='Urgent'?'urgent':''}" data-open-job="${j.id}">
      <div class="attention-top"><strong>${esc(j.company||j.customer)}</strong><span class="status-chip ${statusClass(j.status)}">${esc(j.status)}</span></div>
      <p class="attention-reason">${esc(j.nextAction)}</p><p class="attention-issue">${esc(j.issue)}</p>
      <div class="attention-bottom"><span class="due ${overdue?'overdue':''}">${overdue?'OVERDUE':j.nextFollowup===today()?'DUE TODAY':humanDate(j.nextFollowup)}</span>
        <div class="quick-actions"><button class="mini-button primary" data-call-job="${j.id}">☎ Call</button><button class="mini-button" data-open-job="${j.id}">Open</button></div></div>
    </article>`;
  }).join(''):`<div class="empty-state"><strong>Nothing is slipping today.</strong><p>Every open job has a future next action.</p></div>`;
}
function renderFilters(){
  document.getElementById('statusFilters').innerHTML=ACTIVE_FILTERS.map(f=>`<button class="filter-chip ${state.filter===f?'active':''}" data-filter="${f}">${f}</button>`).join('');
}
function renderTable(){
  const q=state.search.trim().toLowerCase();
  const jobs=state.jobs.filter(j=>j.status!=='Done').filter(j=>state.filter==='All'||j.status===state.filter).filter(j=>!q||`${j.customer} ${j.company} ${j.issue} ${j.phone}`.toLowerCase().includes(q));
  document.getElementById('jobsTable').innerHTML=jobs.length?jobs.map(j=>`<tr data-open-job="${j.id}">
    <td class="customer-cell"><strong>${esc(j.company||j.customer)}</strong><span>${esc(j.customer)} · ${esc(j.source)}</span></td>
    <td class="problem-cell">${esc(j.issue)}</td><td><span class="status-chip ${statusClass(j.status)}">${esc(j.status)}</span></td>
    <td>${esc(j.nextAction)}</td><td><span class="due ${j.nextFollowup<today()?'overdue':''}">${j.nextFollowup<today()?'Overdue':j.nextFollowup===today()?'Today':humanDate(j.nextFollowup)}</span></td>
  </tr>`).join(''):`<tr><td colspan="5"><div class="empty-state">No jobs match this filter.</div></td></tr>`;
}

function openDrawer(id){ state.selectedJobId=id; renderDrawer(); document.getElementById('jobDrawer').setAttribute('aria-hidden','false'); }
function closeDrawer(){ state.selectedJobId=''; document.getElementById('jobDrawer').setAttribute('aria-hidden','true'); }
function renderDrawer(){
  const job=state.jobs.find(j=>j.id===state.selectedJobId); if(!job){closeDrawer();return;}
  document.getElementById('drawerTitle').textContent=job.company||job.customer;
  const actionButtons = actionMarkup(job);
  document.getElementById('drawerBody').innerHTML=`<div class="drawer-content">
    <div style="display:flex;justify-content:flex-end;margin-bottom:12px">
      <button class="button secondary" type="button" data-action="edit-job" data-id="${job.id}">✎ Edit details</button>
    </div>
    <div class="job-identity"><h3>${esc(job.customer)}</h3><p>${esc(job.phone)} · ${esc(job.source)}</p></div>
    <div class="job-summary"><strong>${esc(job.issue)}</strong><p>${esc(job.notes||'No additional notes.')}</p></div>
    <div class="detail-grid">
      <div class="detail-box"><span>STATUS</span><strong><span class="status-chip ${statusClass(job.status)}">${esc(job.status)}</span></strong></div>
      <div class="detail-box"><span>LAST CONTACT</span><strong>${humanDate(job.lastContact)}</strong></div>
      <div class="detail-box"><span>FOLLOW-UP</span><strong>${job.nextFollowup<today()?'Overdue':job.nextFollowup===today()?'Today':humanDate(job.nextFollowup)}</strong></div>
      <div class="detail-box"><span>PRIORITY</span><strong>${esc(job.priority)}</strong></div>
    </div>
    <div class="next-action-box"><span>NEXT ACTION</span><strong>${esc(job.nextAction)}</strong></div>
    <div class="drawer-section"><h4>Update the job</h4><div class="action-stack">${actionButtons}</div>${job.status==='Needs Scheduling'?scheduleMarkup(job):''}</div>
    <div class="drawer-section"><h4>History</h4>${historyMarkup(job)}</div>
  </div>`;
}

function optionMarkup(options, selected){
  return options.map(value=>`<option value="${esc(value)}" ${value===selected?'selected':''}>${esc(value)}</option>`).join('');
}

function renderEditDrawer(id){
  const job=state.jobs.find(j=>j.id===id); if(!job)return;
  state.selectedJobId=id;
  document.getElementById('drawerTitle').textContent='Edit job';
  document.getElementById('drawerBody').innerHTML=`<div class="drawer-content">
    <form id="editJobForm" data-job-id="${job.id}" style="display:grid;gap:16px">
      <label style="display:grid;gap:6px"><span>Job / business name</span><input class="input" name="company" value="${esc(job.company)}" placeholder="Business or job name"></label>
      <label style="display:grid;gap:6px"><span>Customer name</span><input class="input" name="customer" value="${esc(job.customer)}" required></label>
      <label style="display:grid;gap:6px"><span>Phone</span><input class="input" name="phone" type="tel" value="${esc(job.phone)}"></label>
      <label style="display:grid;gap:6px"><span>Source</span><select class="input" name="source">${optionMarkup(['Phone','Email','SMS','Website','Referral','Manual'],job.source)}</select></label>
      <label style="display:grid;gap:6px"><span>Issue</span><textarea class="input" name="issue" rows="3" required>${esc(job.issue)}</textarea></label>
      <label style="display:grid;gap:6px"><span>Notes</span><textarea class="input" name="notes" rows="4">${esc(job.notes)}</textarea></label>
      <div class="detail-grid">
        <label class="detail-box" style="display:grid;gap:6px"><span>STATUS</span><select class="input" name="status">${optionMarkup(STATUS_ORDER,job.status)}</select></label>
        <label class="detail-box" style="display:grid;gap:6px"><span>PRIORITY</span><select class="input" name="priority">${optionMarkup(['Normal','Urgent'],job.priority)}</select></label>
      </div>
      <label style="display:grid;gap:6px"><span>Follow-up</span><input class="input" name="nextFollowup" type="date" value="${esc(job.nextFollowup)}"></label>
      <label style="display:grid;gap:6px"><span>Next action</span><input class="input" name="nextAction" value="${esc(job.nextAction)}" required></label>
      <div style="display:flex;gap:10px;justify-content:flex-end;padding-top:8px">
        <button class="button secondary" type="button" data-action="cancel-edit-job" data-id="${job.id}">Cancel</button>
        <button class="button primary" type="submit">Save changes</button>
      </div>
    </form>
  </div>`;
}

async function saveEditedJob(form){
  const id=form.dataset.jobId;
  const job=state.jobs.find(j=>j.id===id); if(!job)return;
  const data=Object.fromEntries(new FormData(form));
  const before={company:job.company,customer:job.customer,phone:job.phone,source:job.source,issue:job.issue,notes:job.notes,status:job.status,priority:job.priority,nextFollowup:job.nextFollowup,nextAction:job.nextAction};
  job.company=String(data.company||'').trim();
  job.customer=String(data.customer||'').trim()||'Customer';
  job.phone=String(data.phone||'').trim();
  job.source=String(data.source||'Manual');
  job.issue=String(data.issue||'').trim()||'Service request';
  job.notes=String(data.notes||'').trim();
  job.status=normalizeStatus(data.status);
  job.priority=data.priority==='Urgent'?'Urgent':'Normal';
  job.nextFollowup=String(data.nextFollowup||today());
  job.nextAction=String(data.nextAction||'').trim()||nextActionForStatus(job.status);
  const changed=[];
  for(const key of Object.keys(before)){ if(String(before[key]??'')!==String(job[key]??'')) changed.push(key); }
  if(changed.length) addActivity(job,'Job details updated',`Updated ${changed.join(', ')}.`);
  await save();
  render();
  openDrawer(id);
  toast(changed.length?'Job details saved.':'No changes to save.');
}
function actionMarkup(job){
  const call=`<button class="button secondary" data-call-job="${job.id}">☎ Call customer</button>`;
  if(job.status==='New') return `${call}<button class="button primary" data-action="need-quote" data-id="${job.id}">Needs a quote</button>`;
  if(job.status==='Waiting on Quote') return `${call}<button class="button primary" data-action="quote-sent" data-id="${job.id}">Quote sent</button>`;
  if(job.status==='Waiting on Yes') return `${call}<button class="button primary" data-action="approved" data-id="${job.id}">Customer said yes</button>`;
  if(job.status==='Needs Scheduling') return `${call}<button class="button secondary" data-action="not-now" data-id="${job.id}">Follow up tomorrow</button>`;
  if(job.status==='Scheduled') return `${call}<button class="button primary" data-action="done" data-id="${job.id}">Mark job done</button>`;
  return call;
}
function scheduleMarkup(job){ return `<div class="schedule-inline"><input id="scheduleDate" type="date" min="${today()}" value="${addDays(1)}"><input id="scheduleTime" type="time" value="09:00"></div><button class="button primary" style="width:100%;margin-top:8px" data-action="schedule" data-id="${job.id}">Schedule service</button>`; }
function historyMarkup(job){
  const acts=[...(job.activities||[])].sort((a,b)=>String(b.at).localeCompare(String(a.at)));
  return acts.length?acts.map(a=>`<div class="history-item"><span class="history-dot"></span><div><strong>${esc(a.title)}</strong><p>${esc(a.detail||'')} · ${humanDateTime(a.at)}</p></div></div>`).join(''):'<div class="empty-state">No activity yet.</div>';
}
function addActivity(job,title,detail){ job.activities=job.activities||[]; job.activities.unshift({id:uid(),title,detail,at:new Date().toISOString()}); }
async function updateJob(id, updater, message){
  const job=state.jobs.find(j=>j.id===id); if(!job)return; updater(job); await save(); render(); if(message)toast(message);
}
async function markCalled(id){
  await updateJob(id,j=>{j.lastContact=today();j.nextFollowup=addDays(1);j.nextAction=nextActionForStatus(j.status);addActivity(j,'Customer contacted',`Follow-up moved to ${humanDate(j.nextFollowup)}.`);},'Call logged. Tomorrow is the next follow-up.');
}

const CALL_TEMPLATES = {
  'New': job => [
    ['Service team', `Hi ${job.customer || 'there'}, I am calling about the service request you sent us.`],
    [job.customer || 'Customer', `Thanks for calling. ${job.issue || 'The refrigeration equipment is having a problem.'}`],
    ['Service team', 'Can you confirm the current issue and how urgently you need service?'],
    [job.customer || 'Customer', 'Yes, it is still down and product is starting to warm up. Please send me an estimate and let me know the next step.']
  ],
  'Waiting on Quote': job => [
    ['Service team', `Hi ${job.customer || 'there'}, I am following up on ${job.company || 'your service request'}.`],
    [job.customer || 'Customer', 'Yes, we still need this fixed. Can you send the estimate today?'],
    ['Service team', 'Thanks. I will get the quote prepared and follow up once it is sent.'],
    [job.customer || 'Customer', 'Perfect, thank you.']
  ],
  'Waiting on Yes': job => [
    ['Service team', `Hi ${job.customer || 'there'}, I am checking whether you had a chance to review the quote.`],
    [job.customer || 'Customer', 'Yes, the quote is approved. Please go ahead with the repair.'],
    ['Service team', 'Great. I will move this to scheduling and confirm a service time separately.'],
    [job.customer || 'Customer', 'Sounds good.']
  ],
  'Needs Scheduling': job => [
    ['Service team', `Hi ${job.customer || 'there'}, I am calling to arrange the service visit.`],
    [job.customer || 'Customer', 'Tomorrow morning would work for us, but please confirm the exact time before sending anyone.'],
    ['Service team', 'Understood. I will confirm availability and get back to you.']
  ],
  'Scheduled': job => [
    ['Service team', `Hi ${job.customer || 'there'}, I am checking in before the scheduled service visit.`],
    [job.customer || 'Customer', 'Everything is ready and someone will be onsite to let the technician in.'],
    ['Service team', 'Perfect. We will keep the existing appointment.']
  ]
};

function transcriptFor(job){
  const lines=(CALL_TEMPLATES[job.status]||CALL_TEMPLATES.New)(job);
  return { lines, text: lines.map(([speaker,text])=>`${speaker}: ${text}`).join('\n') };
}
function openCall(id){
  const job=state.jobs.find(j=>j.id===id); if(!job)return;
  state.activeCallJobId=id; state.transcript='';
  document.getElementById('callTitle').textContent=`Call ${job.company||job.customer}`;
  document.getElementById('callContactName').textContent=job.customer||'Customer';
  document.getElementById('callCompanyName').textContent=job.company||'';
  document.getElementById('dialerNumber').value=job.phone||'';
  document.getElementById('callDialer').hidden=false;
  document.getElementById('callLive').hidden=true;
  document.getElementById('callSummary').hidden=true;
  document.getElementById('transcriptBox').innerHTML='';
  document.getElementById('callModal').setAttribute('aria-hidden','false');
}
function clearCallTimers(){
  if(state.callTimer)clearInterval(state.callTimer); if(state.transcriptTimer)clearInterval(state.transcriptTimer);
  state.callTimer=null; state.transcriptTimer=null;
}
function closeCall(){
  clearCallTimers(); state.activeCallJobId=''; state.transcript='';
  document.getElementById('callModal').setAttribute('aria-hidden','true');
}
function startCall(){
  const job=state.jobs.find(j=>j.id===state.activeCallJobId); if(!job)return;
  const scenario=transcriptFor(job); state.transcript=scenario.text; state.callStartedAt=Date.now();
  document.getElementById('callDialer').hidden=true; document.getElementById('callLive').hidden=false;
  const timer=document.getElementById('callTimer'); timer.textContent='00:00';
  state.callTimer=setInterval(()=>{const sec=Math.floor((Date.now()-state.callStartedAt)/1000);timer.textContent=`${String(Math.floor(sec/60)).padStart(2,'0')}:${String(sec%60).padStart(2,'0')}`;},1000);
  const box=document.getElementById('transcriptBox'); box.innerHTML=''; let i=0;
  const addLine=()=>{if(i>=scenario.lines.length){clearInterval(state.transcriptTimer);state.transcriptTimer=null;return;}const [speaker,text]=scenario.lines[i++];box.insertAdjacentHTML('beforeend',`<div class="transcript-line"><strong>${esc(speaker)}</strong><p>${esc(text)}</p></div>`);box.scrollTop=box.scrollHeight;};
  addLine(); state.transcriptTimer=setInterval(addLine,800);
}
function safeCallStatus(current,suggested){
  if(!STATUS_ORDER.includes(suggested))return current;
  const currentIndex=STATUS_ORDER.indexOf(current), suggestedIndex=STATUS_ORDER.indexOf(suggested);
  // A transcript may move a lead forward, but never silently mark work Done or move it backward.
  if(suggested==='Done'||suggestedIndex<currentIndex)return current;
  return suggested;
}
async function endCallAndUpdate(){
  const job=state.jobs.find(j=>j.id===state.activeCallJobId); if(!job)return;
  clearCallTimers();
  document.getElementById('endCallBtn').disabled=true; document.getElementById('endCallBtn').textContent='Analyzing transcript…';
  let result;
  try{ result=await summarizeCall({transcript:state.transcript,currentJob:{customer:job.customer,company:job.company,issue:job.issue,status:job.status,priority:job.priority}}); }
  catch{ result={summary:'Customer call completed and recorded.',issueUpdate:'',priority:job.priority,suggestedStatus:job.status,nextAction:nextActionForStatus(job.status),followupDays:1,confidence:0.5,mode:'fallback'}; }
  const analysis=result.analysis||result;
  const priorStatus=job.status;
  job.lastContact=today();
  if(analysis.issueUpdate)job.issue=analysis.issueUpdate;
  if(analysis.priority==='Urgent'||analysis.priority==='Normal')job.priority=analysis.priority;
  job.status=safeCallStatus(job.status,analysis.suggestedStatus);
  job.nextAction=analysis.nextAction||nextActionForStatus(job.status);
  const days=Number.isFinite(Number(analysis.followupDays))?Math.max(0,Math.min(14,Number(analysis.followupDays))):1;
  job.nextFollowup=addDays(days);
  const summary=analysis.summary||'Customer call completed.';
  addActivity(job,'Call transcript processed',`${summary}${job.status!==priorStatus?` Status: ${priorStatus} → ${job.status}.`:''}`);
  await save(); render();
  document.getElementById('callLive').hidden=true; document.getElementById('callSummary').hidden=false;
  document.getElementById('callSummaryBody').innerHTML=`
    <div><span>SUMMARY</span><strong>${esc(summary)}</strong></div>
    <div><span>STATUS</span><strong>${esc(job.status)}${job.status!==priorStatus?` <em>updated</em>`:''}</strong></div>
    <div><span>PRIORITY</span><strong>${esc(job.priority)}</strong></div>
    <div><span>NEXT ACTION</span><strong>${esc(job.nextAction)}</strong></div>`;
  document.getElementById('endCallBtn').disabled=false; document.getElementById('endCallBtn').textContent='End call & update job';
}
function closeCallSummary(){
  const id=state.activeCallJobId; closeCall(); if(id)openDrawer(id); toast('Transcript processed and the job was updated.');
}

function openModal(){ document.getElementById('addModal').setAttribute('aria-hidden','false'); document.querySelector('#addForm input[name="customer"]').focus(); }
function closeModal(){ document.getElementById('addModal').setAttribute('aria-hidden','true'); document.getElementById('addForm').reset(); }
async function addRequest(form){
  const data=Object.fromEntries(new FormData(form));
  const job=normalizeJob({id:uid(),customer:data.customer,company:data.company,phone:data.phone,source:data.source,issue:data.issue,status:'New',priority:/down|not cooling|warm|temperature rising|emergency|food/i.test(data.issue)?'Urgent':'Normal',createdAt:today(),lastContact:today(),nextFollowup:today(),nextAction:'Call customer today',activities:[{id:uid(),title:'Request captured',detail:`${data.source} request added manually.`,at:new Date().toISOString()}]});
  state.jobs.unshift(job); await save(); closeModal(); render(); openDrawer(job.id); toast('Request added to today’s list.');
}

const DEMO_STEPS=[
  {title:'1. Start with the core customer need',body:'One operational screen shows what needs attention today and where every active job stands.',tip:'The left side is the action list. The right side is the complete active-job picture.',target:'#attentionPanel'},
  {title:'2. Multiple lead sources collapse into one list',body:'Website forms, email and SMS are captured behind the scenes, normalized and deduplicated into the same job model.',tip:'The operator does not need a second inbox. A new digital request simply appears here with its source.',target:'#automationNote'},
  {title:'3. Calling stays inside the job',body:'Open a job and use Call customer. The dialer is embedded in the record instead of becoming a separate call-center module.',tip:'For the demo, open an urgent job and click Call customer.',target:'#jobsPanel'},
  {title:'4. Transcript updates the lead automatically',body:'After the call, Gemini extracts only supported facts from the transcript and updates status, priority, next action and follow-up on the same job.',tip:'The phone audio is simulated in this prototype; transcript-to-job processing is real and falls back safely if Gemini is unavailable.',target:'#jobsPanel'},
  {title:'5. Record outcomes, not administration',body:'Quote sent, customer approved and service scheduled are simple operational outcomes. ServiceFlow calculates the next follow-up.',tip:'No invoicing, route optimization, delivery tracking or separate CRM navigation is exposed.',target:'#attentionPanel'},
  {title:'6. The scope stays deliberate',body:'The integrations and AI reduce manual capture, while the customer experience remains focused on one operational screen.',tip:'Technical depth sits behind the workflow instead of increasing the operator’s onboarding burden.',target:'.hero-row'}
]
function startDemo(){ state.demoStep=0; document.getElementById('demoOverlay').setAttribute('aria-hidden','false'); renderDemo(); }
function renderDemo(){
  document.querySelectorAll('.demo-highlight').forEach(el=>el.classList.remove('demo-highlight'));
  const step=DEMO_STEPS[state.demoStep];
  document.getElementById('demoStepLabel').textContent=`Step ${state.demoStep+1} of ${DEMO_STEPS.length}`;
  document.getElementById('demoTitle').textContent=step.title; document.getElementById('demoBody').textContent=step.body; document.getElementById('demoTip').textContent=step.tip;
  document.getElementById('demoPrev').style.visibility=state.demoStep===0?'hidden':'visible';
  document.getElementById('demoNext').textContent=state.demoStep===DEMO_STEPS.length-1?'Finish':'Next';
  const target=document.querySelector(step.target); if(target){target.classList.add('demo-highlight');target.scrollIntoView({behavior:'smooth',block:'center'});}
}
function closeDemo(){ document.getElementById('demoOverlay').setAttribute('aria-hidden','true');document.querySelectorAll('.demo-highlight').forEach(el=>el.classList.remove('demo-highlight')); }

function bindEvents(){
  document.getElementById('addRequestBtn').addEventListener('click',openModal);
  document.querySelectorAll('[data-close-modal]').forEach(el=>el.addEventListener('click',closeModal));
  document.querySelectorAll('[data-close-drawer]').forEach(el=>el.addEventListener('click',closeDrawer));
  document.querySelectorAll('[data-close-call]').forEach(el=>el.addEventListener('click',closeCall));
  document.getElementById('startCallBtn').addEventListener('click',startCall);
  document.getElementById('endCallBtn').addEventListener('click',endCallAndUpdate);
  document.getElementById('closeCallSummaryBtn').addEventListener('click',closeCallSummary);
  document.querySelector('.keypad').addEventListener('click',e=>{const key=e.target.closest('[data-key]')?.dataset.key;if(key)document.getElementById('dialerNumber').value+=key;});
  document.getElementById('addForm').addEventListener('submit',e=>{e.preventDefault();addRequest(e.currentTarget)});
  document.getElementById('searchInput').addEventListener('input',e=>{state.search=e.target.value;renderTable()});
  document.getElementById('statusFilters').addEventListener('click',e=>{const f=e.target.closest('[data-filter]')?.dataset.filter;if(f){state.filter=f;renderFilters();renderTable();}});
  document.getElementById('refreshBtn').addEventListener('click',()=>syncAutomatedJobs(true));
  document.getElementById('demoBtn').addEventListener('click',startDemo);document.getElementById('demoClose').addEventListener('click',closeDemo);
  document.getElementById('demoPrev').addEventListener('click',()=>{if(state.demoStep>0){state.demoStep--;renderDemo();}});
  document.getElementById('demoNext').addEventListener('click',()=>{if(state.demoStep<DEMO_STEPS.length-1){state.demoStep++;renderDemo();}else closeDemo();});
  document.body.addEventListener('click',async e=>{
    const call=e.target.closest('[data-call-job]'); if(call){e.stopPropagation();return openCall(call.dataset.callJob);}
    const open=e.target.closest('[data-open-job]'); if(open)return openDrawer(open.dataset.openJob);
    const action=e.target.closest('[data-action]'); if(!action)return; const id=action.dataset.id; const a=action.dataset.action;
    if(a==='edit-job')return renderEditDrawer(id);
    if(a==='cancel-edit-job')return openDrawer(id);
    if(a==='need-quote')return updateJob(id,j=>{j.status='Waiting on Quote';j.nextAction='Prepare / send quote';j.nextFollowup=today();addActivity(j,'Quote required','Job moved to Waiting on Quote.');},'Job is now waiting on a quote.');
    if(a==='quote-sent')return updateJob(id,j=>{j.status='Waiting on Yes';j.lastContact=today();j.nextFollowup=addDays(1);j.nextAction='Follow up on quote';addActivity(j,'Quote sent','Waiting for customer approval.');},'Quote logged. Follow-up set for tomorrow.');
    if(a==='approved')return updateJob(id,j=>{j.status='Needs Scheduling';j.lastContact=today();j.nextFollowup=today();j.nextAction='Choose service date';addActivity(j,'Customer approved quote','Job now needs scheduling.');},'Approved — choose a service date.');
    if(a==='not-now')return updateJob(id,j=>{j.nextFollowup=addDays(1);addActivity(j,'Scheduling follow-up deferred','Follow up again tomorrow.');},'Scheduling follow-up moved to tomorrow.');
    if(a==='schedule'){
      const date=document.getElementById('scheduleDate')?.value; const time=document.getElementById('scheduleTime')?.value||'09:00'; if(!date)return toast('Choose a service date.');
      return updateJob(id,j=>{j.status='Scheduled';j.appointment=`${date}T${time}:00`;j.nextFollowup=date;j.nextAction=`Service visit ${humanDate(date)} at ${time}`;addActivity(j,'Service scheduled',`${humanDate(date)} at ${time}.`);},'Service scheduled.');
    }
    if(a==='done')return updateJob(id,j=>{j.status='Done';j.nextAction='No action';j.nextFollowup=addDays(30);addActivity(j,'Job completed','Service marked complete.');},'Job completed and removed from the active list.');
  });
  document.body.addEventListener('submit',e=>{
    if(e.target.id!=='editJobForm')return;
    e.preventDefault();
    saveEditedJob(e.target);
  });
  document.addEventListener('keydown',e=>{if(e.key==='Escape'){closeDrawer();closeModal();closeCall();closeDemo();}});
}

init();
