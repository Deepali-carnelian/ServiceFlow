import { VIEW_TITLES } from '../config.mjs';

const beforeChangeHandlers = new Set();

export function onBeforeViewChange(handler) {
  beforeChangeHandlers.add(handler);
  return () => beforeChangeHandlers.delete(handler);
}

export function currentView() {
  const viewId = document.querySelector('.view.active')?.id || '';
  return viewId.replace(/View$/, '');
}

export function switchView(view) {
  const from = currentView();
  if (from === view) return;

  beforeChangeHandlers.forEach(handler => handler({ from, to: view }));

  document.querySelectorAll('.nav-item').forEach(button => {
    button.classList.toggle('active', button.dataset.view === view);
  });

  document.querySelectorAll('.view').forEach(section => {
    section.classList.remove('active');
  });

  document.getElementById(`${view}View`)?.classList.add('active');
  document.getElementById('pageTitle').textContent = VIEW_TITLES[view] || '';
}

export function setupNavigation() {
  document.querySelectorAll('.nav-item').forEach(button => {
    button.addEventListener('click', () => switchView(button.dataset.view));
  });
}
