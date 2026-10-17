// Optional pinned build tools; not part of setup or the default test environment:
// pnpm --dir tools/builddeps --ignore-workspace install --frozen-lockfile --ignore-scripts
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const zlib = require('node:zlib');
const { minify } = require('./builddeps/node_modules/terser');
const root = path.resolve(__dirname, '..');
const sha = bytes => crypto.createHash('sha256').update(bytes).digest('hex');

(async () => {
  const source = fs.readFileSync(path.join(root, 'app.js'), 'utf8');
  // Keep top-level APIs, named functions/classes and properties. No optimizer.
  const options = {
    compress: false,
    mangle: { toplevel: false, keep_fnames: true, keep_classnames: true },
    keep_fnames: true,
    keep_classnames: true,
    format: { comments: /@license|@preserve|^!/ },
  };
  const result = await minify(source, options);
  const code = result.code + '\n';
  const htmlPath = path.join(root, 'index.html');
  let html = fs.readFileSync(htmlPath, 'utf8');
  const version = html.match(/const fallbackVersion = "([^"]+)"/)[1];
  const constant = `        const compiledAppVersion = "${version}";`;
  if (html.includes('const compiledAppVersion =')) {
    html = html.replace(/        const compiledAppVersion = "[^"]+";/, constant);
  } else {
    html = html.replace(/(        const fallbackVersion = "[^"]+";)/, '$1\n' + constant);
  }
  fs.writeFileSync(htmlPath, html);
  fs.writeFileSync(path.join(root, 'app.runtime.js'), code);
  const metadata = {
    generator: 'terser@5.44.0', version,
    options: { ...options, format: { comments: '@license|@preserve|^!' } },
    source_sha256: sha(source), runtime_sha256: sha(code),
    source_bytes: Buffer.byteLength(source), runtime_bytes: Buffer.byteLength(code),
    source_gzip: zlib.gzipSync(source).length, runtime_gzip: zlib.gzipSync(code).length,
  };
  fs.writeFileSync(path.join(root, 'app.runtime.json'), JSON.stringify(metadata, null, 2) + '\n');
  console.log('gzip', metadata.source_gzip, '=>', metadata.runtime_gzip);
})().catch(error => { console.error(error); process.exitCode = 1; });
