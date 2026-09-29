const assert = require('node:assert/strict');
const fs = require('node:fs');

const index = fs.readFileSync('index.html', 'utf8');
const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
const app = fs.readFileSync('app.js', 'utf8');
const input = fs.readFileSync('mindex.worship-input.js', 'utf8');
const runtimeSources = [
  'mindex.constants.js',
  'mindex.worship-model.js',
  'mindex.worship-persistence.js',
  'mindex.presenter.js',
  'app.js',
].map((path) => ({ path, source: fs.readFileSync(path, 'utf8') }));

const extractedHandlers = [
  'handleServiceManagementDetailClick',
  'handleDetailServiceWorkspaceClick',
  'handleServiceItemDetailClick',
  'handleServiceNavigationDetailClick',
  'updateServiceMetaField',
  'syncSundayAfternoonDedicationSlots',
  'updateNewServiceFormField',
  'updateServiceItemField',
  'applyServiceItemMetadataField',
];

for (const name of extractedHandlers) {
  assert.match(input, new RegExp(`function ${name}\\b`), `${name} must remain in the input module`);
  assert.doesNotMatch(app, new RegExp(`function ${name}\\b`), `${name} must not be duplicated in app.js`);
}

for (const name of [
  'handleServiceManagementDetailClick',
  'handleDetailServiceWorkspaceClick',
  'handleServiceItemDetailClick',
  'handleServiceNavigationDetailClick',
]) {
  assert.match(app, new RegExp(`if \\(${name}\\(event\\)\\) return;`), `${name} must remain in the detail click chain`);
}

assert.ok(index.indexOf('"mindex.worship-input.js"') < index.indexOf('"app.js"'), 'input module must load before app.js');
assert.ok(index.indexOf('"mindex.presenter.js"') < index.indexOf('"mindex.worship-input.js"'), 'presenter helpers must load before the input module');
assert.ok(packageJson.build.files.includes('mindex.worship-input.js'), 'Electron package must include the input module');

const runtimeReferences = [
  'state', 'refs', 'linkedSongLoadPromises',
  'renderCurrentServiceModuleDetail', 'createService', 'startNewServiceForm', 'openServicePrepEditor', 'closeServicePrepEditor',
  'confirmDiscardServiceChanges', 'renderServiceList', 'syncBrowserHistory', 'loadWorshipSetlistArchive', 'selectService',
  'deleteService', 'runServiceDefaultItemAction', 'setServiceBenedictionReplacement', 'copyText', 'serviceSourceTextForEditor',
  'applyServiceSourceText', 'restoreServiceSourceHistory', 'restoreServiceSourceRecovery', 'commitServiceItemInputs',
  'runServiceItemAction', 'runServiceMusicAction', 'runLiveScriptureAction', 'jumpPresenterToSlideInput',
  'createPraiseSongFromServiceItem', 'selectServiceSongForItem', 'clearServiceSongForItem', 'canUseClientData',
  'loadSongsForIdsInBackground', 'runServiceBulletinAction', 'openHomeNextService', 'worshipAppServiceTypeId',
  'markServiceStructureDirty', 'refreshPresenterForService', 'updateSaveState', 'serviceUsesPraiseLeader',
  'defaultServicePraiseLeader', 'getServiceItems', 'serviceItemPersistenceSignature', 'markServiceItemSharedContentDirty',
  'serviceItemRequiresSongSelection', 'normalizeServiceItemRawTitleForItem', 'clearGeneratedServiceScriptureSlides',
  'isScriptureBodyServiceItem', 'serviceItemSupportsScriptureReferenceList', 'normalizeServiceScriptureReferenceList',
  'normalizeServiceItemReferenceSpacing', 'normalizeServiceScriptureReferencePayloads', 'isOptionalCitationScriptureServiceItem',
  'formatServiceScriptureReferenceList', 'isLiturgicalBodyServiceItem', 'serviceItemUsesFlexibleOfferingSlot',
  'serviceItemUsesScoreInputMode', 'serializeServiceItemMemo', 'applyServiceSongSelectionWithService',
  'scheduleServiceScriptureBodyResolve', 'serviceItemLinkedSong', 'serviceSelectableSongVersions', 'parseServiceItemMemo',
  'updateServiceScriptureReferencePayload', 'serviceBibleTranslationById', 'normalizeServiceManualScripture',
  'parseServiceManualScriptureInput', 'servicePraiseInputMode', 'servicePraiseInputModeOutputMode',
  'isMonthlyCorporatePrayerGroupItem', 'monthlyCorporatePrayerEntries', 'normalizeServiceItemRawTitle',
  'applyServiceSongSelection', 'applyServicePreparationDefaults', 'normalizeServiceItemsInCurrentOrder',
  'markServiceElementDirty', 'schedulePresenterRefreshForService', 'selectedServiceForEditor',
  'SERVICE_TEMPLATES_PANEL_ID', 'SERVICE_SETLIST_ARCHIVE_PANEL_ID',
];

for (const name of runtimeReferences) {
  const declaration = new RegExp(`(?:^|\\n)\\s*(?:(?:async\\s+)?function\\s+${name}\\s*\\(|(?:const|let|var)\\s+${name}\\b)`, 'm');
  assert.ok(runtimeSources.some(({ source }) => declaration.test(source)), `input module reference ${name} must be declared by the runtime modules`);
}

console.log(`PASS worship input module contract (${extractedHandlers.length} extracted handlers, ${runtimeReferences.length} runtime references)`);
