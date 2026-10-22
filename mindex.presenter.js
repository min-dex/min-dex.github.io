// Presenter slide/output helpers split from app.js.
// Runtime order is constants -> presenter -> app. Shared controller helpers are
// owned by app.js and must not be redeclared here; tests/solid_audit.py enforces it.

const PRESENTER_SONG_NOTE = "♬";
const PRESENTER_SONG_NOTE_PATTERN = /^[\u2669\u266A\u266B\u266C]\s*/u;
const PRESENTER_DEFAULT_CHROMAKEY_READY_LOOP_VIDEO = "assets/presenter/chromakey-ready-loop-pingpong.mp4?v=pingpong-20260925-001";

function presenterSlidesWithIntroSlide(item = {}, section = {}, index = 0, memo = emptyServiceItemMemo(), slides = []) {
  const list = Array.isArray(slides) ? slides.filter(Boolean) : [];
  if (!list.length) return list;
  const introSlide = presenterIntroSlideFromMemo(item, section, index, memo);
  if (!introSlide) return list;
  const introBody = presenterTitleContentBodyText(introSlide);
  const alreadyPresent = list.some((slide) =>
    slide?._introSlide
    || (
      slide?.type === "title-content"
      && normalizeTitle(slide.title) === normalizeTitle(introSlide.title)
      && normalizeTitle(presenterTitleContentBodyText(slide)) === normalizeTitle(introBody)
    ));
  return alreadyPresent ? list : [introSlide, ...list];
}

function presenterIntroSlideFromMemo(item = {}, section = {}, index = 0, memo = emptyServiceItemMemo()) {
  const intro = normalizeServiceIntroSlide(memo.introSlide);
  if (!intro) return null;
  const title = intro.title || section.sectionTitle || item.label || "제목";
  const bodyText = intro.body || "";
  return {
    id: `${item.id || index}:intro-title`,
    ...section,
    elementLabel: item.label || section.elementLabel || "제목 / 내용",
    elementTitle: title,
    elementType: PRESENTER_ELEMENT_TYPES.TITLE_CONTENT,
    layout: PRESENTER_SLIDE_LAYOUTS.CENTER_TEXT,
    type: "title-content",
    label: item.label || "",
    title,
    bodyText,
    marker: "",
    text: [title, bodyText].filter(Boolean).join("\n"),
    sort: index - 0.001,
    _introSlide: true,
  };
}

function presenterSlidesWithSpecialSongTitle(item = {}, section = {}, slides = [], index = 0, service = null) {
  if (!shouldIncludeSpecialSongSectionTitleSlide(item, section, slides)) {
    return presenterSlidesWithSundayMainSpecialSongOutput(slides, item, section, service);
  }
  const titleSlideIndex = slides.findIndex((slide) => slide?.type === "song-title");
  const existingSpecialTitleIndex = slides.findIndex((slide) =>
    slide?.type === "title-assignee"
    && !slide.songTitle
    && normalizeTitle(slide.title) === normalizeTitle(item.label || section.sectionLabel || "특송"));
  const existingSpecialTitle = existingSpecialTitleIndex >= 0 ? slides[existingSpecialTitleIndex] : null;
  if (existingSpecialTitle?.missingContent) {
    return presenterSlidesWithSundayMainSpecialSongOutput(slides, item, section, service);
  }
  const titleSlide = titleSlideIndex >= 0 ? slides[titleSlideIndex] : null;
  const remainingSlides = slides.filter((_, slideIndex) =>
    slideIndex !== existingSpecialTitleIndex)
    .map((slide) => slide?.type === "song-title" || slide?.songTitle
      ? { ...slide, songTitleContent: { ...presenterSongTitleContent(slide), orderTitle: "" } }
      : slide);
  return presenterSlidesWithSundayMainSpecialSongOutput([
    presenterSpecialSongSectionTitleSlide(item, section, index, titleSlide),
    ...remainingSlides,
  ], item, section, service);
}

function presenterSlidesWithScriptureReadingTitle(item = {}, section = {}, slides = [], index = 0, service = null) {
  const list = Array.isArray(slides) ? slides.filter(Boolean) : [];
  if (!list.length || presenterScriptureBodyContext(item, section) !== "reading") return list;
  const existingTitle = list.some((slide) =>
    slide?.type === "title-assignee"
    && compactSearchValue(slide.title || slide.label || "") === "성경봉독");
  if (existingTitle) return list;
  const references = typeof serviceItemScriptureReferences === "function"
    ? serviceItemScriptureReferences(item, parseServiceItemMemo(item.memo), service)
    : [];
  const reference = references.length && typeof formatServiceScriptureReferenceList === "function"
    ? formatServiceScriptureReferenceList(references)
    : String(list[0]?.title || list[0]?.marker || item.raw_title || "").trim();
  return [presenterScriptureReadingTitleSlide(item, section, index, reference), ...list];
}

function presenterScriptureReadingTitleSlide(item = {}, section = {}, index = 0, reference = "") {
  const title = "성경봉독";
  const assignee = presenterScriptureReadingDisplayReference(reference);
  return {
    id: `${item.id || index}:scripture-reading-title`,
    ...section,
    elementLabel: title,
    elementTitle: title,
    elementType: PRESENTER_ELEMENT_TYPES.TITLE_ASSIGNEE,
    layout: PRESENTER_SLIDE_LAYOUTS.LOWER_BAR_TEXT,
    type: "title-assignee",
    label: title,
    title,
    assignee,
    scriptureReadingAssignee: cleanPresenterAssignee(item.assignee),
    marker: "",
    text: cleanList([title, assignee]).join("\n"),
    sort: index - 0.002,
  };
}

function presenterScriptureReadingDisplayReference(value = "") {
  return String(value || "")
    .split(";")
    .map((part) => {
      const text = part.trim();
      const match = text.match(/^(.+?)\s+(\d{1,3}(?::|장|\s|$).*)$/);
      if (!match) return text;
      return [presenterScriptureReadingBookName(match[1]), match[2]].filter(Boolean).join(" ");
    })
    .filter(Boolean)
    .join("; ");
}

function shouldIncludeSpecialSongSectionTitleSlide(item = {}, section = {}, slides = []) {
  if (!slides.length) return false;
  const sectionKey = String(section.sectionKey || item?._worshipSectionKey || "").trim();
  if (!isPresenterSpecialSongItem(item, section)) return false;
  return true;
}

function isPresenterSpecialSongItem(item = {}, section = {}) {
  if (isSpecialSongServiceItem(item)) return true;
  const sectionKey = String(section.sectionKey || item?._worshipSectionKey || "").trim();
  if (sectionKey === "special_song") return true;
  return compactSearchValue(item?._worshipSectionTitle || "") === "특송";
}

function presenterSlidesWithSundayMainSpecialSongOutput(slides = [], item = {}, section = {}, service = null) {
  const captionTheme = presenterSpecialSongCaptionTheme(item, section);
  const themed = captionTheme
    // The "특송 - 팀" title slide keeps the standard look; only song title and lyrics slides are themed.
    ? (Array.isArray(slides) ? slides : []).map((slide) => slide?.type === "title-assignee" ? slide : ({ ...slide, captionTheme }))
    : slides;
  if (!shouldUseSundayMainSpecialSongCleanOutput(item, section, service)) return themed;
  return (Array.isArray(themed) ? themed : []).map((slide) => ({
    ...slide,
    outputContext: "clean",
  }));
}

// Special songs by a team with its own caption look (white/gold bar, Eulyoo type).
function presenterSpecialSongCaptionTheme(item = {}, section = {}) {
  if (!isPresenterSpecialSongItem(item, section)) return "";
  return compactSearchValue(cleanServiceAssignee(item?.assignee || "")).includes("카다로스") ? "cadaros" : "";
}

function shouldUseSundayMainSpecialSongCleanOutput(item = {}, section = {}, service = null) {
  if (String(section.sectionKey || item._worshipSectionKey || "") === "offering") return false;
  if (!isPresenterSpecialSongItem(item, section)) return false;
  const rawType = String(service?.type_id || service?.typeId || "").trim();
  const typeId = typeof worshipAppServiceTypeId === "function"
    ? worshipAppServiceTypeId(rawType)
    : rawType;
  return typeId === "sunday-main" && !isPresenterAllGenerationsService(service);
}

function isPresenterAllGenerationsService(service = null) {
  if (!service || typeof service !== "object") return false;
  const sourceRef = service._worshipSourceRef && typeof service._worshipSourceRef === "object"
    ? service._worshipSourceRef
    : service.source_ref && typeof service.source_ref === "object"
      ? service.source_ref
      : {};
  const variant = String(sourceRef.sunday_main_variant || "").trim().toLowerCase();
  if (variant === "all_generations") return true;
  return compactSearchValue([service.alias, service.service_alias].filter(Boolean).join(" ")).includes("온세대찬양예배");
}

function presenterSpecialSongSectionTitleSlide(item = {}, section = {}, index = 0, songTitleSlide = null) {
  const title = item.label || section.sectionLabel || "특송";
  const assignee = cleanServiceAssignee(item.assignee);
  const subtitle = assignee;
  const text = [title, subtitle].filter(Boolean).join("\n");
  return {
    id: `${item.id || index}:special-title`,
    ...section,
    elementType: PRESENTER_ELEMENT_TYPES.TITLE_ASSIGNEE,
    layout: PRESENTER_SLIDE_LAYOUTS.LOWER_BAR_TEXT,
    type: "title-assignee",
    label: title,
    title,
    subtitle,
    assignee: subtitle,
    marker: "",
    text,
    sort: index - 0.002,
  };
}

const PRESENTER_PUBLIC_LORDS_PRAYER_TEXT = `하늘에 계신 우리 아버지,
아버지의 이름을 거룩하게 하시며
아버지의 나라가 오게 하시며,
아버지의 뜻이 하늘에서와 같이 땅에서도 이루어지게 하소서.
오늘 우리에게 일용할 양식을 주시고,
우리가 우리에게 잘못한 사람을 용서하여 준 것같이,
우리 죄를 용서하여 주시고,
우리를 시험에 빠지지 않게 하시고, 악에서 구하소서.
나라와 권능과 영광이
영원히 아버지의 것입니다. 아멘.`;

const PRESENTER_PUBLIC_APOSTLES_CREED_TEXT = `나는 전능하신 아버지 하나님, 천지의 창조주를 믿습니다.
나는 그의 유일하신 아들, 우리 주 예수 그리스도를 믿습니다.
그는 성령으로 잉태되어 동정녀 마리아에게서 나시고,
본디오 빌라도에게 고난을 받아 십자가에 못 박혀 죽으시고,
장사된 지 사흘 만에 죽은 자 가운데서 다시 살아나셨으며,
하늘에 오르시어 전능하신 아버지 하나님 우편에 앉아 계시다가,
거기로부터 살아 있는 자와 죽은 자를 심판하러 오십니다.
나는 성령을 믿으며, 거룩한 공교회와 성도의 교제와
죄를 용서받는 것과 몸의 부활과 영생을 믿습니다. 아멘.`;

const PRESENTER_PUBLIC_APOSTLES_CREED_CHROMAKEY_TEXT = `나는 전능하신 아버지 하나님,
천지의 창조주를 믿습니다.
나는 그의 유일하신 아들,
우리 주 예수 그리스도를 믿습니다.
그는 성령으로 잉태되어
동정녀 마리아에게서 나시고,
본디오 빌라도에게 고난을 받아
십자가에 못 박혀 죽으시고,
장사된 지 사흘 만에
죽은 자 가운데서 다시 살아나셨으며,
하늘에 오르시어 전능하신 아버지
하나님 우편에 앉아 계시다가,
거기로부터 살아 있는 자와
죽은 자를 심판하러 오십니다.
나는 성령을 믿으며,
거룩한 공교회와 성도의 교제와
죄를 용서받는 것과
몸의 부활과 영생을 믿습니다. 아멘.`;

const PRESENTER_SCRIPTURE_READING_BACKGROUND = "assets/worship-backgrounds/scripture-reading-cross.png";
const PRESENTER_CHURCH_LOGO = "assets/presenter/church-logo-white.png";

const PRESENTER_PUBLIC_COMMUNITY_CONFESSION_TEXT = `우리는 세상으로부터 부름 받은 하나님의 거룩한 백성입니다.
또한 세상으로 보냄 받은 그리스도의 제자입니다.
하나님을 기쁘게 찬양하는 성령 충만한 예배자가 되겠습니다.
진리를 배우고 수호하는 은혜에 빚진 훈련자가 되겠습니다.
땅 끝까지 복음을 전파하는 전도자가 되겠습니다.
이웃의 아픔을 함께하는 치유자가 되겠습니다.
온 성도가 하나 되는 화해자가 되겠습니다.
사회적 책임을 다하는 소명자가 되겠습니다.
그리하여 우리 모두 하나님을 영화롭게 하는
검단우리교회 공동체가 되겠습니다.`;

const PRESENTER_PUBLIC_COMMUNITY_CONFESSION_CHROMAKEY_SLIDES = Object.freeze([
  "우리는 세상으로부터 부름 받은\n하나님의 거룩한 백성입니다.",
  "또한 세상으로 보냄 받은\n그리스도의 제자입니다.",
  "하나님을 기쁘게 찬양하는\n성령 충만한 예배자가 되겠습니다.",
  "진리를 배우고 수호하는\n은혜에 빚진 훈련자가 되겠습니다.",
  "땅 끝까지 복음을 전파하는\n전도자가 되겠습니다.",
  "이웃의 아픔을 함께하는\n치유자가 되겠습니다.",
  "온 성도가 하나 되는\n화해자가 되겠습니다.",
  "사회적 책임을 다하는\n소명자가 되겠습니다.",
  "그리하여 우리 모두 하나님을 영화롭게 하는\n검단우리교회 공동체가 되겠습니다.",
]);

function serviceItemOutputMode(item = {}, memo = parseServiceItemMemo(item?.memo)) {
  const mode = normalizeServiceOutputMode(
    memo.outputMode
    || item.outputMode
    || item.output_mode
    || item.renderMode
    || item.render_mode,
  );
  const flexibleOffering = typeof serviceItemUsesFlexibleOfferingSlot === "function"
    && serviceItemUsesFlexibleOfferingSlot(item);
  return flexibleOffering && mode === "score" && !presenterServiceItemUsesScoreInputMode(item, memo) ? "" : mode;
}

function presenterServiceItemUsesScoreInputMode(item = {}, memo = {}) {
  const raw = String(memo.inputMode || memo.input_mode || item.inputMode || item.input_mode || "").trim().toLowerCase();
  if (["score_db", "score", "music_score", "sheet_music", "악보"].includes(raw)) return true;
  return normalizeServiceOutputMode(
    memo.outputMode
    || item.outputMode
    || item.output_mode
    || item.renderMode
    || item.render_mode,
  ) === "score";
}

function presenterScoreSlidesForServiceItem(
  item,
  section,
  index,
  song,
  version,
  displayText,
  memo = parseServiceItemMemo(item?.memo),
  forms = [],
  formWarnings = [],
) {
  const label = item?.label || "";
  const asset = normalizeServiceAsset(memo.asset || item.asset);
  const title = presenterSongTitleDisplayTitle(song, version, displayText) || displayText || label || "악보";
  const imageSlides = presenterScoreImageSlidesFromAsset(asset, item, section, index, title, label, song, version, displayText, forms, formWarnings);
  if (imageSlides.length) return imageSlides;
  const scoreAsset = { ...asset, kind: asset.kind || "score" };
  if (!String(scoreAsset.url || "").trim()) return [];
  const fileTitle = presenterFileDisplayTitle({ title, asset: scoreAsset }, "악보");
  const scoreForms = presenterScoreFormsFromImageSources([{ formLabel: asset.formLabel || asset.form_label || asset.scoreFormLabel || asset.score_form_label }]);
  return [{
    id: `${item.id || index}:score`,
    ...section,
    sectionLabel: section.sectionLabel || label || "악보",
    sectionTitle: section.sectionTitle || section.sectionLabel || label || "악보",
    sectionName: presenterNameParts(section.sectionLabel || label, fileTitle).join(" / ") || fileTitle,
    elementTitle: fileTitle,
    elementType: PRESENTER_ELEMENT_TYPES.FILE,
    layout: PRESENTER_SLIDE_LAYOUTS.FILE,
    type: "file",
    label,
    title: fileTitle,
    subtitle: versionDisplayName(song, version),
    marker: "악보",
    text: [fileTitle, scoreAsset.url].filter(Boolean).join("\n"),
    asset: scoreAsset,
    ...presenterScoreFormMetadata(scoreForms, 0, formWarnings),
    sourceType: "score",
    componentType: "score",
    sort: index,
  }];
}

function presenterScoreImageSlidesFromAsset(
  asset,
  item,
  section,
  index,
  title,
  label,
  song = null,
  version = null,
  displayText = "",
  forms = [],
  formWarnings = [],
) {
  const explicitSources = [
    ...normalizeServiceAssetSlides(asset?.slides),
    ...normalizeServiceAssetSlides(asset?.images),
    ...normalizeServiceAssetSlides(asset?.urls),
    ...presenterImageSourcesFromAssetUrl(asset?.url),
  ];
  const sources = explicitSources.length ? explicitSources : presenterHymnScoreAssetSlides(song, version, displayText);
  const imageSources = sources
    .map((slide, slideIndex) => ({
      url: normalizePresenterMediaSource(slide.url),
      name: String(slide.name || "").trim(),
      formLabel: presenterScoreFormLabelFromAssetSlide(slide),
      formKey: String(slide.formKey || slide.form_key || slide.scoreFormKey || slide.score_form_key || "").trim(),
      order: Number(slide.order) || slideIndex + 1,
    }))
    .filter((slide) => slide.url && presenterMediaSourceIsImage(slide.url));
  const count = imageSources.length;
  const scoreForms = presenterScoreFormsFromImageSources(imageSources);
  const sequenced = presenterScoreImageSourcesForFormSequence(imageSources, scoreForms, forms, item, song, version);
  return sequenced.imageSources.map((slide, slideIndex) => {
    if (slide._presenterTitle) return presenterSequenceTitleSlide(item, section, song, version, displayText, index, slideIndex);
    return {
      id: `${item.id || index}:score-image:${slideIndex}`,
      ...section,
      sectionLabel: section.sectionLabel || label || "악보",
      sectionTitle: section.sectionTitle || section.sectionLabel || label || "악보",
      sectionName: presenterNameParts(section.sectionLabel || label, title).join(" / ") || title,
      elementTitle: title,
      elementType: PRESENTER_ELEMENT_TYPES.IMAGE,
      layout: PRESENTER_SLIDE_LAYOUTS.MEDIA,
      type: "image",
      label,
      title,
      subtitle: versionDisplayName(song, version),
      marker: "",
      text: slide.name || title,
      imageSrc: slide.url,
      asset: { ...asset, kind: asset.kind || "score", url: slide.url, name: slide.name || asset.name || "" },
      ...presenterScoreFormMetadata(sequenced.scoreForms, slideIndex, formWarnings),
      ...(slide.titleSequenceWarning ? { warnings: [...formWarnings, slide.titleSequenceWarning] } : {}),
      scoreBackground: true,
      sourceType: "score",
      componentType: "score",
      sort: index + slideIndex / 100,
    };
  });
}

function presenterImportedDeckSlidesFromAsset(asset, item, section, index, title, label) {
  if (asset?.kind !== "imported_deck") return [];
  const sources = normalizeServiceAssetSlides(asset.slides || asset.images || asset.pages || asset.files || asset.items);
  return sources
    .map((slide, slideIndex) => {
      const source = normalizePresenterMediaSource(slide.url);
      if (!source || !presenterMediaSourceIsImage(source)) return null;
      return {
        id: `${item.id || index}:imported-deck:${slideIndex}`,
        ...section,
        sectionLabel: section.sectionLabel || label || "자료",
        sectionTitle: section.sectionTitle || section.sectionLabel || label || "자료",
        sectionName: presenterNameParts(section.sectionLabel || label, title).join(" / ") || title,
        elementTitle: title,
        elementType: PRESENTER_ELEMENT_TYPES.IMAGE,
        layout: PRESENTER_SLIDE_LAYOUTS.MEDIA,
        type: "image",
        label,
        title,
        marker: slide.name || `Stage ${slideIndex + 1}`,
        text: slide.name || title,
        imageSrc: source,
        ...(asset.pptx?.url && slide.pptx ? {
          pptx: { ...slide.pptx, url: asset.pptx.url },
          hiddenInPresentation: Boolean(slide.pptx.hidden),
        } : {}),
        asset: { ...(asset.pptx ? { kind: asset.kind, pptx: asset.pptx } : asset), url: source, name: slide.name || asset.name || "" },
        importedDeck: {
          manifestUrl: asset.manifestUrl || "",
          fingerprint: asset.fingerprint || "",
          stage: Number(slide.order) || slideIndex + 1,
        },
        sourceType: "imported_deck",
        componentType: "imported_deck",
        sort: index + slideIndex / 100,
      };
    })
    .filter(Boolean);
}

function presenterSyncedLyricsConfigFromAsset(asset = {}) {
  if (asset?.kind !== "synced_lyrics") return null;
  const audioSource = normalizePresenterMediaSource(asset.audio?.url || asset.url || "");
  const pages = Array.isArray(asset.timing?.pages)
    ? asset.timing.pages
      .map((page, index) => ({
        page: Number(page.page || index + 1) || index + 1,
        start: Number(page.start),
      }))
      .filter((page) => Number.isFinite(page.start) && page.start >= 0)
      .sort((a, b) => (a.page || 0) - (b.page || 0))
    : [];
  if (!audioSource || !pages.length) return null;
  return {
    audioSrc: audioSource,
    audioTitle: asset.audio?.name || asset.name || "",
    pages,
    cross: Number.isFinite(Number(asset.timing?.cross)) ? Number(asset.timing.cross) : null,
    duration: Number.isFinite(Number(asset.timing?.duration)) ? Number(asset.timing.duration) : null,
  };
}

function presenterApplySyncedLyricsConfig(slides = [], syncConfig = null, item = {}, index = 0) {
  if (!syncConfig) return slides;
  let lyricIndex = 0;
  const groupId = `${item.id || index}:synced-lyrics`;
  return slides.map((slide) => {
    const isLyricSlide = slide?.type === "lyrics";
    const isIntroTitle = slide?.type === "song-title" && lyricIndex === 0;
    if (!isLyricSlide && !isIntroTitle) return slide;
    if (isLyricSlide) lyricIndex += 1;
    const page = syncConfig.pages[lyricIndex - 1] || null;
    return {
      ...slide,
      syncTimeline: {
        groupId,
        audioSrc: syncConfig.audioSrc,
        audioTitle: syncConfig.audioTitle,
        page: isLyricSlide ? lyricIndex : 0,
        start: isLyricSlide && page ? page.start : null,
        cross: syncConfig.cross,
        duration: syncConfig.duration,
        intro: isIntroTitle,
      },
      sourceType: slide.sourceType || "synced_lyrics",
      componentType: slide.componentType || "synced_lyrics",
    };
  });
}

function presenterScoreImageSourcesForFormSequence(imageSources = [], scoreForms = [], forms = [], item = {}, song = null, version = null) {
  const presetLabels = presenterScoreFormPresetLabels(item, song, version);
  const planTargets = presetLabels
    .map((label) => normalizePresenterFormPresetLabel(label))
    .filter((target) => target.key && target.type !== "lyrics");
  const scoreTargets = (scoreForms || []).map((form) =>
    form ? normalizePresenterFormPresetLabel(presenterFormDisplayLabel(form)) : null,
  );
  if (!planTargets.length) return { imageSources, scoreForms };
  if (!scoreTargets.some((target) => target?.key)) {
    if (!planTargets.some(target => target.type === "title")) return { imageSources, scoreForms };
    // A deck without form labels has no reliable verse boundaries. Keep every
    // page; titles at the ends are unambiguous, internal positions need labels.
    const first = planTargets.findIndex(target => target.type !== "title");
    if (first < 0) return { imageSources: planTargets.map(() => ({ _presenterTitle: true })), scoreForms: [] };
    const last = planTargets.findLastIndex(target => target.type !== "title");
    const ambiguous = planTargets.slice(first, last + 1).some(target => target.type === "title");
    return {
      imageSources: [
        ...planTargets.slice(0, first).map(() => ({ _presenterTitle: true })),
        ...imageSources.map(source => ambiguous ? { ...source, titleSequenceWarning: "악보 송폼 표시가 없어 중간 Title 위치를 확인할 수 없습니다." } : source),
        ...planTargets.slice(last + 1).map(() => ({ _presenterTitle: true })),
      ], scoreForms: [],
    };
  }

  const groups = [];
  imageSources.forEach((source, index) => {
    const target = scoreTargets[index];
    const startsGroup = Boolean(target?.key);
    if (startsGroup || !groups.length) {
      groups.push({ target: target || null, sources: [], forms: [] });
    }
    const group = groups[groups.length - 1];
    group.sources.push(source);
    group.forms.push(scoreForms[index] || null);
  });

  const selected = [];
  const lastMatchedByKey = new Map();
  let cursor = 0;
  planTargets.forEach((target) => {
    if (target.type === "title") {
      selected.push({ sources: [{ _presenterTitle: true }], forms: [null] });
      return;
    }
    const matchIndex = groups.findIndex((group, index) =>
      index >= cursor && group.target && presenterFormTargetsMatch(target, group.target),
    );
    const group = matchIndex >= 0
      ? groups[matchIndex]
      : lastMatchedByKey.get(target.key)
        || (!target.number && target.type ? lastMatchedByKey.get(target.type) : null)
        || groups.find((candidate) => candidate.target && presenterFormTargetsMatch(target, candidate.target));
    if (!group) return;
    selected.push(group);
    lastMatchedByKey.set(target.key, group);
    if (target.type) lastMatchedByKey.set(target.type, group);
    if (matchIndex >= 0) cursor = matchIndex + 1;
  });
  if (!selected.length) return { imageSources, scoreForms };
  // The reviewed 163/166 score decks have a once-only opening page before V1.
  // Verse selection must not drop that unlabelled introduction.
  const opening = groups[0];
  const openingUrl = String(opening?.sources?.[0]?.url || opening?.sources?.[0]?.src || "");
  if (!opening?.target?.key && opening?.sources?.length === 1
      && /(?:^|\/)assets\/hymn-scores\/(163|166)\/slide-01\.webp(?:[?#]|$)/.test(openingUrl)) {
    selected.unshift(opening);
  }
  return {
    imageSources: selected.flatMap((group) => group.sources),
    scoreForms: selected.flatMap((group) => group.forms),
  };
}

function presenterScoreFormPresetLabels(item = {}, song = null, version = null) {
  if (typeof serviceItemFormPresetDisabled === "function" && serviceItemFormPresetDisabled(item)) return [];
  const itemPreset = typeof serviceItemFormPreset === "function" ? serviceItemFormPreset(item) : null;
  const matchedRule = typeof matchedServiceItemFormPresetRule === "function"
    ? matchedServiceItemFormPresetRule(item, song, version)
    : null;
  const songDefaultPreset = presenterSongDefaultFormPreset(song, version);
  return cleanList(
    itemPreset?.forms
    || matchedRule?.formPreset?.forms
    || songDefaultPreset?.forms
    || [],
  );
}

function presenterScoreFormMetadata(forms = [], slideIndex = 0, formWarnings = []) {
  const form = Array.isArray(forms) ? forms[slideIndex] : null;
  if (!form) return formWarnings?.length ? { warnings: formWarnings } : {};
  const formId = form._localId || form.id || slideIndex;
  return {
    formKey: form._presenterScoreFormKey || `${formId}:${slideIndex}`,
    formLabel: presenterResolvedFormMarker(form),
    warnings: formWarnings,
  };
}

function presenterScoreFormsFromImageSources(imageSources = []) {
  return imageSources.map((source, index) => {
    const label = presenterScoreFormLabelFromAssetSlide(source);
    if (!label) return null;
    const target = normalizePresenterFormPresetLabel(label);
    if (!target.key || target.type === "lyrics") return null;
    const partType = presenterFormPartTypeForPresetTarget(target);
    const formKey = String(source.formKey || source.form_key || source.scoreFormKey || source.score_form_key || "").trim()
      || `score:${target.key}:${index}`;
    return {
      _presenterVirtual: true,
      _presenterScoreFormKey: formKey,
      id: formKey,
      part_type: partType,
      part_number: target.number || null,
      label,
      lyrics: label,
    };
  });
}

function presenterScoreFormLabelFromAssetSlide(slide = {}) {
  return normalizePresenterScoreFormLabel(
    slide.formLabel
    || slide.form_label
    || slide.scoreFormLabel
    || slide.score_form_label
    || slide.form
    || "",
  );
}

function normalizePresenterScoreFormLabel(value = "") {
  const raw = String(value || "").trim();
  if (!raw) return "";
  return presenterFormPresetDisplayLabel(raw);
}

function presenterHymnScoreAssetSlides(song = null, version = null, displayText = "") {
  const hymnNo = normalizedHymnScoreNumber(song?.hymn_no || version?.hymn_no || displayText);
  if (!hymnNo) return [];
  const entry = state.hymnScoreManifest?.[hymnNo];
  const slides = Array.isArray(entry?.slides) ? entry.slides : [];
  return slides
    .map((slide, index) => ({
      url: slide.src || slide.url,
      name: slide.name || `${hymnNo} ${entry.title || stripHymnNumber(song?.title || "")} ${index + 1}`,
      formLabel: slide.scoreFormLabel || slide.score_form_label || slide.formLabel || slide.form_label || "",
      formKey: slide.scoreFormKey || slide.score_form_key || slide.formKey || slide.form_key || "",
      order: index + 1,
    }))
    .filter((slide) => slide.url);
}

function normalizedHymnScoreNumber(value = "") {
  const text = String(value || "");
  // The bundled score manifest uses new-hymnal numbers only.
  if (/(?:^|[\s(])통(?:일)?\s*(?:찬송가\s*)?\d/.test(text)) return "";
  const match = text.match(/\d{1,3}/);
  return match ? String(Number(match[0])) : "";
}

function presenterImageSourcesFromAssetUrl(value) {
  const text = String(value || "").trim();
  if (!text) return [];
  return text
    .split(/[\s,|]+/g)
    .map((part) => normalizePresenterMediaSource(part))
    .filter((source) => source && presenterMediaSourceIsImage(source))
    .map((url, index) => ({ url, name: index === 0 ? "" : "", order: index + 1 }));
}

function presenterFormPlanForServiceItem(version = {}, item, song = null) {
  version = version || {};
  const forms = normalizeForms(version.forms || []).filter((form) => normalizeLyricsForCopy(form.lyrics));
  const preset = presenterServiceItemFormPreset(version, item, song);
  const effectivePreset = presenterFormPresetWithAvailableForms(preset, forms);
  if (!effectivePreset?.forms?.length) return { forms: presenterHymnOnceOnlyIntro(forms, version), warnings: [] };
  const resolved = resolvePresenterFormPresetSequence(forms, effectivePreset);
  const warnings = presenterMissingFormWarnings(resolved.missing, forms, effectivePreset);
  const omitUnlisted = presenterFormPresetShouldOmitUnlisted(effectivePreset);
  return {
    forms: presenterHymnOnceOnlyIntro(resolved.items.length
      ? omitUnlisted
        ? resolved.items
        : presenterFormsWithNoSourceOmissions(resolved.items, forms)
      : forms, version),
    warnings,
  };
}

function presenterHymnOnceOnlyIntro(forms = [], version = {}) {
  // These reviewed editions return to the segno AFTER the opening alleluias.
  // Work on the playback plan only; never rewrite saved units or form IDs.
  const count = ({
    "5bf20e2d-cb7e-5c2a-86ca-0a75acfdd7c0": 4, // 새찬송가 163
    "7ab06cc7-99cf-5e67-b236-78a6758734e8": 3, // 새찬송가 166
  })[version?.id];
  if (!count) return forms;
  const prefix = `${Array(count).fill("할렐루야").join(" ")}\n`;
  let playedIntro = false;
  return forms.map((form) => {
    const target = normalizePresenterFormPresetLabel(presenterFormDisplayLabel(form));
    // Explicit A/B segments and user-edited wording are not inferred here.
    if (target.type !== "verse" || target.group || target.variant || !String(form.lyrics || "").startsWith(prefix)) return form;
    if (!playedIntro) {
      playedIntro = true;
      return form;
    }
    return { ...form, lyrics: form.lyrics.slice(prefix.length) };
  });
}

function presenterServiceItemFormPreset(version = {}, item = {}, song = null, { includePlaybackFallback = true } = {}) {
  // Clearing the editable form suppresses stored defaults, not the ordinary
  // verse/chorus playback cycle. Keep the input empty and never persist inference.
  if (serviceItemFormPresetDisabled(item)) {
    const forms = normalizeForms(version?.forms || []).filter((form) => normalizeLyricsForCopy(form.lyrics));
    return includePlaybackFallback ? presenterDefaultVerseChorusFormPreset(forms, song, version) : null;
  }
  const itemPreset = serviceItemFormPreset(item);
  // Defaults only fill an empty item; a stored sequence keeps its playback order.
  if (itemPreset?.forms?.length) {
    const saved = { ...itemPreset, strength: "manual" };
    return isPresenterSpecialSongItem(item)
      && versionEffectivePraiseTypes(song, version).includes("hymn")
      ? presenterSpecialSongHymnDisplayPreset(saved)
      : saved;
  }
  const forms = normalizeForms(version?.forms || []).filter((form) => normalizeLyricsForCopy(form.lyrics));
  const isHymn = versionEffectivePraiseTypes(song, version).includes("hymn");
  const matchedRule = matchedServiceItemFormPresetRule(item, song, version);
  const songDefaultPreset = presenterSongDefaultFormPreset(song, version);
  const specialHymnRulePreset = presenterSpecialSongHymnFormPreset(item, song, version, matchedRule);
  return isHymn
    ? specialHymnRulePreset
      || matchedRule?.formPreset
      || songDefaultPreset
      || itemPreset
      || (includePlaybackFallback && presenterDefaultVerseChorusFormPreset(forms, song, version))
      || null
    : matchedRule?.formPreset
      || presenterExplicitNonHymnFormPreset(songDefaultPreset)
      || itemPreset
      || (includePlaybackFallback && presenterDefaultVerseChorusFormPreset(forms, song, version))
      || null;
}

function presenterMissingFormWarnings(missing = [], forms = [], preset = null) {
  if (preset?.omitMissingForms) return [];
  const strength = String(preset?.strength || "").trim().toLowerCase();
  const automaticPreset = ["auto", "default", "suggested"].includes(strength);
  const sourceHasChorus = normalizeForms(forms || [])
    .filter((form) => normalizeLyricsForCopy(form.lyrics))
    .some((form) => normalizePresenterFormPresetLabel(presenterFormDisplayLabel(form)).type === "chorus");
  return cleanList(missing)
    .filter((label) => {
      const target = normalizePresenterFormPresetLabel(label);
      return !(automaticPreset && target.type === "chorus" && !sourceHasChorus);
    })
    .map((label) => `${label} 없음`);
}

function presenterSpecialSongHymnFormPreset(item = {}, song = null, version = null, matchedRule = null) {
  if (!isPresenterSpecialSongItem(item)) return null;
  const isHymn = versionEffectivePraiseTypes(song, version).includes("hymn")
    || Boolean(song?.hymn_no || version?.hymn_no);
  if (!isHymn) return null;
  return presenterSpecialSongHymnDisplayPreset(matchedRule?.formPreset || normalizeServiceFormPreset(
    PUBLIC_SPECIAL_HYMN_FORM_PRESET_FORMS,
    PUBLIC_SPECIAL_HYMN_FORM_PRESET_HINT,
    "default",
  ));
}

function presenterSpecialSongHymnDisplayPreset(preset = null) {
  if (!preset?.forms?.length) return preset;
  const forms = cleanList(preset.forms).map((label) => {
    const target = normalizePresenterFormPresetLabel(label);
    if (target.lastVerse) return "VL";
    if (target.variant) return String(label || "").trim();
    if (target.type === "verse" && target.number && !target.group) return `V${target.number}`;
    if (target.type === "chorus" && !target.group) return target.number ? `C${target.number}` : "C";
    if (target.type === "instrumental") return "Int";
    return String(label || "").trim();
  });
  return {
    ...preset,
    forms,
    hint: forms.join("-"),
    omitUnlisted: true,
    omitMissingForms: true,
  };
}

function presenterFormPresetShouldOmitUnlisted(preset = null) {
  if (preset?.omitUnlisted) return true;
  const strength = String(preset?.strength || "").trim().toLowerCase();
  return ["default", "forced", "manual", "song-default"].includes(strength);
}

function presenterFormsWithNoSourceOmissions(plannedForms = [], sourceForms = []) {
  const source = normalizeForms(sourceForms || []).filter((form) => normalizeLyricsForCopy(form.lyrics));
  const identity = (form) => String(form?._localId || form?.id || "").trim();
  const sourceIndexes = new Map(source.map((form, index) => [identity(form), index]).filter(([id]) => id));
  if (!sourceIndexes.size) return plannedForms;

  const merged = [...plannedForms];
  const present = new Set(merged.map(identity).filter(Boolean));
  source.forEach((form) => {
    const id = identity(form);
    if (!id || present.has(id)) return;
    const sourceIndex = sourceIndexes.get(id);
    const insertAt = merged.findIndex((candidate) => {
      const candidateIndex = sourceIndexes.get(identity(candidate));
      return Number.isFinite(candidateIndex) && candidateIndex > sourceIndex;
    });
    merged.splice(insertAt < 0 ? merged.length : insertAt, 0, form);
    present.add(id);
  });
  return merged;
}

function presenterExplicitNonHymnFormPreset(preset = null) {
  if (!preset?.forms?.length && !preset?.titleSequence) return null;
  return String(preset.strength || "").trim().toLowerCase() === "suggested" ? null : preset;
}

function presenterFormPresetWithAvailableForms(preset = null, forms = []) {
  if (!preset?.forms?.length) return preset;
  const source = normalizeForms(forms || [])
    .filter((form) => normalizeLyricsForCopy(form.lyrics))
    .map((form) => ({ form, target: normalizePresenterFormPresetLabel(presenterFormDisplayLabel(form)) }))
    .filter(({ target }) => target.key && target.type !== "lyrics");
  if (!source.length) return preset;

  const originalTargets = cleanList(preset.forms).map((label) => normalizePresenterFormPresetLabel(label));
  const genericVerseChorusPreset = originalTargets.length
    && originalTargets.every((target) => target.type === "verse" || target.type === "chorus");
  const presetStrength = String(preset?.strength || "").trim().toLowerCase();
  const exactFormPreset = ["manual", "forced", "default", "song-default"].includes(presetStrength);
  const canPreserveSupplementalForms = genericVerseChorusPreset && !exactFormPreset;
  const base = presenterRepeatableVerseChorusPresetForms(preset, source) || cleanList(preset.forms);
  const merged = [];
  let sourceIndex = 0;
  base.forEach((label) => {
    const target = normalizePresenterFormPresetLabel(label);
    if (target.groupIndex && !target.variant) {
      merged.push(label);
      return;
    }
    if (target.lastVerse) {
      const lastVerse = source
        .map((candidate, index) => ({ ...candidate, index }))
        .filter(({ target: candidate }) => candidate.type === "verse")
        .reduce((best, candidate) => {
          if (!best) return candidate;
          const bestNumber = Number(best.target.number) || 0;
          const candidateNumber = Number(candidate.target.number) || 0;
          if (candidateNumber > bestNumber) return candidate;
          if (candidateNumber === bestNumber && candidate.index > best.index) return candidate;
          return best;
        }, null);
      if (lastVerse) {
        sourceIndex = Math.max(sourceIndex, lastVerse.index + 1);
        merged.push(presenterFormDisplayLabel(lastVerse.form));
        return;
      }
    }
    const matchIndex = source.findIndex(({ target: candidate }, index) => index >= sourceIndex && presenterFormTargetsMatch(target, candidate));
    if (matchIndex >= sourceIndex) {
      if (canPreserveSupplementalForms) {
        source.slice(sourceIndex, matchIndex).forEach(({ form, target: candidate }) => {
          if (presenterSupplementalFormType(candidate)) merged.push(presenterFormDisplayLabel(form));
        });
      }
      sourceIndex = matchIndex + 1;
      merged.push(presenterFormDisplayLabel(source[matchIndex].form));
      return;
    }
    merged.push(label);
  });

  if (preset.omitUnlisted) {
    const original = cleanList(preset.forms);
    if (merged.length === original.length && merged.every((label, index) => label === original[index])) return preset;
    return {
      ...preset,
      forms: original,
      sourceForms: merged,
      hint: original.join("-"),
    };
  }

  // Preserve endings and bridges only for inferred generic sequences such as VCVC.
  // User/default/forced presets must render exactly as written.
  if (canPreserveSupplementalForms) {
    let includeFollowingChorus = false;
    source.slice(sourceIndex).forEach(({ form, target }) => {
      if (presenterSupplementalFormType(target)) {
        merged.push(presenterFormDisplayLabel(form));
        includeFollowingChorus = target.type === "bridge" || target.type === "pre-chorus";
        return;
      }
      if (includeFollowingChorus && target.type === "chorus") {
        merged.push(presenterFormDisplayLabel(form));
        includeFollowingChorus = false;
      }
    });
  }

  const hasPreChorus = source.some(({ target }) => target.type === "pre-chorus");
  const formsWithPreChorus = canPreserveSupplementalForms && hasPreChorus
    ? presenterInsertPreChorusBeforeChoruses(merged)
    : merged;
  const original = cleanList(preset.forms);
  if (formsWithPreChorus.length === original.length && formsWithPreChorus.every((label, index) => label === original[index])) return preset;
  return {
    ...preset,
    forms: formsWithPreChorus,
    hint: formsWithPreChorus.join("-"),
  };
}

function presenterRepeatableVerseChorusPresetForms(preset = null, source = []) {
  const strength = String(preset?.strength || "").trim().toLowerCase();
  if (["default", "forced", "manual", "song-default"].includes(strength)) return null;
  const presetForms = cleanList(preset?.forms);
  const targets = presetForms.map((label) => normalizePresenterFormPresetLabel(label));
  const core = targets.filter((target) => target.type !== "pre-chorus");
  const alternating = core.length >= 2
    && core.every((target, index) => target.type === (index % 2 === 0 ? "verse" : "chorus"));
  if (!alternating) return null;

  const verses = source.filter(({ target }) => target.type === "verse");
  const choruses = source.filter(({ target }) => target.type === "chorus");
  if (!verses.length || !choruses.length) return null;

  const preChoruses = source.filter(({ target }) => target.type === "pre-chorus");
  const presetChorusCount = targets.filter((target) => target.type === "chorus").length;
  const cycles = Math.max(verses.length, choruses.length, presetChorusCount);
  const expanded = [];
  for (let index = 0; index < cycles; index += 1) {
    expanded.push(presenterFormDisplayLabel(verses[index % verses.length].form));
    if (preChoruses.length) expanded.push(presenterFormDisplayLabel(preChoruses[index % preChoruses.length].form));
    expanded.push(presenterFormDisplayLabel(choruses[index % choruses.length].form));
  }
  return expanded;
}

function presenterFormTargetsMatch(target = {}, candidate = {}) {
  if (target.key === candidate.key) return true;
  if (target.variant || candidate.variant) return false;
  return Boolean(target.type && target.type === candidate.type && (!target.number || target.number === candidate.number));
}

function presenterSupplementalFormType(target = {}) {
  return !["", "verse", "chorus", "lyrics"].includes(String(target.type || ""));
}

function presenterInsertPreChorusBeforeChoruses(forms = []) {
  return cleanList(forms).flatMap((label, index, list) => {
    const target = normalizePresenterFormPresetLabel(label);
    const previous = normalizePresenterFormPresetLabel(list[index - 1] || "");
    if (target.type === "chorus" && previous.type !== "pre-chorus") return ["PC", label];
    return [label];
  });
}

function presenterSongDefaultFormPreset(song = null, version = null) {
  const versionMeta = normalizeSongMetadata(version?.metadata);
  const songMeta = normalizeSongMetadata(song?.metadata);
  return versionMeta.presenter_form || songMeta.presenter_form || null;
}

function presenterDefaultVerseChorusFormPreset(forms = [], song = null, version = null) {
  const praiseTypes = versionEffectivePraiseTypes(song, version);
  if (!praiseTypes.includes("hymn") && !praiseTypes.includes("ccm")) return null;
  const normalizedForms = normalizeForms(forms || []);
  const verses = normalizedForms.filter((form) => normalizePresenterFormPresetLabel(presenterFormDisplayLabel(form)).type === "verse");
  const chorus = normalizedForms.find((form) => normalizePresenterFormPresetLabel(presenterFormDisplayLabel(form)).type === "chorus");
  if (!verses.length || !chorus) return null;
  const presetForms = [];
  verses.forEach((verse, index) => {
    const target = normalizePresenterFormPresetLabel(presenterFormDisplayLabel(verse));
    presetForms.push(target.number ? `V${target.number}` : index === 0 ? "V" : `V${index + 1}`);
    presetForms.push("C");
  });
  const hymnCoda = normalizedForms.find((form) => {
    const target = normalizePresenterFormPresetLabel(presenterFormDisplayLabel(form));
    return target.type === "coda";
  });
  if (hymnCoda) presetForms.push("Coda");
  return normalizeServiceFormPreset(presetForms, presetForms.join("-"), "auto");
}

function matchedServiceItemFormPresetRule(item, song, version) {
  return serviceItemFormPresetRules(item).find((rule) => serviceItemFormPresetRuleMatches(rule, item, song, version)) || null;
}

function serviceItemFormPresetRuleMatches(rule = {}, item = {}, song = null, version = null) {
  const when = rule.when && typeof rule.when === "object" ? rule.when : {};
  const songType = String(when.songType || when.song_type || when.praiseType || when.praise_type || "").trim();
  if (songType) {
    const requiredTypes = normalizePraiseTypes(songType);
    const versionTypes = versionEffectivePraiseTypes(song, version);
    if (requiredTypes.length && !requiredTypes.some((type) => versionTypes.includes(type))) return false;
  }
  const sectionKey = String(when.sectionKey || when.section_key || "").trim();
  if (sectionKey && sectionKey !== String(item?._worshipSectionKey || "").trim()) return false;
  const label = String(when.label || "").trim();
  if (label && compactSearchValue(label) !== compactSearchValue(item?.label || "")) return false;
  return true;
}

function resolvePresenterFormPresetSequence(forms = [], preset = []) {
  const presetForms = Array.isArray(preset) ? preset : cleanList(preset?.forms);
  const sourceForms = Array.isArray(preset) ? [] : cleanList(preset?.sourceForms);
  if (presenterFormsAreUnsplitLyrics(forms)) {
    const lyricsResolved = resolvePresenterLyricsFormPresetSequence(forms, presetForms, sourceForms);
    if (lyricsResolved.items.length) return lyricsResolved;
  }
  const items = [];
  const missing = [];
  cleanList(presetForms).forEach((label, index) => {
    const resolved = findPresenterFormForPresetLabel(forms, sourceForms[index] || label);
    if (resolved) items.push({ ...resolved, _presenterPresetLabel: presenterResolvedPresetLabel(label) });
    else missing.push(normalizePresenterMissingFormLabel(label));
  });
  return { items, missing };
}

function presenterResolvedPresetLabel(label = "") {
  const raw = String(label || "").trim();
  if (isPresenterKoreanHymnPresetLabel(raw)) return raw;
  return normalizePresenterMissingFormLabel(raw);
}

function presenterFormsAreUnsplitLyrics(forms = []) {
  const normalizedForms = normalizeForms(forms || []).filter((form) => normalizeLyricsForCopy(form.lyrics));
  return Boolean(normalizedForms.length) && normalizedForms.every((form) => normalizePresenterFormPresetLabel(presenterFormDisplayLabel(form)).type === "lyrics");
}

function resolvePresenterLyricsFormPresetSequence(forms = [], presetForms = [], sourceForms = [], providedBlocks = null) {
  const blocks = providedBlocks || presenterLyricsBlocksFromForms(forms);
  const blockBySourceKey = new Map();
  const sourceBlockIndexes = new Set();
  let sourceIndex = 0;
  cleanList(sourceForms).forEach((label) => {
    const target = normalizePresenterFormPresetLabel(label);
    if (target.type === "title") return;
    const index = sourceIndex++;
    if (!target.key || target.blank || blockBySourceKey.has(target.key)) return;
    const block = blocks[index];
    if (block) {
      blockBySourceKey.set(target.key, block);
      sourceBlockIndexes.add(index);
    }
  });
  const items = [];
  const missing = [];
  const assigned = new Map();
  let blockIndex = 0;
  cleanList(presetForms).forEach((label, index) => {
    const target = normalizePresenterFormPresetLabel(label);
    if (!target.key) return;
    if (target.type === "title") {
      items.push(findPresenterFormForPresetLabel([], "Title"));
      return;
    }
    if (target.blank) {
      items.push(presenterBlankFormPresetItem(label, target));
      return;
    }
    const assignedForm = assigned.get(target.key);
    if (assignedForm) {
      items.push({ ...assignedForm, id: `${assignedForm.id}:repeat:${index}` });
      return;
    }
    const sourceBlock = blockBySourceKey.get(target.key);
    while (!sourceBlock && sourceBlockIndexes.has(blockIndex)) blockIndex += 1;
    const block = sourceBlock || blocks[blockIndex];
    if (!block) {
      missing.push(normalizePresenterMissingFormLabel(label));
      return;
    }
    if (!sourceBlock) {
      blockIndex += 1;
    }
    const form = presenterVirtualFormPresetItem(label, target, block, index);
    assigned.set(target.key, form);
    items.push(form);
  });
  return { items, missing };
}

function presenterLyricsBlocksFromForms(forms = []) {
  return normalizeForms(forms || [])
    .flatMap((form) => String(form.lyrics || "").split(/\n\s*\n/g))
    .map((block) => normalizeLyricsForCopy(block))
    .filter(Boolean);
}

function presenterVirtualFormPresetItem(label = "", target = {}, lyrics = "", index = 0) {
  const partType = presenterFormPartTypeForPresetTarget(target);
  const partNumber = target.number || null;
  const cleanLabel = String(label || "").trim();
  const repeatedLyrics = presenterRepeatLyricsForPresetTarget(lyrics, target);
  return {
    _presenterVirtual: true,
    id: `preset-form:${target.key || compactSearchValue(cleanLabel) || index}`,
    part_type: partType,
    part_number: partNumber,
    lyrics: repeatedLyrics,
    label: cleanLabel || (partNumber ? `${partType} ${partNumber}` : partType),
  };
}

function presenterFormPartTypeForPresetTarget(target = {}) {
  const type = String(target.type || "").trim();
  if (type === "verse") return "Verse";
  if (type === "chorus") return "Chorus";
  if (type === "tag") return "Chorus";
  if (type === "bridge") return "Bridge";
  if (type === "pre-chorus") return "Pre-Chorus";
  if (type === "coda") return "Coda";
  if (type === "lyrics") return "Lyrics";
  return PART_TYPES.includes(target.rawType) ? target.rawType : "Lyrics";
}

function findPresenterFormForPresetLabel(forms = [], label = "") {
  const target = normalizePresenterFormPresetLabel(label);
  if (!target.key) return null;
  if (target.type === "title") return { _presenterTitle: true, id: "preset-title", label: "Title", lyrics: "" };
  if (target.blank) return presenterBlankFormPresetItem(label, target);
  if (target.type === "tag") {
    const chorus = findPresenterFormForPresetTarget(forms, { key: "chorus", type: "chorus" });
    return chorus ? presenterTagFormPresetItem(label, target, chorus) : null;
  }
  if (target.lastVerse) {
    const verses = forms
      .map((form, index) => ({ form, index, target: normalizePresenterFormPresetLabel(presenterFormDisplayLabel(form)) }))
      .filter(({ target }) => target.type === "verse");
    if (!verses.length) return null;
    return verses.reduce((best, candidate) => {
      const bestNumber = Number(best.target.number) || 0;
      const candidateNumber = Number(candidate.target.number) || 0;
      if (candidateNumber > bestNumber) return candidate;
      if (candidateNumber === bestNumber && candidate.index > best.index) return candidate;
      return best;
    }).form;
  }
  if (target.groupIndex && !target.variant) {
    const explicit = forms.find((form) => {
      const candidate = normalizePresenterFormPresetLabel(presenterFormDisplayLabel(form));
      return !candidate.variant && candidate.type === target.type
        && candidate.group === target.group && (!target.number || candidate.number === target.number);
    });
    if (explicit) return explicit;
    const form = findPresenterFormForPresetTarget(forms, target);
    return form ? presenterFormPresetGroupItem(label, target, form) : null;
  }
  return findPresenterFormForPresetTarget(forms, target);
}

function presenterTagFormPresetItem(label = "", target = {}, form = {}) {
  const lines = String(form.lyrics || "")
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean);
  const lyrics = presenterRepeatLyricsForPresetTarget(lines[lines.length - 1] || "", target);
  if (!lyrics) return null;
  const cleanLabel = String(label || "").trim() || "Tag";
  const baseId = String(form._localId || form.id || target.key || "tag");
  return {
    ...form,
    _presenterVirtual: true,
    _presenterSourceFormId: form._localId || form.id || "",
    id: `${baseId}:tag`,
    part_type: "Chorus",
    part_number: null,
    lyrics,
    label: cleanLabel,
  };
}

function presenterRepeatLyricsForPresetTarget(lyrics = "", target = {}) {
  const text = normalizeLyricsForCopy(lyrics);
  const repeat = Number(target?.repeat) || 1;
  if (!text || repeat <= 1) return text;
  return Array.from({ length: Math.min(repeat, 12) }, () => text).join("\n");
}

function findPresenterFormForPresetTarget(forms = [], target = {}) {
  const sameType = [];
  for (const form of forms) {
    const candidate = normalizePresenterFormPresetLabel(presenterFormDisplayLabel(form));
    if (target.type && target.type === candidate.type) sameType.push({ form, target: candidate });
    if (target.key === candidate.key) return form;
    if (!target.variant && !candidate.variant && (!target.group || !candidate.group) && target.type && target.type === candidate.type && (!target.number || target.number === candidate.number)) return form;
  }
  // A single verse is stored without a number; V1 still denotes that first verse.
  if (target.type === "verse" && target.number === 1 && sameType.length === 1 && !sameType[0].target.number) {
    return sameType[0].form;
  }
  if (target.groupIndex && !target.variant && target.type) {
    const unnumbered = sameType.filter(({ target: candidate }) => !candidate.number && !candidate.group && !candidate.variant);
    if (unnumbered.length === 1) return unnumbered[0].form;
  }
  return null;
}

function presenterFormPresetGroupItem(label = "", target = {}, form = {}) {
  const chunks = presenterGroupedLyricChunks(form.lyrics, target);
  const lyrics = chunks[(Number(target.groupIndex) || 1) - 1] || "";
  if (!lyrics) return null;
  const cleanLabel = String(label || "").trim();
  const baseId = String(form._localId || form.id || target.key || compactSearchValue(cleanLabel) || "form");
  return {
    ...form,
    _presenterVirtual: true,
    _presenterSourceFormId: form._localId || form.id || "",
    id: `${baseId}:group:${target.group || target.groupIndex}`,
    lyrics,
    label: cleanLabel || presenterFormDisplayLabel(form),
  };
}

function presenterGroupedLyricChunks(lyrics = "", target = {}) {
  const groupIndex = Number(target?.groupIndex) || 0;
  if (!groupIndex) return splitPresenterLyricChunks(lyrics);
  const sourceLines = String(lyrics || "").replace(/\r\n?/g, "\n").split("\n").map((line) => line.trim());
  const lineIndexes = sourceLines.flatMap((line, index) => line ? [index] : []);
  if (lineIndexes.length < 2) return lineIndexes.map((index) => sourceLines[index]);
  // Keep the established A/B line selection, including authored paragraph breaks inside it.
  const chunkSize = Math.max(1, Math.ceil(lineIndexes.length / Math.max(groupIndex, 2)));
  const chunks = [];
  for (let index = 0; index < lineIndexes.length; index += chunkSize) {
    const selected = lineIndexes.slice(index, index + chunkSize);
    chunks.push(sourceLines.slice(selected[0], selected.at(-1) + 1).join("\n"));
  }
  return chunks;
}

function presenterFormDisplayLabel(form = {}) {
  if (form._presenterVirtual && form._presenterSourceFormId) return presenterFormPresetDisplayLabel(form.label) || String(form.label || "").trim() || displayLabel(form);
  if (form._presenterVirtual) return displayLabel(form);
  return presenterFormPresetDisplayLabel(form.label) || String(form.label || "").trim() || displayLabel(form);
}

function normalizePresenterFormPresetLabel(value = "") {
  const raw = canonicalServiceFormToken(value);
  const compact = compactSearchValue(raw);
  if (raw === "Title") return { key: "title", type: "title", number: 0 };
  const lastVerse = /^(vl|마지막절|lastverse|last)$/i.test(compact);
  if (lastVerse) return { key: "last-verse", type: "verse", number: 0, lastVerse: true };
  const hymnVerse = raw.match(/^(\d+)\s*절$/u);
  if (hymnVerse) return { key: `verse:${hymnVerse[1]}`, type: "verse", number: Number(hymnVerse[1]) };
  const atVariant = raw.match(/^(v|verse|c|chorus|후렴|pc|prechorus|pre-chorus|b|bridge|coda|ending|lyrics)\s*(\d*)\s*@\s*([a-z])?$/i);
  if (atVariant) {
    const token = atVariant[1].toLowerCase();
    const type = /^(v|verse)$/.test(token) ? "verse"
      : /^(c|chorus|후렴)$/.test(token) ? "chorus"
        : /^(b|bridge)$/.test(token) ? "bridge"
          : /^(pc|prechorus|pre-chorus)$/.test(token) ? "pre-chorus"
            : /^(coda|ending)$/.test(token) ? "coda" : "lyrics";
    const number = atVariant[2] ? Number(atVariant[2]) : 0;
    const group = atVariant[3] ? atVariant[3].toUpperCase() : "";
    const baseKey = number ? `${type}:${number}` : type;
    return {
      key: `${baseKey}:@${group ? `:${group.toLowerCase()}` : ""}`,
      type,
      number,
      variant: true,
      ...(group ? { group } : {}),
    };
  }
  const shorthand = raw.match(/^(v|verse)\s*(\d*)\s*([a-z])?$/i);
  if (shorthand) {
    const number = shorthand[2] ? Number(shorthand[2]) : 0;
    const group = shorthand[3] ? shorthand[3].toUpperCase() : "";
    const baseKey = number ? `verse:${number}` : "verse";
    return {
      key: group ? `${baseKey}:${group.toLowerCase()}` : baseKey,
      type: "verse",
      number,
      ...(group ? { group, groupIndex: group.charCodeAt(0) - 64 } : {}),
    };
  }
  const chorus = raw.match(/^(c|chorus|후렴)\s*(\d*)\s*([a-z])?$/i);
  if (chorus) {
    const number = chorus[2] ? Number(chorus[2]) : 0;
    const group = chorus[3] ? chorus[3].toUpperCase() : "";
    const baseKey = number ? `chorus:${number}` : "chorus";
    return {
      key: group ? `${baseKey}:${group.toLowerCase()}` : baseKey,
      type: "chorus",
      number,
      ...(group ? { group, groupIndex: group.charCodeAt(0) - 64 } : {}),
    };
  }
  const groupedType = raw.match(/^(pc|prechorus|pre-chorus|b|bridge|lyrics|coda|ending)\s*(\d*)\s*([a-z])?$/i);
  if (groupedType) {
    const type = normalizePresenterFormType(groupedType[1]);
    const number = groupedType[2] ? Number(groupedType[2]) : 0;
    const group = groupedType[3] ? groupedType[3].toUpperCase() : "";
    const baseKey = number ? `${type}:${number}` : type;
    return {
      key: group ? `${baseKey}:${group.toLowerCase()}` : baseKey,
      type,
      number,
      ...(group ? { group, groupIndex: group.charCodeAt(0) - 64 } : {}),
    };
  }
  if (/^(int|간주|interlude|instrumental)\s*[a-z]?$/i.test(raw)) {
    return { key: "instrumental", type: "instrumental", number: 0, blank: true };
  }
  const tags = raw.match(/^(tags)$/i);
  if (tags) {
    return { key: "tag", type: "tag", number: 0, repeat: 2 };
  }
  const tag = raw.match(/^(tag)\s*[a-z]?$/i);
  if (tag) {
    return { key: "tag", type: "tag", number: 0 };
  }
  const display = raw.match(/^([A-Za-z][A-Za-z -]*?)(?:\s+(\d+))?(?:\s+([a-z]))?$/);
  if (display) {
    const type = normalizePresenterFormType(display[1]);
    const number = display[2] ? Number(display[2]) : 0;
    const group = display[3] ? display[3].toUpperCase() : "";
    const baseKey = number ? `${type}:${number}` : type;
    return {
      key: group ? `${baseKey}:${group.toLowerCase()}` : baseKey,
      type,
      number,
      ...(group ? { group, groupIndex: group.charCodeAt(0) - 64 } : {}),
    };
  }
  return { key: compact, type: compact, number: 0 };
}

function normalizePresenterFormType(value = "") {
  const compact = compactSearchValue(value);
  if (/^verse$/i.test(compact)) return "verse";
  if (/^(chorus|후렴)$/i.test(compact)) return "chorus";
  if (/^(b|bridge)$/i.test(compact)) return "bridge";
  if (/^pc$/i.test(compact)) return "pre-chorus";
  if (/^prechorus$/i.test(compact)) return "pre-chorus";
  if (/^(coda|ending)$/i.test(compact)) return "coda";
  if (/^tag$/i.test(compact)) return "tag";
  if (/^lyrics$/i.test(compact)) return "lyrics";
  if (/^(int|interlude|instrumental|간주)$/i.test(compact)) return "instrumental";
  return compact;
}

function presenterFormPresetDisplayLabel(value = "") {
  const raw = String(value || "").trim();
  if (!raw) return "";
  const target = normalizePresenterFormPresetLabel(raw);
  const group = String(target.group || "").trim().toUpperCase();
  const suffix = target.variant ? `${target.number ? ` ${target.number}` : ""} @${group ? ` ${group}` : ""}` : target.number ? ` ${target.number}${group ? ` ${group}` : ""}` : group ? ` ${group}` : "";
  if (target.type === "title") return "Title";
  if (target.lastVerse) return "Last Verse";
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

function normalizePresenterMissingFormLabel(value = "") {
  const raw = String(value || "").trim();
  const target = normalizePresenterFormPresetLabel(raw);
  if (target.lastVerse) return "마지막 절";
  if (target.type === "verse" && target.number) return `${target.number}절`;
  if (target.key === "chorus") return "C";
  if (target.key === "bridge") return "Bridge";
  if (target.key === "pre-chorus") return "Pre-Chorus";
  if (target.type === "coda") return presenterFormPresetDisplayLabel(raw);
  if (target.key === "tag") return "Tag";
  return raw || "송폼";
}

function presenterBlankFormPresetItem(label = "", target = {}) {
  const text = String(label || "").trim() || "빈 화면";
  return {
    _presenterBlank: true,
    _presenterToken: target.key || compactSearchValue(text) || "blank",
    id: `preset-blank:${target.key || compactSearchValue(text) || "blank"}`,
    part_type: text,
    part_number: null,
    lyrics: "",
    label: text,
  };
}

function isConfessionPrayerLabel(...values) {
  return values.some((value) => {
    const compact = compactSearchValue(value);
    return compact === "참회기도" || compact === "참회의기도";
  });
}

function isAbsolutionDeclarationLabel(...values) {
  return values.some((value) => compactSearchValue(value) === "사죄의선언");
}

function isConfessionPrayerServiceItem(item = {}) {
  return (String(item?._worshipSectionKey || "").trim() === "confession"
      && !isAbsolutionDeclarationLabel(item?.label, item?.raw_title, item?._worshipSectionTitle))
    || isConfessionPrayerLabel(item?.label, item?.raw_title, item?._worshipSectionTitle);
}

function isConfessionPrayerElement(element = {}, section = {}, sourceRef = {}) {
  return (String(section?.section_key || "").trim() === "confession"
      && !isAbsolutionDeclarationLabel(sourceRef?.label, section?.title, element?.title))
    || isConfessionPrayerLabel(sourceRef?.label, section?.title, element?.title);
}

function presenterConfessionPrayerSlide(item, section, index) {
  return presenterTitleOnlySlide(item, section, index, "참회기도");
}

function presenterTitleOnlySlide(item, section, index, titleText = "") {
  const title = String(titleText || item?.raw_title || item?.label || "제목").trim();
  return {
    id: `${item?.id || index}:title`,
    ...section,
    sectionLabel: item?.label || section.sectionLabel || title,
    sectionTitle: title,
    sectionName: title,
    elementType: PRESENTER_ELEMENT_TYPES.TITLE_ASSIGNEE,
    layout: PRESENTER_SLIDE_LAYOUTS.LOWER_BAR_TEXT,
    type: "title-assignee",
    label: item?.label || "",
    title,
    assignee: "",
    marker: "",
    text: title,
    sort: index,
  };
}

function isLiturgicalBodyServiceItem(item = {}) {
  // Section headings are shared by siblings; they cannot turn a saved praise
  // item into a creed/prayer and bypass its selected version and form sequence.
  if (serviceMemoElementType(parseServiceItemMemo(item.memo)) === "praise"
    || isSongServiceLabel(item.label) || isSpecialSongServiceItem(item)) return false;
  const sectionKey = String(item?._worshipSectionKey || "").trim();
  if (sectionKey === "creed" || sectionKey === "lords_prayer" || sectionKey === "community_confession") return true;
  return isLiturgicalBodyLabel(item?.label, item?.raw_title, item?._worshipSectionTitle)
    || isAnnouncementTextInputItem(item);
}

function isLiturgicalBodyLabel(...values) {
  return values.some((value) => {
    const compact = compactSearchValue(value);
    return compact === "사도신경" || compact === "신앙고백" || compact === "주기도문" || compact === "공동체고백";
  });
}

function liturgicalBodyTitle(item = {}) {
  const label = compactSearchValue(item?.label || "");
  const title = compactSearchValue(item?.raw_title || "");
  if (isAnnouncementTextInputItem(item)) return "광고";
  if (label === "주기도문" || title === "주기도문" || String(item?._worshipSectionKey || "") === "lords_prayer") return "주기도문";
  if (label === "공동체고백" || title === "공동체고백" || String(item?._worshipSectionKey || "") === "community_confession") return "공동체고백";
  return "사도신경";
}

function presenterCircledNumber(index) {
  const circledNumbers = ["①", "②", "③", "④", "⑤", "⑥", "⑦", "⑧", "⑨", "⑩", "⑪", "⑫", "⑬", "⑭", "⑮", "⑯", "⑰", "⑱", "⑲", "⑳"];
  return circledNumbers[index] || `${index + 1}.`;
}

function presenterAnnouncementItems(text = "") {
  const items = [];
  let current = null;

  String(text || "")
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .forEach((line) => {
      const match = window.MindexInlineText.listLine(line,true);
      if (match) {
        const numericIndex = match.number-1;
        current = {
          marker: Number.isInteger(numericIndex) && numericIndex >= 0 ? presenterCircledNumber(numericIndex) : "",
          lines: [match.body],
        };
        items.push(current);
        return;
      }
      if (current) {
        current.lines.push(line.replace(/^　 /u,""));
        return;
      }
      current = { marker: "", lines: [line] };
      items.push(current);
    });

  return items.filter((item) => item.lines.some((line) => line.trim()));
}

function presenterAnnouncementBodyText(text = "") {
  return presenterAnnouncementItems(text)
    .flatMap((item) => item.lines.map((line, index) => (index === 0 && item.marker ? `${item.marker} ${line}` : line)))
    .join("\n");
}

function liturgicalBodyText(item = {}, memo = parseServiceItemMemo(item?.memo), displayText = "") {
  const title = liturgicalBodyTitle(item);
  const canonical = presenterCanonicalLiturgicalBodyText(title);
  if (canonical && !item?.template_modified && !item?.templateModified) return canonical;
  const announcement = isAnnouncementTextInputItem(item);
  if (memo.slides?.length) {
    const memoText = memo.slides.join("\n\n");
    return announcement ? presenterAnnouncementBodyText(memoText) : memoText.trim();
  }
  const text = String(item?.raw_title || displayText || "");
  if (!text.trim() || compactSearchValue(text) === compactSearchValue(title)) return "";
  return announcement ? presenterAnnouncementBodyText(text) : canonical || text.trim();
}

function presenterCanonicalLiturgicalBodyText(title = "") {
  const key = compactSearchValue(title);
  if (key === "주기도문") return PRESENTER_PUBLIC_LORDS_PRAYER_TEXT;
  if (key === "공동체고백") return PRESENTER_PUBLIC_COMMUNITY_CONFESSION_TEXT;
  if (key === "사도신경" || key === "신앙고백") return PRESENTER_PUBLIC_APOSTLES_CREED_TEXT;
  return "";
}

function liturgicalBodyTextHighlights(item = {}, memo = parseServiceItemMemo(item?.memo)) {
  const explicit = normalizeServiceTextHighlights(memo?.textHighlights || memo?.text_highlights || memo?.highlights);
  if (explicit.length) return explicit;
  if (liturgicalBodyTitle(item) !== "공동체고백") return [];
  return [
    { text: "하나님의 거룩한 백성", bold: true },
    { text: "그리스도의 제자", bold: true },
    { text: "성령 충만한", bold: true },
    { text: "은혜에 빚진", bold: true },
    { text: "예배자", color: "#FFC832", bold: true },
    { text: "훈련자", color: "#C8FF32", bold: true },
    { text: "전도자", color: "#FF96C8", bold: true },
    { text: "치유자", color: "#FF6432", bold: true },
    { text: "화해자", color: "#32C8FF", bold: true },
    { text: "소명자", color: "#9696FF", bold: true },
    { text: "검단우리교회 공동체", bold: true },
  ];
}

function buildPresenterLiturgicalBodySlides(item, section, index, service, memo, displayText) {
  if (!isLiturgicalBodyServiceItem(item)) return [];
  const text = liturgicalBodyText(item, memo, displayText);
  if (!text) return [];
  const title = liturgicalBodyTitle(item);
  const announcementItems = isAnnouncementTextInputItem(item)
    ? presenterAnnouncementItems(text)
    : [];
  const textHighlights = liturgicalBodyTextHighlights(item, memo);
  const base = {
    ...section,
    sectionLabel: item?.label || title,
    sectionTitle: title,
    sectionName: title,
    elementType: PRESENTER_ELEMENT_TYPES.BODY_TEXT,
    label: item?.label || title,
    title,
    marker: "",
    textHighlights,
    announcementItems,
    announcementRegions: normalizeAnnouncementRegions(memo.announcementRegions),
  };
  if (!presenterServiceUsesChromakey(service)) {
    return [{
      id: `${item.id || index}:liturgical-body`,
      ...base,
      layout: PRESENTER_SLIDE_LAYOUTS.CENTER_TEXT,
      type: "liturgical-body",
      text,
      bodyText: text,
      sort: index,
    }];
  }
  const chromakeyText = title === "사도신경" && text === PRESENTER_PUBLIC_APOSTLES_CREED_TEXT
    ? PRESENTER_PUBLIC_APOSTLES_CREED_CHROMAKEY_TEXT
    : text;
  return presenterLiturgicalChromakeyChunks(title, chromakeyText).map((chunk, chunkIndex) => ({
    id: `${item.id || index}:liturgical:${chunkIndex}`,
    ...base,
    layout: PRESENTER_SLIDE_LAYOUTS.LOWER_BAR_TEXT,
    type: "lyrics",
    formKey: `liturgical:${item.id || index}`,
    marker: chunkIndex === 0 ? title : "",
    text: chunk,
    bodyText: text,
    sort: index + chunkIndex / 100,
  }));
}

function presenterLiturgicalChromakeyChunks(title = "", text = "") {
  if (liturgicalBodyTitle({ label: title }) === "공동체고백"
    && text === PRESENTER_PUBLIC_COMMUNITY_CONFESSION_TEXT) {
    return PRESENTER_PUBLIC_COMMUNITY_CONFESSION_CHROMAKEY_SLIDES;
  }
  return splitPresenterLyricChunks(text);
}

function presenterPreparationSlide(service, item, index) {
  const memo = parseServiceItemMemo(item?.memo);
  const chromakey = presenterServiceUsesChromakey(service);
  // An intro without a video yet behaves like the ordinary waiting screen instead of a blank one.
  const introWithoutFile = presenterPreparationRole(item, memo) === "intro" && !normalizeServiceAsset(memo.asset).url;
  const rawPresenterRole = introWithoutFile ? "waiting_loop" : presenterPreparationRole(item, memo);
  const presenterRole = rawPresenterRole === "waiting_loop" && !chromakey ? "ready" : rawPresenterRole;
  const elementLabel = presenterPreparationElementLabel(item, {}, presenterRole);
  if (!chromakey && presenterRole !== "intro") {
    return presenterFullscreenPreparationSlide(service, item, index, presenterRole, elementLabel);
  }
  const configuredAsset = normalizeServiceAsset(memo.asset);
  const asset = configuredAsset.url
    ? configuredAsset
    : presenterDefaultPreparationAsset(service, item, introWithoutFile ? { ...memo, presenterRole: "waiting_loop" } : memo);
  const elementType = presenterRole === "intro" || (presenterRole === "waiting_loop" && chromakey)
    ? PRESENTER_ELEMENT_TYPES.VIDEO
    : PRESENTER_ELEMENT_TYPES.IMAGE;
  const source = normalizePresenterMediaSource(asset.url || "");
  const playbackType = presenterRole === "intro" ? "intro-video" : "ready-video";
  const assetElementLabel = presenterPreparationElementLabel(item, asset, presenterRole);
  if (source) {
    const title = asset.name || item?.raw_title || "";
    const base = {
      ...presenterReadySlide(service),
      id: `${item?.id || index}:ready-media`,
      sectionId: item?._worshipSectionId || item?.id || `${service?.id || "service"}:ready`,
      sectionKey: item?._worshipSectionKey || "ready",
      sectionLabel: item?._worshipSectionTitle || "준비",
      elementLabel: assetElementLabel,
      elementId: item?.id || `${service?.id || "service"}:ready`,
      sectionIndex: index + 1,
      sectionTitle: item?._worshipSectionTitle || "준비",
      elementTitle: title,
      sectionName: cleanList([item?._worshipSectionTitle || "준비", assetElementLabel]).join(" / "),
      title,
      text: "",
      asset: { ...asset, kind: asset.kind || elementType },
      presenterRole,
      sort: index,
    };
    if (elementType === "image") {
      return {
        ...base,
        elementType: PRESENTER_ELEMENT_TYPES.IMAGE,
        layout: PRESENTER_SLIDE_LAYOUTS.MEDIA,
        type: "image",
        imageSrc: source,
      };
    }
    return {
      ...base,
      elementType: PRESENTER_ELEMENT_TYPES.VIDEO,
      layout: PRESENTER_SLIDE_LAYOUTS.MEDIA,
      type: presenterRole === "intro" ? "video" : "ready",
      videoSrc: source,
      playback: presenterPlaybackConfig(memo.playback, playbackType),
    };
  }
  return {
    ...presenterReadySlide(service),
    id: `${item?.id || index}:ready`,
    sectionId: item?._worshipSectionId || item?.id || `${service?.id || "service"}:ready`,
    sectionKey: item?._worshipSectionKey || "ready",
    sectionLabel: item?._worshipSectionTitle || item?.label || "준비",
    elementLabel: assetElementLabel,
    elementId: item?.id || `${service?.id || "service"}:ready`,
    sectionIndex: index + 1,
    elementType,
    layout: PRESENTER_SLIDE_LAYOUTS.MEDIA,
    type: "ready",
    imageSrc: "",
    videoSrc: "",
    presenterRole,
    sort: index,
  };
}

function presenterFullscreenPreparationSlide(service, item, index, presenterRole, elementLabel) {
  return {
    ...presenterReadySlide(service),
    id: `${item?.id || index}:ready`,
    sectionId: item?._worshipSectionId || item?.id || `${service?.id || "service"}:ready`,
    sectionKey: item?._worshipSectionKey || "ready",
    sectionLabel: item?._worshipSectionTitle || item?.label || "준비",
    elementLabel,
    elementId: item?.id || `${service?.id || "service"}:ready`,
    sectionIndex: index + 1,
    sectionTitle: item?._worshipSectionTitle || "준비",
    elementTitle: "준비",
    sectionName: cleanList([item?._worshipSectionTitle || "준비", elementLabel]).join(" / "),
    presenterRole,
    sort: index,
  };
}

function presenterDefaultPreparationAsset(service, item = {}, memo = {}) {
  const role = normalizeServicePresenterRole(memo?.presenterRole);
  if (presenterServiceUsesChromakey(service) && (!role || role === "waiting_loop")) {
    return {
      kind: PRESENTER_ELEMENT_TYPES.VIDEO,
      name: "예배 전 영상",
      url: PRESENTER_DEFAULT_CHROMAKEY_READY_LOOP_VIDEO,
    };
  }
  return { kind: "", name: "", url: "" };
}

function presenterPreparationElementLabel(item = {}, asset = {}, presenterRole = "") {
  const assetName = String(asset?.name || "").trim();
  const label = String(item?.label || "").trim();
  const compactLabel = compactSearchValue(label);
  if ((asset?.kind === "image" || presenterMediaSourceIsImage(asset?.url)) && compactLabel === "대기영상") {
    return assetName || "준비 이미지";
  }
  return label || (presenterRole === "intro" ? "인트로" : presenterRole === "still" ? "첫 화면" : "대기");
}

function presenterPreparationRole(item = {}, memo = parseServiceItemMemo(item?.memo)) {
  const explicit = normalizeServicePresenterRole(memo?.presenterRole);
  if (explicit) return explicit;
  const compact = compactSearchValue(`${item?.label || ""} ${item?.raw_title || ""}`);
  if (compact.includes("인트로") || compact.includes("카운트다운") || compact.includes("시작영상")) return "intro";
  if (compact.includes("대기영상") || compact.includes("대기비디오") || compact.includes("waitingloop")) return "waiting_loop";
  if (compact.includes("대기") || compact.includes("준비")) return "ready";
  if (compact.includes("첫화면") || compact.includes("정지화면")) return "still";
  return "ready";
}

function presenterElementSlideFromMemoCore(item, section, index, memo, displayText, service = null) {
  const elementType = serviceMemoElementType(memo);
  if (!elementType || elementType === "praise" || elementType === "scripture") return null;
  const label = item?.label || "";
  const asset = normalizeServiceAsset(memo?.asset);
  const safeLabel = isLegacyPresentationLabel(label) ? "" : label;
  const assetTitle = asset.name && !isLegacyImportArtifactName(asset.name) ? asset.name : "";
  const title = assetTitle || displayText || label || serviceElementTypeLabel(elementType);
  if (elementType === "title") return presenterTitleOnlySlide(item, section, index, title);
  if (elementType === "title_content") {
    const titleContentText = String(item?.raw_title || displayText || "");
    const lines = titleContentText.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
    const titleText = lines[0] || item?.label || section.sectionTitle || "제목";
    const rawBodyText = lines.slice(1).join("\n") || memo.note || item?.assignee || "";
    const mainPraiseIntro = isMainPraiseTitleContentItem(item, section, titleText);
    const sermonTitle = section.sectionKey === "sermon"
      || ["설교", "설교제목"].includes(compactSearchValue(safeLabel));
    if (sermonTitle) {
      const contentTitle = presenterSermonContentTitle(titleText);
      const assignee = cleanPresenterAssignee(rawBodyText);
      return {
        id: `${item.id || index}:title-assignee`,
        ...section,
        elementLabel: safeLabel || "설교 제목",
        elementTitle: contentTitle,
        elementType: PRESENTER_ELEMENT_TYPES.TITLE_ASSIGNEE,
        layout: PRESENTER_SLIDE_LAYOUTS.LOWER_BAR_TEXT,
        type: "title-assignee",
        label: safeLabel || "설교 제목",
        title: contentTitle,
        assignee,
        contentTitle,
        titlePresentation: "sermon",
        marker: "",
        text: cleanList([contentTitle, assignee]).join("\n"),
        sort: index,
      };
    }
    const displayTitle = mainPraiseIntro ? "찬양" : titleText;
    const bodyText = mainPraiseIntro
      ? resolveMainPraiseIntroBodyText(service, rawBodyText)
      : rawBodyText;
    return {
      id: `${item.id || index}:title-content`,
      ...section,
      elementLabel: mainPraiseIntro ? "환영" : safeLabel || section.elementLabel || "제목 / 내용",
      elementTitle: displayTitle,
      elementType: PRESENTER_ELEMENT_TYPES.TITLE_CONTENT,
      layout: PRESENTER_SLIDE_LAYOUTS.CENTER_TEXT,
      type: "title-content",
      label: mainPraiseIntro ? "환영" : safeLabel,
      title: displayTitle,
      bodyText,
      marker: "",
      text: [displayTitle, bodyText].filter(Boolean).join("\n"),
      sort: index,
      ...(mainPraiseIntro ? { _praiseIntroSlide: true } : {}),
    };
  }
  if (presenterMemoElementIsTitleSlide(elementType)) {
    const fallbackParts = typeof serviceTitlePersonEffectiveParts === "function"
      ? serviceTitlePersonEffectiveParts(item, memo, service)
      : null;
    const legacyTitlePersonFallback = fallbackParts?.rawTitleAssignee ? fallbackParts : null;
    const titleText = legacyTitlePersonFallback?.title || presenterTitleAssigneeTitle(item, safeLabel, displayText, elementType);
    const assigneeText = legacyTitlePersonFallback?.assignee || presenterTitleAssigneePerson(item, safeLabel, displayText, titleText, service);
    const compactLabel = compactSearchValue(safeLabel);
    const orderTitle = String(section.sectionHeading || section.sectionTitle || section.sectionLabel || "").trim();
    const sermonTitle = section.sectionKey === "sermon" || ["설교", "설교제목"].includes(compactLabel);
    const contentTitle = sermonTitle
      ? presenterSermonContentTitle(displayText)
      : compactLabel === "특송"
        ? String(displayText || "").trim()
      : "";
    const slideTitle = sermonTitle ? contentTitle : titleText;
    const threePartAssignee = sermonTitle || compactLabel === "특송"
      ? cleanPresenterAssignee(item.assignee) || legacyTitlePersonFallback?.assignee || ""
      : assigneeText;
    const hasThreeParts = Boolean(orderTitle && contentTitle && threePartAssignee);
    const scriptureReading = isPresenterScriptureReadingSource({ elementType, label: safeLabel, sectionKey: section.sectionKey });
    if (!titleText && !assigneeText) return null;
    return {
      id: `${item.id || index}:title-assignee`,
      ...section,
      sectionAssignee: scriptureReading ? "" : section.sectionAssignee,
      scriptureReadingAssignee: scriptureReading ? cleanPresenterAssignee(item.assignee) : "",
      elementLabel: safeLabel || section.elementLabel || serviceElementTypeLabel(elementType),
      elementTitle: slideTitle,
      elementType: PRESENTER_ELEMENT_TYPES.TITLE_ASSIGNEE,
      layout: PRESENTER_SLIDE_LAYOUTS.LOWER_BAR_TEXT,
      type: "title-assignee",
      label: safeLabel,
      title: slideTitle,
      assignee: hasThreeParts ? threePartAssignee : assigneeText,
      orderTitle: hasThreeParts ? orderTitle : "",
      contentTitle: hasThreeParts ? contentTitle : "",
      // Keep the presentation role on the slide. Re-inferring this from a
      // section label later can route a sermon title through a split layout.
      titlePresentation: sermonTitle ? "sermon" : "",
      marker: "",
      text: hasThreeParts
        ? cleanList([orderTitle, contentTitle, threePartAssignee]).join("\n")
        : cleanList([slideTitle, assigneeText]).join("\n"),
      sort: index,
    };
  }
  if (elementType === "blank") {
    return {
      id: `${item.id || index}:blank`,
      ...section,
      elementType: PRESENTER_ELEMENT_TYPES.BLANK,
      layout: PRESENTER_SLIDE_LAYOUTS.BLANK,
      type: "blank",
      label,
      title: title || "Blank",
      marker: "",
      text: "",
      sort: index,
    };
  }
  if (elementType === "video") {
    const source = normalizePresenterMediaSource(asset.url || displayText);
    if (!source) return null;
    return {
      id: `${item.id || index}:video`,
      ...section,
      sectionLabel: label || "Video",
      sectionTitle: title,
      sectionName: title,
      elementType: PRESENTER_ELEMENT_TYPES.VIDEO,
      layout: PRESENTER_SLIDE_LAYOUTS.MEDIA,
      type: "video",
      label,
      title,
      marker: label || "Video",
      text: title,
      videoSrc: source,
      asset,
      presenterRole: memo.presenterRole || "",
      playback: presenterPlaybackConfig(memo.playback, "video"),
      sourceType: "video",
      componentType: "video",
      sort: index,
    };
  }
  if (elementType === "audio") {
    const source = normalizePresenterMediaSource(asset.url || displayText);
    if (!source) return null;
    const audioAsset = { ...asset, kind: asset.kind || "audio", url: source };
    const audioTitle = presenterFileDisplayTitle({ title, asset: audioAsset }, "오디오");
    return {
      id: `${item.id || index}:audio`,
      ...section,
      sectionLabel: label || "Audio",
      sectionTitle: audioTitle,
      sectionName: audioTitle,
      elementType: PRESENTER_ELEMENT_TYPES.AUDIO,
      layout: PRESENTER_SLIDE_LAYOUTS.FILE,
      type: "audio",
      label,
      title: audioTitle,
      marker: label || "Audio",
      text: [audioTitle, source].filter(Boolean).join("\n"),
      audioSrc: source,
      asset: audioAsset,
      playback: presenterPlaybackConfig(memo.playback, "audio"),
      sourceType: audioAsset.kind || "audio",
      componentType: "audio",
      sort: index,
    };
  }
  if (elementType === "image") {
    const source = normalizePresenterMediaSource(asset.url || displayText);
    if (!source) return null;
    const referenceMedia = compactSearchValue(label) === "참고화면"
      && String(memo?.inputMode || "").trim() === "asset";
    const assetSlides = normalizeServiceAssetSlides(asset.slides);
    if (assetSlides.length) {
      return assetSlides.map((slide, slideIndex) => {
        const slideSource = normalizePresenterMediaSource(slide.url);
        if (!slideSource) return null;
        const slideTitle = slide.name || title;
        return {
          id: `${item.id || index}:image:${slideIndex}`,
          ...section,
          sectionLabel: label || "Image",
          sectionTitle: title,
          sectionName: title,
          elementType: PRESENTER_ELEMENT_TYPES.IMAGE,
          layout: PRESENTER_SLIDE_LAYOUTS.MEDIA,
          type: "image",
          label,
          title: slideTitle,
          marker: slideIndex === 0 ? (label || "Image") : "",
          text: slideTitle,
          imageSrc: slideSource,
          asset: { ...asset, url: slideSource, name: slideTitle },
          referenceMedia,
          sort: index + slideIndex / 100,
        };
      }).filter(Boolean);
    }
    return {
      id: `${item.id || index}:image`,
      ...section,
      sectionLabel: label || "Image",
      sectionTitle: title,
      sectionName: title,
      elementType: PRESENTER_ELEMENT_TYPES.IMAGE,
      layout: PRESENTER_SLIDE_LAYOUTS.MEDIA,
      type: "image",
      label,
      title,
      marker: label || "Image",
      text: title,
      imageSrc: source,
      asset,
      referenceMedia,
      sort: index,
    };
  }
  if (elementType === "score") {
    const source = normalizePresenterMediaSource(asset.url || displayText);
    const scoreAsset = source ? { ...asset, url: source } : asset;
    const imageSlides = presenterScoreImageSlidesFromAsset(scoreAsset, item, section, index, title, safeLabel || "악보", null, null, displayText);
    if (imageSlides.length) return imageSlides;
    const fileLabel = presenterFileTypeLabel("score");
    const fileTitle = presenterFileDisplayTitle({ title: assetTitle || displayText || safeLabel, asset }, fileLabel);
    return {
      id: `${item.id || index}:score`,
      ...section,
      sectionLabel: safeLabel || fileLabel,
      sectionTitle: fileTitle,
      sectionName: fileTitle,
      elementType: PRESENTER_ELEMENT_TYPES.FILE,
      layout: PRESENTER_SLIDE_LAYOUTS.FILE,
      type: "file",
      label: safeLabel,
      title: fileTitle,
      marker: fileLabel,
      text: [fileTitle, asset.url].filter(Boolean).join("\n"),
      asset,
      sourceType: "score",
      componentType: "score",
      sort: index,
    };
  }
  if (elementType === "activity") {
    const cleanTitle = title || "실시간 성구";
    return {
      id: `${item.id || index}:activity`,
      ...section,
      sectionLabel: label || cleanTitle,
      sectionTitle: cleanTitle,
      sectionName: cleanTitle,
      elementLabel: label || cleanTitle,
      elementTitle: cleanTitle,
      elementType: PRESENTER_ELEMENT_TYPES.TITLE_CONTENT,
      layout: PRESENTER_SLIDE_LAYOUTS.CENTER_TEXT,
      type: "title-content",
      label,
      title: cleanTitle,
      bodyText: String(memo.note || "").trim(),
      marker: "",
      text: [cleanTitle, memo.note].filter(Boolean).join("\n"),
      sort: index,
    };
  }
  if (elementType === "file" || elementType === "template") {
    const fileLabel = presenterFileTypeLabel(asset.kind || elementType);
    const fileTitle = presenterFileDisplayTitle({ title: assetTitle || displayText || safeLabel, asset }, fileLabel);
    return {
      id: `${item.id || index}:${elementType}`,
      ...section,
      sectionLabel: safeLabel || fileLabel,
      sectionTitle: fileTitle,
      sectionName: fileTitle,
      elementType: elementType === "file" ? PRESENTER_ELEMENT_TYPES.FILE : PRESENTER_ELEMENT_TYPES.FREEFORM,
      layout: PRESENTER_SLIDE_LAYOUTS.FILE,
      type: "file",
      label: safeLabel,
      title: fileTitle,
      marker: fileLabel,
      text: [fileTitle, asset.url].filter(Boolean).join("\n"),
      asset,
      sourceType: asset.kind || elementType,
      componentType: elementType,
      sort: index,
    };
  }
  return null;
}

function isMainPraiseTitleContentItem(item = {}, section = {}, titleText = "") {
  const titleKey = compactSearchValue(titleText);
  const labelKey = compactSearchValue(item?.label || section.elementLabel || "");
  if (titleKey !== "찬양" && titleKey !== "환영" && labelKey !== "환영") return false;
  return String(section.sectionKey || item?._worshipSectionKey || "").trim() === "praise"
    || isMainPraiseServiceItem(item, { allowUnlabeled: true });
}

function resolveMainPraiseIntroBodyText(service = null, bodyText = "") {
  const defaultTeam = serviceDefaultMainPraiseTeamName(service);
  if (!defaultTeam) return String(bodyText || "").trim();
  const bodyKey = compactSearchValue(bodyText);
  const defaultTeamKeys = new Set([
    "",
    "찬양팀",
    "담당",
    "헤세드찬양단",
    "테힐라찬양단",
    "썸프레이즈",
  ]);
  return defaultTeamKeys.has(bodyKey) ? defaultTeam : String(bodyText || "").trim();
}

function presenterMemoElementIsTitleSlide(elementType) {
  return ["title_person", "scripture_reading"].includes(elementType);
}

function presenterTitleAssigneeTitle(item = {}, label = "", displayText = "", elementType = "") {
  const compact = compactSearchValue(label);
  const text = String(displayText || "").trim();
  if (isCreedPresenterItem(item, label, displayText)) return "신앙고백";
  if (compact === "대표기도" || compact === "기도") return "대표기도";
  if (compact === "성경봉독") return "성경봉독";
  if (compact === "특송") return "특송";
  if (compact === "봉헌기도") return "봉헌기도";
  if (compact === "축도") return "축도";
  if (compact === "교회소식" || compact === "광고") return "교회소식";
  if (compact === "월삭기도") return text || "월삭기도";
  if (compact === "설교") return text || "설교";
  if (compact === "설교제목") return "설교";
  return text || label || serviceElementTypeLabel(elementType);
}

function presenterTitleAssigneePerson(item = {}, label = "", displayText = "", titleText = "", service = null) {
  if (isCreedPresenterItem(item, label, displayText)) return "사도신경";
  const compact = compactSearchValue(label);
  const text = cleanPresenterAssignee(displayText);
  if (compact === "성경봉독") {
    const referenceText = presenterFullKoreanBibleReference(text);
    return referenceText && compactSearchValue(referenceText) !== compactSearchValue(titleText) ? referenceText : "";
  }
  const assignee = cleanPresenterAssignee(item.assignee)
    || (typeof serviceItemDefaultAssignee === "function" ? serviceItemDefaultAssignee(item, service) : "");
  if (compact === "설교제목") return cleanList([presenterSermonContentTitle(text), assignee]).join("\n");
  if (assignee) return assignee;
  if (!text || compactSearchValue(text) === compactSearchValue(titleText)) return "";
  if (["대표기도", "기도", "성경봉독", "특송", "봉헌기도", "축도"].includes(compact)) return text;
  return "";
}

function presenterFullKoreanBibleReference(value = "") {
  const text = String(value || "").trim();
  if (!text || typeof parseBibleReference !== "function") return text;
  const reference = parseBibleReference(text);
  if (!reference?.book || !reference?.chapter) return text;
  const bookName = String(reference.book.koreanName || reference.book.shortName || reference.book.code || "").trim();
  if (!bookName) return text;
  const range = reference.verse
    ? `${reference.chapter}:${reference.verse}${reference.verseEnd ? `–${reference.verseEnd}` : ""}`
    : `${reference.chapter}`;
  return [bookName, range].filter(Boolean).join(" ").trim() || text;
}

function presenterTitleAssigneeUsesWorshipLeader(compactLabel = "") {
  return [
    "봉헌기도",
    "교회소식",
    "광고",
    "축도",
    "예배의부름",
    "사죄의선언",
    "묵도",
  ].includes(compactLabel);
}

function isPresenterScriptureReadingSource(source = {}) {
  const key = compactSearchValue([
    source.elementType,
    source.componentType,
    source.sectionKey,
    source.elementLabel,
    source.sectionLabel,
    source.label,
    source.title,
  ].filter(Boolean).join(" "));
  return key.includes("scripturereading")
    || key.includes("성경봉독")
    || normalizeServiceElementType(source.elementType) === "scripture_reading"
    || normalizeWorshipElementType(source.elementType) === "scripture_reading";
}

function buildPresenterCustomSlides(item, section, index) {
  if (isScriptureBodyServiceItem(item)) return [];
  const slides = parseServiceItemMemo(item?.memo).slides;
  if (!slides.length) return [];
  const label = item.label || "";
  const songLikeItem = isSongServiceLabel(label) || isPresenterSpecialSongItem(item, section);
  const lyricSlides = slides.map((block, blockIndex) => {
    const parsed = parsePresenterCustomSlideBlock(block);
    return {
      id: `${item.id || index}:custom:${blockIndex}`,
      ...section,
      elementType: parsed.blank ? PRESENTER_ELEMENT_TYPES.BLANK : songLikeItem ? PRESENTER_ELEMENT_TYPES.PRAISE : PRESENTER_ELEMENT_TYPES.FREEFORM,
      layout: parsed.blank ? PRESENTER_SLIDE_LAYOUTS.BLANK : songLikeItem ? PRESENTER_SLIDE_LAYOUTS.LOWER_BAR_TEXT : PRESENTER_SLIDE_LAYOUTS.CENTER_TEXT,
      type: parsed.blank ? "blank" : songLikeItem ? "lyrics" : "component",
      label,
      title: section.sectionTitle || item.raw_title || label || "Slide",
      marker: parsed.marker,
      formKey: `custom:${blockIndex}`,
      text: parsed.text,
      sort: index + blockIndex / 100,
    };
  }).filter((slide) => slide.type === "blank" || String(slide.text || "").trim());
  const preset = serviceItemFormPreset(item);
  if (songLikeItem && preset?.titleSequence && preset.forms?.length) {
    const plan = resolvePresenterLyricsFormPresetSequence([], preset.forms, [], lyricSlides.map(slide => slide.text));
    return plan.items.map((form, position) => form._presenterTitle
      ? presenterSequenceTitleSlide(item, section, null, null, serviceItemDisplayText(item), index, position)
      : { ...lyricSlides[0], id: `${item.id || index}:custom-sequence:${position}`,
        type: form._presenterBlank ? "blank" : "lyrics", text: form.lyrics || "",
        elementType: form._presenterBlank ? PRESENTER_ELEMENT_TYPES.BLANK : PRESENTER_ELEMENT_TYPES.PRAISE,
        layout: form._presenterBlank ? PRESENTER_SLIDE_LAYOUTS.BLANK : PRESENTER_SLIDE_LAYOUTS.LOWER_BAR_TEXT,
        marker: form.label, formKey: `custom:${position}`, sort: index + position / 100 });
  }
  if (!songLikeItem || !shouldIncludeSongTitleSlide(item, label)) return lyricSlides;
  return [
    presenterSongTitleSlide(item, section, null, null, serviceItemConnectedPraiseTitle(item, "title") || serviceItemDisplayText(item), index),
    ...lyricSlides,
  ];
}

function parsePresenterCustomSlideBlock(block) {
  const lines = String(block || "").split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  if (!lines.length) return { marker: "", text: "" };
  const first = lines[0];
  const bracketed = first.match(/^\[([^\]]+)\]$/)?.[1]?.trim();
  if (lines.length === 1 && bracketed && /^(int|간주|후주|interlude|instrumental)$/i.test(bracketed)) {
    return { marker: bracketed === "후주" ? "후주" : "간주", text: "", blank: true };
  }
  const markerCandidate = bracketed || first;
  if (/^(Verse|Chorus|Pre[-\s]?Chorus|PC|Bridge|Coda|Tag|Lyrics)(?:\s+\d+)?(?:@[A-Z]?)?$/i.test(markerCandidate)) {
    return { marker: normalizePresenterCustomMarker(markerCandidate), text: lines.slice(1).join("\n") };
  }
  return { marker: "", text: lines.join("\n") };
}

function normalizePresenterCustomMarker(value) {
  return String(value || "")
    .replace(/^pc$/i, "Pre-Chorus")
    .replace(/^pre[\s-]?chorus/i, "Pre-Chorus")
    .replace(/^verse/i, "Verse")
    .replace(/^chorus/i, "Chorus")
    .replace(/^bridge/i, "Bridge")
    .replace(/^coda/i, "Coda")
    .replace(/^tag/i, "Tag")
    .replace(/^lyrics/i, "Lyrics");
}

function buildPresenterScriptureTextSlides(item, section, index, service = null) {
  if (!isScriptureBodyServiceItem(item) && !isOptionalCitationScriptureServiceItem(item)) return [];
  const payload = serviceScriptureTextPayload(item, undefined, service);
  if (!payload.verses.length) return [];
  const context = presenterScriptureBodyContext(item, section, service);
  const readingForm = presenterScriptureContextUsesReadingForm(context);
  const reference = payload.reference || section.sectionTitle || "본문";
  const lastVerseIndex = payload.verses.length - 1;
  const citation = isPresenterCitationScriptureItem(item);
  return payload.verses.map((verse, verseIndex) => {
    const verseNumber = presenterScriptureVerseNumber(verse);
    const readingFinal = context === "reading" && verseIndex === lastVerseIndex;
    const referenceBook = readingForm
      ? (verse.referenceBookFull || payload.referenceBookFull || verse.referenceBook || payload.referenceBook || "")
      : (verse.referenceBook || payload.referenceBook || "");
    const verseReference = readingForm
      ? [referenceBook, verse.referenceRange || payload.referenceRange || ""].filter(Boolean).join(" ")
      : (verse.reference || reference);
    const verseText = verseNumber ? [verseNumber, verse.text].filter(Boolean).join("   ") : verse.text;
    return {
      id: `${item.id || index}:scripture:${verseReference}:${verseNumber || verseIndex + 1}`,
      ...section,
      elementTitle: verseReference,
      sectionName: presenterNameParts(section.sectionLabel, verseReference).join(" / ") || verseReference,
      elementType: PRESENTER_ELEMENT_TYPES.SCRIPTURE_TEXT,
      layout: PRESENTER_SLIDE_LAYOUTS.LOWER_BAR_TEXT,
      type: "scripture",
      scriptureContext: context,
      scriptureVerse: Number(verse.number || verse.verse) || null,
      scriptureVerseEnd: Number(verse.verseEnd || verse.verse_end) || null,
      label: item.label || "본문",
      title: verseReference,
      marker: verseReference,
      referenceBook,
      referenceRange: verse.referenceRange || payload.referenceRange || "",
      translationLabel: verse.translationLabel || payload.translationLabel || "",
      text: citation ? presenterCitationScriptureText(verse, payload, context) : verseText,
      ...(context === "citation-chromakey" ? { citationBodyText: verse.text } : {}),
      citationQuickInsert: citation,
      scriptureReadingFinal: readingFinal,
      ...(readingForm ? { outputContext: "clean" } : {}),
      sort: index + verseIndex / 100,
    };
  });
}

function presenterPendingScriptureSlide(item, section, index, service = null) {
  const memo = typeof parseServiceItemMemo === "function"
    ? parseServiceItemMemo(item?.memo)
    : {};
  const references = typeof serviceItemScriptureReferences === "function"
    ? serviceItemScriptureReferences(item, memo, service)
    : [];
  if (!references.length) return null;
  const reference = typeof formatServiceScriptureReferenceList === "function"
    ? formatServiceScriptureReferenceList(references)
    : references.join("; ");
  const context = presenterScriptureBodyContext(item, section, service);
  return {
    id: `${item.id || index}:scripture-pending`,
    ...section,
    elementTitle: reference,
    sectionName: presenterNameParts(section.sectionLabel, reference).join(" / ") || reference,
    elementType: PRESENTER_ELEMENT_TYPES.BLANK,
    layout: PRESENTER_SLIDE_LAYOUTS.BLANK,
    type: "scripture-pending",
    scriptureContext: context,
    scripturePending: true,
    label: item.label || "본문",
    title: reference,
    marker: "",
    text: "",
    skipTrailingBlank: true,
    sort: index,
  };
}

function presenterScriptureVerseNumber(verse = {}) {
  const start = Number(verse.number || verse.verse) || 0;
  const end = Number(verse.verseEnd || verse.verse_end) || 0;
  if (!start) return String(verse.number || verse.verse || "").trim();
  return end > start ? `${start}–${end}` : String(start);
}

function isPresenterCitationScriptureItem(item = {}) {
  return compactSearchValue(item?.label || "") === "인용구절";
}

function presenterCitationScriptureText(verse = {}, payload = {}, context = "") {
  const number = presenterScriptureVerseNumber(verse);
  if (context === "citation-chromakey") {
    const reference = presenterCitationVerseReference(verse, payload, number);
    return reference ? [reference, verse.text].filter(Boolean).join("   ") : verse.text;
  }
  return number ? [number, verse.text].filter(Boolean).join("   ") : verse.text;
}

function presenterCitationVerseReference(verse = {}, payload = {}, verseNumber = "") {
  const book = presenterCitationBookName(verse.referenceBook || payload.referenceBook || "");
  const range = String(verse.referenceRange || payload.referenceRange || "").trim();
  const chapter = range.match(/^(\d+`?|\(\d+\))/)?.[1] || "";
  const number = String(verseNumber || "").trim();
  if (book && chapter && number) return `${book} ${number.includes(":") ? number : chapter+":"+number}`;
  return presenterCitationDisplayReference(verse.reference || payload.reference || "");
}

function presenterCitationBookName(value = "") {
  const name = String(value || "").trim();
  const book = typeof findBibleBookByReferenceName === "function" ? findBibleBookByReferenceName(name) : null;
  return MINDEX_CONSTANTS.KOREAN_BIBLE_BOOK_ABBREVIATIONS?.[book?.code] || book?.shortName || name;
}

function presenterCitationDisplayReference(value = "") {
  const text = String(value || "").trim();
  const reference = typeof parseBibleReference === "function" ? parseBibleReference(text) : null;
  if (!reference) return text;
  const parts = serviceScriptureReferenceParts(reference, text);
  return [presenterCitationBookName(parts.referenceBook), parts.referenceRange].filter(Boolean).join(" ");
}

function presenterScriptureBodyContext(item = {}, section = {}, service = null) {
  const sectionKey = String(section.sectionKey || item?._worshipSectionKey || "").trim();
  if (sectionKey === "scripture_reading") return "reading";
  const chromakey = Boolean(service && presenterServiceUsesChromakey(service));
  if (isPresenterCitationScriptureItem(item)) return chromakey ? "citation-chromakey" : "citation";
  if (sectionKey === "sermon") return chromakey ? "sermon-chromakey" : "sermon";
  return "";
}

function presenterScriptureContextUsesReadingForm(context = "") {
  return context === "reading" || context === "sermon" || context === "citation";
}

function presenterScriptureContextUsesAddressTab(context = "") {
  return context === "citation-chromakey" || context === "sermon-chromakey";
}

function serviceScriptureTextPayload(item, memo = parseServiceItemMemo(item?.memo), service = null) {
  if (typeof serviceScriptureTextPayloadFromBible === "function") {
    const resolved = serviceScriptureTextPayloadFromBible(item, memo, service);
    if (resolved?.reference || resolved?.verses?.length) return resolved;
  }
  const reference = String(memo.scriptureReference || item?.raw_title || "").trim();
  return { reference, verses: [] };
}

function isScriptureBodyServiceItem(item) {
  const label = String(item?.label || "").replace(/\s+/g, "");
  const sectionKey = String(item?._worshipSectionKey || item?.sectionKey || item?.section_key || "").trim();
  const memo = typeof parseServiceItemMemo === "function" ? parseServiceItemMemo(item?.memo) : {};
  const elementType = typeof normalizeWorshipElementType === "function"
    ? normalizeWorshipElementType(memo.elementType || item?.elementType || item?.element_type || "")
    : String(memo.elementType || item?.elementType || item?.element_type || "").trim().toLowerCase();
  const directReferences = typeof serviceItemDirectScriptureReferences === "function"
    ? serviceItemDirectScriptureReferences(item, memo)
    : [];
  const hasScriptureReference = Boolean(
    directReferences.length
    || String(memo.scriptureReference || memo.scripture_reference || item?.raw_title || item?.title || "").trim()
  );
  const scriptureReferenceLabel = ["성경봉독", "인용구절", "말씀", "성경"].includes(label);
  return elementType === "scripture_body"
    || label === "본문"
    || label === "성경본문"
    || label === "설교본문"
    || (scriptureReferenceLabel && elementType !== "scripture_reading" && hasScriptureReference)
    || (sectionKey === "scripture_reading" && elementType === "scripture_body");
}

function shouldIncludeSongTitleSlide(item, label, song = null, version = null) {
  if (parseServiceItemMemo(item?.memo).formPreset?.titleSequence
      || presenterServiceItemFormPreset(version || {}, item, song)?.titleSequence) return false;
  if (isServiceConnectedPraiseSecondaryItem(item)) return false;
  const displayText = serviceItemDisplayText(item);
  if (serviceItemConnectedPraiseTitle(item, "title")) return true;
  if (!displayText) return false;
  return Boolean(
    item?.song_id
    || isSongServiceLabel(label)
    || isPresenterSpecialSongItem(item)
    || isMainPraiseServiceItem(item, { allowUnlabeled: true }),
  );
}

function presenterSongTitleSlide(item, section, song, version, displayText, index) {
  const connectedTitle = serviceItemConnectedPraiseTitle(item, "title");
  const effectiveDisplayText = connectedTitle || displayText;
  const marker = presenterPraiseMarker(song, displayText);
  const sectionHeading = presenterSongTitleSectionHeading(item, section);
  const displayTitle = presenterSongTitleDisplayTitle(connectedTitle ? null : song, connectedTitle ? null : version, effectiveDisplayText, sectionHeading);
  const titleText = presenterSongTitleContentText(displayTitle, sectionHeading);
  const songDetail = connectedTitle ? "" : presenterSongTitleDetail(song, version);
  const songTitleContent = {
    orderTitle: sectionHeading || item.label || "",
    title: songDetail && presenterSongTitleHymnNo(song, version)
      ? splitHymnNo(displayTitle).title || displayTitle : displayTitle,
    detail: songDetail,
    detailKind: connectedTitle ? "" : presenterSongTitleDetailKind(song, version),
  };
  if (sectionHeading) {
    return { ...presenterOrderContentTitleSlide(item, section, index, sectionHeading, titleText), songTitle: displayTitle, songTitleContent };
  }
  return {
    id: `${item.id || index}:song-title`,
    ...section,
    elementType: PRESENTER_ELEMENT_TYPES.PRAISE,
    layout: PRESENTER_SLIDE_LAYOUTS.LOWER_BAR_TEXT,
    type: "song-title",
    label: item.label || "",
    title: displayTitle,
    subtitle: connectedTitle ? "" : versionDisplayName(song, version),
    songTitleContent,
    marker,
    sectionHeading,
    bodyText: "",
    text: titleText,
    sort: index - 0.001,
  };
}

function presenterSongTitleContentText(displayTitle = "", sectionHeading = "") {
  const titleKey = compactSearchValue(String(displayTitle || "").replace(PRESENTER_SONG_NOTE_PATTERN, ""));
  const headingKey = compactSearchValue(sectionHeading);
  if (!titleKey || (headingKey && titleKey === headingKey)) return "입력 필요";
  return formatPresenterSongTitleText(displayTitle);
}

function presenterSongTitleDetail(song = null, version = null) {
  const hymnNo = presenterSongTitleHymnNo(song, version);
  if (hymnNo) {
    const number = hymnNo.replace(/^통\s*/, "");
    const versionName = versionDisplayName(song, version);
    return `${versionName} ${number}장`;
  }
  return String(song?.original_title || "").trim() || String(song?.subtitle || "").trim();
}

function presenterSongTitleDetailKind(song = null, version = null) {
  if (presenterSongTitleHymnNo(song, version)) return "hymn";
  if (String(song?.original_title || "").trim()) return "original";
  return String(song?.subtitle || "").trim() ? "subtitle" : "";
}

function presenterSongTitleContent(slide = {}) {
  if (slide.songTitleContent) return slide.songTitleContent;
  // Older in-memory snapshots use separate fields; normalize at the boundary.
  return {
    orderTitle: slide.omitFullscreenOrderTitle ? "" : String(slide.orderTitle || slide.sectionHeading || slide.label || "").trim(),
    title: String(slide.fullscreenSongName || slide.songTitle || slide.title || slide.text || "").trim(),
    detail: String(slide.songDetail || "").trim(),
  };
}

function presenterOrderContentTitleSlide(item, section, index, orderTitle = "", contentTitle = "") {
  const safeOrderTitle = String(orderTitle || "").trim();
  const safeContentTitle = String(contentTitle || "").trim();
  return {
    id: `${item.id || index}:title-assignee`,
    ...section,
    elementType: PRESENTER_ELEMENT_TYPES.TITLE_ASSIGNEE,
    layout: PRESENTER_SLIDE_LAYOUTS.LOWER_BAR_TEXT,
    type: "title-assignee",
    label: item.label || "",
    title: safeOrderTitle,
    assignee: "",
    orderTitle: safeOrderTitle,
    contentTitle: safeContentTitle,
    marker: "",
    text: cleanList([safeOrderTitle, safeContentTitle]).join("\n"),
    sort: index - 0.001,
  };
}

function presenterSongTitleDisplayTitle(song = null, version = null, fallbackText = "", sectionHeading = "") {
  void sectionHeading;
  const title = presenterPraiseTitle(song, fallbackText, version);
  const hymnNo = presenterSongTitleHymnNo(song, version, fallbackText);
  if (!hymnNo) return title;
  const titleParts = splitHymnNo(title);
  if (titleParts.no) return [titleParts.no, titleParts.title].filter(Boolean).join(" ");
  return [hymnNo, title].filter(Boolean).join(" ");
}

function presenterSongTitleHymnNo(song = null, version = null, fallbackText = "") {
  const rawNo = String(presenterUnifiedHymnVersionNo(version) || song?.hymn_no || version?.hymn_no || splitHymnNo(fallbackText).no || "").trim();
  if (!rawNo) return "";
  const match = rawNo.match(/^(통\s*)?(\d{1,4})/);
  if (!match) return rawNo;
  return `${match[1] ? "통 " : ""}${Number(match[2])}`;
}

function presenterUnifiedHymnVersionNo(version = null) {
  if (!version) return "";
  const values = [version.hymn_no, version.name, version.curated_version_name, version.raw_section_name, version.version_label];
  for (const value of values) {
    const text = String(value || "").trim();
    const match = text.match(/(?:^|\(|\s)통(?:일)?\s*(\d{1,4})(?:\s|[.)]|$)/);
    if (match) return `통 ${Number(match[1])}`;
  }
  return "";
}

function presenterSongTitleSectionHeading(item = {}, section = {}) {
  if (!presenterSongTitleUsesSectionHeading(item, section)) return "";
  const heading = String(
    item?.label
    || section.elementLabel
    || section.sectionLabel
    || item?._worshipSectionTitle
    || section.sectionTitle
    || "",
  ).trim();
  return presenterSongTitleNormalizedHeading(heading, String(section.sectionKey || item?._worshipSectionKey || "").trim());
}

function presenterSongTitleNormalizedHeading(heading = "", sectionKey = "") {
  const raw = String(heading || "").trim();
  if (!raw) return "";
  const compact = compactSearchValue(raw);
  const compactSectionKey = String(sectionKey || "").trim();
  const genericBySection = {
    offering: "봉헌",
    doxology: "송영",
    sending: "파송",
    response_song: "결단",
    prayer_meeting_praise: "기도회",
    closing_hymn: "폐회",
    closing_visual: "폐회",
    closing_song: "폐회",
    hymn_praise: "찬송",
  };
  const canonicalBySection = {
    offering: "봉헌찬송",
    doxology: "송영",
    sending: "송영",
    response_song: "결단찬양",
    prayer_meeting_praise: "기도찬양",
    closing_hymn: "폐회찬송",
    closing_visual: "폐회찬송",
    closing_song: "폐회찬송",
    hymn_praise: "찬송",
  };
  if (compact === genericBySection[compactSectionKey]) return canonicalBySection[compactSectionKey] || raw;
  return raw;
}

function presenterSongTitleUsesSectionHeading(item = {}, section = {}) {
  if (isPresenterSpecialSongItem(item, section)) return false;
  if (section.sectionRole === "main-praise") return false;
  const sectionKey = String(section.sectionKey || item?._worshipSectionKey || "").trim();
  if ([
    "hymn_praise",
    "offering",
    "doxology",
    "sending",
    "response_song",
    "prayer_meeting_praise",
    "closing_song",
    "closing_hymn",
    "closing_visual",
  ].includes(sectionKey)) return true;
  const compact = compactSearchValue(item?.label || section.elementLabel || section.sectionLabel || "");
  if (!compact) return false;
  return /^(송영|파송|봉헌|봉헌찬송|봉헌찬양|파송찬송|결단|결단찬송|결단찬양|기도찬양|기도회찬양|폐회|폐회찬송)$/.test(compact);
}

function formatPresenterSongTitleText(title) {
  const cleanTitle = String(title || "").trim();
  if (!cleanTitle) return "";
  return PRESENTER_SONG_NOTE_PATTERN.test(cleanTitle)
    ? cleanTitle.replace(PRESENTER_SONG_NOTE_PATTERN, `${PRESENTER_SONG_NOTE} `)
    : `${PRESENTER_SONG_NOTE} ${cleanTitle}`;
}

function presenterPraiseTitle(song, fallbackText = "", version = null) {
  const linkedTitle = songOutputTitle(song, version);
  const cleanLinkedTitle = song?.hymn_no ? stripHymnNumber(linkedTitle) : linkedTitle;
  const normalizedLinkedTitle = cleanLinkedTitle.replace(/^찬송가\s*\d+\s*장\s*/i, "").trim();
  if (normalizedLinkedTitle) return normalizedLinkedTitle;
  const fallbackTitle = presenterPraiseFallbackTitle(fallbackText);
  const { title } = splitHymnNo(fallbackTitle);
  return title || fallbackTitle || "";
}

function presenterPraiseFallbackTitle(fallbackText = "") {
  const firstLine = String(fallbackText || "")
    .split(/\n+/)
    .map((line) => line.trim())
    .find(Boolean) || "";
  return firstLine.split(/\s+\/\s+/)[0]?.trim() || firstLine;
}

function presenterPraiseElementTitle(song, version = null, fallbackText = "") {
  const title = presenterPraiseTitle(song, fallbackText, version);
  if (!song) return title;
  const meta = new Set();
  [visibleSongSubtitle(song), song.original_title, visibleSongSubtitle(song, version?.subtitle), version?.original_title]
    .forEach((value) => addTitleMeta(meta, value));
  const visibleMeta = [...meta].filter((value) => normalizeTitle(value) !== normalizeTitle(title));
  return visibleMeta.length ? `${title} (${joinMetaItems(visibleMeta)})` : title;
}

function presenterPraiseMarker(song, fallbackText = "") {
  void song;
  void fallbackText;
  return "";
}

function presenterFormMarker(form) {
  const label = presenterFormDisplayLabel(form);
  if (isGenericPresenterFormLabel(label)) return "";
  return presenterFormPresetDisplayLabel(label) || label;
}

function presenterResolvedFormMarker(form = {}) {
  const presetLabel = String(form?._presenterPresetLabel || "").trim();
  if (presetLabel && isPresenterKoreanHymnPresetLabel(presetLabel)) return presetLabel;
  if (presetLabel && !isGenericPresenterFormLabel(presetLabel)) return presenterFormPresetDisplayLabel(presetLabel) || presetLabel;
  return presenterFormMarker(form);
}

function isPresenterKoreanHymnPresetLabel(value = "") {
  return /^(\d+\s*절|후렴|간주|마지막\s*절)$/u.test(String(value || "").trim());
}

function isGenericPresenterFormLabel(value) {
  return /^(lyrics|가사)$/i.test(String(value || "").trim());
}

function presenterSectionForServiceItem(item, index, displayText, song = null, version = null) {
  const label = String(item?.label || "").trim();
  const sectionLabel = presenterSectionLabelForServiceItem(item, label);
  const formHint = serviceItemFormHint(item);
  const connectedPraise = serviceItemConnectedPraise(item);
  const { no, title } = splitHymnNo(displayText);
  const linkedSongTitle = song ? presenterSongTitleDisplayTitle(song, version, displayText) : "";
  const linkedElementTitle = linkedSongTitle || (song ? presenterPraiseElementTitle(song, version, displayText) : "");
  const elementTitle = linkedElementTitle || [no, title].filter(Boolean).join(" ") || displayText || label || `항목 ${index + 1}`;
  const sectionLabelText = cleanList([label, formHint]).join(" · ");
  // Count the source version, not the selected/repeated performance sequence.
  const verseForms = normalizeForms(version?.forms || []).filter((form) =>
    normalizePresenterFormPresetLabel(presenterFormDisplayLabel(form)).type === "verse");
  return {
    ...(verseForms.length === 1 ? { controllerSingleVerse: true } : {}),
    sectionId: item?._worshipSectionId || item?.id || `section:${index}:${normalizeTitle([label, displayText].filter(Boolean).join(" "))}`,
    elementId: item?.id || `element:${index}:${normalizeTitle([label, displayText].filter(Boolean).join(" "))}`,
    sectionIndex: Number(item?._worshipSectionOrder) || index + 1,
    sectionKey: item?._worshipSectionKey || "",
    sectionLabel,
    sectionHeading: sectionLabel,
    sectionFormHint: formHint,
    sectionRole: isMainPraiseServiceItem(item, { allowUnlabeled: true }) ? "main-praise" : "",
    sectionTitle: sectionLabel,
    elementLabel: label,
    elementTitle,
    ...(connectedPraise ? { connectedPraise } : {}),
    sectionAssignee: item?.assignee || "",
    sectionName: [sectionLabel || sectionLabelText, elementTitle].filter(Boolean).join(" / "),
  };
}

function presenterSectionLabelForServiceItem(item = {}, fallbackLabel = "") {
  const explicit = String(item?._worshipSectionTitle || "").trim();
  if (explicit) return explicit;
  const key = String(item?._worshipSectionKey || "").trim();
  const canonicalByKey = {
    creed: "신앙고백",
    praise: "찬양",
    confession: "참회기도",
    hymn_praise: "찬송",
    prayer: "대표기도",
    scripture_reading: "성경봉독",
    special_song: "특송",
    sermon: "설교",
    response_song: "결단",
    offering: "봉헌",
    offering_prayer: "봉헌기도",
    announcements: "교회소식",
    community_confession: "공동체고백",
    doxology: "송영",
    closing_hymn: "폐회",
    benediction: "축도",
    closing: "마무리",
  };
  return canonicalByKey[key] || String(fallbackLabel || "").trim();
}

function presenterVideoSourceFromServiceItem(item, displayText) {
  const label = String(item?.label || "").trim();
  const rawTitle = String(item?.raw_title || "").trim();
  const source = extractPresenterVideoSource(rawTitle) || extractPresenterVideoSource(displayText);
  if (!source) return "";
  const labelLooksLikeVideo = /영상|비디오|video|movie|media/i.test(label);
  const sourceLooksLikeVideo = /\.(mp4|webm|mov|m4v)(?:[?#].*)?$/i.test(source);
  return labelLooksLikeVideo || sourceLooksLikeVideo ? source : "";
}

function extractPresenterVideoSource(value) {
  const text = String(value || "").trim();
  if (!text) return "";
  const cleaned = text.replace(/^(?:대기\s*)?(?:영상|비디오|video|movie)\s*:?\s*/i, "").trim();
  const direct = normalizePresenterMediaSource(cleaned);
  if (direct) return direct;
  const match = text.match(/(?:https?:\/\/[^\s"'<>]+|\.{0,2}\/[^\s"'<>]+|[^\s"'<>]+\.(?:mp4|webm|mov|m4v)(?:[?#][^\s"'<>]*)?)/i);
  return normalizePresenterMediaSource(match?.[0] || "");
}

function normalizePresenterMediaSource(value) {
  const source = String(value || "").trim();
  if (!source) return "";
  if (globalThis.MindexSongTiming?.ownsSource(source)) return source;
  if (/^(javascript|data):/i.test(source)) return "";
  if (/^(https?:\/\/|\/|\.{1,2}\/)/i.test(source)) return source;
  const worshipBackgroundSource = normalizePresenterWorshipBackgroundSource(source);
  if (worshipBackgroundSource) return worshipBackgroundSource;
  if (/\.(mp4|webm|mov|m4v|png|jpe?g|gif|webp|svg|pdf|mp3|m4a|wav|aac|ogg|flac)(?:[?#].*)?$/i.test(source)) return source;
  return "";
}

function normalizePresenterWorshipBackgroundSource(source) {
  const text = String(source || "").trim();
  if (!text || !text.includes(`${WORSHIP_BACKGROUND_BASE}/`)) return "";
  const suffixMatch = text.match(/([?#].*)$/);
  const suffix = suffixMatch ? suffixMatch[1] : "";
  const clean = suffix ? text.slice(0, -suffix.length) : text;
  const fileName = worshipBackgroundFileNameFromPath(clean);
  if (!fileName) return "";
  const candidate = worshipBackgroundCandidateFileNames(fileName)
    .find((name) => WORSHIP_BACKGROUND_STATIC_FILES.has(name));
  if (!candidate) return "";
  const prefix = clean.slice(0, clean.length - fileName.length);
  return `${prefix}${candidate}${suffix}`;
}

function presenterMediaSourceIsImage(value) {
  return /\.(png|jpe?g|gif|webp|svg)(?:[?#].*)?$/i.test(String(value || "").trim());
}

function presenterMediaSourceIsYoutube(value) {
  return /(?:youtube\.com|youtu\.be)\//i.test(String(value || "").trim());
}

function presenterSlideAudioSource(slide) {
  const syncedSource = normalizePresenterMediaSource(slide?.syncTimeline?.audioSrc || "");
  if (syncedSource) return syncedSource;
  if (presenterSlideElementType(slide) !== PRESENTER_ELEMENT_TYPES.AUDIO) return "";
  return normalizePresenterMediaSource(slide.audioSrc || slide.asset?.url || slide.text);
}

function presenterPlaybackConfig(value, elementType = "") {
  const parsed = normalizeServicePlaybackConfig(value, elementType);
  const type = String(elementType || "").trim().toLowerCase();
  const defaults = type === "ready-video"
    ? { autoplay: true, muted: true, loop: true, controls: false }
    : type === "intro-video"
      ? { autoplay: true, muted: false, loop: false, controls: false, autoAdvanceOnEnd: true }
    : type === "audio"
      ? { output: "controller-audio", autoplay: false, muted: false, loop: false, controls: false }
      : { autoplay: true, muted: false, loop: false, controls: false };
  return { ...defaults, ...(parsed || {}) };
}

function splitPresenterLyricChunks(lyrics, linesPerSlide = 2) {
  const lines = splitFreeShowLines(normalizeLyricsForCopy(lyrics))
    .map((line) => line.trim())
    .filter(Boolean);
  const chunkSize = Math.max(1, Number(linesPerSlide) || 2);
  const chunks = [];
  for (let i = 0; i < lines.length; i += chunkSize) {
    chunks.push(lines.slice(i, i + chunkSize).join("\n"));
  }
  return chunks;
}

function getServiceItemVersion(song, item, service) {
  if (typeof serviceItemNeedsVersionChoice === "function" && (serviceItemNeedsVersionChoice(item) || servicePraiseInputMode(item) === "manual_praise")) return null;
  const versions = song?.versions || [];
  if (!versions.length) return null;

  const explicitVersionId = item?.version_id || item?.song_version_id;
  if (explicitVersionId) {
    const explicit = versions.find((version) => version.id === explicitVersionId);
    if (explicit) return explicit;
  }

  const displayText = serviceItemDisplayText(item);
  const { no, title } = splitHymnNo(displayText);
  const lookupTitles = serviceItemVersionLookupTitles(displayText, title, item?.raw_title);
  const directMatch = versions.find((version) =>
    serviceVersionLookupNames(song, version).some((name) =>
      lookupTitles.some((target) => name === target || name.startsWith(target) || target.startsWith(name)),
    ),
  );
  if (directMatch) return directMatch;

  const byServiceType = versions.find((version) =>
    serviceTypePreferredPraiseTypes(service?.type_id).some((type) =>
      versionEffectivePraiseTypes(song, version).includes(type),
    ),
  );
  if (byServiceType) return byServiceType;

  if (no) {
    const hymnVersion = versions.find((version) => versionEffectivePraiseTypes(song, version).includes("hymn"));
    if (hymnVersion) return hymnVersion;
  } else if (song?.hymn_no) {
    const nonHymnVersion = versions.find((version) =>
      versionEffectivePraiseTypes(song, version).some((type) => type === "ccm" || type === "children"),
    );
    if (nonHymnVersion) return nonHymnVersion;
  }

  return versions.find((version) => version.id === getDefaultVersionId(song)) || versions[0];
}

function presenterSongForServiceItem(item = {}, displayText = serviceItemDisplayText(item), label = item?.label || "", service = null) {
  const frozenSong = globalThis.MindexPresenterFreshness?.song(item.song_id, service?.id);
  if (frozenSong) return frozenSong;
  const linkedSong = item.song_id
    ? (typeof songById === "function" ? songById(item.song_id) : state.songs.find((candidate) => candidate.id === item.song_id) || null)
    : null;
  if (linkedSong) return linkedSong;
  if (!isSongServiceLabel(label) && !isPresenterSpecialSongItem(item)) return null;
  return findServicePraiseSong(displayText) || presenterSyntheticHymnSongFromDisplayText(displayText);
}

function presenterSyntheticHymnSongFromDisplayText(displayText = "") {
  const { no, title } = splitHymnNo(displayText);
  const hymnNo = normalizedHymnScoreNumber(no);
  if (!hymnNo) return null;
  const cleanTitle = stripHymnNumber(title || displayText).trim() || `찬송가 ${hymnNo}`;
  return {
    id: `__synthetic_hymn_${hymnNo}__`,
    title: cleanTitle,
    hymn_no: hymnNo,
    versions: [],
    _syntheticHymn: true,
  };
}

function getPresenterServiceItemVersion(song, item, service) {
  if (typeof serviceItemNeedsVersionChoice === "function" && (serviceItemNeedsVersionChoice(item) || servicePraiseInputMode(item) === "manual_praise")) return null;
  const preferred = getServiceItemVersion(song, item, service);
  if (presenterVersionHasUsableLyrics(preferred)) return preferred;
  return presenterFallbackLyricVersion(song, preferred) || preferred;
}

function presenterFallbackLyricVersion(song, preferred = null) {
  const versions = song?.versions || [];
  if (!versions.length) return null;
  const defaultVersionId = getDefaultVersionId(song);
  const candidates = [
    versions.find((version) => version.id === defaultVersionId),
    ...versions,
  ].filter(Boolean);
  return candidates.find((version) => version !== preferred && presenterVersionHasUsableLyrics(version)) || null;
}

function presenterVersionHasUsableLyrics(version = null) {
  return normalizeForms(version?.forms || []).some((form) => normalizeLyricsForCopy(form.lyrics));
}

function serviceTypePreferredPraiseTypes(typeId) {
  if (["children", "nursery"].includes(typeId)) return ["children"];
  if (typeId === "youth" || typeId === "young-adult") return ["ccm"];
  return [];
}

function serviceItemVersionLookupTitles(...values) {
  return [...new Set(
    values
      .flatMap((value) => [value, stripTitleDecorations(value)])
      .map(normalizeTitle)
      .filter((value) => value && value.length > 1),
  )];
}

function serviceVersionLookupNames(song, version) {
  return serviceItemVersionLookupTitles(
    version?.name,
    version?.curated_version_name,
    version?.raw_section_name,
    version?.version_label,
    versionDisplayName(song, version),
  );
}

function isSongServiceLabel(label) {
  const compact = String(label || "").replace(/\s+/g, "");
  if (!compact) return false;
  if (compact === "봉헌") return true;
  if (compact === "결단" || compact === "파송") return true;
  if (/찬양|찬송|특송|송영/.test(compact)) return true;
  return /^(결단|봉헌|파송)(찬양|찬송)$/.test(compact);
}

function presenterStatePayload(serviceId = state.presenter.serviceId) {
  const service = state.services.find((svc) => svc.id === serviceId);
  const slides = presenterSlidesForService(serviceId);
  const serviceChromakey = presenterServiceUsesChromakey(service);
  const hasCleanSlides = slides.some((slide) =>
    presenterSlideOutputContext(slide, serviceChromakey) === "clean");
  const backgroundImages = presenterBackgroundSourcesForService(service, {
    includeChromakeyCleanSlides: hasCleanSlides,
  });
  return {
    serviceId,
    outputSessionId: state.presenter.outputSessionId || "",
    serviceType: service?.type_id || "",
    serviceTitle: [serviceDisplayTypeName(service), service ? formatServiceDate(service) : ""].filter(Boolean).join(" · "),
    serviceDate: service?.date || "",
    transitionLogo: normalizePresenterTransitionLogo(serviceRawSourceRef(service).transitionLogo),
    presentationDesign: normalizePresenterServiceDesign(serviceRawSourceRef(service).presentationDesign),
    chromakey: serviceChromakey,
    outputTheme: presenterOutputTheme(service?.type_id),
    backgroundImage: backgroundImages[0] || "",
    backgroundImages,
    slides,
    index: clampPresenterIndex(state.presenter.index, slides.length),
    slideAnchor: presenterSlideAnchor(slides[clampPresenterIndex(state.presenter.index, slides.length)]),
    pptxProgress: state.presenter.pptxProgress || null,
    safetyBlank: Boolean(state.presenter.safetyBlank),
    liveScripture: state.presenter.liveScripture?.active ? state.presenter.liveScripture : null,
    livePraise: null,
    updatedAt: Date.now(),
  };
}

function readPresenterControllerRestorePayload() {
  try {
    const stored = readPresenterStoredPayload();
    const payload = stored ? normalizePresenterPayload(stored) : null;
    if (!payload?.serviceId || !payload.slides.length) return null;
    if (Date.now() - payload.updatedAt > PRESENTER_CONTROLLER_RESTORE_MAX_AGE_MS) return null;
    return payload;
  } catch {
    return null;
  }
}

function primePresenterControllerRestore() {
  state.presenter.restorePayload = readPresenterControllerRestorePayload();
}

function restorePresenterControllerSession() {
  // Only reattach when an output has actually answered the controller. This
  // prevents an old local payload from reviving a presentation on app launch.
  if (state.presenter.serviceId || !isPresenterOutputHeartbeatOpen()) return "none";

  const payload = state.presenter.restorePayload || readPresenterControllerRestorePayload();
  if (!payload) return "none";

  const service = state.services.find((candidate) => candidate.id === payload.serviceId);
  if (!service || !state.serviceItems[service.id]) return "pending";

  const slides = buildServicePresenterSlides(service.id);
  if (!slides.length) return "pending";

  state.presenter.serviceId = service.id;
  state.presenter.slides = slides;
  state.presenter.index = presenterSlideIndexForAnchor(
    slides,
    payload.slideAnchor || presenterSlideAnchor(payload.slides?.[payload.index]),
    payload.index,
  );
  state.presenter.pptxProgress = payload.pptxProgress || null;
  state.presenter.safetyBlank = Boolean(payload.safetyBlank);
  state.presenter.jumpDraft = "";
  state.presenter.liveScripture = payload.liveScripture?.active
    ? {
      reference: payload.liveScripture.reference || "",
      draft: "",
      active: true,
      slide: payload.liveScripture.slide || null,
    }
    : { reference: "", draft: "", active: false, slide: null };
  state.presenter.livePraise = emptyLivePraiseState();
  state.presenter.restorePayload = null;

  // Reattaching to the live output must not move the view: a reload while another service is open
  // (e.g. preparing the next one) keeps that service; the return-to-live control covers the rest.
  if (state.module === "presenter" && (!state.selectedServiceId || state.selectedServiceId === service.id)) {
    state.selectedServiceId = service.id;
    state.selectedServiceTypeId = service.type_id;
    state.presenter.viewServiceId = service.id;
  }

  publishPresenterState({ force: true });
  refreshPresenterOutputConnectionState();
  return "restored";
}

function bindPresenterChannel() {
  window.addEventListener("message", (event) => {
    if (event.origin !== window.location.origin || !event.source
      || !event.data?.type?.startsWith("presenter-")
      || !acceptsPresenterOutputMessage(event.data)) return;
    // Recover the real Window reference after a controller reload, without opening anything.
    if(state.presenter.outputWindow&&state.presenter.outputWindow!==event.source) return;
    state.presenter.outputWindow = event.source;
    handlePresenterControllerMessage(event.data);
  });
  window.addEventListener("storage", handlePresenterStorageSignal);
  if (!("BroadcastChannel" in window)) return;
  try {
    state.presenter.channel = new BroadcastChannel(PRESENTER_CHANNEL);
  } catch {
    state.presenter.channel = null;
    return;
  }
  state.presenter.channel.onmessage = (event) => handlePresenterControllerMessage(event.data);
  // The output can stay open while the controller reloads. Ask it to announce
  // itself again so sidebar clicks immediately return to live-output behavior.
  state.presenter.channel.postMessage({ type: "presenter-controller-ready" });
}

const retiredPresenterOutputClients = new Set();

function acceptsPresenterOutputMessage(message) {
  if (!message.type?.startsWith("presenter-")) return false;
  if (state.presenter.outputStopAt) return false;
  const expected = state.presenter.outputSessionId
    || readPresenterStoredPayload()?.outputSessionId;
  if (expected && message.outputSessionId !== expected) return false;
  if (message.clientId && retiredPresenterOutputClients.has(message.clientId)) return false;
  const current = state.presenter.outputClientId;
  if (current && message.clientId !== current) {
    const announcing = ["presenter-ready", "presenter-heartbeat"].includes(message.type);
    if (!announcing || isPresenterOutputHeartbeatOpen()) return false;
    retiredPresenterOutputClients.add(current);
  }
  if (expected) state.presenter.outputSessionId = expected;
  return true;
}

function handlePresenterControllerMessage(message = {}) {
  if (!acceptsPresenterOutputMessage(message)) return;
  if (["presenter-ready", "presenter-heartbeat"].includes(message.type)) {
    state.presenter.outputTransportVersion = Number(message.transportVersion) || 0;
  }
  if (message.type === "presenter-ready") {
    markPresenterOutputConnected(message.clientId);
    const restoreState = restorePresenterControllerSession();
    if (restoreState === "none") publishPresenterState({ force: true });
    return;
  }
  if (message.type === "presenter-heartbeat") {
    markPresenterOutputConnected(message.clientId, message.warmup);
    restorePresenterControllerSession();
    reconcilePresenterTransportReceipt(message);
    state.presenter.videoHealth = message.videoHealth
      ? { ...message.videoHealth, clientId: message.clientId, receivedAt: Date.now() } : null;
    syncPresenterVideoHealthControl();
    if (message.pptxError && message.pptxError !== state.presenter.pptxError) showToast(message.pptxError, "error");
    state.presenter.pptxError = message.pptxError || "";
    adoptPresenterPptxMetadata(message.pptxMetadata);
    return;
  }
  if (message.type === "presenter-output-disconnect") {
    markPresenterOutputDisconnected(message.clientId);
    return;
  }
  if (message.type === "presenter-control") {
    if (message.action === "children-resume") {
      globalThis.MindexSongTiming?.resumeAutoSync(state.presenter.serviceId, message);
      return;
    }
    if (message.action === "children-play") {
      playPresenterChildrenTitle(message);
      return;
    }
    if (message.action === "stop") {
      stopPresenterOutput(state.presenter.serviceId);
      return;
    }
    markPresenterOutputConnected(message.clientId);
    runPresenterAction(message.action, state.presenter.serviceId, {
      index: Number.isFinite(Number(message.index)) ? Number(message.index) : undefined,
    });
    return;
  }
  if (message.type === "presenter-jump-draft") {
    if (message.value) setPresenterJumpDraft(message.value, state.presenter.serviceId);
    else clearPresenterJumpDraft(state.presenter.serviceId);
  }
}

function handlePresenterStorageSignal(event) {
  if (event.key !== PRESENTER_SIGNAL_KEY || !event.newValue) return;
  try {
    handlePresenterControllerMessage(JSON.parse(event.newValue));
  } catch {
    // Ignore malformed cross-window presenter signals.
  }
}

function markPresenterOutputConnected(clientId = "", warmup = null) {
  if (state.presenter.outputStopAt) {
    if (clientId && clientId === state.presenter.outputStoppingClientId) return;
    state.presenter.outputStopAt = 0;
    state.presenter.outputStoppingClientId = "";
  }
  const wasConnected = state.presenter.outputConnectedAt
    && Date.now() - state.presenter.outputConnectedAt <= PRESENTER_OUTPUT_HEARTBEAT_TTL_MS;
  state.presenter.outputConnectedAt = Date.now();
  state.presenter.outputPendingAt = 0;
  state.presenter.outputBlockedAt = 0;
  state.presenter.outputAttemptServiceId = "";
  if (clientId) state.presenter.outputClientId = clientId;
  const warmupChanged = updatePresenterOutputWarmupState(warmup);
  if (!state.presenter.outputWindowMonitor) startPresenterOutputWindowMonitor(state.presenter.serviceId);
  if (!wasConnected || warmupChanged) refreshPresenterOutputConnectionState();
}

function markPresenterOutputDisconnected(clientId = "") {
  if (clientId && state.presenter.outputClientId && clientId !== state.presenter.outputClientId) return;
  state.presenter.outputConnectedAt = 0;
  state.presenter.outputPendingAt = 0;
  state.presenter.outputWarmup = null;
  startPresenterOutputWindowMonitor(state.presenter.serviceId);
  refreshPresenterOutputConnectionState();
  if (state.presenter.serviceId) renderPresenterControlState(state.presenter.serviceId);
}

function updatePresenterOutputWarmupState(warmup = null) {
  if (!warmup || typeof warmup !== "object") return false;
  const total = Math.max(0, Number(warmup.total) || 0);
  const ready = Math.max(0, Math.min(total, Number(warmup.ready) || 0));
  const queued = Math.max(0, Math.min(total, Number(warmup.queued) || 0));
  const nextWarmup = {
    serviceId: warmup.serviceId || state.presenter.serviceId || "",
    total,
    ready,
    queued,
    complete: Boolean(warmup.complete) || (total > 0 && ready >= total),
    updatedAt: Date.now(),
  };
  const previous = state.presenter.outputWarmup;
  const changed = !previous
    || previous.serviceId !== nextWarmup.serviceId
    || previous.total !== nextWarmup.total
    || previous.ready !== nextWarmup.ready
    || previous.queued !== nextWarmup.queued
    || previous.complete !== nextWarmup.complete;
  state.presenter.outputWarmup = nextWarmup;
  return changed;
}

function refreshPresenterOutputConnectionState() {
  const serviceIds = new Set([state.presenter.serviceId, state.selectedServiceId].filter(Boolean));
  serviceIds.forEach((serviceId) => renderPresenterControlState(serviceId));
}

function publishPresenterState(options = {}) {
  const payload = presenterStatePayload();
  if (!options.force && !payload.serviceId && !payload.slides.length) return;
  publishPresenterPayload(payload, options);
}

const PRESENTER_NAVIGATION_STORAGE_KEY = "mindex.presenter.state.navigation";
let presenterTransportSequence = 0;
const presenterTransportSession = `${Date.now()}:${Math.random()}`;
let presenterTransportSnapshot = null;
let presenterTransportLatest = null;

function reconcilePresenterTransportReceipt(message = {}) {
  const latest = presenterTransportLatest;
  if (!latest || typeof message.receivedMessageId !== "string") return;
  if (state.presenter.outputStopAt || latest.payload.serviceId !== state.presenter.serviceId) return;
  if (message.receivedMessageId === latest.payload.messageId) return;
  if (Date.now() - latest.sentAt < 750 || Date.now() - latest.retriedAt < 1000) return;
  latest.retriedAt = Date.now();
  // Replay the same ID: a delayed acknowledgement must not render twice.
  safeStorageSet("local", PRESENTER_STORAGE_KEY, JSON.stringify(latest.payload));
  try { state.presenter.outputWindow?.postMessage({type:"presenter-state",payload:latest.payload},window.location.origin); } catch {}
  try {
    state.presenter.channel?.postMessage({ type: "presenter-state", payload: latest.payload });
  } catch {
    // The storage event remains available when the channel has closed.
  }
}

function mergePresenterNavigation(snapshot, navigation) {
  if (!snapshot || navigation?.snapshotId !== snapshot.snapshotId) return snapshot;
  if (Number(navigation.updatedAt) < Number(snapshot.updatedAt)) return snapshot;
  return { ...snapshot, ...navigation, slides: snapshot.slides };
}

function readPresenterStoredPayload() {
  const snapshot = JSON.parse(safeStorageGet("local", PRESENTER_STORAGE_KEY, "null") || "null");
  try {
    const navigation = JSON.parse(safeStorageGet("local", PRESENTER_NAVIGATION_STORAGE_KEY, "null") || "null");
    return mergePresenterNavigation(snapshot, navigation);
  } catch {
    return snapshot;
  }
}

function publishPresenterPayload(payload, options = {}) {
  const { index, slideAnchor, pptxProgress, safetyBlank, liveScripture, livePraise, updatedAt,
    snapshotId: previousSnapshotId, messageId: previousMessageId, ...content } = payload;
  const contentKey = JSON.stringify(content);
  const messageId = `${presenterTransportSession}:${++presenterTransportSequence}`;
  const compact = !options.force && state.presenter.outputTransportVersion === 1
    && presenterTransportSnapshot?.contentKey === contentKey;
  if (compact) {
    const navigation = { snapshotId: presenterTransportSnapshot.id, messageId,
      index, slideAnchor, pptxProgress, safetyBlank, liveScripture, livePraise, updatedAt };
    presenterTransportLatest = { payload: { ...payload, ...navigation }, sentAt: Date.now(), retriedAt: 0 };
    safeStorageSet("local", PRESENTER_NAVIGATION_STORAGE_KEY, JSON.stringify(navigation));
    try { state.presenter.outputWindow?.postMessage({type:"presenter-navigation",payload:navigation},window.location.origin); } catch {}
    try {
      state.presenter.channel?.postMessage({ type: "presenter-navigation", payload: navigation });
    } catch {
      // Keep controller navigation usable while storage delivers the move.
    }
    return;
  }
  const snapshot = { ...payload, snapshotId: messageId, messageId };
  presenterTransportLatest = { payload: snapshot, sentAt: Date.now(), retriedAt: 0 };
  const stored = safeStorageSet("local", PRESENTER_STORAGE_KEY, JSON.stringify(snapshot));
  try { state.presenter.outputWindow?.postMessage({type:"presenter-state",payload:snapshot},window.location.origin); } catch {}
  presenterTransportSnapshot = stored ? { id: messageId, contentKey } : null;
  try {
    state.presenter.channel?.postMessage({ type: "presenter-state", payload: snapshot });
  } catch {
    // Storage delivery and heartbeat reconciliation can recover this send.
  }
}

function presenterOutputUrl(options = {}) {
  const url = new URL(window.location.href);
  url.searchParams.set("output", "presenter");
  if (state.presenter.outputSessionId) url.searchParams.set("outputSession", state.presenter.outputSessionId);
  url.hash = "";
  return url.toString();
}

function presenterChildrenPlayKey(event, key = "p") {
  return !event.metaKey && !event.ctrlKey && !event.altKey && !event.isComposing
    && event.keyCode !== 229 && (event.code === `Key${key.toUpperCase()}` || event.key?.toLowerCase() === key);
}

function playPresenterChildrenTitle(expected = null) {
  const serviceId = state.presenter.serviceId;
  const slide = state.presenter.slides[state.presenter.index];
  if (!serviceId || !presenterControllerIsLive(serviceId) || state.selectedServiceId !== serviceId
    || slide?.type !== "song-title" || !slide.songTimingEligible || !slide.syncTimeline?.localTiming
    || !slide.syncTimeline.intro) return false;
  if (expected && (expected.serviceId !== serviceId || expected.index !== state.presenter.index
    || expected.groupId !== slide.syncTimeline.groupId)) return false;
  if (!state.serviceMusic.playing && !state.serviceMusic.pending) {
    void globalThis.MindexSongTiming?.play(serviceId, slide.songTimingElementId || slide.elementId);
  }
  return true;
}

function handlePresenterShortcut(event) {
  const presenterServiceId = state.presenter.serviceId;
  if (state.module !== "presenter" || !presenterServiceId) return false;
  if (event.key === "F11" && isPresenterOutputWindowOpen()) {
    consumePresenterShortcutEvent(event);
    state.presenter.exitArmedAt = 0;
    requestPresenterOutputFullscreenFromController();
    return true;
  }
  if (presenterChildrenPlayKey(event) || presenterChildrenPlayKey(event, "r")) {
    const target = event.target instanceof Element ? event.target : null;
    if (target?.closest("input, textarea, select, [contenteditable]:not([contenteditable='false']), dialog, [role='dialog']")) return false;
    if (shouldKeepPresenterShortcutInFocusedControl(event)
      && !target?.closest(".svc-slide-thumb[data-presenter-index], .svc-slide-thumb-wrap[data-presenter-index]")) return false;
    if (event.repeat) return false;
    const handled = presenterChildrenPlayKey(event, "r")
      ? globalThis.MindexSongTiming?.resumeAutoSync(presenterServiceId) : playPresenterChildrenTitle();
    if (handled) { consumePresenterShortcutEvent(event); return true; }
    return false;
  }
  if (shouldKeepPresenterShortcutInFocusedControl(event)) return false;
  if (event.metaKey || event.ctrlKey || event.altKey) return false;
  const activeServiceSelected = state.selectedServiceId === presenterServiceId;

  if (event.key === "Escape") {
    consumePresenterShortcutEvent(event);
    if (activeServiceSelected && state.presenter.jumpDraft) {
      clearPresenterJumpDraft(presenterServiceId);
      return true;
    }
    const now = Date.now();
    if (now - (state.presenter.exitArmedAt || 0) <= PRESENTER_OUTPUT_ESCAPE_EXIT_MS) {
      stopPresenterOutput(presenterServiceId);
      return true;
    }
    state.presenter.exitArmedAt = now;
    return true;
  }

  if (!activeServiceSelected) return false;
  const focusActiveSlide = presenterBoardFocusShouldFollowLiveSlide(presenterServiceId);

  if (/^\d$/.test(event.key)) {
    consumePresenterShortcutEvent(event);
    state.presenter.exitArmedAt = 0;
    setPresenterJumpDraft(`${state.presenter.jumpDraft || ""}${event.key}`, presenterServiceId);
    return true;
  }

  if (event.key === "Enter" && state.presenter.jumpDraft) {
    consumePresenterShortcutEvent(event);
    state.presenter.exitArmedAt = 0;
    commitPresenterJumpDraft(presenterServiceId, { focusActiveSlide });
    return true;
  }

  if (event.key === "Enter" || event.key === "ArrowRight" || event.key === "ArrowDown" || event.key === "PageDown" || event.key === " ") {
    consumePresenterShortcutEvent(event);
    state.presenter.exitArmedAt = 0;
    runPresenterAction("next", presenterServiceId, { focusActiveSlide });
    return true;
  }

  if (event.key === "ArrowLeft" || event.key === "ArrowUp" || event.key === "PageUp") {
    consumePresenterShortcutEvent(event);
    state.presenter.exitArmedAt = 0;
    runPresenterAction("prev", presenterServiceId, { focusActiveSlide });
    return true;
  }

  if (event.key === "Home") {
    consumePresenterShortcutEvent(event);
    state.presenter.exitArmedAt = 0;
    runPresenterAction("first", presenterServiceId, { focusActiveSlide });
    return true;
  }

  if (event.key === "End") {
    consumePresenterShortcutEvent(event);
    state.presenter.exitArmedAt = 0;
    runPresenterAction("last", presenterServiceId, { focusActiveSlide });
    return true;
  }

  return false;
}

function consumePresenterShortcutEvent(event) {
  event.preventDefault?.();
  event.stopPropagation?.();
  event.stopImmediatePropagation?.();
}

function requestPresenterOutputFullscreenFromController() {
  const fail = () => showToast("송출 화면을 전체화면으로 전환하지 못했습니다. 송출 화면에서 직접 클릭해 주세요.", "error");
  if (window.mindexElectron?.fullscreenPresenterOutput) {
    window.mindexElectron.fullscreenPresenterOutput().catch(fail);
    return;
  }
  const output = presenterOutputWindowRef();
  if (!output || output.closed) {
    showToast("연결된 송출 창이 없습니다. 송출을 시작한 뒤 다시 시도해 주세요.", "info");
    return;
  }
  const requestId = `fullscreen:${Date.now()}:${Math.random()}`;
  const origin = window.location.origin;
  const finish = (success) => {
    window.clearTimeout(timer);
    window.removeEventListener("message", onResult);
    if (!success) fail();
  };
  const onResult = (event) => {
    if (event.origin !== origin || event.source !== output
      || event.data?.type !== "presenter-fullscreen-result" || event.data.requestId !== requestId) return;
    if (!event.data.success) console.warn("Presenter fullscreen rejected:", event.data.error || "unknown");
    finish(event.data.success === true);
  };
  const timer = window.setTimeout(() => finish(false), 5000);
  window.addEventListener("message", onResult);
  try {
    // Delegate while the clicked controller still owns focus and activation.
    // The browser brings the output forward when it enters fullscreen.
    output.postMessage({ type: "presenter-fullscreen-request", requestId }, { targetOrigin: origin, delegate: "fullscreen" });
  } catch { finish(false); }
}

function shouldKeepPresenterShortcutInFocusedControl(event) {
  const target = event?.target instanceof Element ? event.target : null;
  if (!target) return false;
  if (target.closest("[data-presenter-jump-input]")) {
    return !["ArrowRight", "ArrowDown", "PageDown", " ", "ArrowLeft", "ArrowUp", "PageUp"].includes(event.key);
  }
  if (target.closest("[data-service-music-action]")) return true;
  if (
    (presenterControllerNavigationKey(event.key) || /^\d$/.test(event.key) || event.key === "Escape")
    && target.closest("[data-presenter-action], .svc-slide-thumb[data-presenter-index][data-service-id], .svc-slide-thumb-wrap[data-presenter-index][data-service-id]")
  ) {
    return false;
  }
  if (target.closest("button, a, [role='button'], [tabindex]:not([tabindex='-1'])")) return true;
  return shouldKeepHorizontalNavigationInFocusedControl(target);
}

function presenterControllerNavigationKey(key = "") {
  return ["Enter", "ArrowRight", "ArrowDown", "PageDown", " ", "ArrowLeft", "ArrowUp", "PageUp", "Home", "End"].includes(key);
}

function isPresenterOutputRoute() {
  const params = new URLSearchParams(window.location.search);
  return params.get("output") === "presenter" || params.get("mindex-output") === "presenter";
}

function presenterOutputDocumentTitle(payload = {}) {
  const title = String(payload?.serviceTitle || "").split("·")[0].trim();
  return title || "MINDEX";
}

function syncPresenterOutputDocumentTitle(payload = {}) {
  document.title = presenterOutputDocumentTitle(payload);
}

function presenterScaleForBox(width, height, stageWidth = 1920, stageHeight = 1080) {
  const boxWidth = Number(width);
  const boxHeight = Number(height);
  if (!Number.isFinite(boxWidth) || !Number.isFinite(boxHeight) || boxWidth <= 0 || boxHeight <= 0) return 1;
  return Math.min(1, boxWidth / stageWidth, boxHeight / stageHeight);
}

function presenterPreviewScaleForBox(width, height, stageWidth = 1920, stageHeight = 1080) {
  const boxWidth = Number(width);
  const boxHeight = Number(height);
  const fittedScale = presenterScaleForBox(boxWidth, boxHeight, stageWidth, stageHeight);
  if (!Number.isFinite(boxWidth) || !Number.isFinite(boxHeight) || boxWidth <= 0 || boxHeight <= 0) {
    return fittedScale;
  }
  // A transformed 1920x1080 stage can be rasterized one device pixel short at
  // fractional scales. Overscan by one CSS pixel so its own paint always reaches
  // the clipped preview edge rather than exposing the parent backing.
  return Math.min(1, Math.max(
    (boxWidth + 1) / stageWidth,
    (boxHeight + 1) / stageHeight,
  ));
}

function applyPresenterOutputViewportScale(root = document.getElementById("presenterOutputRoot")) {
  if (!root) return;
  root.style.setProperty("--presenter-stage-scale", "1");
}

function applyPresenterPreviewScales(host = document) {
  if (!host?.querySelectorAll) return;
  // Read every frame before writing styles, avoiding one forced layout per slide.
  const updates = [...host.querySelectorAll(".svc-slide-mini-canvas.presenter-output-root")].map((canvas) => {
    const frame = canvas.closest(".svc-slide-thumb-frame, .svc-presenter-live-preview") || canvas.parentElement;
    const rect = frame?.getBoundingClientRect?.();
    const scale = presenterPreviewScaleForBox(
      rect?.width || 0,
      rect?.height || 0,
    );
    const currentScale = Number(canvas.style.getPropertyValue("--presenter-preview-scale"));
    return Number.isFinite(currentScale) && Math.abs(currentScale - scale) < 0.000001 ? null : { canvas, scale };
  });
  updates.forEach((update) => {
    if (!update) return;
    const { canvas, scale } = update;
    canvas.style.setProperty("--presenter-preview-scale", String(scale));
  });
}

// Serialize browser fullscreen transitions before script-driven output close.
// Closing during native fullscreen entry can crash macOS WebKit itself.
let presenterOutputFullscreenTask = null;
let presenterOutputClosing = null;

function enterPresenterOutputFullscreen() {
  if (presenterOutputClosing) return Promise.resolve();
  if (presenterOutputFullscreenTask) return presenterOutputFullscreenTask;
  const task = (async () => {
    if (!document.fullscreenElement) await document.documentElement.requestFullscreen({ navigationUI: "hide" });
  })();
  presenterOutputFullscreenTask = task;
  void task.then(() => { presenterOutputFullscreenTask = null; }, () => { presenterOutputFullscreenTask = null; });
  return task;
}

function closePresenterOutputBrowserWindow() {
  if (presenterOutputClosing) return presenterOutputClosing;
  presenterOutputClosing = (async () => {
    await presenterOutputFullscreenTask?.catch(() => {});
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
    } catch (error) {
      // Keep the window available for a native close if fullscreen exit fails.
      console.warn("Presenter fullscreen exit failed:", error);
      return false;
    }
    window.close();
    return true;
  })();
  void presenterOutputClosing.then((closed) => { if (!closed) presenterOutputClosing = null; });
  return presenterOutputClosing;
}

function closePresenterBrowserWindow(outputWindow) {
  if (!outputWindow || outputWindow.closed) return;
  if (typeof outputWindow.closePresenterOutputBrowserWindow === "function") {
    void outputWindow.closePresenterOutputBrowserWindow();
  } else {
    outputWindow.close?.();
  }
}

function setupPresenterDelegatedFullscreen() {
  window.addEventListener("message", async (event) => {
    if (event.origin !== window.location.origin || !window.opener || event.source !== window.opener
      || event.data?.type !== "presenter-fullscreen-request" || typeof event.data.requestId !== "string") return;
    let success = false;
    let errorMessage = "";
    try {
      await enterPresenterOutputFullscreen();
      success = Boolean(document.fullscreenElement);
    } catch (error) {
      errorMessage = `${error?.name || "Error"}: ${error?.message || "Fullscreen request failed"}`;
    }
    event.source.postMessage({ type: "presenter-fullscreen-result", requestId: event.data.requestId, success, error: errorMessage }, event.origin);
  });
}

function setupPresenterStartupFullscreen() {
  const url = new URL(window.location.href);
  if (url.searchParams.get("fullscreen") !== "start") return;
  // Consume the launch request so refresh and later slide updates cannot repeat it.
  url.searchParams.delete("fullscreen");
  window.history.replaceState(window.history.state, "", url.toString());
  const target = document.documentElement;
  if (!target.requestFullscreen || document.fullscreenEnabled === false) return;
  if (document.fullscreenElement) return;
  // A startup attempt is intentionally one-shot. Retrying from a later slide
  // click causes Chrome's native "Press Esc" notice during the service.
  void enterPresenterOutputFullscreen().catch(() => {});
}

function initPresenterOutputCore() {
  document.title = "MINDEX";
  document.documentElement.classList.add("presenter-output-document");
  document.body.className = "presenter-output-body";
  document.body.innerHTML = `
    <main id="presenterOutputRoot" class="presenter-output-root no-chromakey" aria-live="polite"></main>
  `;
  // The HTML bootstrap hides the controller shell until this output root exists.
  document.documentElement.classList.remove("presenter-output-pending");
  applyPresenterOutputViewportScale();
  window.addEventListener("resize", () => applyPresenterOutputViewportScale());
  setupPresenterStartupFullscreen();
  setupPresenterDelegatedFullscreen();

  let currentPayload = null;
  let channel = null;
  let jumpDraft = "";
  let exitArmedAt = 0;
  let outputStopping = false;
  const outputSessionId = new URL(window.location.href).searchParams.get("outputSession") || "";
  const outputClientId = `presenter-output:${Date.now()}:${Math.random().toString(36).slice(2)}`;
  let heartbeatTimer = null;
  const receivedMessages = new Set();
  const receivedSequences = new Map();
  const applyPayload = (payload) => {
    if (outputSessionId && payload?.outputSessionId && payload.outputSessionId !== outputSessionId) return;
    if (payload?.messageId && receivedMessages.has(payload.messageId)) return;
    if (payload?.messageId) {
      const split = payload.messageId.lastIndexOf(":");
      const sender = payload.messageId.slice(0, split);
      const sequence = Number(payload.messageId.slice(split + 1));
      if (Number.isFinite(sequence) && sequence <= (receivedSequences.get(sender) || 0)) return;
      if (Number.isFinite(sequence)) receivedSequences.set(sender, sequence);
      receivedMessages.add(payload.messageId);
      if (receivedMessages.size > 128) receivedMessages.delete(receivedMessages.values().next().value);
    }
    currentPayload = normalizePresenterPayload(payload);
    syncPresenterOutputDocumentTitle(currentPayload);
    renderPresenterOutput(currentPayload, { onAutoAdvance: requestPresenterOutputNext });
  };
  const applyInitialPresenterState = (payload) => {
    applyPayload(payload);
  };
  const sendControllerMessage = (message) => {
    const payload = { ...message, outputSessionId, updatedAt: Date.now() };
    const announce=["presenter-ready","presenter-heartbeat"].includes(message.type);
    if(announce){try { window.opener?.postMessage(payload, window.location.origin); } catch {}}
    // Actions use one transport only: duplicate next/previous would skip slides.
    if(channel){try { channel.postMessage(payload);return true; } catch {}}
    if(!announce){try { window.opener?.postMessage(payload, window.location.origin); } catch {}}
    return Boolean(window.opener);
  };
  const postHeartbeat = () => {
    if (outputStopping) return;
    sendControllerMessage({
      type: "presenter-heartbeat",
      clientId: outputClientId,
      transportVersion: 1,
      receivedMessageId: currentPayload?.messageId || "",
      pptxError: document.getElementById("presenterOutputRoot")?.dataset.pptxError || "",
      pptxMetadata: document.getElementById("presenterOutputRoot")?._pptxMetadata || null,
      videoHealth: presenterOutputVideoHealth(currentPayload),
      warmup: presenterOutputWarmupSummary(),
    });
  };
  presenterOutputImageWarmupState.onProgress = postHeartbeat;
  const closeOutputChannel = () => {
    if (heartbeatTimer) {
      window.clearInterval(heartbeatTimer);
      heartbeatTimer = null;
    }
    channel?.close?.();
    channel = null;
    presenterOutputImageWarmupState.onProgress = null;
    clearPresenterOutputVideoWarmup();
  };
  const canCloseOutputWindow = () => {
    try {
      return Boolean(window.opener && !window.opener.closed);
    } catch {
      return false;
    }
  };
  const requestPresenterOutputStop = () => {
    if (outputStopping) return;
    outputStopping = true;
    if (heartbeatTimer) {
      window.clearInterval(heartbeatTimer);
      heartbeatTimer = null;
    }
    const payload = {
      type: "presenter-control",
      action: "stop",
      clientId: outputClientId,
      updatedAt: Date.now(),
    };
    sendControllerMessage(payload);
    window.setTimeout(() => {
      closeOutputChannel();
      if (canCloseOutputWindow()) void closePresenterOutputBrowserWindow();
    }, 120);
  };
  const applyPresenterOutputActionLocally = (action, detail = {}) => {
    if (!currentPayload) return;
    currentPayload = applyPresenterActionToPayload(currentPayload, action, detail);
    publishPresenterPayload(currentPayload);
    renderPresenterOutput(currentPayload, { onAutoAdvance: requestPresenterOutputNext });
  };
  const requestPresenterOutputNext = () => {
    postHeartbeat();
    sendControllerMessage({ type: "presenter-control", action: "next", clientId: outputClientId });
    applyPresenterOutputActionLocally("next");
  };
  const postDisconnect = () => {
    const payload = {
      type: "presenter-output-disconnect",
      clientId: outputClientId,
      updatedAt: Date.now(),
    };
    sendControllerMessage(payload);
  };

  const renderStoredState = () => {
    try {
      const stored = readPresenterStoredPayload();
      applyPayload(stored);
    } catch {
      applyPayload(null);
    }
  };
  const renderFreshStoredState = () => {
    try {
      const stored = readPresenterStoredPayload();
      if (!stored?.updatedAt || Date.now() - Number(stored.updatedAt) > 5000) return false;
      applyPayload(stored);
      return true;
    } catch {
      return false;
    }
  };
  let lastVideoRetryId = "";
  const handleOutputSignalMessage = (message = {}) => {
    if (message.type === "presenter-video-retry") {
      if (message.clientId !== outputClientId || !message.requestId || message.requestId === lastVideoRetryId) return;
      lastVideoRetryId = message.requestId;
      retryPresenterOutputVideo(message, currentPayload).finally(postHeartbeat);
      return;
    }
    if (message?.type === "presenter-navigation") {
      if (message.payload?.snapshotId === currentPayload?.snapshotId) {
        applyPayload(mergePresenterNavigation(currentPayload, message.payload));
      } else {
        renderStoredState();
      }
      return;
    }
    if (message?.type === "presenter-state") {
      applyInitialPresenterState(message.payload);
      return;
    }
    if (message?.type === "presenter-controller-ready") {
      sendControllerMessage({ type: "presenter-ready", clientId: outputClientId });
      postHeartbeat();
      return;
    }
    if (message?.type === "presenter-output-close") {
      if (outputSessionId && message.outputSessionId !== outputSessionId) return;
      window.setTimeout(() => {
        closeOutputChannel();
        void closePresenterOutputBrowserWindow();
      }, 40);
    }
  };

  window.addEventListener("message", event => {
    if(event.origin!==window.location.origin || event.source!==window.opener || !event.source)return;
    if(event.data?.type==="presenter-state")applyInitialPresenterState(event.data.payload);
    else handleOutputSignalMessage(event.data || {});
  });

  if ("BroadcastChannel" in window) {
    try {
      channel = new BroadcastChannel(PRESENTER_CHANNEL);
    } catch {
      channel = null;
    }
  }
  if (channel) {
    renderFreshStoredState();
    channel.onmessage = (event) => {
      if (event.data?.type === "presenter-video-retry") {
        handleOutputSignalMessage(event.data);
        return;
      }
      if (event.data?.type === "presenter-navigation") {
        handleOutputSignalMessage(event.data);
        return;
      }
      if (event.data?.type === "presenter-state") {
        applyInitialPresenterState(event.data.payload);
        return;
      }
      if (event.data?.type === "presenter-controller-ready") {
        sendControllerMessage({ type: "presenter-ready", clientId: outputClientId });
        postHeartbeat();
        return;
      }
      if (event.data?.type === "presenter-output-close") {
        if (outputSessionId && event.data.outputSessionId !== outputSessionId) return;
        window.setTimeout(() => {
          closeOutputChannel();
          void closePresenterOutputBrowserWindow();
        }, 40);
      }
    };
    window.setTimeout(() => {
      sendControllerMessage({ type: "presenter-ready", clientId: outputClientId });
      postHeartbeat();
    }, 50);
    heartbeatTimer = window.setInterval(postHeartbeat, PRESENTER_OUTPUT_HEARTBEAT_INTERVAL_MS);
  } else {
    renderStoredState();
    window.setTimeout(() => {
      sendControllerMessage({ type: "presenter-ready", clientId: outputClientId });
      postHeartbeat();
    }, 50);
    heartbeatTimer = window.setInterval(postHeartbeat, PRESENTER_OUTPUT_HEARTBEAT_INTERVAL_MS);
  }
  window.addEventListener("pagehide", () => {
    postDisconnect();
    closeOutputChannel();
  });

  window.addEventListener("storage", (event) => {
    if (event.key === PRESENTER_STORAGE_KEY || event.key === PRESENTER_NAVIGATION_STORAGE_KEY) {
      renderStoredState();
      return;
    }
    if (event.key !== PRESENTER_SIGNAL_KEY || !event.newValue) return;
    try {
      const message = JSON.parse(event.newValue);
      handleOutputSignalMessage(message);
    } catch {
      // Ignore malformed cross-window presenter signals.
    }
  });
  let videoRecoverySpaceHeld = false;
  window.addEventListener("keydown", (event) => {
    if (presenterChildrenPlayKey(event, "r")) {
      const slide = currentPayload?.slides?.[currentPayload.index];
      if (!event.repeat && slide?.songTimingEligible && slide.syncTimeline?.localTiming) {
        event.preventDefault();
        sendControllerMessage({ type: "presenter-control", action: "children-resume", serviceId: currentPayload.serviceId,
          index: currentPayload.index, groupId: slide.syncTimeline.groupId, clientId: outputClientId });
      }
      return;
    }
    if (presenterChildrenPlayKey(event)) {
      const slide = currentPayload?.slides?.[currentPayload.index];
      if (!event.repeat && slide?.type === "song-title" && slide.songTimingEligible && slide.syncTimeline?.intro) {
        event.preventDefault();
        sendControllerMessage({ type: "presenter-control", action: "children-play", serviceId: currentPayload.serviceId,
          index: currentPayload.index, groupId: slide.syncTimeline.groupId, clientId: outputClientId });
      }
      return;
    }
    if (event.key === " ") {
      if (!event.repeat) videoRecoverySpaceHeld = false;
      if (videoRecoverySpaceHeld || handlePresenterVideoRecoveryKey(event)) {
        event.preventDefault();
        videoRecoverySpaceHeld = true;
        return;
      }
    }
    if (!event.metaKey && !event.ctrlKey && !event.altKey && event.key.toLowerCase() === "f") {
      event.preventDefault();
      return;
    }
    if (!event.metaKey && !event.ctrlKey && !event.altKey && /^\d$/.test(event.key)) {
      event.preventDefault();
      jumpDraft = `${jumpDraft}${event.key}`.slice(0, PRESENTER_JUMP_MAX_DIGITS);
      sendControllerMessage({ type: "presenter-jump-draft", value: jumpDraft });
      postHeartbeat();
      return;
    }
    if (!event.metaKey && !event.ctrlKey && !event.altKey && event.key === "Enter" && jumpDraft) {
      event.preventDefault();
      const index = Number(jumpDraft) - 1;
      jumpDraft = "";
      sendControllerMessage({ type: "presenter-jump-draft", value: "" });
      postHeartbeat();
      sendControllerMessage({ type: "presenter-control", action: "jump", index, clientId: outputClientId });
      applyPresenterOutputActionLocally("jump", { index });
      return;
    }
    if (!event.metaKey && !event.ctrlKey && !event.altKey && event.key === "Escape" && jumpDraft) {
      event.preventDefault();
      jumpDraft = "";
      sendControllerMessage({ type: "presenter-jump-draft", value: "" });
      postHeartbeat();
      return;
    }
    if (!event.metaKey && !event.ctrlKey && !event.altKey && event.key === "Escape") {
      event.preventDefault();
      const now = Date.now();
      if (now - exitArmedAt <= PRESENTER_OUTPUT_ESCAPE_EXIT_MS) {
        requestPresenterOutputStop();
        return;
      }
      exitArmedAt = now;
      postHeartbeat();
      return;
    }
    const action = presenterOutputKeyAction(event);
    if (action) {
      event.preventDefault();
      jumpDraft = "";
      sendControllerMessage({ type: "presenter-jump-draft", value: "" });
      postHeartbeat();
      sendControllerMessage({ type: "presenter-control", action, clientId: outputClientId });
      applyPresenterOutputActionLocally(action);
    }
  });
}

function presenterOutputKeyAction(event) {
  if (event.metaKey || event.ctrlKey || event.altKey) return "";
  if (event.key === "Enter" || event.key === "ArrowRight" || event.key === "ArrowDown" || event.key === "PageDown" || event.key === " ") return "next";
  if (event.key === "ArrowLeft" || event.key === "ArrowUp" || event.key === "PageUp") return "prev";
  if (event.key === "Home") return "first";
  if (event.key === "End") return "last";
  return "";
}

function normalizePresenterPayload(payload) {
  const slides = Array.isArray(payload?.slides) ? payload.slides : [];
  return {
    outputSessionId: payload?.outputSessionId || "",
    snapshotId: payload?.snapshotId || "",
    messageId: payload?.messageId || "",
    serviceId: payload?.serviceId || null,
    serviceType: payload?.serviceType || "",
    serviceTitle: payload?.serviceTitle || "",
    serviceDate: payload?.serviceDate || payload?.service_date || "",
    chromakey: Boolean(payload?.chromakey),
    transitionLogo: normalizePresenterTransitionLogo(payload?.transitionLogo),
    presentationDesign: normalizePresenterServiceDesign(payload?.presentationDesign),
    outputTheme: payload?.outputTheme || presenterOutputTheme(payload?.serviceType),
    backgroundImage: payload?.backgroundImage || "",
    backgroundImages: Array.isArray(payload?.backgroundImages)
      ? payload.backgroundImages.filter(Boolean)
      : [payload?.backgroundImage].filter(Boolean),
    slides,
    index: clampPresenterIndex(payload?.index, slides.length),
    slideAnchor: payload?.slideAnchor || presenterSlideAnchor(slides[clampPresenterIndex(payload?.index, slides.length)]),
    pptxProgress: payload?.pptxProgress || null,
    safetyBlank: Boolean(payload?.safetyBlank),
    liveScripture: normalizeLiveScripturePayload(payload?.liveScripture),
    livePraise: null,
    updatedAt: Number(payload?.updatedAt) || Date.now(),
  };
}

function normalizeLiveScripturePayload(value) {
  if (!value?.active || !value?.slide) return null;
  return {
    reference: value.reference || value.slide.title || "",
    active: true,
    slide: value.slide,
  };
}

function applyPresenterActionToPayload(payload, action, options = {}) {
  const next = normalizePresenterPayload(payload);
  const requestedIndex = Number(options.index);
  const appliesJump = action !== "jump"
    || requestedIndex === -1
    || isValidPresenterIndex(requestedIndex, next.slides.length);
  if (["next", "prev", "first", "last", "jump"].includes(action) && appliesJump) {
    next.liveScripture = null;
  }
  if (action === "next" && next.slides.length) {
    next.safetyBlank = false;
    if (!advancePresenterPptx(next, 1)) next.index = presenterNextNavigableIndex(next.slides, next.index, 1);
  } else if (action === "prev" && next.slides.length) {
    next.safetyBlank = false;
    if (!advancePresenterPptx(next, -1)) next.index = presenterNextNavigableIndex(next.slides, next.index, -1);
  } else if (action === "first" && next.slides.length) {
    next.safetyBlank = false;
    next.index = presenterFirstNavigableIndex(next.slides);
  } else if (action === "last" && next.slides.length) {
    next.safetyBlank = false;
    next.index = presenterLastNavigableIndex(next.slides);
  } else if (action === "jump" && next.slides.length) {
    if (requestedIndex === -1) {
      next.safetyBlank = true;
    } else if (isValidPresenterIndex(requestedIndex, next.slides.length)) {
      next.index = requestedIndex;
      next.safetyBlank = false;
    }
  }
  if (["first", "last", "jump"].includes(action) && appliesJump) next.pptxProgress = null;
  next.slideAnchor = presenterSlideAnchor(next.slides[clampPresenterIndex(next.index, next.slides.length)]);
  next.updatedAt = Date.now();
  return next;
}

function presenterNextNavigableIndex(slides = [], currentIndex = 0, direction = 1) {
  const step = direction < 0 ? -1 : 1;
  let index = Number(currentIndex) + step;
  while (index >= 0 && index < slides.length && presenterSlideIsHidden(slides[index])) index += step;
  return index >= 0 && index < slides.length ? index : Number(currentIndex);
}

function presenterFirstNavigableIndex(slides = []) {
  const index = slides.findIndex((slide) => !presenterSlideIsHidden(slide));
  return index >= 0 ? index : 0;
}

function presenterLastNavigableIndex(slides = []) {
  for (let index = slides.length - 1; index >= 0; index -= 1) {
    if (!presenterSlideIsHidden(slides[index])) return index;
  }
  return Math.max(slides.length - 1, 0);
}

function renderPresenterOutput(payload, options = {}) {
  const root = document.getElementById("presenterOutputRoot");
  if (!root) return;
  applyPresenterOutputViewportScale(root);
  clearPresenterOutputAutoAdvanceTimer();
  const slides = Array.isArray(payload?.slides) ? payload.slides : [];
  const liveSlide = payload?.liveScripture?.active ? payload.liveScripture.slide : null;
  const slide = payload?.safetyBlank
    ? presenterSafetyBlankSlide()
    : liveSlide || slides[clampPresenterIndex(payload?.index, slides.length)];
  const frameState = presenterOutputFrameStateForSlide(slide, payload);
  if (slide?.pptx?.url) {
    void renderPresenterPptxOutput(root, payload, slide, frameState);
    return;
  }
  releasePresenterPptxOutput(root);
  warmPresenterPptx(payload);
  const activeImageSource = presenterSlideImageSource(slide)
    || (frameState.blankOutput ? normalizePresenterTransitionLogo(payload.transitionLogo)?.url : "");
  preloadPresenterOutputImages(payload, slide);
  warmPresenterOutputNextVideo(payload);
  const backgroundSources = frameState.showBackground
    ? frameState.backgroundImages.map(normalizePresenterMediaSource).filter(presenterMediaSourceIsImage)
    : [];
  const imagesReady = () => (!activeImageSource || presenterOutputImageIsReady(activeImageSource))
    && (!backgroundSources.length || backgroundSources.some(presenterOutputImageIsReady));
  if (!imagesReady()) {
    const token = ++presenterOutputRenderState.token;
    const pendingSource = activeImageSource || backgroundSources[0];
    presenterOutputRenderState.pendingImageSource = pendingSource;
    root.dataset.presenterPendingImageSource = pendingSource;
    root.setAttribute("aria-busy", "true");
    presenterOutputLayers(root);
    const rerenderIfReady = () => {
      if (
        token === presenterOutputRenderState.token
        && root.dataset.presenterPendingImageSource === pendingSource
        && imagesReady()
      ) {
        renderPresenterOutput(payload, options);
      }
    };
    // CSS backgrounds need the same decode gate as slide images. Keep the old
    // frame (including its keying mode) until at least one background is ready.
    [activeImageSource, ...backgroundSources].filter(Boolean).forEach((source) => {
      preloadPresenterOutputImage(source, { retry: true })?.finally(rerenderIfReady);
    });
    nextAnimationFrame().then(rerenderIfReady);
    window.setTimeout(rerenderIfReady, 40);
    window.setTimeout(rerenderIfReady, 160);
    return;
  }

  const token = ++presenterOutputRenderState.token;
  presenterOutputRenderState.pendingImageSource = "";
  delete root.dataset.presenterPendingImageSource;
  root.removeAttribute("aria-busy");
  commitPresenterOutputFrame(root, payload, slide, frameState, token, options);
}

function presenterSlideUsesServiceBackground(slide) {
  if (!slide || slide.suppressBackgroundImage || slide.noBackgroundImage || presenterSlideIsScoreLike(slide)) return false;
  if (slide.scriptureContext === "reading") return false;
  // Clean ready screens render built-in text, not their chromakey video source.
  if (slide.type === "ready") return true;
  const layout = presenterSlideLayout(slide);
  const type = presenterSlideElementType(slide);
  // Sermon reference images preserve the service background around letterboxed edges.
  // Announcement media remains black so supplied announcement artwork stays neutral.
  if (layout === PRESENTER_SLIDE_LAYOUTS.MEDIA) {
    return Boolean(slide.referenceMedia
      && slide.sectionKey === "sermon"
      && type === PRESENTER_ELEMENT_TYPES.IMAGE);
  }
  if (layout === PRESENTER_SLIDE_LAYOUTS.BLANK) return type === PRESENTER_ELEMENT_TYPES.BLANK;
  if (![PRESENTER_SLIDE_LAYOUTS.CENTER_TEXT, PRESENTER_SLIDE_LAYOUTS.LOWER_BAR_TEXT].includes(layout)) return false;
  return [
    PRESENTER_ELEMENT_TYPES.TITLE, PRESENTER_ELEMENT_TYPES.PLAIN_TEXT,
    PRESENTER_ELEMENT_TYPES.TITLE_CONTENT, PRESENTER_ELEMENT_TYPES.TITLE_ASSIGNEE,
    PRESENTER_ELEMENT_TYPES.BODY_TEXT, PRESENTER_ELEMENT_TYPES.PRAISE,
    PRESENTER_ELEMENT_TYPES.SCRIPTURE_READING, PRESENTER_ELEMENT_TYPES.SCRIPTURE_TEXT,
    PRESENTER_ELEMENT_TYPES.FREEFORM,
  ].includes(type) && Boolean(slide.elementType || ["title", "title-content", "title-assignee", "lyrics", "song-title", "scripture", "liturgical-body", "component"].includes(slide.type));
}

function presenterOutputFrameStateForSlide(slide, payload = {}) {
  const backgroundImages = slide?.formBackgroundImage
    ? [slide.formBackgroundImage] : presenterPayloadBackgroundImages(payload);
  const fallbackChromakey = Boolean(payload?.chromakey);
  const blackoutOutput = slide?.id === "presenter:safety-blank";
  const slideChromakey = !blackoutOutput && presenterFrameSlideOutputContext(slide, fallbackChromakey) === "chromakey";
  const cleanOutput = !slideChromakey;
  const blankSlide = presenterSlideLayout(slide) === PRESENTER_SLIDE_LAYOUTS.BLANK;
  const scoreOutput = presenterSlideIsScoreLike(slide);
  const videoOutput = presenterSlideElementType(slide) === PRESENTER_ELEMENT_TYPES.VIDEO || Boolean(slide?.videoSrc);
  const scriptureReadingOutput = slide?.scriptureContext === "reading";
  // A fullscreen blank stays inside the service visual system: retain the same
  // background while the cross draws over it. Chromakey remains background-free.
  const showBackground = Boolean(!blackoutOutput && backgroundImages.length && cleanOutput && presenterSlideUsesServiceBackground(slide));
  return {
    cleanOutput,
    formBackground: Boolean(slide?.formBackgroundImage),
    showBackground,
    blankOutput: Boolean(blankSlide && cleanOutput && !blackoutOutput && !slide?.formBackgroundImage),
    blackoutOutput,
    scoreOutput,
    videoOutput,
    scriptureReadingOutput,
    backgroundVideo: blackoutOutput ? "" : presenterSlideBackgroundVideoSource(slide, cleanOutput),
    backgroundImage: backgroundImages[0] || "",
    backgroundImages,
    serviceType: payload?.serviceType || "",
    outputTheme: payload?.outputTheme || presenterOutputTheme(payload?.serviceType),
    noChromakey: !slideChromakey,
  };
}

function presenterFrameSlideOutputContext(slide, fallbackChromakey = true) {
  const explicit = presenterFrameNormalizeOutputContext(
    slide?.outputContext
    || slide?.output_context
    || slide?.presenterOutputContext
    || slide?.presenter_output_context
    || "",
  );
  if (explicit) return explicit;
  const layout = presenterSlideLayout(slide);
  const elementType = presenterSlideElementType(slide);
  if (slide?.live && elementType === PRESENTER_ELEMENT_TYPES.SCRIPTURE_TEXT) return "chromakey";
  if (layout === PRESENTER_SLIDE_LAYOUTS.BLANK) return fallbackChromakey ? "chromakey" : "clean";
  const scoreLike = slide?.sourceType === "score" || slide?.componentType === "score" || slide?.scoreBackground;
  if (scoreLike) return "clean";
  if (
    layout === PRESENTER_SLIDE_LAYOUTS.MEDIA
    || layout === PRESENTER_SLIDE_LAYOUTS.FILE
    || elementType === PRESENTER_ELEMENT_TYPES.IMAGE
    || elementType === PRESENTER_ELEMENT_TYPES.VIDEO
    || elementType === PRESENTER_ELEMENT_TYPES.FILE
    || elementType === PRESENTER_ELEMENT_TYPES.AUDIO
  ) {
    return "clean";
  }
  return fallbackChromakey ? "chromakey" : "clean";
}

function presenterFrameNormalizeOutputContext(value = "") {
  const key = compactSearchValue(value);
  if (!key) return "";
  if (["chromakey", "chroma", "key", "green", "greenkey", "크로마키"].includes(key)) return "chromakey";
  if (["clean", "fullscreen", "full", "media", "image", "video", "score", "nochromakey", "no-chromakey", "풀스크린", "전체화면"].includes(key)) return "clean";
  return "";
}

function presenterOutputFrameClassNames(frameState = {}) {
  return [
    frameState.noChromakey ? "no-chromakey" : "",
    frameState.showBackground ? "has-background" : "",
    frameState.formBackground ? "has-form-background" : "",
    frameState.blankOutput ? "is-blank" : "",
    frameState.blackoutOutput ? "is-blackout" : "",
  ].filter(Boolean).join(" ");
}

function presenterOutputFrameBackgroundStyle(frameState = {}) {
  if (!frameState.showBackground) return "";
  const sources = frameState.backgroundImages?.length
    ? frameState.backgroundImages
    : [frameState.backgroundImage].filter(Boolean);
  if (!sources.length) return "";
  return ` style="--presenter-bg-image: ${escapeAttr(presenterBackgroundCssValue(sources))}"`;
}

function commitPresenterOutputFrame(root, payload, slide, frameState, token, options = {}) {
  const html = slide ? renderPresenterSlideFrame(slide, { noChromakey: frameState.noChromakey, transitionLogo: payload.transitionLogo, presentationDesign: payload.presentationDesign }) : "";
  const activeImageSource = presenterSlideImageSource(slide);
  const frameKey = presenterOutputFrameKey(payload, slide, frameState);
  const commit = () => {
    if (token !== presenterOutputRenderState.token) return;
    const layers = presenterOutputLayers(root);
    if (!layers) return;
    if (layers.active?.dataset?.presenterFrameKey === frameKey) {
      applyPresenterOutputFrameState(root, frameState);
      bindPresenterOutputAutoAdvance(root, payload, slide, options, token);
      warmPresenterOutputImages(payload, slide || null);
      return;
    }
    const nextLayer = layers.next;
    if (nextLayer.dataset.presenterFrameToken !== String(token)) {
      populatePresenterOutputLayer(nextLayer, html);
      nextLayer.dataset.presenterFrameToken = String(token);
    }
    nextLayer.dataset.presenterFrameKey = frameKey;
    nextLayer.classList.add("is-next");
    activatePresenterOutputLayer(root, layers.active, nextLayer, frameState, token, () => {
      fitPresenterChromakeyScriptureText(nextLayer, frameState);
      fitPresenterSongTitleText(nextLayer);
      fitPresenterSermonTitleText(nextLayer);
      bindPresenterOutputAutoAdvance(root, payload, slide, options, token);
      const video = nextLayer.querySelector("video.presenter-video");
      if (video?.autoplay && video.paused) void requestPresenterVideoPlayback(video);
    });
    warmPresenterOutputImages(payload, slide || null);
  };
  if (!activeImageSource) {
    commit();
    return;
  }
  const commitToken = ++presenterOutputRenderState.commitToken;
  root.setAttribute("aria-busy", "true");
  const layers = presenterOutputLayers(root);
  if (!layers) {
    root.removeAttribute("aria-busy");
    return;
  }
  populatePresenterOutputLayer(layers.next, html);
  layers.next.dataset.presenterFrameToken = String(token);
  layers.next.dataset.presenterFrameKey = frameKey;
  layers.next.classList.add("is-next");
  preparePresenterOutputFrameForPaint(layers.next)
    .finally(() => {
      if (token !== presenterOutputRenderState.token || commitToken !== presenterOutputRenderState.commitToken) return;
      root.removeAttribute("aria-busy");
      commit();
    });
}

function populatePresenterOutputLayer(layer, html) {
  const template = document.createElement("template");
  template.innerHTML = html;
  layer._pptxSession?.destroy();
  layer._pptxSession = null;
  layer.replaceChildren(template.content);
  const placeholder = layer.querySelector("video.presenter-video");
  const source = normalizePresenterMediaSource(placeholder?.getAttribute("src") || "");
  const warmed = presenterOutputVideoWarmupCache.get(source)?.video;
  if (warmed && !warmed.error && warmed.paused && warmed.currentTime === 0
    && warmed.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) {
    presenterOutputVideoWarmupCache.delete(source);
    // Keep the decoded first frame and network buffer; never reset src or load().
    for (const attribute of [...warmed.attributes]) {
      if (attribute.name !== "src") warmed.removeAttribute(attribute.name);
    }
    for (const attribute of placeholder.attributes) {
      if (attribute.name !== "src") warmed.setAttribute(attribute.name, attribute.value);
    }
    warmed.muted = placeholder.muted;
    warmed.defaultMuted = placeholder.defaultMuted;
    placeholder.replaceWith(warmed);
  }
}

function activatePresenterOutputLayer(root, activeLayer, nextLayer, frameState = {}, token = presenterOutputRenderState.token, onActivated = null) {
  if (!activeLayer || !nextLayer) return;
  const animated = presenterOutputShouldAnimateFrameTransition(root, frameState);
  const transitionClearDelay = 260;
  const transitionEntryDelay = 220;
  const swap = () => {
    if (token !== presenterOutputRenderState.token) return;
    if (animated) {
      root.classList.add("is-transitioning");
      root.dataset.presenterTransitionToken = String(token);
    } else {
      root.classList.remove("is-transitioning");
      delete root.dataset.presenterTransitionToken;
    }
    activeLayer.classList.remove("is-entering");
    activeLayer.removeAttribute("data-presenter-entering-token");
    nextLayer.classList.remove("is-entering");
    nextLayer.classList.remove("is-exiting");
    nextLayer.removeAttribute("data-presenter-entering-token");
    if (animated) activeLayer.classList.add("is-exiting");
    activeLayer.classList.remove("is-active");
    activeLayer.classList.remove("is-next");
    nextLayer.classList.add("is-active");
    if (animated) nextLayer.classList.add("is-entering");
    nextLayer.classList.remove("is-next");
    // Keep composited media layers attached while swapping their visibility.
    applyPresenterOutputFrameState(root, frameState);
    if (animated) {
      nextLayer.dataset.presenterEnteringToken = String(token);
      window.setTimeout(() => {
        if (nextLayer.dataset.presenterEnteringToken !== String(token)) return;
        nextLayer.classList.remove("is-entering");
        nextLayer.removeAttribute("data-presenter-entering-token");
      }, transitionEntryDelay);
    }
    activeLayer._pptxSession?.pause();
    onActivated?.();
    const clearPreviousLayer = () => {
      if (token !== presenterOutputRenderState.token) return;
      if (activeLayer.classList.contains("is-active")) return;
      activeLayer._pptxSession?.destroy();
      activeLayer._pptxSession = null;
      activeLayer.innerHTML = "";
      activeLayer.removeAttribute("data-presenter-frame-token");
      activeLayer.removeAttribute("data-presenter-frame-key");
      activeLayer.removeAttribute("data-presenter-entering-token");
      activeLayer.classList.remove("is-exiting");
      activeLayer.classList.remove("is-entering");
    };
    if (animated) window.setTimeout(clearPreviousLayer, transitionClearDelay);
    else clearPreviousLayer();
    if (animated) {
      window.setTimeout(() => {
        if (root.dataset.presenterTransitionToken !== String(token)) return;
        root.classList.remove("is-transitioning");
        delete root.dataset.presenterTransitionToken;
      }, transitionClearDelay);
    }
  };
  if (!animated) {
    swap();
    return;
  }
  nextLayer.getBoundingClientRect();
  swap();
}

function presenterOutputFrameKey(payload = {}, slide = null, frameState = {}) {
  if (!slide) return "empty";
  return [
    payload?.serviceId || "",
    payload?.index ?? "",
    slide.id || "",
    slide.type || "",
    slide.layout || "",
    slide.elementType || "",
    slide.outputContext || slide.output_context || "",
    frameState.noChromakey ? "clean" : "chromakey",
    frameState.blankOutput ? "blank" : "",
    frameState.backgroundImage || "",
    frameState.backgroundVideo || "",
    frameState.blankOutput ? JSON.stringify(normalizePresenterTransitionLogo(payload.transitionLogo)) : "",
    JSON.stringify(normalizePresenterServiceDesign(payload.presentationDesign)),
    slide.title || "",
    slide.text || "",
  ].map((value) => String(value ?? "")).join("|");
}

function presenterOutputShouldAnimateFrameTransition(root, frameState = {}) {
  if (!frameState.cleanOutput || frameState.formBackground) return false;
  if (frameState.videoOutput) return false;
  // Self-contained media must not blend with the previous slide's visual theme.
  if (root?.querySelector?.(":scope > .presenter-output-layer :is([data-slide-layout='media'], [data-slide-layout='file'])")) return false;
  if (frameState.scoreOutput) return false;
  if (frameState.blankOutput || frameState.blackoutOutput) return false;
  if (frameState.scriptureReadingOutput) return false;
  if (root?.classList?.contains("svc-slide-mini-canvas")) return false;
  if (root?.querySelector?.(":scope > .presenter-output-layer.is-active .presenter-slide--score")) return false;
  if (root?.querySelector?.(":scope > .presenter-output-layer.is-next .presenter-slide--score")) return false;
  return true;
}

// All fitting sizes are measured on the same 1920px design stage.
const PRESENTER_TEXT_FIT = Object.freeze({ step:5, body:40, title:70 });
function presenterTextFitScale(box) {
  return (box.closest?.(".presenter-output-root")?.clientWidth || 1920) / 1920;
}
function presenterTextFitStatus(box, overflow) {
  if (overflow) {
    box.dataset.presenterFitOverflow = "true";
    box.setAttribute("aria-description", "최소 글자 크기에서도 내용이 넘칩니다. 내용을 나누어 주세요.");
  } else {
    if (box.dataset.presenterFitOverflow) box.removeAttribute("aria-description");
    delete box.dataset.presenterFitOverflow;
  }
}
function presenterTextFits(box, role = "body") {
  const tolerance = presenterTextFitScale(box);
  if (box.scrollWidth > box.clientWidth + tolerance) return false;
  if (role !== "title") return box.scrollHeight <= box.clientHeight + tolerance;
  // Title line-height is intentionally tight; check its allocated frame instead
  // of mistaking font ink below the line box for a text overflow.
  const frame = box.closest(".presenter-slide");
  if (!frame) return true;
  const bounds = frame.getBoundingClientRect(), text = box.getBoundingClientRect();
  const root = box.closest(".presenter-output-root");
  const renderedTolerance = (root?.getBoundingClientRect().width || 1920) / 1920;
  return text.top >= bounds.top - renderedTolerance && text.bottom <= bounds.bottom + renderedTolerance;
}
function fitPresenterTextBox(box, { role="body", fits=()=>presenterTextFits(box, role), property="font-size" } = {}) {
  box.style.removeProperty(property);
  const scale = presenterTextFitScale(box);
  const base = Number.parseFloat(getComputedStyle(box).fontSize);
  if (!box.clientWidth || !box.clientHeight || !Number.isFinite(base) || base <= 0) return;
  presenterTextFitStatus(box, false);
  if (fits()) return;
  const normalizedBase = Math.round(base / scale * 1000) / 1000;
  const floor = Math.min(PRESENTER_TEXT_FIT[role], normalizedBase);
  let candidate = Math.floor(normalizedBase / PRESENTER_TEXT_FIT.step) * PRESENTER_TEXT_FIT.step;
  for (; candidate > floor; candidate -= PRESENTER_TEXT_FIT.step) {
    box.style.setProperty(property, `${candidate * scale}px`);
    if (fits()) return;
  }
  box.style.setProperty(property, `${floor * scale}px`);
  presenterTextFitStatus(box, !fits());
}

function fitPresenterChromakeyScriptureText(host, frameState = {}) {
  if (!host || frameState.noChromakey) return;
  const textBox = host.querySelector(
    ".presenter-slide--scripture:not(.presenter-slide--scripture-reading) > .presenter-slide-text",
  );
  if (!textBox) return;

  fitPresenterTextBox(textBox, { property:"--presenter-scripture-fitted-size" });
}

function presenterTextNaturalWidth(node) {
  if (!node) return 0;
  const previous = {
    display: node.style.display,
    maxWidth: node.style.maxWidth,
    position: node.style.position,
    visibility: node.style.visibility,
    whiteSpace: node.style.whiteSpace,
    width: node.style.width,
  };
  node.style.display = "inline-block";
  node.style.maxWidth = "none";
  node.style.position = "absolute";
  node.style.visibility = "hidden";
  node.style.whiteSpace = "nowrap";
  node.style.width = "max-content";
  const width = node.scrollWidth || node.getBoundingClientRect?.().width || 0;
  node.style.display = previous.display;
  node.style.maxWidth = previous.maxWidth;
  node.style.position = previous.position;
  node.style.visibility = previous.visibility;
  node.style.whiteSpace = previous.whiteSpace;
  node.style.width = previous.width;
  return width;
}

function fitPresenterChromakeyScripturePreviews(host) {
  if (!host) return;
  host
    .querySelectorAll(".svc-slide-mini-canvas.presenter-output-root:not(.no-chromakey)")
    .forEach((preview) => fitPresenterChromakeyScriptureText(preview));
}

function fitPresenterSongTitleText(host) {
  if (!host) return;
  fitPresenterLyricText(host);
  host.querySelectorAll(".presenter-slide--song-title > .presenter-slide-text, .presenter-slide--song-title .presenter-section-song-title-name")
    .forEach(box => fitPresenterTextBox(box, {role:"title"}));
}

const presenterLyricFitCache = new Map();
const PRESENTER_LYRIC_FIT_CACHE_LIMIT = 512;
const PRESENTER_LYRIC_FIT_STYLE_KEYS = [
  "fontFamily", "fontSize", "fontWeight", "fontStyle", "fontStretch", "fontVariant",
  "fontFeatureSettings", "fontVariationSettings", "fontKerning", "fontOpticalSizing",
  "letterSpacing", "wordSpacing", "lineHeight", "whiteSpace", "textTransform", "textIndent",
  "writingMode", "direction", "boxSizing", "paddingLeft", "paddingRight", "paddingTop", "paddingBottom",
  "marginLeft", "marginRight", "gap", "display", "content", "verticalAlign", "transform",
];

function presenterLyricFitKey(textBox) {
  const metrics = (node, pseudo) => {
    const style = getComputedStyle(node, pseudo);
    return PRESENTER_LYRIC_FIT_STYLE_KEYS.map((key) => style[key]);
  };
  return JSON.stringify([
    textBox.innerHTML, textBox.clientWidth, textBox.clientHeight, metrics(textBox),
    [...textBox.querySelectorAll("*")].map((node) => [metrics(node), metrics(node, "::before"), metrics(node, "::after")]),
  ]);
}

function rememberPresenterLyricFit(key, fontSize, overflow = false) {
  if (presenterLyricFitCache.size >= PRESENTER_LYRIC_FIT_CACHE_LIMIT) {
    presenterLyricFitCache.delete(presenterLyricFitCache.keys().next().value);
  }
  presenterLyricFitCache.set(key, {fontSize, overflow});
}

// Font changes invalidate every fit, but must not synchronously refit an
// entire worship board. Actual output still finishes fitting before paint.
let presenterFontRefitRaf = 0;
function invalidatePresenterFontFits() {
  presenterLyricFitCache.clear();
  if (presenterFontRefitRaf) return;
  presenterFontRefitRaf = requestAnimationFrame(() => {
    presenterFontRefitRaf = 0;
    document.querySelectorAll("#presenterOutputRoot").forEach(fitPresenterLyricText);
    if (typeof fitPresenterPreviewText === "function") fitPresenterPreviewText(document);
  });
}
document.fonts?.addEventListener("loadingdone", invalidatePresenterFontFits);
document.fonts?.addEventListener("loadingerror", invalidatePresenterFontFits);

function fitPresenterLyricText(host) {
  if (!host) return;
  fitPresenterAnnouncementRegions(host);
  host.querySelectorAll(".presenter-liturgical-body-lines, .presenter-slide--liturgical-body .presenter-title-content-body")
    .forEach(box => fitPresenterTextBox(box));
  host.querySelectorAll('.presenter-slide--lyrics:is([data-element-type="praise"], [data-section-key="announcements"]) > .presenter-slide-text').forEach((textBox) => {
    textBox.style.removeProperty("font-size");
    const baseSize = Number.parseFloat(getComputedStyle(textBox).fontSize);
    if (!Number.isFinite(baseSize) || baseSize <= 0 || !textBox.clientWidth) return;
    const key = document.fonts?.status === "loading" ? null : JSON.stringify([presenterTextFitScale(textBox),presenterLyricFitKey(textBox)]);
    if (key !== null && presenterLyricFitCache.has(key)) {
      const record = presenterLyricFitCache.get(key);
      if (record.fontSize) textBox.style.fontSize = record.fontSize;
      presenterTextFitStatus(textBox, record.overflow);
      return;
    }
    const fits = () => {
      const style = getComputedStyle(textBox);
      const width = textBox.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight);
      const tolerance = presenterTextFitScale(textBox);
      return [...textBox.children].every(line => presenterTextNaturalWidth(line) <= width - 2 * tolerance)
        && textBox.scrollHeight <= textBox.clientHeight + tolerance;
    };
    fitPresenterTextBox(textBox, {fits});
    if (key !== null) rememberPresenterLyricFit(key, textBox.style.fontSize, textBox.dataset.presenterFitOverflow === "true");
  });
}

function fitPresenterSongTitlePreviews(host) {
  if (!host) return;
  host
    .querySelectorAll(".svc-slide-mini-canvas.presenter-output-root")
    .forEach((preview) => fitPresenterSongTitleText(preview));
}

function fitPresenterSermonTitleText(host) {
  if (!host) return;
  host.querySelectorAll(".presenter-title-assignee--sermon .presenter-title-assignee-content, .presenter-title-content-title, .presenter-liturgical-body-heading > span")
    .forEach(box => fitPresenterTextBox(box, {role:"title"}));
}

function fitPresenterSermonTitlePreviews(host) {
  if (!host) return;
  host
    .querySelectorAll(".svc-slide-mini-canvas.presenter-output-root")
    .forEach((preview) => fitPresenterSermonTitleText(preview));
}

function bindPresenterOutputAutoAdvance(root, payload, slide, options = {}, token = presenterOutputRenderState.token) {
  clearPresenterOutputAutoAdvanceTimer();
  bindPresenterVideoTimelineCatchUp(root, payload, slide, options, token);
  bindPresenterOutputAutoAdvanceOnEnd(root, payload, slide, options);
  bindPresenterOutputAutoAdvanceAt(payload, slide, options, token);
}

function bindPresenterVideoTimelineCatchUp(root, payload, slide, options = {}, token = presenterOutputRenderState.token) {
  if (!slide || presenterSlideElementType(slide) !== PRESENTER_ELEMENT_TYPES.VIDEO) return;
  if (presenterSlideLayout(slide) !== PRESENTER_SLIDE_LAYOUTS.MEDIA) return;
  const video = root?.querySelector(".presenter-output-layer.is-active video.presenter-video");
  if (!video) return;
  const onAutoAdvance = typeof options.onAutoAdvance === "function" ? options.onAutoAdvance : null;
  const applyCatchUp = () => {
    if (token !== presenterOutputRenderState.token) return;
    const duration = Number.isFinite(video.duration) && video.duration > 0
      ? video.duration
      : Number(slide.playback?.durationSeconds || 0);
    const catchUp = presenterVideoTimelineCatchUp(slide, payload, {
      now: Date.now(),
      durationSeconds: duration,
    });
    if (!catchUp) return;
    if (catchUp.shouldAdvance) {
      if (!onAutoAdvance) return;
      onAutoAdvance({
        serviceId: payload?.serviceId || "",
        slideId: slide?.id || "",
        slideIndex: clampPresenterIndex(payload?.index, Array.isArray(payload?.slides) ? payload.slides.length : 0),
        scheduledAt: catchUp.endAt?.toISOString?.() || "",
        catchUp: true,
      });
      return;
    }
    if (Number.isFinite(catchUp.offsetSeconds) && catchUp.offsetSeconds > 0) {
      try {
        video.currentTime = catchUp.offsetSeconds;
      } catch {
        // Some browsers reject seeking until more metadata is available.
      }
    }
  };
  if (Number.isFinite(video.duration) && video.duration > 0) {
    applyCatchUp();
    return;
  }
  video.addEventListener("loadedmetadata", applyCatchUp, { once: true });
}

function bindPresenterOutputAutoAdvanceOnEnd(root, payload, slide, options = {}) {
  if (!presenterSlideShouldAutoAdvanceOnEnd(slide)) return;
  const video = root?.querySelector(".presenter-output-layer.is-active video.presenter-video");
  const onAutoAdvance = typeof options.onAutoAdvance === "function" ? options.onAutoAdvance : null;
  if (!video || !onAutoAdvance) return;
  const serviceId = payload?.serviceId || "";
  const slideId = slide?.id || "";
  const slideIndex = clampPresenterIndex(payload?.index, Array.isArray(payload?.slides) ? payload.slides.length : 0);
  video.onended = () => onAutoAdvance({ serviceId, slideId, slideIndex });
}

function bindPresenterOutputAutoAdvanceAt(payload, slide, options = {}, token = presenterOutputRenderState.token) {
  const onAutoAdvance = typeof options.onAutoAdvance === "function" ? options.onAutoAdvance : null;
  if (!onAutoAdvance) return;
  const target = presenterSlideAutoAdvanceAt(slide, payload);
  if (!target) return;
  const delay = Math.max(0, target.getTime() - Date.now());
  const serviceId = payload?.serviceId || "";
  const slideId = slide?.id || "";
  const slideIndex = clampPresenterIndex(payload?.index, Array.isArray(payload?.slides) ? payload.slides.length : 0);
  presenterOutputRenderState.autoAdvanceTimer = window.setTimeout(() => {
    if (token !== presenterOutputRenderState.token) return;
    onAutoAdvance({ serviceId, slideId, slideIndex, scheduledAt: target.toISOString() });
  }, delay);
}

function clearPresenterOutputAutoAdvanceTimer() {
  if (!presenterOutputRenderState.autoAdvanceTimer) return;
  window.clearTimeout(presenterOutputRenderState.autoAdvanceTimer);
  presenterOutputRenderState.autoAdvanceTimer = null;
}

function presenterSlideShouldAutoAdvanceOnEnd(slide) {
  if (!slide || presenterSlideElementType(slide) !== PRESENTER_ELEMENT_TYPES.VIDEO) return false;
  if (presenterSlideLayout(slide) !== PRESENTER_SLIDE_LAYOUTS.MEDIA) return false;
  if (slide.live) return false;
  const presenterRole = normalizeServicePresenterRole(slide.presenterRole);
  if (presenterRole !== "intro") return false;
  const playback = presenterPlaybackConfig(slide.playback, "intro-video");
  return playback.autoAdvanceOnEnd !== false && playback.loop !== true;
}

function presenterSlideAutoAdvanceAt(slide, payload = {}) {
  if (!slide || slide.live) return null;
  const raw = String(slide.playback?.autoAdvanceAt || "").trim();
  if (!raw) return null;
  const target = parsePresenterAutoAdvanceAt(raw, payload?.serviceDate);
  if (!target || Number.isNaN(target.getTime())) return null;
  return target;
}

function presenterVideoTimelineCatchUp(slide, payload = {}, options = {}) {
  if (!slide || slide.live) return null;
  const startAt = presenterSlideTimelineStartAt(slide, payload);
  if (!startAt) return null;
  const now = Number(options.now) || Date.now();
  const elapsedSeconds = (now - startAt.getTime()) / 1000;
  if (!Number.isFinite(elapsedSeconds) || elapsedSeconds <= 0) return null;
  const durationSeconds = Number(options.durationSeconds) || Number(slide.playback?.durationSeconds || 0);
  const endAt = durationSeconds > 0 ? new Date(startAt.getTime() + (durationSeconds * 1000)) : presenterSlideAutoAdvanceAt(slide, payload);
  const shouldAdvance = Boolean(durationSeconds > 0 && elapsedSeconds >= durationSeconds && presenterSlideShouldAutoAdvanceOnEnd(slide));
  return {
    startAt,
    endAt,
    elapsedSeconds,
    offsetSeconds: durationSeconds > 0 ? Math.min(elapsedSeconds, Math.max(durationSeconds - 0.25, 0)) : elapsedSeconds,
    shouldAdvance,
  };
}

function presenterSlideTimelineStartAt(slide, payload = {}) {
  if (!slide) return null;
  const explicitStart = parsePresenterAutoAdvanceAt(slide.playback?.startAt, payload?.serviceDate);
  if (explicitStart) return explicitStart;
  const slides = Array.isArray(payload?.slides) ? payload.slides : [];
  const index = clampPresenterIndex(payload?.index, slides.length);
  const previous = slides[index - 1];
  const previousAdvanceAt = presenterSlideAutoAdvanceAt(previous, payload);
  if (previousAdvanceAt) return previousAdvanceAt;
  const ownAdvanceAt = presenterSlideAutoAdvanceAt(slide, payload);
  const durationSeconds = Number(slide.playback?.durationSeconds || 0);
  if (ownAdvanceAt && durationSeconds > 0) {
    return new Date(ownAdvanceAt.getTime() - (durationSeconds * 1000));
  }
  return null;
}

function parsePresenterAutoAdvanceAt(value, serviceDate = "") {
  const raw = String(value || "").trim();
  if (!raw) return null;
  if (/^\d{1,2}:\d{2}(?::\d{2})?$/.test(raw)) {
    const date = String(serviceDate || toLocalDateStr(new Date())).trim() || toLocalDateStr(new Date());
    return new Date(`${date}T${raw.length === 5 ? `${raw}:00` : raw}`);
  }
  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function presenterOutputLayers(root) {
  if (!root) return null;
  let layers = [...root.querySelectorAll(":scope > .presenter-output-layer")];
  if (layers.length < 2) {
    const existing = [...root.childNodes];
    root.textContent = "";
    const first = document.createElement("div");
    const second = document.createElement("div");
    first.className = "presenter-output-layer is-active";
    second.className = "presenter-output-layer";
    existing.forEach((node) => first.appendChild(node));
    root.append(first, second);
    layers = [first, second];
  }
  const active = layers.find((layer) => layer.classList.contains("is-active")) || layers[0];
  const next = layers.find((layer) => layer !== active) || layers[1];
  return { active, next };
}

function presenterEmphasisPalette(frameState = {}) {
  if (!frameState.showBackground || !frameState.noChromakey
      || (frameState.outputTheme || presenterOutputTheme(frameState.serviceType)) !== "children") return "";
  const sources = frameState.backgroundImages?.length ? frameState.backgroundImages : [frameState.backgroundImage];
  // Retain artwork identity when a decoded/data URL precedes its file fallback.
  const code = sources.map(source => String(source || "").split(/[?#]/)[0]
    .match(/(?:^|\/)26-(C[1235]|S[456])\.(?:png|jpe?g|webp)$/i)?.[1]?.toUpperCase()).find(Boolean);
  if (code === "C1" || code === "C2") return "textured";
  if (code === "C3") return "sky";
  return "light";
}

function applyPresenterOutputFrameState(root, frameState = {}) {
  document.body.classList.toggle("presenter-output-body--clean", Boolean(frameState.cleanOutput));
  document.body.classList.toggle("has-background", Boolean(frameState.showBackground));
  document.body.classList.toggle("is-blank", Boolean(frameState.blankOutput));
  root.classList.toggle("no-chromakey", Boolean(frameState.noChromakey));
  root.classList.toggle("has-background", Boolean(frameState.showBackground));
  root.classList.toggle("has-form-background", Boolean(frameState.formBackground));
  root.classList.toggle("is-blank", Boolean(frameState.blankOutput));
  document.body.classList.toggle("is-blackout", Boolean(frameState.blackoutOutput));
  root.classList.toggle("is-blackout", Boolean(frameState.blackoutOutput));
  applyPresenterBackgroundVideo(root, frameState.backgroundVideo);
  root.dataset.serviceType = frameState.serviceType || "";
  root.dataset.outputTheme = frameState.outputTheme || presenterOutputTheme(frameState.serviceType);
  root.dataset.emphasisPalette = presenterEmphasisPalette(frameState);
  // Reuse decoded image nodes for output backgrounds. Assigning the URL to CSS
  // can start another fetch/decode after the readiness gate (notably cold caches).
  const sources = frameState.showBackground ? (frameState.backgroundImages?.length
    ? frameState.backgroundImages : [frameState.backgroundImage].filter(Boolean)) : [];
  const images = sources.map((source) => presenterOutputImagePreloadCache.get(normalizePresenterMediaSource(source)))
    .filter((record) => record?.ready && record.image?.naturalWidth > 0)
    .map((record) => record.image);
  let background = root.querySelector(":scope > .presenter-output-background");
  if (images.length) {
    if (!background) {
      background = document.createElement("div");
      background.className = "presenter-output-background";
      background.setAttribute("aria-hidden", "true");
      root.prepend(background);
    }
    // CSS background sources are ordered front to back.
    background.replaceChildren(...images.reverse());
  } else {
    background?.remove();
  }
  root.classList.toggle("has-decoded-background", images.length > 0);
  if (frameState.showBackground) {
    const backgroundCssValue = presenterBackgroundCssValue(frameState.backgroundImages?.length ? frameState.backgroundImages : [frameState.backgroundImage]);
    document.body.style.setProperty("--presenter-bg-image", backgroundCssValue);
    root.style.setProperty("--presenter-bg-image", backgroundCssValue);
  } else {
    document.body.style.removeProperty("--presenter-bg-image");
    root.style.removeProperty("--presenter-bg-image");
  }
}

function presenterPayloadBackgroundImages(payload = {}) {
  if (Array.isArray(payload?.backgroundImages) && payload.backgroundImages.length) {
    return payload.backgroundImages.filter(Boolean);
  }
  return [payload?.backgroundImage].filter(Boolean);
}

function preparePresenterOutputFrameForPaint(host) {
  if (!host) return Promise.resolve();
  const images = [...host.querySelectorAll("img")];
  const imageReady = images.map((image) => {
    if (presenterOutputImageIsReady(image.currentSrc || image.src)) return Promise.resolve();
    if (image.complete && image.naturalWidth > 0) return Promise.resolve();
    if (typeof image.decode === "function") return image.decode().catch(() => {});
    return new Promise((resolve) => {
      image.onload = resolve;
      image.onerror = resolve;
    });
  });
  const videos = [...host.querySelectorAll("video.presenter-video")];
  const videoReady = videos.map(preparePresenterOutputVideoForPaint);
  return Promise.all([...imageReady, ...videoReady]);
}

function presenterOutputVideoHealth(payload) {
  const layer = document.querySelector("#presenterOutputRoot .presenter-output-layer.is-active");
  const video = layer?.querySelector("video.presenter-video");
  if (!video || !payload?.serviceId) return null;
  const status = video.error ? "error" : video.ended ? "ended"
    : video.paused && video.dataset.autoplayBlocked === "true" ? "blocked"
    : video.readyState < HTMLMediaElement.HAVE_FUTURE_DATA ? "loading"
      : video.paused ? "paused" : "playing";
  return { serviceId: payload.serviceId, index: payload.index,
    frameKey: layer.dataset.presenterFrameKey || "", status };
}

async function retryPresenterOutputVideo(request, payload) {
  const health = presenterOutputVideoHealth(payload);
  if (!health || health.serviceId !== request.serviceId || health.index !== request.index
    || health.frameKey !== request.frameKey || !["error", "paused", "blocked"].includes(health.status)) return;
  const video = document.querySelector("#presenterOutputRoot .presenter-output-layer.is-active video.presenter-video");
  // Reload only failed media. Resuming a paused video must preserve its position.
  if (health.status === "error") video.load();
  await requestPresenterVideoPlayback(video);
}

async function requestPresenterVideoPlayback(video) {
  try { await video.play(); } catch (error) {
    if (!video.isConnected || error?.name !== "NotAllowedError") return;
    if (video.dataset.autoplayBlocked === "true") return;
    video.dataset.autoplayBlocked = "true";
    video.addEventListener("playing", () => {
      delete video.dataset.autoplayBlocked;
    }, { once: true });
  }
}

function handlePresenterVideoRecoveryKey(event) {
  if (event.key !== " " || event.metaKey || event.ctrlKey || event.altKey || event.shiftKey
    || event.target?.closest?.("input, textarea, select, button, [contenteditable='true']")) return false;
  const layer = document.querySelector("#presenterOutputRoot .presenter-output-layer.is-active");
  if (layer?._pptxSession && document.querySelector('#presenterOutputRoot [data-autoplay-blocked="true"]')) {
    if (!event.repeat) layer._pptxSession.recover();
    return true;
  }
  const video = layer?.querySelector("video.presenter-video");
  if (!video || video.ended || (!video.error && !video.paused && video.readyState >= HTMLMediaElement.HAVE_FUTURE_DATA)) return false;
  // Call play in this key event, not through the controller's asynchronous channel.
  if (!event.repeat) {
    if (video.error) video.load();
    void requestPresenterVideoPlayback(video);
  }
  return true;
}

function requestPresenterVideoRetry(serviceId) {
  const health = state.presenter.videoHealth;
  if (!health || health.serviceId !== serviceId || serviceId !== state.presenter.serviceId
    || health.index !== state.presenter.index || state.presenter.safetyBlank || state.presenter.liveScripture?.active
    || Date.now() - health.receivedAt > 5000 || !["error", "paused", "blocked"].includes(health.status)) return;
  const message = { type: "presenter-video-retry", serviceId, index: health.index,
    clientId: health.clientId, frameKey: health.frameKey,
    requestId: `${Date.now()}:${Math.random()}` };
  safeStorageSet("local", PRESENTER_SIGNAL_KEY, JSON.stringify(message));
  try { state.presenter.outputWindow?.postMessage(message,window.location.origin); } catch {}
  try { state.presenter.channel?.postMessage(message); } catch {}
}

function preparePresenterOutputVideoForPaint(video) {
  if (!video) return Promise.resolve();
  const readyForPaint = () => video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA;
  const ensureInlineMutedAutoplay = () => {
    if (!video.autoplay) return;
    if (!video.muted && !video.defaultMuted && !video.hasAttribute("muted")) return;
    video.defaultMuted = true;
    video.muted = true;
    video.playsInline = true;
    video.setAttribute("muted", "");
    video.setAttribute("playsinline", "");
    video.setAttribute("webkit-playsinline", "");
  };
  const requestPlayback = () => {
    if (!video.autoplay) return;
    ensureInlineMutedAutoplay();
    const playPromise = video.play?.();
    if (playPromise?.catch) playPromise.catch(() => {});
  };
  ensureInlineMutedAutoplay();
  requestPlayback();
  if (readyForPaint()) return Promise.resolve();
  return new Promise((resolve) => {
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      cleanup();
      requestPlayback();
      resolve();
    };
    const cleanup = () => {
      window.clearTimeout(timeout);
      video.removeEventListener("loadeddata", finish);
      video.removeEventListener("canplay", finish);
      video.removeEventListener("playing", finish);
      video.removeEventListener("error", finish);
    };
    const timeout = window.setTimeout(finish, 1500);
    video.addEventListener("loadeddata", finish, { once: true });
    video.addEventListener("canplay", finish, { once: true });
    video.addEventListener("playing", finish, { once: true });
    video.addEventListener("error", finish, { once: true });
    if (video.networkState === HTMLMediaElement.NETWORK_EMPTY) video.load?.();
  });
}

function nextAnimationFrame() {
  return new Promise((resolve) => requestAnimationFrame(() => resolve()));
}

function preloadPresenterOutputImages(payload = {}, activeSlide = null) {
  presenterOutputImageSourcesForPreload(payload, activeSlide).forEach(preloadPresenterOutputImage);
}

function presenterOutputImageSourcesForPreload(payload = {}, activeSlide = null) {
  const sources = [];
  const pushSlide = (slide) => {
    const source = presenterSlideImageSource(slide);
    if (source) sources.push(source);
    if (slide?.formBackgroundImage) sources.push(slide.formBackgroundImage);
  };
  pushSlide(activeSlide);

  let slideList = [];
  let activeIndex = 0;
  slideList = Array.isArray(payload?.slides) ? payload.slides : [];
  activeIndex = clampPresenterIndex(payload?.index, slideList.length);
  for (let offset = -PRESENTER_OUTPUT_IMAGE_PRELOAD_RADIUS; offset <= PRESENTER_OUTPUT_IMAGE_PRELOAD_RADIUS; offset += 1) {
    pushSlide(slideList[activeIndex + offset]);
  }
  presenterOutputScoreGroupSlidesForPreload(slideList, activeSlide, activeIndex).forEach(pushSlide);

  presenterPayloadBackgroundImages(payload).forEach((source) => {
    const backgroundImage = normalizePresenterMediaSource(source || "");
    if (backgroundImage && presenterMediaSourceIsImage(backgroundImage)) sources.push(backgroundImage);
  });
  return [...new Set(sources)];
}

function warmPresenterOutputImages(payload = {}, activeSlide = null) {
  const sources = presenterOutputWarmupSourcesForPayload(payload, activeSlide);
  const key = presenterOutputWarmupKey(payload, sources);
  if (!key || !sources.length) {
    cancelPresenterOutputImageWarmup();
    presenterOutputImageWarmupState.key = "";
    presenterOutputImageWarmupState.serviceId = "";
    presenterOutputImageWarmupState.sources = [];
    presenterOutputImageWarmupState.index = 0;
    return;
  }
  if (key === presenterOutputImageWarmupState.key) {
    schedulePresenterOutputImageWarmup();
    return;
  }

  cancelPresenterOutputImageWarmup();
  presenterOutputImageWarmupState.key = key;
  presenterOutputImageWarmupState.serviceId = payload?.serviceId || "";
  presenterOutputImageWarmupState.sources = sources;
  presenterOutputImageWarmupState.index = 0;

  const eagerCount = Math.min(PRESENTER_OUTPUT_WARMUP_EAGER_COUNT, sources.length);
  sources.slice(0, eagerCount).forEach((source) => preloadPresenterOutputImage(source));
  presenterOutputImageWarmupState.index = eagerCount;
  schedulePresenterOutputImageWarmup();
}

function warmPresenterOutputNextVideo(payload = {}) {
  const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
  if (connection?.saveData || /(^|-)2g$/.test(String(connection?.effectiveType || ""))) return;
  const slides = Array.isArray(payload?.slides) ? payload.slides : [];
  if (!slides.length) return;
  const activeIndex = clampPresenterIndex(payload?.index, slides.length);
  const end = Math.min(slides.length, activeIndex + PRESENTER_OUTPUT_VIDEO_WARMUP_LOOKAHEAD + 1);
  const source = slides.slice(activeIndex + 1, end)
    .map(presenterOutputVideoSource)
    .find(Boolean);
  if (source && source !== presenterOutputVideoSource(slides[activeIndex])) {
    warmPresenterOutputVideoMetadata(source, { firstFrame: true });
  }
}

function warmPresenterServiceAssets(serviceId = state.selectedServiceId) {
  const service = state.services.find((candidate) => candidate.id === serviceId);
  if (!service) return { images: 0, videos: 0 };
  const slides = buildServicePresenterSlides(serviceId);
  if (!slides.length) return { images: 0, videos: 0 };
  const index = presenterFirstNavigableIndex(slides);
  const activeSlide = slides[index] || null;
  const chromakey = presenterServiceUsesChromakey(service);
  const hasCleanSlides = slides.some((slide) => presenterSlideOutputContext(slide, chromakey) === "clean");
  const payload = {
    serviceId,
    serviceType: service.type_id || "",
    chromakey,
    slides,
    index,
    backgroundImages: presenterBackgroundSourcesForService(service, { includeChromakeyCleanSlides: hasCleanSlides }),
  };
  const images = presenterOutputImageSourcesForPreload(payload, activeSlide)
    .slice(0, PRESENTER_SERVICE_ASSET_PRELOAD_LIMIT);
  images.forEach((source) => preloadPresenterOutputImage(source, { priority: "low" }));

  const videoSources = [
    presenterOutputVideoSource(activeSlide),
    ...slides.slice(index + 1, index + PRESENTER_OUTPUT_VIDEO_WARMUP_LOOKAHEAD + 1).map(presenterOutputVideoSource),
  ].filter(Boolean).filter((source, sourceIndex, sources) => sources.indexOf(source) === sourceIndex)
    .slice(0, PRESENTER_OUTPUT_VIDEO_WARMUP_LIMIT);
  videoSources.forEach(warmPresenterOutputVideoMetadata);
  return { images: images.length, videos: videoSources.length };
}

function presenterOutputVideoSource(slide = null) {
  if (!slide || presenterSlideIsHidden(slide)) return "";
  if (presenterSlideLayout(slide) !== PRESENTER_SLIDE_LAYOUTS.MEDIA
    || presenterSlideElementType(slide) !== PRESENTER_ELEMENT_TYPES.VIDEO) return "";
  return normalizePresenterMediaSource(slide.videoSrc || slide.text);
}

function warmPresenterOutputVideoMetadata(source = "", options = {}) {
  const normalized = normalizePresenterMediaSource(source);
  if (!normalized) return null;
  const cached = presenterOutputVideoWarmupCache.get(normalized);
  if (cached) {
    cached.lastUsed = Date.now();
    if (options.firstFrame) cached.video.preload = "auto";
    return cached.video;
  }
  const video = document.createElement("video");
  video.preload = options.firstFrame ? "auto" : "metadata";
  video.muted = true;
  video.playsInline = true;
  video.setAttribute("playsinline", "");
  video.setAttribute("webkit-playsinline", "");
  video.src = normalized;
  const record = { video, lastUsed: Date.now() };
  presenterOutputVideoWarmupCache.set(normalized, record);
  while (presenterOutputVideoWarmupCache.size > PRESENTER_OUTPUT_VIDEO_WARMUP_LIMIT) {
    const oldest = [...presenterOutputVideoWarmupCache.entries()]
      .sort((left, right) => left[1].lastUsed - right[1].lastUsed)[0];
    if (!oldest) break;
    oldest[1].video.removeAttribute("src");
    oldest[1].video.load?.();
    presenterOutputVideoWarmupCache.delete(oldest[0]);
  }
  try { video.load(); } catch { /* Metadata warmup is optional. */ }
  return video;
}

function clearPresenterOutputVideoWarmup() {
  presenterOutputVideoWarmupCache.forEach(({ video }) => {
    video.removeAttribute("src");
    try { video.load?.(); } catch { /* Best-effort media release. */ }
  });
  presenterOutputVideoWarmupCache.clear();
}

function presenterOutputWarmupSummary() {
  const sources = presenterOutputImageWarmupState.sources || [];
  const total = sources.length;
  const ready = sources.filter(presenterOutputImageIsReady).length;
  return {
    serviceId: presenterOutputImageWarmupState.serviceId || "",
    total,
    ready,
    queued: Math.max(0, total - presenterOutputImageWarmupState.index),
    complete: total > 0 && ready >= total,
  };
}

function presenterOutputWarmupSourcesForPayload(payload = {}, activeSlide = null) {
  const sources = [];
  const pushSource = (source) => {
    const normalized = normalizePresenterMediaSource(source);
    if (normalized && presenterMediaSourceIsImage(normalized)) sources.push(normalized);
  };
  const pushSlide = (slide) => {
    pushSource(presenterSlideImageSource(slide));
    pushSource(slide?.formBackgroundImage);
  };
  const serviceSlides = Array.isArray(payload?.slides) ? payload.slides : [];
  const serviceIndex = clampPresenterIndex(payload?.index, serviceSlides.length);

  pushSlide(activeSlide);
  if (payload?.liveScripture?.active) {
    pushSlide(payload.liveScripture.slide);
  }
  presenterSlidesByDistance(serviceSlides, serviceIndex).forEach(pushSlide);
  presenterPayloadBackgroundImages(payload).forEach(pushSource);
  return [...new Set(sources)].slice(0, PRESENTER_OUTPUT_IMAGE_PRELOAD_LIMIT);
}

function presenterSlidesByDistance(slides = [], activeIndex = 0) {
  if (!Array.isArray(slides) || !slides.length) return [];
  const safeIndex = clampPresenterIndex(activeIndex, slides.length);
  return slides
    .map((slide, index) => ({ slide, index, distance: Math.abs(index - safeIndex) }))
    .sort((a, b) => a.distance - b.distance || a.index - b.index)
    .map((item) => item.slide);
}

function presenterOutputWarmupKey(payload = {}, sources = []) {
  if (!Array.isArray(sources) || !sources.length) return "";
  const sourceSet = [...new Set(sources)].sort();
  return [
    payload?.serviceId || "no-service",
    payload?.serviceType || "",
    sourceSet.length,
    presenterHashString(sourceSet.join("\n")),
  ].join("|");
}

function presenterHashString(value) {
  let hash = 0;
  const text = String(value || "");
  for (let index = 0; index < text.length; index += 1) {
    hash = ((hash << 5) - hash + text.charCodeAt(index)) | 0;
  }
  return String(hash >>> 0);
}

function cancelPresenterOutputImageWarmup() {
  const handle = presenterOutputImageWarmupState.handle;
  if (!handle) return;
  if (handle.type === "idle" && typeof window.cancelIdleCallback === "function") {
    window.cancelIdleCallback(handle.id);
  } else {
    window.clearTimeout(handle.id);
  }
  presenterOutputImageWarmupState.handle = null;
}

function schedulePresenterOutputImageWarmup() {
  if (presenterOutputImageWarmupState.handle) return;
  if (presenterOutputImageWarmupState.index >= presenterOutputImageWarmupState.sources.length) return;
  const run = (deadline = null) => {
    presenterOutputImageWarmupState.handle = null;
    let count = 0;
    while (
      presenterOutputImageWarmupState.index < presenterOutputImageWarmupState.sources.length
      && count < PRESENTER_OUTPUT_WARMUP_BATCH_SIZE
      && (!deadline || count === 0 || deadline.timeRemaining?.() > 4)
    ) {
      const source = presenterOutputImageWarmupState.sources[presenterOutputImageWarmupState.index];
      presenterOutputImageWarmupState.index += 1;
      count += 1;
      preloadPresenterOutputImage(source, { priority: "low" });
    }
    presenterOutputImageWarmupState.onProgress?.();
    schedulePresenterOutputImageWarmup();
  };
  if (typeof window.requestIdleCallback === "function") {
    const id = window.requestIdleCallback(run, { timeout: PRESENTER_OUTPUT_WARMUP_IDLE_TIMEOUT_MS });
    presenterOutputImageWarmupState.handle = { type: "idle", id };
  } else {
    const id = window.setTimeout(() => run(null), 50);
    presenterOutputImageWarmupState.handle = { type: "timeout", id };
  }
}

function presenterOutputScoreGroupSlidesForPreload(slides = [], activeSlide = null, activeIndex = 0) {
  if (!Array.isArray(slides) || !slides.length) return [];
  const nearbyStart = Math.max(0, activeIndex - PRESENTER_OUTPUT_IMAGE_PRELOAD_RADIUS);
  const nearbyEnd = Math.min(slides.length, activeIndex + PRESENTER_OUTPUT_IMAGE_PRELOAD_RADIUS + 1);
  const nearbySlides = slides.slice(nearbyStart, nearbyEnd);
  const scoreSlide = presenterSlideIsScoreImage(activeSlide)
    ? activeSlide
    : nearbySlides.find(presenterSlideIsScoreImage);
  const groupKey = presenterSlidePreloadGroupKey(scoreSlide);
  if (!groupKey) return [];
  return slides
    .filter((slide) => presenterSlideIsScoreImage(slide) && presenterSlidePreloadGroupKey(slide) === groupKey)
    .slice(0, PRESENTER_OUTPUT_SCORE_PRELOAD_LIMIT);
}

function presenterSlideIsScoreImage(slide) {
  return Boolean(
    slide
    && presenterSlideImageSource(slide)
    && presenterSlideIsScoreLike(slide),
  );
}

function presenterSlideIsScoreLike(slide) {
  return Boolean(slide?.sourceType === "score" || slide?.componentType === "score" || slide?.scoreBackground);
}

function presenterSlidePreloadGroupKey(slide) {
  return String(slide?.elementId || slide?.sectionId || slide?.asset?.name || slide?.title || "").trim();
}

function presenterSlideImageSource(slide) {
  if (!slide) return "";
  if (slide.scriptureContext === "reading" && !slide.suppressBackgroundImage && !slide.noBackgroundImage) {
    return PRESENTER_SCRIPTURE_READING_BACKGROUND;
  }
  const layout = presenterSlideLayout(slide);
  const elementType = presenterSlideElementType(slide);
  if (layout !== PRESENTER_SLIDE_LAYOUTS.MEDIA || elementType !== PRESENTER_ELEMENT_TYPES.IMAGE) return "";
  const source = normalizePresenterMediaSource(slide.imageSrc || slide.asset?.url || slide.text);
  return source && presenterMediaSourceIsImage(source) ? source : "";
}

function preloadPresenterOutputImage(source, options = {}) {
  const normalized = normalizePresenterMediaSource(source);
  if (!normalized || !presenterMediaSourceIsImage(normalized)) return null;
  const cached = presenterOutputImagePreloadCache.get(normalized);
  if (cached) {
    cached.lastUsed = Date.now();
    if (options.priority !== "low") {
      cached.priority = "high";
      if (cached.image && "fetchPriority" in cached.image) cached.image.fetchPriority = "high";
    }
    if (!cached.failed || !options.retry) return cached.promise;
  }
  const record = { image: null, promise: null, lastUsed: Date.now(), ready: false,
    failed: false, priority: options.priority === "low" ? "low" : "high" };
  presenterOutputImagePreloadCache.set(normalized, record);
  record.promise = (async () => {
    // Retry a transient failure once; a later explicit selection can retry again.
    for (let attempt = 0; attempt < 2; attempt += 1) {
      if (attempt) await new Promise((resolve) => window.setTimeout(resolve, 300));
      const image = new Image();
      record.image = image;
      image.decoding = "async";
      image.loading = "eager";
      if ("fetchPriority" in image) image.fetchPriority = record.priority;
      const loaded = new Promise((resolve) => {
        image.onload = () => resolve(true);
        image.onerror = () => resolve(false);
      });
      image.src = normalized;
      const success = typeof image.decode === "function"
        ? await image.decode().then(() => true, () => false)
        : await loaded;
      image.onload = null;
      image.onerror = null;
      if (success && image.complete && image.naturalWidth > 0) {
        record.ready = true;
        return true;
      }
    }
    record.failed = true;
    return false;
  })();
  trimPresenterOutputImagePreloadCache();
  return record.promise;
}

function presenterOutputImageIsReady(source) {
  const normalized = normalizePresenterMediaSource(source);
  const cached = normalized ? presenterOutputImagePreloadCache.get(normalized) : null;
  if (!cached) return false;
  return Boolean(cached.ready && cached.image?.complete && cached.image.naturalWidth > 0);
}

function trimPresenterOutputImagePreloadCache() {
  if (presenterOutputImagePreloadCache.size <= PRESENTER_OUTPUT_IMAGE_PRELOAD_LIMIT) return;
  [...presenterOutputImagePreloadCache.entries()]
    .sort((a, b) => a[1].lastUsed - b[1].lastUsed)
    .slice(0, presenterOutputImagePreloadCache.size - PRESENTER_OUTPUT_IMAGE_PRELOAD_LIMIT)
    .forEach(([source]) => presenterOutputImagePreloadCache.delete(source));
}

function normalizePresenterTransitionLogo(value) {
  if (!value || typeof value !== "object") return null;
  const url = normalizePresenterMediaSource(value.url);
  if (!url || !presenterMediaSourceIsImage(url)) return null;
  const bounded = (key, fallback, min, max) => typeof value[key] === "number" && Number.isFinite(value[key])
    ? Math.min(max, Math.max(min, value[key])) : fallback;
  return { url, originX: bounded("originX", 50, 0, 100), originY: bounded("originY", 50, 0, 100),
    width: bounded("width", 255, 32, 960), height: bounded("height", 450, 32, 960) };
}

function renderPresenterTransitionLogo(slide, options = {}) {
  if (!options.noChromakey || slide?.id === "presenter:safety-blank" || slide?.formBackgroundImage
    || presenterSlideLayout(slide) !== PRESENTER_SLIDE_LAYOUTS.BLANK) return "";
  const logo = normalizePresenterTransitionLogo(options.transitionLogo);
  if (!logo) return "";
  const style = `--transition-logo-width:${logo.width};--transition-logo-height:${logo.height};`
    + `--transition-logo-x:${logo.originX}%;--transition-logo-y:${logo.originY}%;`
    + `--transition-logo-left:${-logo.width / 2};--transition-logo-top:${-logo.height / 2};`;
  return `<img class="presenter-transition-logo" src="${escapeAttr(logo.url)}" alt="" aria-hidden="true" style="${style}" />`;
}

// Reusable service artwork settings. Selection belongs to the authored service,
// never to an event ID, church preset or a runtime title match.
function normalizePresenterServiceDesign(value) {
  if (!value || typeof value !== "object") return null;
  const color = (input, fallback) => /^#[0-9a-f]{6}$/i.test(String(input || "")) ? input : fallback;
  const sectionKeys = Array.isArray(value.sectionKeys) ? value.sectionKeys.filter(key => typeof key === "string" && /^[a-z0-9_-]+$/.test(key)).slice(0, 24) : [];
  if (!sectionKeys.length) return null;
  const logo = normalizePresenterMediaSource(value.logo);
  return { sectionKeys, background: color(value.background, "#ffffff"), foreground: color(value.foreground, "#24211e"),
    accent: color(value.accent, "#ad371d"), logo: logo && presenterMediaSourceIsImage(logo) ? logo : "",
    showReadingEnd: value.showReadingEnd !== false };
}

function presenterServiceDesignForSlide(slide, options = {}) {
  const design = normalizePresenterServiceDesign(options.presentationDesign);
  const key = String(slide?.sectionKey || slide?.section_key || "");
  const layout = presenterSlideLayout(slide);
  if (!options.noChromakey || !design || !design.sectionKeys.includes(key)
    || [PRESENTER_SLIDE_LAYOUTS.BLANK, PRESENTER_SLIDE_LAYOUTS.MEDIA].includes(layout)
    || presenterSlideIsScoreLike(slide) || slide?.formBackgroundImage
    || ["image", "video", "file", "audio"].includes(presenterSlideElementType(slide))) return null;
  return design;
}

function renderPresenterSlideFrame(slide, options = {}) {
  if (options.noChromakey && !slide?.autoTrailingBlank
    && presenterSlideLayout(slide) !== PRESENTER_SLIDE_LAYOUTS.BLANK
    && (slide?.songTitle || (slide?.type === "song-title" && presenterSlideElementType(slide) === PRESENTER_ELEMENT_TYPES.PRAISE))) {
    const content = presenterSongTitleContent(slide);
    const title = String(content.title || "").replace(PRESENTER_SONG_NOTE_PATTERN, "").trim();
    // Keep the order heading when adapting song titles for fullscreen output.
    slide = { ...slide, elementType: PRESENTER_ELEMENT_TYPES.TITLE_CONTENT,
      layout: PRESENTER_SLIDE_LAYOUTS.CENTER_TEXT, type: "title-content",
      title, text: title, songTitleContent: content, bodyText: "", assignee: "", fullscreenSongTitle: true };
  }
  const design = presenterServiceDesignForSlide(slide, options);
  if (design) {
    slide = { ...slide, suppressBackgroundImage: true, scriptureReadingFinal: design.showReadingEnd && slide.scriptureReadingFinal };
    options = { ...options, serviceDesignActive: true };
  }
  const slideClass = presenterSlideRenderClass(slide);
  const transitionLogo = renderPresenterTransitionLogo(slide, options);
  const extraClasses = [presenterSlideExtraClasses(slide), transitionLogo ? "has-transition-logo" : "", design ? "presenter-slide--service-design" : ""].filter(Boolean).join(" ");
  const body = transitionLogo || renderPresenterSlideBody(slide, options);
  const sectionKey = String(slide?.sectionKey || slide?.section_key || "").trim();
  const presenterRole = normalizeServicePresenterRole(slide?.presenterRole);
  const designStyle = design ? `--service-design-background:${design.background};--service-design-foreground:${design.foreground};--service-design-accent:${design.accent};` : "";
  const backgroundStyle = design ? ` style="${escapeAttr(designStyle)}"` : slide?.scriptureContext === "reading" && !slide?.suppressBackgroundImage && !slide?.noBackgroundImage
    ? ` style="--presenter-slide-bg-image: url('${escapeAttr(PRESENTER_SCRIPTURE_READING_BACKGROUND)}')"`
    : "";
  return `
    <section class="presenter-slide presenter-slide--${escapeAttr(slideClass)}${extraClasses ? ` ${escapeAttr(extraClasses)}` : ""}" data-element-type="${escapeAttr(presenterSlideElementType(slide))}" data-slide-layout="${escapeAttr(presenterSlideLayout(slide))}"${sectionKey ? ` data-section-key="${escapeAttr(sectionKey)}"` : ""}${presenterRole ? ` data-presenter-role="${escapeAttr(presenterRole)}"` : ""}${backgroundStyle}>
      ${design?.logo ? `<img class="presenter-service-design-mark" src="${escapeAttr(design.logo)}" alt="" aria-hidden="true" />` : ""}
      ${renderPresenterSlideMeta(slide)}
      ${options.previewStage && presenterSlideBackgroundVideoSource(slide, options.noChromakey) ? `<video class="presenter-output-background-video" src="${escapeAttr(presenterSlideBackgroundVideoSource(slide, options.noChromakey))}" muted playsinline preload="metadata" aria-hidden="true"></video>` : ""}
      ${body}
    </section>
  `;
}

function presenterSlideExtraClasses(slide) {
  const classes = [];
  if (slide?.fullscreenSongTitle) classes.push("presenter-slide--fullscreen-song-title");
  const layout = presenterSlideLayout(slide);
  // A blank (including the auto trailing blank, which copies the previous slide) has no caption to theme.
  if (slide?.captionTheme === "cadaros" && layout !== PRESENTER_SLIDE_LAYOUTS.BLANK) classes.push("presenter-slide--caption-cadaros");
  if (presenterSlideIsScoreLike(slide)) classes.push("presenter-slide--score");
  if (layout !== PRESENTER_SLIDE_LAYOUTS.BLANK && presenterScriptureContextUsesReadingForm(slide?.scriptureContext)) classes.push("presenter-slide--scripture-reading");
  if (layout !== PRESENTER_SLIDE_LAYOUTS.BLANK && slide?.scriptureContext === "sermon") classes.push("presenter-slide--scripture-sermon");
  if (layout !== PRESENTER_SLIDE_LAYOUTS.BLANK && slide?.scriptureContext === "citation") classes.push("presenter-slide--scripture-citation");
  if (layout !== PRESENTER_SLIDE_LAYOUTS.BLANK && presenterScriptureContextUsesAddressTab(slide?.scriptureContext)) classes.push("presenter-slide--citation-tab");
  return classes.join(" ");
}

function presenterSafetyBlankSlide() {
  return {
    id: "presenter:safety-blank",
    outputContext: "clean",
    elementType: PRESENTER_ELEMENT_TYPES.BLANK,
    layout: PRESENTER_SLIDE_LAYOUTS.BLANK,
    type: "blank",
    title: "암전",
    text: "",
  };
}

function renderPresenterSlideMeta(slide) {
  if (!presenterSlideHasMeta(slide)) return "";
  const marker = presenterVisibleMeta(slide);
  if (!marker) return "";
  return `<div class="presenter-slide-meta">${escapeHtml(marker)}</div>`;
}

function presenterVisibleMeta(slide) {
  const marker = [slide?.marker, slide?.label].filter(Boolean).join(" · ").trim();
  if (!marker) return "";
  if (presenterLabelDuplicatesSlideText(marker, slide)) return "";
  return marker;
}

function renderPresenterSlideBody(slide, options = {}) {
  const layout = presenterSlideLayout(slide);
  const elementType = presenterSlideElementType(slide);
  if (slide?.type === "ready" && options.noChromakey) return renderPresenterFullscreenReadySlide(slide);
  if (presenterSlideUsesGeneratedWaitingLoop(slide, options)) return renderPresenterGeneratedWaitingLoopSlide(slide);
  if (elementType === PRESENTER_ELEMENT_TYPES.AUDIO) return "";
  if (layout === PRESENTER_SLIDE_LAYOUTS.MEDIA && elementType === PRESENTER_ELEMENT_TYPES.VIDEO) {
    if (options.staticVideoPreview) return renderPresenterStaticVideoPreviewSlide(slide);
    return renderPresenterVideoSlide(slide, options);
  }
  if (layout === PRESENTER_SLIDE_LAYOUTS.MEDIA && elementType === PRESENTER_ELEMENT_TYPES.IMAGE) return renderPresenterImageSlide(slide, options);
  if (layout === PRESENTER_SLIDE_LAYOUTS.FILE) return renderPresenterFileSlide(slide);
  if (layout !== PRESENTER_SLIDE_LAYOUTS.BLANK && elementType === PRESENTER_ELEMENT_TYPES.SCRIPTURE_TEXT && presenterScriptureContextUsesAddressTab(slide?.scriptureContext)) return renderPresenterCitationTabSlide(slide);
  if (elementType === PRESENTER_ELEMENT_TYPES.SCRIPTURE_TEXT && presenterScriptureContextUsesReadingForm(slide?.scriptureContext)) return renderPresenterScriptureReadingSlide(slide);
  if (layout === PRESENTER_SLIDE_LAYOUTS.LOWER_BAR_TEXT && elementType === PRESENTER_ELEMENT_TYPES.TITLE_ASSIGNEE) {
    return renderPresenterReadingAssigneeTab(slide) + renderPresenterTitleAssigneeSlide(slide);
  }
  if (layout === PRESENTER_SLIDE_LAYOUTS.LOWER_BAR_TEXT && slide?.type === "song-title" && slide.sectionHeading) return renderPresenterSectionSongTitleSlide(slide);
  if (layout === PRESENTER_SLIDE_LAYOUTS.BLANK) return "";
  if (slide?.type === "liturgical-body") return renderPresenterLiturgicalBodySlide(slide);
  if (presenterSlideIsTitleContent(slide)) return renderPresenterTitleContentSlide(slide, options);
  return `<div class="presenter-slide-text">${renderPresenterSlideText(slide)}</div>`;
}

function presenterSlideUsesGeneratedWaitingLoop(slide, options = {}) {
  if (options.noChromakey) return false;
  if (slide?.type !== "ready") return false;
  if (normalizeServicePresenterRole(slide.presenterRole) !== "waiting_loop") return false;
  if (normalizePresenterMediaSource(slide.videoSrc || slide.imageSrc || slide.text)) return false;
  return presenterSlideOutputContext(slide, true) === "chromakey";
}

function presenterReadySubjectParticle(serviceName) {
  const ending = String(serviceName || "").normalize("NFC").replace(/[\s)\]}'"”’」』】〉》.!?…]+$/u, "").slice(-1);
  const code = ending.charCodeAt(0);
  if (code >= 0xAC00 && code <= 0xD7A3) return (code - 0xAC00) % 28 ? "이" : "가";
  if (/^[0-9]$/.test(ending)) return "013678".includes(ending) ? "이" : "가";
  // Keep the existing fallback for names whose pronunciation cannot be inferred.
  return "가";
}

function renderPresenterGeneratedWaitingLoopSlide(slide) {
  const serviceName = presenterReadySlideServiceName(slide);
  return `
    <div class="presenter-waiting-loop" aria-label="${escapeAttr(`${serviceName} 대기 영상`)}">
      <div class="presenter-waiting-loop-field" aria-hidden="true"></div>
      <div class="presenter-waiting-loop-cross" aria-hidden="true"></div>
      <div class="presenter-waiting-loop-copy">
        <p class="presenter-waiting-loop-script">지금은 기도로 예배를 준비하는 시간입니다</p>
        <p class="presenter-waiting-loop-title">잠시 후 <strong>${escapeHtml(serviceName)}</strong>${presenterReadySubjectParticle(serviceName)} 시작됩니다</p>
      </div>
      <img class="presenter-waiting-loop-logo" src="${escapeAttr(PRESENTER_CHURCH_LOGO)}" alt="기형 검단우리교회" decoding="sync" loading="eager" fetchpriority="high" draggable="false" />
    </div>
  `;
}

function presenterReadySlideServiceName(slide) {
  const name = String(slide?.readyServiceName || "").trim()
    || String(slide?.text || "").split("\n").map((line) => line.trim()).filter(Boolean)[1]
    || "예배";
  return /^주일예배\s*\[[123]부\]$/.test(name) ? "주일예배" : name;
}

function renderPresenterFullscreenReadySlide(slide) {
  const serviceName = presenterReadySlideServiceName(slide);
  return `
    <div class="presenter-ready-screen">
      <div class="presenter-ready-screen-field" aria-hidden="true"></div>
      <div class="presenter-ready-screen-copy">
        <p class="presenter-ready-screen-kicker">지금은 기도로 예배를 준비하는 시간입니다</p>
        <p class="presenter-ready-screen-message">잠시 후 <strong>${escapeHtml(serviceName)}</strong>${presenterReadySubjectParticle(serviceName)} 시작됩니다</p>
      </div>
      <img class="presenter-ready-screen-logo" src="${escapeAttr(PRESENTER_CHURCH_LOGO)}" alt="기형 검단우리교회" decoding="sync" loading="eager" fetchpriority="high" draggable="false" />
    </div>
  `;
}

let presenterTabBackgroundId = 0;
function presenterTabBackground(assignee = false) {
  const id = `presenter-tab-edge-${++presenterTabBackgroundId}`;
  return `<svg class="presenter-tab-background" aria-hidden="true" xmlns="http://www.w3.org/2000/svg"><defs><filter id="${id}" x="0" y="0" width="100%" height="100%"><feComponentTransfer><feFuncA type="discrete" tableValues="0 1"/></feComponentTransfer></filter></defs><g filter="url(#${id})"><rect class="presenter-tab-curve" width="100%" height="100%"/><rect x="${assignee ? "50%" : "0"}" width="50%" height="100%"/><rect y="50%" width="100%" height="50%"/></g></svg>`;
}

function renderPresenterCitationTabSlide(slide) {
  const raw = String(slide?.text || "");
  const number = presenterScriptureVerseParts(raw).number || presenterScriptureVerseNumber({
    number: slide?.scriptureVerse, verseEnd: slide?.scriptureVerseEnd,
  });
  const reference = presenterScriptureReadingHeaderReference(slide, number);
  // Older slide snapshots store the reference and body separated by whitespace.
  const body = slide?.citationBodyText ?? raw.replace(/^.*?\s{2,}/, "");
  return `<div class="presenter-citation-tab">${presenterTabBackground()}${escapeHtml(reference)}</div>
    <div class="presenter-slide-text"><span>${escapeHtml(body)}</span></div>`;
}

function renderPresenterScriptureReadingSlide(slide) {
  const reference = String(slide?.title || slide?.marker || "").trim();
  const translationLabel = String(slide?.translationLabel || "").trim();
  const { number, text } = presenterScriptureVerseParts(slide?.text || "");
  const headerReference = presenterScriptureReadingHeaderReference(slide, number) || reference;
  const referenceChars = presenterLineCharEstimate(headerReference || "본문");
  const translationChars = presenterLineCharEstimate(translationLabel || "역본");
  const verseChars = presenterLineCharEstimate(text || slide?.text || "");
  return `
    <div class="presenter-scripture-reading">
      <div class="presenter-scripture-reading-head">
        <div class="presenter-scripture-reading-ref" style="--line-chars: ${escapeAttr(referenceChars)}">${escapeHtml(headerReference || "본문")}</div>
        ${translationLabel ? `<div class="presenter-scripture-reading-version" style="--line-chars: ${escapeAttr(translationChars)}">${escapeHtml(translationLabel)}</div>` : ""}
      </div>
      <div class="presenter-scripture-reading-line">
        <span class="presenter-scripture-reading-text" style="--line-chars: ${escapeAttr(verseChars)}">${escapePresenterSlideLine(text || slide?.text || " ", slide)}</span>
      </div>
      ${slide?.scriptureContext === "reading" && slide?.scriptureReadingFinal ? `<div class="presenter-scripture-reading-fin">Fin.</div>` : ""}
    </div>`;
}

function presenterScriptureReadingHeaderReference(slide = {}, verseNumber = "") {
  const referenceBook = presenterScriptureReadingBookName(slide?.referenceBook);
  const referenceRange = String(slide?.referenceRange || "").trim();
  const chapter = referenceRange.match(/^(\d+`?|\(\d+\))/)?.[1] || "";
  const verse = String(verseNumber || "").trim();
  const chapterReference = [referenceBook, verse.includes(":") ? verse : chapter && verse ? `${chapter}:${verse}` : chapter ? `${chapter}장` : referenceRange].filter(Boolean).join(" ").trim();
  const fallback = String(slide?.title || slide?.marker || "").trim();
  return chapterReference || presenterScriptureReadingDisplayReference(fallback);
}

function presenterScriptureReadingBookName(value = "") {
  const referenceBook = String(value || "").trim();
  if (!referenceBook || typeof findBibleBookByReferenceName !== "function") return referenceBook;
  return String(findBibleBookByReferenceName(referenceBook)?.koreanName || referenceBook).trim();
}

function presenterScriptureVerseParts(value = "") {
  const text = String(value || "").trim();
  const match = text.match(/^(\d{1,3}(?::\d{1,3}|_\d{1,3})?(?:[상하abㄱㄴ])?(?:[–-]\d{1,3}(?::\d{1,3}|_\d{1,3})?(?:[상하abㄱㄴ])?)?)\s{2,}(.+)$/);
  if (!match) return { number: "", text };
  return { number: match[1], text: match[2].trim() };
}

function renderPresenterVideoSlide(slide, options = {}) {
  const source = normalizePresenterMediaSource(slide.videoSrc || slide.text);
  if (!source) return "";
  const presenterRole = normalizeServicePresenterRole(slide.presenterRole);
  const playbackType = presenterRole === "intro"
    ? "intro-video"
    : (presenterRole === "ready" || presenterRole === "waiting_loop" || slide.type === "ready")
      ? "ready-video"
      : "video";
  const playback = presenterPlaybackConfig(slide.playback, playbackType);
  const previewStage = Boolean(options.previewStage);
  const videoSource = previewStage ? presenterPreviewVideoSource(source) : source;
  const attrs = [
    "class=\"presenter-video\"",
    `src="${escapeAttr(videoSource)}"`,
    presenterRole ? `data-presenter-role="${escapeAttr(presenterRole)}"` : "",
    (!previewStage && playback.autoplay) ? "autoplay" : "",
    (previewStage || playback.muted) ? "muted" : "",
    (previewStage || playback.muted) ? "defaultMuted" : "",
    (!previewStage && playback.loop) ? "loop" : "",
    (!previewStage && playback.controls) ? "controls" : "",
    (options.noChromakey || previewStage) ? "" : `poster="${PRESENTER_CHROMAKEY_VIDEO_POSTER}"`,
    "playsinline",
    "webkit-playsinline",
    `preload=\"${previewStage ? "metadata" : "auto"}\"`,
  ].filter(Boolean).join(" ");
  return `
    <video ${attrs}></video>
  `;
}

function presenterPreviewVideoSource(source = "") {
  const normalized = String(source || "").trim();
  if (!normalized || normalized.includes("#")) return normalized;
  return `${normalized}#t=0.001`;
}

function renderPresenterStaticVideoPreviewSlide(slide) {
  const title = presenterFileDisplayTitle(slide, "동영상");
  return `<div class="presenter-static-media-preview" aria-label="${escapeAttr(title)}">${escapeHtml(title)}</div>`;
}

function renderPresenterImageSlide(slide, options = {}) {
  const source = normalizePresenterMediaSource(slide.imageSrc || slide.asset?.url || slide.text);
  if (!source) return "";
  const referenceClass = slide?.referenceMedia ? " presenter-image--reference" : "";
  const previewStage = Boolean(options.previewStage);
  const decoding = previewStage ? "async" : "sync";
  const loading = previewStage ? "lazy" : "eager";
  const fetchPriority = previewStage ? "low" : "high";
  return `<img class="presenter-image${referenceClass}" src="${escapeAttr(source)}" alt="" decoding="${decoding}" loading="${loading}" fetchpriority="${fetchPriority}" draggable="false" />`;
}

function presenterOrderDisplayLabel(value = "") {
  const label = String(value || "");
  // Hide sequence numbers only in output headings, never in stored labels/content.
  return label.replace(/^([가-힣A-Za-z][가-힣A-Za-z ]*?)\s*(?:\d+|[①-⑳㉑-㉟㊱-㊿])(?:\s*[·–~-]\s*(?:\d+|[①-⑳㉑-㉟㊱-㊿]))*\s*$/u,
    (_, name) => name.trim());
}

function renderPresenterReadingAssigneeTab(slide) {
  const assignee = isPresenterScriptureReadingSource(slide)
    ? cleanPresenterAssignee(slide.scriptureReadingAssignee)
    : "";
  return assignee
    ? `<div class="presenter-citation-tab presenter-assignee-tab">${presenterTabBackground(true)}${escapeHtml(assignee)}</div>`
    : "";
}

function renderPresenterTitleAssigneeSlide(slide) {
  const title = String(slide.title || slide.text || slide.label || "").trim();
  const assignee = String(slide.assignee || slide.subtitle || "").trim();
  const orderTitle = String(slide.orderTitle || "").trim();
  const contentTitle = String(slide.contentTitle || "").trim();
  const titleChars = presenterLineCharEstimate(title);
  const assigneeChars = presenterLineCharEstimate(assignee);
  const orderChars = presenterLineCharEstimate(orderTitle);
  const contentChars = presenterLineCharEstimate(contentTitle);
  if (presenterTitleAssigneeIsSermon(slide) && contentTitle && assignee) {
    return `
      <div class="presenter-slide-text presenter-title-assignee presenter-title-assignee--sermon">
        <span class="presenter-title-assignee-content" style="--line-chars: ${escapeAttr(contentChars)}">${escapeHtml(contentTitle)}</span>
        <span class="presenter-title-assignee-person" style="--line-chars: ${escapeAttr(assigneeChars)}">${escapeHtml(assignee)}</span>
      </div>
    `;
  }
  if (orderTitle && contentTitle && !assignee) {
    return `
      <div class="presenter-slide-text presenter-title-assignee presenter-title-assignee--order-content">
        <span class="presenter-title-assignee-order" style="--line-chars: ${escapeAttr(orderChars)}">${escapeHtml(presenterOrderDisplayLabel(orderTitle))}</span>
        <span class="presenter-title-assignee-content" style="--line-chars: ${escapeAttr(contentChars)}">${escapeHtml(contentTitle)}</span>
      </div>
    `;
  }
  if (orderTitle && contentTitle && assignee) {
    return `
      <div class="presenter-slide-text presenter-title-assignee presenter-title-assignee--three-part">
        <span class="presenter-title-assignee-order" style="--line-chars: ${escapeAttr(orderChars)}">${escapeHtml(presenterOrderDisplayLabel(orderTitle))}</span>
        <span class="presenter-title-assignee-content" style="--line-chars: ${escapeAttr(contentChars)}">${escapeHtml(contentTitle)}</span>
        <span class="presenter-title-assignee-person" style="--line-chars: ${escapeAttr(assigneeChars)}">${escapeHtml(assignee)}</span>
      </div>
    `;
  }
  const soloClass = assignee ? "" : " presenter-title-assignee--solo";
  return `
    <div class="presenter-slide-text presenter-title-assignee${soloClass}">
      <span class="presenter-title-assignee-title" style="--line-chars: ${escapeAttr(titleChars)}">${escapeHtml(title === slide.label || title === slide.sectionLabel ? presenterOrderDisplayLabel(title) : title)}</span>
      ${assignee ? `<span class="presenter-title-assignee-person" style="--line-chars: ${escapeAttr(assigneeChars)}">${escapeHtml(assignee)}</span>` : ""}
    </div>
  `;
}

function presenterTitleAssigneeIsSermon(slide = {}) {
  if (String(slide?.titlePresentation || "").trim() === "sermon") return true;
  const values = [
    slide.sectionKey,
    slide.sectionLabel,
    slide.sectionTitle,
    slide.orderTitle,
    slide.label,
  ].map((value) => compactSearchValue(value));
  return values.some((value) => value === "설교" || value === "sermon");
}

function renderPresenterSectionSongTitleSlide(slide) {
  const heading = presenterSongTitleNormalizedHeading(
    String(slide.sectionHeading || slide.label || slide.sectionLabel || "").trim(),
    String(slide.sectionKey || slide._worshipSectionKey || "").trim(),
  );
  const title = presenterSongTitleContentText(
    String(slide.text || formatPresenterSongTitleText(slide.title || "")).trim(),
    heading,
  );
  const headingChars = presenterLineCharEstimate(heading);
  const titleChars = presenterLineCharEstimate(title);
  return `
    <div class="presenter-slide-text presenter-section-song-title">
      <span class="presenter-section-song-title-heading" style="--line-chars: ${escapeAttr(headingChars)}">${escapeHtml(presenterOrderDisplayLabel(heading))}</span>
      <span class="presenter-section-song-title-name" style="--line-chars: ${escapeAttr(titleChars)}">${renderPresenterSongText(title, slide)}</span>
    </div>
  `;
}

function renderPresenterTitleContentSlide(slide, options = {}) {
  const title = String(slide.title || "").trim();
  const orderHeading = options.noChromakey && presenterTitleAssigneeIsSermon(slide)
    ? String(slide.orderTitle || slide.sectionTitle || "설교").trim()
    : "";
  const bodyLines = presenterTitleContentLines(slide);
  const titleChars = presenterLineCharEstimate(title);
  return `
    <div class="presenter-title-content">
      ${orderHeading && !(options.serviceDesignActive && compactSearchValue(orderHeading) === compactSearchValue(title)) ? `<span class="presenter-fullscreen-order-heading">${escapeHtml(presenterOrderDisplayLabel(orderHeading))}</span>` : ""}
      ${slide.fullscreenSongTitle ? `<span class="presenter-fullscreen-song-heading" aria-label="찬양">${PRESENTER_SONG_NOTE}</span>` : ""}
      <span class="presenter-title-content-title" style="--line-chars: ${escapeAttr(titleChars)}">${escapeHtml(title)}</span>

      ${slide.fullscreenSongTitle ? "" : `<div class="presenter-title-content-body">
        ${bodyLines.map((line) => `<span style="--line-chars: ${presenterLineCharEstimate(line)}">${escapePresenterSlideLine(line, slide)}</span>`).join("")}
      </div>`}
    </div>
  `;
}

// Layout roles come from authored welcome copy and explicit footer markers.
function presenterAnnouncementRegions(items) {
  const regions={welcome:[],news:[],footer:[]};
  let current=null,role="news";
  for(const item of items)for(const [index,raw] of item.lines.entries()) {
    const line=String(raw||""),plain=window.MindexInlineText.plain(line).trim();
    if(!plain)continue;
    const welcome=/^(?:[＊*]\s*)?(?:오늘도\s*)?(?:청년부|청소년부|어린이부) 예배에 오신 여러분을/.test(plain);
    const footer=/^[◈◇◆♢]/.test(plain)||/^(?:청년부\s*기도 모임\s*\(매주|검단우리교회는 신천지|잠들기 전, 잠언 읽기!|연말에 잠잠성경과 주보 모으기)/.test(plain);
    const numbered=plain.match(/^(?:(\d+)[.)]|([①-⑳]))\s*/u);
    if(welcome||footer||numbered||index===0||role==="welcome") {
      role=welcome?"welcome":footer?"footer":"news";
      current={marker:footer?"◇":numbered?(numbered[1]?presenterCircledNumber(Number(numbered[1])-1):numbered[2]):index===0?item.marker:"",lines:[]};
      regions[role].push(current);
    }
    if(!current){current={marker:"",lines:[]};regions.news.push(current);}
    // Remove only the displayed footer symbol, preserving authored bold runs.
    let skip=footer?(window.MindexInlineText.plain(line).match(/^\s*[◈◇◆♢]\s*/)?.[0].length||0):numbered?(window.MindexInlineText.plain(line).match(/^\s*/)[0].length+numbered[0].length):0;
    const copy=window.MindexInlineText.runs(line).map(run=>{
      const text=run.text.slice(skip);skip=Math.max(0,skip-run.text.length);
      return text&&run.bold?`**${text}**`:text;
    }).join("");
    current.lines.push(copy);
  }
  return regions;
}

function renderPresenterAnnouncementItems(items,slide) {
  return items.map(item=>{
    const marker=String(item.marker||"").trim();
    return `<div class="presenter-announcement-item${marker?"":" presenter-announcement-item--plain"}">
      ${marker?`<span class="presenter-announcement-marker">${escapeHtml(marker)}</span>`:""}
      <span class="presenter-announcement-copy">${item.lines.map(line=>`<span style="--line-chars: ${presenterLineCharEstimate(window.MindexInlineText.plain(line))}">${line?escapePresenterSlideLine(line,slide):"<br>"}</span>`).join("")}</span>
    </div>`;
  }).join("");
}

function fitPresenterAnnouncementRegions(host) {
  host.querySelectorAll(".presenter-announcement-region, .presenter-liturgical-body > .presenter-announcement-items").forEach(box=>{
    box.style.removeProperty("font-size");
    const base=parseFloat(getComputedStyle(box).fontSize);
    if(!box.clientWidth||!box.clientHeight||!Number.isFinite(base))return;
    const fits=()=>{
      const bounds=box.getBoundingClientRect();
      const heading=box.matches(".presenter-announcement-items")
        ? box.parentElement.querySelector(".presenter-liturgical-body-heading")?.getBoundingClientRect()
        : null;
      const top=heading?Math.max(bounds.top,heading.bottom):bounds.top;
      const root=box.closest(".presenter-output-root");
      const tolerance=(root?.getBoundingClientRect().width || 1920)/1920;
      return presenterTextFits(box)
        && [...box.children].every(item=>{
          const rect=item.getBoundingClientRect();
          return rect.top>=top-tolerance&&rect.bottom<=bounds.bottom+tolerance;
        });
    };
    fitPresenterTextBox(box, {fits});
  });
}

function renderPresenterLiturgicalBodySlide(slide) {
  const title = String(slide.title || slide.sectionTitle || "").trim();
  const lines = presenterLiturgicalBodyLines(slide);
  const titleChars = presenterLineCharEstimate(title);
  const announcementItems = Array.isArray(slide?.announcementItems) ? slide.announcementItems.filter((item) => item?.lines?.length) : [];
  const explicit=normalizeAnnouncementRegions(slide.announcementRegions);
  const regions=explicit?Object.fromEntries(Object.entries(explicit).map(([key,text])=>[key,presenterAnnouncementItems(text)])):presenterAnnouncementRegions(announcementItems);
  const anchored=explicit||regions.welcome.length||regions.footer.length;
  const body = announcementItems.length
    ? anchored
      ? `<div class="presenter-announcement-layout">${["welcome","news","footer"].map(role=>`<div class="presenter-announcement-region presenter-announcement-region--${role}">${renderPresenterAnnouncementItems(regions[role],slide)}</div>`).join("")}</div>`
      : `<div class="presenter-announcement-items">${renderPresenterAnnouncementItems(announcementItems,slide)}</div>`
    : `<div class="presenter-liturgical-body-lines">
        ${lines.map((line) => `<span style="--line-chars: ${presenterLineCharEstimate(line)}">${escapePresenterSlideLine(line, slide)}</span>`).join("")}
      </div>`;
  return `
    <div class="presenter-liturgical-body">
      ${body}
      <div class="presenter-liturgical-body-heading">
        <span style="--line-chars: ${escapeAttr(titleChars)}">${escapeHtml(title)}</span>
      </div>
    </div>
  `;
}

function renderPresenterFileSlide(slide) {
  const asset = normalizeServiceAsset(slide.asset);
  const typeLabel = presenterFileTypeLabel(slide.sourceType || slide.componentType || asset.kind || "file");
  const title = presenterFileDisplayTitle({ ...slide, asset }, typeLabel);
  return `
    <div class="presenter-slide-file">
      <small>${escapeHtml(typeLabel)}</small>
      <strong>${escapeHtml(title)}</strong>
    </div>
  `;
}

function renderPresenterSlideText(slide) {
  const lines = presenterDisplayLines(slide);
  const verseNumber = presenterLyricVerseNumber(slide, lines);
  let verseNumberUsed = false;
  return lines
    .map((line) => {
      const showVerseNumber = verseNumber && !verseNumberUsed && String(line || "").trim();
      if (showVerseNumber) verseNumberUsed = true;
      const displayLine = showVerseNumber ? presenterLyricLineWithoutInlineVerseNumber(line, verseNumber) : line;
      return `<span${showVerseNumber ? ` class="presenter-lyric-line presenter-lyric-line--numbered" data-verse-no="${escapeAttr(verseNumber)}"` : ""} style="--line-chars: ${presenterLineCharEstimate(displayLine)}">${escapePresenterSlideLine(displayLine, slide)}</span>`;
    })
    .join("");
}

function renderPresenterSongText(text, slide) {
  const raw = String(text || " ");
  if (presenterSlideElementType(slide) !== PRESENTER_ELEMENT_TYPES.PRAISE) return escapePresenterSlideLine(raw, slide);
  const match = raw.match(/^(\s*)([\u2669\u266A\u266B\u266C])(\s*)(.*)$/u);
  if (!match) return renderPresenterHighlightedText(raw, slide);
  const [, leading, , spacing, rest] = match;
  return `${escapeHtml(leading)}<span class="presenter-song-note" aria-hidden="true">${escapeHtml(PRESENTER_SONG_NOTE)}</span>${escapeHtml(spacing || " ")}${renderPresenterHighlightedText(rest || " ", slide)}`;
}

function presenterLyricVerseNumber(slide, lines = presenterDisplayLines(slide)) {
  if (presenterSlideElementType(slide) !== PRESENTER_ELEMENT_TYPES.PRAISE) return "";
  if (presenterSlideLayout(slide) !== PRESENTER_SLIDE_LAYOUTS.LOWER_BAR_TEXT) return "";
  if (slide?.type !== "lyrics") return "";
  const marker = String(slide?.marker || slide?.formLabel || "").trim();
  const match = marker.match(/^(?:verse|v)\s*(\d{1,2})(?:\s*[a-z])?$/i)
    || marker.match(/^(\d{1,2})\s*절$/);
  if (match) return String(Number(match[1]));
  const firstLine = lines.find((line) => String(line || "").trim());
  const inlineMatch = String(firstLine || "").match(/^\s*(\d{1,2})(?:\s*[.)])?\s+(?=\S)/);
  return inlineMatch ? String(Number(inlineMatch[1])) : "";
}

function presenterLyricLineWithoutInlineVerseNumber(line, verseNumber) {
  const raw = String(line || "");
  const inlineMatch = raw.match(/^(\s*)(\d{1,2})(?:\s*[.)])?\s+(?=\S)/);
  if (!inlineMatch || String(Number(inlineMatch[2])) !== verseNumber) return raw;
  return `${inlineMatch[1]}${raw.slice(inlineMatch[0].length)}`;
}

function escapePresenterSlideLine(line, slide) {
  const text = line || " ";
  if (presenterSlideElementType(slide) === PRESENTER_ELEMENT_TYPES.SCRIPTURE_TEXT) {
    return escapeHtml(text).replace(/ {2,}/g, (spaces) => "&nbsp;".repeat(spaces.length));
  }
  if (presenterSlideElementType(slide) === PRESENTER_ELEMENT_TYPES.PRAISE) {
    return renderPresenterSongText(text, slide);
  }
  return renderPresenterHighlightedText(text, slide);
}

function presenterAnnouncementParenthesisRanges(text) {
  const ranges = [];
  const stack = [];
  let start = -1;
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    if (char === "(" || char === "（") {
      if (!stack.length) start = index;
      stack.push(char === "(" ? ")" : "）");
    } else if (char === ")" || char === "）") {
      if (stack.at(-1) !== char) { stack.length = 0; start = -1; continue; }
      stack.pop();
      if (!stack.length) ranges.push({ start, end: index + 1 });
    }
  }
  return ranges;
}

function renderPresenterHighlightedText(line, slide) {
  const inline = slide?.announcementItems?.length && window.MindexInlineText
    ? window.MindexInlineText.runs(line || " ") : [{text:String(line || " "),bold:false}];
  const text = inline.map(run=>run.text).join("");
  const boldRanges=[];let inlineOffset=0;
  for(const run of inline){if(run.bold)boldRanges.push({start:inlineOffset,end:inlineOffset+run.text.length});inlineOffset+=run.text.length;}
  const renderInline=(start,end)=>{
    let cursor=start;const parts=[];
    for(const range of boldRanges){const from=Math.max(start,range.start),to=Math.min(end,range.end);if(from>=to)continue;
      parts.push(escapeHtml(text.slice(cursor,from)),`<strong>${escapeHtml(text.slice(from,to))}</strong>`);cursor=to;}
    parts.push(escapeHtml(text.slice(cursor,end)));return parts.join("");
  };
  const highlights = normalizeServiceTextHighlights(slide?.textHighlights || slide?.text_highlights || slide?.highlights);
  const lyricParentheses = slide?.type === "lyrics"
    && presenterSlideElementType(slide) === PRESENTER_ELEMENT_TYPES.PRAISE;
  const parentheses = slide?.announcementItems?.length || lyricParentheses
    ? presenterAnnouncementParenthesisRanges(text) : [];
  const parenthesisClass = lyricParentheses ? "presenter-lyric-paren" : "presenter-announcement-paren";
  const renderRange = (start, end) => {
    let cursor = start;
    const parts = [];
    for (const range of parentheses) {
      const from = Math.max(start, range.start);
      const to = Math.min(end, range.end);
      if (from >= to) continue;
      parts.push(renderInline(cursor, from));
      parts.push(`<span class="${parenthesisClass}">${renderInline(from, to)}</span>`);
      cursor = to;
    }
    parts.push(renderInline(cursor, end));
    return parts.join("");
  };
  if (!highlights.length) return renderRange(0, text.length);
  const ranges = [];
  highlights
    .filter((highlight) => highlight.text)
    .sort((a, b) => String(b.text).length - String(a.text).length)
    .forEach((highlight) => {
      const needle = String(highlight.text || "");
      if (!needle) return;
      let index = text.indexOf(needle);
      while (index !== -1) {
        const end = index + needle.length;
        const overlaps = ranges.some((range) => index < range.end && end > range.start);
        if (!overlaps) ranges.push({ start: index, end, highlight });
        index = text.indexOf(needle, end);
      }
    });
  if (!ranges.length) return renderRange(0, text.length);
  ranges.sort((a, b) => a.start - b.start);
  let cursor = 0;
  const parts = [];
  ranges.forEach((range) => {
    if (range.start > cursor) parts.push(renderRange(cursor, range.start));
    const content = renderRange(range.start, range.end);
    const style = presenterTextHighlightStyle(range.highlight);
    parts.push(`<span class="presenter-text-highlight"${style ? ` style="${style}"` : ""}>${content}</span>`);
    cursor = range.end;
  });
  if (cursor < text.length) parts.push(renderRange(cursor, text.length));
  return parts.join("");
}

function presenterTextHighlightStyle(highlight = {}) {
  const styles = [];
  const color = normalizeServiceTextHighlightColor(highlight.color || highlight.fg || highlight.foreground || highlight.hex);
  if (color) {
    // Theme overrides preserve the authored color as the fallback everywhere else.
    const palette = ["#FFC832", "#C8FF32", "#FF96C8", "#FF6432", "#32C8FF", "#9696FF"];
    const token = palette.includes(color.toUpperCase()) ? `--presenter-highlight-${color.slice(1).toLowerCase()}` : "";
    styles.push(`--presenter-text-highlight-color: ${token ? `var(${token}, ${escapeAttr(color)})` : escapeAttr(color)}`);
    if (token) styles.push("--presenter-text-highlight-stroke: var(--presenter-palette-stroke, 0px)");
  }
  if (highlight.bold === false) styles.push("--presenter-text-highlight-weight: inherit");
  return styles.join("; ");
}

function presenterDisplayLines(slide) {
  const baseText = slide?.text || slide?.title || "";
  const lowerBar = presenterSlideLayout(slide) === PRESENTER_SLIDE_LAYOUTS.LOWER_BAR_TEXT;
  const text = lowerBar ? slide?.text : baseText;
  const lines = String(text || "").split(/\n/);
  if (lowerBar) return lines;

  const deduped = [];
  for (const line of lines) {
    const previous = deduped[deduped.length - 1];
    if (previous !== undefined && normalizeTitle(previous) === normalizeTitle(line)) continue;
    deduped.push(line);
  }
  return deduped.length ? deduped : [""];
}

function presenterLiturgicalBodyLines(slide) {
  return String(slide?.text || slide?.bodyText || "")
    .split(/\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}

function presenterTitleContentBodyText(slide) {
  return String(slide?.bodyText || slide?.body || slide?.text || "").trim();
}

function presenterTitleContentLines(slide) {
  const title = String(slide?.title || "").trim();
  const lines = presenterTitleContentBodyText(slide).split(/\n/);
  const deduped = [];
  for (const line of lines) {
    if (title && normalizeTitle(line) === normalizeTitle(title)) continue;
    const previous = deduped[deduped.length - 1];
    if (previous !== undefined && normalizeTitle(previous) === normalizeTitle(line)) continue;
    deduped.push(line);
  }
  return deduped.length ? deduped : [""];
}

function presenterLineCharEstimate(line) {
  const text = String(line || "").replace(/\s+/g, " ").trim();
  if (!text) return 1;
  let score = 0;
  for (const char of text) {
    if (/\s/.test(char)) score += 0.35;
    else if (/[A-Za-z0-9]/.test(char)) score += 0.58;
    else score += 1;
  }
  return Math.max(1, Math.ceil(score));
}

// Placement is an instance-level reference between ordinary worship elements.
// A complete form-sequence signature prevents repeated labels from drifting.

function presenterProgressionPlan(item, slides = []) {
  const groups = [];
  for (const slide of slides) {
    if (!slide.formKey) continue;
    let group = groups.at(-1);
    if (group?.key !== slide.formKey) {
      group = { key: slide.formKey, label: slide.formLabel || slide.marker || slide.title || "구간", lastSlideId: slide.id };
      groups.push(group);
    }
    group.lastSlideId = slide.id;
  }
  const memo = parseServiceItemMemo(item?.memo);
  const signature = JSON.stringify([
    item?.song_id || "", item?.version_id || item?.song_version_id || "",
    serviceItemOutputMode(item, memo), groups.map(group => group.key),
    // Manual slides have positional IDs: changed text requires reselection.
    memo.slides,
  ]);
  return { groups, signature };
}

function presenterProgressionForItem(item, serviceId) {
  const service = state.services.find(service => service.id === serviceId);
  if (!service || !item || !serviceItemSupportsHeaderAudio(item)) return { groups: [], signature: "" };
  return presenterProgressionPlan(item, buildPresenterSlidesForServiceItem(item, service, 0, { allowHydration: false }));
}

function presenterProgressionOptions(plan, selected = "") {
  return plan.groups.map((group, index) => `<option value="${escapeAttr(group.key)}"${group.key === selected ? " selected" : ""}>${escapeHtml(`${index + 1}. ${group.label}`)}</option>`).join("");
}

function renderPresenterProgressionAdd(item) {
  const serviceId = item?.service_id || state.selectedServiceId;
  if (!item || item._isDefault) return "";
  const plan = presenterProgressionForItem(item, serviceId);
  if (!plan.groups.length) return "";
  return `<details class="svc-progression-media">
    <summary>배경</summary>
    <div class="svc-progression-media-controls">
      <select class="svc-presenter-input-control" data-progression-position aria-label="사진을 띄울 송폼">${presenterProgressionOptions(plan)}</select>
      <button class="btn ghost" type="button" data-progression-media-add data-service-id="${escapeAttr(serviceId)}" data-service-item-id="${escapeAttr(item.id)}">사진 추가</button>
    </div>
  </details>`;
}

function addPresenterProgressionMedia(button) {
  const serviceId = button.dataset.serviceId;
  const parent = getServiceItems(serviceId).find(item => item.id === button.dataset.serviceItemId);
  const plan = presenterProgressionForItem(parent, serviceId);
  const formKey = button.closest(".svc-progression-media")?.querySelector("[data-progression-position]")?.value;
  if (!parent || !plan.groups.some(group => group.key === formKey)) {
    showToast("곡 진행을 확인하고 넣을 위치를 다시 선택해 주세요.", "info");
    return;
  }
  addPresenterReferenceMedia(serviceId, presenterReferenceMediaItemSectionKey(parent), {
    afterItemId: parent.id, mediaPlacement: { parentItemId: parent.id, formKey, signature: plan.signature },
  });
}

function renderPresenterMediaPlacementInput(item, serviceId) {
  const placement = parseServiceItemMemo(item.memo).mediaPlacement;
  if (!placement) return "";
  const parent = getServiceItems(serviceId).find(candidate => candidate.id === placement.parentItemId);
  const plan = presenterProgressionForItem(parent, serviceId);
  const valid = plan.signature === placement.signature && plan.groups.some(group => group.key === placement.formKey);
  return `<label class="svc-presenter-input-field">
    <span>${escapeHtml(parent ? `${serviceItemDisplayText(parent) || parent.label} · 배경 사진 구간` : "원래 곡이 없습니다")}</span>
    <select class="svc-presenter-input-control" data-media-placement data-service-id="${escapeAttr(serviceId)}" data-service-item-id="${escapeAttr(item.id)}" aria-label="배경 사진 구간">
      ${valid ? "" : '<option value="" selected disabled>위치 재선택 필요 · 송출 제외</option>'}
      ${presenterProgressionOptions(plan, valid ? placement.formKey : "")}
      <option value="detach">독립된 예배 순서로 분리</option>
    </select>
  </label>`;
}

function updatePresenterMediaPlacement(field) {
  const serviceId = field.dataset.serviceId;
  const item = getServiceItems(serviceId).find(candidate => candidate.id === field.dataset.serviceItemId);
  if (!item) return;
  const memo = parseServiceItemMemo(item.memo);
  if (!memo.mediaPlacement) return;
  if (field.value === "detach") memo.mediaPlacement = null;
  else {
    const parent = getServiceItems(serviceId).find(candidate => candidate.id === memo.mediaPlacement.parentItemId);
    const plan = presenterProgressionForItem(parent, serviceId);
    if (!plan.groups.some(group => group.key === field.value)) return;
    memo.mediaPlacement = { parentItemId: parent.id, formKey: field.value, signature: plan.signature };
  }
  item.memo = serializeServiceItemMemo(memo);
  item._worshipElementTemplateModified = true;
  state.dirty.service = true;
  markServiceElementDirty(serviceId, item);
  refreshPresenterForService(serviceId, { publish: false });
  renderCurrentServiceModuleDetail();
  updateSaveState();
}

function insertPresenterProgressionMedia(slides, items) {
  const placements = items.map(item => ({ item, placement: parseServiceItemMemo(item.memo).mediaPlacement }))
    .filter(entry => entry.placement);
  if (!placements.length) return slides;
  const byElement = new Map();
  for (const slide of slides) {
    if (!byElement.has(slide.elementId)) byElement.set(slide.elementId, []);
    byElement.get(slide.elementId).push(slide);
  }
  const insertedIds = new Set(placements.map(entry => entry.item.id));
  const backgrounds = new Map();
  const invalidIds = new Set();
  const parentIds = new Set();
  for (const { item, placement } of placements) {
    const parent = items.find(candidate => candidate.id === placement.parentItemId);
    const parentSlides = byElement.get(parent?.id) || [];
    const plan = presenterProgressionPlan(parent, parentSlides);
    const target = parentSlides.filter(slide => slide.formKey === placement.formKey);
    const photos = byElement.get(item.id) || [];
    if (!parent || insertedIds.has(parent.id) || !target.length || plan.signature !== placement.signature
      || presenterReferenceMediaItemSectionKey(parent) !== presenterReferenceMediaItemSectionKey(item)
      || target.some(slide => presenterSlideIsScoreLike(slide)
        || ![PRESENTER_SLIDE_LAYOUTS.LOWER_BAR_TEXT, PRESENTER_SLIDE_LAYOUTS.CENTER_TEXT, PRESENTER_SLIDE_LAYOUTS.BLANK].includes(presenterSlideLayout(slide)))
      || !photos.length || photos.some(slide => !presenterSlideImageSource(slide))) {
      invalidIds.add(item.id);
      continue;
    }
    parentIds.add(parent.id);
    const key = target[0].id;
    if (!backgrounds.has(key)) backgrounds.set(key, { target, photos: [] });
    backgrounds.get(key).photos.push(...photos.map(slide => ({ ...slide,
      hiddenInPresentation: Boolean(slide.hiddenInPresentation || serviceItemPresentationHidden(parent)),
    })));
  }
  const replacements = new Map();
  const replacedIds = new Set();
  for (const [key, { target, photos }] of backgrounds) {
    // Traverse both ordered lists once: retain every lyric page and photo, without
    // restarting the lyrics for every photo. The shorter list holds its page.
    const count = Math.max(target.length, photos.length);
    replacements.set(key, Array.from({ length: count }, (_, index) => {
      const lyric = target[Math.floor(index * target.length / count)];
      const photo = photos[Math.floor(index * photos.length / count)];
      return { ...lyric, id: `${photo.id}:form-background:${index}`,
        elementId: photo.elementId, elementLabel: photo.elementLabel, connectedPraise: null,
        progressionParentId: lyric.elementId,
        progressionSequence: true, formBackgroundImage: presenterSlideImageSource(photo),
        outputContext: "clean", syncTimeline: null,
        hiddenInPresentation: Boolean(lyric.hiddenInPresentation || photo.hiddenInPresentation),
      };
    }));
    target.forEach(slide => replacedIds.add(slide.id));
  }
  return slides.flatMap(slide => {
    if (invalidIds.has(slide.elementId)) return [{ ...slide, hiddenInPresentation: true,
      warnings: [...(slide.warnings || []), "배경 사진과 송폼을 확인해 주세요 · 송출 제외"] }];
    if (insertedIds.has(slide.elementId)) return [];
    if (replacements.has(slide.id)) return replacements.get(slide.id);
    if (replacedIds.has(slide.id)) return [];
    return [parentIds.has(slide.elementId) ? { ...slide, progressionSequence: true } : slide];
  });
}

function renderPresenterMediaOrder(item, serviceId) {
  const asset = normalizeServiceAsset(parseServiceItemMemo(item.memo).asset);
  const slides = normalizeServiceAssetSlides(asset.slides);
  if (asset.pptx || slides.length < 2) return "";
  return `<div class="svc-media-order" aria-label="자료 순서">${slides.map((slide, index) => `
    <div class="svc-media-order-row"><span>${escapeHtml(`${index + 1}. ${slide.name || "자료"}`)}</span>
      ${[[-1, "앞으로"], [1, "뒤로"], [0, "제거"]].map(([move, label]) => `<button type="button" class="icon-btn" data-media-order="${move}"
        data-media-index="${index}" data-media-url="${escapeAttr(slide.url)}" data-service-id="${escapeAttr(serviceId)}" data-service-item-id="${escapeAttr(item.id)}"
        ${move === -1 && index === 0 || move === 1 && index === slides.length - 1 ? "disabled" : ""} aria-label="${escapeAttr(`${index + 1}번 자료 ${label}`)}" title="${label}">${move === -1 ? "↑" : move === 1 ? "↓" : "×"}</button>`).join("")}
    </div>`).join("")}</div>`;
}

function updatePresenterMediaOrder(button) {
  const serviceId = button.dataset.serviceId;
  const item = getServiceItems(serviceId).find(candidate => candidate.id === button.dataset.serviceItemId);
  if (!item) return;
  const memo = parseServiceItemMemo(item.memo);
  const asset = normalizeServiceAsset(memo.asset);
  const slides = normalizeServiceAssetSlides(asset.slides);
  const index = Number(button.dataset.mediaIndex);
  const move = Number(button.dataset.mediaOrder);
  if (asset.pptx || slides[index]?.url !== button.dataset.mediaUrl || ![-1, 0, 1].includes(move)) return;
  if (move) {
    if (!slides[index + move]) return;
    [slides[index], slides[index + move]] = [slides[index + move], slides[index]];
  } else slides.splice(index, 1);
  memo.asset = { ...asset, url: slides[0]?.url || "", slides: slides.map((slide, i) => ({ ...slide, order: i + 1 })) };
  item.memo = serializeServiceItemMemo(memo);
  item._worshipElementTemplateModified = true;
  state.dirty.service = true;
  markServiceElementDirty(serviceId, item);
  refreshPresenterForService(serviceId, { publish: false });
  renderCurrentServiceModuleDetail();
  updateSaveState();
}

function presenterSequenceTitleSlide(item, section, song, version, displayText, index, sequenceIndex) {
  return {
    ...presenterSongTitleSlide(item, section, song, version, displayText, index),
    id: `${item.id || index}:sequence-title:${sequenceIndex}`,
    formKey: `title:${sequenceIndex}`, formLabel: "Title", marker: "Title",
    sort: index + sequenceIndex / 100,
  };
}

// Per-element presentation settings share the worship memo/atomic persistence path.
function normalizeServicePresentation(value) {
  if (!value || typeof value !== "object") return null;
  const source = normalizePresenterMediaSource(value.backgroundVideo);
  const backgroundVideo = /\.(mp4|webm|mov|m4v)(?:[?#].*)?$/i.test(source) ? source : "";
  return backgroundVideo ? { backgroundVideo } : null;
}

function renderPresenterPresentationControls(item, index, serviceId) {
  const memo = parseServiceItemMemo(item.memo), type = serviceMemoElementType(memo);
  if (type !== "praise") return "";
  const presentation = normalizeServicePresentation(memo.presentation) || {};
  const attrs = `data-service-item-index="${index}" data-service-id="${escapeAttr(serviceId)}"`;
  return `<details class="svc-presentation-controls"><summary>배경 영상</summary>
    <label>영상 주소 <input class="svc-presenter-input-control" type="text" data-service-item-field="background_video" ${attrs} value="${escapeAttr(presentation.backgroundVideo || '')}" placeholder="MP4 · WebM 영상 주소" aria-label="찬양 배경 영상 주소"></label>
    <label class="btn ghost">영상 파일 선택<input type="file" accept="video/mp4,video/webm,video/quicktime,video/x-m4v,.mp4,.webm,.mov,.m4v" data-praise-background-file data-service-id="${escapeAttr(serviceId)}" data-service-item-id="${escapeAttr(item.id)}" hidden></label>
    <span class="muted">전체 화면에서 음소거·반복 재생</span>
  </details>`;
}

async function uploadPresenterPraiseBackground(input) {
  const file = input.files?.[0], serviceId = input.dataset.serviceId;
  const itemId = input.dataset.serviceItemId;
  const item = getServiceItems(serviceId).find(row => row.id === itemId);
  if (!file || !item) return;
  if (!/\.(mp4|webm|mov|m4v)$/i.test(file.name) || file.size > presenterMediaMaxBytesForKind("video")) {
    showToast(`MP4·WebM·MOV 영상은 ${presenterMediaMaxSizeLabel("video")} 이하로 선택해 주세요.`, "error"); input.value = ""; return;
  }
  input.disabled = true;
  try {
    const path = presenterReferenceMediaUploadPath(serviceId, item, file);
    const bucket = state.client.storage.from(PRESENTER_MEDIA_STORAGE_BUCKET);
    const upload = await bucket.upload(path, file, { contentType: file.type || "video/mp4", cacheControl: PRESENTER_MEDIA_CACHE_CONTROL, upsert: false });
    if (upload.error) throw upload.error;
    const url = bucket.getPublicUrl(path).data.publicUrl;
    const currentIndex = getServiceItems(serviceId).findIndex(row => row.id === itemId);
    if (currentIndex < 0) throw new Error("배경을 연결할 찬양을 찾지 못했습니다.");
    updateServiceItemField({ dataset: { serviceId, serviceItemIndex: String(currentIndex), serviceItemField: "background_video" }, value: url }, { deferPresenterRefresh: true });
    if (!await saveServiceItemPatch(serviceId, currentIndex, { throwOnError: true })) throw new Error("배경 영상 저장을 확인해 주세요.");
    renderCurrentServiceModuleDetail(); showToast("찬양 배경 영상을 저장했습니다.", "success");
  } catch (error) { showToast(error.message || "배경 영상을 저장하지 못했습니다. 다시 시도해 주세요.", "error"); }
  finally { input.disabled = false; input.value = ""; }
}

function presenterSlideBackgroundVideoSource(slide, noChromakey) {
  if (!noChromakey || slide?.formBackgroundImage || presenterSlideLayout(slide) === PRESENTER_SLIDE_LAYOUTS.BLANK) return "";
  if (![PRESENTER_SLIDE_LAYOUTS.CENTER_TEXT, PRESENTER_SLIDE_LAYOUTS.LOWER_BAR_TEXT].includes(presenterSlideLayout(slide))) return "";
  return normalizeServicePresentation({ backgroundVideo: slide?.backgroundVideo })?.backgroundVideo || "";
}

function applyPresenterBackgroundVideo(root, source = "") {
  let video = root.querySelector(":scope > .presenter-output-background-video");
  if (!source) { if (video) { video.pause(); video.removeAttribute("src"); video.load(); video.remove(); } delete root.dataset.backgroundVideoError; return; }
  if (video?.getAttribute("src") === source) return;
  if (video) { video.pause(); video.remove(); }
  video = document.createElement("video"); video.className = "presenter-output-background-video";
  video.muted = true; video.defaultMuted = true; video.loop = true; video.autoplay = true; video.playsInline = true; video.preload = "auto";
  video.setAttribute("aria-hidden", "true"); video.setAttribute("src", source);
  video.addEventListener("error", () => { root.dataset.backgroundVideoError = "true"; });
  video.addEventListener("playing", () => { delete root.dataset.backgroundVideoError; });
  root.prepend(video); video.play()?.catch(() => { root.dataset.backgroundVideoError = "true"; });
}
