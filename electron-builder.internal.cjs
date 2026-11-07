const pkg = require('./package.json');
module.exports = {
 ...pkg.build,
 icon: "assets/icon-512.png",
 publish: null,
 directories: {output: 'dist/internal'},
 extraMetadata: {mindexInternalBuild: true},
 mac: {...pkg.build.mac, identity: null, notarize: false},
 win: {...pkg.build.win, signExecutable: false},
};
