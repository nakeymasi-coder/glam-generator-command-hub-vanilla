(function () {
  "use strict";

  if (!window.indexedDB || !window.Storage) return;

  const LEGACY_DB = "glam_generator_hub_db";
  const OWNER_KEY = "glam_workspace_owner";
  const WORKSPACE_KEY = "glam_command_hub_preview";
  const STORE = "generatorFolders";
  const originalOpen = window.indexedDB.open.bind(window.indexedDB);

  function currentOwnerId() {
    return String(localStorage.getItem(OWNER_KEY) || "").trim();
  }

  function scopedDbName() {
    const ownerId = currentOwnerId();
    return ownerId ? `${LEGACY_DB}_${ownerId}` : `${LEGACY_DB}_signed_out`;
  }

  // Every Generator Vault IndexedDB call made by script.js is transparently
  // routed to a database that belongs only to the currently signed-in user.
  window.indexedDB.open = function (name, version) {
    const nextName = name === LEGACY_DB ? scopedDbName() : name;
    return version === undefined
      ? originalOpen(nextName)
      : originalOpen(nextName, version);
  };

  function referencedLegacyFolderIds() {
    try {
      const workspace = JSON.parse(localStorage.getItem(WORKSPACE_KEY) || "{}");
      const generators = Array.isArray(workspace.generators)
        ? workspace.generators
        : [];
      return new Set(
        generators
          .filter((item) => item && item.sourceType === "folder" && item.folderId)
          .map((item) => String(item.folderId)),
      );
    } catch (_error) {
      return new Set();
    }
  }

  function openDb(name) {
    return new Promise((resolve, reject) => {
      const request = originalOpen(name, 1);
      request.onupgradeneeded = (event) => {
        const db = event.target.result;
        if (!db.objectStoreNames.contains(STORE)) {
          db.createObjectStore(STORE, { keyPath: "id" });
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  function getAll(db) {
    return new Promise((resolve, reject) => {
      if (!db.objectStoreNames.contains(STORE)) return resolve([]);
      const tx = db.transaction(STORE, "readonly");
      const request = tx.objectStore(STORE).getAll();
      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error);
    });
  }

  function putMany(db, records, ownerId) {
    return new Promise((resolve, reject) => {
      if (!records.length) return resolve();
      const tx = db.transaction(STORE, "readwrite");
      const store = tx.objectStore(STORE);
      records.forEach((record) => {
        store.put(Object.assign({}, record, { owner_id: ownerId }));
      });
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
  }

  async function migrateCurrentUsersLegacyFolders() {
    const ownerId = currentOwnerId();
    if (!ownerId) return;

    const referencedIds = referencedLegacyFolderIds();
    if (!referencedIds.size) return;

    const migrationKey = `glam_folder_migration_${ownerId}`;
    if (localStorage.getItem(migrationKey) === "done") return;

    let legacyDb;
    let userDb;

    try {
      legacyDb = await openDb(LEGACY_DB);
      const legacyRecords = await getAll(legacyDb);
      const ownedRecords = legacyRecords.filter((record) =>
        referencedIds.has(String(record && record.id)),
      );

      userDb = await openDb(scopedDbName());
      await putMany(userDb, ownedRecords, ownerId);
      localStorage.setItem(migrationKey, "done");
    } catch (error) {
      console.error("Unable to migrate legacy Generator Vault folders:", error);
    } finally {
      try {
        legacyDb && legacyDb.close();
      } catch (_error) {}
      try {
        userDb && userDb.close();
      } catch (_error) {}
    }
  }

  // On an existing signed-in session the owner is already known during page
  // startup. After a fresh sign-in workspace-bootstrap reloads the page, so
  // this runs again with the new account owner and its private metadata.
  setTimeout(migrateCurrentUsersLegacyFolders, 0);
  window.addEventListener("load", () => {
    setTimeout(migrateCurrentUsersLegacyFolders, 250);
  });
})();
