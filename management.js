// Tab elements
const navItems = document.querySelectorAll('.nav-item');
const configSections = document.querySelectorAll('.config-section');

// Blacklist elements
const pubInput = document.getElementById('pub-input');
const pubNote = document.getElementById('pub-note');
const authorInput = document.getElementById('author-input');
const authorNote = document.getElementById('author-note');
const pubList = document.getElementById('pub-list');
const authorList = document.getElementById('author-list');

// Whitelist elements
const whitePubInput = document.getElementById('white-pub-input');
const whitePubNote = document.getElementById('white-pub-note');
const whiteAuthorInput = document.getElementById('white-author-input');
const whiteAuthorNote = document.getElementById('white-author-note');
const whitePubList = document.getElementById('white-pub-list');
const whiteAuthorList = document.getElementById('white-author-list');

// Tab Switching Logic
navItems.forEach(item => {
  item.onclick = () => {
    const targetId = item.getAttribute('data-target');

    // Update active nav item
    navItems.forEach(nav => nav.classList.remove('active'));
    item.classList.add('active');

    // Update active section
    configSections.forEach(section => {
      section.classList.remove('active');
      if (section.id === targetId) {
        section.classList.add('active');
      }
    });
  };
});

// Load data with migration support
function loadSettings() {
  chrome.storage.local.get([
    'publisherBlacklist', 'authorBlacklist',
    'publisherWhitelist', 'authorWhitelist'
  ], (res) => {
    const pubBlack = migrateData(res.publisherBlacklist || []);
    const authorBlack = migrateData(res.authorBlacklist || []);
    const pubWhite = migrateData(res.publisherWhitelist || []);
    const authorWhite = migrateData(res.authorWhitelist || []);

    renderList(pubList, pubBlack, 'publisherBlacklist');
    renderList(authorList, authorBlack, 'authorBlacklist');
    renderList(whitePubList, pubWhite, 'publisherWhitelist');
    renderList(whiteAuthorList, authorWhite, 'authorWhitelist');

    // Update counts
    document.getElementById('count-pub-black').textContent = pubBlack.length;
    document.getElementById('count-author-black').textContent = authorBlack.length;
    document.getElementById('count-pub-white').textContent = pubWhite.length;
    document.getElementById('count-author-white').textContent = authorWhite.length;
  });
}

// Convert old string array to object array if needed
function migrateData(list) {
  if (list.length > 0 && typeof list[0] === 'string') {
    return list.map(item => ({ name: item, note: '' }));
  }
  return list;
}

function renderList(container, items, storageKey) {
  container.innerHTML = '';
  items.forEach((item, index) => {
    const li = document.createElement('li');

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

    const delBtn = document.createElement('button');
    delBtn.innerHTML = '🗑️';
    delBtn.className = 'delete-btn';
    delBtn.title = '刪除';
    delBtn.onclick = () => {
      items.splice(index, 1);
      chrome.storage.local.set({ [storageKey]: items }, loadSettings);
    };

    li.appendChild(contentDiv);
    li.appendChild(delBtn);
    container.appendChild(li);
  });
}

// Bind handlers
function setupHandlers(input, note, button, storageKey) {
  button.onclick = () => addItem(input, note, storageKey);
  input.onkeypress = (e) => { if (e.key === 'Enter') addItem(input, note, storageKey); };
  note.onkeypress = (e) => { if (e.key === 'Enter') addItem(input, note, storageKey); };
}

function addItem(input, note, storageKey) {
  const name = input.value.trim();
  const noteVal = note.value.trim();
  if (!name) return;

  chrome.storage.local.get([storageKey], (res) => {
    const list = migrateData(res[storageKey] || []);
    if (!list.some(i => i.name === name)) {
      list.push({ name, note: noteVal });
      chrome.storage.local.set({ [storageKey]: list }, () => {
        input.value = '';
        note.value = '';
        loadSettings();
      });
    }
  });
}

setupHandlers(pubInput, pubNote, document.getElementById('add-pub'), 'publisherBlacklist');
setupHandlers(authorInput, authorNote, document.getElementById('add-author'), 'authorBlacklist');
setupHandlers(whitePubInput, whitePubNote, document.getElementById('add-white-pub'), 'publisherWhitelist');
setupHandlers(whiteAuthorInput, whiteAuthorNote, document.getElementById('add-white-author'), 'authorWhitelist');

// --- Backup and Restore Logic ---

function exportData() {
  chrome.storage.local.get(null, (res) => {
    // 雖然 get(null) 會抓取所有資料，我們仍可明確過濾需要的鍵值以防未來有不必要的快取也被匯出
    const keysToExport = [
      'publisherBlacklist', 'authorBlacklist',
      'publisherWhitelist', 'authorWhitelist',
      'wishlistRemarks'
    ];

    const exportObj = {};
    keysToExport.forEach(key => {
      if (res[key]) exportObj[key] = res[key];
    });

    const blob = new Blob([JSON.stringify(exportObj, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const date = new Date();
    const dateStr = date.toISOString().slice(0, 10).replace(/-/g, '');
    const timeStr = date.toTimeString().slice(0, 5).replace(/:/g, '');

    const a = document.createElement('a');
    a.href = url;
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

      // 深度結構驗證
      const validKeys = [
        'publisherBlacklist', 'authorBlacklist',
        'publisherWhitelist', 'authorWhitelist',
        'wishlistRemarks'
      ];

      const validateList = (list) => {
        if (!list) return true;
        if (!Array.isArray(list)) return false;
        return list.every(item => typeof item === 'string' || (item && typeof item === 'object' && 'name' in item));
      };

      if (!validateList(data.publisherBlacklist) ||
          !validateList(data.authorBlacklist) ||
          !validateList(data.publisherWhitelist) ||
          !validateList(data.authorWhitelist)) {
        alert('❌ 錯誤：備份檔案結構損壞 (陣列格式不符)。');
        return;
      }


      if (data.wishlistRemarks && typeof data.wishlistRemarks !== 'object') {
        alert('❌ 錯誤：備份檔案結構損壞 (備註格式不符)。');
        return;
      }

      const hasValidData = validKeys.some(key => data.hasOwnProperty(key));
      if (!hasValidData) {
        alert('❌ 錯誤：此檔案不包含有效的備份資料。');
        return;
      }

      if (confirm('⚠️ 注意：還原將會完全覆蓋現有的名單與備註資料！\n確定要繼續嗎？')) {
        chrome.storage.local.set(data, () => {
          alert('✅ 資料還原成功！');
          loadSettings(); // 重新整理 UI
        });
      }
    } catch (err) {
      alert('❌ 錯誤：無法解析 JSON 檔案。');
      console.error(err);
    }
  };
  reader.readAsText(file);
}

// Bind System Handlers
document.getElementById('export-btn').onclick = exportData;
const importBtn = document.getElementById('import-btn');
const importFile = document.getElementById('import-file');

importBtn.onclick = () => importFile.click();
importFile.onchange = (e) => {
  handleImport(e.target.files[0]);
  e.target.value = ''; // 重設以便下次選取同一個檔案也能觸發
};

// --- Drag and Drop Support ---
const dropZone = document.getElementById('import-drop-zone');

['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
  dropZone.addEventListener(eventName, (e) => {
    e.preventDefault();
    e.stopPropagation();
  }, false);
});

['dragenter', 'dragover'].forEach(eventName => {
  dropZone.addEventListener(eventName, () => {
    dropZone.classList.add('drag-over');
  }, false);
});

['dragleave', 'drop'].forEach(eventName => {
  dropZone.addEventListener(eventName, () => {
    dropZone.classList.remove('drag-over');
  }, false);
});

dropZone.addEventListener('drop', (e) => {
  const dt = e.dataTransfer;
  const file = dt.files[0];
  if (file && file.type === "application/json") {
    handleImport(file);
  } else if (file) {
    alert('❌ 錯誤：請提供有效的 JSON 備份檔案。');
  }
}, false);

loadSettings();
