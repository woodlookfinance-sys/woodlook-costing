/* WOODLOOK — api.js
   Talks to the Google Apps Script Web App that reads/writes the Google Sheet.
   All calls degrade gracefully: if there's no URL configured yet, or the
   network fails, changes queue in IndexedDB and sync later. */

const SheetsAPI = (() => {
  const URL_KEY = 'woodlook.apiUrl';

  function getUrl() {
    return localStorage.getItem(URL_KEY) || '';
  }

  function setUrl(url) {
    localStorage.setItem(URL_KEY, (url || '').trim());
  }

  function isConfigured() {
    return !!getUrl();
  }

  async function getAll() {
    const url = getUrl();
    if (!url) throw new Error('NO_URL');
    const res = await fetch(`${url}?action=getAll`, { method: 'GET' });
    if (!res.ok) throw new Error('HTTP_' + res.status);
    const json = await res.json();
    if (!json.ok) throw new Error(json.error || 'API_ERROR');
    return json.data;
  }

  async function ping(url) {
    const target = url || getUrl();
    if (!target) throw new Error('NO_URL');
    const res = await fetch(`${target}?action=ping`);
    const json = await res.json();
    return !!json.ok;
  }

  // Apps Script web apps (deployed as "Anyone") work fine with a simple
  // no-cors-safe POST of text/plain containing JSON — this avoids CORS
  // preflight issues that a strict 'application/json' content-type triggers.
  async function post(body) {
    const url = getUrl();
    if (!url) throw new Error('NO_URL');
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(body),
      // keepalive lets the browser finish sending this request even if the
      // tab/page is being closed right now — without it, a save started a
      // split-second before closing the tab is simply killed mid-flight.
      keepalive: true,
    });
    if (!res.ok) throw new Error('HTTP_' + res.status);
    const json = await res.json();
    if (!json.ok) throw new Error(json.error || 'API_ERROR');
    return json;
  }

  function upsert(sheet, row) {
    return post({ action: 'upsert', sheet, row });
  }

  function bulkUpsert(sheet, rows) {
    return post({ action: 'bulkUpsert', sheet, rows });
  }

  function remove(sheet, id) {
    return post({ action: 'delete', sheet, id });
  }

  return { getUrl, setUrl, isConfigured, getAll, ping, upsert, bulkUpsert, remove };
})();
