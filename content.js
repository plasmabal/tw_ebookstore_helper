(function() {
  const site = window.TEH?.findSite();
  if (!site) return;

  let cachedLists = {
    black: { publisher: [], author: [] },
    white: { publisher: [], author: [] }
  };

  // 初始化名單並監聽變動
  function initStorage() {
    chrome.storage.local.get([
      'publisherBlacklist', 'authorBlacklist',
      'publisherWhitelist', 'authorWhitelist'
    ], (res) => {
      if (chrome.runtime.lastError) return;
      updateCache(res);
      run(); // 初始執行
    });

    chrome.storage.onChanged.addListener(() => {
      chrome.storage.local.get([
        'publisherBlacklist', 'authorBlacklist',
        'publisherWhitelist', 'authorWhitelist'
      ], (res) => {
        updateCache(res);
        run();
      });
    });
  }

  function updateCache(res) {
    const migrate = (list) => {
      if (!list || list.length === 0) return [];
      if (typeof list[0] === 'string') return list.map(s => s.trim());
      return list.map(item => item.name.trim());
    };

    cachedLists.black.publisher = migrate(res.publisherBlacklist);
    cachedLists.black.author = migrate(res.authorBlacklist);
    cachedLists.white.publisher = migrate(res.publisherWhitelist);
    cachedLists.white.author = migrate(res.authorWhitelist);
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
        { id: 'm50', label: '-50', cost: Math.max(0, price - 50), display: `-50: ${Math.max(0, price - 50)}` },
        { id: 'token', label: `領書額度 ${pointsNeeded} 點`, cost: tokenCost, display: `領書額度 ${pointsNeeded} 點` }
      ];

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
  }

  initStorage();

  const observer = new MutationObserver(() => {
    if (timeout) clearTimeout(timeout);
    timeout = setTimeout(run, 300);
  });
  observer.observe(document.body, { childList: true, subtree: true });
})();
