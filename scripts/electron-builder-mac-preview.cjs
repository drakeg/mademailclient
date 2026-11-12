// Integrity signing without a Developer ID. This is not Apple notarization.
const {build}=require('../package.json');
module.exports={...build,mac:{...build.mac,identity:'-',hardenedRuntime:false,notarize:false}};
