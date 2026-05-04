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
      if (info.container.querySelector('.teh-helper-info')) return;

      const price = info.price;
      const discount75 = Math.round(price * 0.75);
      const costPerToken = 167;
      const maxPricePerToken = 250;
      const pointsNeeded = Math.ceil(price / maxPricePerToken);
      const tokenCost = pointsNeeded * costPerToken;

      const useToken = tokenCost < discount75;
      const helperSpan = document.createElement('span');
      helperSpan.className = 'teh-helper-info';

      const v75 = useToken ? "" : "✅ ";
      const vToken = useToken ? "✅ " : "";

      helperSpan.innerText = ` (${v75}75折: ${discount75} | ${vToken}領書 ${pointsNeeded} 點)`;
      info.container.appendChild(helperSpan);
    } catch (e) {}
  }

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
