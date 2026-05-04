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

loadSettings();
