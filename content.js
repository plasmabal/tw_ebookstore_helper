(function() {
  const site = window.TEH?.findSite();
  if (!site) return;

  let cachedLists = {
    black: { publisher: [], author: [] },
    white: { publisher: [], author: [] },
    wishlistRemarks: {}
  };

  // 初始化名單並監聽變動
  function initStorage() {
    if (!chrome.runtime?.id) return;

    chrome.storage.local.get([
      'publisherBlacklist', 'authorBlacklist',
      'publisherWhitelist', 'authorWhitelist',
      'wishlistRemarks'
    ], (res) => {
      if (chrome.runtime.lastError) return;
      updateCache(res);
      run(); // 初始執行
    });

    chrome.storage.onChanged.addListener((changes, namespace) => {
      if (namespace !== 'local') return;

      const res = {};
      let hasChanges = false;
      const validKeys = [
        'publisherBlacklist', 'authorBlacklist',
        'publisherWhitelist', 'authorWhitelist',
        'wishlistRemarks'
      ];

      validKeys.forEach(key => {
        if (changes[key]) {
          res[key] = changes[key].newValue;
          hasChanges = true;
        }
      });

      if (hasChanges) {
        updateCache(res);
        run();
      }
    });
  }

  function updateCache(res) {
    const migrate = (list) => {
      if (!list || list.length === 0) return [];
      if (typeof list[0] === 'string') return list.map(s => s.trim());
      return list.map(item => item.name.trim());
    };

    if ('publisherBlacklist' in res) cachedLists.black.publisher = migrate(res.publisherBlacklist);
    if ('authorBlacklist' in res) cachedLists.black.author = migrate(res.authorBlacklist);
    if ('publisherWhitelist' in res) cachedLists.white.publisher = migrate(res.publisherWhitelist);
    if ('authorWhitelist' in res) cachedLists.white.author = migrate(res.authorWhitelist);
    if ('wishlistRemarks' in res) cachedLists.wishlistRemarks = res.wishlistRemarks || {};
  }

  // --- 待購清單備註功能 ---

  function saveRemark(bookId, text) {
    if (!chrome.runtime?.id) return;

    chrome.storage.local.get('wishlistRemarks', (res) => {
      if (chrome.runtime?.lastError) return;
      const remarks = res.wishlistRemarks || {};
      const trimmedText = text ? text.trim() : "";

      if (trimmedText) {
        remarks[bookId] = trimmedText;
      } else {
        delete remarks[bookId];
      }
      chrome.storage.local.set({ wishlistRemarks: remarks });
    });
  }

  function handleBookPageWishlistButton() {
    // Readmoo 的按鈕 title 在不同狀態下可能會變，我們使用包含文字的選擇器
    const btn = document.querySelector('button[title*="待購清單"]');
    if (!btn || btn.dataset.tehObserved) return;

    btn.dataset.tehObserved = "true";
    btn.addEventListener('click', () => {
      // 優先從父容器取得 data-readmoo-id，否則從網址解析
      const container = btn.closest('#price-btn-container');
      let bookId = container ? container.dataset.readmooId : null;

      if (!bookId) {
        const bookIdMatch = window.location.pathname.match(/\/book\/(\d+)/);
        bookId = bookIdMatch ? bookIdMatch[1] : null;
      }

      if (!bookId) return;

      // 判斷當前狀態是否為「已加入」(即點擊後會移除)
      const isAlreadyInWishlist = btn.classList.contains('active') || btn.innerText.includes('已加入');

      if (isAlreadyInWishlist) {
        // 執行移除動作，清除備註
        saveRemark(bookId, "");
      } else {
        // 執行新增動作，顯示彈窗
        // 稍微等待 Readmoo 原生對話框跳出，但不進行二次條件檢查
        setTimeout(() => {
          showRemarkPopover(btn, bookId);
        }, 500);
      }
    });
  }

  function showRemarkPopover(targetEl, bookId) {
    if (document.querySelector('.teh-remark-popover')) return;

    const popover = document.createElement('div');
    popover.className = 'teh-remark-popover';

    // 定位在按鈕上方
    const rect = targetEl.getBoundingClientRect();
    popover.style.top = `${window.scrollY + rect.top - 140}px`;
    popover.style.left = `${window.scrollX + rect.left}px`;

    const textarea = document.createElement('textarea');
    textarea.placeholder = "輸入備註 (例如：為何想買這本書？)";
    textarea.value = cachedLists.wishlistRemarks[bookId] || "";

    const footer = document.createElement('div');
    footer.className = 'teh-remark-popover-footer';

    const cancelBtn = document.createElement('button');
    cancelBtn.className = 'teh-btn-cancel';
    cancelBtn.textContent = "取消";
    cancelBtn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      popover.remove();
    });

    const saveBtn = document.createElement('button');
    saveBtn.className = 'teh-btn-save';
    saveBtn.textContent = "儲存備註";
    saveBtn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      saveRemark(bookId, textarea.value);
      popover.remove();
    });

    footer.appendChild(cancelBtn);
    footer.appendChild(saveBtn);
    popover.appendChild(textarea);
    popover.appendChild(footer);
    document.body.appendChild(popover);

    textarea.focus();
  }

  function injectWishlistRemarks() {
    if (!chrome.runtime?.id) return;
    if (!window.location.hash.includes('#wishlist')) return;

    const items = document.querySelectorAll('li.cart-list-item');

    // --- 新增：自動清理已不在清單中的備註 ---
    if (items.length > 0) {
      const currentIds = new Set();
      items.forEach(item => {
        const coverLink = item.querySelector('.item-cover-link');
        if (coverLink) {
          const bookIdMatch = coverLink.href.match(/\/book\/(\d+)/);
          if (bookIdMatch) currentIds.add(bookIdMatch[1]);
        }
      });

      const remarks = cachedLists.wishlistRemarks;
      let hasChanged = false;
      const newRemarks = { ...remarks };

      Object.keys(remarks).forEach(id => {
        // 如果備註中的 ID 不在目前頁面上，代表書籍已被移除或購買
        if (!currentIds.has(id)) {
          delete newRemarks[id];
          hasChanged = true;
        }
      });

      if (hasChanged) {
        chrome.storage.local.set({ wishlistRemarks: newRemarks });
      }
    }

    // --- 原有的注入邏輯 ---
    items.forEach(item => {
      if (item.querySelector('.teh-wishlist-remark-container')) return;

      const coverLink = item.querySelector('.item-cover-link');
      if (!coverLink) return;

      const bookIdMatch = coverLink.href.match(/\/book\/(\d+)/);
      if (!bookIdMatch) return;
      const bookId = bookIdMatch[1];

      const detailContent = item.querySelector('.item-detail-content');
      if (!detailContent) return;

      const remarkContainer = document.createElement('div');
      remarkContainer.className = 'teh-wishlist-remark-container';

      const label = document.createElement('span');
      label.className = 'teh-wishlist-remark-label';
      label.textContent = "📝 備註:";

      const textSpan = document.createElement('span');
      textSpan.className = 'teh-wishlist-remark-text';
      textSpan.textContent = cachedLists.wishlistRemarks[bookId] || "";

      remarkContainer.appendChild(label);
      remarkContainer.appendChild(textSpan);

      // 點擊編輯
      remarkContainer.onclick = () => {
        if (remarkContainer.querySelector('textarea')) return;

        const originalText = textSpan.textContent;
        const editor = document.createElement('textarea');
        editor.className = 'teh-wishlist-remark-editor';
        editor.value = originalText;

        const oldContent = Array.from(remarkContainer.childNodes);
        remarkContainer.innerHTML = "";
        remarkContainer.appendChild(editor);
        editor.focus();

        const finishEdit = () => {
          const newText = editor.value.trim();
          saveRemark(bookId, newText);
          remarkContainer.innerHTML = "";
          textSpan.textContent = newText;
          remarkContainer.appendChild(label);
          remarkContainer.appendChild(textSpan);
        };

        editor.onblur = finishEdit;
        editor.onkeydown = (e) => {
          if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            editor.blur();
          }
          if (e.key === 'Escape') {
            remarkContainer.innerHTML = "";
            remarkContainer.appendChild(label);
            remarkContainer.appendChild(textSpan);
          }
        };
      };

      // 找到插入位置：通常在作者/出版社資訊下方
      const contributorBox = detailContent.querySelector('.item-contributor-box') || detailContent.lastElementChild;
      contributorBox.after(remarkContainer);

      // --- 新增：處理清單中的「移除」按鈕 ---
      const removeBtn = item.querySelector('.btn-remove');
      if (removeBtn && !removeBtn.dataset.tehObserved) {
        removeBtn.dataset.tehObserved = "true";
        removeBtn.addEventListener('click', () => {
          saveRemark(bookId, "");
        });
      }
    });
  }

  function injectPriceInfo() {
    try {
      if (!chrome.runtime?.id) return;
      const info = site.getPriceInfo(document);
      if (!info || !info.container) return;
      if (info.container.querySelector('.teh-price-helper-container')) return;

      const price = info.price;
      const costPerToken = 167;
      const maxPricePerToken = 250;
      const pointsNeeded = Math.ceil(price / maxPricePerToken);
      const tokenCost = pointsNeeded * costPerToken;

      // 定義所有折扣選項
      const options = [
        { id: 'd75', label: '75折', cost: Math.round(price * 0.75), display: `75折: ${Math.round(price * 0.75)}` },
        { id: 'd80', label: '8折', cost: Math.round(price * 0.80), display: `8折: ${Math.round(price * 0.80)}` },
        { id: 'm50', label: '-50', cost: Math.max(0, price - 50), display: `-50: ${Math.max(0, price - 50)}` }
      ];

      // 僅在適用時加入領書額度選項
      if (info.isTokenApplicable !== false) {
        options.push({ id: 'token', label: `領書額度 ${pointsNeeded} 點`, cost: tokenCost, display: `領書額度 ${pointsNeeded} 點` });
      }

      // 找出最划算的選項 (cost 最低者)
      const bestOption = options.reduce((prev, curr) => (prev.cost <= curr.cost ? prev : curr));

      // 建立組件
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

      // 點擊事件
      button.addEventListener('click', (e) => {
        e.stopPropagation();
        const isActive = container.classList.contains('teh-active');
        // 先關閉頁面上其他的選單
        document.querySelectorAll('.teh-price-helper-container').forEach(el => el.classList.remove('teh-active'));
        if (!isActive) {
          container.classList.add('teh-active');
        }
      });

      info.container.appendChild(container);
    } catch (e) {
      console.error("[TEH] Price injection error:", e);
    }
  }

  // 點擊外部關閉選單
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

      // 1. 處理頁面層級 (Global)
      if (targets.global) {
        if (targets.global.publishers) {
          targets.global.publishers.forEach(el => {
            const text = Array.from(el.childNodes)
              .filter(n => n.nodeType === Node.TEXT_NODE)
              .map(n => n.textContent.trim())
              .join("")
              .trim();

            applyStyles(el, text, 'publisher');
          });
        }

        if (targets.global.authors) {
          targets.global.authors.forEach(el => {
            const text = Array.from(el.childNodes)
              .filter(n => n.nodeType === Node.TEXT_NODE)
              .map(n => n.textContent.trim())
              .join("")
              .trim();

            applyStyles(el, text, 'author');
          });
        }
      }

      // 2. 處理區塊層級 (Blocks)
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
              if (isAnyBlacklisted) {
                els.title.classList.add('teh-blacklisted-title');
              } else {
                els.title.classList.remove('teh-blacklisted-title');
              }
            }
          });
        });
      }
    } catch (e) {}
  }

  // 回傳是否被列入黑名單 (統一使用容器標記法)
  function applyStyles(el, text, type) {
    if (!text) return false;

    // 優先檢查黑名單
    if (cachedLists.black[type].includes(text)) {
      el.classList.add('teh-blacklisted-text');
      el.classList.remove('teh-whitelisted-text');
      return true;
    }

    el.classList.remove('teh-blacklisted-text');

    // 檢查優良名單
    if (cachedLists.white[type].includes(text)) {
      el.classList.add('teh-whitelisted-text');
    } else {
      el.classList.remove('teh-whitelisted-text');
    }

    return false;
  }

  let timeout = null;
  function run() {
    injectPriceInfo();
    checkLists();
    handleBookPageWishlistButton();
    injectWishlistRemarks();
  }

  initStorage();

  window.addEventListener('hashchange', run);

  const observer = new MutationObserver(() => {
    if (timeout) clearTimeout(timeout);
    timeout = setTimeout(run, 300);
  });
  observer.observe(document.body, { childList: true, subtree: true });
})();
