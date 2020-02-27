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
const proxyquire = require('proxyquire');
const sinon = require('sinon');
const chai = require('chai');
const chaiSubset = require('chai-subset');
const deepEqualInAnyOrder = require('deep-equal-in-any-order');

// import FileWatcher.js but mock some of its imports so we can test it in isolation
/* eslint-disable class-methods-use-this */
class MockLogger {
    error() {}
    warn() {}
    info() {}
    debug() {}
    trace() {}
};

const mock200ResponseFromFw = { statusCode: 200 };
const mock202ResponseFromFw = { statusCode: 202 };

class MockFw {
    registerListener() {}
    performProjectAction() { return mock202ResponseFromFw; }
    createProject() { return mock202ResponseFromFw; }
    getProjectCapabilities() { return { statusCode: 200, capabilities: 'mock capabilities' }; }
    deleteProject() { return mock202ResponseFromFw; }
    closeProject() { return mock202ResponseFromFw; }
    getProjectTypes() { return { statusCode: 200, types: 'mock types' }; }
    getProjectLogs() { return { statusCode: 200, logs: 'mock logs' }; }
    checkNewLogFile() { return mock200ResponseFromFw; }
    updateStatus() { return mock200ResponseFromFw; }
    updateProjectForNewChange() { return mock202ResponseFromFw; }
};
/* eslint-enable class-methods-use-this */

/* we need to specify noCallThru because otherwise when proxyquire
 requires FileWatcher.js it will also require 'file-watcher', which will error.
 See https://github.com/thlorenz/proxyquire#preventing-call-thru-to-original-dependency
*/
MockFw['@noCallThru'] = true; 

const FileWatcher = proxyquire('../../../../src/pfe/portal/modules/FileWatcher', {
    'file-watcher': MockFw,
    './utils/Logger': MockLogger,
});
// we have now imported FileWatcher.js with some of its imports mocked

chai.use(chaiSubset);
chai.use(deepEqualInAnyOrder);
chai.should();

describe('FileWatcher.js', () => {
    let existingGlobalCodewindRunningInK8sValue;
    before(() => {
        existingGlobalCodewindRunningInK8sValue = global.codewind.RUNNING_IN_K8S;
        global.codewind.RUNNING_IN_K8S = false;
    });
    after(() => {
        global.codewind.RUNNING_IN_K8S = existingGlobalCodewindRunningInK8sValue;
    });
    describe('new FileWatcher(user)', () => {
        it('returns a new FileWatcher and registers a FW listener', () => {
            const fw = new FileWatcher('mockUser');

            fw.user.should.equal('mockUser');
            fw.up.should.be.true;
        });
    });
    describe('registerFWListener()', () => {
        it('does not set the locale and does register a FW listener when `this.locale` is falsy', () => {
            const fw = new FileWatcher('mockUser');
            fw.locale = false;

            fw.up.should.be.true;
            fw.locale = false;
        });
        it('sets the locale and registers a FW listener when `this.locale` is truthy', () => {
            const fw = new FileWatcher('mockUser');
            fw.locale = true;

            fw.up.should.be.true;
            fw.locale = true;
        });
    });
    describe('handleEvent(event, fwProject)', () => {
        it('handles `projectCreation` events', async() => {
            const mockFwProject = { projectID: 'be4ea4e0-5239-11ea-abf6-f10edc5370f9' };
            const fw = new FileWatcher('mockUser');
            const handleFWProjectEvent = sinon.stub(fw, 'handleFWProjectEvent');

            await fw.handleEvent('projectCreation', mockFwProject);

            handleFWProjectEvent.should.have.been.calledOnceWithExactly('projectCreation', mockFwProject);
        });
        it('handles `projectChanged` events', async() => {
            const mockFwProject = { projectID: 'be4ea4e0-5239-11ea-abf6-f10edc5370f9' };
            const fw = new FileWatcher('mockUser');
            const handleFWProjectEvent = sinon.stub(fw, 'handleFWProjectEvent');

            await fw.handleEvent('projectChanged', mockFwProject);

            handleFWProjectEvent.should.have.been.calledOnceWithExactly('projectChanged', mockFwProject);
        });
        it('does nothing when event is unexpected', async() => {
            const fw = new FileWatcher('mockUser');
            const handleFWProjectEvent = sinon.stub(fw, 'handleFWProjectEvent');
            
            await fw.handleEvent('unexpectedEvent', 'mockFwProject');

            handleFWProjectEvent.should.not.have.been.called;
        });
    });
    describe('handleCapabilitiesUpdated(fwProject)', () => {
        it('updates the project object, project.inf, and UI with `capabilitiesReady: true` when updating the project.inf succeeds', async() => {
            // arrange
            const mockUser = {
                projectList: { updateProject: sinon.mock() },
                uiSocket: { emit: sinon.mock() },
            };
            const fw = new FileWatcher(mockUser);
            const mockFwProject = { projectID: 'be4ea4e0-5239-11ea-abf6-f10edc5370f9' };
            
            // act
            await fw.handleCapabilitiesUpdated(mockFwProject);
            
            // assert
            const expectedProjectUpdate = {
                projectID: mockFwProject.projectID,
                capabilitiesReady: true,
            };
            fw.user.projectList.updateProject.should.have.been.calledOnceWith(expectedProjectUpdate);
            fw.user.uiSocket.emit.should.have.been.calledOnceWith('projectChanged', expectedProjectUpdate);
        });
        it('does not update the UI when updating the project.inf fails', async() => {
            // arrange
            const mockUser = {
                projectList: { updateProject: () => { throw new Error('error updating project.inf'); } },
                uiSocket: { emit: sinon.mock() },
            };
            const fw = new FileWatcher(mockUser);
            const mockFwProject = { projectID: 'be4ea4e0-5239-11ea-abf6-f10edc5370f9' };
            
            // act
            await fw.handleCapabilitiesUpdated(mockFwProject);

            // assert
            fw.user.uiSocket.emit.should.not.have.been.called;
        });
    });
    describe('buildProject(project, buildAction)', () => {
        it('asks fw to build the project then returns the response body', async() => {
            const fw = new FileWatcher('mockUser');
            const output = await fw.buildProject('mock project', 'mock buildAction');
            output.should.deep.equal(mock202ResponseFromFw);
        });
    });
    describe('restartProject(project, startMode)', () => {
        it('asks fw to restart the project', async() => {
            const fw = new FileWatcher('mockUser');
            const logFWReturnedMsg = sinon.spy(fw, 'logFWReturnedMsg');
            await fw.restartProject('mock project', 'mock startMode');
            logFWReturnedMsg.should.have.been.calledOnceWith(mock202ResponseFromFw);
        });
    });
    describe('buildAndRunProject(project)', () => {
        it('asks fw to build and run the project then returns the response when successful', async() => {
            const fw = new FileWatcher('mockUser');
            const mockProject = { 
                readSettingsFile: () => 'mock settingsFileContents',
                projectPath: () => 'mock location',
            };
            const output = await fw.buildAndRunProject(mockProject);
            output.should.deep.equal(mock202ResponseFromFw);
        });
    });
    describe('projectCapabilities(project)', () => {
        it('asks fw to get the project\'s capabilities then returns the capabilities when successful', async() => {
            const fw = new FileWatcher('mockUser');
            const output = await fw.projectCapabilities('mock project');
            output.should.deep.equal('mock capabilities');
        });
    });
    describe('deleteProject(project)', () => {
        it('asks fw to delete the project then logs the response when successful', async() => {
            const fw = new FileWatcher('mockUser');
            const logFWReturnedMsg = sinon.spy(fw, 'logFWReturnedMsg');
            const mockProject = { projectID: 'be4ea4e0-5239-11ea-abf6-f10edc5370f9' };
            await fw.deleteProject(mockProject);
            logFWReturnedMsg.should.have.been.calledOnceWith(mock202ResponseFromFw);
        });
    });
    describe('closeProject(project)', () => {
        it('asks fw to close the project then logs the response when successful', async() => {
            const fw = new FileWatcher('mockUser');
            const logFWReturnedMsg = sinon.spy(fw, 'logFWReturnedMsg');
            const mockProject = { projectID: 'be4ea4e0-5239-11ea-abf6-f10edc5370f9' };
            await fw.closeProject(mockProject);
            logFWReturnedMsg.should.have.been.calledOnceWith(mock202ResponseFromFw);
        });
    });
    describe('projectTypes()', () => {
        it('asks fw to get the project types then returns the types when successful', async() => {
            const fw = new FileWatcher('mockUser');
            const output = await fw.projectTypes();
            output.should.deep.equal('mock types');
        });
    });
    describe('getProjectLogs(project)', () => {
        it('asks fw to get the project logs then returns the logs when successful', async() => {
            const fw = new FileWatcher('mockUser');
            const mockProject = { projectID: 'be4ea4e0-5239-11ea-abf6-f10edc5370f9' };
            const output = await fw.getProjectLogs(mockProject);
            output.should.deep.equal('mock logs');
        });
    });
    describe('checkNewLogFile(projectID, type)', () => {
        it('asks fw to get the project logs then logs the response when successful', async() => {
            const fw = new FileWatcher('mockUser');
            const logFWReturnedMsg = sinon.spy(fw, 'logFWReturnedMsg');
            await fw.checkNewLogFile('mock projectID', 'mock type');
            logFWReturnedMsg.should.have.been.calledOnceWith(mock200ResponseFromFw);
        });
    });
    describe('updateStatus(body)', () => {
        it('asks fw to update the status then logs the response when successful', async() => {
            const fw = new FileWatcher('mockUser');
            const logFWReturnedMsg = sinon.spy(fw, 'logFWReturnedMsg');
            await fw.updateStatus('mock body');
            logFWReturnedMsg.should.have.been.calledOnceWith(mock200ResponseFromFw);
        });
    });
    describe('projectFileChanged(projectID, timestamp, chunk, chunk_total, eventArray)', () => {
        it('asks fw to update the project for new change then logs the response when successful', async() => {
            const fw = new FileWatcher('mockUser');
            const logFWReturnedMsg = sinon.spy(fw, 'logFWReturnedMsg');
            await fw.projectFileChanged();
            logFWReturnedMsg.should.have.been.calledOnceWith(mock202ResponseFromFw);
        });
    });
    describe('handleUpdatedProject(event, fwProject)', () => {
        const mockProject = {
            pathToMonitor: () => {},
            resolveMonitorPath: () => {},
        };
        const mockUser = {
            projectList: {
                retrieveProject: () => mockProject, 
            },
        };
        it('does nothing when the fwProject contains no useful information', async() => {
            // arrange
            const mockFwProject = {
                projectID: 'be4ea4e0-5239-11ea-abf6-f10edc5370f9',
            };
            const fw = new FileWatcher(mockUser);
            const handleFWProjectEvent = sinon.spy(fw, 'handleFWProjectEvent');

            // act
            await fw.handleUpdatedProject('mockEvent', mockFwProject);

            // assert
            handleFWProjectEvent.should.not.have.been.called;
        });
        it('handles the event when the fwProject contains `ignoredPaths`', async() => {
            // arrange
            const mockFwProject = {
                projectID: 'be4ea4e0-5239-11ea-abf6-f10edc5370f9',
                ignoredPaths: 'mockIgnoredPaths',
                status: 'mockStatus',
            };
            const fw = new FileWatcher(mockUser);
            const handleFWProjectEvent = sinon.stub(fw, 'handleFWProjectEvent');

            // act
            await fw.handleUpdatedProject('mockEvent', mockFwProject);

            // assert
            handleFWProjectEvent.should.have.been.calledWithMatch('mockEvent', mockFwProject);
        });
        it('handles the event when the fwProject contains `contextRoot`', async() => {
            // arrange
            const mockFwProject = {
                projectID: 'be4ea4e0-5239-11ea-abf6-f10edc5370f9',
                contextRoot: 'mockContextRoot',
            };
            const fw = new FileWatcher(mockUser);
            const handleFWProjectEvent = sinon.stub(fw, 'handleFWProjectEvent');

            // act
            await fw.handleUpdatedProject('mockEvent', mockFwProject);

            // assert
            handleFWProjectEvent.should.have.been.calledOnceWithExactly('mockEvent', mockFwProject);
        });
    });
    describe('handleNewProjectAdded(event, fwProject)', () => {
        const mockProject = {
            resolveMonitorPath: () => {},
        };
        const mockUser = {
            projectList: {
                retrieveProject: () => mockProject, 
            },
        };
        it('handles the event when the fwProject contains `ignoredPaths`', async() => {
            // arrange
            const mockFwProject = {
                projectID: 'be4ea4e0-5239-11ea-abf6-f10edc5370f9',
                ignoredPaths: 'mockIgnoredPaths',
                status: 'mockStatus',
            };
            const fw = new FileWatcher(mockUser);
            const handleFWProjectEvent = sinon.stub(fw, 'handleFWProjectEvent');

            // act
            await fw.handleNewProjectAdded('mockEvent', mockFwProject);

            // assert
            handleFWProjectEvent.should.have.been.calledWithMatch('mockEvent', mockFwProject);
        });
    });
    describe('handleFWProjectEvent(event, fwProject)', () => {
        it('correctly updates the projectList, project.inf and UI', async() => {
            // arrange
            const mockFwProject = {
                projectID: 'be4ea4e0-5239-11ea-abf6-f10edc5370f9',
                name: 'mockName',
                operationId: 'mockOperationId',
                error: 'mockError',
                status: 'mockStatus',
                logStreams: 'mockLogStreams',
                type: 'mockType',
            };
            const expectedProjectUpdate = {
                projectID: mockFwProject.projectID,
                logStreams: mockFwProject.logStreams,
                type: mockFwProject.type,
            };
            const expectedProjectInfoForUI = {
                projectID: mockFwProject.projectID,
                status: mockFwProject.status,
                error: mockFwProject.error,
                type: mockFwProject.type,
            };
            const mockUser = {
                projectList: { 
                    updateProject: sinon.stub().returns(expectedProjectUpdate),
                },
                uiSocket: { emit: sinon.mock() },
            };
            const fw = new FileWatcher(mockUser);

            // act
            await fw.handleFWProjectEvent('mockEvent', mockFwProject);

            // assert
            fw.user.projectList.updateProject.should.have.been.calledOnceWith(expectedProjectUpdate);
            fw.user.uiSocket.emit.should.have.been.calledOnceWith('mockEvent', expectedProjectInfoForUI);
        });
    });
    describe('handleProjectClosed(fwProject, project)', () => {
        it('correctly updates the UI when fwProject.status is not `success`', async() => {
            // arrange
            const mockFwProject = {
                status: 'mockStatus',
            };
            const mockProject = {
                logStreams: 'should not be emitted to UI',
            };
            const mockUser = {
                uiSocket: { emit: sinon.mock() },
            };
            const fw = new FileWatcher(mockUser);

            // act
            await fw.handleProjectClosed(mockFwProject, mockProject);

            // assert
            fw.user.uiSocket.emit.should.have.been.calledOnceWithExactly('projectClosed', mockFwProject);
        });
        it('correctly updates the projectList, project.inf and UI when fwProject.status is `success`', async() => {
            // arrange
            const mockFwProject = {
                projectID: 'be4ea4e0-5239-11ea-abf6-f10edc5370f9',
                status: 'success',
            };
            const mockProject = {
                projectID: 'be4ea4e0-5239-11ea-abf6-f10edc5370f9',
            };
            const expectedProjectUpdate = {
                projectID: mockFwProject.projectID,
                ports: '',
                buildStatus: 'unknown',
                appStatus: 'unknown',
                state: 'closed',
                capabilitiesReady: false,
                detailedAppStatus: undefined, // eslint-disable-line no-undefined
                containerId: '',
            };
            const mockUser = {
                projectList: { 
                    updateProject: sinon.stub().returns(expectedProjectUpdate),
                    deleteProjectKey: () => {},
                },
                uiSocket: { emit: sinon.mock() },
            };
            const fw = new FileWatcher(mockUser);

            // act
            await fw.handleProjectClosed(mockFwProject, mockProject);

            // assert
            fw.user.projectList.updateProject.should.have.been.calledOnceWithExactly(expectedProjectUpdate);
            fw.user.uiSocket.emit.should.have.been.calledOnceWithExactly('projectClosed', {
                ...expectedProjectUpdate,
                status: 'success',
            });
        });
    });
    describe('handleProjectActionResponse(res, projectID)', () => {
        const mockProjectID = 'be4ea4e0-5239-11ea-abf6-f10edc5370f9';
        it('does not error when res.statusCode is 200', () => {
            FileWatcher.handleProjectActionResponse(mock200ResponseFromFw, mockProjectID);
        });
        it('does not error when res.statusCode is 202', () => {
            FileWatcher.handleProjectActionResponse(mock202ResponseFromFw, mockProjectID);
        });
        it('throws the correct error when res.statusCode is 400', () => {
            const mockResponse = {
                statusCode: 400,
                error: { msg: 'mock error msg' }, 
            };
            const func = () => FileWatcher.handleProjectActionResponse(mockResponse, mockProjectID);
            func.should.throw(`Request error for project ${mockProjectID}.\nmock error msg`);
        });
        it('throws the correct error when res.statusCode is 404', () => {
            const mockResponse = { statusCode: 404 };
            const func = () => FileWatcher.handleProjectActionResponse(mockResponse, mockProjectID);
            func.should.throw(`Project with ID ${mockProjectID} not found.`);
        });
        it('throws the correct error when res.statusCode is 500', () => {
            const mockResponse = {
                statusCode: 500,
                error: { msg: 'mock error msg' }, 
            };
            const func = () => FileWatcher.handleProjectActionResponse(mockResponse, mockProjectID);
            func.should.throw(`Project ${mockProjectID} internal error occurred.\nmock error msg`);
        });
        it('throws the correct error when res.statusCode is unexpected', () => {
            const mockResponse = {
                statusCode: 299,
                error: { msg: 'mock error msg' }, 
            };
            const func = () => FileWatcher.handleProjectActionResponse(mockResponse, mockProjectID);
            func.should.throw(`Project ${mockProjectID} internal error occurred.\nmock error msg`);
        });
    });
});
