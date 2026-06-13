// Pure functions — no IIFE-scoped state; can be required in Node.js for unit testing.

function TEH_promoteOrphanTags(removedTags, remainingTagsMap, templates) {
  if (!removedTags.length) return { templates, changed: false };
  const remainingPool = new Set(Object.values(remainingTagsMap).flat());
  const templateSet = new Set(templates);
  let promoted = false;
  removedTags.forEach(tag => {
    if (!remainingPool.has(tag) && !templateSet.has(tag)) {
      templateSet.add(tag);
      promoted = true;
    }
  });
  if (!promoted) return { templates, changed: false };
  return {
    templates: [...templateSet].sort((a, b) => a.localeCompare(b, 'zh-TW')),
    changed: true
  };
}

function TEH_extractDirectText(el) {
  return Array.from(el.childNodes)
    .filter(n => n.nodeType === 3 /* TEXT_NODE */)
    .map(n => n.textContent.trim())
    .join('').trim();
}

// 回傳 sorted options 與 bestOption（常數不動，僅封裝計算邏輯供測試）
function TEH_computePriceOptions(price, isTokenApplicable) {
  const costPerToken = 167;
  const maxPricePerToken = 250;
  const pointsNeeded = Math.ceil(price / maxPricePerToken);
  const tokenCost = pointsNeeded * costPerToken;
  const options = [
    { id: 'd75',   label: '75折',  cost: Math.round(price * 0.75), display: `75折: ${Math.round(price * 0.75)}` },
    { id: 'd80',   label: '8折',   cost: Math.round(price * 0.80), display: `8折: ${Math.round(price * 0.80)}` },
    { id: 'm50',   label: '-50',   cost: Math.max(0, price - 50),  display: `-50: ${Math.max(0, price - 50)}` }
  ];
  if (isTokenApplicable !== false) {
    options.push({ id: 'token', label: `領書額度 ${pointsNeeded} 點`, cost: tokenCost, display: `領書額度 ${pointsNeeded} 點 ($${tokenCost})` });
  }
  const bestOption = options.reduce((prev, curr) => (prev.cost <= curr.cost ? prev : curr));
  return { options, bestOption };
}

if (typeof module !== 'undefined') {
  module.exports = { TEH_promoteOrphanTags, TEH_extractDirectText, TEH_computePriceOptions };
}

// ─── Content Script Orchestrator ─────────────────────────────────────────────

if (typeof window !== 'undefined') (function() {
  const site = window.TEH?.findSite();
  if (!site) return;

  let timeout = null;

  function run(refreshExisting = false) {
    window.TEH.price.inject(site);
    window.TEH.blacklist.check(site);
    window.TEH.wishlist.handleButton();
    window.TEH.wishlist.inject(refreshExisting);
    window.TEH.wishlist.injectDetailNote();
  }

  window.TEH.storage.initStorage(run);

  window.addEventListener('hashchange', () => {
    window.TEH.state.wishlistCleanupDone = false;
    window.TEH.state.activeTagFilters.clear();
    run();
  });

  const observer = new MutationObserver(() => {
    if (timeout) clearTimeout(timeout);
    timeout = setTimeout(run, 300);
  });
  observer.observe(document.body, { childList: true, subtree: true });
})();
