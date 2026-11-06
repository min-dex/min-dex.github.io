const pkg = require('./package.json');
module.exports = {
 ...pkg.build,
 publish: null,
 directories: {output: 'dist/internal'},
 extraMetadata: {mindexInternalBuild: true},
 mac: {...pkg.build.mac, identity: null, notarize: false},
 win: {...pkg.build.win, signAndEditExecutable: false},
};
