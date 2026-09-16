export function localISO(date) {
  const copy = new Date(date);
  const offset = copy.getTimezoneOffset();
  return new Date(copy.getTime() - offset * 60000).toISOString().slice(0, 10);
}

export function todayISO() {
  return localISO(new Date());
}

export function offsetISO(days) {
  const date = new Date();
  date.setDate(date.getDate() + Number(days || 0));
  return localISO(date);
}

export function daysAgoISO(days) {
  return offsetISO(-Number(days || 0));
}

export function dateDiffDays(from, to) {
  const start = new Date(`${from}T12:00:00`);
  const end = new Date(`${to}T12:00:00`);
  return Math.round((end - start) / 86400000);
}

export function formatDate(dateString) {
  if (!dateString) return '—';
  return new Date(`${dateString}T12:00:00`).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric'
  });
}
