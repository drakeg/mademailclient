// Separate from unsigned development packaging. Missing signing must fail closed.
const { build } = require('../package.json');
module.exports = {
  ...build,
  forceCodeSigning: true,
  mac: {
    ...build.mac,
    hardenedRuntime: true,
    notarize: true,
    entitlements: 'scripts/entitlements.mac.plist',
    entitlementsInherit: 'scripts/entitlements.mac.plist'
  }
};
