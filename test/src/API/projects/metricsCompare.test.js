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

const containerService = require('../../../modules/container.service');
const projectService = require('../../../modules/project.service');
const reqService = require('../../../modules/request.service');
const { 
    ADMIN_COOKIE,
    MOCK_LOADTEST_DIR,
    TEMP_TEST_DIR,
    testTimeout,
} = require('../../../config');

chai.should();

const getProjectComparisonData = (projectID) => reqService.chai
    .get(`/api/v1/projects/${projectID}/compare`)
    .set('Cookie', ADMIN_COOKIE);

describe('Metrics Comparison tests (/projects/{id}/metrics/compare)', function() {
    const loadTest1 = '20190326154749';
    const loadTest2 = '20190326155248';
    
    const projectName = `test-metrics-compare-${Date.now()}`;
    const pathToLocalProject = path.join(TEMP_TEST_DIR, projectName);
    let projectID;
    let projectLoadTestPath;
    
    before('create project and get its loadTestPath', async function() {
        this.timeout(testTimeout.med);
        projectID = await projectService.createProjectFromTemplate(projectName, 'nodejs', pathToLocalProject);
        
        const { body: project } = await projectService.getProject(projectID);
        projectLoadTestPath = project.loadTestPath;
    });

    before('Insert 2 mock loadtest directories into the project directoy in codewind-workspace ', async function() {
        this.timeout(testTimeout.med);
        await containerService.ensureDir(path.join(projectLoadTestPath, loadTest1));
        await containerService.ensureDir(path.join(projectLoadTestPath, loadTest2));
        await containerService.copyTo(path.join(MOCK_LOADTEST_DIR, loadTest1), projectLoadTestPath);
        await containerService.copyTo(path.join(MOCK_LOADTEST_DIR, loadTest2), projectLoadTestPath);
    });

    after('Clean up by deleting project', async function() {
        this.timeout(testTimeout.med);
        await projectService.removeProject(pathToLocalProject, projectID);
    });

    describe('GET/projects/{id}/compare', function() {
        it('returns 404 when the project does not exist', async function() {
            this.timeout(testTimeout.short);
            const idMatchingNoProjects = '00000000-0000-0000-0000-000000000000';
            const res = await getProjectComparisonData(idMatchingNoProjects);
            
            res.status.should.equal(404, res.text); // print res.text if assertion fails
            res.should.satisfyApiSpec;
            res.text.should.equal(`Unable to find project ${idMatchingNoProjects}`);
        });
        
        it('returns 200 and the correct comparison data', async function() {
            this.timeout(testTimeout.short);
            const res = await getProjectComparisonData(projectID);
            
            res.status.should.equal(200, res.text); // print res.text if assertion fails
            res.should.satisfyApiSpec;
            res.body.should.deep.equal([
                {
                    type: 'cpu',
                    delta: {
                        systemMean: 33.78578678899425,
                        systemPeak: -7.461156507216988,
                        processMean: 38.30703185734448,
                        processPeak: -1.6961857346170888,
                    },
                },
                {
                    type: 'gc',
                    delta: { gcTime: -89.58151170595909 },
                },
                {
                    type: 'memory',
                    delta: {
                        usedHeapAfterGCPeak: -25.446072747477587,
                        usedNativePeak: -0.5372050979530131,
                    },
                },
                {
                    type: 'http',
                    delta: { averageHttpResponseTime: -27.15726800659997 },
                },
            ]);
        });

        it('returns 200 and valid data for all data types except CPU, when CPU data is deleted', async function() {
            this.timeout(testTimeout.med);
            await removeCpuDataFromMetricsJson(loadTest1);

            const res = await getProjectComparisonData(projectID);
            res.status.should.equal(200, res.text); // print res.text if assertion fails
            res.should.satisfyApiSpec;

            res.body.forEach((dataObj) => {
                const { type, delta } = dataObj;
                if (type === 'cpu') {
                    delta.should.equal('Data unavailable');
                } else {
                    delta.should.be.an('object');
                }
            });
        });

        it('returns 422 when there are fewer than 2 snapshots available', async function() {
            this.timeout(testTimeout.short);
            await deleteDataFromLoadTestRun(loadTest2);

            const res = await getProjectComparisonData(projectID);
            res.status.should.equal(422, res.text); // print res.text if assertion fails
            res.should.satisfyApiSpec;
        });
    });

    async function removeCpuDataFromMetricsJson(loadTest) {
        const pathToMetricsJson = path.join(projectLoadTestPath, loadTest, 'metrics.json');
        const metricsJson = await containerService.readJson(pathToMetricsJson);
        delete metricsJson.cpu;
        await containerService.writeJson(pathToMetricsJson, metricsJson);
    }

    function deleteDataFromLoadTestRun(loadTest) {
        return containerService.unlink(path.join(projectLoadTestPath, loadTest));
    }
});
