(function() {
  const Sites = [
    {
      name: "Readmoo",
      detect: (host) => host === "readmoo.com",
      getPriceInfo: (doc) => {
        // 限時獨家優惠（不再適用其他優惠）不顯示折扣試算
        const isExclusive = Array.from(doc.querySelectorAll('.promotion-rule')).some(el => el.innerText.includes('不再適用其他優惠'));
        if (isExclusive) return null;

        // 偵測領書額度可用性（列表頁無此按鈕，預設 true）
        const tokenBtn = Array.from(doc.querySelectorAll('button')).find(b => b.innerText.includes('領書額度兌換'));
        const isTokenApplicable = tokenBtn ? !tokenBtn.disabled : true;

        const results = [];

        // 一般價格區塊（書籍詳情頁、specialoffer 列表、活動頁延伸閱讀）
        for (const el of doc.querySelectorAll('.price')) {
          let ebookPrice = null;
          let isSale = false;
          const text = el.innerText;
          if (text.includes('電子書特價')) {
            const priceElem = el.querySelector('strong[itemprop="price"]') || el.querySelector('strong');
            if (priceElem) { ebookPrice = parseInt(priceElem.innerText.replace(/[^\d]/g, ''), 10); isSale = true; }
          } else if ((text.includes('電子書售價') || text.includes('電子書：')) && !el.querySelector('del')) {
            const priceElem = el.querySelector('strong[itemprop="price"]') || el.querySelector('strong');
            if (priceElem) { ebookPrice = parseInt(priceElem.innerText.replace(/[^\d]/g, ''), 10); }
          }
          if (ebookPrice) results.push({ price: ebookPrice, isSale, container: el, isTokenApplicable });
        }

        // 活動頁大張宣傳卡片（.panel-body 內的 DIV 含「電子書售價」文字節點，價格為純文字節點）
        for (const panel of doc.querySelectorAll('.panel-body')) {
          for (const div of panel.children) {
            if (div.tagName !== 'DIV') continue;
            const hasEbookText = [...div.childNodes].some(n => n.nodeType === 3 && n.textContent.includes('電子書售價'));
            if (!hasEbookText) continue;
            const priceText = [...div.childNodes]
              .filter(n => n.nodeType === 3)
              .map(n => n.textContent.trim())
              .find(t => /^\d+$/.test(t));
            const ebookPrice = priceText ? parseInt(priceText, 10) : null;
            if (ebookPrice) results.push({ price: ebookPrice, isSale: true, container: div, isTokenApplicable });
          }
        }

        // 待購清單頁（/checkout/cart#wishlist）
        if (window.location.hash === '#wishlist') {
          for (const li of doc.querySelectorAll('li.cart-list-item')) {
            if ([...li.querySelectorAll('span.text-attention')].some(s => s.textContent.includes('停止銷售'))) continue;
            const priceEl = li.querySelector('.item-price');
            if (!priceEl) continue;
            const match = (priceEl.getAttribute('aria-label') || '').match(/單價(\d+)元/);
            const ebookPrice = match ? parseInt(match[1], 10) : parseInt(priceEl.textContent.replace(/[^\d]/g, ''), 10);
            if (!ebookPrice) continue;
            const container = li.querySelector('.item-price-box__main');
            if (container) results.push({ price: ebookPrice, isSale: !!li.querySelector('.badge.bg-notice'), container, isTokenApplicable });
          }
        }

        return results.length ? results : null;
      },
      getBlacklistTargets: (doc) => {
        const path = window.location.pathname;

        // 詳情頁模式 (URL 包含 /book/)
        if (path.match(/\/book\/\d+/)) {
          return {
            blocks: [
              {
                selector: '.book-detail-info',
                elements: (b) => ({
                  publishers: Array.from(b.querySelectorAll('a[href*="/publisher/"], .book-meta-published a[itemprop="name"]')),
                  authors: Array.from(b.querySelectorAll('.contributors-list-item a[itemprop="name"]')),
                  title: b.querySelector('h1')
                })
              }
            ]
          };
        }

        // 作者頁模式 (URL 包含 /contributor/)
        if (path.match(/\/contributor\/\d+/)) {
          return {
            global: {
              authors: Array.from(doc.querySelectorAll('h1'))
            },
            blocks: [
              {
                selector: '.listItem-box, .gridItem-box, .rm-ct-listItem .listItem-box',
                elements: (b) => ({
                  publishers: Array.from(b.querySelectorAll('.publisher-info a, a[href*="/publisher/"]')),
                  authors: Array.from(b.querySelectorAll('.contributor-info a, .author a, a[href*="/contributor/"]')),
                  title: b.querySelector('h4 a, .title a, [itemprop="name"]')
                })
              }
            ]
          };
        }

        // 出版社頁模式 (URL 包含 /publisher/)
        if (path.match(/\/publisher\/\d+/)) {
          return {
            global: {
              // 廣泛抓取標題，確保出版社大標題能被打叉
              publishers: Array.from(doc.querySelectorAll('h1.publisher-name, .publisher-name, .publisher-header h1, h1'))
            },
            blocks: [
              {
                selector: '.listItem-box, .rm-ct-listItem .listItem-box',
                elements: (b) => ({
                  publishers: Array.from(b.querySelectorAll('.publisher-info a, a[href*="/publisher/"]')),
                  authors: Array.from(b.querySelectorAll('.contributor-info a, .author a, a[href*="/contributor/"]')),
                  title: b.querySelector('h4 a, .title a, [itemprop="name"]')
                })
              }
            ]
          };
        }

        // 首頁與其他列表頁
        return {
          blocks: [
            {
              selector: '.listItem-box, .collection-slide .listItem-box',
              elements: (b) => ({
                publishers: Array.from(b.querySelectorAll('.publisher-info a, a[href*="/publisher/"]')),
                authors: Array.from(b.querySelectorAll('.contributor-info a, .author a, a[href*="/contributor/"], .author a')),
                title: b.querySelector('h4 a, .title a, .caption h4 a, [itemprop="name"]')
              })
            }
          ]
        };
      }
    },
    {
      name: "Books.com.tw",
      detect: (host) => host === "books.com.tw" || host.endsWith(".books.com.tw"),
      getBlacklistTargets: (doc) => {
        const path = window.location.pathname;

        // 商品詳情頁
        if (path.includes('/products/')) {
          return {
            blocks: [
              {
                selector: '.type02_p01_wrap',
                elements: (b) => ({
                  publishers: Array.from(b.querySelectorAll('a[href*="?pubid="]')),
                  authors: Array.from(b.querySelectorAll('a[href*="adv_author/1"]')),
                  title: b.querySelector('h1')
                })
              }
            ]
          };
        }

        // 列表頁、搜尋頁 (search.books.com.tw)
        return {
          blocks: [
            {
              selector: '.table-td',
              elements: (b) => ({
                publishers: Array.from(b.querySelectorAll('a[href*="?pubid="]')),
                authors: Array.from(b.querySelectorAll('a[href*="adv_author/1"]')),
                title: b.querySelector('h4 a')
              })
            }
          ]
        };
      }
    },
    {
      name: "Kobo",
      detect: (host) => host === "kobo.com",
      getBlacklistTargets: (doc) => {
        const path = window.location.pathname;

        // 書籍詳情頁
        if (path.includes('/ebook/')) {
          return {
            blocks: [
              {
                selector: '.primary-left-container',
                elements: (b) => ({
                  publishers: [],
                  authors: Array.from(b.querySelectorAll('.visible-contributors a.contributor-name')),
                  title: b.querySelector('h1.title')
                })
              }
            ]
          };
        }

        // 搜尋頁與列表頁
        return {
          blocks: [
            {
              selector: '[data-ratunit="item"]',
              elements: (b) => ({
                publishers: [],
                authors: Array.from(b.querySelectorAll('[data-testid="authors"] a[data-testid="book-attribute-link"]')),
                title: b.querySelector('a[data-testid="title"]')
              })
            }
          ]
        };
      }
    }
  ];

  function findSite() {
    const host = location.host.replace(/^www\./, '');
    return Sites.find(s => s.detect(host));
  }

  // 與其他模組一致採合併寫法，避免依賴 manifest 載入順序
  window.TEH = window.TEH || {};
  window.TEH.findSite = findSite;
})();
