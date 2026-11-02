// Legacy call shape only; matching remains in the official patched engine.
const modern = require('minimatch');
class LegacyMinimatch extends modern.Minimatch {
  // glob7 indexes globSet alongside set; preserve one row per brace branch.
  mergeRows() {}
  constructor(pattern, options) {
    super(pattern, options);
    for (const row of this.set) for (const part of row) {
      if (!part || typeof part !== 'object') continue;
      part._glob = part.pattern;
      part[Symbol.match] = value => part.test(value) ? [value] : null;
    }
  }
}
module.exports = Object.assign((...args) => modern.minimatch(...args), modern, {
  Minimatch: LegacyMinimatch,
});
