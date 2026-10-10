// Persistence-shaped worship document rules.
// Supabase I/O stays in app.js; this file owns source_ref, history, and save-row rules.

function serviceRawSourceRef(service = null) {
  if (!service || typeof service !== "object") return {};
  if (service._worshipSourceRef && typeof service._worshipSourceRef === "object") return service._worshipSourceRef;
  if (service.source_ref && typeof service.source_ref === "object") return service.source_ref;
  return {};
}

const serviceSourceRefCache = new WeakMap();
function serviceSourceRef(service = null) {
  const raw = serviceRawSourceRef(service);
  const keys = Object.keys(raw);
  if (!keys.length) return {};
  const cached = serviceSourceRefCache.get(raw);
  if (cached && cached.keys.length === keys.length
    && keys.every((key, index) => cached.keys[index] === key && cached.values[index] === raw[key])) {
    return cached.result;
  }
  const result = normalizeServiceSourceRef(raw);
  serviceSourceRefCache.set(raw, { keys, values: keys.map((key) => raw[key]), result });
  return result;
}

function normalizeServiceSourceRef(sourceRef = {}) {
  if (!sourceRef || typeof sourceRef !== "object") return {};
  const normalized = { ...sourceRef };
  const document = normalizeServiceDocumentSnapshot(normalized[MINDEX_SERVICE_DOCUMENT_SOURCE_REF_KEY]);
  if (document) normalized[MINDEX_SERVICE_DOCUMENT_SOURCE_REF_KEY] = document;
  else delete normalized[MINDEX_SERVICE_DOCUMENT_SOURCE_REF_KEY];
  const history = normalizeServiceDocumentHistory(normalized[MINDEX_SERVICE_DOCUMENT_HISTORY_SOURCE_REF_KEY]);
  if (history.length) normalized[MINDEX_SERVICE_DOCUMENT_HISTORY_SOURCE_REF_KEY] = history;
  else delete normalized[MINDEX_SERVICE_DOCUMENT_HISTORY_SOURCE_REF_KEY];
  return normalized;
}

function normalizeServiceDocumentHistory(history = []) {
  return trimServiceDocumentHistory((Array.isArray(history) ? history : [])
    .map((entry) => normalizeServiceDocumentSnapshot(entry))
    .filter(Boolean));
}

function normalizeServiceDocumentSnapshot(document = null) {
  if (!document || typeof document !== "object") return null;
  const sourceText = limitServiceDocumentText(document.sourceText || document.source_text || "");
  const sourceRecords = normalizeServiceDocumentSourceRecords(document.sourceRecords || document.source_records);
  const slides = normalizeServiceDocumentSlides(document.slides);
  const exceptions = normalizeServiceDocumentExceptions(document.exceptions);
  const payload = {
    kind: document.kind || MINDEX_SERVICE_DOCUMENT_KIND,
    version: document.version || MINDEX_SERVICE_DOCUMENT_VERSION,
    serviceId: String(document.serviceId || document.service_id || "").trim(),
    serviceTypeId: String(document.serviceTypeId || document.service_type_id || "").trim(),
    serviceDate: String(document.serviceDate || document.service_date || "").trim(),
    serviceTitle: String(document.serviceTitle || document.service_title || "").trim(),
    serviceAlias: String(document.serviceAlias || document.service_alias || "").trim(),
    updatedAt: document.updatedAt || document.updated_at || "",
    sourceSignature: document.sourceSignature || document.source_signature || compactTextSignature(sourceText),
    slideSignature: document.slideSignature || document.slide_signature || compactTextSignature(JSON.stringify(slides)),
    sourceText,
    sourceRecords,
    slides,
    exceptions,
  };
  const sourceRecordCount = Number(document.sourceRecordCount);
  const slideCount = Number(document.slideCount);
  if (Number.isFinite(sourceRecordCount) && sourceRecordCount > 0) payload.sourceRecordCount = sourceRecordCount;
  if (Number.isFinite(slideCount) && slideCount > 0) payload.slideCount = slideCount;
  if (typeof document.contentSignature === "string" && document.contentSignature) payload.contentSignature = document.contentSignature;
  return Object.fromEntries(Object.entries(payload).filter(([, value]) => {
    if (Array.isArray(value)) return value.length;
    return value !== "" && value != null;
  }));
}

function serviceDocumentHistoryWithPrevious(previousDocument = null, previousHistory = [], currentDocument = null) {
  const entries = [];
  const seen = new Set();
  const currentKey = serviceDocumentHistoryEntryKey(currentDocument);
  const append = (entry) => {
    const compact = compactServiceDocumentHistoryEntry(entry);
    const key = serviceDocumentHistoryEntryKey(compact);
    if (!compact || !key || key === currentKey || seen.has(key)) return;
    seen.add(key);
    entries.push(compact);
  };
  append(previousDocument);
  (Array.isArray(previousHistory) ? previousHistory : []).forEach(append);
  return trimServiceDocumentHistory(entries);
}

function normalizeServiceDocumentSourceRecords(records = []) {
  return (Array.isArray(records) ? records : []).map((record, index) => {
    if (!record || typeof record !== "object") return null;
    const linkedSource = record.linkedSource && typeof record.linkedSource === "object" ? record.linkedSource : {};
    const asset = record.asset && typeof record.asset === "object" ? normalizeServiceAsset(record.asset) : null;
    const payload = {
      index: Number(record.index) || index + 1,
      recordKey: String(record.recordKey || record.record_key || "").trim(),
      elementId: String(record.elementId || record.element_id || "").trim(),
      sectionId: String(record.sectionId || record.section_id || "").trim(),
      sectionKey: String(record.sectionKey || record.section_key || "").trim(),
      slotKey: normalizeWorshipSlotKey(record.slotKey || record.slot_key || linkedSource.slotKey || linkedSource.slot_key),
      sectionTitle: String(record.sectionTitle || record.section_title || "").trim(),
      label: String(record.label || "").trim(),
      value: normalizeServiceItemReferenceSpacing(record.value || ""),
      assignee: String(record.assignee || "").trim(),
      lyrics: limitServiceDocumentText(record.lyrics || ""),
      linkedSource,
    };
    if (asset && hasServiceAsset(asset)) payload.asset = asset;
    payload.recordKey = payload.recordKey || serviceDocumentRecordKey(payload);
    return Object.fromEntries(Object.entries(payload).filter(([, value]) => {
      if (value && typeof value === "object") return Object.keys(value).length;
      return value !== "" && value != null;
    }));
  }).filter(Boolean);
}

function normalizeServiceDocumentSlides(slides = []) {
  return (Array.isArray(slides) ? slides : []).map((slide, index) => {
    if (!slide || typeof slide !== "object") return null;
    const linkedSource = slide.linkedSource && typeof slide.linkedSource === "object" ? slide.linkedSource : {};
    const asset = normalizeServiceAsset(slide.asset || slide.media);
    const slotKey = normalizeWorshipSlotKey(slide.slotKey || slide.slot_key || linkedSource.slotKey || linkedSource.slot_key);
    const payload = {
      index: Number(slide.index) || index + 1,
      slideKey: String(slide.slideKey || slide.slide_key || "").trim(),
      id: String(slide.id || "").trim(),
      elementId: String(slide.elementId || slide.element_id || "").trim(),
      sectionId: String(slide.sectionId || slide.section_id || "").trim(),
      sectionKey: String(slide.sectionKey || slide.section_key || "").trim(),
      slotKey,
      elementLabel: String(slide.elementLabel || slide.element_label || slide.label || "").trim(),
      type: String(slide.type || "").trim(),
      layout: String(slide.layout || "").trim(),
      elementType: String(slide.elementType || slide.element_type || "").trim(),
      title: String(slide.title || "").trim(),
      text: limitServiceDocumentText(slide.text || slide.bodyText || slide.body || ""),
      outputContext: String(slide.outputContext || slide.output_context || "").trim(),
      hidden: Boolean(slide.hidden),
      autoTrailingBlank: Boolean(slide.autoTrailingBlank || slide.auto_trailing_blank),
      linkedSource,
    };
    if (asset.name || asset.url || asset.kind) payload.asset = asset;
    if (slide.imageSrc || slide.image_src) payload.imageSrc = String(slide.imageSrc || slide.image_src || "").trim();
    if (slide.videoSrc || slide.video_src) payload.videoSrc = String(slide.videoSrc || slide.video_src || "").trim();
    if (slide.audioSrc || slide.audio_src) payload.audioSrc = String(slide.audioSrc || slide.audio_src || "").trim();
    payload.slideKey = payload.slideKey || serviceDocumentSlideKey(payload);
    return Object.fromEntries(Object.entries(payload).filter(([, value]) => {
      if (Array.isArray(value)) return value.length;
      if (value && typeof value === "object") return Object.keys(value).length;
      return value !== "" && value !== false && value != null;
    }));
  }).filter(Boolean);
}

function normalizeServiceDocumentExceptions(exceptions = []) {
  return (Array.isArray(exceptions) ? exceptions : []).map((entry) => {
    if (!entry || typeof entry !== "object") return null;
    const payload = {
      type: String(entry.type || "").trim(),
      scope: String(entry.scope || "").trim(),
      target: entry.target && typeof entry.target === "object" ? entry.target : {},
      asset: normalizeServiceAsset(entry.asset),
      reason: String(entry.reason || "").trim(),
    };
    return Object.fromEntries(Object.entries(payload).filter(([, value]) => {
      if (value && typeof value === "object") return Object.keys(value).length;
      return value !== "" && value != null;
    }));
  }).filter(Boolean);
}

function serviceDocumentRecordKey(record = {}) {
  return cleanList([
    record.slotKey || "",
    record.elementId || "",
    record.sectionKey || compactSearchValue(record.sectionTitle || ""),
    compactSearchValue(record.label || ""),
  ]).join("|");
}

function serviceDocumentSlideKey(slide = {}) {
  return cleanList([
    slide.slotKey || "",
    slide.elementId || "",
    slide.id || "",
    slide.type || "",
    slide.index ? `#${slide.index}` : "",
  ]).join("|");
}

function serviceDocumentHistoryContentSignature(document = null) {
  const content = {
    kind: document.kind || MINDEX_SERVICE_DOCUMENT_KIND,
    version: document.version || MINDEX_SERVICE_DOCUMENT_VERSION,
    serviceId: document.serviceId || "",
    serviceTypeId: document.serviceTypeId || "",
    serviceDate: document.serviceDate || "",
    serviceTitle: document.serviceTitle || "",
    serviceAlias: document.serviceAlias || "",
    sourceSignature: document.sourceSignature || "",
    slideSignature: document.slideSignature || "",
    sourceText: limitServiceDocumentText(document.sourceText || ""),
    sourceRecords: Array.isArray(document.sourceRecords) ? document.sourceRecords : [],
    slides: Array.isArray(document.slides) ? document.slides : [],
    exceptions: Array.isArray(document.exceptions) ? document.exceptions : [],
  };
  return compactTextSignature(JSON.stringify(Object.fromEntries(Object.entries(content).filter(([, value]) => {
    if (Array.isArray(value)) return value.length;
    return value !== "" && value != null;
  }))));
}

function compactServiceDocumentHistoryEntry(document = null) {
  document = normalizeServiceDocumentSnapshot(document);
  if (!document) return null;
  const records = Array.isArray(document.sourceRecords) ? document.sourceRecords : [];
  const slides = Array.isArray(document.slides) ? document.slides : [];
  const exceptions = Array.isArray(document.exceptions) ? document.exceptions : [];
  const hasArrays = Boolean(records.length || slides.length || exceptions.length);
  const payload = {
    kind: document.kind || MINDEX_SERVICE_DOCUMENT_KIND,
    version: document.version || MINDEX_SERVICE_DOCUMENT_VERSION,
    serviceId: document.serviceId || "",
    serviceTypeId: document.serviceTypeId || "",
    serviceDate: document.serviceDate || "",
    serviceTitle: document.serviceTitle || "",
    serviceAlias: document.serviceAlias || "",
    updatedAt: document.updatedAt || "",
    sourceSignature: document.sourceSignature || "",
    slideSignature: document.slideSignature || "",
    contentSignature: hasArrays ? serviceDocumentHistoryContentSignature(document) : (document.contentSignature || ""),
    sourceText: limitServiceDocumentText(document.sourceText || ""),
    sourceRecordCount: records.length || Number(document.sourceRecordCount) || 0,
    slideCount: slides.length || Number(document.slideCount) || 0,
  };
  return Object.fromEntries(Object.entries(payload).filter(([, value]) => value !== "" && value != null && value !== 0));
}

function serviceDocumentHistoryEntryKey(document = null) {
  if (!document || typeof document !== "object") return "";
  const entry = compactServiceDocumentHistoryEntry(document);
  if (!entry) return "";
  return [entry.contentSignature || `text:${entry.sourceSignature || ""}:${entry.slideSignature || ""}`, entry.sourceText || ""].join("|");
}

function trimServiceDocumentHistory(entries = []) {
  const trimmed = entries.slice(0, MINDEX_SERVICE_DOCUMENT_HISTORY_LIMIT);
  while (trimmed.length > 1 && JSON.stringify(trimmed).length > MINDEX_SERVICE_DOCUMENT_HISTORY_MAX_BYTES) {
    trimmed.pop();
  }
  return trimmed;
}

// Save payload construction and validation; RPC orchestration stays in app.js.
function validateWorshipPersistenceRows(rows = {}, context = {}) {
  const errors = [];
  const serviceId = String(context.serviceId || "").trim();
  const elementSlotByKey = new Map();
  const sectionIds = new Set();
  const elementIds = new Set();
  (rows.sections || []).forEach((section, index) => {
    if (!section?.id) errors.push(`section[${index}] id missing`);
    if (!section?.service_id) errors.push(`section[${index}] service_id missing`);
    if (serviceId && section?.service_id !== serviceId) errors.push(`section[${index}] service ownership mismatch`);
    if (section?.id && sectionIds.has(section.id)) errors.push(`section[${index}] duplicate id`);
    if (section?.id) sectionIds.add(section.id);
    if (!section?.created_at) errors.push(`section[${index}] created_at missing`);
    if (!section?.updated_at) errors.push(`section[${index}] updated_at missing`);
  });
  (rows.elements || []).forEach((element, index) => {
    const label = element?.source_ref?.label || element?.title || element?.id || `element[${index}]`;
    if (!element?.id) errors.push(`${label} id missing`);
    if (!element?.section_id) errors.push(`${label} section_id missing`);
    if (element?.section_id && !sectionIds.has(element.section_id)) errors.push(`${label} section is not in this save`);
    if (element?.id && elementIds.has(element.id)) errors.push(`${label} duplicate id`);
    if (element?.id) elementIds.add(element.id);
    if (!element?.created_at) errors.push(`${label} created_at missing`);
    if (!element?.updated_at) errors.push(`${label} updated_at missing`);
    if (!WORSHIP_DB_ELEMENT_TYPES.has(String(element?.element_type || ""))) {
      errors.push(`${label} unsupported element_type: ${element?.element_type || "(empty)"}`);
    }
    if (Object.prototype.hasOwnProperty.call(element || {}, "input_mode")) {
      const inputMode = normalizeServiceInputMode(element.input_mode) || String(element.input_mode || "").trim();
      if (!WORSHIP_DB_ELEMENT_INPUT_MODES.has(inputMode)) {
        errors.push(`${label} unsupported input_mode: ${element.input_mode || "(empty)"}`);
      }
    }
    const contentInputMode = normalizeServiceInputMode(element?.content_state?.inputMode || element?.content_state?.input_mode);
    if (contentInputMode && !WORSHIP_DB_ELEMENT_INPUT_MODES.has(contentInputMode)) {
      errors.push(`${label} unsupported content_state.inputMode: ${contentInputMode}`);
    }
    const configInputMode = normalizeServiceInputMode(element?.config?.inputMode || element?.config?.input_mode);
    if (configInputMode && !WORSHIP_DB_ELEMENT_INPUT_MODES.has(configInputMode)) {
      errors.push(`${label} unsupported config.inputMode: ${configInputMode}`);
    }
    const asset = normalizeServiceAsset(element?.asset || element?.config?.asset);
    if (hasServiceAsset(asset) && !SERVICE_ASSET_KINDS.has(asset.kind || "")) {
      errors.push(`${label} unsupported asset.kind: ${asset.kind || "(empty)"}`);
    }
    const slotKey = normalizeWorshipSlotKey(element?.slot_key || element?.source_ref?.slotKey || element?.config?.slotKey);
    if (slotKey) {
      const existing = elementSlotByKey.get(slotKey);
      if (existing && existing.id !== element?.id) {
        errors.push(`${label} 저장 위치가 ${existing.label}와 겹칩니다: ${slotKey}`);
      } else {
        elementSlotByKey.set(slotKey, { id: element?.id || "", label });
      }
    }
  });
  if (!errors.length) return;
  const prefix = serviceId ? `예배 ${serviceId} 저장 데이터가 DB 규칙과 맞지 않습니다.` : "예배 저장 데이터가 DB 규칙과 맞지 않습니다.";
  throw new Error(`${prefix} ${errors.slice(0, 4).join(" / ")}`);
}

function sanitizeWorshipPersistenceRows(rows = {}, options = {}) {
  const persistedAt = new Date().toISOString();
  const hasInputModeColumn = Boolean(options.elementTypedStateColumns?.inputMode);
  (rows.sections || []).forEach((section) => {
    if (!section || typeof section !== "object") return;
    section.created_at = section.created_at || persistedAt;
    section.updated_at = section.updated_at || persistedAt;
    section.source_ref = section.source_ref && typeof section.source_ref === "object" ? section.source_ref : {};
    section.config = section.config && typeof section.config === "object" ? section.config : {};
  });
  (rows.elements || []).forEach((element) => {
    if (!element || typeof element !== "object") return;
    element.created_at = element.created_at || persistedAt;
    element.updated_at = element.updated_at || persistedAt;
    element.element_type = worshipDbElementTypeForSave(element.element_type) || "plain_text";
    if (!element.song_id) element.song_version_id = null;
    element.asset = normalizeServiceAsset(element.asset || element.config?.asset);
    element.source_ref = element.source_ref && typeof element.source_ref === "object" ? element.source_ref : {};
    element.config = element.config && typeof element.config === "object" ? element.config : {};
    const sourceSlotKey = normalizeWorshipSlotKey(element.source_ref.slotKey || element.source_ref.slot_key);
    if (sourceSlotKey) element.source_ref.slotKey = sourceSlotKey;
    delete element.source_ref.slot_key;
    const configSlotKey = normalizeWorshipSlotKey(element.config.slotKey || element.config.slot_key);
    if (configSlotKey) element.config.slotKey = configSlotKey;
    delete element.config.slot_key;
    const columnSlotKey = normalizeWorshipSlotKey(element.slot_key || sourceSlotKey || configSlotKey);
    if (columnSlotKey) element.source_ref.slotKey = columnSlotKey;
    delete element.slot_key;
    if (Object.prototype.hasOwnProperty.call(element.config, "input_mode")) {
      const configMode = normalizeServiceInputMode(element.config.input_mode);
      if (configMode) element.config.inputMode = configMode;
      delete element.config.input_mode;
    }
    if (Object.prototype.hasOwnProperty.call(element.config, "inputMode")) {
      const configMode = normalizeServiceInputMode(element.config.inputMode);
      if (configMode) element.config.inputMode = configMode;
      else delete element.config.inputMode;
    }
    if (element.content_state && typeof element.content_state === "object") {
      const contentMode = normalizeServiceInputMode(element.content_state.inputMode || element.content_state.input_mode);
      if (contentMode) element.content_state.inputMode = contentMode;
      delete element.content_state.input_mode;
    }
    sanitizeSongContentStateWithoutSong(element.content_state, element);
    sanitizeSongContentStateWithoutSong(element.config.contentState, element);
    if (hasInputModeColumn) element.input_mode = worshipDbInputModeForSave(element.input_mode || element.content_state?.inputMode || element.config.inputMode);
    else delete element.input_mode;
  });
  return rows;
}

function sanitizeSongContentStateWithoutSong(contentState = null, element = {}) {
  if (!contentState || typeof contentState !== "object" || element?.song_id) return;
  const inputMode = normalizeServiceInputMode(
    contentState.inputMode
    || contentState.input_mode
    || element.input_mode
    || element.config?.inputMode
    || element.config?.input_mode,
  );
  if (!["praise_db", "score_db", "lyrics_db"].includes(inputMode)) return;
  if (contentState.state !== "filled" || contentState.reason !== "song") return;
  contentState.state = "missing";
  contentState.reason = String(element.title || "").trim() ? "song_selection_required" : "song_empty";
  contentState.inputMode = inputMode;
  contentState.required = true;
}

function compactWorshipPersistenceRows(rows = {}) {
  const compactById = (sourceRows = []) => {
    const byId = new Map();
    sourceRows.forEach((row) => {
      const id = String(row?.id || "").trim();
      if (!id) return;
      byId.set(id, { ...(byId.get(id) || {}), ...row });
    });
    return [...byId.values()];
  };
  rows.sections = compactById(rows.sections);
  rows.elements = compactById(rows.elements);
  return rows;
}

// Full saves append preserved/hidden template rows after the visible document.
// Give that final payload a deterministic, unique order so old suppression
// markers cannot leave an ambiguous database order behind.
function normalizeWorshipPersistenceSortOrders(rows = {}) {
  const sections = Array.isArray(rows.sections) ? rows.sections : [];
  const elements = Array.isArray(rows.elements) ? rows.elements : [];
  sections.forEach((section, index) => {
    if (section && typeof section === "object") section.sort_order = index + 1;
  });
  const elementOrders = new Map();
  elements.forEach((element) => {
    const sectionId = String(element?.section_id || "").trim();
    if (!sectionId || !element || typeof element !== "object") return;
    const nextOrder = (elementOrders.get(sectionId) || 0) + 1;
    elementOrders.set(sectionId, nextOrder);
    element.sort_order = nextOrder;
  });
  return rows;
}

function worshipElementPersistenceSlotKey(element = {}) {
  return normalizeWorshipSlotKey(
    element.slot_key
    || element.source_ref?.slotKey
    || element.source_ref?.slot_key
    || element.config?.slotKey
    || element.config?.slot_key,
  );
}

function worshipElementHasPersistedContent(element = {}) {
  const asset = normalizeServiceAsset(element.asset || element.config?.asset);
  const contentState = element.content_state && typeof element.content_state === "object"
    ? element.content_state
    : {};
  return Boolean(
    element.song_id
    || element.song_version_id
    || String(element.title || "").trim()
    || String(element.person || "").trim()
    || String(element.body || "").trim()
    || String(element.scripture_reference || "").trim()
    || hasServiceAsset(asset)
    || contentState.state === "filled"
  );
}

function shouldPreserveExistingWorshipElement(element = {}) {
  if (!element?.id) return false;
  if (element.config?.templateSuppressed || element.config?.template_suppressed) return false;
  return worshipElementHasPersistedContent(element);
}

function preserveExistingWorshipContentRows(rows = {}, existingSections = [], existingElements = []) {
  const nextElementIds = new Set((rows.elements || []).map((element) => element.id).filter(Boolean));
  const suppressedSlotKeys = new Set((rows.elements || [])
    .filter((element) => element.config?.templateSuppressed || element.config?.template_suppressed)
    .map(worshipElementPersistenceSlotKey).filter(Boolean));
  const nextSectionIds = new Set((rows.sections || []).map((section) => section.id).filter(Boolean));
  const existingSectionById = Object.fromEntries(existingSections.map((section) => [section.id, section]));
  existingElements.forEach((element) => {
    if (nextElementIds.has(element.id) || !shouldPreserveExistingWorshipElement(element)) return;
    // Projected deletion markers can have a different ID from the stored row.
    // The explicit deletion belongs to the slot, not just that transient ID.
    if (suppressedSlotKeys.has(worshipElementPersistenceSlotKey(element))) return;
    const section = existingSectionById[element.section_id];
    if (section && !nextSectionIds.has(section.id)) {
      rows.sections.push(section);
      nextSectionIds.add(section.id);
    }
    rows.elements.push(element);
    nextElementIds.add(element.id);
    const slotKey = worshipElementPersistenceSlotKey(element);
    console.warn("Preserved existing worship content row omitted from save payload.", {
      id: element.id,
      slotKey,
      title: element.title || "",
    });
  });
  return rows;
}

function isUnmodifiedTemplatePlaceholder(item = {}) {
  return Boolean(
    item._worshipTemplateProjected
    && item._worshipTemplatePlaceholder
    && !item._worshipSectionTemplateModified
    && !item._worshipElementTemplateModified,
  );
}

function ensureUniqueServiceItemPersistenceIds(items = []) {
  const seen = new Set();
  return items.map((item) => {
    const id = String(item?.id || "").trim();
    if (!isUuid(id) || !seen.has(id)) {
      if (id) seen.add(id);
      return item;
    }
    const next = {
      ...item,
      id: createUuid(),
      _worshipElementTemplateModified: true,
      _worshipTemplatePlaceholder: false,
    };
    seen.add(next.id);
    return next;
  });
}

// Reprojection may replace a temporary ID, but it must not create a second
// database row for the same template slot. Never steal another visible item's ID.
function existingElementForWorshipSave(service, item, items, sections, elements) {
  if (isUuid(item.id) && elements[item.id]) return elements[item.id];
  if (!item._worshipTemplateProjected) return null;
  const slotKey = serviceItemSlotKey(item);
  if (!slotKey) return null;
  const claimedIds = new Set(items.filter((other) => other !== item).map((other) => other.id));
  const candidates = Object.values(elements).filter((element) =>
    sections[element.section_id]?.service_id === service.id
    && worshipElementPersistenceSlotKey(element) === slotKey
    && !(element.config?.templateSuppressed || element.config?.template_suppressed)
    && !claimedIds.has(element.id));
  return candidates.length === 1 ? candidates[0] : null;
}

// An explicit active replacement supersedes an older deletion marker for that
// slot. Two active bodies still fail validation; neither may be discarded.
function removeSupersededWorshipSuppressionRows(rows = {}) {
  const activeSlots = new Set((rows.elements || [])
    .filter((row) => !(row.config?.templateSuppressed || row.config?.template_suppressed))
    .map(worshipElementPersistenceSlotKey).filter(Boolean));
  rows.elements = (rows.elements || []).filter((row) =>
    !(row.config?.templateSuppressed || row.config?.template_suppressed)
    || !activeSlots.has(worshipElementPersistenceSlotKey(row)));
  return rows;
}

function buildWorshipPersistenceRows(service, items, existingSectionById = {}, existingElementById = {}, options = {}) {
  const sectionRows = [];
  const elementRows = [];
  const sectionSort = new Map();
  const sectionElementCounts = new Map();
  const generatedSectionIds = new Map();
  const usedElementIds = new Set();
  const persistedAt = new Date().toISOString();

  items.forEach((item, index) => {
    const existingElement = existingElementForWorshipSave(service, item, items, existingSectionById, existingElementById);
    const targetSection = isUuid(item._worshipSectionId) ? existingSectionById[item._worshipSectionId] : null;
    const existingElementSection = existingElement
      ? existingSectionById[existingElement.section_id]
      : null;
    const requestedSectionKey = String(item._worshipSectionKey || "").trim();
    // An item can be reclassified into a different template section. In that
    // case, retaining the element's old section silently moves the new label
    // back into the old group on every save.
    const existingSection = targetSection || (
      existingElementSection
      && (!requestedSectionKey || existingElementSection.section_key === requestedSectionKey)
        ? existingElementSection
        : null
    );
    const projectedSectionKey = (
      item._worshipTemplateProjected
        ? [item._worshipSectionKey, item._worshipSectionTitle, item._worshipSectionOrder]
        : [item._worshipSectionId, item._worshipSectionKey, item._worshipSectionTitle]
    ).map((value) => String(value || "").trim()).filter(Boolean).join(":") || `item:${index}`;
    const deterministicSectionId = item._worshipTemplateProjected && service?.id
      ? createDeterministicUuid(`worship:${service.id}:section:${projectedSectionKey}`)
      : "";
    const sectionId = existingSection?.id
      || generatedSectionIds.get(projectedSectionKey)
      || deterministicSectionId
      || createUuid();
    if (!existingSection) generatedSectionIds.set(projectedSectionKey, sectionId);
    const deterministicElementId = item._worshipTemplateProjected && service?.id
      ? createDeterministicUuid(`worship:${service.id}:element:${projectedSectionKey}:${Number(item._worshipElementOrder) || 0}`)
      : "";
    let elementId = existingElement?.id || deterministicElementId || createUuid();
    if (usedElementIds.has(elementId)) elementId = createUuid();
    usedElementIds.add(elementId);
    if (!sectionSort.has(sectionId)) sectionSort.set(sectionId, sectionSort.size + 1);
    sectionElementCounts.set(sectionId, (sectionElementCounts.get(sectionId) || 0) + 1);

    // Keep positional counters, but do not rebuild unrelated drafts for a patch.
    if (options.targetElementId && item.id !== options.targetElementId) return;

    const sectionModified = Boolean(existingSection?.template_modified || item._worshipSectionTemplateModified);
    const sectionLabel = String(
      (item._worshipSectionTitle || existingSection?.title)
      || item.label
      || "",
    ).trim() || "섹션";
    const existingSectionRef = existingSection?.source_ref && typeof existingSection.source_ref === "object" ? existingSection.source_ref : {};
    const existingSectionConfig = existingSection?.config && typeof existingSection.config === "object" ? existingSection.config : {};
    if (!sectionRows.some((section) => section.id === sectionId)) {
      sectionRows.push({
        id: sectionId,
        service_id: service.id,
        created_at: existingSection?.created_at || persistedAt,
        updated_at: persistedAt,
        sort_order: sectionSort.get(sectionId),
        section_key: sectionModified ? (existingSection?.section_key || item._worshipSectionKey || "") : (item._worshipSectionKey || existingSection?.section_key || ""),
        title: sectionLabel,
        template_id: existingSection?.template_id || null,
        template_modified: sectionModified,
        source_kind: existingSection?.source_kind || "mindex",
        source_ref: { ...existingSectionRef, label: sectionLabel },
        config: existingSectionConfig,
      });
    }

    const existingSourceRef = existingElement?.source_ref && typeof existingElement.source_ref === "object" ? existingElement.source_ref : {};
    const existingConfig = existingElement?.config && typeof existingElement.config === "object" ? existingElement.config : {};
    const parsed = parseServiceItemMemo(item.memo);
    const elementType = serviceElementTypeForSave(item, parsed, existingElement);
    const scriptureBody = isScriptureBodyServiceItem(item) || normalizeWorshipElementType(elementType) === "scripture_body";
    const manualBody = serviceItemManualBodyForSave(item, parsed, elementType);
    const config = serviceElementConfigForSave(existingConfig, parsed, {
      item,
      service,
      omitSlides: Boolean(manualBody) || scriptureBody,
    });
    const asset = normalizeServiceAsset(parsed.asset || existingElement?.asset || existingConfig.asset);
    const sourceRefBase = serviceElementSourceRefForSave(existingSourceRef, item, parsed, Boolean(manualBody));
    const contentState = serviceElementContentStateForSave(item, parsed, service);
    const slotKey = deriveWorshipSlotKey({
      item,
      parsed,
      element: existingElement,
      sourceRef: sourceRefBase,
      config,
      sectionKey: item._worshipSectionKey || existingSection?.section_key || "",
      label: item.label,
      elementType,
      inputMode: contentState.inputMode,
      asset,
      contentState,
    });
    const sourceRef = slotKey ? { ...sourceRefBase, slotKey } : sourceRefBase;
    const scriptureReferences = scriptureBody
      ? serviceItemScriptureReferences(item, parsed, service)
      : [];
    const scriptureReference = scriptureBody
      ? (scriptureReferences[0] || normalizeServiceItemReferenceSpacing(parsed.scriptureReference || item.raw_title || (isOptionalCitationScriptureServiceItem(item) ? "" : existingElement?.scripture_reference) || ""))
      : (existingElement?.scripture_reference || "");
    const elementRow = {
      id: elementId,
      section_id: sectionId,
      // The table does not supply a database default. New projected elements
      // therefore need both audit timestamps in the client payload.
      created_at: existingElement?.created_at || persistedAt,
      updated_at: persistedAt,
      sort_order: sectionElementCounts.get(sectionId),
      element_type: worshipDbElementTypeForSave(elementType) || "plain_text",
      title: scriptureBody ? formatServiceScriptureReferenceList(scriptureReferences) || scriptureReference : (manualBody ? String(item.raw_title || "").trim() : serviceElementTitleForSave(item, elementType)),
      person: cleanServiceAssignee(item.assignee),
      body: manualBody || "",
      song_id: item.song_id || null,
      song_version_id: serviceItemSongVersionIdForSave(item, service),
      scripture_id: existingElement?.scripture_id || null,
      scripture_reference: scriptureReference,
      asset,
      template_id: existingElement?.template_id || null,
      template_modified: Boolean(existingElement?.template_modified || item._worshipElementTemplateModified),
      source_kind: manualBody ? "manual" : (existingElement?.source_kind || (item.song_id ? "mindex" : "manual")),
      source_ref: sourceRef,
      review_status: existingElement?.review_status || (manualBody ? "needs_review" : "draft"),
      config,
    };
    if (options.elementTypedStateColumns?.inputMode) elementRow.input_mode = worshipDbInputModeForSave(contentState.inputMode);
    if (options.elementTypedStateColumns?.contentState) elementRow.content_state = contentState;
    elementRows.push(elementRow);
  });

  sectionRows.forEach((section) => {
    section.sort_order = sectionSort.get(section.id) || section.sort_order;
  });
  return { sections: sectionRows, elements: elementRows };
}

function serviceElementContentStateForSave(item = {}, parsed = parseServiceItemMemo(item.memo), service = null) {
  const contentState = resolvePresenterServiceItemContentState(
    item,
    parsed,
    serviceItemLinkedSong(item),
    service,
  );
  const praiseInputMode = servicePraiseInputMode(item, parsed, service);
  const inputMode = praiseInputMode === "manual_praise"
    ? (serviceItemAllowsManualSongText(item, service) ? "manual_praise" : "lyrics_db")
    : contentState.inputMode;
  return {
    state: contentState.state,
    reason: contentState.reason,
    inputMode,
    elementType: contentState.elementType,
    required: Boolean(contentState.required),
  };
}

function serviceItemManualBodyForSave(item = {}, parsed = parseServiceItemMemo(item.memo), elementType = "") {
  if (item.song_id) return "";
  const normalizedType = normalizeWorshipElementType(elementType);
  if (normalizedType === "scripture_body" || isScriptureBodyServiceItem(item)) return "";
  if (!["praise", "plain_text", "body"].includes(normalizedType)) return "";
  if (parsed.slides.length) return parsed.slides.join("\n\n");
  return "";
}

function serviceElementTypeForSave(item = {}, parsed = parseServiceItemMemo(item.memo), existingElement = null) {
  const explicit = serviceMemoElementType(parsed);
  if (explicit) return explicit;
  if (!item.song_id && (isSongServiceLabel(item.label) || isSpecialSongServiceItem(item)) && parsed.slides.length) return "praise";
  return normalizeWorshipElementType(existingElement?.element_type) || worshipTemplateElementType({}, item.label);
}

function worshipDbElementTypeForSave(elementType = "") {
  const type = normalizeWorshipElementType(elementType) || normalizeServiceElementType(elementType);
  if (type === "title" || type === "title_content") return "plain_text";
  if (type === "file" || type === "template") return "ppt";
  if (type === "scripture") return "scripture_reading";
  if (type === "live_praise") return "praise";
  if (type === "live_scripture") return "plain_text";
  if (type === "audio") return "plain_text";
  return type;
}

function serviceElementTitleForSave(item = {}, elementType = "") {
  const rawTitle = independentServiceContentTitle(item.label, item.raw_title, serviceMemoElementType(parseServiceItemMemo(item.memo)) || elementType);
  if (item.song_id && (isSongServiceLabel(item.label) || isSpecialSongServiceItem(item))) return "";
  if (["video", "image", "score", "audio", "file"].includes(normalizeServiceElementType(elementType))) {
    const parsed = parseServiceItemMemo(item.memo);
    return parsed.asset?.name || rawTitle;
  }
  return rawTitle;
}

function serviceElementConfigForSave(existingConfig = {}, parsed = emptyServiceItemMemo(), options = {}) {
  const config = { ...(existingConfig && typeof existingConfig === "object" ? existingConfig : {}) };
  if (parsed.benedictionReplacement) config.benedictionReplacement = parsed.benedictionReplacement;
  else delete config.benedictionReplacement;
  const outputMode = serviceItemUsesFlexibleOfferingSlot(options.item) && !serviceItemUsesScoreInputMode(options.item, parsed)
    ? ""
    : parsed.outputMode;
  const contentState = serviceElementContentStateForSave(options.item || {}, parsed, options.service || null);
  delete config.slides;
  delete config.slideOverrides;
  delete config.slide_overrides;
  if (parsed.note) config.note = parsed.note;
  else delete config.note;
  if (parsed.formHint) {
    config.formHint = parsed.formHint;
    delete config.form_hint;
  } else {
    delete config.formHint;
    delete config.form_hint;
  }
  if (parsed.formPreset) {
    config.formPreset = parsed.formPreset;
    delete config.form_preset;
  } else {
    delete config.formPreset;
    delete config.form_preset;
  }
  if (parsed.formPresetRules?.length) {
    config.formPresetRules = parsed.formPresetRules;
    delete config.form_preset_rules;
  } else {
    delete config.formPresetRules;
    delete config.form_preset_rules;
  }
  if (parsed.formPresetDisabled) {
    config.formPresetDisabled = true;
    delete config.formHint;
    delete config.form_hint;
    delete config.formPreset;
    delete config.form_preset;
    delete config.formPresetRules;
    delete config.form_preset_rules;
    delete config.form_preset_disabled;
    delete config.disableFormPreset;
    delete config.disable_form_preset;
  } else {
    delete config.formPresetDisabled;
    delete config.form_preset_disabled;
    delete config.disableFormPreset;
    delete config.disable_form_preset;
  }
  if (hasServiceIntroSlide(parsed.introSlide)) config.introSlide = normalizeServiceIntroSlide(parsed.introSlide);
  else {
    delete config.introSlide;
    delete config.intro_slide;
    delete config.titleSlide;
    delete config.title_slide;
  }
  if (outputMode) config.outputMode = outputMode;
  else delete config.outputMode;
  if (contentState.inputMode) config.inputMode = contentState.inputMode;
  else {
    delete config.inputMode;
    delete config.input_mode;
  }
  if (isMonthlyCorporatePrayerGroupItem(options.item || {}, parsed)) {
    config.corporatePrayers = monthlyCorporatePrayerEntries(options.item, parsed);
    config.templateKey = "monthly_corporate_prayer_group";
  } else if (parsed.corporatePrayers?.length) {
    config.corporatePrayers = parsed.corporatePrayers;
    if (parsed.templateKey === "monthly_corporate_prayer_group") config.templateKey = parsed.templateKey;
  }
  config.contentState = {
    state: contentState.state,
    reason: contentState.reason,
    inputMode: contentState.inputMode,
    elementType: contentState.elementType,
    required: Boolean(contentState.required),
  };
  if (parsed.scriptureReferences?.length) config.scriptureReferences = [...parsed.scriptureReferences];
  else {
    delete config.scriptureReferences;
    delete config.scripture_references;
  }
  if (isOptionalCitationScriptureServiceItem(options.item || {})) {
    delete config.scriptureReference;
    delete config.scripture_reference;
    delete config.scripture_references;
  }
  if (parsed.scriptureTranslationId) {
    config.scriptureTranslationId = parsed.scriptureTranslationId;
    delete config.scripture_translation_id;
  } else {
    delete config.scriptureTranslationId;
    delete config.scripture_translation_id;
  }
  if (parsed.scriptureReferencePayloads?.length) {
    config.scriptureReferencePayloads = normalizeServiceScriptureReferencePayloads(parsed.scriptureReferencePayloads, parsed.scriptureReferences);
    delete config.scripture_reference_payloads;
  } else {
    delete config.scriptureReferencePayloads;
    delete config.scripture_reference_payloads;
  }
  if (parsed.manualScripture) {
    config.manualScripture = parsed.manualScripture;
    delete config.manual_scripture;
  } else {
    delete config.manualScripture;
    delete config.manual_scripture;
  }
  delete config.content_state;
  if (parsed.textHighlights?.length) config.textHighlights = parsed.textHighlights;
  else {
    delete config.textHighlights;
    delete config.text_highlights;
    delete config.highlights;
  }
  if (parsed.elementType) config.elementType = parsed.elementType;
  else {
    delete config.elementType;
    delete config.element_type;
    delete config.componentType;
    delete config.component_type;
  }
  if (hasServiceAsset(parsed.asset)) {
    config.asset = parsed.asset;
  } else if (hasServiceAsset(config.asset)) {
    config.asset = normalizeServiceAsset(config.asset);
  } else {
    delete config.asset;
  }
  if (hasServiceAsset(parsed.audioAsset)) config.audioAsset = parsed.audioAsset;
  else {
    delete config.audioAsset;
    delete config.audio_asset;
  }
  if (hasServicePlaybackConfig(parsed.playback)) config.playback = parsed.playback;
  else delete config.playback;
  if (parsed.presenterRole) config.presenterRole = parsed.presenterRole;
  else {
    delete config.presenterRole;
    delete config.presenter_role;
    delete config.role;
  }
  if (parsed.connectedPraise) {
    config.connectedPraise = parsed.connectedPraise;
    delete config.connected_praise;
  } else {
    delete config.connectedPraise;
    delete config.connected_praise;
  }
  if (isOptionalCitationScriptureServiceItem(options.item || {})) {
    delete config.hiddenInPresentation;
    delete config.hidden_in_presentation;
    delete config.hidden;
  } else if (parsed.hiddenInPresentation) config.hiddenInPresentation = true;
  else delete config.hiddenInPresentation;
  if (!options.omitSlides && parsed.slides.length) config.slides = parsed.slides;
  return config;
}

function serviceElementSourceRefForSave(existingSourceRef = {}, item = {}, parsed = emptyServiceItemMemo(), manualBody = false) {
  const sourceRef = { ...(existingSourceRef && typeof existingSourceRef === "object" ? existingSourceRef : {}) };
  if (isOptionalCitationScriptureServiceItem(item)) {
    delete sourceRef.scriptureReferences;
    delete sourceRef.scripture_references;
    delete sourceRef.scriptureReference;
    delete sourceRef.scripture_reference;
  }
  const itemSlotKey = normalizeWorshipSlotKey(item._worshipSlotKey || item.slotKey || item.slot_key);
  if (itemSlotKey) sourceRef.slotKey = itemSlotKey;
  sourceRef.label = String(item.label || sourceRef.label || "").trim();
  if (parsed.connectedPraise) {
    sourceRef.connectedPraise = parsed.connectedPraise;
    delete sourceRef.connected_praise;
  } else {
    delete sourceRef.connectedPraise;
    delete sourceRef.connected_praise;
  }
  if (manualBody) {
    sourceRef.content_source = sourceRef.content_source || "manual_worship_element_body";
    sourceRef.note = sourceRef.note || "일회성 예배 본문은 Praise DB가 아니라 Worship element body에 보관";
  }
  return sourceRef;
}
