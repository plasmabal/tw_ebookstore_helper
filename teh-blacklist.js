window.TEH = window.TEH || {};

(function() {
  const state = window.TEH.state;

  function applyStyles(el, text, type) {
    if (!text) return false;
    const { cachedLists } = state;
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

  function checkLists(site) {
    try {
      if (!chrome.runtime?.id) return;
      if (!site.getBlacklistTargets) return;

      const targets = site.getBlacklistTargets(document);

      if (targets.global) {
        if (targets.global.publishers) {
          targets.global.publishers.forEach(el => applyStyles(el, window.TEH.logic.extractDirectText(el), 'publisher'));
        }
        if (targets.global.authors) {
          targets.global.authors.forEach(el => applyStyles(el, window.TEH.logic.extractDirectText(el), 'author'));
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
            if (isAnyBlacklisted) block.classList.add('teh-blacklisted-block');
            else block.classList.remove('teh-blacklisted-block');
          });
        });
      }
    } catch (e) {
      console.error('[TEH] checkLists error:', e);
    }
  }

  window.TEH.blacklist = { check: checkLists };
})();
