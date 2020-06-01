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
const { promisify } = require('util');

const projectService = require('../../modules/project.service');
const containerService = require('../../modules/container.service');
const {
    testTimeout,
    TEMP_TEST_DIR,
} = require('../../config');

const deepClone = (obj) => JSON.parse(JSON.stringify(obj));
const sleep = promisify(setTimeout);
chai.should();

describe.only('Rebuild after edit Dockerfile expose port tests', function() {
    const tests = [
        // {
        //     projectType: 'go', // Go needs 2 restarts, even on master
        // },
        {
            projectType: 'nodejs',
        },
        // {
        //     projectType: 'spring', // Spring needs the template change merged, then take out --expose 8080
        // },
        // Skip these tests by default because they are slow
        // {
        //     projectType: 'liberty',
        // },
        // {
        //     projectType: 'swift',
        // },
    ];

    tests.forEach((test) => {
        const {
            projectType,
        } = test;
        describe(projectType, function() {
            const projectName = `test-rebuild-${projectType}-project-after-edit-dockerfile-${Date.now()}`;
            const pathToLocalProject = path.join(TEMP_TEST_DIR, projectName);
            let projectID;

            before(`create a sample project, bind it to Codewind and wait for it start`, async function() {
                this.timeout(testTimeout.maxTravis);
                projectID = await projectService.createProjectFromTemplate(projectName, projectType, pathToLocalProject);
                await projectService.awaitProjectStartedHTTP(projectID);
            });

            after(async function() {
                this.timeout(testTimeout.med);
                await projectService.removeProject(pathToLocalProject, projectID);
            });

            it('exposes a different port after user edits the Dockerfile to do so', async function() {
                this.timeout(testTimeout.maxTravis);

                const newPort = '9999';
                editDockerfileExposePort(pathToLocalProject, newPort);
                const { fileList, directoryList } = projectService.getPathsToUpload(pathToLocalProject, projectType);
                const res = await projectService.syncFiles(
                    projectID,
                    pathToLocalProject,
                    ['Dockerfile'],
                    fileList,
                    directoryList,
                );
                res.status.should.equal(200, res.text);

                await projectService.awaitProjectStarting(projectID);
                await sleep(5000); // PFE takes a moment to update the project ports

                const containerInfo = await containerService.getContainer(projectID);
                console.log('containerInfo');
                console.log(containerInfo);

                const { body: { ports } } = await projectService.getProject(projectID);
                ports.internalPort.should.equal(newPort);
            });
        });
    });
});

function editDockerfileExposePort(pathToLocalProject, newPort){
    const filepath = path.join(pathToLocalProject, 'Dockerfile');
    const originalFileContents = fs.readFileSync(filepath, 'utf8');
    const newFileContents = getDockerfileExposingDifferentPort(originalFileContents, newPort);
    fs.writeFileSync(filepath, newFileContents);
}

function getDockerfileExposingDifferentPort(originalDockerfile, newPort) {
    const newExposeLine = `EXPOSE ${newPort}`;

    const splitOriginalDockerfile = originalDockerfile.split('\n');
    const indexOfExposeLine = splitOriginalDockerfile.findIndex(line => line.includes('EXPOSE'));

    let newDockerfile = deepClone(splitOriginalDockerfile);
    newDockerfile[indexOfExposeLine] = newExposeLine;
    newDockerfile = newDockerfile.join('\n');
    return newDockerfile;
}
