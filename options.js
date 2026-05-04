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

// Load data with migration support
function loadSettings() {
  chrome.storage.local.get([
    'publisherBlacklist', 'authorBlacklist',
    'publisherWhitelist', 'authorWhitelist'
  ], (res) => {
    renderList(pubList, migrateData(res.publisherBlacklist || []), 'publisherBlacklist');
    renderList(authorList, migrateData(res.authorBlacklist || []), 'authorBlacklist');
    renderList(whitePubList, migrateData(res.publisherWhitelist || []), 'publisherWhitelist');
    renderList(whiteAuthorList, migrateData(res.authorWhitelist || []), 'authorWhitelist');
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

loadSettings();
