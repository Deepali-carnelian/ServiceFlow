const { readJson } = require('../http/body');
const { sendJson } = require('../http/response');
const { listCrmJobs, replaceCrmJobs, logEvent } = require('../integrations/store');
function safeArray(value,max=1000){return Array.isArray(value)?value.filter(item=>item&&typeof item==='object').slice(0,max):[];}
async function handleCrmRoutes(req,res,url){
  const pathname=url.pathname;
  if(req.method==='GET'&&pathname==='/api/crm/state') return sendJson(res,200,{jobs:listCrmJobs()});
  if(req.method==='PUT'&&pathname==='/api/crm/jobs'){
    const body=await readJson(req); const jobs=replaceCrmJobs(safeArray(body.jobs));
    logEvent({source:'Jobs',type:'persist',message:`Persisted ${jobs.length} service jobs.`});
    return sendJson(res,200,{ok:true,jobs});
  }
  return false;
}
module.exports={handleCrmRoutes};
