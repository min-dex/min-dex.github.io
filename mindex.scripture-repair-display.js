/* Verified Bible repair display support: regenerated chapter caches and bounded scripture text. */
(() => {
  const repairedChapters = { EXO: [9], '1CH': [21, 22], PSA: [72, 83], SNG: [6, 7, 8], JER: [32, 33] };
  // Only independently verified production repairs receive a fresh cache key.
  const verifiedRepairs = {"dbf38d4d-3c8f-4407-a2dc-ca6af3233277":{"version":"other-verified-20261014","chapters":{"1CH":[21,22]}},"555482f7-28c5-437d-b958-ac2f5f800705":{"version":"other-verified-20261014","chapters":{"GEN":[10,46],"JDG":[20],"1SA":[14],"2SA":[23],"1CH":[1,7,8,9,11,12,15,24,27],"EZR":[2],"NEH":[7,12],"PSA":[20,21,26,27,29,32,67,141,146],"JER":[17,29],"EZK":[11],"ACT":[2],"1CO":[8,15]}},"f98f4683-e3d5-4829-82aa-8e2e8b8d2adf":{"version":"cog-original-20261014","chapters":{"1CH":[2,4,5,6,9,11,12,13,14,15,16,17,19,21,22,23,24,25,26,28,29],"1CO":[1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16],"1JN":[1,2,3,4,5],"1KI":[1,2,3,5,8,9,10,11,12,13,14,15,16,17,18,19,20,21,22],"1PE":[1,2,3,4,5],"1SA":[1,2,3,4,5,6,7,9,10,11,12,13,14,15,16,17,18,19,20,21,22,23,24,25,26,27,28,29,30],"1TH":[1,2,3,4,5],"1TI":[1,2,3,4,5,6],"2CH":[1,2,3,4,5,6,9,10,11,13,14,15,16,17,18,19,20,21,22,23,24,25,26,27,28,29,30,31,32,33,34,35,36],"2CO":[1,2,3,4,5,6,7,8,9,10,11,12,13],"2JN":[1],"2KI":[1,2,3,4,5,6,7,8,9,10,13,14,16,17,18,19,20,21,22,23],"2PE":[1,2,3],"2SA":[1,2,3,6,7,9,10,11,12,13,14,15,16,17,18,19,21,22,23,24],"2TH":[1,2,3],"2TI":[1,2,3,4],"3JN":[1],"ACT":[1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,21,22,23,24,25,26,27,28],"AMO":[4,5,6,7,9],"COL":[1,2,3,4],"DAN":[1,2,3,4,5,6,7,8,9,10,11],"DEU":[1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,21,22,23,24,25,26,27,28,29,30,31,32,33,34],"ECC":[1,2,3,5,6,7,8,9,11,12],"EPH":[1,2,3,4,5,6],"EST":[3,4,5,6,7,8],"EXO":[1,2,3,4,5,6,7,8,9,10,13,14,15,17,18,19,20,21,22,23,24,29,31,32,33,34],"EZK":[4,8,9,10,11,14,20,28,31,33,34,36,37,39,40,43,44],"EZR":[1,2,3,4,5,6,7,8,9,10],"GAL":[1,2,3,4,5,6],"GEN":[1,2,3,4,5,6,7,8,9,14,16,17,18,19,20,21,22,23,24,25,26,27,28,29,30,31,32,33,34,35,37,39,40,41,42,43,44,45,46,47,48,49,50],"HAB":[1,3],"HAG":[1],"HEB":[1,2,3,4,5,6,7,8,9,10,11,12,13],"HOS":[1,2,4,7,8,9,10,12,13,14],"ISA":[1,2,5,7,8,9,10,12,13,14,17,21,24,25,26,27,28,29,30,31,35,36,37,38,39,40,41,42,43,44,45,46,48,49,50,51,52,53,54,55,57,59,60,61,62,63,64,65,66],"JAS":[1,2,3,4,5],"JDG":[1,3,4,5,6,8,9,10,11,13,14,15,16,18,19,20,21],"JER":[1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,21,22,23,24,25,26,27,28,29,30,31,32,33,34,35,37,38,40,42,43,44,45,46,48,50,51],"JHN":[1,2,3,4,5,6,7,8,9,10,11,12,13,14,16,17,18,19,20,21],"JOB":[1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,21,22,23,25,26,27,28,29,30,31,32,33,34,35,36,37,38,39,40,42],"JOL":[1,2],"JON":[1,2,3,4],"JOS":[1,2,3,4,7,8,9,10,13,14,18,22,23,24],"JUD":[1],"LAM":[1,2,3,5],"LEV":[2,4,10,11,18,19,20,21,22,23,24,25,26],"LUK":[1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,21,22,23,24],"MAL":[2,3],"MAT":[1,2,3,4,5,6,7,8,9,11,12,13,14,15,16,17,18,19,20,21,22,23,24,25,26,27],"MIC":[4,5,6,7],"MRK":[1,2,3,4,5,6,7,8,9,10,11,12,13,14,15],"NEH":[1,2,3,4,5,6,7,8,9,10,11,12,13],"NUM":[6,9,10,11,12,13,14,15,16,20,21,22,23,24,25,27,31,32,36],"PHM":[1],"PHP":[1,2,3,4],"PRO":[2,3,11,16,21,25,28,29,30],"PSA":[3,4,5,6,7,8,9,10,13,14,16,17,18,19,20,21,22,24,25,26,27,29,30,31,33,35,36,37,38,39,40,41,42,43,44,45,46,47,48,49,50,51,52,53,54,56,57,58,59,60,61,62,63,64,65,66,67,68,69,70,71,72,73,74,75,76,77,78,79,80,81,82,83,84,85,86,88,89,90,92,94,95,96,98,99,100,102,104,105,106,107,108,109,113,114,115,116,118,119,122,123,132,135,136,139,140,142,143,144,145,146,147,149,150],"REV":[1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,21,22],"ROM":[1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16],"RUT":[1,2,3,4],"TIT":[1,2,3],"ZEC":[1,2,7,8,9,12,13,14],"ZEP":[2,3]}},"e1a705f1-4579-49ea-976f-3ed3914506d5":{"version":"easy-verified-20261014","chapters":{"GEN":[10],"1SA":[30],"1CH":[21,22],"EZK":[16]}}};
  const repairVersion = (id, book, chapter) => {
    const verified = verifiedRepairs[id];
    if (verified?.chapters[book]?.includes(Number(chapter))) return verified.version;
    if (repairedChapters[book]?.includes(Number(chapter))
      && state.bibleTranslations.some(t => t.id === id && /개역한글|^KRV$/i.test(t.name || t.translationKey || ''))) return 'krv-20261014';
    return '';
  };
  const isRepairedChapter = (id, book, chapter) => Boolean(repairVersion(id, book, chapter));
  const originalKey = persistentBibleChapterCacheKey;
  persistentBibleChapterCacheKey = (id, book, chapter) => {
    const version = repairVersion(id, book, chapter);
    return originalKey(id, book, chapter) + (version ? `.${version}` : '');
  };
  // Old persistent cache entries remain recoverable; the corrected chapters read a new key.
  for (const key of state.bibleVerseCache.keys()) {
    const [id, book, chapter] = key.split(':');
    if (isRepairedChapter(id, book, chapter)) state.bibleVerseCache.delete(key);
  }
  if (state.module === 'scripture' && isRepairedChapter(state.selectedBibleTranslationId, state.selectedBookCode, state.selectedBibleChapter)) {
    state.bibleBookVerses = [];
    void loadBibleBookVerses({ silent: true });
  }
  // Scripture entry needs translations even when the app booted on the home page.
  if (typeof runModuleEntryLoads === 'function') {
    const originalEntryLoads = runModuleEntryLoads;
    runModuleEntryLoads = (moduleName, ...args) => {
      const result = originalEntryLoads(moduleName, ...args);
      if (moduleName === 'scripture' && !state.bibleTranslations.length && !state.bibleReaderError) {
        void loadBibleTranslations({ silent: true });
      }
      return result;
    };
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
