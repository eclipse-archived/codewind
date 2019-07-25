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
const fs = require('fs');
const path = require('path');
const reqService = require('../modules/request.service');
const projectService = require('../modules/project.service');
const { ADMIN_COOKIE, testTimeout } = require('../config');

chai.should();

const getRegistryStatus = () => reqService.chai
    .get('/api/v1/registry')
    .set('Cookie', ADMIN_COOKIE);

const testRegistry = () => reqService.chai
    .post('/api/v1/registry')
    .set('Cookie', ADMIN_COOKIE)
    .send({ deploymentRegistry: 'someregistry' });

const getWatchList = () => reqService.chai
    .get('/api/v1/projects/watchlist')
    .set('Cookie', ADMIN_COOKIE);

async function putWatchStatus(projectID, projectWatchStateId) {
    const req = () => reqService.chai
        .put(`/api/v1/projects/${projectID}/file-changes/${projectWatchStateId}/status`)
        .set('Cookie', ADMIN_COOKIE)
        .send({ success: true });
    const expectedSocketMsg = {
        projectID,
        msgType: 'projectWatchStatusChanged',
        expectedProperties: {
            status: 'success',
            projectWatchStateId,
        },
    };
    await reqService.makeReqAndAwaitSocketMsg(req, 200, expectedSocketMsg);
}

describe('Deployment Registry route tests', function() {
    let workspace_location;
    let workspace_settings_file;
    let workspace_settings_file_bk;
    let projectID;
    let projectWatchStateId;
    const workspace_settings_file_content = { deploymentRegistry: 'someregistry' };
    const workspace_settings_file_no_registry_content = { deploymentRegistryGarbage: 'someregistry' };
    
    describe('GET /api/v1/registry', function() {

        before('Create a backup of any existing ${workspace_location}/.config/settings.json file and set the watch status', async function() {
            this.timeout(testTimeout.med);

            workspace_location = await projectService.findWorkspaceLocation();
            workspace_settings_file = path.join(workspace_location, '.config', 'settings.json');
            workspace_settings_file_bk = path.join(workspace_location, '.config', 'settings_bk.json');

            // Create backup of existing workspace settings file
            if (fs.existsSync(workspace_settings_file)) {
                fs.renameSync(workspace_settings_file, workspace_settings_file_bk);
            }

            // Get the watch list for workspace config dir
            const res = await getWatchList();
            res.should.have.status(200);
            const projectsWatchList = res.body.projects;
            for (let i = 0; i < projectsWatchList.length; i++) {
                if (projectsWatchList[i].pathToMonitor.includes('.config')) {
                    projectID = projectsWatchList[i].projectID;
                    projectWatchStateId = projectsWatchList[i].projectWatchStateId;
                }
            }

            // Set the watch status for workspace config
            await putWatchStatus(projectID, projectWatchStateId);
        });

        after('Restore ${workspace_location}/.config/settings_bk.json file', async function() {
            this.timeout(testTimeout.med);

            // Restore the workspace settings file backup if it exists
            if (fs.existsSync(workspace_settings_file) && fs.existsSync(workspace_settings_file_bk)) {
                fs.renameSync(workspace_settings_file_bk, workspace_settings_file);
            }
        });

        it('should return false without ${workspace_location}/.config/settings.json', async function() {
            this.timeout(testTimeout.med);

            const res = await getRegistryStatus();
            res.should.have.status(200);
            res.body.deploymentRegistry.should.equal(false);
        });

        it('should return false without a deploymentRegistry in ${workspace_location}/.config/settings.json', async function() {
            this.timeout(testTimeout.med);

            const workspace_settings_file_content_json = JSON.stringify(workspace_settings_file_no_registry_content);
            fs.writeFileSync(workspace_settings_file, workspace_settings_file_content_json, 'utf8');

            const res = await getRegistryStatus();
            res.should.have.status(200);
            res.body.deploymentRegistry.should.equal(false);
        });

        it('should return false with a bad JSON in ${workspace_location}/.config/settings.json', async function() {
            this.timeout(testTimeout.med);

            const workspace_settings_file_content_json = '{"deploymentRegistryGarbage":"someregistry"';
            fs.writeFileSync(workspace_settings_file, workspace_settings_file_content_json, 'utf8');

            const res = await getRegistryStatus();
            res.should.have.status(200);
            res.body.deploymentRegistry.should.equal(false);
        });

        it('should return true with a deploymentRegistry in ${workspace_location}/.config/settings.json', async function() {
            this.timeout(testTimeout.med);

            const workspace_settings_file_content_json = JSON.stringify(workspace_settings_file_content);
            fs.writeFileSync(workspace_settings_file, workspace_settings_file_content_json, 'utf8');

            const res = await getRegistryStatus();
            res.should.have.status(200);
            res.body.deploymentRegistry.should.equal(true);
        });
    });

    describe('POST /api/v1/registry', function() {
        it('should return an internal error since buildah is not supported in the local case', async function() {
            this.timeout(testTimeout.med);

            const res = await testRegistry();
            res.should.have.status(500);
            res.body.deploymentRegistryTest.should.equal(false);
        });
    });
});