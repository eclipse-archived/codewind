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
const { promisify } = require('util');

const projectService = require('../../modules/project.service');
const {
    testTimeout,
    TEMP_TEST_DIR,
} = require('../../config');

const sleep = promisify(setTimeout);
chai.should();

describe('Rebuild project on same ports', function() {
    const tests = [
        // {
        //     projectType: 'nodejs',
        //     debugMode: 'debugNoInit',
        // },
        // TODO: go
        // {
        //     projectType: 'go',
        //     debugMode: null,
        // },
        // {
        //     projectType: 'spring',
        //     debugMode: 'debugNoInit',
        // },
        // {
        //     projectType: 'liberty',
        //     debugMode: 'debug',
        // },
        // TODO: swift
        // {
        //     projectType: 'swift',
        //     debugMode: null,
        // },
    ];
    tests.forEach((test) => {
        const {
            projectType,
            debugMode,
        } = test;
        describe(projectType, function() {
            if (process.env.JENKINS_HOME) {
                this.skip();
            }
            const projectName = `test-rebuild-${projectType}-project-on-same-ports-${Date.now()}`;
            // const pathToLocalProject = path.join(__dirname, projectName);
            const pathToLocalProject = path.join(TEMP_TEST_DIR, projectName);
            let projectID;
            let originalPorts;

            before(`create a sample ${projectType} project, bind it to Codewind and wait for it start`, async function() {
                this.timeout(testTimeout.maxTravis);
                projectID = await projectService.createProjectFromTemplate(projectName, projectType, pathToLocalProject);
                const { fileList, directoryList } = projectService.getPathsToUpload(pathToLocalProject, projectType);
                console.log('fileList');
                console.log(fileList);
                console.log('projectService.defaultSyncLists[projectType].fileList');
                console.log(projectService.defaultSyncLists[projectType].fileList);
                console.log('directoryList 1');
                console.log(directoryList);
                console.log('projectService.defaultSyncLists[projectType].directoryList');
                console.log(projectService.defaultSyncLists[projectType].directoryList);
                await projectService.awaitProjectStartedHTTP(projectID);
                const { body: { ports } } = await projectService.getProject(projectID);
                // TODO remove logs
                console.log('ports');
                console.log(ports);
                originalPorts = ports;
            });

            after(async function() {
                this.timeout(testTimeout.med);
                await projectService.removeProject(pathToLocalProject, projectID);
            });

            // it.only('restarts the project on the same port after user edits the Dockerfile', async function() {
            //     const p = projectService.isIgnoredFilepath('target/liberty/wlp/.installed', 'liberty');
            //     console.log(p);
            // });

            it('restarts the project on the same port after user edits the Dockerfile', async function() {
                this.timeout(testTimeout.maxTravis);

                editDockerfile(pathToLocalProject);
                const { fileList, directoryList } = projectService.getPathsToUpload(pathToLocalProject, projectType);
                console.log('fileList');
                console.log(fileList);
                console.log('projectService.defaultSyncLists[projectType].fileList');
                console.log(projectService.defaultSyncLists[projectType].fileList);
                console.log('directoryList');
                console.log(directoryList);
                console.log('projectService.defaultSyncLists[projectType].directoryList');
                console.log(projectService.defaultSyncLists[projectType].directoryList);
                const res = await projectService.syncFiles(
                    projectID,
                    pathToLocalProject,
                    ['Dockerfile'],
                    fileList,
                    directoryList,
                    // projectService.defaultSyncLists[projectType].fileList,
                    // projectService.defaultSyncLists[projectType].directoryList,
                );
                res.status.should.equal(200, res.text);

                await sleep(3000); // PFE takes a moment to stop the project (before rebuilding it)

                await projectService.awaitProjectStartedHTTP(projectID);

                const { body: { ports } } = await projectService.getProject(projectID);
                console.log('ports after editing Dockerfile');
                console.log(ports);
                ports.should.deep.equal(originalPorts);
            });

            it('restarts the project on the same port after user disables then enables the project in run mode', async function() {
                this.timeout(testTimeout.maxTravis);

                await projectService.closeProject(projectID, 202, true);
                await projectService.openProject(projectID, 200);
                await projectService.awaitProjectStartedHTTP(projectID);

                const { body: { ports } } = await projectService.getProject(projectID);
                console.log('ports after renable in run mode');
                console.log(ports);
                ports.should.deep.equal(originalPorts);
            });

            it('restarts the project on the same port after user disables then enables the project in debug mode', async function() {
                if (!debugMode) {
                    this.skip();
                }
                this.timeout(testTimeout.maxTravis);

                await projectService.restartProject(projectID, debugMode, 202, true);
                const { body: { ports: originalMorePorts } } = await projectService.getProject(projectID);
                console.log('originalMorePorts');
                console.log(originalMorePorts);
                await projectService.closeProject(projectID, 202, true);
                await projectService.openProject(projectID, 200);
                await projectService.awaitProjectStartedHTTP(projectID);

                const { body: { ports: newPorts } } = await projectService.getProject(projectID);
                console.log('newPorts');
                console.log(newPorts);
                newPorts.should.deep.equal(originalPorts);

                await projectService.restartProject(projectID, debugMode, 202, true);
                const { body: { ports: newMorePorts } } = await projectService.getProject(projectID);
                console.log('newMorePorts');
                console.log(newMorePorts);
                newMorePorts.should.deep.equal(originalMorePorts);
            });
        });
    });
});

const editDockerfile = (pathToLocalProject) => {
    const filepath = path.join(pathToLocalProject, 'Dockerfile');
    const originalFileContents = fs.readFileSync(filepath);
    const newFileContents = `${originalFileContents}#\n`;
    fs.writeFileSync(filepath, newFileContents);
};
