const fs = require('node:fs');
const path = require('node:path');
const { createHash } = require('node:crypto');

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

// Use the native download manager so the downloaded file follows the usual
// OS security checks when the user opens it.
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

function discardInstaller(file) {
  return fs.promises.rm(path.dirname(file), {recursive: true, force: true}).catch(() => {});
}

module.exports = { createInstallerDownloader, verifyInstaller, discardInstaller };
