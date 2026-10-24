// View preferences use the existing project/account/session state store.
(() => {
  const pending = new Map(), transient = new Map();
  const prefix = 'mindex.ui.disclosure.v1:';
  const escape = value => value.replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const keyFor = parts => prefix + JSON.stringify(parts);
  function read(parts, fallback = false) {
    if (window.MINDEX_SERVER_STORAGE?.ready) transient.clear();
    const key = keyFor(parts);
    const mounted = [...document.querySelectorAll("details[data-disclosure-key]")].find(node => node.dataset.disclosureKey === key);
    if (mounted && mounted.dataset.disclosureInitial !== String(mounted.open)) {
      mounted.dataset.disclosureInitial = String(mounted.open);
      writeKey(key, mounted.open);
    }
    if (transient.has(key)) return transient.get(key);
    const raw = pending.has(key) ? pending.get(key) : window.MINDEX_SERVER_STORAGE?.getItem('session', key);
    return raw === 'true' || (raw !== 'false' && fallback);
  }
  function writeKey(key, open) {
    const storage = window.MINDEX_SERVER_STORAGE, value = String(open);
    if (!storage?.ready) { transient.set(key, open); return; }
    pending.set(key, value);
    void storage.setItem('session', key, value).then(() => {
      if (pending.get(key) === value) pending.delete(key);
    }).catch(() => {}); // Existing state-store retry/conflict UI owns failures.
  }
  function attrs(parts, fallback = false) {
    const open = read(parts, fallback);
    return `data-disclosure-key="${escape(keyFor(parts))}" data-disclosure-initial="${String(open)}"${open ? ' open' : ''}`;
  }
  document.addEventListener('click', event => {
    const summary = event.target.closest?.('summary');
    const node = summary?.parentElement;
    if (!(node instanceof HTMLDetailsElement) || !node.dataset.disclosureKey) return;
    queueMicrotask(() => {
      if (event.defaultPrevented || node.dataset.disclosureInitial === String(node.open)) return;
      node.dataset.disclosureInitial = String(node.open);
      writeKey(node.dataset.disclosureKey, node.open);
    });
  });
  document.addEventListener('toggle', event => {
    const node = event.target;
    if (!(node instanceof HTMLDetailsElement) || !node.isConnected || !node.dataset.disclosureKey) return;
    if (node.dataset.disclosureInitial === String(node.open)) return;
    node.dataset.disclosureInitial = String(node.open);
    writeKey(node.dataset.disclosureKey, node.open);
  }, true);
  window.MindexDisclosure = Object.freeze({attrs, read, write:(parts,open)=>writeKey(keyFor(parts),open)});
})();
