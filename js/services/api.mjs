async function requestJson(url, options = {}) {
  const response = await fetch(url, options);
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || `Request failed (${response.status})`);
  return data;
}
export function getHealth(){ return requestJson('/api/health'); }
export function getCrmState(){ return requestJson('/api/crm/state'); }
export function persistCrmJobs(jobs){ return requestJson('/api/crm/jobs',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({jobs})}); }
export function getAutomatedInbox(){ return requestJson('/api/integrations/inbox'); }

export function summarizeCall(payload){ return requestJson('/api/ai/call-summary',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)}); }
