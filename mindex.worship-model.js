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
