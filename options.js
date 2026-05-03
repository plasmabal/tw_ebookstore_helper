const pubInput = document.getElementById('pub-input');
const authorInput = document.getElementById('author-input');
const pubList = document.getElementById('pub-list');
const authorList = document.getElementById('author-list');

// Load data
function loadSettings() {
  chrome.storage.local.get(['publisherBlacklist', 'authorBlacklist'], (res) => {
    renderList(pubList, res.publisherBlacklist || [], 'publisherBlacklist');
    renderList(authorList, res.authorBlacklist || [], 'authorBlacklist');
  });
}

function renderList(container, items, storageKey) {
  container.innerHTML = '';
  items.forEach((item, index) => {
    const li = document.createElement('li');
    li.textContent = item;

    const delBtn = document.createElement('button');
    delBtn.innerHTML = '🗑️';
    delBtn.className = 'delete-btn';
    delBtn.onclick = () => {
      items.splice(index, 1);
      chrome.storage.local.set({ [storageKey]: items }, loadSettings);
    };

    li.appendChild(delBtn);
    container.appendChild(li);
  });
}

document.getElementById('add-pub').onclick = () => {
  addPub();
};

pubInput.onkeypress = (e) => {
  if (e.key === 'Enter') addPub();
};

function addPub() {
  const val = pubInput.value.trim();
  if (!val) return;
  chrome.storage.local.get(['publisherBlacklist'], (res) => {
    const list = res.publisherBlacklist || [];
    if (!list.includes(val)) {
      list.push(val);
      chrome.storage.local.set({ publisherBlacklist: list }, () => {
        pubInput.value = '';
        loadSettings();
      });
    }
  });
}

document.getElementById('add-author').onclick = () => {
  addAuthor();
};

authorInput.onkeypress = (e) => {
  if (e.key === 'Enter') addAuthor();
};

function addAuthor() {
  const val = authorInput.value.trim();
  if (!val) return;
  chrome.storage.local.get(['authorBlacklist'], (res) => {
    const list = res.authorBlacklist || [];
    if (!list.includes(val)) {
      list.push(val);
      chrome.storage.local.set({ authorBlacklist: list }, () => {
        authorInput.value = '';
        loadSettings();
      });
    }
  });
}

loadSettings();
