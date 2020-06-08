const express = require('express')
const Keycloak = require('keycloak-connect');
const session = require('express-session');
const httpProxy = require('http-proxy');
const fs = require('fs-extra');
const { promisify } = require('util');
const https = require('https');

const default_realm = "codewind";
const default_clientID = "codewind";
const default_sessionSecret = "codewind";
const CONST_MISSING_ROLE = "codewind-role-not-defined";

let pfe_host = "codewind-pfe";  // use container name
let pfe_port = '9090';          // use internal port (we are on the same network)
let pfe_protocol = "http";

main().catch(err => console.dir(err));
async function main() {

    // dotenv reads .env and adds it to the process.env object
    require('dotenv').config()
    const app = express()
    const port = 9096

    // Accept self signed certificates
    process.env["NODE_TLS_REJECT_UNAUTHORIZED"] = 0;

    // Load environment variables
    let sessionSecret = process.env.SESSION_SECRET
    let realm = process.env.REALM
    let client_id = process.env.CLIENT_ID
    let auth_url = process.env.AUTH_URL
    let client_secret = process.env.CLIENT_SECRET
    let gatekeeper_host = process.env.GATEKEEPER_HOST
    let workspace_service = process.env.WORKSPACE_SERVICE
    let portal_secure = process.env.PORTAL_HTTPS
    let workspaceID = process.env.WORKSPACE_ID
    let required_accessRole = process.env.ACCESS_ROLE
    const codewindVersion = process.env.CODEWIND_VERSION
    const imageBuildTime = process.env.IMAGE_BUILD_TIME

    if (workspace_service != "") {
        pfe_host = process.env[(workspace_service + "_SERVICE_HOST").toUpperCase()]
        pfe_port = process.env[(workspace_service + "_SERVICE_PORT").toUpperCase()]
        pfe_protocol = "http"
        if (portal_secure == "true") {
            pfe_protocol = "https"
        }
    }
    console.log(`Gatekeeper ${workspaceID} with route authentication and UI Socket pass-through`)

    console.log("Gatekeeper configuration:")
    console.log(`** PFE Service: ${pfe_protocol}://${pfe_host}:${pfe_port}`);

    // check environment variables
    if (!sessionSecret) {
        console.log(`** SESSION_SECRET: env variable is not defined - using default of: ${default_sessionSecret}`);
        sessionSecret = default_sessionSecret;
    } else {
        console.log(`** SESSION_SECRET: <not-displayed>`)
    }

    if (!realm) {
        console.log(`** REALM: env variable is not defined - using default of: ${default_realm}`);
        realm = default_realm;
    } else {
        console.log(`** REALM: ${realm}`)
    }

    if (!client_id) {
        console.log(`** CLIENT_ID: env variable is not defined - using default of: ${default_clientID}`);
        client_id = default_clientID;
    } else {
        console.log(`** CLIENT_ID: ${client_id}`)
    }

    if (!auth_url) {
        console.log("** AUTH_URL: env variable is not defined - Please set container environment variable in format : https://mykeycloak.mydomain:9496");
        auth_url = "";
    } else {
        console.log(`** AUTH_URL: ${auth_url}`)
    }

    if (!client_secret) {
        console.log("** CLIENT_SECRET: env variable is not defined - Please set container environment variable to a valid secret eg: c8479984-ea64-479b-9ef1-bbb720ebfda7 ");
        client_secret = ""
    } else {
        console.log(`** CLIENT_SECRET: <not-displayed>`)
    }

    if (!gatekeeper_host) {
        console.log("** GATEKEEPER_HOST: env variable is not defined - Please set container environment variable in format : 127.0.0.1:9096 ");
        gatekeeper_host = ""
    } else {
        gatekeeper_host = gatekeeper_host.toUpperCase();
        console.log(`** GATEKEEPER_HOST: ${gatekeeper_host}`)
    }
    if (!required_accessRole) {
        console.log(`** WARNING ACCESS_ROLE : Access role has not been set in environment`)
        required_accessRole=CONST_MISSING_ROLE
    } else {
        console.log(`** Access role : ${required_accessRole}`)
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
    const authMiddleware = keyCloak.protect("realm:"+required_accessRole);
    app.use(keyCloak.middleware({ logout: '/logout', admin: '/' }));

    // Favicon.ico
    app.use('/favicon.ico', express.static('images/favicon.ico'));

    console.log("Added environment route to : /api/v1/gatekeeper/environment")
    // environment route
    app.get('/api/v1/gatekeeper/environment', function (req, res) {
        res.setHeader('Content-Type', 'application/json');
        const environment = {
            auth_url: auth_url,
            client_id: client_id,
            workspace_id: workspaceID,
            realm: realm,
            codewind_version: codewindVersion,
            image_build_time: imageBuildTime,
        }
        res.end(JSON.stringify(environment, null, 2));
    })

    app.use('/sectest', authMiddleware, function (req, res) {
        res.end(JSON.stringify({ status: "OK", message: "This is a secured test route and is available after authentication" }, null, 2));
    })

    app.get('/health', (req, res) => res.send('OK'))

    let pfe_target = `${pfe_protocol}://${pfe_host}:${pfe_port}`;
    let proxy = new httpProxy.createProxyServer({ secure: false, target: `wss://${pfe_host}:${pfe_port}`, ws: true });
    proxy.on('proxyReq', function (proxyReq, req, res, options) {
        proxyReq.setHeader("x-forwarded-host", gatekeeper_host);
    });

    // allow a route to PFE to check when PFE is ready
    app.get("/api/pfe/ready", function (req, res) {
        console.log(`/api/pfe/ready - req.originalUrl = ${req.originalUrl}`);
        req.url = '/health';
        try {
            proxy.web(req, res, {
                target: pfe_target,
            });
        } catch (err) {
            console.log("Proxy /api/pfe/ready error: ", err);
            res.sendStatus(502);
        }
    });

    /* PFE handles socket IO authentication*/
    app.use('/socket.io/*', function (req, res) {
        console.log(`/socket.io/* - req.originalUrl = ${req.originalUrl}`);
        req.url = req.originalUrl;
        try {
            proxy.web(req, res, {
                target: pfe_target
            });
        } catch (err) {
            console.log("Proxy /socket.io/* error: ", err);
            res.sendStatus(502);
        }
    });

    /* Proxy Performance container routes */
    app.use('*', authMiddleware, function (req, res) {
        console.log(`* - req.originalUrl = ${req.originalUrl}`);
        req.url = req.originalUrl;
        try {
            proxy.web(req, res, {
                target: pfe_target
            });
        } catch (err) {
            console.log("Proxy * error: ", err);
            res.sendStatus(502);
        }
    });

    var serverCertificate;
    var serverKey;
    try {
        serverCertificate = fs.readFileSync('/tlscerts/tls.crt');
        serverKey = fs.readFileSync('/tlscerts/tls.key');
    } catch (err) {
        console.error ("**********  TLS certificates can not be loaded **********");
        console.error ("The server is unable to start since it was unable to load a key and certificate from the mounted volume - check you have a TLS secret for this deployment containing a valid key and certificate");
        process.exit(1);
    }

    server = https.createServer({ key: serverKey, cert: serverCertificate}, app)
    console.log("TLS Certificates loaded and applied to https server");

    server.on('upgrade', function (req, socket, head) {
        console.log("Proxy: websocket connect 'upgrade'")
        try {
            proxy.ws(req, socket, head);
        } catch (err) {
            console.log("Proxy upgrade error:", err);
            res.sendStatus(502);
        }
    });

    server.listen(port, () => console.log(`Gatekeeper listening on port ${port}!`))

}
