import { JOB_WORKFLOW, PRIORITY_OPTIONS, SOURCE_OPTIONS, STATUS_ORDER } from '../config.mjs';
import { draftFollowup as requestDraft } from '../services/api.mjs';
import { findJob, updateJob } from '../store/jobsStore.mjs';
import { formatDate, offsetISO, todayISO } from '../utils/date.mjs';
import { escapeHtml, formatMoney } from '../utils/format.mjs';
import { showToast } from '../ui/toast.mjs';

const FOLLOWUP_OFFSETS = {
  New: 1,
  'Quote Needed': 1,
  'Awaiting Approval': 2,
  Scheduled: 1,
  Done: 14
};

function workflowStageButtons(job) {
  const currentIndex = JOB_WORKFLOW.indexOf(job.status);

  return JOB_WORKFLOW.map((status, index) => {
    const isCurrent = status === job.status;
    const isPast = currentIndex >= 0 && index < currentIndex;

    return `
      <button
        type="button"
        class="workflow-stage ${isCurrent ? 'current' : ''} ${isPast ? 'past' : ''}"
        data-job-action="status"
        data-job-id="${job.id}"
        data-status="${escapeHtml(status)}"
        ${isCurrent ? 'aria-current="step"' : ''}
      >
        <span class="workflow-stage-index">${index + 1}</span>
        <span>${escapeHtml(status)}</span>
      </button>
      ${index < JOB_WORKFLOW.length - 1 ? '<span class="workflow-arrow">↔</span>' : ''}
    `;
  }).join('');
}

export function logCall(id) {
  const job = updateJob(id, current => {
    current.lastContact = todayISO();
    current.nextFollowup = offsetISO(1);
  });

  if (job) {
    showToast(`Call logged for ${job.customer}. Follow-up moved to tomorrow.`);
  }
}

export function changeStatus(id, nextStatus) {
  if (!STATUS_ORDER.includes(nextStatus)) return;

  const job = updateJob(id, current => {
    current.status = nextStatus;
    current.lastContact = todayISO();
    current.nextFollowup = offsetISO(FOLLOWUP_OFFSETS[nextStatus] ?? 1);
  });

  if (!job) return;
  openJob(id);
  showToast(`Moved to ${nextStatus}.`);
}

export function openJob(id) {
  const job = findJob(id);
  if (!job) return;

  const workflowIndex = JOB_WORKFLOW.indexOf(job.status);
  const previousStatus = workflowIndex > 0 ? JOB_WORKFLOW[workflowIndex - 1] : null;
  const nextStatus = job.status === 'New'
    ? 'Quote Needed'
    : (workflowIndex >= 0 && workflowIndex < JOB_WORKFLOW.length - 1
      ? JOB_WORKFLOW[workflowIndex + 1]
      : null);

  document.getElementById('detailTitle').textContent = job.company || job.customer;
  document.getElementById('detailContent').innerHTML = `
    <div class="detail-grid">
      ${detailItem('Customer', job.customer)}
      ${detailItem('Business', job.company || '—')}
      ${detailItem('Phone', job.phone || '—')}
      ${detailItem('Source', job.source || '—')}
      ${detailItem('Equipment', job.equipment || '—')}
      ${detailItem('Priority', job.priority || 'Normal')}
      ${detailItem('Estimated value', formatMoney(job.value), false)}
      ${detailItem('Status', job.status)}
      ${detailItem('Next follow-up', formatDate(job.nextFollowup), false)}
    </div>

    <div class="notes-box">
      <strong>${escapeHtml(job.issue)}</strong><br>
      ${escapeHtml(job.notes || 'No notes yet.')}
    </div>

    <div class="workflow-block">
      <div class="workflow-block-head">
        <div>
          <span class="workflow-kicker">JOB FLOW</span>
          <strong>Move the job forward or backward</strong>
        </div>
        <small>Click any stage to correct the job state.</small>
      </div>
      <div class="workflow-track">${workflowStageButtons(job)}</div>
      ${job.status === 'New'
        ? '<p class="workflow-new-note">This request is still new. Move it to <strong>Quote Needed</strong> when Denise starts the commercial follow-up.</p>'
        : ''}
    </div>

    <div class="detail-actions">
      <button class="action-btn" data-job-action="edit" data-job-id="${job.id}">✎ Edit details</button>
      <button class="action-btn emphasis" data-job-action="call" data-job-id="${job.id}">✓ Log customer call</button>
      ${previousStatus ? `<button class="action-btn" data-job-action="status" data-job-id="${job.id}" data-status="${escapeHtml(previousStatus)}">← ${escapeHtml(previousStatus)}</button>` : ''}
      ${nextStatus ? `<button class="action-btn" data-job-action="status" data-job-id="${job.id}" data-status="${escapeHtml(nextStatus)}">${escapeHtml(nextStatus)} →</button>` : ''}
      <button class="action-btn ai-button" data-job-action="draft" data-job-id="${job.id}">✦ Draft follow-up</button>
    </div>

    <div id="draftBox" class="draft-box hidden"></div>
  `;

  document.getElementById('detailModal').showModal();
}

function detailItem(label, value, shouldEscape = true) {
  return `
    <div class="detail-item">
      <span>${escapeHtml(label)}</span>
      <strong>${shouldEscape ? escapeHtml(value) : value}</strong>
    </div>`;
}

export function editJobDetails(id) {
  const job = findJob(id);
  if (!job) return;

  document.getElementById('detailTitle').textContent = 'Edit customer / job details';
  document.getElementById('detailContent').innerHTML = `
    <form id="editJobForm" class="edit-job-form" data-job-id="${job.id}" novalidate>
      <div class="edit-job-grid">
        ${textField('Customer name', 'customer', job.customer, true, 'name')}
        ${textField('Business', 'company', job.company || '', false, 'organization')}
        ${textField('Phone', 'phone', job.phone || '', false, 'tel')}
        ${selectField('Source', 'source', SOURCE_OPTIONS, job.source || 'Phone')}
        ${textField('Equipment', 'equipment', job.equipment || '')}
        ${selectField('Priority', 'priority', PRIORITY_OPTIONS, job.priority || 'Normal')}
        ${numberField('Estimated value ($)', 'value', Number(job.value || 0), 0, 50)}
        ${dateField('Next follow-up', 'nextFollowup', job.nextFollowup || todayISO(), true)}
        ${textareaField('Issue', 'issue', job.issue || '', true, 3, 'span-2')}
        ${textareaField('Notes', 'notes', job.notes || '', false, 4, 'span-2')}
      </div>

      <div id="editJobValidation" class="review-validation hidden"></div>
      <div class="edit-job-hint">Job status is changed separately using the workflow controls, so editing customer details will not accidentally move the job.</div>
      <div class="modal-actions edit-job-actions">
        <button type="button" class="ghost" data-job-action="open" data-job-id="${job.id}">Cancel</button>
        <button type="submit" class="primary">Save changes</button>
      </div>
    </form>`;
}

function textField(label, name, value, required = false, autocomplete = '') {
  return `<label>${fieldLabel(label, required)}<input name="${name}" value="${escapeHtml(value)}" ${autocomplete ? `autocomplete="${autocomplete}"` : ''} /></label>`;
}

function numberField(label, name, value, min, step) {
  return `<label>${label}<input name="${name}" type="number" min="${min}" step="${step}" value="${value}" /></label>`;
}

function dateField(label, name, value, required = false) {
  return `<label>${fieldLabel(label, required)}<input name="${name}" type="date" value="${escapeHtml(value)}" /></label>`;
}

function textareaField(label, name, value, required, rows, className = '') {
  return `<label class="${className}">${fieldLabel(label, required)}<textarea name="${name}" rows="${rows}">${escapeHtml(value)}</textarea></label>`;
}

function selectField(label, name, options, selected) {
  return `<label>${label}<select name="${name}">${options.map(option => `<option value="${escapeHtml(option)}" ${option === selected ? 'selected' : ''}>${escapeHtml(option)}</option>`).join('')}</select></label>`;
}

function fieldLabel(label, required) {
  if (!required) return label;
  return `<span class="field-label-inline">${escapeHtml(label)} <span class="required-star">*</span></span>`;
}

function saveEditedJob(form) {
  const id = form.dataset.jobId;
  const data = new FormData(form);
  const customer = String(data.get('customer') || '').trim();
  const issue = String(data.get('issue') || '').trim();
  const nextFollowup = String(data.get('nextFollowup') || '').trim();
  const valueRaw = String(data.get('value') || '').trim();
  const value = valueRaw === '' ? 0 : Number(valueRaw);

  const errors = [];
  if (!customer) errors.push('Customer name is required.');
  if (!issue) errors.push('Issue is required.');
  if (!nextFollowup) errors.push('Next follow-up date is required.');
  if (!Number.isFinite(value) || value < 0) errors.push('Estimated value must be 0 or more.');

  const validation = document.getElementById('editJobValidation');
  if (errors.length) {
    validation.innerHTML = errors.map(error => `<div>• ${escapeHtml(error)}</div>`).join('');
    validation.classList.remove('hidden');
    showToast('Check the highlighted job details.');
    return;
  }

  updateJob(id, job => {
    job.customer = customer;
    job.company = String(data.get('company') || '').trim();
    job.phone = String(data.get('phone') || '').trim();
    job.source = String(data.get('source') || 'Phone');
    job.equipment = String(data.get('equipment') || '').trim();
    job.priority = String(data.get('priority') || 'Normal');
    job.value = value;
    job.nextFollowup = nextFollowup;
    job.issue = issue;
    job.notes = String(data.get('notes') || '').trim();
  });

  openJob(id);
  showToast('Customer and job details updated.');
}

async function draftMessage(id) {
  const job = findJob(id);
  const box = document.getElementById('draftBox');
  if (!job || !box) return;

  box.classList.remove('hidden');
  box.innerHTML = '<span class="spinner"></span> Drafting a safe customer follow-up…';

  try {
    const data = await requestDraft(job);
    box.innerHTML = `
      <div class="draft-head">
        <strong>AI draft</strong>
        <small>${escapeHtml(data.model)} · ${data.mode === 'live-llm' ? 'live LLM' : 'demo fallback'}</small>
      </div>
      <p>${escapeHtml(data.draft)}</p>
      <button class="action-btn" data-job-action="copy-draft" data-draft="${escapeHtml(data.draft)}">Copy message</button>`;
  } catch (error) {
    box.innerHTML = `<strong>Could not draft message.</strong><p>${escapeHtml(error.message)}</p>`;
  }
}

export function setupJobDetails() {
  const detailContent = document.getElementById('detailContent');
  const modal = document.getElementById('detailModal');

  document.getElementById('closeDetail').addEventListener('click', () => modal.close());

  detailContent.addEventListener('click', async event => {
    const button = event.target.closest('[data-job-action]');
    if (!button) return;

    const { jobAction, jobId, status, draft } = button.dataset;

    if (jobAction === 'open') openJob(jobId);
    if (jobAction === 'edit') editJobDetails(jobId);
    if (jobAction === 'call') {
      logCall(jobId);
      modal.close();
    }
    if (jobAction === 'status') changeStatus(jobId, status);
    if (jobAction === 'draft') draftMessage(jobId);
    if (jobAction === 'copy-draft') {
      await navigator.clipboard?.writeText(draft || '');
      showToast('Draft copied');
    }
  });

  detailContent.addEventListener('submit', event => {
    if (event.target.id !== 'editJobForm') return;
    event.preventDefault();
    saveEditedJob(event.target);
  });
}
