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
  wishlistCleanupPendingIds: null,
  wishlistEmptyMsg: null
};

(function() {
  // key 清單定義於 teh-constants.js（單一來源）
  const SYNC_KEYS = window.TEH.SYNC_KEYS;
  const MIGRATE_KEYS = window.TEH.MIGRATE_KEYS;

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
    // 防禦：跳過 name 非字串的異常條目，避免單筆壞資料癱瘓整個 content script
    const getNames = (list) => (list || [])
      .filter(item => item && typeof item.name === 'string')
      .map(item => item.name.trim());
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

  function showErrorToast(message) {
    document.querySelector('.teh-toast')?.remove();
    const toast = document.createElement('div');
    toast.className = 'teh-toast';
    toast.textContent = message;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 5000);
  }

  async function saveWishlistData(bookId, note, tags, callback, preserveOrphanTags = false) {
    if (!chrome.runtime?.id) return;

    let res;
    try {
      res = await chrome.storage.sync.get(['wishlistRemarks', 'wishlistTags', 'wishlistTagTemplates']);
    } catch (e) {
      showErrorToast('⚠️ 備註儲存失敗：無法讀取同步儲存空間');
      return;
    }

    const remarks = { ...res.wishlistRemarks || {} };
    const allTags = { ...res.wishlistTags    || {} };

    const trimmedNote = note ? note.trim() : '';
    if (trimmedNote) remarks[bookId] = trimmedNote;
    else delete remarks[bookId];

    const oldTagsForBook = allTags[bookId] || [];
    const cleanTags = (tags || []).filter(t => t.trim());
    if (cleanTags.length) allTags[bookId] = cleanTags;
    else delete allTags[bookId];

    let templates = [...(res.wishlistTagTemplates || [])];
    let templatesChanged = false;

    if (cleanTags.length > 0) {
      const before = templates.length;
      templates = templates.filter(t => !cleanTags.includes(t));
      if (templates.length !== before) templatesChanged = true;
    }

    if (preserveOrphanTags && oldTagsForBook.length > 0) {
      const result = window.TEH.logic.promoteOrphanTags(oldTagsForBook, allTags, templates);
      if (result.changed) { templates = result.templates; templatesChanged = true; }
    }

    const updates = { wishlistRemarks: remarks, wishlistTags: allTags };
    if (templatesChanged) updates.wishlistTagTemplates = templates;

    // 寫入成功後才更新 cache，避免寫入失敗時 UI 顯示「已儲存」假象
    try {
      await chrome.storage.sync.set(updates);
    } catch (e) {
      const isQuota = /quota/i.test(String(e?.message || e));
      showErrorToast(isQuota
        ? '⚠️ 備註儲存失敗：資料量超過同步儲存空間上限，請刪減部分備註或標籤'
        : '⚠️ 備註儲存失敗，請稍後再試');
      return;
    }

    cachedLists.wishlistRemarks = remarks;
    cachedLists.wishlistTags    = allTags;
    rebuildTagPool(allTags);
    if (templatesChanged) cachedLists.wishlistTagTemplates = templates;

    if (callback) callback();
  }

  function initStorage(run) {
    if (!chrome.runtime?.id) return;

    chrome.storage.sync.get(SYNC_KEYS, (res) => {
      if (chrome.runtime?.lastError) return;
      if (SYNC_KEYS.some(k => res[k] !== undefined)) {
        updateCache(res);
        run(true);
        return;
      }
      // Sync is empty — migrate from local if available (first run after update).
      // Set localToSyncMigrated so management.js's migrateLocalToSync() skips the duplicate.
      chrome.storage.local.get(MIGRATE_KEYS, (localRes) => {
        if (chrome.runtime?.lastError) return;
        const data = {};
        MIGRATE_KEYS.forEach(k => { if (localRes[k] !== undefined) data[k] = localRes[k]; });
        if (Object.keys(data).length) {
          chrome.storage.sync.set(data, () => {
            if (chrome.runtime?.lastError) console.warn('[TEH] local→sync migration failed:', chrome.runtime.lastError);
          });
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

  window.TEH.storage = { initStorage, saveWishlistData, updateCache, showErrorToast };
})();
