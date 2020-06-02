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
const chaiSubset = require('chai-subset');
const path = require('path');
const fs = require('fs-extra');
const { promisify } = require('util');

const projectService = require('../../modules/project.service');
const containerService = require('../../modules/container.service');
const {
    testTimeout,
    TEMP_TEST_DIR,
} = require('../../config');

const sleep = promisify(setTimeout);
chai.should();
chai.use(chaiSubset);

describe('Rebuild after edit Dockerfile expose port tests', function() {
    const tests = [
        // {
        //     projectType: 'go', // Go needs 2 restarts, even on master
        // },
        // {
        //     projectType: 'nodejs',
        // },
        // {
        //     projectType: 'spring', // Spring needs the template change merged, then take out --expose 8080
        // },
        // Skip these tests by default because they are slow
        {
            projectType: 'liberty',
        },
        // {
        //     projectType: 'swift',
        // },
    ];

    tests.forEach((test) => {
        const {
            projectType,
        } = test;
        describe.only(projectType, function() {
            const projectName = `test-rebuild-${projectType}-project-after-edit-dockerfile-${Date.now()}`;
            const pathToLocalProject = path.join(TEMP_TEST_DIR, projectName);
            const pathToDockerfile = path.join(pathToLocalProject, 'Dockerfile');
            const newPort = '9999';
            let projectID;
            let originalPorts;
            let originalAppPortMapping;
            let originalDockerfile;

            before(`create a sample project, bind it to Codewind and wait for it start`, async function() {
                this.timeout(testTimeout.maxTravis);
                projectID = await projectService.createProjectFromTemplate(projectName, projectType, pathToLocalProject);
                await projectService.awaitProjectStartedHTTP(projectID);

                const { ports } = await containerService.getContainer(projectName, projectID);
                originalPorts = ports;
                console.log('originalPorts');
                console.log(originalPorts);
                const { body: { ports: { internalPort } } } = await projectService.getProject(projectID);
                originalAppPortMapping = ports.find(portMapping => portMapping.internal === internalPort);
                console.log('originalAppPortMapping');
                console.log(originalAppPortMapping);

                originalDockerfile = fs.readFileSync(pathToDockerfile, 'utf8');
            });

            after(async function() {
                this.timeout(testTimeout.med);
                await projectService.removeProject(pathToLocalProject, projectID);
            });

            it('exposes a different port after user edits the Dockerfile to do so', async function() {
                this.timeout(testTimeout.maxTravis);

                exposeNewPortInDockerfile(pathToDockerfile, newPort);
                const { fileList, directoryList } = projectService.getPathsToUpload(pathToLocalProject, projectType);
                const res = await projectService.syncFiles(
                    projectID,
                    pathToLocalProject,
                    ['Dockerfile'],
                    fileList,
                    directoryList,
                );
                res.status.should.equal(200, res.text);
                await sleep(5000); // PFE takes a moment to stop the project (before rebuilding it)
                await projectService.awaitProjectStartedHTTP(projectID);

                const { ports } = await containerService.getContainer(projectName, projectID);
                console.log('ports');
                console.log(ports);
                // ports.should.deep.include(originalAppPortMapping);
                // ports.should.have.length(originalPorts.length + 1);
                // ports.should.containSubset([{ internal: newPort }]);

                const { body: { ports: { internalPort: newAppPort } } } = await projectService.getProject(projectID);
                console.log('newAppPort');
                console.log(newAppPort);
                // newAppPort.should.equal(originalAppPortMapping.internal);
            });

            it('exposes the original ports after user restores the original Dockerfile', async function() {
                this.timeout(testTimeout.maxTravis);

                restoreDockerfile(pathToDockerfile, originalDockerfile);
                const { fileList, directoryList } = projectService.getPathsToUpload(pathToLocalProject, projectType);
                const res = await projectService.syncFiles(
                    projectID,
                    pathToLocalProject,
                    ['Dockerfile'],
                    fileList,
                    directoryList,
                );
                res.status.should.equal(200, res.text);
                await sleep(5000); // PFE takes a moment to stop the project (before rebuilding it)
                await projectService.awaitProjectStartedHTTP(projectID);

                const { ports } = await containerService.getContainer(projectName, projectID);
                console.log('ports');
                console.log(ports);
                // ports.should.have.length(originalPorts.length);
                // ports.should.deep.include(originalAppPortMapping);

                const { body: { ports: { internalPort: newAppPort } } } = await projectService.getProject(projectID);
                console.log('newAppPort');
                console.log(newAppPort);
                // newAppPort.should.equal(originalAppPortMapping.internal);
            });
        });
    });
});

function exposeNewPortInDockerfile(pathToDockerfile, newPort){
    const originalFileContents = fs.readFileSync(pathToDockerfile, 'utf8');
    const newFileContents = `${originalFileContents}EXPOSE ${newPort}\n`;
    fs.writeFileSync(pathToDockerfile, newFileContents);
}

function restoreDockerfile(pathToDockerfile, originalDockerfile){
    fs.writeFileSync(pathToDockerfile, originalDockerfile);
}
