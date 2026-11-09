const pkg = require('./package.json');
module.exports = {
 ...pkg.build,
 ...(process.env.MINDEX_CI_ELECTRON_DIST && {
    electronDist: process.env.MINDEX_CI_ELECTRON_DIST,
  }),
 icon: "assets/icon-512.png",
 publish: null,
 directories: {output: 'dist/internal'},
 extraMetadata: {mindexInternalBuild: true},
 // Seal the repackaged bundle with the local identity without certificate discovery.
 mac: {...pkg.build.mac, identity: "-", hardenedRuntime: false, notarize: false},
 win: {...pkg.build.win, signExecutable: false},
};
