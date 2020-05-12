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
const chaiSubset = require('chai-subset');
const chaiResValidator = require('chai-openapi-response-validator');

const projectService = require('../../../modules/project.service');
const reqService = require('../../../modules/request.service');
const {
    ADMIN_COOKIE,
    TEMP_TEST_DIR,
    testTimeout,
    pathToApiSpec,
} = require('../../../config');

chai.use(chaiSubset);
chai.use(chaiResValidator(pathToApiSpec));
chai.should();

const postMetricsAuth = (projectID, options) => reqService.chai
    .post(`/api/v1/projects/${projectID}/metrics/auth`)
    .set('Cookie', ADMIN_COOKIE)
    .send(options);

describe('Metrics Auth tests (/api/v1/projects/{id}/metrics/auth)', function() {
    it('returns 404 to /metrics/auth when project does not exist', async function() {
        const projectID = '00000000-0000-0000-0000-000000000000';
        this.timeout(testTimeout.short);
        const res = await postMetricsAuth(projectID, { disable: true });

        res.status.should.equal(404, res.text); // print res.text if assertion fails
        res.text.should.equal(`Project with ID \'${projectID}\' does not exist on the Codewind server`);
    });

    describe('Disables and enables the metrics authentication of an open-liberty application (these `it` blocks depend on each other passing)', function() {
        const projectName = `test-open-liberty-metrics-auth-${Date.now()}`;
        const pathToLocalProject = path.join(TEMP_TEST_DIR, projectName);
        let projectID;

        before('create a sample project and bind to Codewind, without building', async function() {
            this.timeout(testTimeout.med);
            projectID = await projectService.createProjectFromTemplate(projectName, 'openliberty', pathToLocalProject); 
        });

        after(async function() {
            this.timeout(testTimeout.med);
            await projectService.removeProject(pathToLocalProject, projectID);
        });

        it('returns 202 to /metrics/auth and adds the disable metrics authentication file into the user\'s project', async function() {
            this.timeout(testTimeout.short);
            const res = await postMetricsAuth(projectID, { disable: true });
            res.status.should.equal(202, res.text); // print res.text if assertion fails
        });

        it('returns 202 to /metrics/auth and removes the disable metrics authentication file into the user\'s project', async function() {
            this.timeout(testTimeout.short);
            const res = await postMetricsAuth(projectID, { disable: false });
            res.status.should.equal(202, res.text); // print res.text if assertion fails
        });
    });
});
