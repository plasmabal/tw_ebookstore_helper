(function() {
  const Sites = [
    {
      name: "Readmoo",
      detect: (host) => host === "readmoo.com",
      getPriceInfo: (doc) => {
        const priceBlocks = doc.querySelectorAll('.price');
        let ebookPrice = null;
        let container = null;
        let isSale = false;

        for (const el of priceBlocks) {
          if (el.innerText.includes('電子書特價')) {
            const priceElem = el.querySelector('strong[itemprop="price"]') || el.querySelector('strong');
            if (priceElem) {
              ebookPrice = parseInt(priceElem.innerText.replace(/[^\d]/g, ''), 10);
              container = el;
              isSale = true;
              break;
            }
          }
        }

        if (!ebookPrice) {
          for (const el of priceBlocks) {
            if (el.innerText.includes('電子書售價')) {
              if (el.querySelector('del')) continue;
              const priceElem = el.querySelector('strong[itemprop="price"]') || el.querySelector('strong');
              if (priceElem) {
                ebookPrice = parseInt(priceElem.innerText.replace(/[^\d]/g, ''), 10);
                container = el;
                break;
              }
            }
          }
        }

        if (!ebookPrice) return null;

        // 限時獨家優惠（不再適用其他優惠）不顯示折扣試算
        const isExclusive = Array.from(doc.querySelectorAll('.promotion-rule')).some(el => el.innerText.includes('不再適用其他優惠'));
        if (isExclusive) return null;

        // 偵測領書額度可用性
        const tokenBtn = Array.from(doc.querySelectorAll('button')).find(b => b.innerText.includes('領書額度兌換'));
        const isTokenApplicable = tokenBtn ? !tokenBtn.disabled : true;

        return { price: ebookPrice, isSale, container, isTokenApplicable };
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
      detect: (host) => host.includes("books.com.tw"),
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

  window.TEH = { findSite };
})();
