const form = document.querySelector<HTMLFormElement>('#contact-form');
const status = document.querySelector<HTMLElement>('#contact-status');
type Turnstile = { render: (element: HTMLElement, options: Record<string, unknown>) => string; reset: (id: string) => void };
const api = () => (window as Window & { turnstile?: Turnstile }).turnstile;
if (form && status) {
  const button = form.querySelector<HTMLButtonElement>('button[type="submit"]')!;
  const container = form.querySelector<HTMLElement>('[data-turnstile]')!;
  let token = '';
  let sending = false;
  let widget = '';
  const notice = (text: string) => { status.textContent = text; };
  const script = document.createElement('script');
  script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
  script.async = true;
  script.onload = () => {
    widget = api()!.render(container, {
      sitekey: '0x4AAAAAAE5IcjrbA8vViJbC', action: 'contact', size: 'flexible', theme: 'auto',
      callback: (value: string) => { token = value; button.disabled = sending; if (status.textContent === 'Loading verification…') notice('Ready to send.'); },
      'expired-callback': () => { token = ''; button.disabled = true; notice('Verification expired. Please verify again.'); },
      'error-callback': () => { token = ''; button.disabled = true; notice('Verification unavailable. Please use the email link.'); }
    });
  };
  script.onerror = () => notice('Verification could not load. Please use the email link.');
  document.head.append(script);
  form.addEventListener('submit', async event => {
    event.preventDefault();
    if (sending || !token || !form.reportValidity()) return;
    const fields = new FormData(form);
    sending = true;
    button.disabled = true;
    notice('Sending your message…');
    try {
      const response = await fetch('https://portfolio-contact.dx8tsbf5gq.workers.dev/api/contact', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: fields.get('name'), email: fields.get('email'), message: fields.get('message'), token }),
        signal: AbortSignal.timeout(30000)
      });
      const result = await response.json() as { message?: string };
      notice(result.message || 'Could not confirm delivery. Please use the email link.');
      if (response.ok) form.reset();
    } catch { notice('Could not confirm delivery. Your message is still here; please use the email link.'); }
    finally { sending = false; token = ''; button.disabled = true; api()?.reset(widget); }
  });
}
export {};
