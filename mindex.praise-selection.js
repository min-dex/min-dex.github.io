/* Source-attributed selection guidance. No persistence, playback or inferred links. */
(function(root) {
  'use strict';
  const text = value => typeof value === 'string' ? value.trim() : '';
  const esc = value => text(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const categories = {
    '1':'편안하게 시작 · MM 65–110', '1 리듬':'도입 · 리듬', '1 저녁':'도입 · 저녁',
    '2':'느리게 · MM 60–75 · 4/4·2/2', '2.5':'약간 느리게 · MM 75–89 · 하프타임',
    '3':'3/4 · MM 70–90', '3.6s':'느린 6/8', '3.6':'6/8', '3.9s':'느린 9/8', '3.9':'9/8',
    '4':'중간 빠르기 · MM 85–99 · 16비트', '4.5':'약간 빠르게 · MM 100–120 · 16비트',
    '5':'빠르게 · MM 120–140 · 8비트', '6':'아주 빠르게 · MM 140–170 · 4비트',
  };
  function normalize(value) {
    if (!Array.isArray(value)) return [];
    return value.filter(entry => entry && typeof entry === 'object' && text(entry.id) && text(entry.source))
      .map(entry => ({
        ...entry, id:text(entry.id), source:text(entry.source), source_date:text(entry.source_date),
        key:text(entry.key), category:text(entry.category), theme:text(entry.theme),
        transition_note:text(entry.transition_note),
        next:Array.isArray(entry.next) ? entry.next.filter(link => link && text(link.title)).map(link => ({
          ...link, title:text(link.title), song_id:text(link.song_id), key:text(link.key), note:text(link.note),
        })) : [],
      }));
  }
  function searchText(value) {
    return normalize(value).flatMap(entry => [entry.key, entry.theme, categories[entry.category] || entry.category]);
  }
  function render(song, lookup = () => null) {
    const entries = normalize(song?.metadata?.selection_guidance);
    if (!entries.length) return '';
    const findSong = typeof lookup === 'function' ? lookup : id => lookup.find(item => item.id === id);
    return `<details class="praise-selection" open><summary>선곡 정보 <span>추천 키 · 주제 · 이어 부르기</span></summary>
      <div class="praise-selection-entries">${entries.map(entry => `<section class="praise-selection-entry">
        <dl>${entry.key ? `<div><dt>추천 키</dt><dd>${esc(entry.key)}</dd></div>` : ''}
          ${entry.theme ? `<div><dt>주제</dt><dd>${esc(entry.theme)}</dd></div>` : ''}
          ${entry.category ? `<div><dt>리듬·빠르기</dt><dd>${esc(categories[entry.category] || entry.category)}</dd></div>` : ''}</dl>
        ${entry.transition_note || entry.next.length ? `<div class="praise-selection-next"><h4>이어 부르기</h4>
          ${entry.transition_note ? `<p>${esc(entry.transition_note)}</p>` : ''}
          ${entry.next.length ? `<ul>${entry.next.map(link => {
            const target = findSong(link.song_id);
            return `<li>${target && target.id !== song.id ? `<button class="related-song-link" type="button" data-open-song="${esc(target.id)}">${esc(link.title)}</button>` : `<span>${esc(link.title)}</span>`}
              ${link.key ? `<span class="praise-selection-key">${esc(link.key)}</span>` : ''}${link.note ? `<span>${esc(link.note)}</span>` : ''}</li>`;
          }).join('')}</ul>` : ''}</div>` : ''}
        <small>출처: ${esc(entry.source)}${entry.source_date ? ` · ${esc(entry.source_date)}` : ''} · 출처 기준 추천</small>
      </section>`).join('')}</div></details>`;
  }
  const api = {normalize, searchText, render};
  root.MindexPraiseSelection = api;
  if (typeof module !== 'undefined') module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
