const { ENV_MODEL, geminiConfigured } = require('./config/env');
const { getCandidateModels, getLastWorkingModel, isAutoModelSetting } = require('./ai/modelRegistry');
const { sendJson } = require('./http/response');
const { serveStatic } = require('./http/staticFiles');
const { handleIntegrationRoutes } = require('./integrations/routes');
const { handleCrmRoutes } = require('./routes/crmRoutes');
const { handleAiRoutes } = require('./routes/aiRoutes');
async function router(req,res){
  let url; try{url=new URL(req.url,'http://localhost');}catch{return sendJson(res,400,{error:'Invalid request URL.'});}
  const pathname=url.pathname;
  if(req.method==='GET'&&pathname==='/api/health'){
    let compatibleModels=null;
    if(geminiConfigured()){try{compatibleModels=(await getCandidateModels(false)).length;}catch{}}
    return sendJson(res,200,{ok:true,provider:'Gemini',llmConfigured:geminiConfigured(),model:getLastWorkingModel()||(geminiConfigured()?'Auto-select':'deterministic fallback'),selectionMode:'automatic',compatibleModels,runtime:`Node ${process.version}`});
  }
  if(req.method==='GET'&&pathname==='/api/models'){
    if(!geminiConfigured())return sendJson(res,200,{configured:false,models:[]});
    try{const models=await getCandidateModels(true);return sendJson(res,200,{configured:true,selected:getLastWorkingModel(),preferred:isAutoModelSetting(ENV_MODEL)?'auto':ENV_MODEL,models});}
    catch(error){return sendJson(res,200,{configured:true,selected:getLastWorkingModel(),models:[],discoveryError:error.message});}
  }
  if(pathname.startsWith('/api/integrations/')){const result=await handleIntegrationRoutes(req,res,url);if(result!==false)return result;}
  if(pathname.startsWith('/api/ai/')){const result=await handleAiRoutes(req,res,url);if(result!==false)return result;}
  if(pathname.startsWith('/api/crm/')){const result=await handleCrmRoutes(req,res,url);if(result!==false)return result;}
  if(req.method==='GET'||req.method==='HEAD')return serveStatic(req,res);
  return sendJson(res,405,{error:'Method not allowed.'});
}
module.exports={router};
