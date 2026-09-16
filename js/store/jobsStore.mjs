import { STORAGE_KEY } from '../config.mjs';
import { DEMO_JOBS } from '../data/demoData.mjs';
import { daysAgoISO, offsetISO } from '../utils/date.mjs';

const listeners = new Set();
let jobs = loadJobs();

function seedJobs() {
  return DEMO_JOBS.map(item => ({
    id: crypto.randomUUID(),
    customer: item.customer,
    company: item.company,
    phone: item.phone,
    source: item.source,
    issue: item.issue,
    equipment: item.equipment || '',
    status: item.status,
    value: item.value || 0,
    priority: item.priority || 'Normal',
    createdAt: daysAgoISO(item.daysCreatedAgo || 0),
    lastContact: daysAgoISO(item.daysLastContactAgo || 0),
    nextFollowup: offsetISO(item.followupOffset || 0),
    notes: item.notes || ''
  }));
}

function loadJobs() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) return JSON.parse(saved);
  } catch (error) {
    console.warn('Could not read saved jobs:', error);
  }

  const seeded = seedJobs();
  localStorage.setItem(STORAGE_KEY, JSON.stringify(seeded));
  return seeded;
}

function persistAndNotify() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(jobs));
  listeners.forEach(listener => listener(jobs));
}

export function getJobs() {
  return jobs;
}

export function findJob(id) {
  return jobs.find(job => job.id === id) || null;
}

export function addJob(job) {
  jobs.unshift(job);
  persistAndNotify();
  return job;
}

export function updateJob(id, changes) {
  const job = findJob(id);
  if (!job) return null;

  if (typeof changes === 'function') {
    changes(job);
  } else {
    Object.assign(job, changes);
  }

  persistAndNotify();
  return job;
}

export function resetDemoJobs() {
  jobs = seedJobs();
  persistAndNotify();
  return jobs;
}

export function subscribeJobs(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
