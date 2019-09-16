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

// Skip this test if remote mode isn't enabled.
if (process.env['REMOTE_MODE'] !== 'true') {
    return;
}

const chai = require('chai');
const path = require('path');
const fs = require('fs-extra');
const zlib = require('zlib');
const klawSync = require('klaw-sync');

const projectService = require('../../../../modules/project.service');
const reqService = require('../../../../modules/request.service');
const containerService = require('../../../../modules/container.service');
const { testTimeout, ADMIN_COOKIE } = require('../../../../config');

chai.should();

let pathToLocalRepo;

describe('Remote Bind tests', () => {
    let projectID;
    let workspace_location;
    let localProjectName;
    const remoteProjectName = `project-in-pfe-${Date.now()}`;

    before('use the git API to clone a project to disk, ready for upload to codewind', async function() {
        this.timeout(testTimeout.med);
        localProjectName = `project-to-bind-${Date.now()}`;
        workspace_location = await projectService.findWorkspaceLocation();
        pathToLocalRepo = path.join(workspace_location, localProjectName);
        await projectService.cloneProject(
            'https://github.com/microclimate-dev2ops/microclimateNodeTemplate.git',
            pathToLocalRepo,
        );
    });

    after(async function() {
        this.timeout(testTimeout.med);
        await projectService.unbindProject(projectID);
        await projectService.deleteProjectDir(remoteProjectName);
        await projectService.deleteProjectDir(localProjectName);
    });

    describe('Complete remote-bind', () => {
        describe('Success Case', () => {
            it('succeeds in creating a project, uploading files to it, and then building the project', async function() {
                this.timeout(testTimeout.med);
                const res = await testRemoteBindStart(remoteProjectName);
                projectID = res.body.projectID;
                const projectIDs  = await projectService.getProjectIDs();
                projectIDs.should.include(projectID);
                await testRemoteBindUpload(projectID, remoteProjectName, pathToLocalRepo);
                await testRemoteBindEnd(projectID);
            });
        });
    });
    describe('POST /remote-bind/start', () => {
        describe('Failure Cases', () => {
            it('returns 400 if projectName is invalid', async function() {
                this.timeout(testTimeout.short);
                const res = await startRemoteBind({
                    name: '<',
                    language: 'nodejs',
                    projectType: 'nodejs',
                });
                res.should.have.status(400);
            });
            it('returns 400 if projectType is invalid', async function() {
                this.timeout(testTimeout.short);
                const res = await startRemoteBind({
                    name: remoteProjectName,
                    language: 'nodejs',
                    projectType: 'invalid',
                });
                res.should.have.status(400);
            });
        });
    });
    describe('PUT /remote-bind/upload', () => {
        describe('Failure Cases', () => {
            it('returns 400 for a project that does not exist', async function() {
                this.timeout(testTimeout.short);
                const invalidID = 'doesnotexist';
                const pathOfFileToCheck = `${pathToLocalRepo}/package.json`;
                const res = await uploadFile(invalidID, pathOfFileToCheck);
                res.should.have.status(404);
            });
        });
    });
    describe('POST /remote-bind/end', () => {
        describe('Failure Cases', () => {
            it('returns 400 for a project that does not exist', async function() {
                this.timeout(testTimeout.short);
                const invalidID = 'doesnotexist';
                const res = await endRemoteBind(invalidID);
                res.should.have.status(404);
            });
        });
    });
});

async function testRemoteBindStart(projectName){
    const res = await startRemoteBind({
        name: projectName,
        language: 'nodejs',
        projectType: 'nodejs',
    });
    res.should.have.status(202);
    const expectedFields = ['projectID', 'name', 'workspace', 'locOnDisk'];
    expectedFields.forEach(field => {
        res.body[field].should.not.be.null;
    });
    return res;
};

async function testRemoteBindUpload(projectID, projectName, pathToDirToUpload) {
    const filePaths = recursivelyGetAllPaths(pathToDirToUpload);
    for (const filePath of filePaths) {
        const res = await uploadFile(projectID, filePath);
        res.should.have.status(200);
    }
    const fileToCheck = path.join('codewind-workspace', projectName, 'package.json');
    const fileExists = await containerService.fileExists(fileToCheck);
    fileExists.should.be.true;
};

async function testRemoteBindEnd(projectID) {
    const endRes = await endRemoteBind(projectID);
    endRes.should.have.status(200);
    await projectService.awaitProjectBuilding(projectID);
};

function recursivelyGetAllPaths(inputPath) {
    const paths = klawSync(inputPath,  { nodir: true });
    const filePaths = paths.map((path) => path.path);
    return filePaths;
};

async function startRemoteBind(options) {
    const res = await reqService.chai
        .post('/api/v1/projects/remote-bind/start')
        .set('Cookie', ADMIN_COOKIE)
        .send(options);
    return res;
};

async function endRemoteBind(projectID) {
    const res = await reqService.chai
        .post(`/api/v1/projects/${projectID}/remote-bind/end`)
        .set('Cookie', ADMIN_COOKIE);
    return res;
};

async function uploadFile(projectID, filePath) {
    const fileContent = JSON.stringify(fs.readFileSync(filePath, 'utf-8'));
    const zippedContent = zlib.deflateSync(fileContent);
    const base64CompressedContent = zippedContent.toString('base64');
    const relativePathToFile = path.relative(pathToLocalRepo, filePath);
    const options = {
        directory: false,
        path: relativePathToFile,
        timestamp: Date.now(),
        msg: base64CompressedContent,
    };
    const res = await uploadZippedFileUsingPfeApi (projectID, options);
    return res;
};

async function uploadZippedFileUsingPfeApi(projectID, options) {
    const res = await reqService.chai
        .put(`/api/v1/projects/${projectID}/remote-bind/upload`)
        .set('Cookie', ADMIN_COOKIE)
        .send(options);
    return res;
}

