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
const path = require('path');
const chaiResValidator = require('chai-openapi-response-validator');

const projectService = require('../../../modules/project.service');
const reqService = require('../../../modules/request.service');
const { testTimeout, ADMIN_COOKIE, TEMP_TEST_DIR, pathToApiSpec } = require('../../../config');

chai.use(chaiResValidator(pathToApiSpec));
chai.should();

describe('Load Runner Tests', function() {
    const projectName = `test-loadrunner-${Date.now()}`;
    const pathToLocalProject = path.join(TEMP_TEST_DIR, projectName);
    let projectID;
    
    before('create a sample project and bind to Codewind, without building', async function() {
        this.timeout(testTimeout.med);
        projectID = await projectService.createProjectFromTemplate(projectName, 'nodejs', pathToLocalProject);
    });
    
    after(async function() {
        this.timeout(testTimeout.med);
        await projectService.removeProject(pathToLocalProject, projectID);
    });
    
    describe('loadtest/config Tests', function() {
        const configOptions = {
            path: '/',
            requestsPerSecond: '200',
            concurrency: '20',
            maxSeconds: '20',
        };
        let expectedSavedConfig;

        describe('POST loadtest/config', function() {
            describe('Valid Input', function() {
                describe('Complete valid options', () => {
                    it('returns 200 to POST/loadtest/config to the load-test/config.json', async function() {
                        this.timeout(testTimeout.short);
                        const res = await writeToLoadTestConfig(projectID, configOptions);
                        res.should.have.status(200).and.satisfyApiSpec;
                    });

                    it('returns 200 to POST/loadtest/config when query parameters are included', async function() {
                        this.timeout(testTimeout.short);
                        configOptions.query = { a: '1', b: '2' };
                        const res = await writeToLoadTestConfig(projectID, configOptions);
                        res.should.have.status(200).and.satisfyApiSpec;
                    });

                    it('returns 200 to GET/loadtest/config with the correct decoded options', async function() {
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
                    it('returns 200 to POST/loadtest/config when non-config fields are included', async function() {
                        this.timeout(testTimeout.short);
                        configOptions.query = { a: '1', b: '2' };
                        configOptions.config = 'Not a valid option';
                        const res = await writeToLoadTestConfig(projectID, configOptions);
                        res.should.have.status(200).and.satisfyApiSpec;
                    });

                    it('returns 200 to GET/loadtest/config and not return these non-config fields in loadtest/config.json', async function() {
                        this.timeout(testTimeout.short);
                        const res = await readLoadTestConfig(projectID);
                        res.should.have.status(200).and.satisfyApiSpec;
                        res.body.should.deep.equal(expectedSavedConfig);
                    });
                });
                describe('Empty query object', () => {
                    it('returns 200 to POST/loadtest/config when non-config fields are included', async function() {
                        this.timeout(testTimeout.short);
                        configOptions.query = {};
                        const res = await writeToLoadTestConfig(projectID, configOptions);
                        res.should.have.status(200).and.satisfyApiSpec;
                    });

                    it('returns 200 to GET/loadtest/config and not return these non-config fields in loadtest/config.json', async function() {
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
                it('fails with 400 to POST/loadtest/config when an input field is missing', async function() {
                    this.timeout(testTimeout.short);
                    const res = await writeToLoadTestConfig(projectID, configOptions);
                    res.status.should.equal(400, res.text); // print res.text if assertion fails
                });

                it('fails with 400 to POST/loadtest/config when an input field is the wrong type', async function() {
                    this.timeout(testTimeout.short);
                    configOptions.path = true;
                    const res = await writeToLoadTestConfig(projectID, configOptions);
                    res.status.should.equal(400, res.text); // print res.text if assertion fails
                });

                it('fails with 400 to POST/loadtest/config when input path is non-absolute', async function() {
                    this.timeout(testTimeout.short);
                    configOptions.path = 'test';
                    const res = await writeToLoadTestConfig(projectID, configOptions);
                    res.status.should.equal(400, res.text); // print res.text if assertion fails
                });

                it('fails with 404 to POST/loadtest/config when project does not exist', async function() {
                    this.timeout(testTimeout.short);
                    const res = await writeToLoadTestConfig('falseID', configOptions);
                    res.status.should.equal(404, res.text); // print res.text if assertion fails
                    res.should.satisfyApiSpec;
                });
            });
        });

        describe('GET loadtest/config', () => {
            it('returns 200 to GET/loadtest/config from the load-test/config.json', async function() {
                this.timeout(testTimeout.short);
                const res = await readLoadTestConfig(projectID);
                res.should.have.status(200).and.satisfyApiSpec;
                res.body.should.deep.equal(expectedSavedConfig);
            });
            it('fails with 404 to GET/loadtest/config when project does not exist', async function() {
                this.timeout(testTimeout.short);
                const res = await readLoadTestConfig('falseID');
                res.status.should.equal(404, res.text); // print res.text if assertion fails
                res.should.satisfyApiSpec;
            });
        });
    });

    describe('run load Tests (POST /loadtest and POST /loadtest/cancel)', function() {
        it('fails with 404 to run load against a project with an invalid id', async function() {
            this.timeout(testTimeout.short);
            const res = await projectService.runLoad('invalidID');
            res.status.should.equal(404, res.text); // print res.text if assertion fails
            res.should.satisfyApiSpec;
        });

        it('fails with 404 to cancel load on a project with an invalid id', async function() {
            this.timeout(testTimeout.short);
            const res = await projectService.cancelLoad('invalidID');
            res.status.should.equal(404, res.text); // print res.text if assertion fails
            res.should.satisfyApiSpec;
        });

        /**
         * Test disabled because we don't wait for test project to run, so PFE rejects requests to run load.
         */
        it.skip('returns 202 and starts running load against a project', async function() {
            this.timeout(testTimeout.short);
            const res = await projectService.runLoad(projectID, 'Load test run to test running load against a project.');
            res.status.should.equal(202, res.text); // print res.text if assertion fails
            res.should.satisfyApiSpec;
        });

        /**
         * Test disabled because we don't wait for test project to run, so PFE rejects requests to run load.
         */
        it.skip('fails with 409 to run load when load is already running', async function() {
            this.timeout(testTimeout.short);
            const res = await projectService.runLoad(projectID);
            res.status.should.equal(409, res.text); // print res.text if assertion fails
            res.should.satisfyApiSpec;
        });

        it('fails with 503 to run load when project is not running', async function() {
            this.timeout(testTimeout.short);
            const res = await projectService.runLoad(projectID);
            res.status.should.equal(503, res.text); // print res.text if assertion fails
            res.should.satisfyApiSpec;
        });

        it('returns 200 or 409 and cancels the load running process on the project', async function() {
            this.timeout(testTimeout.short);
            const res = await projectService.cancelLoad(projectID);
            res.status.should.be.oneOf([200, 409]);
            res.should.satisfyApiSpec;
        });

        it("fails with 409 to cancel load that isn't being run", async function() {
            this.timeout(testTimeout.short);
            const res = await projectService.cancelLoad(projectID);
            res.status.should.equal(409, res.text); // print res.text if assertion fails
        });
    });

    describe('query profiling data (POST /profiling/:testRunTime/querytree and /profiling/:testRunTime/querysummary)', function() {
        it('querytree fails with 404 against a project with an invalid id', async function() {
            this.timeout(testTimeout.short);
            const res = await projectService.queryProfileTree('invalidID', '20200101', '{"path": "$.total_count"}');
            res.status.should.equal(404, res.text); // print res.text if assertion fails
            res.should.satisfyApiSpec;
        });

        it('querysummary fails with 404 on a project with an invalid id', async function() {
            this.timeout(testTimeout.short);
            const res = await projectService.queryProfileSummary('invalidID', '20200101', '{"path": "$.total_count"}');
            res.status.should.equal(404, res.text); // print res.text if assertion fails
            res.should.satisfyApiSpec;
        });

        it('querytree fails with 404 against a testrun with an invalid id', async function() {
            this.timeout(testTimeout.short);
            const res = await projectService.queryProfileTree(projectID, 'invalidID', '{"path": "$.total_count"}');
            res.status.should.equal(404, res.text); // print res.text if assertion fails
            res.should.satisfyApiSpec;
        });

        it('querysummary fails with 404 on a testrun with an invalid id', async function() {
            this.timeout(testTimeout.short);
            const res = await projectService.queryProfileSummary(projectID, 'invalidID', '{"path": "$.total_count"}');
            res.status.should.equal(404, res.text); // print res.text if assertion fails
            res.should.satisfyApiSpec;
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
