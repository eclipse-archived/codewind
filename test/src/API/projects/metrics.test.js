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
const fs = require('fs-extra');
const dateFormat = require('dateformat');

const containerService = require('../../../modules/container.service');
const projectService = require('../../../modules/project.service');
const reqService = require('../../../modules/request.service');
const { ADMIN_COOKIE, USING_K8S, METRIC_TYPES, MOCK_LOADTEST_DIR, testTimeout } = require('../../../config');

chai.should();

describe('Project Metrics tests', function() {
    const projectName = `projectmetricstest${Date.now()}`;
    let projectID;
    let projectLoadTestPath; // i.e. pathToProjectLoadTestDir

    before('Create project and save the projec\'ts loadTestPath', async function() {
        this.timeout(testTimeout.med);
        projectID = await projectService.cloneAndBindProject(projectName, 'nodejs');

        const project = await projectService.getProject(projectID);
        projectLoadTestPath = project.loadTestPath;
    });

    after('Clean up by deleting project', async function() {
        this.timeout(testTimeout.med);
        await projectService.unbindProject(projectID);
        await projectService.deleteProjectDir(projectName);
    });

    beforeEach('empty the project\'s loadtest dir and copy our mock load-test results into it', async function() {
        // to keep tests independent, and so we can test without waiting for a real load-test to finish
        this.timeout(testTimeout.short);
        await containerService.removeDir(projectLoadTestPath);
        await containerService.copyTo(MOCK_LOADTEST_DIR, projectLoadTestPath);
    });

    describe('/projects/{id}/metrics', function() {
        describe('GET /', function() {
            const getProjectMetrics = (projectID) => reqService.chai
                .get(`/api/v1/projects/${projectID}/metrics`)
                .set('Cookie', ADMIN_COOKIE);

            it('returns 200 and the available metric types', async function() {
                const res = await getProjectMetrics(projectID);
                res.should.have.status(200);
                res.body.should.be.an('array');
                res.body.length.should.equal(METRIC_TYPES.length);
                const expectedResBody = METRIC_TYPES.map(type => {
                    return {
                        type,
                        endpoint: `/metrics/${type}`,
                    };
                });
                res.body.should.have.deep.members(expectedResBody);
            });

            it('returns 404 when the given project does not exist', async function() {
                const res = await getProjectMetrics('blahblah-project');
                res.should.have.status(404);
            });
        });

        describe('/{testRunTime}', function() {
            describe('PUT', function() {
                const updateProjectMetrics = (projectID, testRunTime, updateOptions) => reqService.chai
                    .put(`/api/v1/projects/${projectID}/metrics/${testRunTime}`)
                    .set('Cookie', ADMIN_COOKIE)
                    .send(updateOptions);

                const originalLoadTest = {
                    testRunTime: '',
                    metricsResultsGroupedByType: '',
                    description: '',
                };

                beforeEach('Save the current metrics data', async function() {
                    const metricsResultsGroupedByType = await getProjectMetricsData(projectID);
                    originalLoadTest.metricsResultsGroupedByType = metricsResultsGroupedByType;

                    const unixTimeOfFirstTestRun = metricsResultsGroupedByType[0].metrics[0].time;
                    const timeOfFirstTestRun = dateFormat(unixTimeOfFirstTestRun, 'yyyymmddHHMMss'); //metrics time is in unix format, but dirnames are yyyymmddHHMMss
                    originalLoadTest.testRunTime = timeOfFirstTestRun;
                });

                describe('with no description field in the request body', function() {
                    it('returns 400 and an informative error message', async function() {
                        this.timeout(testTimeout.short);
                        const invalidUpdateOptions = { noDescription: 'noDescription' };
                        const res = await updateProjectMetrics(projectID, originalLoadTest.testRunTime, invalidUpdateOptions);
                        res.should.have.status(400);
                        res.body.message.should.equal('request body has no \'description\' field');
                    });
                });

                describe('with a testRunTime param that matches no load-test results', function() {
                    it('returns 404 and an informative error message', async function() {
                        this.timeout(testTimeout.short);
                        const updateOptions = { description: 'newDescription' };
                        const timeOfNonExistentLoadTest = '1234567891234';
                        const res = await updateProjectMetrics(projectID, timeOfNonExistentLoadTest, updateOptions);
                        res.should.have.status(404);
                        res.body.message.should.include(`Unable to find metrics for project ${projectID}`);
                        res.body.message.should.include(`found no load-test metrics from time ${timeOfNonExistentLoadTest}`);
                    });
                });

                describe('with an id param that matches no projects', function() {
                    it('returns 404 and an informative error message', async function() {
                        this.timeout(testTimeout.short);
                        const updateOptions = { description: 'newDescription' };
                        const idOfNonExistentProject = 'nonexistentproject';
                        const res = await updateProjectMetrics(idOfNonExistentProject, originalLoadTest.testRunTime, updateOptions);
                        res.should.have.status(404);
                        res.body.message.should.equal(`Unable to find project ${idOfNonExistentProject}`);
                    });
                });

                const newDescription = 'newDescription';
                describe(`with a new description ('${newDescription}')`, function() {
                    it('returns 200 and the same metrics data under the new description', async function() {
                        this.timeout(testTimeout.short);
                        const updateOptions = { description: newDescription };
                        const res = await updateProjectMetrics(projectID, originalLoadTest.testRunTime, updateOptions);

                        res.should.have.status(200);
                        res.body.description.should.equal(newDescription);

                        updateLocalLoadTestResultsDescription(
                            originalLoadTest.metricsResultsGroupedByType,
                            originalLoadTest.testRunTime,
                            newDescription,
                        );
                        const newMetricsResultsGroupedByType = await getProjectMetricsData(projectID);
                        newMetricsResultsGroupedByType.should.deep.equal(originalLoadTest.metricsResultsGroupedByType);
                    });
                });

                describe('with a new description (empty string)', function() {
                    it('returns 200 and the same metrics data without any description', async function() {
                        this.timeout(testTimeout.short);
                        const updateOptions = { description: '' };
                        const res = await updateProjectMetrics(projectID, originalLoadTest.testRunTime, updateOptions);

                        res.should.have.status(200);
                        res.body.description.should.equal('');

                        removeDescriptionFromLocalLoadTestResults(
                            originalLoadTest.metricsResultsGroupedByType,
                            originalLoadTest.testRunTime,
                        );
                        const newMetricsResultsGroupedByType = await getProjectMetricsData(projectID);
                        newMetricsResultsGroupedByType.should.deep.equal(originalLoadTest.metricsResultsGroupedByType);
                    });
                });

                function removeDescriptionFromLocalLoadTestResults(metricsResultsGroupedByType, testRunTime) {
                    const listOfMetrics = extractMetricsByTestRunTime(metricsResultsGroupedByType, testRunTime);
                    listOfMetrics.forEach(metricsObj => delete metricsObj.desc);
                }

                function updateLocalLoadTestResultsDescription(metricsResultsGroupedByType, testRunTime, newDescription) {
                    const listOfMetrics = extractMetricsByTestRunTime(metricsResultsGroupedByType, testRunTime);
                    listOfMetrics.forEach(metricsObj => {metricsObj.desc = newDescription;});
                }

                function extractMetricsByTestRunTime(metricsResultsGroupedByType, testRunTime) {
                    const metricsFromTestRun = [];
                    for (const metricsResults of metricsResultsGroupedByType) {
                        for (const result of metricsResults.metrics) {
                            if (dateFormat(result.time, 'yyyymmddHHMMss') === testRunTime) {
                                metricsFromTestRun.push(result);
                            }
                        }
                    }
                    return metricsFromTestRun;
                }
            });

            describe('DELETE', function() {
                const deleteProjectMetrics = (projectID, testRunTime) => reqService.chai
                    .delete(`/api/v1/projects/${projectID}/metrics/${testRunTime}`)
                    .set('Cookie', ADMIN_COOKIE);

                const originalLoadTest = {
                    testRunTime: '',
                    metricsResultsGroupedByType: '',
                    description: '',
                };

                beforeEach('Save the current metrics data', async function() {
                    const metricsResultsGroupedByType = await getProjectMetricsData(projectID);
                    originalLoadTest.metricsResultsGroupedByType = metricsResultsGroupedByType;

                    const unixTimeOfFirstTestRun = metricsResultsGroupedByType[0].metrics[0].time;
                    const timeOfFirstTestRun = dateFormat(unixTimeOfFirstTestRun, 'yyyymmddHHMMss'); //metrics time is in unix format, but dirnames are yyyymmddHHMMss
                    originalLoadTest.testRunTime = timeOfFirstTestRun;
                });


                describe('with a testRunTime param that matches no load-test results or has a closest neighbor', function() {
                    it('returns 404 and an informative error message', async function() {
                        this.timeout(testTimeout.short);
                        const timeOfNonExistentLoadTest = '20150101000000';
                        const res = await deleteProjectMetrics(projectID, timeOfNonExistentLoadTest);
                        res.should.have.status(404);
                        res.body.message.should.include(`Unable to find metrics for project ${projectID}`);
                        res.body.message.should.include(`found no load-test metrics from time ${timeOfNonExistentLoadTest}`);
                    });
                });

                describe('with an id param that matches no projects', function() {
                    it('returns 404 and an informative error message', async function() {
                        this.timeout(testTimeout.short);
                        const idOfNonExistentProject = 'nonexistentproject';
                        const res = await deleteProjectMetrics(idOfNonExistentProject, originalLoadTest.testRunTime);
                        res.should.have.status(404);
                        res.body.message.should.equal(`Unable to find project ${idOfNonExistentProject}`);
                    });
                });

                describe('with a testRunTime param that exactly matches a load-test result directory', function() {
                    it('returns 200, and then we can get all the original metrics except for the one we deleted', async function() {
                        this.timeout(testTimeout.short);

                        // it returns 200
                        const res = await deleteProjectMetrics(projectID, originalLoadTest.testRunTime);
                        res.should.have.status(200);

                        // and then we can get all the original metrics except for the one we deleted
                        removeLocalLoadTestResultsByTime(
                            originalLoadTest.metricsResultsGroupedByType,
                            originalLoadTest.testRunTime
                        );
                        const newMetricsResultsGroupedByType = await getProjectMetricsData(projectID);
                        newMetricsResultsGroupedByType.should.deep.equal(originalLoadTest.metricsResultsGroupedByType);
                    });

                    function removeLocalLoadTestResultsByTime(metricsResultsGroupedByType, testRunTime) {
                        for (const metricsResults of metricsResultsGroupedByType) {
                            const listOfMetricsResults = metricsResults.metrics;
                            for (const indexOfResult in listOfMetricsResults) {
                                const result = listOfMetricsResults[indexOfResult];
                                if (dateFormat(result.time, 'yyyymmddHHMMss') === testRunTime) {
                                    listOfMetricsResults.splice(indexOfResult, 1);
                                }
                            }
                        }
                    }
                });

                describe('with a testRunTime param that does not match a directory name exactly but is able to delete the closest neighbor', function() {
                    it('returns 200 and checks the expected directory was removed', async function() {
                        this.timeout(testTimeout.short);
                        const timeOfNonExistentLoadTest = '20190326155249';
                        const res = await deleteProjectMetrics(projectID, timeOfNonExistentLoadTest);
                        res.should.have.status(200);
                        // check that the directory was removed
                        const expectedRemovedDirectory = '20190326155248';
                        let deleteSuccess = false;
                        try {
                            fs.statSync(path.join(projectLoadTestPath, expectedRemovedDirectory));
                        }
                        catch (err) {
                            if (err.code === 'ENOENT') {
                                deleteSuccess = true;
                            }
                        }
                        deleteSuccess.should.equal(true);
                    });
                });
            });

            function postProjectsMetricsTypes(projectID, types){
                return reqService.chai
                    .post(`/api/v1/projects/${projectID}/metrics/types`)
                    .set('Cookie', ADMIN_COOKIE)
                    .send({ types });
            }

            async function getProjectMetricsData(projectID) {
                const res = await postProjectsMetricsTypes(projectID, METRIC_TYPES);
                return res.body;
            }
        });
    });

    describe('GET /projects/{id}/metrics/{type}', function() {
        const getProjectMetricsByType = (projectID, type) => reqService.chai
            .get(`/api/v1/projects/${projectID}/metrics/${type}`)
            .set('Cookie', ADMIN_COOKIE);

        METRIC_TYPES.forEach(type => {
            it(`returns 200 and the correct ${type} data`, async function() {
                this.timeout(testTimeout.med);
                const res = await getProjectMetricsByType(projectID, type);
                res.should.have.status(200);

                // copy the project's load-test dir to a temp dir to compare them in this test
                const tmpDir = '/tmp/codewind-test-metrics/';
                const localLoadTestPath = path.join(tmpDir, 'load-test');
                await fs.emptyDir(tmpDir);
                const _path = USING_K8S ? localLoadTestPath : tmpDir; // kubectl and docker cp commands handle directories differently
                await containerService.copyFrom(projectLoadTestPath, _path);

                const metricsDirs = await fs.readdir(localLoadTestPath);
                res.body.length.should.equal(metricsDirs.length);

                // metrics time is in unix format, but dirnames are yyyymmddHHMMss
                const testRunTimestamps = res.body.map(metric => dateFormat(metric.time, 'yyyymmddHHMMss'));

                // read metrics files
                let metricsJSONFiles = [];
                for (const timestamp of testRunTimestamps) {
                    metricsDirs.should.include(timestamp); // Timestamped data should have a corresponding directory
                    metricsJSONFiles.push(fs.readJSON(path.join(localLoadTestPath, timestamp, 'metrics.json'), 'utf-8'));
                }

                // wait for all files to be read
                metricsJSONFiles = await Promise.all(metricsJSONFiles);

                // compare files read to what is returned from the api
                for (const [i, metricsJson] of metricsJSONFiles.entries()) {
                    const expectedMetricData = {
                        value: metricsJson[(type === 'http') ? 'httpUrls' : type],
                        time: metricsJson.time.data.start || metricsJson.time.data.startTime,
                        endTime: metricsJson.time.data.end || metricsJson.time.data.endTime,
                        desc: `Test run ${i + 1}`,
                    };
                    res.body.should.deep.include(expectedMetricData);
                }
            });
        });

        it('returns 404 when the given metric does not exist', async function() {
            this.timeout(testTimeout.med);
            const res = await getProjectMetricsByType(projectID, 'blahblah');
            res.should.have.status(404);
        });

        it('returns 422 when the load test directory does not exist', async function() {
            this.timeout(testTimeout.short);
            await containerService.removeDir(projectLoadTestPath);
            const res = await getProjectMetricsByType(projectID, 'cpu');
            res.should.have.status(422);
        });
    });

    describe('POST /projects/{id}/metrics/types', function() {
        const postProjectsMetricsTypes = (projectID, types) => reqService.chai
            .post(`/api/v1/projects/${projectID}/metrics/types`)
            .set('Cookie', ADMIN_COOKIE)
            .send({ types });

        it('returns 200 and all the metrics in one call', async function() {
            this.timeout(testTimeout.med);
            const validTypes = ['cpu','memory'];
            const res = await postProjectsMetricsTypes(projectID, validTypes);

            res.should.have.status(200);
            res.body.should.be.an('array');
            const receivedTypes = res.body.map(metricsObj => metricsObj.type);
            receivedTypes.should.have.members(validTypes);
        });
    });
});
