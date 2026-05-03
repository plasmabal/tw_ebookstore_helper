(function() {
  const site = window.TEH?.findSite();
  if (!site) return;

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

      chrome.storage.local.get(['publisherBlacklist', 'authorBlacklist'], (res) => {
        if (chrome.runtime.lastError) return;

        const pubBlacklist = (res.publisherBlacklist || []).map(s => s.trim());
        const authorBlacklist = (res.authorBlacklist || []).map(s => s.trim());
        const targets = site.getBlacklistTargets(document);

        // 1. 處理頁面層級 (Global) - 針對出版社大標題等
        if (targets.global) {
          if (targets.global.publishers) {
            targets.global.publishers.forEach(el => {
              if (el.classList.contains('teh-blacklisted-text')) return;
              // 策略：只抓取直接屬於此標籤的純文字節點，避開內嵌的 span (關注按鈕)
              const text = Array.from(el.childNodes)
                .filter(n => n.nodeType === Node.TEXT_NODE)
                .map(n => n.textContent.trim())
                .join("")
                .trim();
              if (text && pubBlacklist.includes(text)) el.classList.add('teh-blacklisted-text');
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
                  }
                });
              }

              if (els.authors) {
                els.authors.forEach(el => {
                  const text = el.innerText.trim();
                  if (text && authorBlacklist.includes(text)) {
                    el.classList.add('teh-blacklisted-text');
                    isAnyBlacklisted = true;
                  }
                });
              }

              if (isAnyBlacklisted && els.title && !els.title.classList.contains('teh-blacklisted-title')) {
                els.title.classList.add('teh-blacklisted-title');
              }
            });
          });
        }
      });
    } catch (e) {}
  }

  let timeout = null;
  function run() {
    injectPriceInfo();
    checkBlacklist();
  }

  run();

  const observer = new MutationObserver(() => {
    if (timeout) clearTimeout(timeout);
    timeout = setTimeout(run, 300);
  });
  observer.observe(document.body, { childList: true, subtree: true });
})();
