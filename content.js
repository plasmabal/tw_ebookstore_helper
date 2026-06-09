(function() {
  const site = window.TEH?.findSite();
  if (!site) return;

  let cachedLists = {
    black: { publisher: [], author: [] },
    white: { publisher: [], author: [] },
    wishlistRemarks: {},
    wishlistTags: {},
    wishlistTagPool: [],
    wishlistTagTemplates: []
  };

  let activeTagFilters = new Set();

  // 初始化名單並監聽變動
  function initStorage() {
    if (!chrome.runtime?.id) return;

    const keys = [
      'publisherBlacklist', 'authorBlacklist',
      'publisherWhitelist', 'authorWhitelist',
      'wishlistRemarks', 'wishlistTags', 'wishlistTagTemplates'
    ];

    chrome.storage.sync.get(keys, (res) => {
      if (chrome.runtime.lastError) return;
      if (keys.some(k => res[k] !== undefined)) {
        updateCache(res);
        run(true);
        return;
      }
      // Sync is empty — migrate from local if available (first run after update)
      chrome.storage.local.get(keys, (localRes) => {
        if (chrome.runtime.lastError) return;
        const data = {};
        keys.forEach(k => { if (localRes[k] !== undefined) data[k] = localRes[k]; });
        if (Object.keys(data).length) chrome.storage.sync.set(data);
        updateCache(localRes);
        run(true);
      });
    });

    chrome.storage.onChanged.addListener((changes, namespace) => {
      if (namespace !== 'sync') return;

      const validKeys = [
        'publisherBlacklist', 'authorBlacklist',
        'publisherWhitelist', 'authorWhitelist',
        'wishlistRemarks', 'wishlistTags', 'wishlistTagTemplates'
      ];

      const res = {};
      let hasChanges = false;
      validKeys.forEach(key => {
        if (changes[key]) { res[key] = changes[key].newValue; hasChanges = true; }
      });

      if (hasChanges) { updateCache(res); run(true); }
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
      const pool = new Set();
      Object.values(cachedLists.wishlistTags).forEach(tags => {
        (tags || []).forEach(t => pool.add(t));
      });
      cachedLists.wishlistTagPool = [...pool].sort((a, b) => a.localeCompare(b, 'zh-TW'));
      activeTagFilters.forEach(tag => {
        if (!cachedLists.wishlistTagPool.includes(tag)) activeTagFilters.delete(tag);
      });
    }

    if ('wishlistTagTemplates' in res) {
      cachedLists.wishlistTagTemplates = (res.wishlistTagTemplates || []).slice();
    }
  }

  // --- 待購清單備份功能 ---

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

      // Update in-memory cache immediately so callbacks can read fresh values
      cachedLists.wishlistRemarks = remarks;
      cachedLists.wishlistTags    = allTags;
      const pool = new Set();
      Object.values(allTags).forEach(ts => (ts || []).forEach(t => pool.add(t)));
      cachedLists.wishlistTagPool = [...pool].sort((a, b) => a.localeCompare(b, 'zh-TW'));
      activeTagFilters.forEach(tag => {
        if (!cachedLists.wishlistTagPool.includes(tag)) activeTagFilters.delete(tag);
      });

      // --- Template management ---
      let templates = [...(res.wishlistTagTemplates || [])];
      let templatesChanged = false;

      // Deactivate: remove newly-added tags from templates (they're now actively used)
      if (cleanTags.length > 0) {
        const before = templates.length;
        templates = templates.filter(t => !cleanTags.includes(t));
        if (templates.length !== before) templatesChanged = true;
      }

      // Orphan promotion: when a book leaves the wishlist, preserve its orphaned tags
      if (preserveOrphanTags && oldTagsForBook.length > 0) {
        const remainingPool = new Set(Object.values(allTags).flat());
        const templateSet = new Set(templates);
        let promoted = false;
        oldTagsForBook.forEach(tag => {
          if (!remainingPool.has(tag) && !templateSet.has(tag)) {
            templateSet.add(tag);
            promoted = true;
          }
        });
        if (promoted) {
          templates = [...templateSet].sort((a, b) => a.localeCompare(b, 'zh-TW'));
          templatesChanged = true;
        }
      }

      if (templatesChanged) cachedLists.wishlistTagTemplates = templates;

      const updates = { wishlistRemarks: remarks, wishlistTags: allTags };
      if (templatesChanged) updates.wishlistTagTemplates = templates;
      chrome.storage.sync.set(updates, callback);
    });
  }

  // --- Chip input for wishlist (lightweight, no external deps) ---

  function createWishlistChipInput(initialTags = []) {
    const tags = [...initialTags];

    const wrapper = document.createElement('div');
    wrapper.className = 'teh-tag-chip-input';

    const chipsRow = document.createElement('div');
    chipsRow.className = 'teh-tag-chips-row';

    const textInput = document.createElement('input');
    textInput.type = 'text';
    textInput.className = 'teh-tag-text-input';
    textInput.placeholder = '新增標籤…';
    textInput.maxLength = 20;

    const dropdown = document.createElement('ul');
    dropdown.className = 'teh-tag-autocomplete';
    dropdown.style.display = 'none';

    function renderChips() {
      chipsRow.innerHTML = '';
      tags.forEach((tag, i) => {
        const chip = document.createElement('span');
        chip.className = 'teh-tag-chip';

        const label = document.createElement('span');
        label.textContent = tag;

        const removeBtn = document.createElement('button');
        removeBtn.type = 'button';
        removeBtn.textContent = '×';
        removeBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          tags.splice(i, 1);
          renderChips();
        });

        chip.appendChild(label);
        chip.appendChild(removeBtn);
        chipsRow.appendChild(chip);
      });
      chipsRow.appendChild(textInput);
    }

    function addTag(value) {
      const tag = value.trim().slice(0, 20);
      if (!tag || tags.includes(tag)) { textInput.value = ''; return; }
      tags.push(tag);
      renderChips();
      textInput.value = '';
      dropdown.style.display = 'none';
      textInput.focus();
    }

    let highlightedIdx = -1;

    function showDropdown(query) {
      if (!query) { hideDropdown(); return; }
      const q = query.toLowerCase();
      const allPoolTags = [...new Set([...cachedLists.wishlistTagPool, ...cachedLists.wishlistTagTemplates])];
      const suggestions = allPoolTags.filter(t => t.toLowerCase().includes(q) && !tags.includes(t)).slice(0, 5);
      if (!suggestions.length) { hideDropdown(); return; }
      highlightedIdx = -1;
      dropdown.innerHTML = '';
      suggestions.forEach(tag => {
        const li = document.createElement('li');
        li.textContent = tag;
        li.addEventListener('mousedown', (e) => { e.preventDefault(); addTag(tag); });
        dropdown.appendChild(li);
      });
      dropdown.style.display = 'block';
    }

    function hideDropdown() {
      dropdown.style.display = 'none';
      dropdown.innerHTML = '';
      highlightedIdx = -1;
    }

    function updateHighlight() {
      dropdown.querySelectorAll('li').forEach((li, i) => {
        li.classList.toggle('highlighted', i === highlightedIdx);
      });
    }

    textInput.addEventListener('input', () => showDropdown(textInput.value));
    textInput.addEventListener('blur', hideDropdown);
    textInput.addEventListener('keydown', (e) => {
      const isOpen = dropdown.style.display !== 'none';
      const items  = dropdown.querySelectorAll('li');

      if (isOpen && e.key === 'ArrowDown') {
        e.preventDefault();
        highlightedIdx = Math.min(highlightedIdx + 1, items.length - 1);
        updateHighlight();
        return;
      }
      if (isOpen && e.key === 'ArrowUp') {
        e.preventDefault();
        highlightedIdx = Math.max(highlightedIdx - 1, -1);
        updateHighlight();
        return;
      }
      if (e.key === 'Escape') { hideDropdown(); return; }
      if (e.key === 'Enter' || e.key === ',') {
        e.preventDefault();
        if (isOpen && highlightedIdx >= 0) addTag(items[highlightedIdx].textContent);
        else addTag(textInput.value);
      } else if (e.key === 'Backspace' && !textInput.value && tags.length > 0) {
        tags.pop();
        renderChips();
      }
    });

    renderChips();
    wrapper.appendChild(chipsRow);
    wrapper.appendChild(dropdown);
    wrapper.getTags = () => [...tags];
    wrapper.reset = () => { tags.splice(0); renderChips(); textInput.value = ''; };

    return wrapper;
  }

  // ---

  function handleBookPageWishlistButton() {
    const btn = document.querySelector('button[title*="待購清單"]');
    if (!btn || btn.dataset.tehObserved) return;

    btn.dataset.tehObserved = 'true';
    btn.addEventListener('click', () => {
      // Always derive bookId from the URL so it matches the format used on the
      // wishlist page (coverLink.href). Using data-readmoo-id was unreliable
      // because Readmoo's attribute may use a different ID format.
      const m = window.location.pathname.match(/\/book\/(\d+)/);
      const bookId = m ? m[1] : null;
      if (!bookId) return;

      const isAlreadyInWishlist = btn.classList.contains('active') || btn.innerText.includes('已加入');
      if (!isAlreadyInWishlist) {
        setTimeout(() => showRemarkPopover(btn, bookId), 500);
      }
    });
  }

  function showRemarkPopover(targetEl, bookId) {
    if (document.querySelector('.teh-remark-popover')) return;

    const popover = document.createElement('div');
    popover.className = 'teh-remark-popover';

    const rect = targetEl.getBoundingClientRect();
    const topPx = Math.max(window.scrollY + 8, window.scrollY + rect.top - 230);
    popover.style.top  = `${topPx}px`;
    popover.style.left = `${window.scrollX + rect.left}px`;

    const textarea = document.createElement('textarea');
    textarea.placeholder = '輸入備註 (例如：為何想買這本書？)';
    textarea.value = cachedLists.wishlistRemarks[bookId] || '';

    const tagLabel = document.createElement('div');
    tagLabel.className = 'teh-remark-tag-label';
    tagLabel.textContent = '🏷️ 標籤:';

    const tagInput = createWishlistChipInput(cachedLists.wishlistTags[bookId] || []);

    const footer = document.createElement('div');
    footer.className = 'teh-remark-popover-footer';

    const cancelBtn = document.createElement('button');
    cancelBtn.className = 'teh-btn-cancel';
    cancelBtn.textContent = '取消';
    cancelBtn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      popover.remove();
    });

    const saveBtn = document.createElement('button');
    saveBtn.className = 'teh-btn-save';
    saveBtn.textContent = '儲存';
    saveBtn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      saveWishlistData(bookId, textarea.value, tagInput.getTags());
      popover.remove();
    });

    footer.appendChild(cancelBtn);
    footer.appendChild(saveBtn);
    popover.appendChild(textarea);
    popover.appendChild(tagLabel);
    popover.appendChild(tagInput);
    popover.appendChild(footer);
    document.body.appendChild(popover);

    const onOutsideClick = (e) => {
      if (popover.contains(e.target) || e.target === targetEl) return;
      // Capture phase fires before Readmoo's handler removes the modal, so
      // role="dialog" is still in the DOM when we check — ignore those clicks.
      if (e.target.closest('[role="dialog"]')) return;
      popover.remove();
      document.removeEventListener('click', onOutsideClick, true);
    };
    setTimeout(() => document.addEventListener('click', onOutsideClick, true), 0);

    textarea.focus();
  }

  function renderTagFilterBar() {
    if (window.location.hash !== '#wishlist') return;

    const pool = cachedLists.wishlistTagPool;

    let bar = document.querySelector('.teh-tag-filter-bar');
    if (!bar) {
      bar = document.createElement('div');
      bar.className = 'teh-tag-filter-bar';
      const list = document.querySelector('ul.cart-list-item-list');
      if (!list) return;
      list.before(bar);
    }

    // Full rebuild only when pool changes; otherwise just update classes.
    // innerHTML-based rebuilds trigger the MutationObserver (childList), which
    // re-schedules run() every 300 ms and causes flicker + missed clicks.
    const existingTags = [...bar.querySelectorAll('.teh-filter-tag')].map(b => b.textContent);
    const poolChanged = pool.length !== existingTags.length || pool.some((t, i) => t !== existingTags[i]);

    if (poolChanged) {
      bar.innerHTML = '';

      const clearBtn = document.createElement('button');
      clearBtn.className = 'teh-filter-clear-btn';
      clearBtn.textContent = '清除標籤篩選';
      clearBtn.addEventListener('click', clearTagFilter);
      bar.appendChild(clearBtn);

      pool.forEach(tag => {
        const btn = document.createElement('button');
        btn.className = 'teh-filter-tag';
        btn.textContent = tag;
        btn.addEventListener('click', () => toggleTagFilter(tag));
        bar.appendChild(btn);
      });
    }

    // Update active classes (classList.toggle is an attribute mutation — does NOT
    // trigger the childList MutationObserver).
    const clearBtn = bar.querySelector('.teh-filter-clear-btn');
    if (clearBtn) clearBtn.classList.toggle('teh-filter-tag-active', activeTagFilters.size > 0);
    bar.querySelectorAll('.teh-filter-tag').forEach(btn => {
      btn.classList.toggle('teh-filter-tag-active', activeTagFilters.has(btn.textContent));
    });
  }

  function toggleTagFilter(tag) {
    if (activeTagFilters.has(tag)) {
      activeTagFilters.delete(tag);
    } else {
      activeTagFilters.add(tag);
    }
    applyActiveFilters();
    renderTagFilterBar();
  }

  function clearTagFilter() {
    activeTagFilters.clear();
    applyActiveFilters();
    renderTagFilterBar();
  }

  function getOrCreateEmptyMessage() {
    if (!wishlistEmptyMsg) {
      wishlistEmptyMsg = document.createElement('div');
      wishlistEmptyMsg.className = 'teh-wishlist-empty-filter-msg';
      wishlistEmptyMsg.textContent = '沒有符合篩選條件的書籍';
      wishlistEmptyMsg.style.display = 'none';
    }
    if (!wishlistEmptyMsg.isConnected) {
      const list = document.querySelector('ul.cart-list-item-list');
      if (list) list.after(wishlistEmptyMsg);
    }
    return wishlistEmptyMsg;
  }

  function applyActiveFilters() {
    if (window.location.hash !== '#wishlist') return;

    const emptyMsg = getOrCreateEmptyMessage();

    if (activeTagFilters.size === 0) {
      document.querySelectorAll('li.cart-list-item[data-teh-book-id]').forEach(item => {
        item.classList.remove('teh-filtered-out');
      });
      emptyMsg.style.display = 'none';
      return;
    }

    let visibleCount = 0;
    document.querySelectorAll('li.cart-list-item[data-teh-book-id]').forEach(item => {
      const tags = cachedLists.wishlistTags[item.dataset.tehBookId] || [];
      const matches = [...activeTagFilters].every(t => tags.includes(t));
      item.classList.toggle('teh-filtered-out', !matches);
      if (matches) visibleCount++;
    });

    emptyMsg.style.display = visibleCount === 0 ? 'block' : 'none';
  }

  function injectWishlistRemarks(refreshExisting = false) {
    if (!chrome.runtime?.id) return;
    if (window.location.hash !== '#wishlist') return;

    const items = document.querySelectorAll('li.cart-list-item');

    // Auto-cleanup: remove stored data for books no longer in the wishlist (once per hash change).
    // The wishlist page loads all items at once, so currentIds is complete when this runs.
    if (items.length > 0 && !wishlistCleanupDone) {
      wishlistCleanupDone = true;
      const currentIds = new Set();
      items.forEach(item => {
        const coverLink = item.querySelector('.item-cover-link');
        if (coverLink) {
          const m = coverLink.href.match(/\/book\/(\d+)/);
          if (m) currentIds.add(m[1]);
        }
      });

      const update = {};
      let changed = false;

      const newRemarks = { ...cachedLists.wishlistRemarks };
      Object.keys(newRemarks).forEach(id => {
        if (!currentIds.has(id)) { delete newRemarks[id]; changed = true; }
      });
      if (changed) update.wishlistRemarks = newRemarks;

      const newTags = { ...cachedLists.wishlistTags };
      let tagsChanged = false;
      const removedBookTags = [];
      Object.keys(newTags).forEach(id => {
        if (!currentIds.has(id)) {
          (newTags[id] || []).forEach(t => removedBookTags.push(t));
          delete newTags[id];
          tagsChanged = true;
        }
      });
      if (tagsChanged) { update.wishlistTags = newTags; changed = true; }

      // Promote orphaned tags from removed books to wishlistTagTemplates
      if (removedBookTags.length > 0) {
        const remainingPool = new Set(Object.values(newTags).flat());
        const templateSet = new Set(cachedLists.wishlistTagTemplates);
        let promoted = false;
        removedBookTags.forEach(tag => {
          if (!remainingPool.has(tag) && !templateSet.has(tag)) {
            templateSet.add(tag);
            promoted = true;
          }
        });
        if (promoted) {
          const sorted = [...templateSet].sort((a, b) => a.localeCompare(b, 'zh-TW'));
          update.wishlistTagTemplates = sorted;
          cachedLists.wishlistTagTemplates = sorted;
          changed = true;
        }
      }

      if (changed) chrome.storage.sync.set(update);
    }

    // Inject remark + tag UI into each wishlist item
    items.forEach(item => {
      const existingContainer = item.querySelector('.teh-wishlist-remark-container');
      if (existingContainer) {
        // Re-render display if called from a storage update and not in edit mode.
        // Handles the race where MutationObserver fired before initStorage/onChanged
        // populated the cache (e.g. cross-device sync, slow storage on first install).
        if (refreshExisting && !existingContainer.querySelector('textarea') && existingContainer._tehRender) {
          existingContainer._tehRender();
        }
        return;
      }

      const coverLink = item.querySelector('.item-cover-link');
      if (!coverLink) return;

      const m = coverLink.href.match(/\/book\/(\d+)/);
      if (!m) return;
      const bookId = m[1];
      item.dataset.tehBookId = bookId;

      const detailContent = item.querySelector('.item-detail-content');
      if (!detailContent) return;

      const container = document.createElement('div');
      container.className = 'teh-wishlist-remark-container';

      function renderDisplay() {
        container.innerHTML = '';

        const note = cachedLists.wishlistRemarks[bookId] || '';
        const tags = cachedLists.wishlistTags[bookId]    || [];

        const noteLabel = document.createElement('span');
        noteLabel.className = 'teh-wishlist-remark-label';
        noteLabel.textContent = '📝 備註:';

        const noteText = document.createElement('span');
        noteText.className = 'teh-wishlist-remark-text';
        noteText.textContent = note;

        container.appendChild(noteLabel);
        container.appendChild(noteText);

        if (tags.length > 0) {
          const tagsDiv = document.createElement('div');
          tagsDiv.className = 'teh-wishlist-tags-display';
          tags.forEach(tag => {
            const chip = document.createElement('span');
            chip.className = 'teh-wishlist-tag-chip';
            chip.textContent = tag;
            chip.addEventListener('click', e => e.stopPropagation());
            tagsDiv.appendChild(chip);
          });
          container.appendChild(tagsDiv);
        }
      }

      function renderEdit() {
        container.innerHTML = '';

        const editor = document.createElement('textarea');
        editor.className = 'teh-wishlist-remark-editor';
        editor.value = cachedLists.wishlistRemarks[bookId] || '';
        editor.placeholder = '備註 (選填)';

        const tagLabel = document.createElement('div');
        tagLabel.className = 'teh-remark-tag-label';
        tagLabel.textContent = '🏷️ 標籤:';

        const tagInput = createWishlistChipInput(cachedLists.wishlistTags[bookId] || []);

        const btnRow = document.createElement('div');
        btnRow.className = 'teh-wishlist-edit-actions';

        const saveBtn = document.createElement('button');
        saveBtn.className = 'teh-btn-save';
        saveBtn.textContent = '儲存';
        saveBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          saveWishlistData(bookId, editor.value, tagInput.getTags(), renderDisplay);
        });

        const cancelBtn = document.createElement('button');
        cancelBtn.className = 'teh-btn-cancel';
        cancelBtn.textContent = '取消';
        cancelBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          renderDisplay();
        });

        btnRow.appendChild(saveBtn);
        btnRow.appendChild(cancelBtn);
        container.appendChild(editor);
        container.appendChild(tagLabel);
        container.appendChild(tagInput);
        container.appendChild(btnRow);
        editor.focus();
      }

      container.addEventListener('click', () => {
        if (container.querySelector('textarea')) return; // already editing
        renderEdit();
      });

      container._tehRender = renderDisplay;
      renderDisplay();

      const contributorBox = detailContent.querySelector('.item-contributor-box') || detailContent.lastElementChild;
      contributorBox.after(container);

      const removeBtn = item.querySelector('.btn-remove');
      if (removeBtn && !removeBtn.dataset.tehObserved) {
        removeBtn.dataset.tehObserved = 'true';
        removeBtn.addEventListener('click', () => saveWishlistData(bookId, '', [], null, true));
      }
    });

    renderTagFilterBar();
    applyActiveFilters();
  }

  function injectPriceInfo() {
    try {
      if (!chrome.runtime?.id) return;
      if (typeof site.getPriceInfo !== 'function') return;
      const items = site.getPriceInfo(document);
      if (!items || !items.length) return;

      const costPerToken = 167;
      const maxPricePerToken = 250;

      items.forEach(info => {
        if (!info.container) return;
        if (info.container.querySelector('.teh-price-helper-container, .teh-best-price-hint')) return;

        const price = info.price;
        const pointsNeeded = Math.ceil(price / maxPricePerToken);
        const tokenCost = pointsNeeded * costPerToken;

        const options = [
          { id: 'd75',   label: '75折',  cost: Math.round(price * 0.75), display: `75折: ${Math.round(price * 0.75)}` },
          { id: 'd80',   label: '8折',   cost: Math.round(price * 0.80), display: `8折: ${Math.round(price * 0.80)}` },
          { id: 'm50',   label: '-50',   cost: Math.max(0, price - 50),  display: `-50: ${Math.max(0, price - 50)}` }
        ];

        if (info.isTokenApplicable !== false) {
          options.push({ id: 'token', label: `領書額度 ${pointsNeeded} 點`, cost: tokenCost, display: `領書額度 ${pointsNeeded} 點 ($${tokenCost})` });
        }

        const bestOption = options.reduce((prev, curr) => (prev.cost <= curr.cost ? prev : curr));

        // 列表卡片、待購清單（空間受限）：顯示純文字提示
        if (info.container.closest('.listItem-box') || info.container.closest('.cart-list-item')) {
          const hint = document.createElement('span');
          hint.className = 'teh-best-price-hint';
          hint.textContent = `↳ ${bestOption.display}`;
          info.container.appendChild(hint);
          return;
        }

        // 詳情頁：完整 dropdown widget
        const container = document.createElement('div');
        container.className = 'teh-price-helper-container';

        const button = document.createElement('button');
        button.className = 'teh-best-option-btn';
        button.innerHTML = `${bestOption.label} <span class="teh-arrow">▼</span>`;

        const dropdown = document.createElement('div');
        dropdown.className = 'teh-price-dropdown';
        const ul = document.createElement('ul');

        options.forEach(opt => {
          const li = document.createElement('li');
          li.textContent = opt.display;
          if (opt.id === bestOption.id) {
            li.classList.add('teh-is-best');
            li.textContent += ' (最佳)';
          }
          ul.appendChild(li);
        });

        dropdown.appendChild(ul);
        container.appendChild(button);
        container.appendChild(dropdown);

        button.addEventListener('click', (e) => {
          e.stopPropagation();
          const isActive = container.classList.contains('teh-active');
          document.querySelectorAll('.teh-price-helper-container').forEach(el => el.classList.remove('teh-active'));
          if (!isActive) container.classList.add('teh-active');
        });

        info.container.appendChild(container);
      });
    } catch (e) {
      console.error('[TEH] Price injection error:', e);
    }
  }

  document.addEventListener('click', () => {
    document.querySelectorAll('.teh-price-helper-container.teh-active').forEach(el => {
      el.classList.remove('teh-active');
    });
  });

  function checkLists() {
    try {
      if (!chrome.runtime?.id) return;
      if (!site.getBlacklistTargets) return;

      const targets = site.getBlacklistTargets(document);

      if (targets.global) {
        if (targets.global.publishers) {
          targets.global.publishers.forEach(el => {
            const text = Array.from(el.childNodes)
              .filter(n => n.nodeType === Node.TEXT_NODE)
              .map(n => n.textContent.trim())
              .join('').trim();
            applyStyles(el, text, 'publisher');
          });
        }
        if (targets.global.authors) {
          targets.global.authors.forEach(el => {
            const text = Array.from(el.childNodes)
              .filter(n => n.nodeType === Node.TEXT_NODE)
              .map(n => n.textContent.trim())
              .join('').trim();
            applyStyles(el, text, 'author');
          });
        }
      }

      if (targets.blocks) {
        targets.blocks.forEach(config => {
          const blocks = document.querySelectorAll(config.selector);
          blocks.forEach(block => {
            const els = config.elements(block);
            let isAnyBlacklisted = false;

            if (els.publishers) {
              els.publishers.forEach(el => {
                const text = el.innerText.trim();
                if (applyStyles(el, text, 'publisher')) isAnyBlacklisted = true;
              });
            }
            if (els.authors) {
              els.authors.forEach(el => {
                const text = el.innerText.trim();
                if (applyStyles(el, text, 'author')) isAnyBlacklisted = true;
              });
            }
            if (els.title) {
              if (isAnyBlacklisted) els.title.classList.add('teh-blacklisted-title');
              else els.title.classList.remove('teh-blacklisted-title');
            }
          });
        });
      }
    } catch (e) {}
  }

  function applyStyles(el, text, type) {
    if (!text) return false;

    if (cachedLists.black[type].includes(text)) {
      el.classList.add('teh-blacklisted-text');
      el.classList.remove('teh-whitelisted-text');
      return true;
    }

    el.classList.remove('teh-blacklisted-text');

    if (cachedLists.white[type].includes(text)) {
      el.classList.add('teh-whitelisted-text');
    } else {
      el.classList.remove('teh-whitelisted-text');
    }

    return false;
  }

  let timeout = null;
  let wishlistCleanupDone = false;
  let wishlistEmptyMsg = null;

  function injectBookDetailNote() {
    const m = window.location.pathname.match(/\/book\/(\d+)/);
    if (!m) return;
    const bookId = m[1];

    const remark = cachedLists.wishlistRemarks[bookId] || '';
    const tags = cachedLists.wishlistTags[bookId] || [];

    const infoText = document.querySelector('.book-info-text');
    if (!infoText) return;

    let noteDiv = infoText.querySelector('.teh-book-detail-note');
    const hash = remark + '|' + tags.join(',');

    if (!remark && tags.length === 0) {
      noteDiv?.remove();
      return;
    }

    if (noteDiv && noteDiv.dataset.tehHash === hash) return;

    if (!noteDiv) {
      noteDiv = document.createElement('div');
      noteDiv.className = 'teh-book-detail-note';
      infoText.appendChild(noteDiv);
    }

    noteDiv.dataset.tehHash = hash;
    noteDiv.innerHTML = '';

    const header = document.createElement('div');
    header.className = 'teh-book-detail-note-header';
    const label = document.createElement('span');
    label.textContent = '📝 待購備註';
    const editBtn = document.createElement('button');
    editBtn.className = 'teh-book-detail-note-edit';
    editBtn.textContent = '編輯';
    editBtn.addEventListener('click', (e) => {
      e.preventDefault();
      showRemarkPopover(editBtn, bookId);
    });
    header.appendChild(label);
    header.appendChild(editBtn);
    noteDiv.appendChild(header);

    if (remark) {
      const text = document.createElement('div');
      text.className = 'teh-book-detail-note-text';
      text.textContent = remark;
      noteDiv.appendChild(text);
    }

    if (tags.length > 0) {
      const tagsDiv = document.createElement('div');
      tagsDiv.className = 'teh-wishlist-tags-display';
      tags.forEach(tag => {
        const chip = document.createElement('span');
        chip.className = 'teh-wishlist-tag-chip';
        chip.textContent = tag;
        tagsDiv.appendChild(chip);
      });
      noteDiv.appendChild(tagsDiv);
    }
  }

  function run(refreshExisting = false) {
    injectPriceInfo();
    checkLists();
    handleBookPageWishlistButton();
    injectWishlistRemarks(refreshExisting);
    injectBookDetailNote();
  }

  initStorage();

  window.addEventListener('hashchange', () => {
    wishlistCleanupDone = false;
    activeTagFilters.clear();
    run();
  });

  const observer = new MutationObserver(() => {
    if (timeout) clearTimeout(timeout);
    timeout = setTimeout(run, 300);
  });
  observer.observe(document.body, { childList: true, subtree: true });
})();
