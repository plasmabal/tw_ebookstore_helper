(function() {
  const site = window.TEH?.findSite();
  if (!site) return;

  function injectPriceInfo() {
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
  }

  function checkBlacklist() {
    if (!site.getBlacklistTargets) return;

    chrome.storage.local.get(['publisherBlacklist', 'authorBlacklist'], (res) => {
      const pubBlacklist = (res.publisherBlacklist || []).map(s => s.trim());
      const authorBlacklist = (res.authorBlacklist || []).map(s => s.trim());
      const targets = site.getBlacklistTargets(document);

      let isAnyBlacklisted = false;

      // Check Publishers
      targets.publishers.forEach(el => {
        const text = el.innerText.trim();
        if (text && pubBlacklist.includes(text)) {
          el.classList.add('teh-blacklisted-text');
          isAnyBlacklisted = true;
        }
      });

      // Check Authors
      targets.authors.forEach(el => {
        const text = el.innerText.trim();
        if (text && authorBlacklist.includes(text)) {
          el.classList.add('teh-blacklisted-text');
          isAnyBlacklisted = true;
        }
      });

      // If any match, dim the title
      if (isAnyBlacklisted && targets.title) {
        targets.title.classList.add('teh-blacklisted-title');
      }
    });
  }

  function run() {
    injectPriceInfo();
    checkBlacklist();
  }

  // Run initially
  run();

  // Watch for page changes
  const observer = new MutationObserver(() => {
    run();
  });
  observer.observe(document.body, { childList: true, subtree: true });
})();
