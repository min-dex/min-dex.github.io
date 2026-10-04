const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const source = fs.readFileSync(path.join(root, "app.js"), "utf8");
const sql = fs.readFileSync(path.join(root, "scripts/worship-schema.sql"), "utf8");
const select = source.match(/const WORSHIP_SECTION_LIST_SELECT = ([\s\S]*?)\.join\(","\);/);
assert.ok(select, "Section list query must be checked from the actual app");
const columns = vm.runInNewContext(select[1]);
const definition = sql.match(/create table if not exists public\.mindex_worship_sections \(([\s\S]*?)\n\);/i);
assert.ok(definition, "Canonical section schema must exist");
const schemaColumns = new Set([...definition[1].matchAll(/^  ([a-z_]+)\s/gm)].map(match => match[1]));
for (const column of columns) {
  assert.ok(schemaColumns.has(column), `Section query requests missing column: ${column}`);
}
assert.ok(!columns.includes("person"), "Person belongs to elements, not sections");
assert.ok(source.includes('const WORSHIP_ELEMENT_BASE_LIST_SELECT = ['), "Element query remains separate");
console.log("Worship section select matches canonical schema");
