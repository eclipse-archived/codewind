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
const os = require('os');
const path = require('path');
const reqService = require('../../modules/request.service');
const containerService = require('../../modules/container.service');
const { ADMIN_COOKIE, testTimeout } = require('../../config');

chai.should();

const getRegistryStatus = () => reqService.chai
    .get('/api/v1/registry')
    .set('Cookie', ADMIN_COOKIE);

const testRegistry = () => reqService.chai
    .post('/api/v1/registry')
    .set('Cookie', ADMIN_COOKIE)
    .send({ operation: 'test', deploymentRegistry: 'someregistry' });

const setRegistry = (registry) => reqService.chai
    .post('/api/v1/registry')
    .set('Cookie', ADMIN_COOKIE)
    .send({ operation: 'set', deploymentRegistry: registry });

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

// Skipped because we have no projects to watch, resulting in an error in the before block
// (Due to feeding a `projectID` of `undefined` to line 94: `await putWatchStatus(projectID, projectWatchStateId);`)
describe.skip('Deployment Registry route tests', function() {
    const workspace_settings_file = '/codewind-workspace/.config/settings.json';

    let projectID;
    let projectWatchStateId;
    const workspace_settings_file_content = { deploymentRegistry: 'someregistry' };
    const workspace_settings_file_no_registry_content = { deploymentRegistryGarbage: 'garbagevalue' };

    let restoreConfig = false;

    before('Create a backup of any existing ${workspace_location}/.config/settings.json file and set the watch status', async function() {
        this.timeout(testTimeout.med);

        // Create backup of existing workspace settings file
        if (await containerService.fileExists(workspace_settings_file)) {
            await containerService.copyFrom(workspace_settings_file, path.join(os.tmpdir(), 'settings_bk.json'));
            restoreConfig = true;
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
        if (restoreConfig) {
            await containerService.copyTo(path.join(os.tmpdir(), 'settings_bk.json'), workspace_settings_file);
        }
    });

    describe('GET /api/v1/registry', function() {


        it('should return false without ${workspace_location}/.config/settings.json', async function() {
            this.timeout(testTimeout.med);
            await containerService.unlink(workspace_settings_file);
            const res = await getRegistryStatus();
            res.should.have.status(200);
            res.body.deploymentRegistry.should.equal(false);
        });

        it('should return false without a deploymentRegistry in ${workspace_location}/.config/settings.json', async function() {
            this.timeout(testTimeout.med);

            const workspace_settings_file_content_json = JSON.stringify(workspace_settings_file_no_registry_content);
            const content_file = path.join(os.tmpdir(), 'no_registry.json');
            fs.writeFileSync(content_file, workspace_settings_file_content_json, 'utf8');
            await containerService.copyTo(content_file, workspace_settings_file);
            fs.unlinkSync(content_file);

            const res = await getRegistryStatus();
            res.should.have.status(200);
            res.body.deploymentRegistry.should.equal(false);
        });

        it('should return false with bad JSON in ${workspace_location}/.config/settings.json', async function() {
            this.timeout(testTimeout.med);

            const bad_workspace_settings_file_content_json = '{"deploymentRegistryGarbage":"someregistry"';
            const content_file = path.join(os.tmpdir(), 'bad_content.json');
            fs.writeFileSync(content_file, bad_workspace_settings_file_content_json, 'utf8');
            await containerService.copyTo(content_file, workspace_settings_file);
            fs.unlinkSync(content_file);

            const res = await getRegistryStatus();
            res.should.have.status(500);
            res.body.deploymentRegistry.should.equal(false);
        });

        it('should return true with a deploymentRegistry in ${workspace_location}/.config/settings.json', async function() {
            this.timeout(testTimeout.med);

            const workspace_settings_file_content_json = JSON.stringify(workspace_settings_file_content);
            const content_file = path.join(os.tmpdir(), 'deploymentRegistry.json');
            fs.writeFileSync(content_file, workspace_settings_file_content_json, 'utf8');
            await containerService.copyTo(content_file, workspace_settings_file);
            fs.unlinkSync(content_file);

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
            res.body.imagePushRegistryTest.should.equal(false);
        });

        it('should set the registry to the specified value', async function() {
            this.timeout(testTimeout.med);

            const newRegistry = 'localhost:5000';
            const setRes = await setRegistry(newRegistry);
            setRes.should.have.status(200);

            const statusRes = await getRegistryStatus();
            statusRes.should.have.status(200);
            statusRes.body.deploymentRegistry.should.equal(true);

            const settings = await containerService.readJson(workspace_settings_file);
            settings.deploymentRegistry.should.equal(newRegistry);
        });
    });
});
