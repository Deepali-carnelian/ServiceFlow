function firstMatch(text, patterns) {
  for (const pattern of patterns) {
    const match = String(text || '').match(pattern);
    if (match?.[1]) return match[1].trim();
  }
  return '';
}
function lineValue(text, labels) {
  const escaped = labels.map(label => label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|');
  return firstMatch(text, [new RegExp(`^(?:${escaped})\\s*[:\\-]\\s*(.+)$`, 'im')]);
}
function detectEquipment(text) {
  const lower = String(text || '').toLowerCase();
  const options = [
    ['walk-in freezer','Walk-in freezer'],['walk in freezer','Walk-in freezer'],['walk-in cooler','Walk-in cooler'],['walk in cooler','Walk-in cooler'],
    ['ice machine','Ice machine'],['display case','Display case'],['prep cooler','Prep cooler'],['reach-in','Reach-in refrigerator'],['reach in','Reach-in refrigerator'],
    ['freezer','Freezer'],['cooler','Cooler'],['refrigerator','Refrigerator'],['fridge','Refrigerator']
  ];
  for (const [needle,label] of options) if (lower.includes(needle)) return label;
  return 'Commercial refrigeration equipment';
}
function localExtract(text, source='Unknown') {
  const raw=String(text||'').replace(/\0/g,'').trim();
  const normalized=raw.replace(/\s+/g,' ').trim();
  const structuredName=lineValue(raw,['Name','Customer']);
  const structuredCompany=lineValue(raw,['Business','Company']);
  const structuredPhone=lineValue(raw,['Phone','Phone number','Number']);
  const structuredMessage=lineValue(raw,['Message','Issue','Description']);
  const phone=structuredPhone||firstMatch(normalized,[/(?:call me at|reach me at|phone|number)\s*[:\-]?\s*(\+?[\d()\-\s]{7,})/i,/(\+?\d[\d()\-\s]{6,}\d)/]);
  const customer=structuredName||firstMatch(normalized,[/(?:this is|i'm|i am)\s+([A-Z][A-Za-z .'-]{1,40}?)(?=\s+(?:from|at|with)\b|[,.]|$)/i,/^([A-Z][A-Za-z]+)\s+from\s+/i]);
  const company=structuredCompany||firstMatch(normalized, [/(?:from|at|with)\s+([A-Z][A-Za-z0-9 &'’-]{2,60}?)(?=[,.]|\s+(?:our|we|the|called|texted|here)\b|$)/i]);
  const issue=(structuredMessage||normalized).slice(0,320);
  const urgent=/\b(emergency|urgent|asap|same[- ]day|need someone today|food|product loss|stock at risk|temperature rising|warming)\b/i.test(normalized)||/\b(freezer|cooler|refrigerator|fridge|ice machine|display case)\b.{0,35}\b(completely down|down|not cooling|stopped|warm|warming)\b/i.test(normalized);
  const quoteRequested=/\b(quote|estimate|pricing|price|cost)\b/i.test(normalized);
  return {customer:customer||'',company:company||'',phone:phone||'',source,equipment:detectEquipment(normalized),issue,priority:urgent?'Urgent':'Normal',summary:issue.slice(0,180),suggestedStatus:quoteRequested?'Waiting on Quote':'New',suggestedFollowupDays:urgent?0:1};
}
module.exports={localExtract};
