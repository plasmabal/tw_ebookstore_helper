(function() {
  const site = window.TEH?.findSite();
  if (!site) return;

  function injectPriceInfo() {
    const info = site.getPriceInfo(document);
    if (!info || !info.container) return;

    // Check if we already injected
    if (info.container.querySelector('.teh-helper-info')) return;

    const price = info.price;
    const discount75 = Math.round(price * 0.75);
    
    // Token rules: 999/6 =~ 167 per point. 1 point for <= 250, 2 for <= 500
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

  // Run initially
  injectPriceInfo();

  // Watch for page changes (Readmoo uses SPA-like navigation in some parts)
  const observer = new MutationObserver(() => {
    injectPriceInfo();
  });
  observer.observe(document.body, { childList: true, subtree: true });
})();
