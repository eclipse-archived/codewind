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

class MockFw {
    registerListener() {}
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
// we have now imported FileWatcher.js with some of its imports stubbed out

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
            const mockUser = 'mock user';
            const fw = new FileWatcher(mockUser);

            fw.user.should.equal(mockUser);
            fw.up.should.be.true;
        });
    });
    describe('registerFWListener()', () => {
        it('does not set the locale and does register a FW listener when `this.locale` is falsy', () => {
            const fw = newSimpleFileWatcher();
            fw.locale = false;

            fw.up.should.be.true;
            fw.locale = false;
        });
        it('sets the locale and registers a FW listener when `this.locale` is truthy', () => {
            const fw = newSimpleFileWatcher();
            fw.locale = true;

            fw.up.should.be.true;
            fw.locale = true;
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
});

const newSimpleFileWatcher = () => {
    const mockUser = 'mock user';
    return (new FileWatcher(mockUser));
};
