(function (root) {
  "use strict";
  const key = (value) => String(value || "").normalize("NFKC").replace(/\s+/gu, "").toLowerCase();
  function buildTitlePeers(songs = []) {
    const peers = new Map();
    for (const song of songs) {
      const title = key(song.title);
      if (!peers.has(title)) peers.set(title, []);
      peers.get(title).push(song);
    }
    return peers;
  }
  function artistHint(song, peers = []) {
    const artist = String(song?.artist || song?.metadata?.artist || "").trim();
    if (!artist) return "";
    return peers.some(other => other.id !== song.id
      && key(other.hymn_no) === key(song.hymn_no)
      && key(other.subtitle) === key(song.subtitle)
      && key(other.artist || other.metadata?.artist) !== key(artist)) ? artist : "";
  }
  function titleParts(value) {
    let text = String(value || "").trim();
    const verse = text.match(/\s*([⑴-⒇①-⑳](?:\s*[,·]\s*[⑴-⒇①-⑳])*)$/u)?.[1] || "";
    if (verse) text = text.slice(0, text.lastIndexOf(verse)).trim();
    const hymn = text.match(/^(통\s*)?(\d{1,4})\s+(.+)$/u);
    return { text: hymn ? hymn[3] : text, number: hymn ? String(Number(hymn[2])) : "", oldHymnal: Boolean(hymn?.[1]), verse };
  }
  function aliases(value) {
    const text = titleParts(value).text;
    return [...new Set([text, text.replace(/\s*[(（\[][^)）\]]*[)）\]]/gu, "").trim(),
      ...Array.from(text.matchAll(/[(（\[]([^)）\]]+)[)）\]]/gu), (match) => match[1])].map(key).filter(Boolean))];
  }
  function buildIndex(songs = [], versions = []) {
    const byId = new Map(songs.map((song) => [song.id, { ...song, modernNumbers: new Set(), oldNumbers: new Set() }]));
    const titles = new Map(), names = new Map();
    function add(map, name, id) {
      const normalized = key(name);
      if (!normalized) return;
      if (!map.has(normalized)) map.set(normalized, new Set());
      map.get(normalized).add(id);
    }
    for (const song of byId.values()) {
      add(titles, song.title, song.id);
      if (song.subtitle) add(titles, `${song.title} (${song.subtitle})`, song.id);
      for (const name of [song.title, song.subtitle, song.original_title]) {
        for (const alias of aliases(name)) add(names, alias, song.id);
      }
      if (/^\d+$/u.test(String(song.hymn_no || ""))) song.modernNumbers.add(String(Number(song.hymn_no)));
    }
    for (const version of versions) {
      const song = byId.get(version.source_song_id) || byId.get(version.canonical_song_id);
      if (!song) continue;
      for (const name of [version.curated_version_name, version.version_label, version.subtitle, version.original_title]) {
        if (!name || /^(default|기본|새찬송가|통일찬송가|version\s*\d+)$/iu.test(name.trim())) continue;
        for (const alias of aliases(name)) add(names, alias, song.id);
      }
      const old = [version.curated_version_name, version.version_label].map((name) => String(name || "").match(/^(?:통일|통)\s*(\d+)/u)).find(Boolean);
      if (old) song.oldNumbers.add(String(Number(old[1])));
    }
    return { byId, titles, names };
  }
  function isExcluded(candidate, serviceType = "") {
    const label = String(candidate.raw_label || "").replace(/\s+/gu, "");
    if (!label.includes("특송")) return false;
    if (label.includes("3부")) return true;
    return ["sun_3rd", "sunday-main"].includes(serviceType) && !/[12]부/u.test(label);
  }
  function split(value) {
    const text = String(value || "").trim();
    const wrapped = text.match(/^메들리\s*[(（]([\s\S]*)[)）]$/u);
    return (wrapped ? wrapped[1] : text).split(/\s*[+＋]\s*/u).filter(Boolean);
  }
  function resolve(value, index, explicitId = "") {
    if (!index) return { status: "pending", text: value, candidates: [] };
    const part = titleParts(value);
    let ids = explicitId ? new Set(index.byId.has(explicitId) ? [explicitId] : []) : index.titles.get(key(part.text));
    if (!ids?.size && !explicitId) ids = new Set(aliases(part.text).flatMap((alias) => [...(index.names.get(alias) || [])]));
    const candidates = [...(ids || [])].map((id) => index.byId.get(id)).filter(Boolean);
    if (!candidates.length) return { status: explicitId ? "broken-link" : "unmatched", text: value, candidates };
    const numbered = part.number && !explicitId ? candidates.filter((song) => (part.oldHymnal ? song.oldNumbers : song.modernNumbers).has(part.number)) : candidates;
    if (!numbered.length) return { status: "hymn-number", text: value, candidates };
    if (numbered.length !== 1) return { status: "ambiguous", text: value, candidates: numbered };
    const song = numbered[0];
    const hymnNo = String(song.hymn_no || "").trim();
    const prefix = hymnNo ? `${hymnNo} ` : "";
    const sameTitle = [...(index.titles.get(key(song.title)) || [])].map(id => index.byId.get(id));
    const needsSubtitle = sameTitle.some(other => other.id !== song.id
      && Boolean(other.modernNumbers.size || other.oldNumbers.size) === Boolean(song.modernNumbers.size || song.oldNumbers.size));
    const title = needsSubtitle && song.subtitle ? `${song.title} (${song.subtitle})` : song.title;
    return { status: "linked", song, detail: artistHint(song, sameTitle), text: `${prefix}${title}${part.verse ? ` ${part.verse}` : ""}`, candidates: numbered };
  }
  function fromServices(snapshot = {}, archivedSources = [], index = null) {
    const songId = element => element.praise_record_id || element.song_id || "";
    const hasSong = element => Boolean(songId(element) || String(element.title || "").trim());
    void archivedSources; // Imported records never suppress the current worship projection.
    const occupied = new Set();
    const sections = new Map((snapshot.sections || []).map(s => [s.id, s]));
    const grouped = new Map();
    for (const element of snapshot.elements || []) {
      if (element.template_suppressed || element.legacy_template_suppressed
        || element.config?.templateSuppressed || element.config?.template_suppressed) continue;
      const section = sections.get(element.section_id);
      if (!section || element.element_type !== "praise") continue;
      if (!grouped.has(section.service_id)) grouped.set(section.service_id, []);
      grouped.get(section.service_id).push({element, section});
    }
    const sources = [], candidates = [];
    for (const service of snapshot.services || []) {
      const identity = service.service_date + "|" + service.service_type_id;
      if (!service.service_date || occupied.has(identity)) continue;
      const rows = grouped.get(service.id) || [];
      if (!rows.some(({element}) => hasSong(element))) continue;
      occupied.add(identity);
      const id = "worship:" + service.id;
      sources.push({id, service_id: service.id, source_kind: "worship", source_name: service.title || "",
        service_date: service.service_date, service_type_id: service.service_type_id,
        leader: service.praise_leader || "", aliases:service.service_alias || "", status: service.status});
      rows.sort((a,b) => (Number(a.section.sort_order)||0)-(Number(b.section.sort_order)||0)
        || String(a.section.id).localeCompare(String(b.section.id))
        || (Number(a.element.sort_order)||0)-(Number(b.element.sort_order)||0)
        || String(a.element.id).localeCompare(String(b.element.id)));
      let mainNumber = 0;
      const serviceCandidates = rows.map(({element, section}, i) => {
        let label = String(element.label || element.source_ref?.label || section.title || "찬양").trim();
        if (/^찬양(?:\s*\d+)?$/.test(label)) {
          const count = songId(element) ? 1 : Math.max(1, split(element.title).length);
          const first = mainNumber + 1;
          mainNumber += count;
          label = `찬양 ${first}${count > 1 ? `–${mainNumber}` : ""}`;
        }
        return {id:element.id, import_source_id:id, sort_order:i+1, archive_display_order:i+1,
          candidate_level:"element", candidate_key:section.section_key || "praise", suggested_type:"praise",
          raw_label:label, raw_title:String(index?.byId.get(songId(element))?.title || element.title || "").trim(), suggested_song_id:songId(element) || null,
          archive_live:true,
          archive_manual_song:!songId(element), review_status:"approved"};
      });
      const connection = element => element.connectedPraise || element.connected_praise
        || element.config?.connectedPraise || element.config?.connected_praise
        || element.source_connectedPraise || element.source_connected_praise
        || element.source_ref?.connectedPraise || element.source_ref?.connected_praise;
      const groupId = element => {
        const value = connection(element);
        return String(value?.groupId || value?.group_id || value?.id || "").trim();
      };
      // Fold only adjacent members in the same section; retain each member's link.
      for (let i = 0; i < rows.length;) {
        // Empty slots reserve their number, but are not archive songs or medley members.
        if (!hasSong(rows[i].element)) { i++; continue; }
        const first = i;
        const group = groupId(rows[i].element);
        while (group && i + 1 < rows.length && rows[i + 1].section.id === rows[first].section.id
          && hasSong(rows[i + 1].element)
          && groupId(rows[i + 1].element) === group) i++;
        const members = serviceCandidates.slice(first, i + 1);
        const candidate = members[0];
        if (members.length > 1) {
          const start = candidate.raw_label.match(/^찬양 (\d+)(?:–(\d+))?$/u);
          const end = members.at(-1).raw_label.match(/^찬양 (\d+)(?:–(\d+))?$/u);
          candidates.push({...candidate,
            raw_label: start && end ? `찬양 ${start[1]}–${end[2] || end[1]}` : candidate.raw_label,
            raw_title: members.map(member => member.raw_title).join(" + "),
            suggested_song_id: null, archive_members: members});
        } else candidates.push(candidate);
        i++;
      }
    }
    return {sources, candidates};
  }
  function preferLiveSources(archivedSources = [], snapshot = {}, liveSources = [], normalizeType = value => value) {
    const identity = source => source.service_date + "|" + normalizeType(source.service_type_id);
    const occupied = new Set((snapshot?.services || []).filter(service => service.service_date).map(identity));
    // Even an empty actual service is authoritative. Do not resurrect an old
    // import after the user clears its songs. The stored import remains intact.
    return [...archivedSources.filter(source => !occupied.has(identity(source))), ...liveSources];
  }
  function mergeSundayEntries(entries = []) {
    // 2부 owns its additional special song; never move it into the 3부 card.
    return entries.filter(entry => !['sun_1st','sunday-first'].includes(entry.source.service_type_id));
  }
  root.MindexSetlistLinks = { buildTitlePeers, artistHint, titleKey:key, buildIndex, resolve, split, isExcluded, fromServices, preferLiveSources, mergeSundayEntries };
})(typeof window === "undefined" ? globalThis : window);
