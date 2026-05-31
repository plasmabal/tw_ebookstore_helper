(function () {
  let observer = null;

  function enable() {
    window.dispatchEvent(new CustomEvent('__teh_enable'));
    startObserver();
  }

  function disable() {
    window.dispatchEvent(new CustomEvent('__teh_disable'));
    if (observer) { observer.disconnect(); observer = null; }
  }

  function startObserver() {
    if (observer) return;
    observer = new MutationObserver(dismissDialogs);
    observer.observe(document.documentElement, {
      childList: true, subtree: true, attributes: true, attributeFilter: ['class']
    });
    dismissDialogs();
  }

  function dismissDialogs() {
    const purchaseModal = document.querySelector('#preview-timer-modal.show');
    if (purchaseModal) {
      const btn = [...purchaseModal.querySelectorAll('button')]
        .find(b => b.textContent.trim() === '再等等');
      if (btn) btn.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
    }

    for (const modal of document.querySelectorAll('.modal.show')) {
      if (modal.textContent.includes('該讓眼睛休息一下囉')) {
        const btn = modal.querySelector('button');
        if (btn) btn.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
        break;
      }
    }
  }

  chrome.storage.local.get(['readmooAutoClosePreviewDialog'], (res) => {
    if (res.readmooAutoClosePreviewDialog) enable();
  });

  chrome.storage.onChanged.addListener((changes) => {
    if ('readmooAutoClosePreviewDialog' in changes) {
      if (changes.readmooAutoClosePreviewDialog.newValue) enable();
      else disable();
    }
  });
})();
