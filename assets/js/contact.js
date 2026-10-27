// Enhance only after the complete handler is installed; HTML POST stays the fallback.
const form = document.querySelector('#contact-form');
if (form && window.fetch && window.FormData && window.AbortController) {
  const fields = [...form.querySelectorAll('input, textarea')];
  const fieldsContainer = form.querySelector('.contact-fields');
  const submit = form.querySelector('[type="submit"]');
  const status = document.querySelector('#contact-status');
  const reset = document.querySelector('#contact-another');
  let busy = false;
  let sent = false;

  function errorFor(field, message) {
    const error = document.querySelector(`#${field.id}-error`);
    error.textContent = message;
    field.setAttribute('aria-invalid', String(Boolean(message)));
  }
  function localError(field) {
    if (!field.value.trim()) return `Enter your ${field.name === 'message' ? 'message' : field.name}.`;
    if (field.validity.typeMismatch) return 'Enter a valid email address, such as name@example.com.';
    return '';
  }
  function announce(message, state) {
    status.textContent = message;
    status.dataset.state = state;
  }
  for (const field of fields) {
    field.addEventListener('input', () => {
      if (field.getAttribute('aria-invalid') === 'true') errorFor(field, localError(field));
    });
  }
  reset.addEventListener('click', () => {
    form.reset();
    sent = false;
    form.querySelector('.contact-fields').hidden = false;
    submit.hidden = false;
    reset.hidden = true;
    announce('', '');
    fields[0].focus();
  });
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (busy || sent) return;
    fields.forEach((field) => errorFor(field, localError(field)));
    const invalid = fields.find((field) => field.getAttribute('aria-invalid') === 'true');
    if (invalid) {
      announce('Please check the highlighted fields.', 'error');
      invalid.focus();
      return;
    }
    const body = new FormData(form);
    busy = true;
    submit.disabled = true;
    fields.forEach((field) => { field.readOnly = true; });
    // Keep the live region outside the busy subtree: assistive tech may defer
    // announcements owned by an aria-busy element, so mark only the fields.
    fieldsContainer.setAttribute('aria-busy', 'true');
    announce('Sending your message...', 'pending');
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 20000);
    try {
      const response = await fetch(form.action, {
        method: 'POST', body, headers: { Accept: 'application/json' }, signal: controller.signal,
      });
      const data = await response.json().catch(() => null);
      if (response.ok && data && typeof data === 'object' && !Array.isArray(data) && !data.errors && !data.error) {
        sent = true;
        form.querySelector('.contact-fields').hidden = true;
        submit.hidden = true;
        reset.hidden = false;
        announce("Thanks, your message has been sent. I'll get back to you.", 'success');
        status.focus();
      } else if (response.status === 429) {
        announce('Too many attempts. Please wait a few minutes before trying again. Your message is still here.', 'error');
      } else if (Array.isArray(data?.errors)) {
        for (const error of data.errors) {
          const field = fields.find((item) => item.name === error.field);
          if (field) errorFor(field, field.name === 'email'
            ? 'Enter a valid email address, such as name@example.com.'
            : `Please check your ${field.name}.`);
        }
        const rejected = fields.find((field) => field.getAttribute('aria-invalid') === 'true');
        announce(rejected ? 'Please check the highlighted fields. Your message has not been sent.'
          : 'Your message could not be sent. Please try again later. Your message is still here.', 'error');
        if (rejected) rejected.focus();
      } else {
        announce('We could not confirm your message was sent. Your message is still here. Please try again later.', 'error');
      }
    } catch (error) {
      announce('We could not confirm your message was sent. Check your connection before trying again. Your message is still here.', 'error');
    } finally {
      clearTimeout(timeout);
      busy = false;
      submit.disabled = false;
      fields.forEach((field) => { field.readOnly = false; });
      fieldsContainer.removeAttribute('aria-busy');
    }
  });
  form.noValidate = true;
}
