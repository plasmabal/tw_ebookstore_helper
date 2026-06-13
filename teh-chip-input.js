/**
 * 共用 chip input 工廠，掛於 window.TEH.createChipInput。
 * content.js 與 management.js 兩端各自提供 classes 對照表與 getSuggestions，
 * 確保產生的 class 名稱與現有 content.css / management.css 完全一致。
 *
 * 參數：
 *   classes         — class 對照表 { wrapper, chipsRow, textInput, dropdown, chip,
 *                                   chipRemove?, ariaRemoveLabel? }
 *   getSuggestions  — (query: string, currentTags: string[]) => string[]
 *   placeholder     — input placeholder 文字
 *   maxSuggestions  — 最多顯示幾筆建議（預設 5）
 *   initialTags     — 初始標籤陣列
 *
 * 回傳 wrapper DOM element，附有：
 *   wrapper.getTags()  → 目前標籤陣列（複本）
 *   wrapper.reset()    → 清空所有標籤與 input
 */
window.TEH = window.TEH || {};

window.TEH.createChipInput = function({
  classes,
  getSuggestions,
  placeholder = '新增標籤…',
  maxSuggestions = 5,
  initialTags = []
}) {
  const tags = [...initialTags];

  const wrapper = document.createElement('div');
  wrapper.className = classes.wrapper;

  const chipsRow = document.createElement('div');
  chipsRow.className = classes.chipsRow;

  const textInput = document.createElement('input');
  textInput.type = 'text';
  textInput.className = classes.textInput;
  textInput.placeholder = placeholder;
  textInput.maxLength = 20;

  const dropdown = document.createElement('ul');
  dropdown.className = classes.dropdown;
  dropdown.style.display = 'none';

  function renderChips() {
    chipsRow.innerHTML = '';
    tags.forEach((tag, i) => {
      const chip = document.createElement('span');
      chip.className = classes.chip;

      const label = document.createElement('span');
      label.textContent = tag;

      const removeBtn = document.createElement('button');
      removeBtn.type = 'button';
      removeBtn.textContent = '×';
      if (classes.chipRemove) removeBtn.className = classes.chipRemove;
      if (classes.ariaRemoveLabel) removeBtn.setAttribute('aria-label', classes.ariaRemoveLabel(tag));
      removeBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        tags.splice(i, 1);
        renderChips();
      });

      chip.appendChild(label);
      chip.appendChild(removeBtn);
      chipsRow.appendChild(chip);
    });
    chipsRow.appendChild(textInput);
  }

  function addTag(value) {
    const tag = value.trim().slice(0, 20);
    if (!tag || tags.includes(tag)) { textInput.value = ''; return; }
    tags.push(tag);
    renderChips();
    textInput.value = '';
    hideDropdown();
    textInput.focus();
  }

  let highlightedIdx = -1;

  function showDropdown(query) {
    if (!query) { hideDropdown(); return; }
    const q = query.toLowerCase();
    const suggestions = getSuggestions(q, tags).slice(0, maxSuggestions);
    if (!suggestions.length) { hideDropdown(); return; }
    highlightedIdx = -1;
    dropdown.innerHTML = '';
    suggestions.forEach(tag => {
      const li = document.createElement('li');
      li.textContent = tag;
      li.addEventListener('mousedown', (e) => { e.preventDefault(); addTag(tag); });
      dropdown.appendChild(li);
    });
    dropdown.style.display = 'block';
  }

  function hideDropdown() {
    dropdown.style.display = 'none';
    dropdown.innerHTML = '';
    highlightedIdx = -1;
  }

  function updateHighlight() {
    dropdown.querySelectorAll('li').forEach((li, i) => {
      li.classList.toggle('highlighted', i === highlightedIdx);
    });
  }

  textInput.addEventListener('input', () => showDropdown(textInput.value));
  textInput.addEventListener('blur', hideDropdown);
  textInput.addEventListener('keydown', (e) => {
    const isOpen = dropdown.style.display !== 'none';
    const items  = dropdown.querySelectorAll('li');

    if (isOpen && e.key === 'ArrowDown') {
      e.preventDefault();
      highlightedIdx = Math.min(highlightedIdx + 1, items.length - 1);
      updateHighlight();
      return;
    }
    if (isOpen && e.key === 'ArrowUp') {
      e.preventDefault();
      highlightedIdx = Math.max(highlightedIdx - 1, -1);
      updateHighlight();
      return;
    }
    if (e.key === 'Escape') { hideDropdown(); return; }
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      if (isOpen && highlightedIdx >= 0) addTag(items[highlightedIdx].textContent);
      else addTag(textInput.value);
    } else if (e.key === 'Backspace' && !textInput.value && tags.length > 0) {
      tags.pop();
      renderChips();
    }
  });

  renderChips();
  wrapper.appendChild(chipsRow);
  wrapper.appendChild(dropdown);
  wrapper.getTags = () => [...tags];
  wrapper.reset = () => { tags.splice(0); renderChips(); textInput.value = ''; };

  return wrapper;
};
