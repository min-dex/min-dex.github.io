const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const sandbox = vm.createContext({});
vm.runInContext(fs.readFileSync("mindex.worship-input.js", "utf8"), sandbox);
vm.runInContext(`
const service = {id:"service"};
const original = [{id:"a",song_id:"old",sort_order:1,memo:"form"}, {id:"b",sort_order:2}];
const picked = [{...original[0],song_id:"new"}, original[1]];
const pick = rememberServiceEdit(service, serviceEditSnapshot(original.slice(0,1),servicePickFields), picked.slice(0,1),servicePickFields);
const moves = [{...picked[1],sort_order:1}, {...picked[0],sort_order:2}];
const move = rememberServiceEdit(service, serviceEditSnapshot(picked,serviceMoveFields), moves,serviceMoveFields);
const current = [moves[0],{...moves[1], memo:"modified lyrics/medley/audio"}];
const reversed = reverseServiceEdit(move,current);
globalThis.result = [
  reversed[0].id, reversed[0].memo, reverseServiceEdit(pick,reversed)[0].song_id,
  reverseServiceEdit(move,picked), reverseServiceEdit(pick,[{...picked[0],song_id:"else"}]),
  current[1].sort_order, serviceEditHistory.get(service).length
];
`, sandbox);
assert.deepEqual(Array.from(sandbox.result), ["a","modified lyrics/medley/audio","old",null,null,2,2]);
console.log("PASS: scoped song/order inverses retain later lyrics/media edits and refuse divergent targets");
