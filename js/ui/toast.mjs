let hideTimer = null;

export function showToast(message) {
  const toast = document.getElementById('toast');
  if (!toast) return;

  toast.textContent = message;
  toast.classList.add('show');

  clearTimeout(hideTimer);
  hideTimer = setTimeout(() => toast.classList.remove('show'), 1900);
}
