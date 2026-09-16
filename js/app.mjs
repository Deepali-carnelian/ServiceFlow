import { getAIHealth } from './services/api.mjs';
import { resetDemoJobs } from './store/jobsStore.mjs';
import { showToast } from './ui/toast.mjs';
import { setupAddRequest } from './features/addRequest.mjs';
import { setupAIIntake } from './features/aiIntake.mjs';
import { setupDashboard } from './features/dashboard.mjs';
import { setupJobDetails } from './features/jobDetails.mjs';
import { setupJobsTable } from './features/jobsTable.mjs';
import { setupNavigation } from './features/navigation.mjs';
import { setupTour } from './features/tour.mjs';

async function checkAIStatus() {
  const badge = document.getElementById('llmStatus');

  try {
    const data = await getAIHealth();
    badge.className = `llm-badge ${data.llmConfigured ? 'live' : 'demo'}`;
    badge.textContent = data.llmConfigured
      ? `✦ Live LLM · ${data.model}`
      : '✦ AI demo mode';
  } catch {
    badge.className = 'llm-badge offline';
    badge.textContent = 'AI server offline';
  }
}

function bootstrap() {
  setupNavigation();
  setupJobDetails();
  setupDashboard();
  setupJobsTable();
  setupAIIntake();
  setupAddRequest();
  setupTour();

  document.getElementById('resetDemo').addEventListener('click', () => {
    resetDemoJobs();
    showToast('Demo data reset.');
  });

  checkAIStatus();
}

bootstrap();
