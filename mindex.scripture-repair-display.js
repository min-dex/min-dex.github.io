/* KRV repair display support: regenerated chapter caches and bounded scripture text. */
(() => {
  const repairedChapters = { EXO: [9], '1CH': [21, 22], PSA: [72, 83], SNG: [6, 7, 8], JER: [32, 33] };
  const isRepairedChapter = (id, book, chapter) => repairedChapters[book]?.includes(Number(chapter))
    && state.bibleTranslations.some(t => t.id === id && /개역한글|^KRV$/i.test(t.name || t.translationKey || ''));
  const originalKey = persistentBibleChapterCacheKey;
  persistentBibleChapterCacheKey = (id, book, chapter) => originalKey(id, book, chapter)
    + (isRepairedChapter(id, book, chapter) ? '.krv-20261014' : '');
  // Old persistent cache entries remain recoverable; the corrected chapters read a new key.
  for (const key of state.bibleVerseCache.keys()) {
    const [id, book, chapter] = key.split(':');
    if (isRepairedChapter(id, book, chapter)) state.bibleVerseCache.delete(key);
  }
  function fit(host = document) {
    for (const text of host.querySelectorAll('.presenter-scripture-reading-text')) {
      const box = text.closest('.presenter-scripture-reading');
      if (!box || !box.getBoundingClientRect().height) continue;
      text.style.removeProperty('font-size');
      const base = parseFloat(getComputedStyle(text).fontSize);
      const bounds = box.getBoundingClientRect(), top = text.getBoundingClientRect().top;
      const fin = box.querySelector('.presenter-scripture-reading-fin');
      const bottom = fin ? Math.min(bounds.bottom, fin.getBoundingClientRect().top) : bounds.bottom;
      const available = bottom - top - Math.max(4, bounds.height * .025);
      if (available <= 0 || !base || text.scrollHeight <= available) continue;
      // Binary search keeps the largest fitting size; short verses keep their original typography.
      let low = 1, high = base;
      for (let i = 0; i < 14; i++) {
        const size = (low + high) / 2;
        text.style.fontSize = `${size}px`;
        if (text.scrollHeight <= available && text.scrollWidth <= text.clientWidth + 1) low = size;
        else high = size;
      }
      text.style.fontSize = `${Math.floor(low * 10) / 10}px`;
    }
  }
  let pending = false;
  const schedule = () => {
    if (pending) return;
    pending = true;
    requestAnimationFrame(() => { pending = false; fit(); });
  };
  new MutationObserver(schedule).observe(document.body, { childList: true, subtree: true });
  window.addEventListener('resize', schedule);
  document.fonts?.ready.then(schedule);
  schedule();
})();
