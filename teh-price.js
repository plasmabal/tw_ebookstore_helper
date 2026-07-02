window.TEH = window.TEH || {};

(function() {
  function injectPriceInfo(site) {
    try {
      if (!chrome.runtime?.id) return;
      if (typeof site.getPriceInfo !== 'function') return;
      const items = site.getPriceInfo(document);
      if (!items || !items.length) return;

      items.forEach(info => {
        if (!info.container) return;
        if (info.container.querySelector('.teh-price-helper-container, .teh-best-price-hint')) return;

        const { options, bestOption } = window.TEH.logic.computePriceOptions(info.price, info.isTokenApplicable);

        // 列表卡片、待購清單（空間受限）：顯示純文字提示
        if (info.container.closest('.listItem-box') || info.container.closest('.cart-list-item')) {
          const hint = document.createElement('span');
          hint.className = 'teh-best-price-hint';
          hint.textContent = `↳ ${bestOption.display}`;
          info.container.appendChild(hint);
          return;
        }

        // 詳情頁：完整 dropdown widget
        const container = document.createElement('div');
        container.className = 'teh-price-helper-container';

        const button = document.createElement('button');
        button.className = 'teh-best-option-btn';
        button.textContent = `${bestOption.label} `;
        const arrow = document.createElement('span');
        arrow.className = 'teh-arrow';
        arrow.textContent = '▼';
        button.appendChild(arrow);

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

        button.addEventListener('click', (e) => {
          e.stopPropagation();
          const isActive = container.classList.contains('teh-active');
          document.querySelectorAll('.teh-price-helper-container').forEach(el => el.classList.remove('teh-active'));
          if (!isActive) container.classList.add('teh-active');
        });

        info.container.appendChild(container);
      });
    } catch (e) {
      console.error('[TEH] Price injection error:', e);
    }
  }

  document.addEventListener('click', () => {
    document.querySelectorAll('.teh-price-helper-container.teh-active').forEach(el => {
      el.classList.remove('teh-active');
    });
  });

  window.TEH.price = { inject: injectPriceInfo };
})();
