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
const chaiResValidator = require('chai-openapi-response-validator');

const projectService = require('../../../modules/project.service');
const containerService = require('../../../modules/container.service');
const { testTimeout, TEMP_TEST_DIR, pathToApiSpec } = require('../../../config');

chai.use(chaiResValidator(pathToApiSpec));
chai.should();

describe('Bind projects tests', () => {
    const projectName = `test-projects-bind-${Date.now()}`;
    const pathToLocalProject = path.join(TEMP_TEST_DIR, projectName);
    let projectID;

    before('use the git API to clone a project to disk, ready for upload to codewind', async function() {
        this.timeout(testTimeout.med);
        await projectService.cloneProject(
            'https://github.com/codewind-resources/nodeExpressTemplate.git',
            pathToLocalProject,
        );
    });

    after(function() {
        this.timeout(testTimeout.med);
        fs.removeSync(pathToLocalProject);
    });

    describe('Complete bind and unbind (these `it` blocks depend on each other passing)', () => {
        it('returns 202 when starting the bind process', async function() {
            this.timeout(testTimeout.med);

            const res = await projectService.bindStart({
                name: projectName,
                language: 'nodejs',
                projectType: 'nodejs',
                path: pathToLocalProject,
                creationTime: Date.now(),
            });

            res.should.have.status(202);
            res.should.satisfyApiSpec;
            
            const pathToPfeTempProjectDir = path.join('codewind-workspace', 'cw-temp', projectName);
            const pfeTempProjectDirExists = await containerService.dirExists(pathToPfeTempProjectDir);
            pfeTempProjectDirExists.should.be.true;

            projectID = res.body.projectID;
        });
        it('returns 200 for each file successfully uploaded to PFE', async function() {
            this.timeout(testTimeout.med);

            const responses = await projectService.uploadFiles(projectID, pathToLocalProject, 'nodejs');

            responses.forEach(res => {
                res.should.have.status(200);
                res.should.satisfyApiSpec;
            });
            const pathToUploadedFile = path.join('codewind-workspace', 'cw-temp', projectName, 'package.json');
            const uploadedFileExists = await containerService.fileExists(pathToUploadedFile);
            uploadedFileExists.should.be.true;
        });
        it('returns 200 when ending the bind process', async function() {
            this.timeout(testTimeout.short);
            
            const res = await projectService.bindEnd(projectID);
            res.should.have.status(200);
            res.should.satisfyApiSpec;
            
            const pathToPfeTempProjectDir = path.join('codewind-workspace', 'cw-temp', projectName);
            const pfeTempProjectDirExists = await containerService.dirExists(pathToPfeTempProjectDir);
            pfeTempProjectDirExists.should.be.true;
            
            const pathToPfeProjectDir = path.join('codewind-workspace', projectName);
            const pfeProjectDirExists = await containerService.dirExists(pathToPfeProjectDir);
            pfeProjectDirExists.should.be.true;
        });
        it('returns 409 when trying to bind a project with the same name', async function() {
            const originalNumProjects = await projectService.countProjects();
            const res = await projectService.bindStart({
                name: projectName,
                language: 'nodejs',
                projectType: 'nodejs',
                path: pathToLocalProject,
                creationTime: Date.now(),
            });

            res.should.have.status(409);
            res.should.satisfyApiSpec;

            const finalNumProjects = await projectService.countProjects();
            finalNumProjects.should.equal(originalNumProjects);
        });
        it('returns 202 when unbinding the project', async function() {
            this.timeout(testTimeout.short);
            
            const res = await projectService.unbind(projectID);
            res.should.have.status(202);
            res.should.satisfyApiSpec;
            
            const pathToPfeTempProjectDir = path.join('codewind-workspace', 'cw-temp', projectName);
            const pfeTempProjectDirExists = await containerService.dirExists(pathToPfeTempProjectDir);
            pfeTempProjectDirExists.should.be.false;
            
            const pathToPfeProjectDir = path.join('codewind-workspace', projectName);
            const pfeProjectDirExists = await containerService.dirExists(pathToPfeProjectDir);
            pfeProjectDirExists.should.be.false;
        });
    });
    describe('POST /bind/start', () => {
        describe('Failure Cases', () => {
            it('returns 400 if projectName is invalid', async function() {
                this.timeout(testTimeout.short);
                const res = await projectService.bindStart({
                    name: '&',
                    language: 'nodejs',
                    projectType: 'nodejs',
                    path: 'valid/path',
                    creationTime: Date.now(),
                });
                res.should.have.status(400);
                res.body.message.should.equal('Project name is invalid: invalid characters : ["&"]');
            });
            it('returns 400 if projectType is invalid', async function() {
                this.timeout(testTimeout.short);
                const res = await projectService.bindStart({
                    name: projectName,
                    language: 'nodejs',
                    projectType: 'invalid',
                    path: 'valid/path',
                    creationTime: Date.now(),
                });
                res.should.have.status(400);
                res.text.should.equal('projects must specify a valid project type');
            });
        });
    });
    describe('PUT /upload', () => {
        describe('Failure Cases', () => {
            it('returns 404 for a project that does not exist', async function() {
                this.timeout(testTimeout.short);
                const idMatchingNoProjects = '00000000-0000-0000-0000-000000000000';
                const res = await projectService.uploadFile(
                    idMatchingNoProjects,
                    pathToLocalProject,
                    'package.json',
                );
                res.should.have.status(404);
            });
        });
    });
    describe('POST /bind/end', () => {
        describe('Failure Cases', () => {
            it('returns 404 for a project that does not exist', async function() {
                this.timeout(testTimeout.short);
                const idMatchingNoProjects = '00000000-0000-0000-0000-000000000000';
                const res = await projectService.bindEnd(idMatchingNoProjects);
                res.should.have.status(404);
                res.text.should.equal(`Unable to find project ${idMatchingNoProjects}`);
            });
        });
    });
    describe('POST /unbind', () => {
        describe('Failure Cases', () => {
            it('returns 404 for a project that does not exist', async function() {
                this.timeout(testTimeout.short);
                const idMatchingNoProjects = '00000000-0000-0000-0000-000000000000';
                const res = await projectService.unbind(idMatchingNoProjects, 404);
                res.should.have.status(404);
                res.text.should.equal(`Unable to find project ${idMatchingNoProjects}`);
            });
        });
    });
});
