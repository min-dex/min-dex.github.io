// Pure worship-domain rules shared by service loading, editing, and presenter preparation.
// Keep these functions global for the current classic-script runtime; callers in app.js keep
// their existing names while the model is extracted incrementally.
const WORSHIP_SERVICE_TYPE_ALIASES = {
  sun_1st: "sunday-first",
  sun_2nd: "sunday-second",
  sun_3rd: "sunday-main",
  sun_4th: "sunday-afternoon",
  sunday_4th: "sunday-afternoon",
  "sunday-fourth": "sunday-afternoon",
  sunday_fourth: "sunday-afternoon",
  sunday_afternoon: "sunday-afternoon",
  "주일예배": "sunday-main",
  "주일예배 [1부]": "sunday-first",
  "주일예배 (1부)": "sunday-first",
  "주일예배 [2부]": "sunday-second",
  "주일예배 (2부)": "sunday-second",
  "주일예배 [3부]": "sunday-main",
  "주일예배 (3부)": "sunday-main",
  "주일오후예배": "sunday-afternoon",
  "주일예배 [4부]": "sunday-afternoon",
  "주일예배 (4부)": "sunday-afternoon",
  wed: "wednesday",
  "수요예배": "wednesday",
  fri: "friday",
  "금요기도회": "friday",
  "월삭예배": "monthly",
  young_adult: "young-adult",
  "어린이부 예배": "children",
  nursery: "nursery",
  kindergarten: "nursery",
  preschool: "nursery",
  "유치부": "nursery",
  "유치부 예배": "nursery",
  "청소년부 예배": "youth",
  "청년부 예배": "young-adult",
  holy_week_dawn: "holy-week-dawn",
  "특별새벽기도회": "holy-week-dawn",
  "특별예배": "special",
};

const WORSHIP_SLOT_KEYS = new Set([
  "ready.waiting",
  "prayer.silent",
  "faith.creed",
  "confession.prayer",
  "confession.assurance",
  "praise.welcome",
  "praise.main",
  "praise.entrance",
  "prayer.representative",
  "word.reading",
  "word.body",
  "hymn.main",
  "special.song",
  "sermon.title",
  "sermon.scripture",
  "sermon.citation",
  "sermon.media",
  "sermon.live_scripture",
  "response.song",
  "response.prayer",
  "prayer.corporate.song",
  "prayer.meeting.free",
  "offering.praise",
  "offering.special",
  "offering.media",
  "offering.prayer",
  "announcements.main",
  "announcements.department",
  "announcements.media",
  "announcements.new_family",
  "new_family.welcome",
  "sending.doxology",
  "sending.benediction",
  "sending.lords_prayer",
  "closing.visual",
  "closing.hymn",
  "community.confession",
  "fellowship.person",
]);

function normalizeWorshipSlotKey(value = "") {
  const text = String(value || "").trim();
  if (!text) return "";
  if (/^praise\.song\.[1-9]\d*$/.test(text)) return text;
  if (text === "sermon.citation") return text;
  if (/^prayer\.corporate\.[1-9]\d*$/.test(text)) return text;
  if (/^prayer\.meeting\.song\.[1-9]\d*$/.test(text)) return text;
  return WORSHIP_SLOT_KEYS.has(text) ? text : "";
}

function explicitWorshipSlotKey(...sources) {
  for (const source of sources) {
    if (!source || typeof source !== "object") continue;
    const slotKey = normalizeWorshipSlotKey(source.slotKey || source.slot_key);
    if (slotKey) return slotKey;
  }
  return "";
}

// Media payload normalization shared by editing, persistence, and presentation.
const SERVICE_ASSET_KIND_ALIASES = {
  ppt: "file",
  pptx: "file",
  powerpoint: "file",
  key: "file",
  keynote: "file",
  importeddeck: "imported_deck",
  imported_deck: "imported_deck",
  keynote_deck: "imported_deck",
  ppt_deck: "imported_deck",
  syncedlyrics: "synced_lyrics",
  synced_lyrics: "synced_lyrics",
  timed_lyrics: "synced_lyrics",
  lyric_sync: "synced_lyrics",
  score: "score",
  music_score: "score",
  sheet_music: "score",
  "악보": "score",
  audio: "audio",
  youtube: "youtube",
  "오디오": "audio",
  "유튜브": "youtube",
};

const SERVICE_ASSET_KINDS = new Set(["", "file", "video", "pdf", "image", "score", "audio", "youtube", "synced_lyrics", "imported_deck"]);

function normalizeServiceAsset(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return { kind: "", name: "", url: "" };
  const rawKind = String(value.kind || value.type || "").trim().toLowerCase();
  const kind = SERVICE_ASSET_KIND_ALIASES[rawKind] || rawKind;
  const manifest = value.manifest && typeof value.manifest === "object" && !Array.isArray(value.manifest) ? value.manifest : {};
  const slides = normalizeServiceAssetSlides(
    value.slides
    || value.images
    || value.urls
    || value.pages
    || value.files
    || value.items
    || manifest.slides
    || manifest.stages,
  );
  const audio = normalizeServiceAssetAudioPayload(value.audio || value.sound || value.music);
  const timing = normalizeServiceSyncTiming(value.timing || value.sync || value.timeline);
  const normalized = {
    kind: SERVICE_ASSET_KINDS.has(kind) ? kind : "",
    name: String(value.name || value.title || "").trim(),
    url: String(value.url || value.path || value.href || "").trim(),
    ...(slides.length ? { slides } : {}),
  };
  if (audio.url) normalized.audio = audio;
  if (timing.pages.length || timing.cross !== null || timing.duration) normalized.timing = timing;
  if (String(value.manifestUrl || value.manifest_url || manifest.url || "").trim()) {
    normalized.manifestUrl = String(value.manifestUrl || value.manifest_url || manifest.url || "").trim();
  }
  if (String(value.fingerprint || value.sourceFingerprint || value.source_fingerprint || manifest.fingerprint || "").trim()) {
    normalized.fingerprint = String(value.fingerprint || value.sourceFingerprint || value.source_fingerprint || manifest.fingerprint || "").trim();
  }
  return normalized;
}

function normalizeServiceAssetAudioPayload(value) {
  if (!value) return { name: "", url: "" };
  if (typeof value === "string") return { name: "", url: String(value || "").trim() };
  if (!value || typeof value !== "object" || Array.isArray(value)) return { name: "", url: "" };
  return {
    name: String(value.name || value.title || value.label || "").trim(),
    url: String(value.url || value.path || value.href || value.src || "").trim(),
  };
}

function normalizeServiceSyncTiming(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return { pages: [], cross: null, duration: null };
  const pages = (Array.isArray(value.pages) ? value.pages : [])
    .map((page, index) => {
      if (!page || typeof page !== "object") return null;
      const start = Number(page.start ?? page.time ?? page.at);
      if (!Number.isFinite(start) || start < 0) return null;
      return {
        page: Number(page.page || page.index || index + 1) || index + 1,
        start,
        lines: Array.isArray(page.lines) ? page.lines.map((line) => String(line || "").trim()).filter(Boolean) : [],
      };
    })
    .filter(Boolean)
    .sort((a, b) => (Number(a.page) || 0) - (Number(b.page) || 0));
  const cross = Number(value.cross);
  const duration = Number(value.duration);
  return {
    pages,
    cross: Number.isFinite(cross) && cross >= 0 ? cross : null,
    duration: Number.isFinite(duration) && duration > 0 ? duration : null,
  };
}

function normalizeServiceAudioAsset(value) {
  const asset = normalizeServiceAsset(value);
  if (!hasServiceAsset(asset)) return { kind: "", name: "", url: "" };
  return { ...asset, kind: "audio" };
}

function normalizeServiceAssetSlides(value) {
  if (!Array.isArray(value)) return [];
  return value
    .map((slide, index) => {
      if (typeof slide === "string") {
        const url = String(slide || "").trim();
        return url ? { url, name: "" } : null;
      }
      if (!slide || typeof slide !== "object") return null;
      const url = String(slide.url || slide.path || slide.href || slide.src || "").trim();
      if (!url) return null;
      return {
        url,
        name: String(slide.name || slide.title || slide.label || "").trim(),
        formLabel: String(slide.formLabel || slide.form_label || slide.scoreFormLabel || slide.score_form_label || slide.form || "").trim(),
        formKey: String(slide.formKey || slide.form_key || slide.scoreFormKey || slide.score_form_key || "").trim(),
        order: Number(slide.order || slide.sort || slide.index || index + 1) || index + 1,
      };
    })
    .filter(Boolean)
    .sort((a, b) => (Number(a.order) || 0) - (Number(b.order) || 0));
}

function hasServiceAsset(asset) {
  return Boolean(asset && (asset.kind || asset.name || asset.url || asset.slides?.length));
}

// A kind alone (e.g. a freshly added 참고 화면) marks the asset type, not content.
function hasServiceAssetContent(asset) {
  return Boolean(asset && (asset.name || asset.url || asset.slides?.length));
}

// Form preset normalization; applying defaults and editing state stay with the caller.
const LEGACY_PUBLIC_SPECIAL_HYMN_FORM_PRESET_FORMS = ["1절", "2절", "간주", "마지막 절"];
const PREVIOUS_PUBLIC_SPECIAL_HYMN_FORM_PRESET_FORMS = ["1절", "후렴", "2절", "후렴", "간주", "마지막 절", "후렴"];
const PUBLIC_SPECIAL_HYMN_FORM_PRESET_FORMS = ["V1", "C", "V2", "C", "Int", "VL", "C", "Coda"];
const PUBLIC_SPECIAL_HYMN_FORM_PRESET_HINT = PUBLIC_SPECIAL_HYMN_FORM_PRESET_FORMS.join("-");

function normalizeServiceFormPreset(value, fallbackHint = "", fallbackStrength = "") {
  const source = parseObjectPayload(value);
  const sourceHint = source
    ? firstNonBlankString(source.hint, source.formHint, source.form_hint, source.label, fallbackHint)
    : fallbackHint;
  const forms = Array.isArray(value)
    ? normalizeServiceFormPresetForms(value)
    : typeof value === "string"
      ? normalizeServiceFormPresetForms(value)
      : source
        ? normalizeServiceFormPresetForms(source.forms || source.form || source.sequence || source.labels || source.items || sourceHint)
        : [];
  const hint = firstNonBlankString(
    source?.hint,
    source?.formHint,
    source?.form_hint,
    source?.label,
    fallbackHint,
    forms.join("-"),
  );
  const strength = firstNonBlankString(source?.strength, source?.defaultStrength, source?.default_strength, fallbackStrength);
  const preset = {};
  if (forms.length) preset.forms = forms;
  if (hint) preset.hint = normalizeServiceFormHint(hint);
  if (strength) preset.strength = strength;
  if (source?.omitUnlisted || source?.omit_unlisted) preset.omitUnlisted = true;
  return Object.keys(preset).length ? preset : null;
}

function canonicalServiceFormToken(value = "") {
  const raw = String(value || "").trim();
  const atVariant = raw.match(/^(v|verse|c|chorus|pc|prechorus|pre-chorus|p-c|p\.c\.|b|bridge|coda|ending)\s*(\d*)\s*@\s*([a-z])?$/i);
  if (atVariant) {
    const type = atVariant[1].toLowerCase();
    const prefix = /^(v|verse)$/.test(type) ? "V"
      : /^(c|chorus)$/.test(type) ? "C"
        : /^(b|bridge)$/.test(type) ? "B"
          : /^(coda|ending)$/.test(type) ? "Coda" : "PC";
    return `${prefix}${atVariant[2]}@${String(atVariant[3] || "").toUpperCase()}`;
  }
  const part = raw.match(/^(v|verse|c|chorus|pc|prechorus|pre-chorus|p-c|p\.c\.|b|bridge)\s*(\d*)\s*([a-z])?$/i);
  if (part) {
    const type = part[1].toLowerCase();
    const prefix = /^(v|verse)$/.test(type) ? "V"
      : /^(c|chorus)$/.test(type) ? "C"
        : /^(b|bridge)$/.test(type) ? "B" : "PC";
    return prefix + part[2] + String(part[3] || "").toUpperCase();
  }
  const instrumental = raw.match(/^(int|간주|interlude|instrumental)\s*([a-z]?)$/i);
  if (instrumental) return "Int" + instrumental[2].toUpperCase();
  if (/^vl$/i.test(raw)) return "VL";
  if (/^tags$/i.test(raw)) return "Tags";
  const ending = raw.match(/^(tag|coda|ending)\s*([a-z]?)$/i);
  if (ending) return (/^tag$/i.test(ending[1]) ? "Tag" : "Coda") + ending[2].toUpperCase();
  const hymnVerse = raw.match(/^(\d+)\s*절$/u);
  if (hymnVerse) return "V" + hymnVerse[1];
  if (raw === "후렴") return "C";
  if (/^마지막\s*절$/u.test(raw)) return "VL";
  // Unknown user-authored labels are not discarded or guessed.
  return raw;
}

function normalizeServiceFormPresetForms(value) {
  const forms = Array.isArray(value)
    ? cleanList(value).map(canonicalServiceFormToken).filter(Boolean)
    : String(value || "")
    .replace(/\bpre-chorus\b/gi, "PC")
    .replace(/\bp-c\b/gi, "PC")
    .split(/\s*(?:,|[-+>→])\s*/)
    .map(canonicalServiceFormToken)
    .filter(Boolean);
  return collapseSingletonServiceFormPartNumbers(forms);
}

function collapseSingletonServiceFormPartNumbers(forms = []) {
  const parts = forms.map((token) => {
    const match = String(token || "").match(/^(V|C|PC|B)(\d+)([A-Z]?|@[A-Z]?)$/);
    return match ? { token, prefix: match[1], number: Number(match[2]), suffix: match[3] || "" } : null;
  });
  const types = new Map();
  parts.forEach((part) => {
    if (!part) return;
    const state = types.get(part.prefix) || { numbers: new Set(), hasVariant: false, count: 0 };
    state.numbers.add(part.number);
    state.count += 1;
    if (part.suffix) state.hasVariant = true;
    types.set(part.prefix, state);
  });
  return forms.map((token, index) => {
    const part = parts[index];
    const state = part && types.get(part.prefix);
    return part && part.number === 1 && !part.suffix && !state.hasVariant && state.numbers.size === 1 && state.count === 1
      ? part.prefix
      : token;
  });
}

function normalizeServiceFormHint(value = "") {
  return normalizeServiceFormPresetForms(value).join("-");
}

function normalizeSongFormPresetLabel(value = "") {
  const raw = String(value || "").trim();
  const compact = compactSearchValue(raw);
  if (/^(vl|마지막절|lastverse|last)$/i.test(compact)) return { key: "last-verse", type: "verse", number: 0, lastVerse: true };
  const atVariant = raw.match(/^(v|verse|c|chorus|후렴|pc|prechorus|pre-chorus|p-c|p\.c\.|b|bridge|coda|ending)\s*(\d*)\s*@\s*([a-z])?$/i);
  if (atVariant) {
    const token = atVariant[1].toLowerCase();
    const type = /^(v|verse)$/.test(token) ? "verse"
      : /^(c|chorus|후렴)$/.test(token) ? "chorus"
        : /^(b|bridge)$/.test(token) ? "bridge"
          : /^(coda|ending)$/.test(token) ? "coda" : "pre-chorus";
    const number = Number(atVariant[2]) || 0;
    const group = String(atVariant[3] || "").toLowerCase();
    const baseKey = number ? `${type}:${number}` : type;
    return { key: `${baseKey}:@${group ? `:${group}` : ""}`, type, number, variant: true, ...(group ? { group } : {}) };
  }
  const verse = raw.match(/^(?:v|verse)\s*(\d*)\s*([a-z])?$/i) || raw.match(/^(\d+)\s*절$/u);
  if (verse) {
    const number = Number(verse[1]) || 0;
    const group = String(verse[2] || "").toLowerCase();
    const baseKey = number ? `verse:${number}` : "verse";
    return { key: group ? `${baseKey}:${group}` : baseKey, type: "verse", number, ...(group ? { group } : {}) };
  }
  const chorus = raw.match(/^(?:c|chorus|후렴)\s*(\d*)\s*([a-z])?$/i);
  if (chorus) {
    const number = Number(chorus[1]) || 0;
    const group = String(chorus[2] || "").toLowerCase();
    const baseKey = number ? `chorus:${number}` : "chorus";
    return { key: group ? `${baseKey}:${group}` : baseKey, type: "chorus", number, ...(group ? { group } : {}) };
  }
  const bridge = raw.match(/^(?:b|bridge)\s*(\d*)\s*([a-z])?$/i);
  if (bridge) {
    const number = Number(bridge[1]) || 0;
    const group = String(bridge[2] || "").toLowerCase();
    const baseKey = number ? `bridge:${number}` : "bridge";
    return { key: group ? `${baseKey}:${group}` : baseKey, type: "bridge", number, ...(group ? { group } : {}) };
  }
  const preChorus = raw.match(/^(?:pc|prechorus|pre-chorus|p-c|p\.c\.)\s*(\d*)\s*([a-z])?$/i);
  if (preChorus) {
    const number = Number(preChorus[1]) || 0;
    const group = String(preChorus[2] || "").toLowerCase();
    const baseKey = number ? `pre-chorus:${number}` : "pre-chorus";
    return { key: group ? `${baseKey}:${group}` : baseKey, type: "pre-chorus", number, ...(group ? { group } : {}) };
  }
  const coda = raw.match(/^(?:coda|ending)\s*[a-z]?$/i);
  if (coda) {
    return { key: "coda", type: "coda" };
  }
  const instrumental = raw.match(/^(?:int|간주|interlude|instrumental)\s*[a-z]?$/i);
  if (instrumental) {
    return { key: "instrumental", type: "instrumental" };
  }
  const tags = raw.match(/^(?:tags)$/i);
  if (tags) {
    return { key: "tag", type: "tag", repeat: 2 };
  }
  const tag = raw.match(/^(?:tag)\s*[a-z]?$/i);
  if (tag) {
    return { key: "tag", type: "tag" };
  }
  return { key: compact, type: compact };
}

function songFormPresetDisplayLabel(value = "") {
  const raw = String(value || "").trim();
  if (!raw) return "";
  const target = normalizeSongFormPresetLabel(raw);
  if (target.lastVerse) return "VL";
  const group = String(target.group || "").trim().toUpperCase();
  const suffix = target.variant ? `${target.number ? ` ${target.number}` : ""}@${group}` : target.number ? ` ${target.number}${group}` : group ? ` ${group}` : "";
  if (target.type === "verse") return `Verse${suffix}`;
  if (target.type === "chorus") return `Chorus${suffix}`;
  if (target.type === "bridge") return `Bridge${suffix}`;
  if (target.type === "pre-chorus") return `Pre-Chorus${suffix}`;
  if (target.type === "coda") return `Coda${suffix}`;
  if (target.type === "tag") return target.repeat > 1 ? "Tags" : "Tag";
  if (target.type === "instrumental") return "Instrumental";
  if (target.type === "lyrics") return "";
  return raw;
}

function normalizeSongMetadataPresenterForm(value) {
  const source = parseObjectPayload(value);
  if (source && Array.isArray(source.sourceForms) && source.sourceForms.length) {
    const sourceForms = normalizeServiceFormPresetForms(source.sourceForms);
    if (sourceForms.length) {
      return normalizeServiceFormPreset(
        {
          ...source,
          forms: sourceForms,
          hint: firstNonBlankString(source.sourceHint, source.source_hint, sourceForms.join("-")),
        },
        sourceForms.join("-"),
        "song-default",
      );
    }
  }
  return normalizeServiceFormPreset(value, "", "song-default");
}

function normalizeServiceFormPresetRules(value) {
  const source = Array.isArray(value) ? value : parseObjectPayload(value);
  if (!Array.isArray(source)) return [];
  return source
    .map((rule) => {
      const parsedRule = parseObjectPayload(rule);
      if (!parsedRule) return null;
      const preset = normalizeServiceFormPreset(
        parsedRule.formPreset || parsedRule.form_preset || parsedRule.preset,
        parsedRule.formHint || parsedRule.form_hint,
        parsedRule.strength || parsedRule.defaultStrength || parsedRule.default_strength,
      );
      const when = parseObjectPayload(parsedRule.when || parsedRule.condition || parsedRule.conditions) || {};
      const appendCodaWhenAvailable = Boolean(parsedRule.appendCodaWhenAvailable || parsedRule.append_coda_when_available);
      const omitUnlisted = Boolean(parsedRule.omitUnlisted || parsedRule.omit_unlisted);
      return preset
        ? { when, formPreset: normalizeServiceFormPresetRulePreset(preset, when), ...(appendCodaWhenAvailable ? { appendCodaWhenAvailable } : {}), ...(omitUnlisted ? { omitUnlisted } : {}) }
        : null;
    })
    .filter(Boolean);
}

function normalizeServiceFormPresetRulePreset(preset, when = {}) {
  if (!preset?.forms?.length) return preset;
  const songTypes = normalizePraiseTypes(when.songType || when.song_type || when.praiseType || when.praise_type);
  const isHymnRule = songTypes.includes("hymn");
  if (!isHymnRule) return preset;
  const formsKey = normalizeServiceFormPresetForms(preset.forms).map((item) => compactSearchValue(item)).join("|");
  if (["manual", "forced", "song-default"].includes(String(preset.strength || "").toLowerCase())) return preset;
  const legacy = [LEGACY_PUBLIC_SPECIAL_HYMN_FORM_PRESET_FORMS, PREVIOUS_PUBLIC_SPECIAL_HYMN_FORM_PRESET_FORMS]
    .find((forms) => normalizeServiceFormPresetForms(forms).map((item) => compactSearchValue(item)).join("|") === formsKey);
  if (!legacy) return preset;
  const legacyHint = legacy.join("-");
  const hint = compactSearchValue(normalizeServiceFormHint(preset.hint)) === compactSearchValue(normalizeServiceFormHint(legacyHint))
    ? PUBLIC_SPECIAL_HYMN_FORM_PRESET_HINT
    : firstNonBlankString(preset.hint, PUBLIC_SPECIAL_HYMN_FORM_PRESET_HINT);
  return {
    ...preset,
    forms: [...PUBLIC_SPECIAL_HYMN_FORM_PRESET_FORMS],
    hint,
    omitUnlisted: true,
  };
}
