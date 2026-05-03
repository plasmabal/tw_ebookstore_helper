(function() {
  const Sites = [
    {
      name: "Readmoo",
      detect: (host) => host === "readmoo.com",
      getPriceInfo: (doc) => {
        // Find all price blocks
        const priceBlocks = doc.querySelectorAll('.price');
        let ebookPrice = null;
        let container = null;
        let isSale = false;

        // 1. Try to find 電子書特價 first (the one the user actually pays)
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

        // 2. If no特價, look for 電子書售價
        if (!ebookPrice) {
          for (const el of priceBlocks) {
            if (el.innerText.includes('電子書售價')) {
              // If there's a <del> inside, it's not the final price (there should be a 特價 somewhere)
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

        return {
          price: ebookPrice,
          isSale,
          container
        };
      },
      getBlacklistTargets: (doc) => {
        const metadata = doc.querySelector('.book-metadata') || doc.querySelector('.book-info');
        return {
          publishers: Array.from(doc.querySelectorAll('a[href*="/search/publisher/"], a[href*="/publisher/"], [itemprop="publisher"] a')),
          authors: Array.from(doc.querySelectorAll('a[href*="/search/contributor/"], a[href*="/contributor/"], [itemprop="author"] a')),
          title: doc.querySelector('h1[itemprop="name"]') || doc.querySelector('.book-title')
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
