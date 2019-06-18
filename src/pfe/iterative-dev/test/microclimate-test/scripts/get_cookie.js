const oidc_login = require('../../../../src/portal/authentication/oidc_login.js');

const portal = process.argv[2];
const username = process.argv[3];
const pw = process.argv[4];

oidc_login.getConnectCookie(portal, {user: username, password: pw}, function(err, cookie) {
  if (err) {
    console.log(err);
    process.exit(1);
  }
  console.log(cookie);
  process.exit(0);
});
