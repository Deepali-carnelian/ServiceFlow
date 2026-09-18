const http = require('http');
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { router } = require('../server/router');
const { clearInbound, clearSystemState, replaceCrmJobs } = require('../server/integrations/store');
const { ROOT } = require('../server/config/env');
const { parseRawEmail } = require('../server/integrations/gmail');

async function json(url, options){
  const response = await fetch(url, options);
  const body = await response.json().catch(() => ({}));
  return { response, body };
}

async function main(){
  clearInbound(); clearSystemState(); replaceCrmJobs([]);
  const server=http.createServer((req,res)=>Promise.resolve(router(req,res)).catch(error=>{if(!res.headersSent){res.writeHead(500,{'Content-Type':'application/json'});res.end(JSON.stringify({error:error.message}));}}));
  await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve);});
  const {port}=server.address(); const base=`http://127.0.0.1:${port}`;
  try{
    const health=await fetch(`${base}/api/health`).then(r=>r.json());
    assert.equal(health.ok,true);

    const page=await fetch(`${base}/`).then(r=>r.text());
    assert.match(page,/Your daily service view/);
    assert.match(page,/Call \/ follow up today/);
    assert.match(page,/Where every job stands/);
    assert.match(page,/Add request/);
    assert.match(page,/CONNECTED CALL/);
    assert.match(page,/Start demo call/);
    assert.match(page,/id="mainWorkspace"/);
    assert.match(page,/<option>SMS<\/option>/);
    assert.doesNotMatch(page,/Only capture what Denise/i);
    assert.doesNotMatch(page,/Invoices/);
    assert.doesNotMatch(page,/Delivery Updates/);
    assert.doesNotMatch(page,/Operations Console/);
    assert.doesNotMatch(page,/Customer CRM/);

    const appJs=await fetch(`${base}/js/app.mjs`).then(r=>r.text());
    assert.match(appJs,/Waiting on Quote/);
    assert.match(appJs,/Waiting on Yes/);
    assert.match(appJs,/Needs Scheduling/);
    assert.ok(appJs.includes('id="callCustomerButton"'));
    assert.ok(appJs.includes('id="jobActionsSection"'));
    assert.match(appJs,/target:'#transcriptBox'/);
    assert.match(appJs,/renderEditDrawer/);
    assert.match(appJs,/saveEditedJob/);
    assert.match(page,/Requests can arrive automatically/i);
    assert.doesNotMatch(appJs,/renderInvoices|renderDelivery|renderCustomers|renderOperations/);
    assert.match(appJs,/data-call-job/);
    assert.match(appJs,/summarizeCall/);

    const callSummaryResponse=await fetch(`${base}/api/ai/call-summary`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({currentJob:{customer:'Jamie',company:'Test Bistro',status:'Waiting on Yes',priority:'Normal',issue:'Freezer repair'},transcript:'Service team: Did you review the quote?\nJamie: Yes, the quote is approved. Please go ahead with the repair.'})});
    assert.equal(callSummaryResponse.status,200);
    const callSummary=await callSummaryResponse.json();
    assert.equal(callSummary.analysis.suggestedStatus,'Needs Scheduling');
    assert.match(callSummary.analysis.nextAction,/service date|schedul/i);
    assert.doesNotMatch(callSummary.analysis.summary,/Service team:/i);

    const parsed=parseRawEmail('From: Marco <marco@example.com>\r\nSubject: Freezer down\r\nContent-Type: text/plain; charset=UTF-8\r\n\r\nOur walk-in freezer is down.');
    assert.equal(parsed.senderEmail,'marco@example.com');
    assert.equal(parsed.subject,'Freezer down');
    assert.match(parsed.text,/walk-in freezer/);

    const status=await fetch(`${base}/api/integrations/status`).then(r=>r.json());
    assert.equal(status.autoCreateLeads,true);
    assert.equal(status.channels.website.configured,true);
    assert.equal(status.channels.sms.configured,true);
    assert.equal(status.channels.gmail.mode,'IMAP/SMTP App Password');

    const firstLead={id:'FINAL-WEB-1',name:'Jamie',company:'Test Bistro',phone:'555-0100',email:'jamie@example.com',message:'Our walk-in freezer is not cooling and food is at risk. Need service today.'};
    const websiteResponse=await fetch(`${base}/api/integrations/website-lead`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(firstLead)});
    assert.equal(websiteResponse.status,201);
    const website=await websiteResponse.json();
    assert.equal(website.item.analysis.customer,'Jamie');
    assert.equal(website.item.analysis.priority,'Urgent');
    assert.equal(website.item.automationReady,true);

    const crm1=await fetch(`${base}/api/crm/state`).then(r=>r.json());
    assert.equal(crm1.jobs.length,1);
    assert.equal(crm1.jobs[0].externalId,website.item.externalId);

    const duplicate=await fetch(`${base}/api/integrations/website-lead`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(firstLead)});
    assert.equal(duplicate.status,201);
    const crm2=await fetch(`${base}/api/crm/state`).then(r=>r.json());
    assert.equal(crm2.jobs.length,1);

    const followUp=await fetch(`${base}/api/integrations/website-lead`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id:'FINAL-WEB-2',name:'Jamie',company:'Test Bistro',phone:'555-0100',email:'jamie@example.com',subject:'Re: service request',message:'Checking in on the quote. Please send the estimate today.'})});
    assert.equal(followUp.status,201);
    const crmFollowUp=await fetch(`${base}/api/crm/state`).then(r=>r.json());
    assert.equal(crmFollowUp.jobs.length,1,'Explicit follow-up from the same customer should update the single open job instead of creating a duplicate job.');
    assert.equal(crmFollowUp.jobs[0].status,'Waiting on Quote');
    assert.match(crmFollowUp.jobs[0].activities[0].title,/follow-up matched/i);

    const sms=await fetch(`${base}/api/integrations/twilio/sms`,{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({MessageSid:'FINAL-SMS-1',From:'+15550101',To:'+15550202',Body:'Our ice machine is leaking and needs service'})});
    assert.equal(sms.status,200);
    assert.match(await sms.text(),/<Response>/);
    const crm3=await fetch(`${base}/api/crm/state`).then(r=>r.json());
    assert.equal(crm3.jobs.length,2);

    const envExample=path.join(ROOT,'.env.example');
    assert.equal(fs.existsSync(envExample),true,'.env.example must be included.');
    assert.equal(fs.existsSync(path.join(ROOT,'.env')),false,'.env with live secrets must not be included.');
    const projectText=[
      fs.readFileSync(path.join(ROOT,'server','config','env.js'),'utf8'),
      fs.readFileSync(path.join(ROOT,'server','integrations','gmail.js'),'utf8'),
      fs.readFileSync(envExample,'utf8')
    ].join('\n');
    assert.doesNotMatch(projectText,/GMAIL_CLIENT_ID|GMAIL_REFRESH_TOKEN|oauth2\.googleapis|gmail\.googleapis/);

    console.log('Smoke test passed: focused one-screen UI, editable job drawer, guided demo targets, embedded dialer/transcript-to-job update, website/SMS automation, idempotency, conservative follow-up matching, email parsing and IMAP/SMTP architecture.');
  }finally{
    clearInbound(); clearSystemState(); replaceCrmJobs([]);
    await new Promise(resolve=>server.close(resolve));
  }
}
main().catch(error=>{console.error(error.stack||error.message);process.exit(1);});
