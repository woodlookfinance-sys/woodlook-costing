/* WOODLOOK — db.js
   Local IndexedDB cache. This is what makes the app fast and usable with
   1000+ products: the UI always reads/writes this local cache instantly,
   while a background queue pushes changes to the Google Sheet and pulls
   fresh data down. The Sheet is the source of truth; IndexedDB is the
   fast local mirror + offline buffer. */

const LocalDB = (() => {
  const DB_NAME = 'woodlook-costing';
  const DB_VERSION = 1;
  const TABLES = ['Materials', 'Products', 'BOM', 'Wood', 'MDF', 'Paint', 'Polish', 'Labour'];
  let dbPromise = null;

  function open() {
    if (dbPromise) return dbPromise;
    dbPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        TABLES.forEach((t) => {
          if (!db.objectStoreNames.contains(t)) db.createObjectStore(t, { keyPath: 'id' });
        });
        if (!db.objectStoreNames.contains('meta')) db.createObjectStore('meta', { keyPath: 'key' });
        if (!db.objectStoreNames.contains('queue')) {
          db.createObjectStore('queue', { keyPath: 'qid', autoIncrement: true });
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    return dbPromise;
  }

  async function tx(storeName, mode = 'readonly') {
    const db = await open();
    return db.transaction(storeName, mode).objectStore(storeName);
  }

  function reqToPromise(req) {
    return new Promise((resolve, reject) => {
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }

  async function getAll(table) {
    const store = await tx(table);
    return reqToPromise(store.getAll());
  }

  async function put(table, row) {
    const store = await tx(table, 'readwrite');
    return reqToPromise(store.put(row));
  }

  async function putMany(table, rows) {
    const db = await open();
    return new Promise((resolve, reject) => {
      const t = db.transaction(table, 'readwrite');
      const store = t.objectStore(table);
      rows.forEach((r) => store.put(r));
      t.oncomplete = () => resolve();
      t.onerror = () => reject(t.error);
    });
  }

  async function remove(table, id) {
    const store = await tx(table, 'readwrite');
    return reqToPromise(store.delete(id));
  }

  async function clearTable(table) {
    const store = await tx(table, 'readwrite');
    return reqToPromise(store.clear());
  }

  async function setMeta(key, value) {
    const store = await tx('meta', 'readwrite');
    return reqToPromise(store.put({ key, value }));
  }

  async function getMeta(key) {
    const store = await tx('meta');
    const r = await reqToPromise(store.get(key));
    return r ? r.value : undefined;
  }

  async function enqueue(item) {
    const store = await tx('queue', 'readwrite');
    return reqToPromise(store.add(item));
  }

  async function getQueue() {
    const store = await tx('queue');
    return reqToPromise(store.getAll());
  }

  async function dequeue(qid) {
    const store = await tx('queue', 'readwrite');
    return reqToPromise(store.delete(qid));
  }

  async function replaceAll(dataBySheet) {
    for (const table of TABLES) {
      await clearTable(table);
      const rows = dataBySheet[table] || [];
      if (rows.length) await putMany(table, rows);
    }
  }

  return { TABLES, getAll, put, putMany, remove, clearTable, setMeta, getMeta, enqueue, getQueue, dequeue, replaceAll };
})();
