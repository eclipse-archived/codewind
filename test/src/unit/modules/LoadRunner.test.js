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
    describe('new LoadRunner(user)', () => {
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
            const loadRunner = new LoadRunner('mockUser');

            // assert
            loadRunner.should.containSubset({
                user: 'mockUser',
                hostname: 'codewind-performance',
                port: '9095',
                project: null,
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
            const loadRunner = new LoadRunner(mockUser);
            const mockProject = {
                projectID: 'be4ea4e0-5239-11ea-abf6-f10edc5370f9',
                host: 'mockHost',
                getMetricsContextRoot: () => 'mockMetricsContextRoot',
                getPort: () => 'mockPort',
            };
            loadRunner.project = mockProject;
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
            const loadRunner = new LoadRunner(mockUser);
            const mockProject = {
                projectID: 'be4ea4e0-5239-11ea-abf6-f10edc5370f9',
                host: 'mockHost',
                getMetricsContextRoot: () => 'mockMetricsContextRoot',
                getPort: () => 'mockPort',
            };
            loadRunner.project = mockProject;
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
            const loadRunner = new LoadRunner(mockUser);
            const mockProject = {
                projectID: 'be4ea4e0-5239-11ea-abf6-f10edc5370f9',
                host: 'mockHost',
                getMetricsContextRoot: () => 'mockMetricsContextRoot',
                getPort: () => 'mockPort',
                kubeServiceHost: 'mockKubeServiceHost',
                kubeServicePort: 'mockKubeServicePort',
            };
            loadRunner.project = mockProject;
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
            const loadRunner = new LoadRunner(mockUser);
            const mockProject = {
                projectID: 'be4ea4e0-5239-11ea-abf6-f10edc5370f9',
                host: 'mockHost',
                getMetricsContextRoot: () => 'mockMetricsContextRoot',
                getPort: () => 'mockPort',
            };
            loadRunner.project = mockProject;

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
            const loadRunner = new LoadRunner(mockUser);
            const mockProject = {
                projectID: 'be4ea4e0-5239-11ea-abf6-f10edc5370f9',
                host: 'mockHost',
                getMetricsContextRoot: () => 'mockMetricsContextRoot',
                getPort: () => 'mockPort',
            };
            loadRunner.project = mockProject;

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
        it('throws the correct error when loadRunner already has a project', async() => {
            // arrange
            const LoadRunner = proxyquire(pathToLoadRunnerJs, {
                'socket.io-client': mockIo,
                './utils/Logger': MockLogger,
            });
            const loadRunner = new LoadRunner('mockUser');
            const mockProject = {
                name: 'mockName',
                projectID: 'be4ea4e0-5239-11ea-abf6-f10edc5370f9',
            };
            loadRunner.project = mockProject;

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
            const loadRunner = new LoadRunner('mockUser');
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
            const output = await loadRunner.cancelRunLoad('mockLoadConfig');

            // assert
            asyncHttpRequestStub.should.have.been.calledOnceWithExactly(expectedOptions, 'mockLoadConfig');
            output.should.equal('mockCancelLoadResponse');
        });
    });
});
