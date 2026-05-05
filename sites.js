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
        return { price: ebookPrice, isSale, container };
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
    }
  ];

  function findSite() {
    const host = location.host.replace(/^www\./, '');
    return Sites.find(s => s.detect(host));
  }

  window.TEH = { findSite };
})();
