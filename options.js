const pubInput = document.getElementById('pub-input');
const pubNote = document.getElementById('pub-note');
const authorInput = document.getElementById('author-input');
const authorNote = document.getElementById('author-note');
const pubList = document.getElementById('pub-list');
const authorList = document.getElementById('author-list');

// Load data with migration support
function loadSettings() {
  chrome.storage.local.get(['publisherBlacklist', 'authorBlacklist'], (res) => {
    const publishers = migrateData(res.publisherBlacklist || []);
    const authors = migrateData(res.authorBlacklist || []);

    renderList(pubList, publishers, 'publisherBlacklist');
    renderList(authorList, authors, 'authorBlacklist');
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

document.getElementById('add-pub').onclick = () => addPub();
pubInput.onkeypress = (e) => { if (e.key === 'Enter') addPub(); };
pubNote.onkeypress = (e) => { if (e.key === 'Enter') addPub(); };

function addPub() {
  const name = pubInput.value.trim();
  const note = pubNote.value.trim();
  if (!name) return;

  chrome.storage.local.get(['publisherBlacklist'], (res) => {
    const list = migrateData(res.publisherBlacklist || []);
    if (!list.some(i => i.name === name)) {
      list.push({ name, note });
      chrome.storage.local.set({ publisherBlacklist: list }, () => {
        pubInput.value = '';
        pubNote.value = '';
        loadSettings();
      });
    }
  });
}

document.getElementById('add-author').onclick = () => addAuthor();
authorInput.onkeypress = (e) => { if (e.key === 'Enter') addAuthor(); };
authorNote.onkeypress = (e) => { if (e.key === 'Enter') addAuthor(); };

function addAuthor() {
  const name = authorInput.value.trim();
  const note = authorNote.value.trim();
  if (!name) return;

  chrome.storage.local.get(['authorBlacklist'], (res) => {
    const list = migrateData(res.authorBlacklist || []);
    if (!list.some(i => i.name === name)) {
      list.push({ name, note });
      chrome.storage.local.set({ authorBlacklist: list }, () => {
        authorInput.value = '';
        authorNote.value = '';
        loadSettings();
      });
    }
  });
}

loadSettings();
