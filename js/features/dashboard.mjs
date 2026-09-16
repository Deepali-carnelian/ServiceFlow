import { getJobs, subscribeJobs } from '../store/jobsStore.mjs';
import { dateDiffDays, formatDate, todayISO } from '../utils/date.mjs';
import { escapeHtml, formatMoney } from '../utils/format.mjs';
import { logCall, openJob } from './jobDetails.mjs';
import { STATUS_ORDER } from '../config.mjs';

function needsFollowup(job) {
  return job.status !== 'Done' && job.nextFollowup <= todayISO();
}

function followupLabel(job) {
  const diff = dateDiffDays(job.nextFollowup, todayISO());
  return diff > 0 ? `${diff} day${diff === 1 ? '' : 's'} overdue` : 'Due today';
}

function sortPriority(a, b) {
  if (a.priority !== b.priority) return a.priority === 'Urgent' ? -1 : 1;
  return dateDiffDays(b.nextFollowup, todayISO()) - dateDiffDays(a.nextFollowup, todayISO());
}

function renderStats(jobs) {
  const open = jobs.filter(job => job.status !== 'Done');
  document.getElementById('statDue').textContent = open.filter(needsFollowup).length;
  document.getElementById('statOpen').textContent = open.length;
  document.getElementById('statQuote').textContent = open.filter(job => job.status === 'Quote Needed').length;
  document.getElementById('statValue').textContent = formatMoney(open.reduce((sum, job) => sum + Number(job.value || 0), 0));
}

function renderFollowups(jobs) {
  const due = jobs.filter(needsFollowup).sort(sortPriority);
  const container = document.getElementById('followupList');

  if (!due.length) {
    container.innerHTML = '<div class="empty-state"><strong>Nothing is slipping today.</strong>Every open request has a future follow-up date.</div>';
    return;
  }

  container.innerHTML = due.map(job => {
    const overdue = job.nextFollowup < todayISO();
    return `
      <article class="followup-card ${overdue ? 'overdue' : 'today'}">
        <div class="customer"><strong>${escapeHtml(job.customer)}</strong><small>${escapeHtml(job.company || job.source)} · ${escapeHtml(job.phone)}</small></div>
        <div class="issue"><strong>${escapeHtml(job.issue)}</strong><small>${escapeHtml(job.status)}${job.priority === 'Urgent' ? ' · Urgent' : ''}</small></div>
        <div class="due"><strong class="${overdue ? 'late' : ''}">${followupLabel(job)}</strong><small>Last contact ${formatDate(job.lastContact)}</small></div>
        <div class="action-row">
          <button class="action-btn emphasis" data-dashboard-action="call" data-job-id="${job.id}">✓ Called</button>
          <button class="action-btn" data-dashboard-action="open" data-job-id="${job.id}">Open</button>
        </div>
      </article>`;
  }).join('');
}

function renderPipeline(jobs) {
  document.getElementById('pipeline').innerHTML = STATUS_ORDER.map(status => {
    const items = jobs.filter(job => job.status === status);
    return `
      <div class="pipeline-col">
        <div class="pipeline-head"><h4>${status}</h4><span class="count-pill">${items.length}</span></div>
        ${items.length
          ? items.map(job => `
              <button class="job-chip" data-dashboard-action="open" data-job-id="${job.id}">
                <strong>${escapeHtml(job.company || job.customer)}</strong>
                <small>${escapeHtml(job.issue)}</small>
                ${job.priority === 'Urgent' && job.status !== 'Done' ? '<span class="urgent-badge">URGENT</span>' : ''}
              </button>`).join('')
          : '<small class="muted">No jobs</small>'}
      </div>`;
  }).join('');
}

export function renderDashboard() {
  const jobs = getJobs();
  renderStats(jobs);
  renderFollowups(jobs);
  renderPipeline(jobs);
}

export function setupDashboard() {
  const view = document.getElementById('dashboardView');
  view.addEventListener('click', event => {
    const button = event.target.closest('[data-dashboard-action]');
    if (!button) return;

    if (button.dataset.dashboardAction === 'open') openJob(button.dataset.jobId);
    if (button.dataset.dashboardAction === 'call') logCall(button.dataset.jobId);
  });

  subscribeJobs(renderDashboard);
  renderDashboard();
}
