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
const chaiHttp = require('chai-http');
const fs = require('fs');

const projectService = require('../../modules/project.service');
const { testTimeout } = require('../../config');

chai.use(chaiHttp);
chai.should();

describe('Rebuild after file change tests', function() {
    const projectName = `rebuildAfterChangeTest${Date.now()}`;
    let projectID;
    let originalMsg;

    before(async function() {
        this.timeout(3 * testTimeout.med);
        projectID = await projectService.cloneAndBindAndBuildProject(projectName, 'docker');
        await projectService.awaitProjectStarted(projectID);
        originalMsg = await getProjectMsg(projectID);
        originalMsg.should.be.string;
    });

    after(async function() {
        this.timeout(2 * testTimeout.med);
        await projectService.unbindProject(projectID);
        await projectService.deleteProjectDir(projectName);
    });

    describe('when a route file is changed', function() {
        it('project rebuilds then displays a new message', async function() {
            this.timeout(testTimeout.maxTravis);
            await changeFile(projectName);
            const detailsOfFilesChanged = [{
                path: '/app.py' ,
                timestamp: Date.now(),
                type: 'MODIFY',
                directory: false,
            }];
            await projectService.notifyPfeOfFileChangesAndAwaitMsg(detailsOfFilesChanged, projectID);
            await projectService.awaitProjectStarted(projectID);
            const newMsg = await getProjectMsg(projectID);
            newMsg.should.deep.equal('Hello Codewind! \n');
        });
    });

});

async function getProjectMsg(projectID) {
    const message = await projectService.getProject(projectID);
    const projectPort = message.ports.exposedPort;
    const projectUrl = `http://localhost:${projectPort}`;
    const res = await chai.request(projectUrl).get('/');
    return res.text;
}

async function changeFile(projectName) {
    const workspace_location = await projectService.findWorkspaceLocation();
    const fileData = fs.readFileSync(`${workspace_location}/${projectName}/app.py`, 'utf-8');
    const newValue = fileData.replace('Hello World!', 'Hello Codewind!');
    fs.writeFileSync(`${workspace_location}/${projectName}/app.py`, newValue, 'utf-8');
}