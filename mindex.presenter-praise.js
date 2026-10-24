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
  if (!String(scoreAsset.url || "").trim()) {
    return presenterScoreFormPresetLabels(item, song, version).flatMap((label, position) =>
      normalizePresenterFormPresetLabel(label).type === "title"
        ? [presenterSequenceTitleSlide(item, section, song, version, displayText, index, position)] : []);
  }
  const fileTitle = presenterFileDisplayTitle({ title, asset: scoreAsset }, "악보");
  const scoreForms = presenterScoreFormsFromImageSources([{ formLabel: asset.formLabel || asset.form_label || asset.scoreFormLabel || asset.score_form_label }]);
  const fileSlide = {
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
  };
  const sequence = presenterScoreImageSourcesForFormSequence([{ url: scoreAsset.url }], scoreForms, forms, item, song, version);
  return sequence.imageSources.map((source, position) => source._presenterTitle
    ? presenterSequenceTitleSlide(item, section, song, version, displayText, index, position)
    : { ...fileSlide, sort: index + position / 100 });
}

function presenterScoreImageSourcesFromAsset(asset, song = null, version = null, displayText = "") {
  const explicitSources = [
    ...normalizeServiceAssetSlides(asset?.slides),
    ...normalizeServiceAssetSlides(asset?.images),
    ...normalizeServiceAssetSlides(asset?.urls),
    ...presenterImageSourcesFromAssetUrl(asset?.url),
  ];
  const sources = explicitSources.length ? explicitSources : presenterHymnScoreAssetSlides(song, version, displayText);
  return sources
    .map((slide, slideIndex) => ({
      url: normalizePresenterMediaSource(slide.url),
      name: String(slide.name || "").trim(),
      formLabel: presenterScoreFormLabelFromAssetSlide(slide),
      formKey: String(slide.formKey || slide.form_key || slide.scoreFormKey || slide.score_form_key || "").trim(),
      order: Number(slide.order) || slideIndex + 1,
    }))
    .filter((slide) => slide.url && presenterMediaSourceIsImage(slide.url));
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
  const imageSources = presenterScoreImageSourcesFromAsset(asset, song, version, displayText);
  const count = imageSources.length;
  if (!count) return [];
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
  const policy = presenterScoreFormSequence(item, song, version);
  const presetLabels = policy.forms;
  const planTargets = presetLabels
    .map((label) => normalizePresenterFormPresetLabel(label))
    .filter((target) => target.key);
  const scoreTargets = (scoreForms || []).map((form) =>
    form ? normalizePresenterFormPresetLabel(presenterFormDisplayLabel(form)) : null,
  );
  if (!planTargets.length) return { imageSources, scoreForms };
  if (policy.defaultTitle && planTargets.every(target => target.type === "title")) {
    return { imageSources: [{ _presenterTitle: true }, ...imageSources], scoreForms: [null, ...scoreForms] };
  }
  if (!scoreTargets.some((target) => target?.key)) {
    if (planTargets.every(target => ["title", "lyrics"].includes(target.type))) {
      const selected = planTargets.map((target, index) => target.type === "title"
        ? { sources: [{ _presenterTitle: true }], forms: [null] }
        : { sources: imageSources, forms: imageSources.map(() => ({
          ...presenterVirtualFormPresetItem("L", target, "L", index),
          _presenterScoreFormKey: `score:lyrics:${index}`,
        })) });
      return { imageSources: selected.flatMap(group => group.sources), scoreForms: selected.flatMap(group => group.forms) };
    }
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
        ...imageSources.map(source => ambiguous ? { ...source, titleSequenceWarning: "악보 송폼 표시가 없어 중간 T 위치를 확인할 수 없습니다." } : source),
        ...planTargets.slice(last + 1).map(() => ({ _presenterTitle: true })),
      ], scoreForms: [],
    };
  }

  const groups = [];
  imageSources.forEach((source, index) => {
    const target = scoreTargets[index];
    const previous = groups.at(-1);
    const key = scoreForms[index]?._presenterScoreFormKey;
    const sameForm = key && key === previous?.forms.at(-1)?._presenterScoreFormKey && target?.key === previous?.target?.key;
    const startsGroup = Boolean(target?.key) && !sameForm;
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
    const firstContent = selected.findIndex(group => group.sources.some(source => !source._presenterTitle));
    if (firstContent >= 0) selected.splice(firstContent, 0, opening);
  }
  return {
    imageSources: selected.flatMap((group) => group.sources),
    scoreForms: selected.flatMap((group) => group.forms),
  };
}

function presenterDefaultTitleForServiceItem(item = {}, song = null, version = null, { score = false } = {}) {
  if (isServiceConnectedPraiseSecondaryItem(item)) return false;
  if (isPresenterSpecialSongItem(item)) return true;
  if (presenterSongTitleUsesSectionHeading(item)) return false;
  if (!isMainPraiseServiceItem(item, { allowUnlabeled: true })) return false;
  const memo = parseServiceItemMemo(item.memo);
  const scoreOutput = score || serviceItemOutputMode(item, memo) === "score";
  return !(scoreOutput && versionEffectivePraiseTypes(song, version).includes("hymn"));
}

function presenterFormPresetWithDefaultTitle(preset, item, song, version, options = {}) {
  const forms = normalizeServiceFormPresetForms(preset?.forms || []);
  if (preset?.titleSequence || forms.includes("T")) return { ...preset, forms, titleSequence: true };
  if (!options.inferred || !presenterDefaultTitleForServiceItem(item, song, version, options)) return preset;
  return { ...preset, forms: ["T", ...forms], hint: ["T", ...forms].join("-"), titleSequence: true, defaultTitle: true };
}

function presenterServiceItemDeclaredFormSource(item = {}, song = null, version = null) {
  const stored = serviceItemFormPreset(item);
  if (stored?.forms?.length) {
    const saved = { ...stored, strength: "manual" };
    return { kind: "manual", preset: isPresenterSpecialSongItem(item)
      && versionEffectivePraiseTypes(song, version).includes("hymn")
      ? presenterSpecialSongHymnDisplayPreset(saved) : saved };
  }
  const template = serviceItemTemplateFormDefaults(item).formPreset;
  const rule = matchedServiceItemFormPresetRule(item, song, version);
  let servicePreset = template?.forms?.length ? template : rule?.formPreset;
  if (servicePreset?.forms?.length && isPresenterSpecialSongItem(item)
      && versionEffectivePraiseTypes(song, version).includes("hymn")) {
    servicePreset = presenterSpecialSongHymnDisplayPreset(servicePreset);
  }
  if (servicePreset?.forms?.length) return { kind: "service", preset: { ...servicePreset, strength: "default" } };
  const metadata = presenterSongDefaultFormPreset(song, version);
  if (metadata?.forms?.length) return { kind: "metadata", preset: { ...metadata, strength: "song-default" } };
  return null;
}

function presenterScoreFormSequence(item = {}, song = null, version = null) {
  const declared = presenterServiceItemDeclaredFormSource(item, song, version);
  if (declared) return declared.preset;
  // Score assets already own their page sequence; inference must not reorder it.
  return presenterFormPresetWithDefaultTitle(null, item, song, version, { score: true, inferred: true }) || { forms: [] };
}

function presenterScoreFormPresetLabels(item = {}, song = null, version = null) {
  return presenterScoreFormSequence(item, song, version).forms;
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
    if (!target.key) return null;
    const partType = presenterFormPartTypeForPresetTarget(target);
    const formKey = String(source.formKey || source.form_key || source.scoreFormKey || source.score_form_key || "").trim()
      || `score:${target.key}:${target.type === "lyrics" ? "whole" : index}`;
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
  if (effectivePreset.defaultTitle && effectivePreset.forms.every(label => label === "T")) {
    return { forms: [findPresenterFormForPresetLabel([], "T"), ...presenterHymnOnceOnlyIntro(forms, version)], warnings: [] };
  }
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

function presenterServiceItemFormPreset(version = {}, item = {}, song = null, options = {}) {
  const declared = presenterServiceItemDeclaredFormSource(item, song, version);
  if (declared) return declared.preset;
  if (options.includePlaybackFallback === false) return null;
  const available = normalizeForms(version?.forms || []).filter(form => normalizeLyricsForCopy(form.lyrics));
  const sourceSequence = available.length && available.every(form => normalizePresenterFormPresetLabel(presenterFormDisplayLabel(form)).key)
    ? { forms: available.map(presenterFormDisplayLabel).filter((label, index, list) => label !== "L" || list[index - 1] !== "L"), strength: "auto" } : null;
  const preset = presenterDefaultVerseChorusFormPreset(available, song, version) || sourceSequence;
  const resolved = presenterFormPresetWithAvailableForms(preset, available);
  return presenterFormPresetWithDefaultTitle(resolved, item, song, version, { inferred: true });
}

function presenterServiceItemBaseFormPreset(version = {}, item = {}, song = null, { includePlaybackFallback = true } = {}) {
  const declared = presenterServiceItemDeclaredFormSource(item, song, version);
  if (declared) return declared.preset;
  const forms = normalizeForms(version?.forms || []).filter(form => normalizeLyricsForCopy(form.lyrics));
  return includePlaybackFallback ? presenterDefaultVerseChorusFormPreset(forms, song, version) : null;
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
    .filter(({ target }) => target.key);
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
  return !["", "verse", "chorus"].includes(String(target.type || ""));
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
  if (presenterFormsAreUnsplitLyrics(forms) && presetForms.some(label => {
    const target = normalizePresenterFormPresetLabel(label);
    return !target.blank && !["title", "lyrics"].includes(target.type);
  })) {
    const lyricsResolved = resolvePresenterLyricsFormPresetSequence(forms, presetForms, sourceForms);
    if (lyricsResolved.items.length) return lyricsResolved;
  }
  const items = [];
  const missing = [];
  cleanList(presetForms).forEach((label, index) => {
    const target = normalizePresenterFormPresetLabel(label);
    if (target.type === "lyrics" && !target.number && !target.group && !target.variant) {
      const matching = forms.filter(form => normalizePresenterFormPresetLabel(presenterFormDisplayLabel(form)).type === "lyrics");
      if (matching.length) items.push(...matching.map(form => ({ ...form, _presenterPresetLabel: "L" })));
      else missing.push("L");
      return;
    }
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
      items.push(findPresenterFormForPresetLabel([], "T"));
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
    // L owns the complete unstructured lyric unit, including every paragraph.
    if (target.type === "lyrics" && !target.number && !target.group && !target.variant) {
      const text = blocks.join("\n\n");
      if (!text) missing.push("L");
      else {
        const form = presenterVirtualFormPresetItem("L", target, text, index);
        assigned.set(target.key, form);
        items.push(form);
      }
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
  if (target.type === "title") return { _presenterTitle: true, id: "preset-title", label: "T", lyrics: "" };
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
  if (raw === "T") return { key: "title", type: "title", number: 0 };
  if (raw === "L") return { key: "lyrics", type: "lyrics", number: 0 };
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
  if (/^(l|lyrics)$/i.test(compact)) return "lyrics";
  if (/^(int|interlude|instrumental|간주)$/i.test(compact)) return "instrumental";
  return compact;
}

function presenterFormPresetDisplayLabel(value = "") {
  const raw = String(value || "").trim();
  if (!raw) return "";
  const target = normalizePresenterFormPresetLabel(raw);
  const group = String(target.group || "").trim().toUpperCase();
  const suffix = target.variant ? `${target.number ? ` ${target.number}` : ""} @${group ? ` ${group}` : ""}` : target.number ? ` ${target.number}${group ? ` ${group}` : ""}` : group ? ` ${group}` : "";
  if (target.type === "title") return "T";
  if (target.lastVerse) return "Last Verse";
  if (target.type === "verse") return `Verse${suffix}`;
  if (target.type === "chorus") return `Chorus${suffix}`;
  if (target.type === "bridge") return `Bridge${suffix}`;
  if (target.type === "pre-chorus") return `Pre-Chorus${suffix}`;
  if (target.type === "coda") return `Coda${suffix}`;
  if (target.type === "tag") return target.repeat > 1 ? "Tags" : "Tag";
  if (target.type === "instrumental") return "Instrumental";
  if (target.type === "lyrics") return "L";
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
  if (target.type === "coda" || target.type === "lyrics") return presenterFormPresetDisplayLabel(raw);
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

