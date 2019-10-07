const express = require('express')
const Keycloak = require('keycloak-connect');
const session = require('express-session');
const request = require('request')

const default_realm = "codewind";
const default_clientID = "codewind";
const default_sessionSecret = "codewind";

const pfe_host = "codewind-pfe";  // use container name
const pfe_port = '9090';          // use internal port (we are on the same network)
let pfe_protocol = "http"

const app = express()
const port = 9096

// Accept self signed certificates
process.env["NODE_TLS_REJECT_UNAUTHORIZED"] = 0;

console.log("Gatekeeper configuration:")
console.log(`** PFE Service: ${pfe_protocol}://${pfe_host}:${pfe_port}`);

let sessionSecret = process.env.session_secret
let realm = process.env.realm
let client_id = process.env.client_id
let auth_url = process.env.auth_url
let client_secret = process.env.client_secret
let enable_auth = process.env.enable_auth

// check environment variables
if (!sessionSecret) {
    console.log(`** session_secret:  session_secret env variable is not defined - using default of: ${default_sessionSecret}`);
    sessionSecret = default_sessionSecret;
} else {
    console.log(`** sessionSecret: <not-displayed>`)
}

if (!realm) {
    console.log(`** realm: realm env variable is not defined - using default of: ${default_realm}`);
    realm = default_realm;
} else {
    console.log(`** realm: ${realm}`)
}

if (!client_id) {
    console.log(`** client_id:  client_id env variable is not defined - using default of: ${default_clientID}`);
    client_id = default_clientID;
} else {
    console.log(`** client_id: ${client_id}`)
}

if (!auth_url) {
    console.log("** auth_url: auth_url env variable is not defined - Please set container environment variable to something valid : https://mykeycloak.mydomain:9496");
    auth_url = "";
} else {
    console.log(`** auth_url: ${auth_url}`)
}

if (!client_secret) {
    console.log("** client_secret: client_secret is not defined - Please set container environment variable to a valid secret eg: c8479984-ea64-479b-9ef1-bbb720ebfda7 ");
    client_secret = ""
} else {
    console.log(`** client_secret: <not-displayed>`)
}

// Create a session-store for the express-session and keycloak middleware.
let memoryStore = new session.MemoryStore();
app.use(session({ secret: sessionSecret, resave: false, saveUninitialized: true, store: memoryStore }));

const kcConfig = {
    realm: realm,
    authServerUrl: auth_url + "/auth",
    resource: client_id,
    sslRequired: "external",
}

if (!client_secret) {
    kcConfig.credentials = {}
    kcConfig.credentials.secret = client_secret
}

const keyCloak = new Keycloak({ store: memoryStore }, kcConfig);

// Slot-in authentication middleware
let authMiddleware = function (req, res, next) { next() }

// Activate / Disable authenticated routes features
if (enable_auth == "1") {
    console.log("** Gatekeeper: Authentication is enabled");
    authMiddleware = keyCloak.protect();
    app.use(keyCloak.middleware({ logout: '/logout', admin: '/' }));
} else {
    console.log("** Gatekeeper: Authentication is disabled");
}

// environment route
app.get('/api/v1/gatekeeper/environment', function (req, res) {
    res.setHeader('Content-Type', 'application/json');
    const environment = {
        auth_url: auth_url,
        client_id: client_id,
        realm: realm
    }
    res.end(JSON.stringify(environment, null, 2));
})

app.use('/sectest', authMiddleware, function (req, res) {
    res.end(JSON.stringify({ status: "OK", message: "This is a secured test route and is available after authentication" }, null, 2));
})

app.get('/health', (req, res) => res.send('OK'))

/* Proxy Performance container routes */
app.use('*', authMiddleware, function (req, res) {
    try {
        console.log(`req.originalUrl = ${req.originalUrl}`);
        let url = `http://${pfe_host}:${pfe_port}${req.originalUrl}`;
        let r = request(url);
        req.pipe(r).on('error', function (err) {
            console.log(err);
            res.status(502).send({ error: err.code });
        }).pipe(res);
    } catch (err) {
        console.log(err);
    }
});

console.log("TODO :  Use logger not console.log")
console.log("TODO :  Detect PFE port and protocol rather than default http:9090 since in K8S will be using https")

app.listen(port, () => console.log(`Codewind gatekeeper listening on port: ${port}!`))

