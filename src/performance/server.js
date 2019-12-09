/*******************************************************************************
 * Copyright (c) 2019 IBM Corporation and others.
 * All rights reserved. This program and the accompanying materials
 * are made available under the terms of the Eclipse Public License v2.0
 * which accompanies this distribution, and is available at
 * http://www.eclipse.org/legal/epl-v20.html
 *
 * Contributors:
 *     IBM Corporation - initial API and implementation
*******************************************************************************/
'use strict';

// dotenv reads .env and adds it to the process.env object
require('dotenv').config()

const express = require('express');
require('express-async-errors');
const bodyParser = require('body-parser');
const childProcess = require('child_process');
const app = express();
const serverPort = 9095;
const server = app.listen(serverPort, () => console.log(`Performance server listening on port ${serverPort}!`))
const io = require('socket.io').listen(server);
const path = require('path');

const monitor = require('./monitor/route');

var loadProcess;
let projectURL;

const codewindVersion = process.env.CODEWIND_VERSION;
const imageBuildTime = process.env.IMAGE_BUILD_TIME


app.use(bodyParser.json());
app.get('/', (req, res) => res.send('Performance Container is running...'));

app.get('/health', (req, res) => res.json({ status: 'UP' }));


app.get('/performance/api/v1/environment', (req, res) => {
    const environment = {
        codewind_version: codewindVersion,
        image_build_time: imageBuildTime
    }
    res.end(JSON.stringify(environment, null, 2));
});

/**
* API Function to start a load run
* @param req, the http request containing the project parameters
* @return {res.code} 202 for accepted, 400 if options are invalid or a run
* is already in progress, 500 if error
*/
app.post('/api/v1/runload', async function (req, res) {
    console.log("LoadRunner received load run request " + JSON.stringify(req.body));
    try {
        if (loadProcess) {
            // A run is already in progress
            console.log('loadrunner/server.js: A load run is already in progress');
            res.status(409).send("A load run is already in progress");
            return;
        }
        if (!req.body.url) {
            console.log('loadrunner/server.js: URL is required');
            res.status(500);
            return;
        }
        runLoad(req.body);
        projectURL = req.body.url;
        // Send 'accepted'
        res.sendStatus(202);
    } catch (err) {
        res.status(500).send(err);
        console.error(err);
    }
});

/**
* API Function to cancel a load run
* @param req, the http request containing the project parameters
* @return {res.code} 200 on success, 400 if wrong project or no load
* being run on that given project, 500 if error
*/
app.post('/api/v1/cancelLoad', async function (req, res) {
    console.log("LoadRunner received cancel request " + JSON.stringify(req.body));
    try {
        // Check url of project running load against url of cancel request
        if (req.body.url == projectURL) {
            if (loadProcess) {
                loadProcess.kill('SIGKILL');
                res.sendStatus(200);
                return;
            } else {
                console.log('loadrunner/server.js: No run in progress');
                res.status(409).send("No run in progress");
            }
        } else {
            console.log('loadrunner/server.js: No load is being run on this project')
            res.status(409).send("No run in progress for this project");
            return;
        }
    } catch (err) {
        res.status(500).send(err);
        console.error(err);
    }
});

function runLoad(options) {
    io.emit('starting');
    console.log('starting')
    var output = "";
    var errOutput = "";
    loadProcess = childProcess.spawn('node', ['runload.js', JSON.stringify(options)], { stdio: 'pipe' });
    io.emit('started');
    loadProcess.stdout.on('data', (data) => {
        output = output + data;
    });
    loadProcess.stderr.on('data', (data) => {
        errOutput = errOutput + data;
    });
    loadProcess.on('exit', (code, signal) => {
        loadProcess = null;
        // Output to console any stray codes thrown back from the kill process signal
        console.log('signal: ' + signal);
        console.log('code: ' + code);
        if (signal === 9 || signal === 'SIGKILL') { // cancelled
            io.emit('cancelled');
            console.log('cancelled');
        } else if (code != 0) { // error
            io.emit('error', errOutput);
            console.log('error' + errOutput);
        } else { // success
            io.emit('completed', output);
            console.log('data was ' + output)
            console.log('completed')
        }
    }).on('error', (err) => {
        loadProcess = null;
        io.emit('error', errOutput);
        console.error(err);
    });
    console.log('loadProcess = ' + loadProcess)
}

/** React Performance Dashboard static files */
app.use('/performance/static', express.static(path.join(__dirname, 'dashboard', 'build', 'static')));

/** React Performance Dashboard styles files */
app.use('/performance/styles', express.static(path.join(__dirname, 'dashboard', 'build', 'styles')));

/** Carbon Plex Fonts */
app.use('/performance/fonts', express.static(path.join(__dirname, 'dashboard', 'build', 'fonts')));

/** React Performance main.js */
app.use('/performance/main.js', express.static(path.join(__dirname, 'dashboard', 'build', 'main.js')));

app.use('/performance/monitor', monitor);

/**
* Map everything else in the /dashboard/ directory to the
* React Single-Page-Application root index.html
*/
app.get('/performance/*', function (req, res) {
    res.sendFile(path.join(__dirname, 'dashboard', 'build', 'index.html'));
});
