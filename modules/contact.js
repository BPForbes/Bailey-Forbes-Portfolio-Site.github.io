import { icon } from "./icons.js";
const form = document.querySelector("#contact-form");
const status = document.querySelector("#contact-status");
const api = () => window.turnstile;
const TONE_ICON = {
  wait: "circle-notch",
  ok: "circle-check",
  error: "circle-exclamation"
};
if (form && status) {
  const button = form.querySelector('button[type="submit"]');
  const container = form.querySelector("[data-turnstile]");
  let token = "";
  let sending = false;
  let widget = "";
  const notice = (text, tone) => {
    status.innerHTML = tone === void 0 ? text : `${icon(TONE_ICON[tone])}<span>${text}</span>`;
    if (tone === void 0) {
      delete status.dataset.tone;
    } else {
      status.dataset.tone = tone;
    }
  };
  const script = document.createElement("script");
  script.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
  script.async = true;
  script.onload = () => {
    widget = api().render(container, {
      sitekey: "0x4AAAAAAE5IcjrbA8vViJbC",
      action: "contact",
      size: "flexible",
      theme: "auto",
      callback: (value) => {
        token = value;
        button.disabled = sending;
        if (status.textContent === "Loading verification\u2026") notice("Ready to send.");
      },
      "expired-callback": () => {
        token = "";
        button.disabled = true;
        notice("Verification expired. Please verify again.", "error");
      },
      "error-callback": () => {
        token = "";
        button.disabled = true;
        notice("Verification unavailable. Please use the email link.", "error");
      }
    });
  };
  script.onerror = () => notice("Verification could not load. Please use the email link.", "error");
  document.head.append(script);
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (sending || !token || !form.reportValidity()) return;
    const fields = new FormData(form);
    sending = true;
    button.disabled = true;
    notice("Sending your message\u2026", "wait");
    try {
      const response = await fetch("https://portfolio-contact.dx8tsbf5gq.workers.dev/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: fields.get("name"), email: fields.get("email"), message: fields.get("message"), token }),
        signal: AbortSignal.timeout(3e4)
      });
      const result = await response.json();
      notice(result.message || "Could not confirm delivery. Please use the email link.", response.ok ? "ok" : "error");
      if (response.ok) form.reset();
    } catch {
      notice("Could not confirm delivery. Your message is still here; please use the email link.", "error");
    } finally {
      sending = false;
      token = "";
      button.disabled = true;
      api()?.reset(widget);
    }
  });
}
