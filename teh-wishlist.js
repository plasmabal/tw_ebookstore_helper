window.TEH = window.TEH || {};

(function() {
  const state = window.TEH.state;

  function createWishlistChipInput(initialTags = []) {
    return window.TEH.createChipInput({
      classes: {
        wrapper:  'teh-tag-chip-input',
        chipsRow: 'teh-tag-chips-row',
        textInput: 'teh-tag-text-input',
        dropdown: 'teh-tag-autocomplete',
        chip:     'teh-tag-chip'
      },
      getSuggestions: (q, currentTags) => {
        const { wishlistTagPool, wishlistTagTemplates } = state.cachedLists;
        const allPoolTags = [...new Set([...wishlistTagPool, ...wishlistTagTemplates])];
        return allPoolTags.filter(t => t.toLowerCase().includes(q) && !currentTags.includes(t));
      },
      placeholder: '新增標籤…',
      maxSuggestions: 5,
      initialTags
    });
  }

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
    textarea.value = state.cachedLists.wishlistRemarks[bookId] || '';

    const tagLabel = document.createElement('div');
    tagLabel.className = 'teh-remark-tag-label';
    tagLabel.textContent = '🏷️ 標籤:';

    const tagInput = createWishlistChipInput(state.cachedLists.wishlistTags[bookId] || []);

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
      window.TEH.storage.saveWishlistData(bookId, textarea.value, tagInput.getTags());
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

    const pool = state.cachedLists.wishlistTagPool;

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
    if (clearBtn) clearBtn.classList.toggle('teh-filter-tag-active', state.activeTagFilters.size > 0);
    bar.querySelectorAll('.teh-filter-tag').forEach(btn => {
      btn.classList.toggle('teh-filter-tag-active', state.activeTagFilters.has(btn.textContent));
    });
  }

  function toggleTagFilter(tag) {
    if (state.activeTagFilters.has(tag)) {
      state.activeTagFilters.delete(tag);
    } else {
      state.activeTagFilters.add(tag);
    }
    applyActiveFilters();
    renderTagFilterBar();
  }

  function clearTagFilter() {
    state.activeTagFilters.clear();
    applyActiveFilters();
    renderTagFilterBar();
  }

  function getOrCreateEmptyMessage() {
    if (!state.wishlistEmptyMsg) {
      state.wishlistEmptyMsg = document.createElement('div');
      state.wishlistEmptyMsg.className = 'teh-wishlist-empty-filter-msg';
      state.wishlistEmptyMsg.textContent = '沒有符合篩選條件的書籍';
      state.wishlistEmptyMsg.style.display = 'none';
    }
    if (!state.wishlistEmptyMsg.isConnected) {
      const list = document.querySelector('ul.cart-list-item-list');
      if (list) list.after(state.wishlistEmptyMsg);
    }
    return state.wishlistEmptyMsg;
  }

  function applyActiveFilters() {
    if (window.location.hash !== '#wishlist') return;

    const emptyMsg = getOrCreateEmptyMessage();

    if (state.activeTagFilters.size === 0) {
      document.querySelectorAll('li.cart-list-item[data-teh-book-id]').forEach(item => {
        item.classList.remove('teh-filtered-out');
      });
      emptyMsg.style.display = 'none';
      return;
    }

    let visibleCount = 0;
    document.querySelectorAll('li.cart-list-item[data-teh-book-id]').forEach(item => {
      const tags = state.cachedLists.wishlistTags[item.dataset.tehBookId] || [];
      const matches = [...state.activeTagFilters].every(t => tags.includes(t));
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
    if (items.length > 0 && !state.wishlistCleanupDone) {
      state.wishlistCleanupDone = true;
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

      const newRemarks = { ...state.cachedLists.wishlistRemarks };
      Object.keys(newRemarks).forEach(id => {
        if (!currentIds.has(id)) { delete newRemarks[id]; changed = true; }
      });
      if (changed) update.wishlistRemarks = newRemarks;

      const newTags = { ...state.cachedLists.wishlistTags };
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
        const result = TEH_promoteOrphanTags(removedBookTags, newTags, state.cachedLists.wishlistTagTemplates);
        if (result.changed) {
          update.wishlistTagTemplates = result.templates;
          state.cachedLists.wishlistTagTemplates = result.templates;
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

        const note = state.cachedLists.wishlistRemarks[bookId] || '';
        const tags = state.cachedLists.wishlistTags[bookId]    || [];

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
        editor.value = state.cachedLists.wishlistRemarks[bookId] || '';
        editor.placeholder = '備註 (選填)';

        const tagLabel = document.createElement('div');
        tagLabel.className = 'teh-remark-tag-label';
        tagLabel.textContent = '🏷️ 標籤:';

        const tagInput = createWishlistChipInput(state.cachedLists.wishlistTags[bookId] || []);

        const btnRow = document.createElement('div');
        btnRow.className = 'teh-wishlist-edit-actions';

        const saveBtn = document.createElement('button');
        saveBtn.className = 'teh-btn-save';
        saveBtn.textContent = '儲存';
        saveBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          window.TEH.storage.saveWishlistData(bookId, editor.value, tagInput.getTags(), renderDisplay);
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
        if (container.querySelector('textarea')) return;
        renderEdit();
      });

      container._tehRender = renderDisplay;
      renderDisplay();

      const contributorBox = detailContent.querySelector('.item-contributor-box') || detailContent.lastElementChild;
      contributorBox.after(container);

      const removeBtn = item.querySelector('.btn-remove');
      if (removeBtn && !removeBtn.dataset.tehObserved) {
        removeBtn.dataset.tehObserved = 'true';
        removeBtn.addEventListener('click', () =>
          window.TEH.storage.saveWishlistData(bookId, '', [], null, true)
        );
      }
    });

    renderTagFilterBar();
    applyActiveFilters();
  }

  function injectBookDetailNote() {
    const m = window.location.pathname.match(/\/book\/(\d+)/);
    if (!m) return;
    const bookId = m[1];

    const remark = state.cachedLists.wishlistRemarks[bookId] || '';
    const tags   = state.cachedLists.wishlistTags[bookId]    || [];

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

  window.TEH.wishlist = {
    handleButton:     handleBookPageWishlistButton,
    inject:           injectWishlistRemarks,
    injectDetailNote: injectBookDetailNote
  };
})();
