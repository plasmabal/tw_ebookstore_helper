(function() {
  const site = window.TEH?.findSite();
  if (!site) return;

  let cachedBlacklist = { publisher: [], author: [] };

  // 初始化名單並監聽變動
  function initStorage() {
    chrome.storage.local.get(['publisherBlacklist', 'authorBlacklist'], (res) => {
      if (chrome.runtime.lastError) return;
      updateCache(res);
      run(); // 初始執行
    });

    chrome.storage.onChanged.addListener((changes) => {
      chrome.storage.local.get(['publisherBlacklist', 'authorBlacklist'], (res) => {
        updateCache(res);
        run();
      });
    });
  }

  function updateCache(res) {
    cachedBlacklist.publisher = (res.publisherBlacklist || []).map(s => s.trim());
    cachedBlacklist.author = (res.authorBlacklist || []).map(s => s.trim());
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

  function checkBlacklist() {
    try {
      if (!chrome.runtime?.id) return;
      if (!site.getBlacklistTargets) return;

      const pubBlacklist = cachedBlacklist.publisher;
      const authorBlacklist = cachedBlacklist.author;
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

            if (text && pubBlacklist.includes(text)) {
              el.classList.add('teh-blacklisted-text');
            } else {
              el.classList.remove('teh-blacklisted-text');
            }
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
                if (text && pubBlacklist.includes(text)) {
                  el.classList.add('teh-blacklisted-text');
                  isAnyBlacklisted = true;
                } else {
                  el.classList.remove('teh-blacklisted-text');
                }
              });
            }

            if (els.authors) {
              els.authors.forEach(el => {
                const text = el.innerText.trim();
                if (text && authorBlacklist.includes(text)) {
                  el.classList.add('teh-blacklisted-text');
                  isAnyBlacklisted = true;
                } else {
                  el.classList.remove('teh-blacklisted-text');
                }
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

  let timeout = null;
  function run() {
    injectPriceInfo();
    checkBlacklist();
  }

  // 啟動流程
  initStorage();

  const observer = new MutationObserver(() => {
    if (timeout) clearTimeout(timeout);
    timeout = setTimeout(run, 300);
  });
  observer.observe(document.body, { childList: true, subtree: true });
})();
