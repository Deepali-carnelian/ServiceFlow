const { readJson, readForm } = require('../http/body');
const { sendJson, sendText } = require('../http/response');
const { AUTO_CREATE_LEADS, AUTOMATION_CLIENT_POLL_MS, AUTO_ACKNOWLEDGE_SMS, SAFE_ACK_TEXT, WEBSITE_WEBHOOK_SECRET, TWILIO_WEBHOOK_SECRET, emailConfigured, EMAIL_AUTO_ACKNOWLEDGE, EMAIL_USER, IMAP_HOST, EMAIL_POLL_SECONDS } = require('../config/env');
const { listInbound, clearInbound, listSystemState, logEvent, setIntegrationHealth } = require('./store');
const { processInbound, stableId } = require('./processor');
const { syncGmail, verifyEmailConnection } = require('./gmail');

function escapeXml(value){return String(value||'').replace(/[<>&'\"]/g,char=>({'<':'&lt;','>':'&gt;','&':'&amp;',"'":'&apos;','"':'&quot;'}[char]));}
function integrationStatus(){
  const system=listSystemState();
  return {autoCreateLeads:AUTO_CREATE_LEADS,clientPollMs:AUTOMATION_CLIENT_POLL_MS,channels:{
    gmail:{configured:emailConfigured(),mode:'IMAP/SMTP App Password',user:emailConfigured()?EMAIL_USER.replace(/^(.{1,3}).*(@.*)$/,'$1***$2'):'',host:IMAP_HOST,pollSeconds:EMAIL_POLL_SECONDS,autoAcknowledge:emailConfigured()&&EMAIL_AUTO_ACKNOWLEDGE,health:system.health.email||{}},
    website:{configured:true,protected:Boolean(WEBSITE_WEBHOOK_SECRET),endpoint:'/api/integrations/website-lead',health:system.health.website||{}},
    sms:{configured:true,autoAcknowledge:AUTO_ACKNOWLEDGE_SMS,protected:Boolean(TWILIO_WEBHOOK_SECRET),endpoint:'/api/integrations/twilio/sms',health:system.health.sms||{}}
  }};
}
function verifyWebsiteSecret(req){return !WEBSITE_WEBHOOK_SECRET||req.headers['x-serviceflow-secret']===WEBSITE_WEBHOOK_SECRET;}
function verifyTwilioSecret(url){return !TWILIO_WEBHOOK_SECRET||url.searchParams.get('token')===TWILIO_WEBHOOK_SECRET;}

async function handleIntegrationRoutes(req,res,url){
  const pathname=url.pathname;
  if(req.method==='GET'&&pathname==='/api/integrations/status')return sendJson(res,200,integrationStatus());
  if(req.method==='GET'&&pathname==='/api/integrations/inbox')return sendJson(res,200,{items:listInbound(),...integrationStatus()});
  if(req.method==='POST'&&pathname==='/api/integrations/gmail/test'){
    try{return sendJson(res,200,await verifyEmailConnection());}catch(error){return sendJson(res,502,{error:error.message});}
  }
  if(req.method==='POST'&&pathname==='/api/integrations/gmail/sync'){
    try{return sendJson(res,200,await syncGmail());}catch(error){console.warn('[Email] Manual sync failed:',error.message);return sendJson(res,502,{error:error.message});}
  }
  if(req.method==='POST'&&pathname==='/api/integrations/website-lead'){
    if(!verifyWebsiteSecret(req))return sendJson(res,401,{error:'Invalid website webhook secret.'});
    try{
      const body=await readJson(req);
      const rawText=[body.name?`Name: ${body.name}`:'',body.company||body.business?`Business: ${body.company||body.business}`:'',body.phone?`Phone: ${body.phone}`:'',body.email?`Email: ${body.email}`:'',body.equipment?`Equipment: ${body.equipment}`:'',body.message||body.issue||body.description?`Message: ${body.message||body.issue||body.description}`:''].filter(Boolean).join('\n');
      if(!rawText.trim())return sendJson(res,400,{error:'Website lead payload is empty.'});
      const externalSeed=body.id||body.submissionId||`${body.email||''}:${body.phone||''}:${rawText}`;
      const rawInbound={externalId:`website:${stableId(externalSeed)}`,source:'Website',from:body.name||'',senderEmail:body.email||'',phone:body.phone||'',subject:body.subject||'Website service request',body:rawText,metadata:{origin:'website-webhook',websiteUrl:body.websiteUrl||''}};
      const item=await processInbound(rawInbound);setIntegrationHealth('website',{status:'healthy',lastSuccessAt:new Date().toISOString(),lastError:''});logEvent({source:'Website',type:'webhook',message:`Website request accepted: ${item.subject}`,itemId:item.id});return sendJson(res,201,{accepted:true,item});
    }catch(error){setIntegrationHealth('website',{status:'error',lastError:error.message,lastErrorAt:new Date().toISOString()});return sendJson(res,400,{error:error.message||'Unable to process website lead.'});}
  }
  if(req.method==='POST'&&pathname==='/api/integrations/twilio/sms'){
    if(!verifyTwilioSecret(url))return sendText(res,403,'<Response></Response>','application/xml; charset=utf-8');
    try{
      const form=await readForm(req);const message=String(form.Body||'').trim();if(!message)return sendText(res,200,'<Response></Response>','application/xml; charset=utf-8');
      const stop=/^(stop|unsubscribe|cancel|end|quit)$/i.test(message);
      if(!stop){const rawInbound={externalId:`twilio:${form.MessageSid||stableId(`${form.From||''}:${message}`)}`,source:'SMS',from:form.ProfileName||'',phone:form.From||'',subject:'Inbound SMS service request',body:message,metadata:{messageSid:form.MessageSid||'',to:form.To||'',numMedia:Number(form.NumMedia||0)}};const item=await processInbound(rawInbound);setIntegrationHealth('sms',{status:'healthy',lastSuccessAt:new Date().toISOString(),lastError:''});logEvent({source:'SMS',type:'webhook',message:`SMS captured from ${form.From||'customer'}.`,itemId:item.id});}
      const reply=AUTO_ACKNOWLEDGE_SMS&&!stop?`<Message>${escapeXml(SAFE_ACK_TEXT)}</Message>`:'';return sendText(res,200,`<?xml version="1.0" encoding="UTF-8"?><Response>${reply}</Response>`,'application/xml; charset=utf-8');
    }catch(error){setIntegrationHealth('sms',{status:'error',lastError:error.message,lastErrorAt:new Date().toISOString()});console.warn('[SMS] Webhook processing failed:',error.message);return sendText(res,200,'<Response></Response>','application/xml; charset=utf-8');}
  }
  if(req.method==='DELETE'&&pathname==='/api/integrations/inbox'){clearInbound();return sendJson(res,200,{ok:true});}
  return false;
}
module.exports={handleIntegrationRoutes,integrationStatus};
