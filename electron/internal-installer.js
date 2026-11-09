const fs = require('node:fs');
const path = require('node:path');
const { createHash } = require('node:crypto');
const execFile = require('node:util').promisify(require('node:child_process').execFile);

const assetOrigins = new Set([
  'https://release-assets.githubusercontent.com',
  'https://objects.githubusercontent.com',
]);

function isAssetUrl(url, source) {
  if (url === source) return true;
  try {
    const parsed = new URL(url);
    return !parsed.username && !parsed.password && assetOrigins.has(parsed.origin);
  } catch { return false; }
}

// Keep the transfer isolated from the main window and its browser session.
function createInstallerDownloader(session, tempPath) {
  let transfer = null;
  session.webRequest.onBeforeRequest(({url}, done) => {
    done({cancel: !transfer || !isAssetUrl(url, transfer.asset.url)});
  });
  session.on('will-download', (event, item) => {
    const request = transfer;
    const urls = item.getURLChain();
    if (!request || request.item || urls[0] !== request.asset.url ||
        urls.some(url => !isAssetUrl(url, request.asset.url))) {
      event.preventDefault();
      return;
    }
    const {asset, file, progress, finish} = request;
    if (item.getTotalBytes() > 0 && item.getTotalBytes() !== asset.size) {
      event.preventDefault();
      finish(Error('Unexpected installer size'));
      return;
    }
    request.item = item;
    item.setSavePath(file);
    item.on('updated', (_event, state) => {
      const bytes = item.getReceivedBytes();
      if (state === 'interrupted' || bytes > asset.size) item.cancel();
      else progress(Math.min(99, Math.floor(bytes * 100 / asset.size)));
    });
    item.once('done', (_event, state) => {
      finish(state === 'completed' ? null : Error('Installer download interrupted'));
    });
  });

  return async function downloadInstaller(asset, progress) {
    const directory = await fs.promises.mkdtemp(path.join(tempPath, 'mindex-update-'));
    const file = path.join(directory, asset.name);
    try {
      await new Promise((resolve, reject) => {
        const finish = error => {
          if (transfer !== request) return;
          clearTimeout(timeout);
          transfer = null;
          if (error) reject(error);
          else resolve();
        };
        const request = {asset, file, progress, finish};
        transfer = request;
        const timeout = setTimeout(() => {
          request.item?.cancel();
          finish(Error('Installer download timed out'));
        }, 30 * 60 * 1000);
        try { session.downloadURL(asset.url, {headers:{Accept:'application/octet-stream'}}); }
        catch (error) { finish(error); }
      });
      return file;
    } catch (error) {
      await fs.promises.rm(directory, {recursive: true, force: true}).catch(() => {});
      throw error;
    }
  };
}

async function verifyInstaller(file, asset) {
  const info = await fs.promises.lstat(file);
  if (!info.isFile() || info.size !== asset.size) throw Error('Installer size mismatch');
  const hash = createHash('sha256');
  for await (const chunk of fs.createReadStream(file)) hash.update(chunk);
  if (hash.digest('hex') !== asset.sha256) throw Error('Installer digest mismatch');
}

async function markInstaller(file) {
  if (process.platform === 'darwin') {
    const attribute = 'com.apple.quarantine';
    try {
      await execFile('/usr/bin/xattr', ['-p', attribute, file]);
      return;
    } catch { /* The desktop download may have no quarantine attribute. */ }
    const timestamp = Math.floor(Date.now() / 1000).toString(16);
    await execFile('/usr/bin/xattr', ['-w', attribute, '0081;'+timestamp+';Mindex;', file]);
  } else if (process.platform === 'win32') {
    const zone = file+':Zone.Identifier';
    const existing = await fs.promises.readFile(zone, 'utf8').catch(error => {
      if (error.code !== 'ENOENT') throw error;
      return '';
    });
    if (!/^ZoneId=[34]\s*$/m.test(existing)) {
      await fs.promises.writeFile(zone, '[ZoneTransfer]\r\nZoneId=3\r\n');
    }
  }
}

function discardInstaller(file) {
  return fs.promises.rm(path.dirname(file), {recursive: true, force: true}).catch(() => {});
}

module.exports = { createInstallerDownloader, verifyInstaller, markInstaller, discardInstaller };
