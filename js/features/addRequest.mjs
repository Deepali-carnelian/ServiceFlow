import { addJob } from '../store/jobsStore.mjs';
import { todayISO } from '../utils/date.mjs';
import { showToast } from '../ui/toast.mjs';

const modal = () => document.getElementById('leadModal');
const form = () => document.getElementById('leadForm');

function clearErrors() {
  form().querySelectorAll('.field-error').forEach(element => {
    element.textContent = '';
    element.classList.remove('visible');
  });

  form().querySelectorAll('.field-invalid').forEach(element => {
    element.classList.remove('field-invalid');
    element.removeAttribute('aria-invalid');
  });
}

function setError(name, message) {
  const field = form().elements[name];
  const error = form().querySelector(`[data-error-for="${name}"]`);

  field?.classList.add('field-invalid');
  field?.setAttribute('aria-invalid', 'true');

  if (error) {
    error.textContent = message;
    error.classList.add('visible');
  }
}

function validate() {
  clearErrors();
  const data = form().elements;
  const errors = [];

  if (!data.customer.value.trim()) errors.push(['customer', 'Enter the customer name.']);

  const phone = data.phone.value.trim();
  if (!phone) errors.push(['phone', 'Enter a phone number.']);
  else if (phone.replace(/\D/g, '').length < 7) errors.push(['phone', 'Enter a valid phone number.']);

  if (!data.issue.value.trim()) errors.push(['issue', 'Describe the equipment problem or service request.']);
  if (!data.nextFollowup.value) errors.push(['nextFollowup', 'Choose when Denise should follow up.']);
  if (data.value.value.trim() && Number(data.value.value) < 0) errors.push(['value', 'Estimated value cannot be negative.']);

  errors.forEach(([name, message]) => setError(name, message));

  if (errors.length) {
    data[errors[0][0]]?.focus();
    showToast('Please check the highlighted fields.');
    return false;
  }

  return true;
}

function closeModal() {
  clearErrors();
  if (modal().open) modal().close();
}

function openModal() {
  form().reset();
  clearErrors();
  form().elements.nextFollowup.value = todayISO();
  modal().showModal();
  requestAnimationFrame(() => form().elements.customer.focus());
}

function submitRequest(event) {
  event.preventDefault();
  if (!validate()) return;

  const data = new FormData(form());
  addJob({
    id: crypto.randomUUID(),
    customer: data.get('customer').trim(),
    company: data.get('company').trim(),
    phone: data.get('phone').trim(),
    source: data.get('source'),
    equipment: data.get('equipment').trim(),
    issue: data.get('issue').trim(),
    status: data.get('status'),
    value: Number(data.get('value') || 0),
    priority: data.get('priority'),
    createdAt: todayISO(),
    lastContact: todayISO(),
    nextFollowup: data.get('nextFollowup'),
    notes: data.get('notes').trim()
  });

  closeModal();
  showToast('New request captured.');
}

export function setupAddRequest() {
  document.getElementById('openAddModal').addEventListener('click', openModal);
  document.getElementById('closeLeadModal').addEventListener('click', closeModal);
  document.getElementById('cancelLeadModal').addEventListener('click', closeModal);

  modal().addEventListener('click', event => {
    if (event.target === modal()) closeModal();
  });

  form().querySelectorAll('input, textarea, select').forEach(field => {
    const eventName = field.tagName === 'SELECT' ? 'change' : 'input';
    field.addEventListener(eventName, () => {
      field.classList.remove('field-invalid');
      field.removeAttribute('aria-invalid');
      const error = form().querySelector(`[data-error-for="${field.name}"]`);
      if (error) {
        error.textContent = '';
        error.classList.remove('visible');
      }
    });
  });

  form().addEventListener('submit', submitRequest);
}
