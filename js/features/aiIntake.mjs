import { DEMO_MESSAGES } from '../data/demoData.mjs';
import { extractRequest } from '../services/api.mjs';
import { addJob } from '../store/jobsStore.mjs';
import { offsetISO, todayISO } from '../utils/date.mjs';
import { escapeHtml } from '../utils/format.mjs';
import { showToast } from '../ui/toast.mjs';
import { onBeforeViewChange, switchView } from './navigation.mjs';

let extractedResult = null;
let extractionController = null;

function reviewInput(label, id, value, placeholder = '', type = 'text', extraAttributes = '') {
  return `
    <label class="review-edit-field">
      <span>${escapeHtml(label)}</span>
      <input id="${id}" type="${type}" value="${escapeHtml(value)}" placeholder="${escapeHtml(placeholder)}" ${extraAttributes} />
    </label>`;
}

function reviewSelect(label, id, options, selectedValue) {
  return `
    <label class="review-edit-field">
      <span>${escapeHtml(label)}</span>
      <select id="${id}">
        ${options.map(option => `<option value="${escapeHtml(option)}" ${option === selectedValue ? 'selected' : ''}>${escapeHtml(option)}</option>`).join('')}
      </select>
    </label>`;
}

function showAIResult(result, meta) {
  extractedResult = result;
  document.getElementById('aiResultEmpty').classList.add('hidden');

  const resultElement = document.getElementById('aiResult');
  resultElement.classList.remove('hidden');

  const followupDays = Number.isFinite(Number(result.suggestedFollowupDays))
    ? Math.max(0, Number(result.suggestedFollowupDays))
    : 1;

  resultElement.innerHTML = `
    <div class="review-edit-note">
      <strong>Review before saving</strong>
      <span>Every field below is editable. Change anything the AI got wrong before creating the job.</span>
    </div>

    <div class="ai-review-grid editable-review-grid">
      ${reviewInput('Customer', 'reviewCustomer', result.customer || '', 'e.g. Peter')}
      ${reviewInput('Business', 'reviewCompany', result.company || '', 'e.g. Parkside Bakery')}
      ${reviewInput('Phone', 'reviewPhone', result.phone || '', 'e.g. (555) 123-4567', 'tel')}
      ${reviewSelect('Source', 'reviewSource', ['Phone','Website','Text','Referral','Repeat customer'], result.source || document.getElementById('aiSource').value)}
      ${reviewInput('Equipment', 'reviewEquipment', result.equipment || '', 'e.g. Walk-in freezer')}
      ${reviewSelect('Priority', 'reviewPriority', ['Normal','Urgent'], result.priority || 'Normal')}
      ${reviewSelect('Stage', 'reviewStatus', ['New','Quote Needed','Awaiting Approval','Scheduled','Done'], result.suggestedStatus || 'New')}
      ${reviewInput('Follow-up in days', 'reviewFollowupDays', String(followupDays), '0', 'number', 'min="0" step="1"')}
      ${reviewInput('Est. value ($)', 'reviewValue', result.value ? String(result.value) : '', 'Optional', 'number', 'min="0" step="50"')}
    </div>

    <label class="review-textarea-field"><span>AI summary</span><textarea id="reviewSummary" rows="3" placeholder="Short internal summary">${escapeHtml(result.summary || '')}</textarea></label>
    <label class="review-textarea-field"><span>Issue</span><textarea id="reviewIssue" rows="3" placeholder="Describe the equipment problem or service request">${escapeHtml(result.issue || '')}</textarea></label>
    <div id="reviewValidation" class="review-validation hidden"></div>
    <div class="review-warning">AI can misread details. These reviewed values — not the original AI response — are what will be saved to the job.</div>
    <button id="createFromAI" class="primary full">Create job from reviewed result</button>`;

  document.getElementById('aiRunMeta').textContent = `${meta.model} · ${meta.mode === 'live-llm' ? 'live LLM' : 'demo fallback'}`;
}

async function runAIExtraction() {
  const text = document.getElementById('aiInput').value.trim();
  const source = document.getElementById('aiSource').value;
  if (!text) return showToast('Paste or load a request first.');

  extractionController?.abort();
  const controller = new AbortController();
  extractionController = controller;

  const button = document.getElementById('extractAI');
  button.disabled = true;
  button.textContent = 'Extracting…';
  document.getElementById('aiRunMeta').textContent = 'Reading the request…';

  try {
    const data = await extractRequest({ text, source, signal: controller.signal });
    if (extractionController !== controller || controller.signal.aborted) return;
    showAIResult(data.result, data);
  } catch (error) {
    if (error.name === 'AbortError') return;
    document.getElementById('aiRunMeta').textContent = error.message;
    showToast('AI extraction failed.');
  } finally {
    if (extractionController === controller) {
      extractionController = null;
      button.disabled = false;
      button.textContent = '✦ Extract with AI';
    }
  }
}

function createJobFromAI() {
  if (!extractedResult) return;

  const customer = valueOf('reviewCustomer');
  const company = valueOf('reviewCompany');
  const phone = valueOf('reviewPhone');
  const source = document.getElementById('reviewSource')?.value || document.getElementById('aiSource').value;
  const equipment = valueOf('reviewEquipment');
  const priority = document.getElementById('reviewPriority')?.value || 'Normal';
  const status = document.getElementById('reviewStatus')?.value || 'New';
  const summary = valueOf('reviewSummary');
  const issue = valueOf('reviewIssue');
  const valueRaw = valueOf('reviewValue');
  const followupRaw = valueOf('reviewFollowupDays') || '0';

  const errors = [];
  if (!customer) errors.push('Customer name is required.');
  if (!issue) errors.push('Issue is required.');

  const followupDays = Number(followupRaw);
  if (!Number.isFinite(followupDays) || followupDays < 0 || !Number.isInteger(followupDays)) {
    errors.push('Follow-up days must be a whole number of 0 or more.');
  }

  const estimatedValue = valueRaw === '' ? 0 : Number(valueRaw);
  if (!Number.isFinite(estimatedValue) || estimatedValue < 0) {
    errors.push('Estimated value must be 0 or more.');
  }

  const validation = document.getElementById('reviewValidation');
  if (errors.length) {
    validation.innerHTML = errors.map(error => `<div>• ${escapeHtml(error)}</div>`).join('');
    validation.classList.remove('hidden');
    showToast('Check the reviewed fields before creating the job.');
    return;
  }

  addJob({
    id: crypto.randomUUID(),
    customer,
    company,
    phone,
    source,
    issue,
    equipment,
    status,
    value: estimatedValue,
    priority,
    createdAt: todayISO(),
    lastContact: todayISO(),
    nextFollowup: offsetISO(followupDays),
    notes: summary ? `Reviewed AI intake summary: ${summary}` : 'Created from reviewed AI intake.'
  });

  showToast('Reviewed request added to the pipeline.');
  switchView('dashboard');
}

function valueOf(id) {
  return document.getElementById(id)?.value.trim() || '';
}

export function resetAIIntake() {
  extractionController?.abort();
  extractionController = null;
  extractedResult = null;

  const input = document.getElementById('aiInput');
  const source = document.getElementById('aiSource');
  const result = document.getElementById('aiResult');
  const empty = document.getElementById('aiResultEmpty');
  const meta = document.getElementById('aiRunMeta');
  const button = document.getElementById('extractAI');

  if (input) input.value = '';
  if (source) source.selectedIndex = 0;
  if (result) {
    result.innerHTML = '';
    result.classList.add('hidden');
  }
  empty?.classList.remove('hidden');
  if (meta) meta.textContent = '';
  if (button) {
    button.disabled = false;
    button.textContent = '✦ Extract with AI';
  }
}

export function setupAIIntake() {
  document.querySelectorAll('.demo-chip').forEach(button => {
    button.addEventListener('click', () => {
      const demo = DEMO_MESSAGES[Number(button.dataset.demo)];
      document.getElementById('aiSource').value = demo.source;
      document.getElementById('aiInput').value = demo.text;
    });
  });

  document.getElementById('extractAI').addEventListener('click', runAIExtraction);
  document.getElementById('aiResult').addEventListener('click', event => {
    if (event.target.id === 'createFromAI') createJobFromAI();
  });

  onBeforeViewChange(({ from, to }) => {
    if (from === 'ai' && to !== 'ai') resetAIIntake();
  });
}
