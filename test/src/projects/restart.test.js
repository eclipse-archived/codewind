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
const chai = require('chai');

const projectService = require('../../modules/project.service');
const SocketService = require('../../modules/socket.service');

const { USING_K8S, testTimeout } = require('../../config');

chai.should();

// Interval ticker used for keeping long-running tests alive on travis
let ticker;
let ticking = false;

let socketService;
const projectNames = [];

// Ticker function, outputs a tab then a dot at each interval
function intervalFunction() {
    if (ticking) {
        process.stdout.write('.');
    } else {
        process.stdout.write('\t.');
        ticking = true;
    }
}

// Only run restart tests in local docker (file watcher does not support project restart/debug in kubernetes)
if (!USING_K8S) describe('Restart Project Tests', function() {
    describe('POST /projects/{id}/restart', function() {
        const restartModes = {
            valid: ['run', 'debugNoInit'],
            invalid: ['debug'],
        };
        // restarting projects cannot be restarted. So to run restart tests concurrently, use fresh (restartable) projects
        const numProjects = restartModes.valid.length + restartModes.invalid.length;
        const projectIDs = {
            restarting: [],
            restartable: [],
        };

        before(async function() {
            ticker = setInterval(intervalFunction, 60000); // 60 second ticker
            ticking = false; // initialise ticker

            socketService = await SocketService.createSocket();
        });

        after(async function() {
            this.timeout(testTimeout.med * numProjects);
            clearInterval(ticker);

            socketService.close();
            socketService = undefined;

            // unbind and delete directories for all projects
            const allProjectIDs = projectIDs.restartable.concat(projectIDs.restarting);
            await Promise.all(allProjectIDs.map(projectID =>
                projectService.unbindProject(projectID)
            ));
            await Promise.all(projectNames.map(name =>
                projectService.deleteProjectDir(name)
            ));
        });

        const thisTestTimeout = 3 * testTimeout.maxTravis;
        describe(`[Setup] create ${numProjects} projects and wait ${thisTestTimeout}ms for them to start`, function() {
            it('should wait for them to start', async function() {
                this.timeout(thisTestTimeout);

                // start the clone and bind for each project
                const projectIdPromises = range(numProjects).map(i => {
                    const projectName = `restart-node-${Date.now()}-${i}`;
                    projectNames.push(projectName);
                    return projectService.cloneAndBindAndBuildProject(projectName, 'nodejs');
                });

                // create the project started listeners, which resolve when the projects reach status of started
                const projectStartedPromises = projectIdPromises.map((promise) => promise.then(projectID => {
                    return socketService.checkForMsg({ projectID, msgType: 'projectStarted' });
                }));

                // get the project ID of each one
                projectIDs.restartable = await Promise.all(projectIdPromises);

                // wait for the projects to start
                await Promise.all(projectStartedPromises);
            });
        });

        describe('Success cases (200 Success)', function() {
            restartModes.valid.map(testSuccessfulRestart);

            function testSuccessfulRestart(startMode) {
                it(`should successfully restart in '${startMode}' mode`, async function() {
                    this.timeout(testTimeout.short);

                    const projectID = projectIDs.restartable[0];
                    await projectService.restartProject(projectID, startMode, 202);

                    const idThatWasJustUsed = projectIDs.restartable.shift();
                    projectIDs.restarting.push(idThatWasJustUsed);
                });
            }
        });

        describe('Failure cases', function() {
            describe('400 Invalid Request', function() {
                describe.skip('', function() { // TODO find out why this incorrectly returns 202 instead of 400. Codewind behaves correctly in manual tests though
                    it('should fail to restart when project is not running', async function() {
                        this.timeout(testTimeout.short);
                        const projectID = projectIDs.restarting[0];
                        await projectService.restartProject(projectID, 'run', 400);
                    });
                });

                const startMode = restartModes.invalid[0];
                it(`should fail to restart in an unsupported mode - '${startMode}'`, async function() {
                    this.timeout(testTimeout.short);
                    const projectID = projectIDs.restartable[0];
                    const res = await projectService.restartProject(projectID, startMode, 400);
                    res.should.have.status(400);
                    res.body.name.should.equal('FilewatcherError');
                    res.body.code.should.equal('REQUEST_VALIDATION_ERROR');
                    res.body.should.have.own.property('message');
                    res.body.message.should.include(`projects do not support restarting in ${startMode}`);
                });

                it('should fail to restart when no mode is specified', async function() {
                    this.timeout(testTimeout.short);
                    const projectID = projectIDs.restartable[0];
                    const res = await projectService.restartProject(projectID, null, 400);
                    res.should.have.status(400);
                    res.body.name.should.equal('FilewatcherError');
                    res.body.code.should.equal('REQUEST_VALIDATION_ERROR');
                    res.body.should.have.own.property('message');
                    res.body.message.should.include('startMode was not provided');
                });
            });

            describe('404 Not Found', function() {
                it('should fail to restart a non-existent project', async function() {
                    this.timeout(testTimeout.short);
                    const res = await projectService.restartProject('nonexistentproject', 'run', 404);
                    res.body.should.have.own.property('msg');
                });
            });
        });
    });
});

function range(n) {
    const arrayOfLengthN = [...Array(n).keys()];
    return arrayOfLengthN;
}
