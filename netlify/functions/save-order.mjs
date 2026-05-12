/**
 * Forwards order JSON to Google Apps Script Web App.
 *
 * Google returns 302 → script.googleusercontent.com/macros/echo?...
 * doPost has usually ALREADY RUN before that redirect. A second POST to the echo
 * URL returns 405 + HTML error page — do not follow with POST.
 *
 * Netlify → Site settings → Environment variables:
 *   APPS_SCRIPT_WEBAPP_URL = https://script.google.com/macros/s/.../exec
 */

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
    const { statusCode, body } = await postOnceToAppsScript(target, order);
    return {
      statusCode,
      headers: { ...corsHeaders(), 'Content-Type': 'application/json; charset=utf-8' },
      body
    };
  } catch (e) {
    return json(502, { ok: false, error: String(e && e.message ? e.message : e) });
  }
};

/**
 * Single POST to /exec. If we get a redirect to googleusercontent echo, treat as
 * success — Apps Script executes doPost before sending that redirect.
 */
async function postOnceToAppsScript(url, jsonBody) {
  const body = JSON.stringify(jsonBody);
  const res = await fetch(url, {
    method: 'POST',
    redirect: 'manual',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body
  });

  const loc = res.headers.get('location') || '';

  if ([301, 302, 303, 307, 308].includes(res.status) && loc) {
    await res.text().catch(() => ''); // drain response body

    if (/script\.googleusercontent\.com/i.test(loc) || /\/macros\/echo/i.test(loc)) {
      return {
        statusCode: 200,
        body: JSON.stringify({
          ok: true,
          note: 'Web app returned redirect; order is usually saved. Check the Orders sheet.'
        })
      };
    }

    // Unusual redirect — try one follow-up POST (unlikely path)
    const res2 = await fetch(loc, {
      method: 'POST',
      redirect: 'manual',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body
    });
    const text2 = await res2.text();
    const ok2 = res2.status >= 200 && res2.status < 300;
    return {
      statusCode: ok2 ? 200 : res2.status,
      body: ok2 && text2 ? text2 : JSON.stringify({ ok: false, error: 'Upstream error', status: res2.status, snippet: text2.slice(0, 200) })
    };
  }

  const text = await res.text();
  if (res.status >= 200 && res.status < 300) {
    try {
      JSON.parse(text);
      return { statusCode: 200, body: text };
    } catch {
      return {
        statusCode: 200,
        body: JSON.stringify({ ok: true, raw: text.slice(0, 200) })
      };
    }
  }

  return {
    statusCode: res.status,
    body: text || JSON.stringify({ ok: false, error: 'Apps Script returned non-success status', status: res.status })
  };
}

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
