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

describe.only('Rebuild project on same ports', function() {
    const projectName = `test-rebuild-project-on-same-ports-${Date.now()}`;
    // const pathToLocalProject = '/Users/richard.waller@ibm.com/codewind-workspace/node10';
    // const pathToLocalProject = path.join(__dirname, projectName);
    const pathToLocalProject = path.join(TEMP_TEST_DIR, projectName);
    // const projectID = 'aa114bf0-9603-11ea-b740-4ffc8deaab98';
    let projectID;
    let originalPorts;

    before('create a sample Node.js project, bind it to Codewind and wait for it start', async function() {
        this.timeout(testTimeout.med);
        projectID = await projectService.createProjectFromTemplate(projectName, 'nodejs', pathToLocalProject);
        await projectService.awaitProjectStartedHTTP(projectID);
        const { body: { ports } } = await projectService.getProject(projectID);
        console.log('ports');
        console.log(ports);
        originalPorts = ports;
    });

    after(async function() {
        this.timeout(testTimeout.med);
        await projectService.removeProject(pathToLocalProject, projectID);
    });

    it('restarts the project on the same port after user edits the Dockerfile', async function() {
        this.timeout(testTimeout.med);

        editDockerfile(pathToLocalProject);
        const res = await projectService.syncFiles(
            projectID,
            pathToLocalProject,
            ['Dockerfile'],
            projectService.defaultNodeProjectFileList,
            projectService.defaultNodeProjectDirList,
        );
        res.status.should.equal(200, res.text);

        await sleep(3000); // PFE takes a moment to stop the project (to start rebuilding it)

        await projectService.awaitProjectStartedHTTP(projectID);

        const { body: { ports } } = await projectService.getProject(projectID);
        console.log('ports 2');
        console.log(ports);
        ports.should.deep.equal(originalPorts);
    });

    it('restarts the project on the same port after user disables then enables it in run mode', async function() {
        this.timeout(testTimeout.med);

        await projectService.closeProject(projectID, 202, true);
        await projectService.openProject(projectID, 200);
        await projectService.awaitProjectStartedHTTP(projectID);

        const { body: { ports } } = await projectService.getProject(projectID);
        console.log('ports 2');
        console.log(ports);
        ports.should.deep.equal(originalPorts);
    });

    it('restarts the project on the same port after user disables then enables it in debug mode', async function() {
        this.timeout(testTimeout.med);

        await projectService.restartProject(projectID, 'debugNoInit', 202, true);
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

        await projectService.restartProject(projectID, 'debugNoInit', 202, true);
        const { body: { ports: newMorePorts } } = await projectService.getProject(projectID);
        console.log('newMorePorts');
        console.log(newMorePorts);
        newMorePorts.should.deep.equal(originalMorePorts);
    });
});

const editDockerfile = (pathToLocalProject) => {
    const filepath = path.join(pathToLocalProject, 'Dockerfile');
    const originalFileContents = fs.readFileSync(filepath);
    const newFileContents = `${originalFileContents}#\n`;
    fs.writeFileSync(filepath, newFileContents);
};
