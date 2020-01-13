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
const zlib = require('zlib');
const klawSync = require('klaw-sync');

const projectService = require('../../modules/project.service');
const reqService = require('../../modules/request.service');
const containerService = require('../../modules/container.service');
const { testTimeout, ADMIN_COOKIE } = require('../../config');

chai.should();

const localProjectName = `project-to-bind-${Date.now()}`;
const workspace_location = '.';
// const workspace_location = '/Users/richard.waller@ibm.com/codewind-workspace';
const pathToLocalRepo = path.join(workspace_location, localProjectName);

describe.only('Remote Bind tests', () => {
    let projectID;

    before('use the git API to clone a project to disk, ready for upload to codewind', async function() {
        this.timeout(testTimeout.med);
        await projectService.cloneProject(
            'https://github.com/microclimate-dev2ops/microclimateNodeTemplate.git',
            pathToLocalRepo,
        );
    });

    after(async function() {
        this.timeout(testTimeout.med);
        await projectService.unbindProject(projectID);
        fs.removeSync(pathToLocalRepo);
        // await projectService.deleteProjectDir(remoteProjectName);
    });

    describe('Complete remote-bind', () => {
        describe.only('Success Case', () => {
            it('succeeds in creating a project, uploading files to it, and then building the project', async function() {
                this.timeout(testTimeout.med);

                const res = await testRemoteBindStart(localProjectName, pathToLocalRepo);
                projectID = res.body.projectID;
                console.assert(projectID, res.body);
                const projectIDs  = await projectService.getProjectIDs();
                projectIDs.should.include(projectID);
                await testRemoteBindUpload(projectID, localProjectName, pathToLocalRepo);
                await testRemoteBindEnd(projectID);
            });
        });
    });
    describe('POST /bind/start', () => {
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
                    name: localProjectName,
                    language: 'nodejs',
                    projectType: 'invalid',
                });
                res.should.have.status(400);
            });
        });
    });
    describe('PUT /bind/upload', () => {
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
    describe('POST /bind/end', () => {
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

async function testRemoteBindStart(projectName, pathToLocalRepo){
    const res = await startRemoteBind({
        name: projectName,
        language: 'nodejs',
        projectType: 'nodejs',
        path: pathToLocalRepo,
    });
    res.should.have.status(202);
    const expectedFields = ['projectID', 'name', 'workspace'];
    expectedFields.forEach(field => {
        res.body[field].should.not.be.null;
    });
    return res;
};

async function testRemoteBindUpload(projectID, projectName, pathToDirToUpload) {
    const filePaths = recursivelyGetAllPaths(pathToDirToUpload);
    // console.log('filePaths');
    // console.log(filePaths);
    for (const filePath of filePaths) {
        const res = await uploadFile(projectID, filePath);
        res.should.have.status(200);
    }
    const fileToCheck = path.join('codewind-workspace/cw-temp', projectName, 'package.json');
    const cwTemp = await containerService.readDir('codewind-workspace/cw-temp');
    console.log('cwTemp');
    console.log(cwTemp);
    const fileExists = await containerService.fileExists(fileToCheck);
    fileExists.should.be.true;
};

async function testRemoteBindEnd(projectID) {
    const endRes = await endRemoteBind(projectID);
    endRes.should.have.status(200);
    console.log('endRes.body');
    console.log(endRes.body);
    await projectService.awaitProjectBuilding(projectID);
    console.log('projectBuilt');
};

function recursivelyGetAllPaths(inputPath) {
    const paths = klawSync(inputPath,  { nodir: true });
    const filePaths = paths.map((path) => path.path);
    return filePaths;
};

async function startRemoteBind(options) {
    const res = await reqService.chai
        .post('/api/v1/projects/bind/start')
        .set('Cookie', ADMIN_COOKIE)
        .send(options);
    return res;
};

async function endRemoteBind(projectID) {
    const res = await reqService.chai
        .post(`/api/v1/projects/${projectID}/bind/end`)
        .set('Cookie', ADMIN_COOKIE)
        .send({ id: projectID });
    return res;
};

async function uploadFile(projectID, filePath) {
    const fileContent = JSON.stringify(fs.readFileSync(filePath, 'utf-8'));
    const zippedContent = zlib.deflateSync(fileContent);
    const base64CompressedContent = zippedContent.toString('base64');
    const relativePathToFile = path.relative(pathToLocalRepo, filePath);
    const options = {
        isDirectory: false,
        mode: 420,
        path: relativePathToFile,
        msg: base64CompressedContent,
    };
    const res = await uploadZippedFileUsingPfeApi (projectID, options);
    return res;
};

async function uploadZippedFileUsingPfeApi(projectID, options) {
    const res = await reqService.chai
        .put(`/api/v1/projects/${projectID}/upload`)
        .set('Cookie', ADMIN_COOKIE)
        .send(options);
    return res;
}
