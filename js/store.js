/* WOODLOOK — store.js
   Central reactive-ish state. The UI reads from Store.state (plain arrays,
   always in memory — trivially fast even at 1000+ products) and calls
   Store.upsertRow / Store.deleteRow to make changes. Every change is:
     1) applied to Store.state immediately (instant UI feedback)
     2) written to IndexedDB (survives refresh / works offline)
     3) pushed to the Google Sheet in the background (queued + retried
        if offline or the request fails)
*/

const Store = (() => {
  const TABLES = LocalDB.TABLES;
  const state = {};
  TABLES.forEach((t) => (state[t] = []));

  const listeners = new Set();
  function subscribe(fn) {
    listeners.add(fn);
    return () => listeners.delete(fn);
  }
  function notify(topic) {
    listeners.forEach((fn) => fn(topic));
  }

  let syncStatus = 'offline'; // 'offline' | 'syncing' | 'synced' | 'error' | 'not-configured'
  function setSyncStatus(s) {
    syncStatus = s;
    notify('sync');
  }
  function getSyncStatus() {
    return syncStatus;
  }

  // ---------------- indices ----------------
  function indexById(table) {
    const map = new Map();
    state[table].forEach((r) => map.set(String(r.id), r));
    return map;
  }

  function rowsForProduct(table, productId) {
    return state[table].filter((r) => String(r.productId) === String(productId));
  }

  // ---------------- load ----------------
  async function loadFromLocal() {
    for (const t of TABLES) {
      state[t] = await LocalDB.getAll(t);
    }
    notify('load');
  }

  async function pullFromSheet() {
    if (!SheetsAPI.isConfigured()) {
      setSyncStatus('not-configured');
      return false;
    }
    setSyncStatus('syncing');
    try {
      const data = await SheetsAPI.getAll();
      TABLES.forEach((t) => {
        state[t] = (data[t] || []).map(coerceRow);
      });
      await LocalDB.replaceAll(state);
      await LocalDB.setMeta('lastSync', new Date().toISOString());
      setSyncStatus('synced');
      notify('load');
      return true;
    } catch (err) {
      console.warn('pullFromSheet failed', err);
      setSyncStatus('error');
      return false;
    }
  }

  function coerceRow(row) {
    const out = { ...row };
    ['rate', 'quantity', 'retailMargin', 'wholesaleMargin', 'length', 'width', 'breadth',
      'qtyMultiplier', 'wastePct', 'qty', 'slot'].forEach((k) => {
      if (out[k] !== undefined && out[k] !== '') out[k] = Number(out[k]);
    });
    return out;
  }

  // ---------------- queue / background sync ----------------
  // Enqueue-first, durable-write pattern: the change is saved into the local
  // retry queue BEFORE we ever attempt the network call. This is what makes
  // closing the tab/browser safe — even if the network request is killed
  // mid-flight (page closed while awaiting the Apps Script response), the
  // change is already sitting in IndexedDB and will be retried automatically
  // next time the app boots (see flushQueue, called first thing on boot).
  // Previously the queue entry was only created in the *catch* block, so a
  // request interrupted mid-flight (neither resolved nor rejected yet) was
  // lost permanently — that was the cause of data disappearing on close.
  let pendingSyncCount = 0;
  function hasPendingSync() {
    return pendingSyncCount > 0;
  }
  async function initPendingSync() {
    const queue = await LocalDB.getQueue();
    pendingSyncCount = queue.length;
  }

  async function pushChange(sheet, action, payload) {
    if (!SheetsAPI.isConfigured()) return; // stays local-only until a Sheet URL is set
    const qid = await LocalDB.enqueue({ sheet, action, payload, ts: Date.now() });
    pendingSyncCount++;
    setSyncStatus('syncing');
    try {
      if (action === 'upsert') await SheetsAPI.upsert(sheet, payload);
      else if (action === 'delete') await SheetsAPI.remove(sheet, payload);
      await LocalDB.dequeue(qid);
      pendingSyncCount = Math.max(0, pendingSyncCount - 1);
      setSyncStatus(pendingSyncCount > 0 ? 'syncing' : 'synced');
    } catch (err) {
      console.warn('Queued for later sync (will retry):', sheet, action, err.message);
      setSyncStatus('error');
      // stays queued in IndexedDB; flushQueue() retries it on next boot,
      // when back online, or every 30s below.
    }
  }

  async function flushQueue() {
    if (!SheetsAPI.isConfigured()) return;
    const queue = await LocalDB.getQueue();
    if (!queue.length) return;
    setSyncStatus('syncing');
    for (const item of queue) {
      try {
        if (item.action === 'upsert') await SheetsAPI.upsert(item.sheet, item.payload);
        else if (item.action === 'delete') await SheetsAPI.remove(item.sheet, item.payload);
        await LocalDB.dequeue(item.qid);
        pendingSyncCount = Math.max(0, pendingSyncCount - 1);
      } catch (err) {
        console.warn('Flush failed, will retry later', err);
        setSyncStatus('error');
        return; // stop; keep remaining items queued, try again next time
      }
    }
    setSyncStatus('synced');
  }

  window.addEventListener('online', flushQueue);
  setInterval(flushQueue, 30000);

  // ---------------- generic row CRUD ----------------
  function upsertRow(table, row) {
    if (!row.id) row.id = Utils.uuid();
    row.updatedAt = new Date().toISOString();
    const idx = state[table].findIndex((r) => String(r.id) === String(row.id));
    if (idx === -1) state[table].push(row);
    else state[table][idx] = { ...state[table][idx], ...row };
    LocalDB.put(table, row);
    pushChange(table, 'upsert', row);
    notify(table);
    return row;
  }

  function deleteRow(table, id) {
    state[table] = state[table].filter((r) => String(r.id) !== String(id));
    LocalDB.remove(table, id);
    pushChange(table, 'delete', id);
    notify(table);
  }

  function deleteProductCascade(productId) {
    ['BOM', 'Wood', 'MDF', 'Paint', 'Polish', 'Labour'].forEach((t) => {
      rowsForProduct(t, productId).forEach((r) => deleteRow(t, r.id));
    });
    deleteRow('Products', productId);
  }

  return {
    TABLES,
    state,
    subscribe,
    notify,
    loadFromLocal,
    pullFromSheet,
    flushQueue,
    initPendingSync,
    hasPendingSync,
    upsertRow,
    deleteRow,
    deleteProductCascade,
    rowsForProduct,
    indexById,
    getSyncStatus,
    setSyncStatus,
  };
})();
