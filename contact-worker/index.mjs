const origins = new Set(['https://bailey-forbes.com', 'https://www.bailey-forbes.com']);
const hostnames = new Set(['bailey-forbes.com', 'www.bailey-forbes.com']);
const maxBytes = 16384;

export default {
  async fetch(request, env) {
    const origin = request.headers.get('Origin');
    const headers = { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', Vary: 'Origin' };
    const reply = (status, message) => new Response(JSON.stringify({ message }), { status, headers });
    if (new URL(request.url).pathname !== '/api/contact') return reply(404, 'Not found.');
    if (!origins.has(origin)) return reply(403, 'Origin not allowed.');
    headers['Access-Control-Allow-Origin'] = origin;
    if (request.method === 'OPTIONS') {
      headers['Access-Control-Allow-Methods'] = 'POST';
      headers['Access-Control-Allow-Headers'] = 'Content-Type';
      return new Response(null, { status: 204, headers });
    }
    if (request.method !== 'POST') return reply(405, 'Use POST.');
    if (request.headers.get('Content-Type')?.split(';')[0]?.trim() !== 'application/json') return reply(415, 'Send JSON.');
    if (!env.TURNSTILE_SECRET || !env.RESEND_API_KEY || !env.CONTACT_FROM || !env.CONTACT_TO) return reply(503, 'Contact form unavailable. Please use the email link.');
    if (Number(request.headers.get('Content-Length')) > maxBytes) return reply(413, 'Message too large.');
    let data;
    try {
      const reader = request.body?.getReader();
      if (!reader) return reply(400, 'Message required.');
      const chunks = [];
      let size = 0;
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        size += value.byteLength;
        if (size > maxBytes) { await reader.cancel(); return reply(413, 'Message too large.'); }
        chunks.push(value);
      }
      const bytes = new Uint8Array(size);
      let offset = 0;
      for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
      data = JSON.parse(new TextDecoder().decode(bytes));
    } catch { return reply(400, 'Invalid message.'); }
    if (!data || typeof data !== 'object' || Array.isArray(data)) return reply(400, 'Invalid message.');
    const { name, email, message, token } = data;
    if (typeof name !== 'string' || !name.trim() || name.length > 100 || /[\r\n]/.test(name) ||
        typeof email !== 'string' || email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
        typeof message !== 'string' || !message.trim() || message.length > 5000 ||
        typeof token !== 'string' || !token || token.length > 2048) return reply(400, 'Check your name, email, message, and verification.');
    try {
      const verify = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ secret: env.TURNSTILE_SECRET, response: token }),
        signal: AbortSignal.timeout(10000)
      });
      if (!verify.ok) return reply(503, 'Verification unavailable. Please try again.');
      const result = await verify.json();
      if (result.success !== true || !hostnames.has(result.hostname) || result.action !== 'contact') return reply(400, 'Verification expired or failed. Please try again.');
      const sent = await fetch('https://api.resend.com/emails', {
        method: 'POST', headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ from: env.CONTACT_FROM, to: [env.CONTACT_TO], reply_to: email,
          subject: 'Portfolio contact message', text: `From: ${name.trim()} <${email}>\n\n${message.trim()}` }),
        signal: AbortSignal.timeout(15000)
      });
      if (!sent.ok) return reply(502, 'Email service unavailable. Please use the email link.');
      const receipt = await sent.json();
      if (!receipt.id) return reply(502, 'Email service unavailable. Please use the email link.');
      return reply(200, 'Your message was accepted for delivery. Thank you.');
    } catch { return reply(503, 'Could not confirm delivery. Please use the email link.'); }
  }
};
