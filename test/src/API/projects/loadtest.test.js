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

const projectService = require('../../../modules/project.service');
const reqService = require('../../../modules/request.service');
const { testTimeout, ADMIN_COOKIE, pathToApiSpec } = require('../../../config');
const chaiResValidator = require('chai-openapi-response-validator');

chai.use(chaiResValidator(pathToApiSpec));
chai.should();

describe('Load Runner Tests', function() {
    describe('loadtest/config Tests', function() {
        let projectID, expectedSavedConfig;
        const projectName = `loadrunnerconfigtest${Date.now()}`;
        const configOptions = {
            path: '/',
            requestsPerSecond: '200',
            concurrency: '20',
            maxSeconds: '20',
        };

        before(async function() {
            this.timeout(testTimeout.med);
            projectID = await projectService.cloneAndBindProject(projectName, 'nodejs');
        });

        after(async function() {
            this.timeout(2 * testTimeout.med);
            await projectService.unbindProject(projectID);

            // after is failing in jenkins with permission issues.  This is not
            // actually part of the test, its us trying to be good and clean up

            // workspace_location = await projectService.findWorkspaceLocation();
            // const projectPath = path.join(workspace_location, projectName);
            // await fs.remove(projectPath);
        });

        describe('POST loadtest/config', function() {
            describe('Valid Input', function() {
                describe('Complete valid options', () => {
                    it('returns status 200 to POST/loadtest/config to the load-test/config.json', async function() {
                        this.timeout(testTimeout.short);
                        const res = await writeToLoadTestConfig(projectID, configOptions);
                        res.should.have.status(200).and.satisfyApiSpec;
                    });

                    it('returns status 200 to POST/loadtest/config when query parameters are included', async function() {
                        this.timeout(testTimeout.short);
                        configOptions.query = { a: '1', b: '2' };
                        const res = await writeToLoadTestConfig(projectID, configOptions);
                        res.should.have.status(200).and.satisfyApiSpec;
                    });

                    it('returns status 200 to GET/loadtest/config with the correct decoded options', async function() {
                        this.timeout(testTimeout.short);
                        // Query parameters are processed into a query string and not saved
                        delete configOptions.query;
                        expectedSavedConfig = modifyOptions(configOptions, { path: '/?a=1&b=2' });
                        const res = await readLoadTestConfig(projectID);
                        res.should.have.status(200).and.satisfyApiSpec;
                        res.body.should.deep.equal(expectedSavedConfig);
                    });
                });
                describe('Additional invalid field', () => {
                    it('returns status 200 to POST/loadtest/config when non-config fields are included', async function() {
                        this.timeout(testTimeout.short);
                        configOptions.query = { a: '1', b: '2' };
                        configOptions.config = 'Not a valid option';
                        const res = await writeToLoadTestConfig(projectID, configOptions);
                        res.should.have.status(200).and.satisfyApiSpec;
                    });

                    it('returns status 200 to GET/loadtest/config and not return these non-config fields in loadtest/config.json', async function() {
                        this.timeout(testTimeout.short);
                        const res = await readLoadTestConfig(projectID);
                        res.should.have.status(200).and.satisfyApiSpec;
                        res.body.should.deep.equal(expectedSavedConfig);
                    });
                });
                describe('Empty query object', () => {
                    it('returns status 200 to POST/loadtest/config when non-config fields are included', async function() {
                        this.timeout(testTimeout.short);
                        configOptions.query = {};
                        const res = await writeToLoadTestConfig(projectID, configOptions);
                        res.should.have.status(200).and.satisfyApiSpec;
                    });

                    it('returns status 200 to GET/loadtest/config and not return these non-config fields in loadtest/config.json', async function() {
                        this.timeout(testTimeout.short);
                        expectedSavedConfig.path = '/';
                        const res = await readLoadTestConfig(projectID);
                        res.should.have.status(200).and.satisfyApiSpec;
                        res.body.should.deep.equal(expectedSavedConfig);
                    });
                });
            });

            describe('Invalid Input', function() {
                before(function() {
                    delete configOptions.path;
                });
                it('should fail (with status 400) to POST/loadtest/config when an input field is missing', async function() {
                    this.timeout(testTimeout.short);
                    const res = await writeToLoadTestConfig(projectID, configOptions);
                    res.should.have.status(400);
                });

                it('should fail (with status 400) to POST/loadtest/config when an input field is the wrong type', async function() {
                    this.timeout(testTimeout.short);
                    configOptions.path = true;
                    const res = await writeToLoadTestConfig(projectID, configOptions);
                    res.should.have.status(400);
                });

                it('should fail (with status 400) to POST/loadtest/config when input path is non-absolute', async function() {
                    this.timeout(testTimeout.short);
                    configOptions.path = 'test';
                    const res = await writeToLoadTestConfig(projectID, configOptions);
                    res.should.have.status(400);
                });

                it('should fail (with status 404) to POST/loadtest/config when project does not exist', async function() {
                    this.timeout(testTimeout.short);
                    const res = await writeToLoadTestConfig('falseID', configOptions);
                    res.should.have.status(404);
                });
            });
        });

        describe('GET loadtest/config', () => {
            describe('Valid Input', () => {
                it('returns status 200 to GET/loadtest/config from the load-test/config.json', async function() {
                    this.timeout(testTimeout.short);
                    const res = await readLoadTestConfig(projectID);
                    res.should.have.status(200).and.satisfyApiSpec;
                    res.body.should.deep.equal(expectedSavedConfig);
                });
            });
            describe('Invalid Input', () => {
                it('should fail (with status 404) to GET/loadtest/config when project does not exist', async function() {
                    this.timeout(testTimeout.short);
                    const res = await readLoadTestConfig('falseID');
                    res.should.have.status(404);
                });
            });
        });
    });

    describe('runLoad Tests', function() {
        const projectName = `loadrunnertest${Date.now()}`;
        let projectID;

        before(async function() {
            this.timeout(3 * testTimeout.med);
            projectID = await projectService.cloneAndBindAndBuildProject(projectName, 'nodejs');
            await projectService.awaitProjectStarted(projectID);
        });

        after(async function() {
            this.timeout(2 * testTimeout.med);
            await projectService.unbindProject(projectID);

            // const workspace_location = await projectService.findWorkspaceLocation();
            // const projectPath = path.join(workspace_location, projectName);
            //await fs.remove(projectPath);
        });

        it('should fail (with status 404) to run load against a project with an invalid id', async function() {
            this.timeout(testTimeout.short);
            const res = await projectService.runLoad('invalidID');
            res.should.have.status(404);
        });

        it('should fail (with status 404) to cancel load on a project with an invalid id', async function() {
            this.timeout(testTimeout.short);
            const res = await projectService.cancelLoad('invalidID');
            res.should.have.status(404);
        });

        it('should successfully (with status 202) run load against a project', async function() {
            this.timeout(testTimeout.short);
            const res = await projectService.runLoad(projectID, 'Load test run to test running load against a project.');
            res.should.have.status(202);
        });

        it('should fail (with status 409) to run load when load is already running', async function() {
            this.timeout(testTimeout.short);
            const res = await projectService.runLoad(projectID);
            res.should.have.status(409);
        });

        it('should cancel the load running process on the project', async function() {
            this.timeout(testTimeout.short);
            const res = await projectService.cancelLoad(projectID);
            const receivedExpectedResStatus = (res.status === 200 || res.status === 409); // We may get 409 return if the load has finished
            receivedExpectedResStatus.should.be.true;
        });

        it("should fail (with status 404) to cancel load that isn't being run", async function() {
            this.timeout(testTimeout.short);
            const res = await projectService.cancelLoad(projectID);
            res.should.have.status(409);
        });
    });
});

async function writeToLoadTestConfig(projectID, configOptions) {
    const res = await reqService.chai
        .post(`/api/v1/projects/${projectID}/loadtest/config`)
        .set('cookie', ADMIN_COOKIE)
        .send(configOptions);
    return res;
};

async function readLoadTestConfig(projectID) {
    const res = await reqService.chai
        .get(`/api/v1/projects/${projectID}/loadtest/config`)
        .set('cookie', ADMIN_COOKIE);
    return res;
};

function modifyOptions(options, newOptions) {
    const modifiedOptions = { ...options };
    Object.keys(newOptions).forEach((key) => {
        modifiedOptions[key] = newOptions[key];
    });
    return modifiedOptions;
};
