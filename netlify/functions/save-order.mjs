/**
 * Forwards order JSON to Google Apps Script Web App with redirect: 'manual',
 * then repeats POST to the Location URL. Browsers often fail this chain; Node does not.
 *
 * Netlify → Site settings → Environment variables:
 *   APPS_SCRIPT_WEBAPP_URL = https://script.google.com/macros/s/.../exec
 */

const MAX_REDIRECTS = 5;

async function postOrderFollowingRedirects(url, jsonBody) {
  let current = url;
  const body = JSON.stringify(jsonBody);
  for (let i = 0; i < MAX_REDIRECTS; i++) {
    const res = await fetch(current, {
      method: 'POST',
      redirect: 'manual',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body
    });
    if ([301, 302, 303, 307, 308].includes(res.status)) {
      const loc = res.headers.get('location');
      if (loc) {
        current = loc;
        continue;
      }
    }
    const text = await res.text();
    return { status: res.status, text };
  }
  return { status: 500, text: JSON.stringify({ ok: false, error: 'Too many redirects' }) };
}

export const handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: corsHeaders(), body: '' };
  }
  if (event.httpMethod !== 'POST') {
    return json(405, { ok: false, error: 'Method not allowed' });
  }

  const target = process.env.APPS_SCRIPT_WEBAPP_URL;
  if (!target || !target.includes('script.google.com')) {
    return json(500, {
      ok: false,
      error: 'Missing or invalid APPS_SCRIPT_WEBAPP_URL. Add it under Site settings → Environment variables.'
    });
  }

  let order;
  try {
    order = JSON.parse(event.body || '{}');
  } catch {
    return json(400, { ok: false, error: 'Invalid JSON body' });
  }

  try {
    const { status, text } = await postOrderFollowingRedirects(target, order);
    const ok = status >= 200 && status < 300;
    return {
      statusCode: ok ? 200 : status,
      headers: { ...corsHeaders(), 'Content-Type': 'application/json; charset=utf-8' },
      body: text || JSON.stringify({ ok: false, error: 'Empty response from Apps Script' })
    };
  } catch (e) {
    return json(502, { ok: false, error: String(e && e.message ? e.message : e) });
  }
};

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS'
  };
}

function json(status, obj) {
  return {
    statusCode: status,
    headers: { ...corsHeaders(), 'Content-Type': 'application/json; charset=utf-8' },
    body: JSON.stringify(obj)
  };
}
