/* 知忆 · 本地数据层（IndexedDB） */
(function (Z) {
  const DB_NAME = 'zhiyi-db';
  const VERSION = 1;

  let dbPromise = null;
  let memory = null;

  function open() {
    if (dbPromise) return dbPromise;
    dbPromise = new Promise((resolve, reject) => {
      if (!('indexedDB' in window)) {
        memory = { docs: new Map(), blobs: new Map() };
        resolve(null);
        return;
      }
      const req = indexedDB.open(DB_NAME, VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains('docs')) db.createObjectStore('docs', { keyPath: 'id' });
        if (!db.objectStoreNames.contains('blobs')) db.createObjectStore('blobs');
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => {
        memory = { docs: new Map(), blobs: new Map() };
        resolve(null);
      };
    });
    return dbPromise;
  }

  function tx(store, mode, fn) {
    return open().then((db) => {
      if (!db) return fn(memory);
      return new Promise((resolve, reject) => {
        const t = db.transaction(store, mode);
        const s = t.objectStore(store);
        let out;
        try { out = fn(s); } catch (e) { reject(e); return; }
        t.oncomplete = () => resolve(out && out.__req ? out.__req.result : out);
        t.onerror = () => reject(t.error);
        t.onabort = () => reject(t.error);
      });
    });
  }

  Z.DB = {
    async putDoc(doc) {
      doc.updatedAt = Date.now();
      await open();
      if (memory) { memory.docs.set(doc.id, doc); return doc; }
      const db = await open();
      return new Promise((resolve, reject) => {
        const t = db.transaction('docs', 'readwrite');
        t.objectStore('docs').put(doc);
        t.oncomplete = () => resolve(doc);
        t.onerror = () => reject(t.error);
      });
    },

    async getDoc(id) {
      if (memory) return memory.docs.get(id) || null;
      const db = await open();
      return new Promise((resolve, reject) => {
        const r = db.transaction('docs', 'readonly').objectStore('docs').get(id);
        r.onsuccess = () => resolve(r.result || null);
        r.onerror = () => reject(r.error);
      });
    },

    async allDocs() {
      if (memory) return Array.from(memory.docs.values());
      const db = await open();
      return new Promise((resolve, reject) => {
        const r = db.transaction('docs', 'readonly').objectStore('docs').getAll();
        r.onsuccess = () => resolve(r.result || []);
        r.onerror = () => reject(r.error);
      });
    },

    async deleteDoc(doc) {
      if (memory) { memory.docs.delete(doc.id); return; }
      const db = await open();
      return new Promise((resolve, reject) => {
        const t = db.transaction('docs', 'readwrite');
        t.objectStore('docs').delete(doc.id);
        t.oncomplete = () => resolve();
        t.onerror = () => reject(t.error);
      });
    },

    async putBlob(id, blob) {
      if (memory) { memory.blobs.set(id, blob); return; }
      const db = await open();
      return new Promise((resolve, reject) => {
        const t = db.transaction('blobs', 'readwrite');
        t.objectStore('blobs').put(blob, id);
        t.oncomplete = () => resolve();
        t.onerror = () => reject(t.error);
      });
    },

    async getBlob(id) {
      if (!id) return null;
      if (memory) return memory.blobs.get(id) || null;
      const db = await open();
      return new Promise((resolve, reject) => {
        const r = db.transaction('blobs', 'readonly').objectStore('blobs').get(id);
        r.onsuccess = () => resolve(r.result || null);
        r.onerror = () => reject(r.error);
      });
    },

    async deleteBlob(id) {
      if (!id) return;
      if (memory) { memory.blobs.delete(id); return; }
      const db = await open();
      return new Promise((resolve, reject) => {
        const t = db.transaction('blobs', 'readwrite');
        t.objectStore('blobs').delete(id);
        t.oncomplete = () => resolve();
        t.onerror = () => reject(t.error);
      });
    },

    async clear() {
      if (memory) { memory.docs.clear(); memory.blobs.clear(); return; }
      const db = await open();
      return new Promise((resolve, reject) => {
        const t = db.transaction(['docs', 'blobs'], 'readwrite');
        t.objectStore('docs').clear();
        t.objectStore('blobs').clear();
        t.oncomplete = () => resolve();
        t.onerror = () => reject(t.error);
      });
    }
  };
})(window.ZY);
