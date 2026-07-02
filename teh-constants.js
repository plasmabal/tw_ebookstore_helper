// 集中定義 storage key 清單。content scripts（manifest）與 options page（management.html）
// 皆載入此檔，讓 local→sync 遷移 key 集合維持單一來源，不再依賴註解人工同步。
window.TEH = window.TEH || {};

// 黑白名單四個 key
window.TEH.LIST_KEYS = [
  'publisherBlacklist', 'authorBlacklist',
  'publisherWhitelist', 'authorWhitelist'
];

// content script 讀取 sync 與監聽 onChanged 用（不含 content script 不需處理的 key）
window.TEH.SYNC_KEYS = [
  ...window.TEH.LIST_KEYS,
  'wishlistRemarks', 'wishlistTags', 'wishlistTagTemplates'
];

// local→sync 一次性遷移用的完整 key 集合
window.TEH.MIGRATE_KEYS = [
  ...window.TEH.SYNC_KEYS,
  'schemaVersion', 'readmooAutoClosePreviewDialog'
];
