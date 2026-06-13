// --- Constants & Shared State ---

const LIST_KEYS = ['publisherBlacklist', 'authorBlacklist', 'publisherWhitelist', 'authorWhitelist'];
const SCHEMA_VERSIONS = ['0.1.0', '0.2.0'];
const CURRENT_SCHEMA = '0.2.0';

// Shared tag pool - mutated in loadSettings(), read by createTagChipInput()
let listTagPool = [];

// --- DOM References ---

const navItems = document.querySelectorAll('.nav-item');
const configSections = document.querySelectorAll('.config-section');

// --- Tab Switching Logic ---

navItems.forEach(item => {
  item.onclick = () => {
    const targetId = item.getAttribute('data-target');

    navItems.forEach(nav => nav.classList.remove('active'));
    item.classList.add('active');

    configSections.forEach(section => {
      section.classList.remove('active');
      if (section.id === targetId) section.classList.add('active');
    });

    if (targetId === 'section-list-tags') loadListTagManager();
    if (targetId === 'section-wishlist-tags') loadWishlistTagManager();
    if (targetId === 'section-readmoo') loadReadmooSettings();
  };
});

// --- Migration System ---

const MIGRATIONS = {
  '0.2.0': () => new Promise((resolve) => {
    chrome.storage.sync.get([...LIST_KEYS, 'wishlistTags'], (res) => {
      const updates = {};
      LIST_KEYS.forEach(key => {
        if (Array.isArray(res[key])) {
          updates[key] = res[key].map(item => ({ ...item, tags: item.tags || [] }));
        }
      });
      if (!res.wishlistTags) updates.wishlistTags = {};
      chrome.storage.sync.set(updates, resolve);
    });
  })
};

function runMigrations() {
  return new Promise((resolve) => {
    chrome.storage.sync.get(['schemaVersion'], (res) => {
      const current = res.schemaVersion || '0.1.0';
      const currentIdx = SCHEMA_VERSIONS.indexOf(current);
      // If version is unknown (future), don't run any migrations
      const startIdx = currentIdx === -1 ? SCHEMA_VERSIONS.length : currentIdx + 1;
      const pending = SCHEMA_VERSIONS.slice(startIdx);

      const runNext = (i) => {
        if (i >= pending.length) {
          chrome.storage.sync.set({ schemaVersion: CURRENT_SCHEMA }, resolve);
          return;
        }
        const fn = MIGRATIONS[pending[i]];
        if (!fn) { runNext(i + 1); return; }
        fn().then(() => runNext(i + 1));
      };
      runNext(0);
    });
  });
}

function migrateLocalToSync() {
  return new Promise((resolve) => {
    chrome.storage.local.get(['localToSyncMigrated'], (check) => {
      if (check.localToSyncMigrated) { resolve(); return; }
      const migrateKeys = [...LIST_KEYS, 'wishlistRemarks', 'wishlistTags', 'schemaVersion', 'readmooAutoClosePreviewDialog'];
      chrome.storage.local.get(migrateKeys, (localData) => {
        const data = {};
        migrateKeys.forEach(k => { if (localData[k] !== undefined) data[k] = localData[k]; });
        const finish = () => chrome.storage.local.set({ localToSyncMigrated: true }, resolve);
        if (!Object.keys(data).length) { finish(); return; }
        chrome.storage.sync.set(data, () => {
          if (chrome.runtime.lastError) console.warn('TEH: migration to sync failed', chrome.runtime.lastError);
          finish();
        });
      });
    });
  });
}

// --- Settings Loading ---

function loadSettings() {
  chrome.storage.sync.get(LIST_KEYS, (res) => {
    const pubBlack  = res.publisherBlacklist || [];
    const authorBlack = res.authorBlacklist  || [];
    const pubWhite  = res.publisherWhitelist || [];
    const authorWhite = res.authorWhitelist  || [];

    // Rebuild shared tag pool from all list items
    const allTags = new Set();
    [...pubBlack, ...authorBlack, ...pubWhite, ...authorWhite].forEach(item => {
      (item.tags || []).forEach(t => allTags.add(t));
    });
    listTagPool.splice(0, listTagPool.length, ...allTags);

    renderList(document.getElementById('pub-list'),        pubBlack,   'publisherBlacklist');
    renderList(document.getElementById('author-list'),     authorBlack, 'authorBlacklist');
    renderList(document.getElementById('white-pub-list'),  pubWhite,   'publisherWhitelist');
    renderList(document.getElementById('white-author-list'), authorWhite, 'authorWhitelist');

    document.getElementById('count-pub-black').textContent   = pubBlack.length;
    document.getElementById('count-author-black').textContent = authorBlack.length;
    document.getElementById('count-pub-white').textContent   = pubWhite.length;
    document.getElementById('count-author-white').textContent = authorWhite.length;
  });
}

// --- Tag Chip Input Component ---

function createTagChipInput(initialTags = []) {
  return window.TEH.createChipInput({
    classes: {
      wrapper:         'tag-chip-input-wrapper',
      chipsRow:        'tag-chips-row',
      textInput:       'tag-text-input',
      dropdown:        'tag-autocomplete-dropdown',
      chip:            'tag-chip',
      chipRemove:      'tag-chip-remove',
      ariaRemoveLabel: (tag) => `移除 ${tag}`
    },
    getSuggestions: (q, currentTags) =>
      listTagPool.filter(t => t.toLowerCase().includes(q) && !currentTags.includes(t)),
    placeholder: '新增標籤 (Enter 確認)…',
    maxSuggestions: 8,
    initialTags
  });
}

// --- List Rendering ---

function renderList(container, items, storageKey) {
  container.innerHTML = '';
  items.forEach((item, index) => {
    const li = document.createElement('li');
    li.appendChild(buildDisplayRow(item, index, items, storageKey, li));
    container.appendChild(li);
  });
}

function buildDisplayRow(item, index, items, storageKey, li) {
  const row = document.createElement('div');
  row.className = 'item-display-row';

  const contentDiv = document.createElement('div');
  contentDiv.className = 'item-content';

  const nameSpan = document.createElement('span');
  nameSpan.className = 'item-name';
  nameSpan.textContent = item.name;
  contentDiv.appendChild(nameSpan);

  if (item.note) {
    const noteSpan = document.createElement('span');
    noteSpan.className = 'item-note';
    noteSpan.textContent = item.note;
    contentDiv.appendChild(noteSpan);
  }

  if (item.tags && item.tags.length > 0) {
    const tagsDiv = document.createElement('div');
    tagsDiv.className = 'item-tags';
    item.tags.forEach(tag => {
      const chip = document.createElement('span');
      chip.className = 'item-tag-chip';
      chip.textContent = tag;
      tagsDiv.appendChild(chip);
    });
    contentDiv.appendChild(tagsDiv);
  }

  const actionsDiv = document.createElement('div');
  actionsDiv.className = 'item-actions';

  const editBtn = document.createElement('button');
  editBtn.className = 'edit-btn';
  editBtn.title = '編輯';
  editBtn.textContent = '✏️';
  editBtn.onclick = () => {
    li.innerHTML = '';
    li.appendChild(buildEditRow(item, index, items, storageKey, li));
  };

  const delBtn = document.createElement('button');
  delBtn.className = 'delete-btn';
  delBtn.title = '刪除';
  delBtn.textContent = '🗑️';
  delBtn.onclick = () => {
    items.splice(index, 1);
    chrome.storage.sync.set({ [storageKey]: items }, loadSettings);
  };

  actionsDiv.appendChild(editBtn);
  actionsDiv.appendChild(delBtn);
  row.appendChild(contentDiv);
  row.appendChild(actionsDiv);

  return row;
}

function buildEditRow(item, index, items, storageKey, li) {
  const row = document.createElement('div');
  row.className = 'item-edit-row';

  const nameInput = document.createElement('input');
  nameInput.type = 'text';
  nameInput.className = 'edit-name-input';
  nameInput.value = item.name;
  nameInput.placeholder = '名稱 (必填)';

  const noteTextarea = document.createElement('textarea');
  noteTextarea.className = 'edit-note-textarea';
  noteTextarea.value = item.note || '';
  noteTextarea.placeholder = '備註 (選填)';
  noteTextarea.rows = 3;

  const tagInput = createTagChipInput(item.tags || []);

  const actionsDiv = document.createElement('div');
  actionsDiv.className = 'edit-actions';

  const saveBtn = document.createElement('button');
  saveBtn.className = 'btn-save-edit';
  saveBtn.textContent = '儲存';
  saveBtn.onclick = () => {
    const newName = nameInput.value.trim();
    if (!newName) return;
    items[index] = { name: newName, note: noteTextarea.value.trim(), tags: tagInput.getTags() };
    chrome.storage.sync.set({ [storageKey]: items }, loadSettings);
  };

  const cancelBtn = document.createElement('button');
  cancelBtn.className = 'btn-cancel-edit';
  cancelBtn.textContent = '取消';
  cancelBtn.onclick = () => {
    li.innerHTML = '';
    li.appendChild(buildDisplayRow(item, index, items, storageKey, li));
  };

  actionsDiv.appendChild(saveBtn);
  actionsDiv.appendChild(cancelBtn);

  row.appendChild(nameInput);
  row.appendChild(noteTextarea);
  row.appendChild(tagInput);
  row.appendChild(actionsDiv);

  nameInput.focus();
  return row;
}

// --- Add Item Handlers ---

function setupSection(inputId, noteId, buttonId, storageKey) {
  const input  = document.getElementById(inputId);
  const note   = document.getElementById(noteId);
  const button = document.getElementById(buttonId);

  const tagInput = createTagChipInput();
  button.before(tagInput);

  const doAdd = () => addItem(input, note, tagInput, storageKey);
  button.onclick = doAdd;
  input.addEventListener('keypress', (e) => { if (e.key === 'Enter') doAdd(); });
  note.addEventListener('keypress',  (e) => { if (e.key === 'Enter') doAdd(); });
}

function addItem(input, note, tagInput, storageKey) {
  const name    = input.value.trim();
  const noteVal = note.value.trim();
  const tags    = tagInput.getTags();
  if (!name) return;

  chrome.storage.sync.get([storageKey], (res) => {
    const list = res[storageKey] || [];
    if (!list.some(i => i.name === name)) {
      list.push({ name, note: noteVal, tags });
      chrome.storage.sync.set({ [storageKey]: list }, () => {
        input.value = '';
        note.value  = '';
        tagInput.reset();
        loadSettings();
      });
    }
  });
}

setupSection('pub-input',        'pub-note',        'add-pub',        'publisherBlacklist');
setupSection('author-input',     'author-note',     'add-author',     'authorBlacklist');
setupSection('white-pub-input',  'white-pub-note',  'add-white-pub',  'publisherWhitelist');
setupSection('white-author-input', 'white-author-note', 'add-white-author', 'authorWhitelist');

// --- Tag Manager ---

function loadListTagManager() {
  const el = document.getElementById('list-tag-manager');
  if (!el) return;

  chrome.storage.sync.get(LIST_KEYS, (res) => {
    const tagCounts = {};
    LIST_KEYS.forEach(key => {
      (res[key] || []).forEach(item => {
        (item.tags || []).forEach(tag => {
          tagCounts[tag] = (tagCounts[tag] || 0) + 1;
        });
      });
    });
    renderTagManagerContent(el, tagCounts, renameListTag, deleteListTag);
  });
}

function loadWishlistTagManager() {
  const el = document.getElementById('wishlist-tag-manager');
  if (!el) return;

  chrome.storage.sync.get(['wishlistTags', 'wishlistTagTemplates'], (res) => {
    const tagCounts = {};
    Object.values(res.wishlistTags || {}).forEach(tags => {
      (tags || []).forEach(tag => {
        tagCounts[tag] = (tagCounts[tag] || 0) + 1;
      });
    });
    const templates = res.wishlistTagTemplates || [];
    renderWishlistTagManagerContent(el, tagCounts, templates, renameWishlistTag, deleteWishlistTag);
  });
}

function renderWishlistTagManagerContent(containerEl, tagCounts, templateTags, onRename, onDelete) {
  containerEl.innerHTML = '';

  const activeTags = Object.keys(tagCounts).sort((a, b) => {
    const diff = tagCounts[b] - tagCounts[a];
    return diff !== 0 ? diff : a.localeCompare(b, 'zh-TW');
  });

  const activeSet = new Set(activeTags);
  const templateOnlyTags = templateTags
    .filter(t => !activeSet.has(t))
    .sort((a, b) => a.localeCompare(b, 'zh-TW'));

  if (activeTags.length === 0 && templateOnlyTags.length === 0) {
    const p = document.createElement('p');
    p.className = 'tag-manager-empty';
    p.textContent = '尚無標籤。在新增備註時可加入標籤。';
    containerEl.appendChild(p);
    return;
  }

  const ul = document.createElement('ul');
  ul.className = 'tag-manager-list';

  activeTags.forEach(tag => {
    ul.appendChild(buildWishlistTagItem(tag, `${tagCounts[tag]} 本`, onRename, onDelete));
  });

  if (templateOnlyTags.length > 0) {
    if (activeTags.length > 0) {
      const sep = document.createElement('li');
      sep.className = 'tag-manager-separator';
      sep.textContent = '── 已儲存（目前無待購書籍）──';
      ul.appendChild(sep);
    }
    templateOnlyTags.forEach(tag => {
      ul.appendChild(buildWishlistTagItem(tag, '(0 本)', onRename, onDelete));
    });
  }

  containerEl.appendChild(ul);
}

function buildWishlistTagItem(tag, countLabel, onRename, onDelete) {
  const li = document.createElement('li');
  li.className = 'tag-manager-item';

  const nameSpan = document.createElement('span');
  nameSpan.className = 'tag-manager-name';
  nameSpan.textContent = tag;

  const countSpan = document.createElement('span');
  countSpan.className = 'tag-manager-count';
  countSpan.textContent = countLabel;

  const renameBtn = document.createElement('button');
  renameBtn.className = 'btn-tag-rename';
  renameBtn.textContent = '重命名';
  renameBtn.onclick = () => startInlineRename(li, tag, nameSpan, renameBtn, deleteBtn, onRename);

  const deleteBtn = document.createElement('button');
  deleteBtn.className = 'btn-tag-delete';
  deleteBtn.textContent = '刪除';
  deleteBtn.onclick = () => {
    const msg = countLabel === '(0 本)'
      ? `確定要刪除儲存的標籤「${tag}」？`
      : `確定要刪除標籤「${tag}」？\n此標籤將從所有含有此標籤的書籍中移除。`;
    if (confirm(msg)) onDelete(tag);
  };

  li.appendChild(nameSpan);
  li.appendChild(countSpan);
  li.appendChild(renameBtn);
  li.appendChild(deleteBtn);
  return li;
}

function renderTagManagerContent(containerEl, tagCounts, onRename, onDelete) {
  containerEl.innerHTML = '';
  const tags = Object.keys(tagCounts).sort();

  if (tags.length === 0) {
    const p = document.createElement('p');
    p.className = 'tag-manager-empty';
    p.textContent = '尚無標籤。在新增條目時可加入標籤。';
    containerEl.appendChild(p);
    return;
  }

  const ul = document.createElement('ul');
  ul.className = 'tag-manager-list';

  tags.forEach(tag => {
    const li = document.createElement('li');
    li.className = 'tag-manager-item';

    const nameSpan = document.createElement('span');
    nameSpan.className = 'tag-manager-name';
    nameSpan.textContent = tag;

    const countSpan = document.createElement('span');
    countSpan.className = 'tag-manager-count';
    countSpan.textContent = `${tagCounts[tag]} 個條目`;

    const renameBtn = document.createElement('button');
    renameBtn.className = 'btn-tag-rename';
    renameBtn.textContent = '重命名';
    renameBtn.onclick = () => startInlineRename(li, tag, nameSpan, renameBtn, deleteBtn, onRename);

    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'btn-tag-delete';
    deleteBtn.textContent = '刪除';
    deleteBtn.onclick = () => {
      if (confirm(`確定要刪除標籤「${tag}」？\n此標籤將從所有 ${tagCounts[tag]} 個條目中移除。`)) {
        onDelete(tag);
      }
    };

    li.appendChild(nameSpan);
    li.appendChild(countSpan);
    li.appendChild(renameBtn);
    li.appendChild(deleteBtn);
    ul.appendChild(li);
  });

  containerEl.appendChild(ul);
}

function startInlineRename(li, oldTag, nameSpan, renameBtn, deleteBtn, onRename) {
  const input = document.createElement('input');
  input.type = 'text';
  input.className = 'tag-rename-input';
  input.value = oldTag;
  input.maxLength = 20;

  const confirmBtn = document.createElement('button');
  confirmBtn.className = 'btn-tag-rename-confirm';
  confirmBtn.textContent = '確認';

  const cancelBtn = document.createElement('button');
  cancelBtn.className = 'btn-tag-rename-cancel';
  cancelBtn.textContent = '取消';

  const doRename = () => {
    const newTag = input.value.trim();
    if (!newTag || newTag === oldTag) { restoreDisplay(); return; }
    nameSpan.textContent = newTag;
    restoreDisplay();
    onRename(oldTag, newTag);
  };

  const restoreDisplay = () => {
    input.replaceWith(nameSpan);
    confirmBtn.remove();
    cancelBtn.remove();
    renameBtn.style.display = '';
    deleteBtn.style.display = '';
  };

  confirmBtn.onclick = doRename;
  cancelBtn.onclick  = restoreDisplay;
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter')  doRename();
    if (e.key === 'Escape') restoreDisplay();
  });

  nameSpan.replaceWith(input);
  renameBtn.style.display = 'none';
  deleteBtn.style.display = 'none';
  li.appendChild(confirmBtn);
  li.appendChild(cancelBtn);
  input.focus();
  input.select();
}

function renameListTag(oldTag, newTag) {
  chrome.storage.sync.get(LIST_KEYS, (res) => {
    const updates = {};
    LIST_KEYS.forEach(key => {
      updates[key] = (res[key] || []).map(item => ({
        ...item,
        tags: [...new Set((item.tags || []).map(t => t === oldTag ? newTag : t))]
      }));
    });
    chrome.storage.sync.set(updates, () => {
      loadSettings();
      loadListTagManager();
    });
  });
}

function deleteListTag(tag) {
  chrome.storage.sync.get(LIST_KEYS, (res) => {
    const updates = {};
    LIST_KEYS.forEach(key => {
      updates[key] = (res[key] || []).map(item => ({
        ...item,
        tags: (item.tags || []).filter(t => t !== tag)
      }));
    });
    chrome.storage.sync.set(updates, () => {
      loadSettings();
      loadListTagManager();
    });
  });
}

function renameWishlistTag(oldTag, newTag) {
  chrome.storage.sync.get(['wishlistTags', 'wishlistTagTemplates'], (res) => {
    const updatedTags = {};
    Object.entries(res.wishlistTags || {}).forEach(([bookId, tags]) => {
      updatedTags[bookId] = [...new Set((tags || []).map(t => t === oldTag ? newTag : t))];
    });
    const updatedTemplates = [...new Set(
      (res.wishlistTagTemplates || []).map(t => t === oldTag ? newTag : t)
    )];
    chrome.storage.sync.set({ wishlistTags: updatedTags, wishlistTagTemplates: updatedTemplates }, loadWishlistTagManager);
  });
}

function deleteWishlistTag(tag) {
  chrome.storage.sync.get(['wishlistTags', 'wishlistTagTemplates'], (res) => {
    const updatedTags = {};
    Object.entries(res.wishlistTags || {}).forEach(([bookId, tags]) => {
      const filtered = (tags || []).filter(t => t !== tag);
      if (filtered.length) updatedTags[bookId] = filtered;
    });
    const updatedTemplates = (res.wishlistTagTemplates || []).filter(t => t !== tag);
    chrome.storage.sync.set({ wishlistTags: updatedTags, wishlistTagTemplates: updatedTemplates }, loadWishlistTagManager);
  });
}

// --- Readmoo Reader Settings ---

function loadReadmooSettings() {
  chrome.storage.sync.get(['readmooAutoClosePreviewDialog'], (res) => {
    document.getElementById('toggle-auto-close-preview').checked =
      !!res.readmooAutoClosePreviewDialog;
  });
}

document.getElementById('toggle-auto-close-preview').addEventListener('change', (e) => {
  chrome.storage.sync.set({ readmooAutoClosePreviewDialog: e.target.checked });
});

// --- Backup and Restore ---

function exportData() {
  chrome.storage.sync.get(null, (res) => {
    const keysToExport = [...LIST_KEYS, 'wishlistRemarks', 'wishlistTags', 'wishlistTagTemplates', 'schemaVersion'];
    const exportObj = {};
    keysToExport.forEach(key => {
      if (res[key] !== undefined) exportObj[key] = res[key];
    });

    const blob = new Blob([JSON.stringify(exportObj, null, 2)], { type: 'application/json' });
    const url  = URL.createObjectURL(blob);
    const date = new Date();
    const dateStr = date.toISOString().slice(0, 10).replace(/-/g, '');
    const timeStr = date.toTimeString().slice(0, 5).replace(/:/g, '');

    const a = document.createElement('a');
    a.href     = url;
    a.download = `teh_backup_${dateStr}_${timeStr}.json`;
    a.click();
    URL.revokeObjectURL(url);
  });
}

function handleImport(file) {
  if (!file) return;

  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const data = JSON.parse(e.target.result);

      const validateList = (list) => {
        if (!list) return true;
        if (!Array.isArray(list)) return false;
        return list.every(item => item && typeof item === 'object' && 'name' in item &&
          (item.tags === undefined || Array.isArray(item.tags)));
      };

      for (const key of LIST_KEYS) {
        if (!validateList(data[key])) {
          alert(`❌ 錯誤：備份檔案結構損壞 (${key} 格式不符)。`);
          return;
        }
      }

      if (data.wishlistRemarks !== undefined &&
          (typeof data.wishlistRemarks !== 'object' || Array.isArray(data.wishlistRemarks))) {
        alert('❌ 錯誤：備份檔案結構損壞 (wishlistRemarks 格式不符)。');
        return;
      }

      if (data.wishlistTags !== undefined &&
          (typeof data.wishlistTags !== 'object' || Array.isArray(data.wishlistTags))) {
        alert('❌ 錯誤：備份檔案結構損壞 (wishlistTags 格式不符)。');
        return;
      }

      if (data.wishlistTagTemplates !== undefined && (
          !Array.isArray(data.wishlistTagTemplates) ||
          !data.wishlistTagTemplates.every(t => typeof t === 'string')
      )) {
        alert('❌ 錯誤：備份檔案結構損壞 (wishlistTagTemplates 格式不符)。');
        return;
      }

      const validKeys = [...LIST_KEYS, 'wishlistRemarks', 'wishlistTags', 'wishlistTagTemplates'];
      if (!validKeys.some(key => key in data)) {
        alert('❌ 錯誤：此檔案不包含有效的備份資料。');
        return;
      }

      if (confirm('⚠️ 注意：還原將會完全覆蓋現有的名單與備註資料！\n確定要繼續嗎？')) {
        const keysToRestore = [...LIST_KEYS, 'wishlistRemarks', 'wishlistTags', 'wishlistTagTemplates'];
        const safeData = {};
        keysToRestore.forEach(k => { if (k in data) safeData[k] = data[k]; });
        chrome.storage.sync.set(safeData, () => {
          if (chrome.runtime.lastError) {
            alert('❌ 錯誤：資料量超過同步儲存空間限制（100 KB），無法還原。請減少清單條目後再試。');
            return;
          }
          // Remove schemaVersion so migrations re-run on imported data
          chrome.storage.sync.remove('schemaVersion', () => {
            runMigrations().then(() => {
              alert('✅ 資料還原成功！');
              loadSettings();
            });
          });
        });
      }
    } catch (err) {
      alert('❌ 錯誤：無法解析 JSON 檔案。');
      console.error(err);
    }
  };
  reader.readAsText(file);
}

// --- Bind System Handlers ---

document.getElementById('export-btn').onclick = exportData;
const importBtn  = document.getElementById('import-btn');
const importFile = document.getElementById('import-file');

importBtn.onclick = () => importFile.click();
importFile.onchange = (e) => {
  handleImport(e.target.files[0]);
  e.target.value = '';
};

// --- Drag and Drop Support ---

const dropZone = document.getElementById('import-drop-zone');

['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
  dropZone.addEventListener(eventName, (e) => { e.preventDefault(); e.stopPropagation(); }, false);
});

['dragenter', 'dragover'].forEach(eventName => {
  dropZone.addEventListener(eventName, () => dropZone.classList.add('drag-over'), false);
});

['dragleave', 'drop'].forEach(eventName => {
  dropZone.addEventListener(eventName, () => dropZone.classList.remove('drag-over'), false);
});

dropZone.addEventListener('drop', (e) => {
  const file = e.dataTransfer.files[0];
  if (file && file.type === 'application/json') {
    handleImport(file);
  } else if (file) {
    alert('❌ 錯誤：請提供有效的 JSON 備份檔案。');
  }
}, false);

// --- Init ---

migrateLocalToSync().then(runMigrations).then(loadSettings);
