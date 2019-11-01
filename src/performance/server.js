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

const express = require('express');
require('express-async-errors');
const axios = require('axios');
const bodyParser = require('body-parser');
const childProcess = require('child_process');
const app = express();
const serverPort = 9095;
const server = app.listen(serverPort, () => console.log(`Performance server listening on port ${serverPort}!`))
const io = require('socket.io').listen(server);
const path = require('path');
const { promisify } = require('util');

const wait = promisify(setTimeout);
var loadProcess;
let projectURL;


app.use(bodyParser.json());
app.get('/', (req, res) => res.send('Performance Container is running...'));

app.get('/health', (req, res) => res.json({ status: 'UP' }));

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

const getResData = async (origin, path) => {
    const res = await axios.get(`${origin}${path}`)
    console.log('Received res.data');
    // console.log(res.data);
    return res.data;
};

// TODO when finished dev, move out to another file
const latestProjectData = {};

const repeatPoll = async (func, numPollsRemaining) => {
    await func();
    numPollsRemaining--;
    if (numPollsRemaining > 0) {
        await wait(2000);
        await repeatPoll(func, numPollsRemaining);
        return;
    }
    console.log('Finished poll');
}

const getMetricsFromProject = async (appOrigin) => {
    const projectData = latestProjectData[appOrigin];
    if (!projectData.hasOwnProperty('metrics')) {
        projectData.metrics = {};
    }
    const [
        metricsFromUser,
        metricsFromCodewind,
    ] = await Promise.all([
        getResData(appOrigin, '/metrics')
            .catch(err => console.log(err.message)),
        getResData(appOrigin, '/metrics/codewind')
            .catch(err => console.log(err.message)),
    ]);

    projectData.metrics.fromUser = metricsFromUser;
    projectData.metrics.fromCodewind = metricsFromCodewind;
}

const getProfilingDataFromProject = async (appOrigin) => {
    const projectData = latestProjectData[appOrigin];
    if (!projectData.hasOwnProperty('profiling')) {
        projectData.profiling = {};
    }
    const profilingData = await getResData(appOrigin, '/metrics/codewind/profiling');
    projectData.profiling = profilingData;
}

app.get('/performance/monitor', function (req, res) {
    console.log('[GET /performance/monitor]');
    res.send(latestProjectData[req.query.appOrigin]);
});

app.get('/performance/monitor/environment', async function (req, res) {
    console.log('[GET /performance/monitor/environment]');
    const { appOrigin } = req.query;
    const envData = await getResData(appOrigin, '/metrics/codewind/environment');
    res.send(envData);
});

async function scrapeProjectData(appOrigin, projectLanguage, numPolls) {
    if (!latestProjectData.hasOwnProperty(appOrigin)) {
        latestProjectData[appOrigin] = {};
    }
    const promises = [
        repeatPoll(
            () => getMetricsFromProject(appOrigin),
            numPolls,
        ),
    ]
    if (projectLanguage === 'nodejs') {
        promises.push(
            repeatPoll(
                () => getProfilingDataFromProject(appOrigin),
                numPolls,
            )
        );
    }
    await Promise.all(promises);
}

function resetProjectData(appOrigin) {
    latestProjectData[appOrigin] = {};
}

app.post('/performance/monitor', async function (req, res) {
    console.log('[POST /performance/monitor]');
    const { appOrigin, projectLanguage } = req.query;
    const numPolls = 4; // TODO set this from client?
    res.send(`Polling ${appOrigin}`);
    resetProjectData(appOrigin);
    await scrapeProjectData(appOrigin, projectLanguage, numPolls);
});

app.use('/performance/codewind-metrics/dashboard', express.static('public'));


app.get('/performance/codewind-metrics/dashboard/:projectLanguage', function (req, res, next) {
    console.log('[GET /codewind-metrics/dashboard]');
    console.log('req.params');
    console.log(req.params);

    const { projectLanguage } = req.params;
    res.sendFile(path.join(__dirname, 'public', `${projectLanguage}-metrics.html`));
});



/**
* Map everything else in the /dashboard/ directory to the
* React Single-Page-Application root index.html
*/
app.get('/performance/*', function (req, res) {
    res.sendFile(path.join(__dirname, 'dashboard', 'build', 'index.html'));
});
