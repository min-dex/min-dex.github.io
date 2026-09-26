const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const source = fs.readFileSync(path.join(__dirname, "..", "app.js"), "utf8");
const action = source.match(/function runPresenterAction\([\s\S]*?\n}\n\nfunction setPresenterPendingSlide/);

assert.ok(action, "presenter action handler should exist");
const liveClear = action[0].indexOf("if (presenterControllerIsLive(serviceId)) clearPresenterBoardSelection({ render: false });");
const navigation = action[0].indexOf("preparePresenterNavigation(serviceId);");
assert.ok(liveClear >= 0 && liveClear < navigation,
  "live controller navigation should clear stale offline board selection first");

console.log("Live presenter navigation clears offline board selection");
