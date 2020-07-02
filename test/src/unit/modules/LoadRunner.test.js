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
const dateFormat = require('dateformat');
const fs = require('fs-extra');
const path = require('path');
const sinon = require('sinon');
const chai = require('chai');
const chaiSubset = require('chai-subset');
const deepEqualInAnyOrder = require('deep-equal-in-any-order');
const { c } = require('compress-tag');

/* eslint-disable class-methods-use-this */
class MockLogger {
    error() {}
    warn() {}
    info() {}
    debug() {}
    trace() {}
};
/* eslint-enable class-methods-use-this */

chai.use(chaiSubset);
chai.use(deepEqualInAnyOrder);
const should = chai.should();

const pathToLoadRunnerJs = '../../../../src/pfe/portal/modules/LoadRunner';

describe('LoadRunner.js', () => {
    let sandbox;
    before(() => {
        sandbox = sinon.createSandbox();
    });
    beforeEach(() => {
        sandbox.restore();
    });
    describe('new LoadRunner(project)', () => {
        it('returns a new LoadRunner and connects to the loadrunner container socket', () => {
            // arrange
            const ioConnectStub = sandbox.stub();
            const mockIo = () => ({
                on: () => {},
                connect: ioConnectStub,
            });
            const LoadRunner = proxyquire(pathToLoadRunnerJs, {
                'socket.io-client': mockIo,
                './utils/Logger': MockLogger,
            });

            // act
            const loadRunner = new LoadRunner('mockProject');

            // assert
            loadRunner.should.containSubset({
                user: null,
                hostname: 'codewind-performance',
                port: '9095',
                project: 'mockProject',
                runDescription: null,
                up: false,
                collectionUri: null,
                profilingSocket: null,
                metricsFeatures: {},
            });
            loadRunner.socket.should.not.be.null;
            ioConnectStub.should.have.been.calledOnce;
        });
    });
    describe('fetchProjectMetricsFeatures()', () => {
        const mockIo = () => ({
            on: () => {},
            connect: () => {},
        });
        it('successfully fetches the project metrics features', async() => {
            // arrange
            const expectedMetricsFeature = { timedMetrics: false };
            const asyncHttpRequestStub = sandbox.stub().returns({
                statusCode: 200,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(expectedMetricsFeature),
            });
            const cwUtilsStub = { asyncHttpRequest: asyncHttpRequestStub };
            const LoadRunner = proxyquire(pathToLoadRunnerJs, {
                'socket.io-client': mockIo,
                './utils/sharedFunctions': cwUtilsStub,
                './utils/Logger': MockLogger,
            });
            const loadRunner = new LoadRunner('mockUser');
            const mockProject = {
                projectID: 'be4ea4e0-5239-11ea-abf6-f10edc5370f9',
                host: 'mockHost',
                getMetricsContextRoot: () => 'mockMetricsContextRoot',
                getPort: () => 'mockPort',
                kubeServiceHost: 'mockKubeHost',
                kubeServicePort: 'mockKubePort',
            };
            loadRunner.project = mockProject;

            // act
            await loadRunner.fetchProjectMetricsFeatures();

            // assert
            asyncHttpRequestStub.should.have.been.calledOnceWithExactly({
                host: 'mockKubeHost',
                port: 'mockKubePort',
                path: '/mockMetricsContextRoot/api/v1/collections/features',
                method: 'GET',
            });
            loadRunner.metricsFeatures.should.deep.equal(expectedMetricsFeature);
        });
        it('unsuccessfully fetches the project metrics features', async() => {
            // arrange
            const expectedMetricsFeature = { timedMetrics: false };
            const asyncHttpRequestStub = sandbox.stub().returns({
                statusCode: 500,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(expectedMetricsFeature),
            });
            const cwUtilsStub = { asyncHttpRequest: asyncHttpRequestStub };
            const LoadRunner = proxyquire(pathToLoadRunnerJs, {
                'socket.io-client': mockIo,
                './utils/sharedFunctions': cwUtilsStub,
                './utils/Logger': MockLogger,
            });
            const loadRunner = new LoadRunner('mockUser');
            const mockProject = {
                projectID: 'be4ea4e0-5239-11ea-abf6-f10edc5370f9',
                host: 'mockHost',
                getMetricsContextRoot: () => 'mockMetricsContextRoot',
                getPort: () => 'mockPort',
            };
            loadRunner.project = mockProject;

            // act
            await loadRunner.fetchProjectMetricsFeatures();

            // assert
            asyncHttpRequestStub.should.have.been.calledOnceWithExactly({
                host: 'mockHost',
                port: 'mockPort',
                path: '/mockMetricsContextRoot/api/v1/collections/features',
                method: 'GET',
            });
            loadRunner.metricsFeatures.should.deep.equal({});
        });
        it('errors fetching the project metrics features', async() => {
            // arrange
            const expectedError = new Error('PMF_ERROR');
            const asyncHttpRequestStub = sandbox.stub().throws(expectedError);
            const cwUtilsStub = { asyncHttpRequest: asyncHttpRequestStub };
            const LoadRunner = proxyquire(pathToLoadRunnerJs, {
                'socket.io-client': mockIo,
                './utils/sharedFunctions': cwUtilsStub,
                './utils/Logger': MockLogger,
            });
            const loadRunner = new LoadRunner('mockUser');
            const mockProject = {
                projectID: 'be4ea4e0-5239-11ea-abf6-f10edc5370f9',
                host: 'mockHost',
                getMetricsContextRoot: () => 'mockMetricsContextRoot',
                getPort: () => 'mockPort',
            };
            loadRunner.project = mockProject;

            // act
            await loadRunner.fetchProjectMetricsFeatures();

            // assert
            asyncHttpRequestStub.should.have.been.calledOnceWithExactly({
                host: 'mockHost',
                port: 'mockPort',
                path: '/mockMetricsContextRoot/api/v1/collections/features',
                method: 'GET',
            });
            asyncHttpRequestStub.should.have.thrown(expectedError);
            loadRunner.metricsFeatures.should.deep.equal({});
        });
    });
    describe('createCollection(seconds)', () => {
        const mockIo = () => ({
            on: () => {},
            connect: () => {},
        });
        it(c`updates the UI when the project supports timed metrics,
        then POSTs to the project collections route,
        and returns the header location when successful`, async() => {
            // arrange
            const asyncHttpRequestStub = sandbox.stub().returns({
                statusCode: 201,
                headers: { location: 'mockLocation' },
            });
            const cwUtilsStub = { asyncHttpRequest: asyncHttpRequestStub };
            const LoadRunner = proxyquire(pathToLoadRunnerJs, {
                'socket.io-client': mockIo,
                './utils/sharedFunctions': cwUtilsStub,
                './utils/Logger': MockLogger,
            });
            const mockUser = {
                uiSocket: { emit: sandbox.stub() },
            };
            const mockProject = {
                projectID: 'be4ea4e0-5239-11ea-abf6-f10edc5370f9',
                host: 'mockHost',
                getMetricsContextRoot: () => 'mockMetricsContextRoot',
                getPort: () => 'mockPort',
            };
            const loadRunner = new LoadRunner(mockProject);
            loadRunner.user = mockUser;
            loadRunner.metricsFeatures = { timedMetrics: false };

            // act
            const output = await loadRunner.createCollection();

            // assert
            loadRunner.user.uiSocket.emit.should.have.been.calledOnceWithExactly('runloadStatusChanged', {
                projectID: mockProject.projectID,
                status: 'app-is-using-old-metrics',
            });
            asyncHttpRequestStub.should.have.been.calledOnceWithExactly({
                host: 'mockHost',
                port: 'mockPort',
                path: '/mockMetricsContextRoot/api/v1/collections',
                method: 'POST',
            });
            output.should.equal('mockLocation');
        });
        it(c`doesn\'t update the UI when the project doesn\'t support timed metrics,
        then POSTs to the project collections route
        and returns the header location when successful`, async() => {
            // arrange
            const asyncHttpRequestStub = sandbox.stub().returns({
                statusCode: 201,
                headers: { location: 'mockLocation' },
            });
            const cwUtilsStub = { asyncHttpRequest: asyncHttpRequestStub };
            const LoadRunner = proxyquire(pathToLoadRunnerJs, {
                'socket.io-client': mockIo,
                './utils/sharedFunctions': cwUtilsStub,
                './utils/Logger': MockLogger,
            });
            const mockUser = {
                uiSocket: { emit: sandbox.stub() },
            };
            const mockProject = {
                projectID: 'be4ea4e0-5239-11ea-abf6-f10edc5370f9',
                host: 'mockHost',
                getMetricsContextRoot: () => 'mockMetricsContextRoot',
                getPort: () => 'mockPort',
            };
            const loadRunner = new LoadRunner(mockProject);
            loadRunner.user = mockUser;
            loadRunner.metricsFeatures = { timedMetrics: true };
            const seconds = 500;

            // act
            const output = await loadRunner.createCollection(seconds);

            // assert
            loadRunner.user.uiSocket.emit.should.not.have.been.called;
            asyncHttpRequestStub.should.have.been.calledOnceWithExactly({
                host: 'mockHost',
                port: 'mockPort',
                path: `/mockMetricsContextRoot/api/v1/collections/${seconds}`,
                method: 'POST',
            });
            output.should.equal('mockLocation');
        });
        it(c`doesn\'t update the UI when the project doesn\'t support timed metrics,
        then POSTs to the project collections route when the project is in Kubernetes
        and returns the header location when successful`, async() => {
            // arrange
            const asyncHttpRequestStub = sandbox.stub().returns({
                statusCode: 201,
                headers: { location: 'mockLocation' },
            });
            const cwUtilsStub = { asyncHttpRequest: asyncHttpRequestStub };
            const LoadRunner = proxyquire(pathToLoadRunnerJs, {
                'socket.io-client': mockIo,
                './utils/sharedFunctions': cwUtilsStub,
                './utils/Logger': MockLogger,
            });
            const mockUser = {
                uiSocket: { emit: sandbox.stub() },
            };
            const mockProject = {
                projectID: 'be4ea4e0-5239-11ea-abf6-f10edc5370f9',
                host: 'mockHost',
                getMetricsContextRoot: () => 'mockMetricsContextRoot',
                getPort: () => 'mockPort',
                kubeServiceHost: 'mockKubeServiceHost',
                kubeServicePort: 'mockKubeServicePort',
            };
            const loadRunner = new LoadRunner(mockProject);
            loadRunner.user = mockUser;
            loadRunner.metricsFeatures = { timedMetrics: true };
            const seconds = 500;

            // act
            const output = await loadRunner.createCollection(seconds);

            // assert
            loadRunner.user.uiSocket.emit.should.not.have.been.called;
            asyncHttpRequestStub.should.have.been.calledOnceWithExactly({
                host: 'mockKubeServiceHost',
                port: 'mockKubeServicePort',
                path: `/mockMetricsContextRoot/api/v1/collections/${seconds}`,
                method: 'POST',
            });
            output.should.equal('mockLocation');
        });
        it(c`POSTs to the project collections route
        then returns null when unsuccessful (400)`, async() => {
            // arrange
            const asyncHttpRequestStub = sandbox.stub().returns({
                statusCode: 400,
            });
            const cwUtilsStub = { asyncHttpRequest: asyncHttpRequestStub };
            const logErrorSpy = sandbox.spy(MockLogger.prototype, 'error');
            const LoadRunner = proxyquire(pathToLoadRunnerJs, {
                'socket.io-client': mockIo,
                './utils/sharedFunctions': cwUtilsStub,
                './utils/Logger': MockLogger,
            });
            const mockUser = {
                uiSocket: { emit: () => {} },
            };
            const mockProject = {
                projectID: 'be4ea4e0-5239-11ea-abf6-f10edc5370f9',
                host: 'mockHost',
                getMetricsContextRoot: () => 'mockMetricsContextRoot',
                getPort: () => 'mockPort',
            };
            const loadRunner = new LoadRunner(mockProject);
            loadRunner.user = mockUser;

            // act
            const output = await loadRunner.createCollection();

            // assert
            asyncHttpRequestStub.should.have.been.calledOnceWithExactly({
                host: 'mockHost',
                port: 'mockPort',
                path: '/mockMetricsContextRoot/api/v1/collections',
                method: 'POST',
            });
            logErrorSpy.should.have.been.calledOnceWithExactly('createCollection: too many metrics collections 400');
            should.equal(output, null);
        });
        it(c`POSTs to the project collections route
        then returns null when res.statusCode is unexpected (e.g. 499)`, async() => {
            // arrange
            const asyncHttpRequestStub = sandbox.stub().returns({
                statusCode: 499,
            });
            const cwUtilsStub = { asyncHttpRequest: asyncHttpRequestStub };
            const logErrorSpy = sandbox.spy(MockLogger.prototype, 'error');
            const LoadRunner = proxyquire(pathToLoadRunnerJs, {
                'socket.io-client': mockIo,
                './utils/sharedFunctions': cwUtilsStub,
                './utils/Logger': MockLogger,
            });
            const mockUser = {
                uiSocket: { emit: () => {} },
            };
            const mockProject = {
                projectID: 'be4ea4e0-5239-11ea-abf6-f10edc5370f9',
                host: 'mockHost',
                getMetricsContextRoot: () => 'mockMetricsContextRoot',
                getPort: () => 'mockPort',
            };
            const loadRunner = new LoadRunner(mockProject);
            loadRunner.user = mockUser;

            // act
            const output = await loadRunner.createCollection();

            // assert
            asyncHttpRequestStub.should.have.been.calledOnceWithExactly({
                host: 'mockHost',
                port: 'mockPort',
                path: '/mockMetricsContextRoot/api/v1/collections',
                method: 'POST',
            });
            logErrorSpy.should.have.been.calledOnceWithExactly('createCollection: unable to create metrics collection: 499');
            should.equal(output, null);
        });
        it('POSTs to the project collections route and handles an error', async() => {
            // arrange
            const expectedError = new Error('CC_ERROR');
            const asyncHttpRequestStub = sandbox.stub().throws(expectedError);
            const cwUtilsStub = { asyncHttpRequest: asyncHttpRequestStub };
            const logErrorSpy = sandbox.spy(MockLogger.prototype, 'error');
            const LoadRunner = proxyquire(pathToLoadRunnerJs, {
                'socket.io-client': mockIo,
                './utils/sharedFunctions': cwUtilsStub,
                './utils/Logger': MockLogger,
            });
            const mockUser = {
                uiSocket: { emit: () => {} },
            };
            const mockProject = {
                projectID: 'be4ea4e0-5239-11ea-abf6-f10edc5370f9',
                host: 'mockHost',
                getMetricsContextRoot: () => 'mockMetricsContextRoot',
                getPort: () => 'mockPort',
            };
            const loadRunner = new LoadRunner(mockProject);
            loadRunner.user = mockUser;

            // act
            await loadRunner.createCollection();

            // assert
            asyncHttpRequestStub.should.have.been.calledOnceWithExactly({
                host: 'mockHost',
                port: 'mockPort',
                path: '/mockMetricsContextRoot/api/v1/collections',
                method: 'POST',
            });
            asyncHttpRequestStub.should.have.thrown(expectedError);
            logErrorSpy.should.have.been.calledWithExactly('createCollection: Error in function createCollection');
        });
    });
    describe('recordCollection()', () => {
        const mockIo = () => ({
            on: () => {},
            connect: () => {},
        });
        it(c`GETs from the project collections route
        then does nothing when the status code is unexpected
        then doesn\'t DELETE the collection when the project supports timed collections`, async() => {
            // arrange
            const httpRequestStub = sandbox.stub().returns({
                statusCode: 299,
                on: () => ({
                    end: () => {},
                }),
            });
            const httpStub = {
                request: httpRequestStub,
            };
            const asyncHttpRequestStub = sandbox.stub().returns({
                statusCode: 201,
                headers: { location: 'mockLocation' },
            });
            const LoadRunner = proxyquire(pathToLoadRunnerJs, {
                'socket.io-client': mockIo,
                http: httpStub,
                './utils/sharedFunctions': { asyncHttpRequest: asyncHttpRequestStub },
                './utils/Logger': MockLogger,
            });
            const loadRunner = new LoadRunner('mockUser');
            const mockProject = {
                projectID: 'be4ea4e0-5239-11ea-abf6-f10edc5370f9',
                host: 'mockHost',
                getMetricsContextRoot: () => 'mockMetricsContextRoot',
                getPort: () => 'mockPort',
            };
            loadRunner.project = mockProject;
            loadRunner.collectionUri = 'mockCollectionUri';
            loadRunner.metricsFeatures = { timedMetrics: false };

            // act
            const output = await loadRunner.recordCollection();

            // assert
            asyncHttpRequestStub.should.have.been.calledOnceWithExactly({
                method: 'GET',
                host: 'mockHost',
                port: 'mockPort',
                path: '/mockMetricsContextRoot/api/v1/mockCollectionUri',
            });
            httpRequestStub.should.have.been.calledWithMatch({
                method: 'DELETE',
                host: 'mockHost',
                port: 'mockPort',
                path: '/mockMetricsContextRoot/api/v1/mockCollectionUri',
            });
            should.equal(output, undefined); // eslint-disable-line no-undefined
        });
    });
    describe('runLoad(loadConfig, targetProject, runDesc)', () => {
        const mockIo = () => ({
            on: () => {},
            connect: () => {},
        });
        it('throws the correct error when loadRunner is not idle', async() => {
            // arrange
            const LoadRunner = proxyquire(pathToLoadRunnerJs, {
                'socket.io-client': mockIo,
                './utils/Logger': MockLogger,
            });
            const mockProject = {
                name: 'mockName',
                projectID: 'be4ea4e0-5239-11ea-abf6-f10edc5370f9',
            };
            const loadRunner = new LoadRunner(mockProject);
            loadRunner.user = 'mockUser';
            loadRunner.status.CURRENT_STATE = 'RUNNING';

            // act & assert
            await loadRunner.runLoad().should.eventually.be.rejectedWith(`Load run already in progress.\nFor project ${mockProject.name} (${mockProject.projectID})`);
        });
        it('throws the correct error when loadRunner is not up', async() => {
            // arrange
            const LoadRunner = proxyquire(pathToLoadRunnerJs, {
                'socket.io-client': mockIo,
                './utils/Logger': MockLogger,
            });
            const loadRunner = new LoadRunner('mockUser');
            // by default, loadRunner.up === false

            // act & assert
            await loadRunner.runLoad().should.eventually.be.rejectedWith('Load Runner service is not available');
        });
        it(c`saves the run description,
        creates a results directory,
        updates the project endpoints,
        updates the metrics features of the project,
        does not write a git hash when the project does not have git information,
        tells the UI we are preparing to run load,
        does not start profiling when the project does not support it,
        starts collection on metrics endpoint,
        tells the UI we are starting to run load,
        requests a load run from the loadrunner microservice,
        does not cancel profiling when successful,
        returns the response from the loadrunner microservice`, async() => {
            // arrange
            const asyncHttpRequestStub = () => ({ statusCode: 202 });
            const LoadRunner = proxyquire(pathToLoadRunnerJs, {
                'socket.io-client': mockIo,
                './utils/sharedFunctions': { asyncHttpRequest: asyncHttpRequestStub },
                './utils/Logger': MockLogger,
            });
            const mockUser = {
                uiSocket: { emit: sandbox.stub() },
            };
            const mockProject = {
                name: 'mockName',
                projectID: 'be4ea4e0-5239-11ea-abf6-f10edc5370f9',
                getProjectKubeService: sandbox.stub(),
            };
            const loadRunner = new LoadRunner(mockProject);
            loadRunner.user = mockUser;
            loadRunner.up = true;

            const mockLoadConfig = { maxSeconds: 999 };

            const createResultsDirectory = sandbox.stub(loadRunner, 'createResultsDirectory');
            const fetchProjectMetricsFeatures = sandbox.stub(loadRunner, 'fetchProjectMetricsFeatures');
            const createCollection = sandbox.stub(loadRunner, 'createCollection');
            const writeGitHash = sandbox.stub(loadRunner, 'writeGitHash');
            const beginNodeProfiling = sandbox.stub(loadRunner, 'beginNodeProfiling');
            const beginJavaProfiling = sandbox.stub(loadRunner, 'beginJavaProfiling');
            const heartbeat = sandbox.stub(loadRunner, 'heartbeat');

            // act
            const loadrunnerRes = await loadRunner.runLoad(mockLoadConfig, mockProject, 'mockRunDescription');

            // assert
            loadRunner.runDescription.should.equal('mockRunDescription');
            createResultsDirectory.should.have.been.calledOnceWithExactly();
            loadRunner.project.getProjectKubeService.should.have.been.calledOnceWithExactly();
            fetchProjectMetricsFeatures.should.have.been.calledOnceWithExactly();
            writeGitHash.should.not.have.been.called;
            heartbeat.should.have.been.calledWithExactly('preparing');
            beginNodeProfiling.should.not.have.been.called;
            beginJavaProfiling.should.not.have.been.called;
            createCollection.should.have.been.calledOnceWithExactly(mockLoadConfig.maxSeconds);
            heartbeat.should.have.been.calledWithExactly('starting');
            loadrunnerRes.should.deep.equal({ statusCode: 202 });
        });
    });
    describe('cancelRunLoad(loadConfig)', () => {
        const mockIo = () => ({
            on: () => {},
            connect: () => {},
        });
        it('throws the correct error when loadRunner\'s request to cancel load errors', async() => {
            // arrange
            const asyncHttpRequestStub = () => { throw new Error('error cancelling load'); };
            const LoadRunner = proxyquire(pathToLoadRunnerJs, {
                'socket.io-client': mockIo,
                './utils/sharedFunctions': { asyncHttpRequest: asyncHttpRequestStub },
                './utils/Logger': MockLogger,
            });
            const loadRunner = new LoadRunner('mockUser');

            // act & assert
            await loadRunner.cancelRunLoad().should.eventually.be.rejectedWith('Load Runner service is not available');
        });
        it('returns the response to the request to cancel load when it doesn\'t error', async() => {
            // arrange
            const asyncHttpRequestStub = sandbox.stub().returns('mockCancelLoadResponse');
            const LoadRunner = proxyquire(pathToLoadRunnerJs, {
                'socket.io-client': mockIo,
                './utils/sharedFunctions': { asyncHttpRequest: asyncHttpRequestStub },
                './utils/Logger': MockLogger,
            });
            const loadRunner = new LoadRunner({ projectID: 'mockID' });
            loadRunner.user = 'mockUser';
            const expectedOptions = {
                host: 'codewind-performance',
                port: '9095',
                path: '/api/v1/cancelLoad',
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
            };

            // act
            const output = await loadRunner.cancelRunLoad();

            // assert
            asyncHttpRequestStub.should.have.been.calledOnceWithExactly(expectedOptions, { projectID: 'mockID' });
            output.should.equal('mockCancelLoadResponse');
        });
    });
    describe('getJavaHealthCenterData(counter)', () => {
        it('fails straightaway', async() => {
            // arrange
            const LoadRunner = proxyquire(pathToLoadRunnerJs, {
                './utils/Logger': MockLogger,
            });
            const mockUser = {
                uiSocket: { emit: sandbox.stub() },
            };
            const loadRunner = new LoadRunner('mockProject');
            loadRunner.user = mockUser;
            loadRunner.project = { projectID: 'be4ea4e0-5239-11ea-abf6-f10edc5370f9' };
            const logErrorSpy = sandbox.spy(MockLogger.prototype, 'error');

            // act
            await loadRunner.getJavaHealthCenterData(21);

            // assert
            logErrorSpy.should.have.been.calledOnceWithExactly('getJavaHealthCenterData: Failed to save .hcd file');
            loadRunner.project = null;
        });
        it('fails after attempt with null project', async() => {
            // arrange
            const LoadRunner = proxyquire(pathToLoadRunnerJs, {
                './utils/Logger': MockLogger,
            });
            const mockUser = {
                uiSocket: { emit: sandbox.stub() },
            };
            const loadRunner = new LoadRunner(null);
            loadRunner.user = mockUser;
            const logWarnSpy = sandbox.spy(MockLogger.prototype, 'warn');

            // act
            await loadRunner.getJavaHealthCenterData(20);

            // assert
            logWarnSpy.should.have.been.calledOnceWithExactly('getJavaHealthCenterData: Project was made null before .hcd could be found.');
        });
        it('tries again after a failed attempt', async() => {
            // arrange
            const LoadRunner = proxyquire(pathToLoadRunnerJs, {
                './utils/Logger': MockLogger,
            });
            const mockUser = {
                uiSocket: { emit: sandbox.stub() },
            };
            const loadRunner = new LoadRunner({ projectID: 'be4ea4e0-5239-11ea-abf6-f10edc5370f9' });
            loadRunner.user = mockUser;
            const logInfoSpy = sandbox.spy(MockLogger.prototype, 'info');
            const gJHCDSpy = sandbox.spy(loadRunner, 'getJavaHealthCenterData');

            // act
            await loadRunner.getJavaHealthCenterData(20);

            // assert
            gJHCDSpy.should.have.been.calledWith(20);
            logInfoSpy.should.have.been.calledOnceWithExactly('getJavaHealthCenterData: .hcd file not found, trying again. Attempt 20/20');
        });
        it('emits on UISocket when hcd copied', async() => {
            // arrange
            const expectedMetricsFolder = dateFormat(new Date(), 'yyyymmddHHMMss');
            const LoadRunner = proxyquire(pathToLoadRunnerJs, {
                './utils/Logger': MockLogger,
            });
            const mockUser = {
                uiSocket: { emit: sandbox.stub() },
            };
            const mockProject = {
                projectID: 'be4ea4e0-5239-11ea-abf6-f10edc5370f9',
                getProfilingByTime: () => {},
            };
            const loadRunner = new LoadRunner(mockProject);
            loadRunner.user = mockUser;
            loadRunner.metricsFolder = expectedMetricsFolder;
            loadRunner.postProcessProfilingData = () => true;
            const logInfoSpy = sandbox.spy(MockLogger.prototype, 'info');
            const expectedData = {
                projectID: mockProject.projectID,
                status: 'hcdReady',
                timestamp: expectedMetricsFolder,
            };

            const expectedDataForPerfUI = {
                projectID: mockProject.projectID,
                status: 'completed',
            };

            // act
            await loadRunner.getJavaHealthCenterData(20);

            // assert
            logInfoSpy.should.have.been.calledOnceWithExactly('getJavaHealthCenterData: .hcd copied to PFE');
            loadRunner.user.uiSocket.emit.should.have.been.called.calledWith('runloadStatusChanged', expectedData);
            loadRunner.user.uiSocket.emit.should.have.been.called.calledWith('runloadStatusChanged', expectedDataForPerfUI);

        });
    });
    describe('createResultsDirectory()', () => {
        it('creates the results directory', async() => {
            // arrange
            const workingDir = path.join('.', 'crd_test');
            await fs.mkdirp(workingDir);
            const LoadRunner = proxyquire(pathToLoadRunnerJs, {});
            const loadRunner = new LoadRunner('mockUser');
            const mockProject = {
                loadTestPath: workingDir,
            };
            loadRunner.project = mockProject;

            // act
            const originalDate = new Date();
            await loadRunner.createResultsDirectory();

            // assert
            const actualMetricsFolder = path.basename(loadRunner.workingDir);
            const expectedMetricsFolder = dateFormat(originalDate, 'yyyymmddHHMMss');
            const actualTime = parseInt(actualMetricsFolder, 10);
            const originalTime = parseInt(expectedMetricsFolder, 10);
            (actualTime - originalTime).should.be.at.most(1, 'Expected time2 to equal time1, or be at most 1s after time1');

            // cleanup
            const pathToActualMetricsFolder = path.join(workingDir, actualMetricsFolder);
            await fs.remove(pathToActualMetricsFolder);
        });
    });
    describe('writeGitHash() ', () => {
        it('writes a git hash to a file', async() => {
            // arrange
            const gitHashValue = '5c9c13c160bbe967e4a7c81b54d403321d77ff56';
            const gitHashObject = { gitHash: gitHashValue };
            const workingDir = path.join('.', 'wgh_test');
            await fs.mkdirp(workingDir);
            const LoadRunner = proxyquire(pathToLoadRunnerJs, {});
            const loadRunner = new LoadRunner('mockUser');
            const mockProject = {
                git: { getLastCommitHash: sandbox.stub().returns(gitHashValue) },
            };
            loadRunner.project = mockProject;
            loadRunner.workingDir = workingDir;

            // act
            await loadRunner.writeGitHash();
            const runinfoFilePath = path.join(loadRunner.workingDir, 'runinfo.json');
            const runinfoContents = await fs.readJSON(runinfoFilePath);
            await fs.remove(runinfoFilePath);

            // assert
            runinfoContents.should.be.deep.equal(gitHashObject);
        });
    });
    describe('beginNodeProfiling() ', () => {
        it('creates a profiling socket', async() => {
            // arrange
            const openStub = sandbox.stub();
            const onStub = sandbox.stub();
            const mockIo = sandbox.stub().returns({
                on: onStub,
                connect: () => {},
                open: openStub,
            });
            const logDebugSpy = sandbox.spy(MockLogger.prototype, 'debug');
            const LoadRunner = proxyquire(pathToLoadRunnerJs, {
                'socket.io-client': mockIo,
                './utils/Logger': MockLogger,
            });
            const loadRunner = new LoadRunner('mockUser');
            const mockProject = {
                projectID: 'be4ea4e0-5239-11ea-abf6-f10edc5370f9',
                host: 'mockHost',
                getMetricsContextRoot: () => 'mockMetricsContextRoot',
                getPort: () => 'mockPort',
            };
            loadRunner.project = mockProject;

            // act
            await loadRunner.beginNodeProfiling();

            // assert
            logDebugSpy.should.have.been.calledOnceWithExactly('beginProfiling: Connecting to appmetrics socket ws://mockHost:mockPort/appmetrics-dash/socket.io');
            mockIo.should.have.been.calledWithExactly('ws://mockHost:mockPort/', {
                transport: ['websocket'],
                path: '/appmetrics-dash/socket.io',
                autoConnect: false,
            });
            onStub.should.have.been.calledWith('connect');
            onStub.should.have.been.calledWith('profiling');
            onStub.should.have.been.calledWith('disconnect');
            loadRunner.profilingSamples.should.be.deep.equal([]);
            openStub.should.have.been.calledOnce;
        });
    });
    describe('endProfiling() ', () => {
        it('writes samples out and disconnects profilingSocket if profilingSocket exists', async() => {
            // arrange
            const expectedObject = { successful: true };
            const expectedMetricsFolder = '202003061524';
            const workingDir = path.join('.', 'ep_test');
            await fs.mkdirp(workingDir);
            const psEmitStub = sandbox.stub();
            const psDisconnectStub = sandbox.stub();
            const mockProfilingSocket = {
                emit: psEmitStub,
                disconnect: psDisconnectStub,
            };
            const logInfoSpy = sandbox.spy(MockLogger.prototype, 'info');
            const LoadRunner = proxyquire(pathToLoadRunnerJs, {
                './utils/Logger': MockLogger,
            });
            const mockUser = {
                uiSocket: { emit: sandbox.stub() },
            };
            const mockProject = {
                name: 'mockName',
                projectID: 'be4ea4e0-5239-11ea-abf6-f10edc5370f9',
            };
            const loadRunner = new LoadRunner(mockProject);
            loadRunner.user = mockUser;
            loadRunner.profilingSocket = mockProfilingSocket;
            loadRunner.metricsFolder = expectedMetricsFolder;
            loadRunner.workingDir = workingDir;
            loadRunner.profilingSamples = expectedObject;
            const expectedData = {
                projectID: mockProject.projectID,
                status: 'profilingReady',
                timestamp: expectedMetricsFolder,
            };

            const expectedDataForPerfUI = {
                projectID: mockProject.projectID,
                status: 'completed',
            };

            const profilingJsonPath = path.join(loadRunner.workingDir, 'profiling.json');

            // act
            await loadRunner.endProfiling();
            const profilingContents = await fs.readJSON(profilingJsonPath);
            await fs.remove(profilingJsonPath);

            // assert
            profilingContents.should.be.deep.equal(expectedObject);
            logInfoSpy.should.have.been.calledOnceWithExactly('profiling.json saved for project mockName');
            loadRunner.user.uiSocket.emit.should.have.been.calledWith('runloadStatusChanged', expectedData);
            psEmitStub.should.have.been.calledOnceWithExactly('disableprofiling');
            psDisconnectStub.should.have.been.calledOnce;
            should.equal(loadRunner.profilingSocket, null);
            should.equal(loadRunner.profilingSamples, null);
            loadRunner.user.uiSocket.emit.should.have.been.calledWith('runloadStatusChanged', expectedDataForPerfUI);
        });
        it('still notifies the UI the perf run has completed if profilingSocket is null', async() => {
            // arrange
            const expectedMetricsFolder = '202003061524';
            const LoadRunner = proxyquire(pathToLoadRunnerJs, {});
            const mockUser = {
                uiSocket: { emit: sandbox.stub() },
            };
            const mockProject = {
                name: 'mockName',
                projectID: 'be4ea4e0-5239-11ea-abf6-f10edc5370f9',
            };
            const loadRunner = new LoadRunner(mockProject);
            loadRunner.user = mockUser;
            loadRunner.profilingSocket = null;
            loadRunner.metricsFolder = expectedMetricsFolder;

            const expectedData = {
                projectID: mockProject.projectID,
                status: 'completed',
            };
            // act
            await loadRunner.endProfiling();

            // assert
            should.equal(loadRunner.profilingSocket, null);
            loadRunner.user.uiSocket.emit.should.have.been.calledWith('runloadStatusChanged', expectedData);
        });
    });
    describe('cancelProfiling() ', () => {
        it('disconnects if profilingSocket exists', async() => {
            // arrange
            const psEmitStub = sandbox.stub();
            const psDisconnectStub = sandbox.stub();
            const mockProfilingSocket = {
                emit: psEmitStub,
                disconnect: psDisconnectStub,
            };
            const LoadRunner = proxyquire(pathToLoadRunnerJs, {});
            const loadRunner = new LoadRunner('mockUser');
            loadRunner.profilingSocket = mockProfilingSocket;

            // act
            await loadRunner.cancelProfiling();

            // assert
            psEmitStub.should.have.been.calledOnceWithExactly('disableprofiling');
            psDisconnectStub.should.have.been.calledOnce;
            should.equal(loadRunner.profilingSocket, null);
        });
        it('does nothing if profilingSocket is null', async() => {
            // arrange
            const LoadRunner = proxyquire(pathToLoadRunnerJs, {});
            const loadRunner = new LoadRunner('mockUser');
            loadRunner.profilingSocket = null;

            // act
            await loadRunner.cancelProfiling();

            // assert
            should.equal(loadRunner.profilingSocket, null);
        });
    });
    describe('shutdown()', () => {
        it('shuts down cleanly on 200', async() => {
            // arrange
            const ioDisconnectStub = sandbox.stub();
            const mockIo = () => ({
                on: () => {},
                connect: () => {},
                disconnect: ioDisconnectStub,
            });
            const asyncHttpRequestStub = sandbox.stub().returns({ statusCode: 200 });
            const LoadRunner = proxyquire(pathToLoadRunnerJs, {
                'socket.io-client': mockIo,
                './utils/sharedFunctions': { asyncHttpRequest: asyncHttpRequestStub },
                './utils/Logger': MockLogger,
            });
            const loadRunner = new LoadRunner('mockUser');
            loadRunner.up = true;
            const mockProject = {
                projectID: 'be4ea4e0-5239-11ea-abf6-f10edc5370f9',
                host: 'mockHost',
                getMetricsContextRoot: () => 'mockMetricsContextRoot',
                getPort: () => 'mockPort',
            };
            loadRunner.project = mockProject;
            loadRunner.hostname = 'mockHost';
            loadRunner.port = 'mockPort';
            const expectedOptions = {
                host: 'mockHost',
                port: 'mockPort',
                path: '/api/v1/cancel',
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
            };

            // act
            await loadRunner.shutdown();

            // assert
            asyncHttpRequestStub.should.have.been.calledOnceWithExactly(expectedOptions);
            loadRunner.up.should.be.false;
            ioDisconnectStub.should.have.been.calledOnce;
        });
        it('shuts down cleanly on 400', async() => {
            // arrange
            const ioDisconnectStub = sandbox.stub();
            const mockIo = () => ({
                on: () => {},
                connect: () => {},
                disconnect: ioDisconnectStub,
            });
            const asyncHttpRequestStub = sandbox.stub().returns({ statusCode: 400 });
            const LoadRunner = proxyquire(pathToLoadRunnerJs, {
                'socket.io-client': mockIo,
                './utils/sharedFunctions': { asyncHttpRequest: asyncHttpRequestStub },
                './utils/Logger': MockLogger,
            });
            const loadRunner = new LoadRunner('mockUser');
            loadRunner.up = true;
            const mockProject = {
                projectID: 'be4ea4e0-5239-11ea-abf6-f10edc5370f9',
                host: 'mockHost',
                getMetricsContextRoot: () => 'mockMetricsContextRoot',
                getPort: () => 'mockPort',
            };
            loadRunner.project = mockProject;
            loadRunner.hostname = 'mockHost';
            loadRunner.port = 'mockPort';
            const expectedOptions = {
                host: 'mockHost',
                port: 'mockPort',
                path: '/api/v1/cancel',
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
            };

            // act
            await loadRunner.shutdown();

            // assert
            asyncHttpRequestStub.should.have.been.calledOnceWithExactly(expectedOptions);
            loadRunner.up.should.be.false;
            ioDisconnectStub.should.have.been.calledOnce;
        });
        it('shuts down cleanly on 500 whilst logging error', async() => {
            // arrange
            const ioDisconnectStub = sandbox.stub();
            const mockIo = () => ({
                on: () => {},
                connect: () => {},
                disconnect: ioDisconnectStub,
            });
            const asyncHttpRequestStub = sandbox.stub().returns({ statusCode: 500 });
            const LoadRunner = proxyquire(pathToLoadRunnerJs, {
                'socket.io-client': mockIo,
                './utils/sharedFunctions': { asyncHttpRequest: asyncHttpRequestStub },
                './utils/Logger': MockLogger,
            });
            const loadRunner = new LoadRunner('mockUser');
            loadRunner.up = true;
            const mockProject = {
                projectID: 'be4ea4e0-5239-11ea-abf6-f10edc5370f9',
                host: 'mockHost',
                getMetricsContextRoot: () => 'mockMetricsContextRoot',
                getPort: () => 'mockPort',
            };
            loadRunner.project = mockProject;
            loadRunner.hostname = 'mockHost';
            loadRunner.port = 'mockPort';
            const logErrorSpy = sandbox.spy(MockLogger.prototype, 'error');
            const expectedOptions = {
                host: 'mockHost',
                port: 'mockPort',
                path: '/api/v1/cancel',
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
            };

            // act
            await loadRunner.shutdown();

            // assert
            asyncHttpRequestStub.should.have.been.calledOnceWithExactly(expectedOptions);
            logErrorSpy.should.have.been.calledOnceWithExactly('shutdown: error sending cancel request (500 received)');
            loadRunner.up.should.be.false;
            ioDisconnectStub.should.have.been.calledOnce;
        });
        it('shuts down cleanly on unknown status whilst logging error', async() => {
            // arrange
            const ioDisconnectStub = sandbox.stub();
            const mockIo = () => ({
                on: () => {},
                connect: () => {},
                disconnect: ioDisconnectStub,
            });
            const asyncHttpRequestStub = sandbox.stub().returns({ statusCode: 299 });
            const LoadRunner = proxyquire(pathToLoadRunnerJs, {
                'socket.io-client': mockIo,
                './utils/sharedFunctions': { asyncHttpRequest: asyncHttpRequestStub },
                './utils/Logger': MockLogger,
            });
            const loadRunner = new LoadRunner('mockUser');
            loadRunner.up = true;
            const mockProject = {
                projectID: 'be4ea4e0-5239-11ea-abf6-f10edc5370f9',
                host: 'mockHost',
                getMetricsContextRoot: () => 'mockMetricsContextRoot',
                getPort: () => 'mockPort',
            };
            loadRunner.project = mockProject;
            loadRunner.hostname = 'mockHost';
            loadRunner.port = 'mockPort';
            const logErrorSpy = sandbox.spy(MockLogger.prototype, 'error');
            const expectedOptions = {
                host: 'mockHost',
                port: 'mockPort',
                path: '/api/v1/cancel',
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
            };

            // act
            await loadRunner.shutdown();

            // assert
            asyncHttpRequestStub.should.have.been.calledOnceWithExactly(expectedOptions);
            logErrorSpy.should.have.been.calledOnceWithExactly('shutdown: (299 received)');
            loadRunner.up.should.be.false;
            ioDisconnectStub.should.have.been.calledOnce;
        });
        it('shuts down cleanly if already down', async() => {
            // arrange
            const ioDisconnectStub = sandbox.stub();
            const mockIo = () => ({
                on: () => {},
                connect: () => {},
                disconnect: ioDisconnectStub,
            });
            const asyncHttpRequestStub = sandbox.stub().returns({ statusCode: 299 });
            const LoadRunner = proxyquire(pathToLoadRunnerJs, {
                'socket.io-client': mockIo,
                './utils/sharedFunctions': { asyncHttpRequest: asyncHttpRequestStub },
                './utils/Logger': MockLogger,
            });
            const loadRunner = new LoadRunner('mockUser');
            loadRunner.up = false;

            // act
            await loadRunner.shutdown();

            // assert
            asyncHttpRequestStub.should.have.been.not.called;
            loadRunner.up.should.be.false;
            ioDisconnectStub.should.have.been.calledOnce;
        });
    });
});
