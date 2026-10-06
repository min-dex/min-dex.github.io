/* Worship source text grammar. Dependencies are provided by the app shell. */

// Values are resolved by the caller; this formatter does not look up app state.
function serializePortableServiceSourceItem(fields) {
  const { label, value, elementType, inputMode, outputMode, formHint, songTitle,
    songId, versionId, assignee, hasTranslation, translationLabel, translationId, sermonReference,
    lyrics, slides, manualScripture, manualTranslation, asset, audio } = fields;
  const lines = [`[${label}]`, `- 제목: ${value}`];
  if (elementType) lines.push(`- 유형: ${elementType}`);
  if (inputMode) lines.push(`- 입력: ${inputMode}`);
  if (outputMode) lines.push(`- 출력: ${outputMode}`);
  if (formHint) lines.push(`- 송폼: ${formHint}`);
  if (songTitle) lines.push(`- 곡: ${songTitle}`);
  if (songId) lines.push(`- 곡 ID: ${songId}`);
  if (versionId) lines.push(`- 버전 ID: ${versionId}`);
  if (assignee) lines.push(`- 담당: ${assignee}`);
  if (hasTranslation) lines.push(`- 역본: ${translationLabel}`);
  if (translationId) lines.push(`- 역본 ID: ${translationId}`);
  if (sermonReference !== null) lines.push(`- 성경 본문: ${sermonReference}`);
  if (lyrics) {
    lines.push("- 가사: |");
    lines.push(...lyrics.split(/\r?\n/).map((line) => `  ${line}`));
  }
  if (!lyrics && Array.isArray(slides) && slides.length) {
    lines.push("- 슬라이드: |");
    lines.push(...slides.join("\n---\n").split(/\r?\n/).map((line) => `  ${line}`));
  }
  if (manualScripture) {
    if (manualTranslation) lines.push(`- 수동 역본: ${manualTranslation}`);
    lines.push("- 수동 본문: |");
    lines.push(...manualScripture.split(/\r?\n/).map((line) => `  ${line}`));
  }
  if (asset.name || asset.url) {
    lines.push(`- 파일: ${asset.name || asset.url}`);
    if (asset.name && asset.url) lines.push(`- 링크: ${asset.url}`);
  }
  if (audio.name || audio.url) {
    lines.push(`- 음원 파일: ${audio.name || audio.url}`);
    if (audio.name && audio.url) lines.push(`- 음원 링크: ${audio.url}`);
  }
  return lines;
}

function parseServiceSourceText(value = "", options = {}) {
  if (/^\s*\[\[[^\]]+\]\]/m.test(String(value || ""))) return parsePortableServiceSourceText(value, options);
  const records = [];
  const lines = String(value || "").replace(/\r\n?/g, "\n").split("\n");
  let lineNumber = 0;
  let sectionTitle = "";
  let current = null;
  let readingLyrics = false;
  const finish = () => {
    if (!current) return;
    if (options.includeRanges) current.endLine = lineNumber;
    current.lyrics = current.lyricLines.join("\n").replace(/\s+$/g, "");
    delete current.lyricLines;
    records.push(current);
  };

  for (const [index, rawLine] of lines.entries()) {
    lineNumber = index;
    const line = rawLine.replace(/\s+$/g, "");
    const sectionMatch = line.match(/^\[([^\]]+)\]$/);
    if (sectionMatch) {
      finish();
      current = null;
      readingLyrics = false;
      sectionTitle = sectionMatch[1].trim();
      continue;
    }
    const itemMatch = line.match(/^([^:\[\]\n][^:\n]*?):\s*(.*)$/);
    if (itemMatch && !/^\s/.test(line)) {
      finish();
      current = {
        sectionTitle,
        ...(options.includeRanges ? { startLine: index } : {}),
        label: itemMatch[1].trim(),
        value: itemMatch[2].trim(),
        assignee: "",
        assetName: "",
        assetUrl: "",
        hasAssignee: false,
        hasAssetName: false,
        hasAssetUrl: false,
        hasLyrics: false,
        lyricLines: [],
      };
      readingLyrics = false;
      continue;
    }
    if (!current) continue;
    const metaMatch = line.match(/^\s{2,}([^:]+):\s*(.*)$/);
    if (metaMatch) {
      const key = compactSearchValue(metaMatch[1]);
      const metaValue = metaMatch[2].trim();
      if (key === "담당") {
        current.assignee = metaValue;
        current.hasAssignee = true;
        readingLyrics = false;
        continue;
      }
      if (key === "파일") {
        current.assetName = metaValue;
        current.hasAssetName = true;
        readingLyrics = false;
        continue;
      }
      if (key === "링크") {
        current.assetUrl = metaValue;
        current.hasAssetUrl = true;
        readingLyrics = false;
        continue;
      }
      if (key === "가사") {
        current.hasLyrics = true;
        readingLyrics = true;
        continue;
      }
      if (["성경본문", "성경봉독본문", "설교본문", "말씀본문"].includes(key)) {
        current.linkedScriptureValue = metaValue;
        current.hasLinkedScripture = true;
        readingLyrics = false;
        continue;
      }
    }
    if (readingLyrics) current.lyricLines.push(line.replace(/^\s{4}/, "").replace(/^\s{2}/, ""));
  }
  lineNumber = lines.length;
  finish();
  return records.filter((record) => record.label);
}

function parsePortableServiceSourceText(value = "", options = {}) {
  const records = [];
  const lines = String(value || "").replace(/\r\n?/g, "\n").split("\n");
  let lineNumber = 0;
  let sectionTitle = "";
  let current = null;
  let blockKey = "";
  const finish = () => {
    if (!current) return;
    if (options.includeRanges) current.endLine = lineNumber;
    if (blockKey) current[blockKey] = current._blockLines.join("\n").replace(/\s+$/g, "");
    delete current._blockLines;
    records.push(current);
  };
  lines.forEach((rawLine, index) => {
    lineNumber = index;
    const line = rawLine.replace(/\s+$/g, "");
    const section = line.match(/^\[\[([^\]]+)\]\]$/);
    if (section) { finish(); current = null; blockKey = ""; sectionTitle = section[1].trim(); return; }
    const element = line.match(/^\[([^\[\]]+)\]$/);
    if (element) {
      finish();
      current = { portable: true, sectionTitle, label: element[1].trim(), value: "", assignee: "", hasAssignee: false, hasLyrics: false, lyricLines: [], startLine: index };
      blockKey = "";
      return;
    }
    if (!current) return;
    const field = line.match(/^-\s*([^:]+):\s*(.*)$/);
    if (field) {
      if (blockKey) current[blockKey] = current._blockLines.join("\n").replace(/\s+$/g, "");
      const key = compactSearchValue(field[1]);
      const fieldValue = field[2].trim();
      blockKey = fieldValue === "|" ? key : "";
      current._blockLines = [];
      if (key === "제목") current.value = fieldValue;
      else if (key === "담당") { current.assignee = fieldValue; current.hasAssignee = true; }
      else if (key === "유형") current.elementType = fieldValue;
      else if (key === "입력") current.inputMode = fieldValue;
      else if (key === "출력") current.outputMode = fieldValue;
      else if (key === "송폼") current.formHint = fieldValue;
      else if (key === "곡") current.songTitle = fieldValue;
      else if (key === "곡id") current.songId = fieldValue;
      else if (key === "버전id") current.versionId = fieldValue;
      else if (key === "역본") current.translationLabel = fieldValue;
      else if (key === "역본id") current.translationId = fieldValue;
      else if (key === "파일") { current.assetName = fieldValue; current.hasAssetName = true; }
      else if (key === "링크") { current.assetUrl = fieldValue; current.hasAssetUrl = true; }
      else if (key === "가사") { current.hasLyrics = true; if (fieldValue !== "|") current.lyrics = fieldValue; else blockKey = "lyrics"; }
      else if (key === "슬라이드") { current.hasSlides = true; if (fieldValue !== "|") current.slides = fieldValue; else blockKey = "slides"; }
      else if (key === "수동본문") { current.hasManualScripture = true; if (fieldValue !== "|") current.manualScripture = fieldValue; else blockKey = "manualScripture"; }
      else if (key === "수동역본") current.manualTranslationLabel = fieldValue;
      else if (key === "음원파일") { current.audioName = fieldValue; current.hasAudioName = true; }
      else if (key === "음원링크") { current.audioUrl = fieldValue; current.hasAudioUrl = true; }
      else if (["성경본문", "성경봉독본문", "설교본문", "말씀본문"].includes(key)) {
        current.linkedScriptureValue = fieldValue;
        current.hasLinkedScripture = true;
      }
      return;
    }
    if (blockKey && /^\s{2}/.test(rawLine)) current._blockLines.push(rawLine.replace(/^\s{2}/, ""));
  });
  lineNumber = lines.length;
  finish();
  return records.filter((record) => record.label);
}
