function firstMatch(text, patterns) {
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match?.[1]) return match[1].trim();
  }
  return '';
}

function detectEquipment(text) {
  const lower = text.toLowerCase();
  const options = [
    ['walk-in freezer', 'Walk-in freezer'],
    ['walk in freezer', 'Walk-in freezer'],
    ['walk-in cooler', 'Walk-in cooler'],
    ['walk in cooler', 'Walk-in cooler'],
    ['ice machine', 'Ice machine'],
    ['display case', 'Display case'],
    ['prep cooler', 'Prep cooler'],
    ['reach-in', 'Reach-in refrigerator'],
    ['reach in', 'Reach-in refrigerator'],
    ['freezer', 'Freezer'],
    ['cooler', 'Cooler'],
    ['refrigerator', 'Refrigerator'],
    ['fridge', 'Refrigerator']
  ];

  for (const [needle, label] of options) {
    if (lower.includes(needle)) return label;
  }
  return 'Commercial refrigeration equipment';
}

function localExtract(text, source = 'Unknown') {
  const normalized = String(text || '').replace(/\s+/g, ' ').trim();
  const phone = firstMatch(normalized, [
    /(?:phone|number|call me at|reach me at)\s*[:\-]?\s*(\+?[\d()\-\s]{7,})/i,
    /(\+?\d[\d()\-\s]{6,}\d)/
  ]);
  const customer = firstMatch(normalized, [
    /name\s*[:\-]\s*([A-Za-z][A-Za-z .'-]{1,40})/i,
    /(?:this is|i'm|i am)\s+([A-Z][A-Za-z .'-]{1,40}?)(?=\s+(?:from|at|with)\b|[,.]|$)/
  ]);
  const company = firstMatch(normalized, [
    /business\s*[:\-]\s*([^,.;\n]{2,60})/i,
    /company\s*[:\-]\s*([^,.;\n]{2,60})/i,
    /(?:from|at|with)\s+([A-Z][A-Za-z0-9 &'’-]{2,60}?)(?=[,.]|(?:\s+(?:called|texted|here|our|we|the)\b)|$)/
  ]);
  const urgent = /\b(completely down|freezer down|cooler down|not cooling|stopped cooling|food|product loss|emergency|asap|urgent|same day|warming|temperature rising)\b/i.test(normalized);
  const quoteRequested = /\b(quote|estimate|pricing|price|cost)\b/i.test(normalized);

  return {
    customer: customer || '',
    company: company || '',
    phone: phone || '',
    source,
    equipment: detectEquipment(normalized),
    issue: normalized.slice(0, 220),
    priority: urgent ? 'Urgent' : 'Normal',
    summary: normalized.slice(0, 180),
    suggestedStatus: quoteRequested ? 'Quote Needed' : 'New',
    suggestedFollowupDays: urgent ? 0 : 1
  };
}

function localDraft(job) {
  const firstName = String(job.customer || 'there').trim().split(/\s+/)[0] || 'there';
  const equipment = String(job.equipment || job.issue || 'refrigeration equipment').trim();

  switch (job.status) {
    case 'Quote Needed':
      return `Hi ${firstName}, Denise here. I'm following up about the ${equipment}. I'm working on the next step for your quote. Is there anything else I should know before I finalise it?`;
    case 'Awaiting Approval':
      return `Hi ${firstName}, Denise here. Just checking in on the ${equipment} quote. Let me know if you'd like to go ahead or if you have any questions.`;
    case 'Scheduled':
      return `Hi ${firstName}, Denise here. Just checking in regarding your scheduled ${equipment} job. Please let me know if anything has changed before the visit.`;
    case 'Done':
      return `Hi ${firstName}, Denise here. Following up on the ${equipment} job. Please let me know if everything is running properly or if you need anything else.`;
    default:
      return `Hi ${firstName}, Denise here. I'm following up about your ${equipment} request. Are you available for a quick call so we can confirm the next step?`;
  }
}

module.exports = { localExtract, localDraft };
