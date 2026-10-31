// Use after tools/broadcast-engine/build-mac.sh. Missing resources fail the build.
const fs = require('node:fs');
const path = require('node:path');
const base = require('./electron-builder.test.cjs');
const from = path.join(__dirname, '.cache/engine-stage/mindex-receiver');
for (const file of ['mindex-receiver','ffmpeg']) fs.accessSync(path.join(from,file), fs.constants.X_OK);
module.exports = {...base, extraMetadata:{...base.extraMetadata,mindexLocalEncoder:true},
  extraResources:[{from,to:'broadcast-engine'}]};
