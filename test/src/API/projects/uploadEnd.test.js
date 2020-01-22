/*******************************************************************************
 * Copyright (c) 2020 IBM Corporation and others.
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

describe('Sync tests (POST projects/{id}/upload/end)', () => {
    // These are for the nodejs template at https://github.com/codewind-resources/nodeExpressTemplate
    const validFileList = [
        '.cw-settings',
        '.dockerignore',
        '.gitignore',
        'Dockerfile',
        'Dockerfile-tools',
        'chart/node/Chart.yaml',
        'chart/node/templates/basedeployment.yaml',
        'chart/node/templates/deployment.yaml',
        'chart/node/templates/hpa.yaml',
        'chart/node/templates/istio.yaml',
        'chart/node/templates/service.yaml',
        'chart/node/values.yaml',
        'cli-config.yml',
        'nodemon.json',
        'package.json',
        'public/404.html',
        'public/500.html',
        'public/index.html',
        'server/config/local.json',
        'server/routers/codewind.js',
        'server/routers/health.js',
        'server/routers/index.js',
        'server/routers/public.js',
        'server/server.js',
        'test/test-demo.js',
        'test/test-server.js',
    ];
    const validDirList = [
        'chart',
        'chart/node',
        'chart/node/templates',
        'public',
        'server',
        'server/config',
        'server/routers',
        'test',
    ];

    describe('Sync modified file (these `it` blocks depend on each other passing)', function() {
        const projectName = `test-sync-modified-file-${Date.now()}`;
        const pathToLocalProject = path.join(TEMP_TEST_DIR, projectName);
        const pathFromDirToModifiedFile = 'server/routers/health.js';
        let newFileContents;
        let projectID;

        before('create a sample project and bind to Codewind, without building', async function() {
            this.timeout(testTimeout.med);
            projectID = await projectService.createProjectFromTemplate(projectName, 'nodejs', pathToLocalProject);
        });

        before('modify a local file', function() {
            this.timeout(testTimeout.med);
            const filepath = path.join(pathToLocalProject, pathFromDirToModifiedFile);
            const originalFileContents = fs.readFileSync(filepath);
            newFileContents = `${originalFileContents}\nconsole.log('foo');\n`;
            fs.writeFileSync(filepath, newFileContents);
        });

        after(async function() {
            this.timeout(testTimeout.med);
            await projectService.removeProject(pathToLocalProject, projectID);
        });

        it('returns 200 when uploading the modified file', async function() {
            this.timeout(testTimeout.med);
            const res = await projectService.uploadFile(
                projectID,
                pathToLocalProject,
                pathFromDirToModifiedFile,
            );

            res.should.have.status(200);
            res.should.satisfyApiSpec;

            const pathToFileInPfeTempDir = path.join('codewind-workspace', 'cw-temp', projectName, pathFromDirToModifiedFile);
            const fileExistsInPfeTempDir = await containerService.fileExists(pathToFileInPfeTempDir);
            fileExistsInPfeTempDir.should.be.true;
        });

        it('returns 200 and correctly syncs the project when POST upload/end is called', async function() {
            this.timeout(testTimeout.med);
            const options = {
                fileList: validFileList,
                directoryList: validDirList,
                modifiedList: [
                    pathFromDirToModifiedFile,
                ],
                timeStamp: Date.now(),
            };
            const res = await projectService.uploadEnd(projectID, options);

            res.should.have.status(200);
            res.should.satisfyApiSpec;

            const pathToFileInPfeProjectDir = path.join('codewind-workspace', projectName, pathFromDirToModifiedFile);
            const contentsOfFileInPfeProjectDir = await containerService.readFile(pathToFileInPfeProjectDir);
            contentsOfFileInPfeProjectDir.should.deep.equal(newFileContents);
        });
    });

    describe('Sync new file (these `it` blocks depend on each other passing)', function() {
        const projectName = `test-sync-new-file-${Date.now()}`;
        const pathToLocalProject = path.join(TEMP_TEST_DIR, projectName);
        const pathFromDirToNewFile = 'newFile.js';
        const contentsOfNewFile = 'console.log(\'foo\');\n';
        let projectID;

        before('create a sample project and bind to Codewind, without building', async function() {
            this.timeout(testTimeout.med);
            projectID = await projectService.createProjectFromTemplate(projectName, 'nodejs', pathToLocalProject);
        });

        before('create a local file', function() {
            this.timeout(testTimeout.med);
            const filepath = path.join(pathToLocalProject, pathFromDirToNewFile);
            fs.writeFileSync(filepath, contentsOfNewFile);
        });

        after(async function() {
            this.timeout(testTimeout.med);
            await projectService.removeProject(pathToLocalProject, projectID);
        });

        it('returns 200 when uploading the new file', async function() {
            this.timeout(testTimeout.med);
            const res = await projectService.uploadFile(
                projectID,
                pathToLocalProject,
                pathFromDirToNewFile,
            );

            res.should.have.status(200);
            res.should.satisfyApiSpec;

            const pathToFileInPfeTempDir = path.join('codewind-workspace', 'cw-temp', projectName, pathFromDirToNewFile);
            const fileExistsInPfeTempDir = await containerService.fileExists(pathToFileInPfeTempDir);
            fileExistsInPfeTempDir.should.be.true;
        });

        it('returns 200 and correctly syncs the project when POST upload/end is called', async function() {
            this.timeout(testTimeout.med);
            const options = {
                fileList: [
                    ...validFileList,
                    pathFromDirToNewFile,
                ],
                directoryList: validDirList,
                modifiedList: [
                    pathFromDirToNewFile,
                ],
                timeStamp: Date.now(),
            };
            const res = await projectService.uploadEnd(projectID, options);

            res.should.have.status(200);
            res.should.satisfyApiSpec;

            const pathToFileInPfeTempDir = path.join('codewind-workspace', 'cw-temp', projectName, pathFromDirToNewFile);
            const fileExistsInPfeTempDir = await containerService.fileExists(pathToFileInPfeTempDir);
            fileExistsInPfeTempDir.should.be.true;

            const pathToFileInPfeProjectDir = path.join('codewind-workspace', projectName, pathFromDirToNewFile);
            const contentsOfFileInPfeProjectDir = await containerService.readFile(pathToFileInPfeProjectDir);
            contentsOfFileInPfeProjectDir.should.deep.equal(contentsOfNewFile);
        });
    });

    describe('Sync deleted file (these `it` blocks depend on each other passing)', function() {
        const projectName = `test-sync-deleted-file-${Date.now()}`;
        const pathToLocalProject = path.join(TEMP_TEST_DIR, projectName);
        const pathFromDirToDeletedFile = 'test/test-server.js'; // path must exist and not be ignored in /src/pfe/portal/modules/utils/ignoredPaths.js
        let projectID;

        before('create a sample project and bind to Codewind, without building', async function() {
            this.timeout(testTimeout.med);
            projectID = await projectService.createProjectFromTemplate(projectName, 'nodejs', pathToLocalProject);
        });

        before('delete a local file', function() {
            this.timeout(testTimeout.med);
            const filepath = path.join(pathToLocalProject, pathFromDirToDeletedFile);
            fs.removeSync(filepath);
        });

        after(async function() {
            this.timeout(testTimeout.med);
            await projectService.removeProject(pathToLocalProject, projectID);
        });

        it('returns 200 and correctly syncs the project when POST upload/end is called', async function() {
            this.timeout(testTimeout.med);
            const options = {
                fileList: validFileList.filter(
                    filepath => filepath !== pathFromDirToDeletedFile
                ),
                directoryList: validDirList,
                modifiedList: null,
                timeStamp: Date.now(),
            };
            const res = await projectService.uploadEnd(projectID, options);

            res.should.have.status(200);
            res.should.satisfyApiSpec;

            const pathToFileInPfeTempDir = path.join('codewind-workspace', 'cw-temp', projectName, pathFromDirToDeletedFile);
            const fileExistsInPfeTempDir = await containerService.fileExists(pathToFileInPfeTempDir);
            fileExistsInPfeTempDir.should.be.false;

            const pathToFileInPfeProjectDir = path.join('codewind-workspace', projectName, pathFromDirToDeletedFile);
            const fileExistsInPfeProjectDir = await containerService.fileExists(pathToFileInPfeProjectDir);
            fileExistsInPfeProjectDir.should.be.false;
        });
    });

    describe('Sync deleted dir (these `it` blocks depend on each other passing)', function() {
        const projectName = `test-sync-deleted-dir-${Date.now()}`;
        const pathToLocalProject = path.join(TEMP_TEST_DIR, projectName);
        const pathFromDirToDeletedDir = 'test'; // path must exist and not be ignored in /src/pfe/portal/modules/utils/ignoredPaths.js
        let projectID;

        before('create a sample project and bind to Codewind, without building', async function() {
            this.timeout(testTimeout.med);
            projectID = await projectService.createProjectFromTemplate(projectName, 'nodejs', pathToLocalProject);
        });

        before('delete a local dir', function() {
            this.timeout(testTimeout.med);
            const dirpath = path.join(pathToLocalProject, pathFromDirToDeletedDir);
            fs.removeSync(dirpath);
        });

        after(async function() {
            this.timeout(testTimeout.med);
            await projectService.removeProject(pathToLocalProject, projectID);
        });

        it('returns 200 and correctly syncs the project when POST upload/end is called', async function() {
            this.timeout(testTimeout.med);
            const options = {
                fileList: validFileList.filter(
                    filepath => !filepath.startsWith('test/')
                ),
                directoryList: validDirList.filter(
                    dirpath => dirpath !== pathFromDirToDeletedDir
                ),
                modifiedList: null,
                timeStamp: Date.now(),
            };
            const res = await projectService.uploadEnd(projectID, options);

            res.should.have.status(200);
            res.should.satisfyApiSpec;

            const pathToDirInPfeTempDir = path.join('codewind-workspace', 'cw-temp', projectName, pathFromDirToDeletedDir);
            const dirExistsInPfeTempDir = await containerService.dirExists(pathToDirInPfeTempDir);
            dirExistsInPfeTempDir.should.be.false;

            const pathToDirInPfeProjectDir = path.join('codewind-workspace', projectName, pathFromDirToDeletedDir);
            const dirExistsInPfeProjectDir = await containerService.dirExists(pathToDirInPfeProjectDir);
            dirExistsInPfeProjectDir.should.be.false;
        });
    });

    describe('Fail cases for POST /upload/end', () => {
        it('returns 400 when req.body has no `fileList`', async function() {
            this.timeout(testTimeout.short);
            const projectID = '00000000-0000-0000-0000-000000000000';
            const options = {
                directoryList: validDirList,
                modifiedList: null,
                timeStamp: Date.now(),
            };
            const res = await projectService.uploadEnd(projectID, options);
            res.should.have.status(400);
        });

        it('returns 400 when req.body has no `directoryList`', async function() {
            this.timeout(testTimeout.short);
            const projectID = '00000000-0000-0000-0000-000000000000';
            const options = {
                fileList: validFileList,
                modifiedList: null,
                timeStamp: Date.now(),
            };
            const res = await projectService.uploadEnd(projectID, options);
            res.should.have.status(400);
        });

        it('returns 400 when req.body has no `modifiedList`', async function() {
            this.timeout(testTimeout.short);
            const projectID = '00000000-0000-0000-0000-000000000000';
            const options = {
                fileList: validFileList,
                directoryList: validDirList,
                timeStamp: Date.now(),
            };
            const res = await projectService.uploadEnd(projectID, options);
            res.should.have.status(400);
        });

        it('returns 400 when req.body has no `timeStamp`', async function() {
            this.timeout(testTimeout.short);
            const projectID = '00000000-0000-0000-0000-000000000000';
            const options = {
                fileList: validFileList,
                directoryList: validDirList,
                modifiedList: null,
            };
            const res = await projectService.uploadEnd(projectID, options);
            res.should.have.status(400);
        });

        it('returns 404 when the project does not exist', async function() {
            this.timeout(testTimeout.short);
            const idMatchingNoProjects = '00000000-0000-0000-0000-000000000000';
            const options = {
                fileList: validFileList,
                directoryList: validDirList,
                modifiedList: null,
                timeStamp: Date.now(),
            };
            const res = await projectService.uploadEnd(idMatchingNoProjects, options);
            res.should.have.status(404);
        });
    });
});
