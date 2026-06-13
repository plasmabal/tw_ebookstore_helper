window.TEH = window.TEH || {};

window.TEH.state = {
  cachedLists: {
    black: { publisher: [], author: [] },
    white: { publisher: [], author: [] },
    wishlistRemarks: {},
    wishlistTags: {},
    wishlistTagPool: [],
    wishlistTagTemplates: []
  },
  activeTagFilters: new Set(),
  wishlistCleanupDone: false,
  wishlistEmptyMsg: null
};

(function() {
  // 用於 cache 更新與 onChanged 監聽（不含 content script 不需處理的 key）
  const SYNC_KEYS = [
    'publisherBlacklist', 'authorBlacklist',
    'publisherWhitelist', 'authorWhitelist',
    'wishlistRemarks', 'wishlistTags', 'wishlistTagTemplates'
  ];

  // 用於 local→sync 遷移——須涵蓋 management.js migrateKeys 的完整聯集。
  // ⚠️ 若 management.js 的 migrateKeys 有異動，此處須同步更新。
  const MIGRATE_KEYS = [
    ...SYNC_KEYS,
    'schemaVersion', 'readmooAutoClosePreviewDialog'
  ];

  const state = window.TEH.state;
  const cachedLists = state.cachedLists;

  function rebuildTagPool(tagsMap) {
    const pool = new Set();
    Object.values(tagsMap).forEach(tags => (tags || []).forEach(t => pool.add(t)));
    cachedLists.wishlistTagPool = [...pool].sort((a, b) => a.localeCompare(b, 'zh-TW'));
    state.activeTagFilters.forEach(tag => {
      if (!cachedLists.wishlistTagPool.includes(tag)) state.activeTagFilters.delete(tag);
    });
  }

  function updateCache(res) {
    const getNames = (list) => (list || []).map(item => item.name.trim());
    if ('publisherBlacklist' in res) cachedLists.black.publisher = getNames(res.publisherBlacklist);
    if ('authorBlacklist'    in res) cachedLists.black.author    = getNames(res.authorBlacklist);
    if ('publisherWhitelist' in res) cachedLists.white.publisher = getNames(res.publisherWhitelist);
    if ('authorWhitelist'    in res) cachedLists.white.author    = getNames(res.authorWhitelist);
    if ('wishlistRemarks'    in res) cachedLists.wishlistRemarks = res.wishlistRemarks || {};
    if ('wishlistTags' in res) {
      cachedLists.wishlistTags = res.wishlistTags || {};
      rebuildTagPool(cachedLists.wishlistTags);
    }
    if ('wishlistTagTemplates' in res) {
      cachedLists.wishlistTagTemplates = (res.wishlistTagTemplates || []).slice();
    }
  }

  function saveWishlistData(bookId, note, tags, callback, preserveOrphanTags = false) {
    if (!chrome.runtime?.id) return;

    chrome.storage.sync.get(['wishlistRemarks', 'wishlistTags', 'wishlistTagTemplates'], (res) => {
      if (chrome.runtime?.lastError) return;
      const remarks = { ...res.wishlistRemarks || {} };
      const allTags = { ...res.wishlistTags    || {} };

      const trimmedNote = note ? note.trim() : '';
      if (trimmedNote) remarks[bookId] = trimmedNote;
      else delete remarks[bookId];

      const oldTagsForBook = allTags[bookId] || [];
      const cleanTags = (tags || []).filter(t => t.trim());
      if (cleanTags.length) allTags[bookId] = cleanTags;
      else delete allTags[bookId];

      cachedLists.wishlistRemarks = remarks;
      cachedLists.wishlistTags    = allTags;
      rebuildTagPool(allTags);

      let templates = [...(res.wishlistTagTemplates || [])];
      let templatesChanged = false;

      if (cleanTags.length > 0) {
        const before = templates.length;
        templates = templates.filter(t => !cleanTags.includes(t));
        if (templates.length !== before) templatesChanged = true;
      }

      if (preserveOrphanTags && oldTagsForBook.length > 0) {
        const result = TEH_promoteOrphanTags(oldTagsForBook, allTags, templates);
        if (result.changed) { templates = result.templates; templatesChanged = true; }
      }

      if (templatesChanged) cachedLists.wishlistTagTemplates = templates;

      const updates = { wishlistRemarks: remarks, wishlistTags: allTags };
      if (templatesChanged) updates.wishlistTagTemplates = templates;
      chrome.storage.sync.set(updates, callback);
    });
  }

  function initStorage(run) {
    if (!chrome.runtime?.id) return;

    chrome.storage.sync.get(SYNC_KEYS, (res) => {
      if (chrome.runtime.lastError) return;
      if (SYNC_KEYS.some(k => res[k] !== undefined)) {
        updateCache(res);
        run(true);
        return;
      }
      // Sync is empty — migrate from local if available (first run after update).
      // Set localToSyncMigrated so management.js's migrateLocalToSync() skips the duplicate.
      chrome.storage.local.get(MIGRATE_KEYS, (localRes) => {
        if (chrome.runtime.lastError) return;
        const data = {};
        MIGRATE_KEYS.forEach(k => { if (localRes[k] !== undefined) data[k] = localRes[k]; });
        if (Object.keys(data).length) {
          chrome.storage.sync.set(data);
          chrome.storage.local.set({ localToSyncMigrated: true });
        }
        updateCache(localRes);
        run(true);
      });
    });

    chrome.storage.onChanged.addListener((changes, namespace) => {
      if (namespace !== 'sync') return;
      const res = {};
      let hasChanges = false;
      SYNC_KEYS.forEach(key => {
        if (changes[key]) { res[key] = changes[key].newValue; hasChanges = true; }
      });
      if (hasChanges) { updateCache(res); run(true); }
    });
  }

  window.TEH.storage = { initStorage, saveWishlistData, updateCache };
})();
