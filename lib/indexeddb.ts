/**
 * IndexedDB helper for Dainiki client-side local caching of encrypted entries.
 * Safe for Server-Side Rendering (SSR) environments.
 */

const DB_NAME = "dainiki_local_vault";
const STORE_NAME = "encrypted_entries";
const DB_VERSION = 1;

function getIDB(): IDBFactory | null {
  if (typeof window === "undefined") return null;
  return window.indexedDB || (window as any).mozIndexedDB || (window as any).webkitIndexedDB || (window as any).msIndexedDB;
}

export function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const idb = getIDB();
    if (!idb) {
      reject(new Error("IndexedDB is not supported in this environment."));
      return;
    }

    const request = idb.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event: any) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: "id" });
      }
    };

    request.onsuccess = (event: any) => {
      resolve(event.target.result);
    };

    request.onerror = (event: any) => {
      reject(event.target.error);
    };
  });
}

/**
 * Retrieves all locally cached encrypted entries.
 */
export async function getLocalEntries(): Promise<any[]> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, "readonly");
      const store = transaction.objectStore(STORE_NAME);
      const request = store.getAll();

      request.onsuccess = () => {
        resolve(request.result || []);
      };

      request.onerror = () => {
        reject(request.error);
      };
    });
  } catch (err) {
    console.error("[IndexedDB getLocalEntries Error]:", err);
    return [];
  }
}

/**
 * Saves a list of encrypted entries to the local database.
 */
export async function saveLocalEntries(entries: any[]): Promise<void> {
  if (entries.length === 0) return;
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, "readwrite");
      const store = transaction.objectStore(STORE_NAME);

      entries.forEach((entry) => {
        // Enforce numeric ID format
        const cleanEntry = { ...entry, id: Number(entry.id) };
        store.put(cleanEntry);
      });

      transaction.oncomplete = () => {
        resolve();
      };

      transaction.onerror = () => {
        reject(transaction.error);
      };
    });
  } catch (err) {
    console.error("[IndexedDB saveLocalEntries Error]:", err);
  }
}

/**
 * Deletes a specific entry from the local database.
 */
export async function deleteLocalEntry(id: number): Promise<void> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, "readwrite");
      const store = transaction.objectStore(STORE_NAME);
      const request = store.delete(Number(id));

      request.onsuccess = () => {
        resolve();
      };

      request.onerror = () => {
        reject(request.error);
      };
    });
  } catch (err) {
    console.error("[IndexedDB deleteLocalEntry Error]:", err);
  }
}

/**
 * Clears the local database cache entirely.
 */
export async function clearLocalDb(): Promise<void> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, "readwrite");
      const store = transaction.objectStore(STORE_NAME);
      const request = store.clear();

      request.onsuccess = () => {
        resolve();
      };

      request.onerror = () => {
        reject(request.error);
      };
    });
  } catch (err) {
    console.error("[IndexedDB clearLocalDb Error]:", err);
  }
}
