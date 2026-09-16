import { TOUR_STORAGE_KEY } from '../config.mjs';
import { showToast } from '../ui/toast.mjs';
import { switchView } from './navigation.mjs';

const TOUR_STEPS = [
  {
    view: 'dashboard',
    target: '.stats-grid',
    title: 'Start every morning here',
    text: 'Today is Denise’s action list. It shows overdue follow-ups, open jobs, quotes waiting, and the value currently in the pipeline.'
  },
  {
    view: 'dashboard',
    target: '#pipeline',
    title: 'See where every job stands',
    text: 'The pipeline gives Denise the complete job picture. Open a job to move it forward or backward through Quote Needed ↔ Awaiting Approval ↔ Scheduled ↔ Done.'
  },
  {
    view: 'ai',
    target: '.ai-panel',
    title: 'Capture messy requests with AI',
    text: 'For a text, email, website form, or phone note, paste the raw request here. Gemini extracts the useful job information instead of making Denise type everything manually.'
  },
  {
    view: 'ai',
    target: '.result-panel .panel-head',
    title: 'Denise stays in control',
    text: 'The AI result is only a draft. Every field in Human Review is editable before the job is created, so Denise can correct anything the model misunderstood.'
  },
  {
    view: 'jobs',
    target: '.jobs-toolbar',
    title: 'Find every request in one place',
    text: 'All Jobs is the searchable source of truth. Denise can filter by status, edit customer details, open a job, move its stage, or draft a follow-up.'
  },
  {
    view: 'jobs',
    target: '#openAddModal',
    title: 'Manual capture is always available',
    text: 'If a request comes in while Denise is on the phone, Add request lets her capture it directly without using AI.'
  }
];

let index = 0;
let active = false;
let highlighted = null;

function clearHighlight() {
  highlighted?.classList.remove('tour-highlight');
  highlighted = null;
}

function closeTour(markComplete = true) {
  active = false;
  clearHighlight();

  const overlay = document.getElementById('tourOverlay');
  const card = document.getElementById('tourCard');
  overlay.classList.add('hidden');
  overlay.setAttribute('aria-hidden', 'true');
  card.classList.add('hidden');

  if (markComplete) localStorage.setItem(TOUR_STORAGE_KEY, 'true');
}

function renderStep() {
  if (!active) return;

  const step = TOUR_STEPS[index];
  if (!step) return finishTour();

  switchView(step.view);
  clearHighlight();

  requestAnimationFrame(() => {
    const target = document.querySelector(step.target);
    if (target) {
      highlighted = target;
      target.classList.add('tour-highlight');
      target.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }

    document.getElementById('tourStep').textContent = `${index + 1} of ${TOUR_STEPS.length}`;
    document.getElementById('tourTitle').textContent = step.title;
    document.getElementById('tourText').textContent = step.text;
    document.getElementById('tourBack').disabled = index === 0;
    document.getElementById('tourNext').textContent = index === TOUR_STEPS.length - 1 ? 'Finish' : 'Next';
    document.getElementById('tourProgress').innerHTML = TOUR_STEPS.map((_, itemIndex) =>
      `<span class="tour-dot ${itemIndex === index ? 'active' : ''} ${itemIndex < index ? 'done' : ''}"></span>`
    ).join('');
  });
}

function startTour() {
  const detailModal = document.getElementById('detailModal');
  const leadModal = document.getElementById('leadModal');
  if (detailModal.open) detailModal.close();
  if (leadModal.open) leadModal.close();

  index = 0;
  active = true;
  document.getElementById('tourOverlay').classList.remove('hidden');
  document.getElementById('tourOverlay').setAttribute('aria-hidden', 'false');
  document.getElementById('tourCard').classList.remove('hidden');
  renderStep();
}

function finishTour() {
  closeTour(true);
  switchView('dashboard');
  showToast('Tour complete — ServiceFlow is ready.');
}

function nextStep() {
  if (!active) return;
  if (index >= TOUR_STEPS.length - 1) return finishTour();
  index += 1;
  renderStep();
}

function previousStep() {
  if (!active || index === 0) return;
  index -= 1;
  renderStep();
}

export function setupTour() {
  document.getElementById('startTour').addEventListener('click', startTour);
  document.getElementById('tourNext').addEventListener('click', nextStep);
  document.getElementById('tourBack').addEventListener('click', previousStep);
  document.getElementById('tourSkip').addEventListener('click', () => {
    closeTour(true);
    showToast('Tour skipped. You can replay it from the sidebar.');
  });

  if (localStorage.getItem(TOUR_STORAGE_KEY) !== 'true') {
    setTimeout(startTour, 650);
  }
}
