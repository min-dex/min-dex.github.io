// Hash gate needs only Node; the optional pinned minifier is not a setup dependency.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const crypto = require('node:crypto');
const zlib = require('node:zlib');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const read = name => fs.readFileSync(path.join(root, name));
const sha = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const metadata = JSON.parse(read('app.runtime.json'));
const html = read('index.html').toString();
const version = html.match(/const fallbackVersion = "([^"]+)"/)[1];
const compiled = html.match(/const compiledAppVersion = "([^"]+)"/)[1];
const runtime = read('app.runtime.js');
assert.equal(metadata.version, compiled);
assert.equal(sha(runtime), metadata.runtime_sha256);
assert.equal(runtime.length, metadata.runtime_bytes);
assert.equal(zlib.gzipSync(runtime).length, metadata.runtime_gzip);
assert.equal(metadata.generator, 'terser@5.44.0');
assert.equal(metadata.options.compress, false);
assert.equal(metadata.options.mangle.toplevel, false);
assert.ok(html.includes('path === "app.js" && version === compiledAppVersion'));
if (version === compiled) {
  const source = read('app.js');
  assert.equal(sha(source), metadata.source_sha256, 'Active runtime is stale: regenerate with tools/build_app_runtime.cjs');
  assert.ok(metadata.runtime_gzip < zlib.gzipSync(source).length * 0.85);
  for (const [, name] of source.toString().matchAll(/\bfunction\s+([\w$]+)\s*\(/g)) {
    assert.ok(runtime.includes(Buffer.from('function ' + name + '(')), 'Named function lost: ' + name);
  }
}
assert.ok(JSON.parse(read('package.json')).build.files.includes('app.runtime.js'));
console.log('PASS runtime hashes, release-safe mapping, public names and gzip budget');
