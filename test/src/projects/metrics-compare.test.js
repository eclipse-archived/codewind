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

const containerService = require('../../modules/container.service');
const projectService = require('../../modules/project.service');
const reqService = require('../../modules/request.service');
const { ADMIN_COOKIE, METRIC_TYPES, MOCK_LOADTEST_DIR, testTimeout } = require('../../config');

chai.should();
const loadTest1 = '20190326154749';
const loadTest2 = '20190326155248';

// Expected data returned from comparison of 20180712140904 and 20180713120741 load runs
const expectedComparisonData = [
    {
        type: 'cpu',
        delta:
        {
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
        delta:
        {
            usedHeapAfterGCPeak: -25.446072747477587,
            usedNativePeak: -0.5372050979530131,
        },
    },
    {
        type: 'http',
        delta: { averageHttpResponseTime: -27.15726800659997 },
    },
];

const getProjectComparisonData = (projectID) => reqService.chai
    .get(`/api/v1/projects/${projectID}/compare`)
    .set('Cookie', ADMIN_COOKIE);

describe('Metrics Comparison tests', function() {
    const projectName = `metricscompare${Date.now()}`;
    let projectID;
    let projectLoadTestPath;

    before('Create project and get loadTestPath', async function() {
        this.timeout(testTimeout.med);
        projectID = await projectService.cloneAndBindProject(projectName, 'nodejs');

        const project = await projectService.getProject(projectID);
        projectLoadTestPath = project.loadTestPath;
    });

    before('Copy across 2 test data directories', async function() {
        this.timeout(testTimeout.med);
        await containerService.ensureDir(path.join(projectLoadTestPath, loadTest1));
        await containerService.ensureDir(path.join(projectLoadTestPath, loadTest2));
        await containerService.copyTo(path.join(MOCK_LOADTEST_DIR, loadTest1), projectLoadTestPath);
        await containerService.copyTo(path.join(MOCK_LOADTEST_DIR, loadTest2), projectLoadTestPath);
    });

    after('Clean up by deleting project', async function() {
        this.timeout(testTimeout.med);
        await projectService.unbindProject(projectID);
        await projectService.deleteProjectDir(projectName);
    });

    describe('GET/projects/{id}/compare', function() {
        it('returns the correct comparison data', async function() {
            this.timeout(testTimeout.short);
            const res = await getProjectComparisonData(projectID);
            res.should.have.status(200);
            res.body.should.deep.equal(expectedComparisonData);
        });

        it('returns 404 if the given project does not exist', async function() {
            this.timeout(testTimeout.short);
            const res = await getProjectComparisonData('blahblah');
            res.should.have.status(404);
        });

        it('returns, when CPU data is deleted, valid data for all data types except CPU', async function() {
            this.timeout(testTimeout.med);
            await removeDataFromMetricsFile();

            const res = await getProjectComparisonData(projectID);
            res.body.length.should.equal(METRIC_TYPES.length);
            for (const data of res.body) {
                if (data.type === 'cpu') {
                    data.delta.should.equal('Data unavailable');
                } else {
                    //Ensure other data is still valid
                    data.delta.should.be.an('object');
                    METRIC_TYPES.should.include(data.type);
                }
            }
        });

        it('returns status 422 if there are fewer than 2 snapshots available', async function() {
            this.timeout(testTimeout.short);
            await deleteLoadTestRun();

            const res = await getProjectComparisonData(projectID);
            res.should.have.status(422);
        });
    });

    // Read metrics file, set data to null and write it back
    async function removeDataFromMetricsFile(
        dataKey = 'cpu',
        test = loadTest1,
        file = 'metrics.json',
    ) {
        const metricsFile = await containerService.readFile(path.join(projectLoadTestPath, test, file));
        const parsedMetrics = JSON.parse(metricsFile);
        parsedMetrics[dataKey] = null;
        await fs.writeJSON('tmp.json', parsedMetrics);
        await containerService.copyTo('tmp.json', path.join(projectLoadTestPath, loadTest1, file));
    }

    function deleteLoadTestRun() {
        return containerService.unlink(path.join(projectLoadTestPath, loadTest2));
    }
});
