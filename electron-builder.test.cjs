const pkg = require('./package.json');
module.exports = {
  ...pkg.build,
  appId: 'kr.mindex.app.test',
  productName: 'Mindex Test',
  publish: null,
  directories: { output: 'dist/test' },
  artifactName: 'Mindex-Test-${version}-${os}-${arch}.${ext}',
  extraMetadata: {
    name: 'mindex-test', productName: 'Mindex Test',
    version: `${pkg.version}-test`, mindexTestBuild: true,
  },
  mac: { ...pkg.build.mac, identity: null, notarize: false },
  win: { ...pkg.build.win, signAndEditExecutable: false },
};
