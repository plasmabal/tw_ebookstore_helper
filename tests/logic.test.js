/**
 * 純邏輯單元測試（無 Puppeteer、無瀏覽器）
 * 測試對象：content.js 匯出的 pure function
 */
const {
  TEH_promoteOrphanTags,
  TEH_extractDirectText,
  TEH_computePriceOptions
} = require('../content.js');

// ─── promoteOrphanTags ────────────────────────────────────────────────────────

describe('TEH_promoteOrphanTags', () => {
  test('空 removedTags → 回傳 changed: false，templates 不變', () => {
    const result = TEH_promoteOrphanTags([], { '1': ['奇幻'] }, ['舊標籤']);
    expect(result.changed).toBe(false);
    expect(result.templates).toEqual(['舊標籤']);
  });

  test('孤兒 tag（不在剩餘 pool 也不在 templates）應被升格並 changed: true', () => {
    const result = TEH_promoteOrphanTags(['孤兒'], {}, []);
    expect(result.changed).toBe(true);
    expect(result.templates).toContain('孤兒');
  });

  test('tag 仍在剩餘 pool → 不升格，changed: false', () => {
    const result = TEH_promoteOrphanTags(['奇幻'], { '2': ['奇幻'] }, []);
    expect(result.changed).toBe(false);
    expect(result.templates).not.toContain('奇幻');
  });

  test('tag 已在 templates → 不重複，changed: false', () => {
    const result = TEH_promoteOrphanTags(['已有'], {}, ['已有']);
    expect(result.changed).toBe(false);
  });

  test('升格後 templates 按 zh-TW 排序', () => {
    const result = TEH_promoteOrphanTags(['輕小說', '奇幻'], {}, []);
    expect(result.changed).toBe(true);
    const sorted = [...result.templates].sort((a, b) => a.localeCompare(b, 'zh-TW'));
    expect(result.templates).toEqual(sorted);
  });

  test('部分孤兒、部分仍有使用 → 只升格真正孤兒', () => {
    const result = TEH_promoteOrphanTags(['孤兒', '仍用'], { '1': ['仍用'] }, []);
    expect(result.changed).toBe(true);
    expect(result.templates).toContain('孤兒');
    expect(result.templates).not.toContain('仍用');
  });
});

// ─── extractDirectText ────────────────────────────────────────────────────────

describe('TEH_extractDirectText', () => {
  // 在 Node.js 沒有 DOM，用最小化 mock 模擬 element
  function makeEl(childNodes) {
    return {
      childNodes: {
        [Symbol.iterator]() { return childNodes[Symbol.iterator](); }
      }
    };
  }
  const TEXT_NODE = 3;

  test('只有 text node → trim 後回傳', () => {
    const el = { childNodes: [{ nodeType: TEXT_NODE, textContent: '  奇幻  ' }] };
    expect(TEH_extractDirectText(el)).toBe('奇幻');
  });

  test('多個 text node 合併', () => {
    const el = { childNodes: [
      { nodeType: TEXT_NODE, textContent: 'A' },
      { nodeType: TEXT_NODE, textContent: 'B' }
    ]};
    expect(TEH_extractDirectText(el)).toBe('AB');
  });

  test('非 text node 被過濾', () => {
    const el = { childNodes: [
      { nodeType: 1, textContent: 'ignore' },
      { nodeType: TEXT_NODE, textContent: '保留' }
    ]};
    expect(TEH_extractDirectText(el)).toBe('保留');
  });

  test('無 text node → 回傳空字串', () => {
    const el = { childNodes: [{ nodeType: 1, textContent: 'x' }] };
    expect(TEH_extractDirectText(el)).toBe('');
  });
});

// ─── computePriceOptions ──────────────────────────────────────────────────────

describe('TEH_computePriceOptions', () => {
  test('NT$299：75折=224, 8折=239, -50=249, token(2點)=334 → best 75折', () => {
    const { bestOption, options } = TEH_computePriceOptions(299, true);
    expect(options.find(o => o.id === 'd75').cost).toBe(224);
    expect(options.find(o => o.id === 'd80').cost).toBe(239);
    expect(options.find(o => o.id === 'm50').cost).toBe(249);
    expect(options.find(o => o.id === 'token').cost).toBe(334);
    expect(bestOption.id).toBe('d75');
  });

  test('NT$150：75折=113, 8折=120, -50=100, token(1點)=167 → best -50', () => {
    const { bestOption } = TEH_computePriceOptions(150, true);
    expect(bestOption.id).toBe('m50');
    expect(bestOption.cost).toBe(100);
  });

  test('NT$40：-50 最低不低於 0', () => {
    const { options } = TEH_computePriceOptions(40, true);
    expect(options.find(o => o.id === 'm50').cost).toBe(0);
  });

  test('isTokenApplicable=false → options 不含 token', () => {
    const { options } = TEH_computePriceOptions(299, false);
    expect(options.find(o => o.id === 'token')).toBeUndefined();
  });

  test('isTokenApplicable=undefined → 視為適用（預設行為）', () => {
    const { options } = TEH_computePriceOptions(299, undefined);
    expect(options.find(o => o.id === 'token')).toBeDefined();
  });

  test('bestOption 與 wishlist.test.js 的 WISHLIST_PRICE_OPTIONS 公式一致', () => {
    // wishlist.test.js 使用同樣的常數（167/250），驗證兩邊公式對齊
    const prices = [80, 150, 299, 450, 800];
    prices.forEach(price => {
      const { bestOption } = TEH_computePriceOptions(price, true);
      const legacyOptions = [
        { id: 'd75', cost: Math.round(price * 0.75) },
        { id: 'd80', cost: Math.round(price * 0.80) },
        { id: 'm50', cost: Math.max(0, price - 50) },
        { id: 'tok', cost: Math.ceil(price / 250) * 167 }
      ];
      const legacyBest = legacyOptions.reduce((a, b) => a.cost <= b.cost ? a : b);
      expect(bestOption.cost).toBe(legacyBest.cost);
    });
  });
});
