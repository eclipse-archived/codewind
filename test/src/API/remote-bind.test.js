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

const projectService = require('../../modules/project.service');
const containerService = require('../../modules/container.service');
const { testTimeout, TEMP_TEST_DIR } = require('../../config');

chai.should();

describe('Remote Bind tests', () => {
    const projectName = `project-to-bind-${Date.now()}`;
    const pathToLocalRepo = path.join(TEMP_TEST_DIR, projectName);
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
        await projectService.removeProject(pathToLocalRepo, projectID);
    });

    describe('Complete bind (these `it` blocks depend on each other passing)', () => {
        it('returns 202 when starting the bind process', async function() {
            this.timeout(testTimeout.med);

            const res = await projectService.bindStart({
                name: projectName,
                language: 'nodejs',
                projectType: 'nodejs',
                path: pathToLocalRepo,
                creationTime: Date.now(),
            });

            res.should.have.status(202);
            const expectedFields = ['projectID', 'name', 'workspace'];
            expectedFields.forEach(field => {
                res.body[field].should.not.be.null;
            });
            projectID = res.body.projectID;
        });
        it('returns 200 for each file it uploads to PFE', async function() {
            this.timeout(testTimeout.med);

            await projectService.uploadFiles(projectID, pathToLocalRepo);

            const pathToUploadedFile = path.join('codewind-workspace', 'cw-temp', projectName, 'package.json');
            const uploadedFileExists = await containerService.fileExists(pathToUploadedFile);
            uploadedFileExists.should.be.true;
        });
        it('returns 200 when ending the bind process, then builds the project', async function() {
            const res = await projectService.bindEnd(projectID);
            res.should.have.status(200);
            await projectService.awaitProjectBuilding(projectID);
        });
        it('returns 409 when trying to bind a project that is already bound', async function() {
            const originalNumProjects = await projectService.countProjects();
            await projectService.bindStart({
                name: projectName,
                language: 'nodejs',
                projectType: 'nodejs',
                path: pathToLocalRepo,
            });
            const finalNumProjects = await projectService.countProjects();
            finalNumProjects.should.equal(originalNumProjects);
        });
    });
    describe('POST /bind/start', () => {
        describe('Failure Cases', () => {
            it('returns 400 if projectName is invalid', async function() {
                this.timeout(testTimeout.short);
                const res = await projectService.bindStart({
                    name: '<',
                    language: 'nodejs',
                    projectType: 'nodejs',
                });
                res.should.have.status(400);
            });
            it('returns 400 if projectType is invalid', async function() {
                this.timeout(testTimeout.short);
                const res = await projectService.bindStart({
                    name: projectName,
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
                const res = await projectService.uploadFile(
                    invalidID,
                    pathToLocalRepo,
                    'package.json',
                );
                res.should.have.status(404);
            });
        });
    });
    describe('POST /bind/end', () => {
        describe('Failure Cases', () => {
            it('returns 400 for a project that does not exist', async function() {
                this.timeout(testTimeout.short);
                const invalidID = 'doesnotexist';
                const res = await projectService.bindEnd(invalidID);
                res.should.have.status(404);
            });
        });
    });
});
