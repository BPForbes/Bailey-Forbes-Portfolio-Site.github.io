import { icon } from './icons.js';

const form = document.querySelector<HTMLFormElement>('#contact-form');
const status = document.querySelector<HTMLElement>('#contact-status');
type Turnstile = { render: (element: HTMLElement, options: Record<string, unknown>) => string; reset: (id: string) => void };
const api = () => (window as Window & { turnstile?: Turnstile }).turnstile;

type Tone = 'wait' | 'ok' | 'error';
const TONE_ICON: Record<Tone, Parameters<typeof icon>[0]> = {
  wait: 'circle-notch',
  ok: 'circle-check',
  error: 'circle-exclamation',
};

if (form && status) {
  const button = form.querySelector<HTMLButtonElement>('button[type="submit"]')!;
  const container = form.querySelector<HTMLElement>('[data-turnstile]')!;
  let token = '';
  let sending = false;
  let widget = '';
  /*
   * Peak-End Rule: this line is the last thing a visitor sees for the task
   * the page most wants completed, so "sent", "failed" and "still working"
   * need to look different from each other, not just read different. `tone`
   * drives colour and an icon; the text alone still carries the meaning
   * (R25) for anyone who cannot see either. No tone is the quiet, un-urgent
   * default — loading and "ready to send" are not outcomes worth a colour.
   */
  const notice = (text: string, tone?: Tone) => {
    status.innerHTML = tone === undefined ? text : `${icon(TONE_ICON[tone])}<span>${text}</span>`;
    if (tone === undefined) {
      delete status.dataset.tone;
    } else {
      status.dataset.tone = tone;
    }
  };
  const script = document.createElement('script');
  script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
  script.async = true;
  script.onload = () => {
    widget = api()!.render(container, {
      sitekey: '0x4AAAAAAE5IcjrbA8vViJbC', action: 'contact', size: 'flexible', theme: 'auto',
      callback: (value: string) => { token = value; button.disabled = sending; if (status.textContent === 'Loading verification…') notice('Ready to send.'); },
      'expired-callback': () => { token = ''; button.disabled = true; notice('Verification expired. Please verify again.', 'error'); },
      'error-callback': () => { token = ''; button.disabled = true; notice('Verification unavailable. Please use the email link.', 'error'); }
    });
  };
  script.onerror = () => notice('Verification could not load. Please use the email link.', 'error');
  document.head.append(script);
  form.addEventListener('submit', async event => {
    event.preventDefault();
    if (sending || !token || !form.reportValidity()) return;
    const fields = new FormData(form);
    sending = true;
    button.disabled = true;
    notice('Sending your message…', 'wait');
    try {
      const response = await fetch('https://portfolio-contact.dx8tsbf5gq.workers.dev/api/contact', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: fields.get('name'), email: fields.get('email'), message: fields.get('message'), token }),
        signal: AbortSignal.timeout(30000)
      });
      const result = await response.json() as { message?: string };
      notice(result.message || 'Could not confirm delivery. Please use the email link.', response.ok ? 'ok' : 'error');
      if (response.ok) form.reset();
    } catch { notice('Could not confirm delivery. Your message is still here; please use the email link.', 'error'); }
    finally { sending = false; token = ''; button.disabled = true; api()?.reset(widget); }
  });
}
export {};
