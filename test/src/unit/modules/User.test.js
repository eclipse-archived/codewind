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
const fs = require('fs-extra');
const path = require('path');
const proxyquire = require('proxyquire');
const chai = require('chai');
const chaiSubset = require('chai-subset');
const deepEqualInAnyOrder = require('deep-equal-in-any-order');

const ProjectList = require('../../../../src/pfe/portal/modules/ProjectList');
const ExtensionList = require('../../../../src/pfe/portal/modules/ExtensionList');

// import User.js but mock some of its imports so we can test it in isolation
/* eslint-disable class-methods-use-this */
class MockLogger {
    error() {}
    warn() {}
    info() {}
    debug() {}
    trace() {}
};

class MockTemplates {
    initializeRepositoryList() {}
    getTemplates() { return []; }
};

class MockLoadRunner {};

class MockFileWatcher {
    setLocale() {}
};
/* eslint-enable class-methods-use-this */

/* we need to specify noCallThru because otherwise when proxyquire
 requires FileWatcher.js it will also require 'file-watcher', which will error.
 See https://github.com/thlorenz/proxyquire#preventing-call-thru-to-original-dependency
*/
MockFileWatcher['@noCallThru'] = true; 

const User = proxyquire('../../../../src/pfe/portal/modules/User', {
    './utils/Logger': MockLogger,
    './Templates': MockTemplates,
    './LoadRunner': MockLoadRunner,
    './FileWatcher': MockFileWatcher,
});
// we have now imported User.js with some of its imports stubbed out

// import Project.js but mock the logger so it does not pollute the test output
const Project = proxyquire('../../../../src/pfe/portal/modules/Project', {
    './utils/Logger': MockLogger,
});

chai.use(chaiSubset);
chai.use(deepEqualInAnyOrder);
const should = chai.should();

const testWorkspace = path.join(__dirname, `${__filename}/`);
const pathToProjectInfDir = path.join(testWorkspace, '.projects');
const testTempDirName = 'CODEWIND_TEMP_WORKSPACE';
const pathToTestTempDir = path.join(testWorkspace, testTempDirName);

describe('User.js', () => {
    let existingGlobalCodewindRunningInK8sValue;
    let existingGlobalCodewindWorkspace;
    let existingGlobalCodewindTempWorkspace;
    before(() => {
        existingGlobalCodewindRunningInK8sValue = global.codewind.RUNNING_IN_K8S;
        existingGlobalCodewindWorkspace = global.codewind.CODEWIND_WORKSPACE;
        existingGlobalCodewindTempWorkspace = global.codewind.CODEWIND_TEMP_WORKSPACE;
    });
    after(() => {
        global.codewind.RUNNING_IN_K8S = existingGlobalCodewindRunningInK8sValue;
        global.codewind.CODEWIND_WORKSPACE = existingGlobalCodewindWorkspace;
        global.codewind.CODEWIND_TEMP_WORKSPACE = existingGlobalCodewindTempWorkspace;
    });
    beforeEach(() => {
        global.codewind.RUNNING_IN_K8S = false;
        global.codewind.CODEWIND_WORKSPACE = testWorkspace;
        global.codewind.CODEWIND_TEMP_WORKSPACE = testTempDirName;
    });
    describe('new User(user_id, userString, workspace, uiSocket)', () => {
        it('returns a new User (uninitialised) when PFE is local', () => {
            global.codewind.RUNNING_IN_K8S = false;
            
            const user_id = null;
            const userString = null;
            const uiSocketStub = {
                emit: () => {},
                of: () => ('Namespace'),
            };
            const user = new User(user_id, userString, testWorkspace, uiSocketStub);
            
            user.should.be.an('object');
            user.should.have.keys([
                'user_id',
                'userString',
                'workspace',
                'uiSocket',
                'uiSocketNamespace',
                'secure',
                'dockerConfigFile',
                'codewindPFESecretName',
            ]);
            user.user_id.should.equal('default');
            user.workspace.should.equal(testWorkspace);
            user.uiSocket.should.equal('Namespace');
            user.secure.should.be.true;
            user.dockerConfigFile.should.equal('/root/.docker/config.json');
            user.codewindPFESecretName.should.equal(`codewind-${process.env.CHE_WORKSPACE_ID}-docker-registries`);
        });
        it('returns a new User (uninitialised) when PFE is in K8S', () => {
            global.codewind.RUNNING_IN_K8S = true;
            
            const user_id = null;
            const userString = null;
            const uiSocketStub = {
                emit: () => {},
                of: () => ('Namespace'),
            };
            const user = new User(user_id, userString, testWorkspace, uiSocketStub);
            
            user.should.be.an('object');
            user.should.have.keys([
                'user_id',
                'userString',
                'workspace',
                'uiSocket',
                'uiSocketNamespace',
                'secure',
                'dockerConfigFile',
                'codewindPFESecretName',
                'k8Client',
            ]);
            user.user_id.should.equal('default');
            user.workspace.should.equal(testWorkspace);
            user.uiSocket.should.equal('Namespace');
            user.secure.should.be.true;
            user.dockerConfigFile.should.equal('/root/.docker/config.json');
            user.codewindPFESecretName.should.equal(`codewind-${process.env.CHE_WORKSPACE_ID}-docker-registries`);
        });
    });
    describe('static createUser()', () => {
        before(() => {
            fs.emptyDirSync(testWorkspace);
        });
        after(() => {
            fs.removeSync(testWorkspace);
        });
        it('returns a new User (initialised) when PFE is local', async function() {
            const user_id = null;
            const userString = null;
            const uiSocketStub = {
                emit: () => {},
                of: () => ('Namespace'),
            };
            const user = await User.createUser(user_id, userString, testWorkspace, uiSocketStub);

            user.should.be.an('object');
            user.should.have.keys([
                'user_id',
                'userString',
                'workspace',
                'uiSocket',
                'uiSocketNamespace',
                'secure',
                'dockerConfigFile',
                'codewindPFESecretName',
                'directories',
                'projectList',
                'extensionList',
                'templates',
                'fw',
                'loadRunner',
            ]);
            user.user_id.should.equal('default');
            user.workspace.should.equal(testWorkspace);
            user.uiSocket.should.equal('Namespace');
            user.secure.should.be.true;
            user.dockerConfigFile.should.equal('/root/.docker/config.json');
            user.codewindPFESecretName.should.equal(`codewind-${process.env.CHE_WORKSPACE_ID}-docker-registries`);
            user.directories.should.have.keys([
                'config',
                'extensions',
                'logs',
                'projects',
                'temp',
                'workspace',
            ]);

            user.projectList.should.deep.equal(new ProjectList());
            user.extensionList.should.deep.equal(new ExtensionList());
            user.templates.should.deep.equal(new MockTemplates());
            user.fw.should.deep.equal(new MockFileWatcher());
            user.loadRunner.should.deep.equal(new MockLoadRunner());

            fs.readdirSync(testWorkspace).should.equalInAnyOrder([
                '.config',
                '.extensions',
                '.logs',
                '.projects',
                testTempDirName,
            ]);           
        });
    });
    describe('createProject() and deleteProjectFiles() (these `it` blocks depend on each other passing)', () => {
        let user;
        let expectedProjectList;
        let createdProject;
        before(async() => {
            fs.emptyDirSync(testWorkspace);
            fs.emptyDirSync(pathToTestTempDir);
            global.codewind.CODEWIND_TEMP_WORKSPACE = testTempDirName;
            user = await createSimpleUser();
        });
        after(() => {
            fs.removeSync(testWorkspace);
            fs.removeSync(pathToTestTempDir);
        });
        it('creates a project when createProject(projectJson) is called', async() => {
            const projectCreationOptions = { 
                name: 'node8',
                directory: 'node8',
                workspace: testWorkspace,
                language: 'nodejs',
                autoBuild: true,
                locOnDisk: 'locOnDisk',
                state: 'closed',
                creationTime: 1582021854638,
                projectType: 'nodejs', 
            };
            createdProject = await user.createProject(projectCreationOptions);
    
            expectedProjectList = new ProjectList();
            expectedProjectList.addProject(createdProject);
            user.projectList.should.deep.equal(expectedProjectList);
    
            const pathToProjectInf = path.join(pathToProjectInfDir, `${createdProject.projectID}.inf`);
            const projectInf = fs.readJsonSync(pathToProjectInf);
            const {
                /* eslint-disable no-unused-vars */
                capabilitiesReady,
                codewindVersion,
                infLockFlag,
                logStreams,
                tempDirName,
                /* eslint-enable no-unused-vars */
                ...expectedProjectInf
            } = createdProject;
            projectInf.should.deep.equal(expectedProjectInf);
            
        });
        it('deletes the project when deleteProjectFiles(project) is called', async() => {
            await user.deleteProjectFiles(createdProject);

            expectedProjectList.removeProject(createdProject.projectID);
            user.projectList.should.deep.equal(expectedProjectList);

            fs.readdirSync(testWorkspace).should.equalInAnyOrder([
                '.config',
                '.extensions',
                '.logs',
                '.projects',
                testTempDirName,
                // no project directory because it has been deleted
            ]);
            fs.readdirSync(pathToProjectInfDir).should.be.empty;
            fs.readdirSync(pathToTestTempDir).should.be.empty;
        });
    });
    describe('runLoad(project, description)', () => {
        beforeEach(() => {
            fs.emptyDirSync(testWorkspace);
        });
        afterEach(() => {
            fs.removeSync(testWorkspace);
        });
        it('errors if a load run is already in progress on the project', async() => {
            const { user, project } = await createSimpleUserWithProject();
            project.loadInProgress = true;

            await user.runLoad(project)
                .should.eventually.be.rejectedWith(`Load run already in progress.\nFor project ${sampleProjectID}`);
        });
        it('gets to LoadRunner.runLoad() then errors because we have stubbed out LoadRunner.js', async() => {
            const { user, project } = await createSimpleUserWithProject();

            await user.runLoad(project)
                .should.eventually.be.rejectedWith('Load Runner service is not available');
            project.loadInProgress.should.be.false;
            should.equal(project.loadConfig, null);
        });
    });
    describe('cancelLoad(project)', () => {
        beforeEach(() => {
            fs.emptyDirSync(testWorkspace);
        });
        afterEach(() => {
            fs.removeSync(testWorkspace);
        });
        it('errors if a load run is not already in progress on the project', async() => {
            const { user, project } = await createSimpleUserWithProject();
            
            await user.cancelLoad(project)
                .should.eventually.be.rejectedWith(`Unable to cancel, no load run in progress.\nFor project ${sampleProjectID}`);
        });
        it('gets to LoadRunner.cancelRunLoad() then errors because we are not connected to the LoadRunner container', async() => {
            const { user, project } = await createSimpleUserWithProject();
            project.loadInProgress = true;

            await user.cancelLoad(project)
                .should.eventually.be.rejectedWith('Load Runner service is not available');
        });
    });
    describe('buildProject(project, action)', () => {
        beforeEach(() => {
            fs.emptyDirSync(testWorkspace);
        });
        afterEach(() => {
            fs.removeSync(testWorkspace);
        });
        it('builds the project then doesn\'t update the project.inf when the build was not successful', async() => {
            const { user, project } = await createSimpleUserWithProject();
            user.fw.buildProject = () => ({ status: 'not success' });
            const originalAutoBuildValue = project.autoBuild;
            
            await user.buildProject(project, 'disableautobuild');

            const pathToProjectInf = path.join(pathToProjectInfDir, `${project.projectID}.inf`);
            const projectInf = fs.readJsonSync(pathToProjectInf);
            projectInf.autoBuild.should.equal(originalAutoBuildValue);
        });
        it('builds the project then doesn\'t update the project.inf when `action` is `build`', async() => {
            const { user, project } = await createSimpleUserWithProject();
            user.fw.buildProject = () => ({ status: 'success' });
            const originalAutoBuildValue = project.autoBuild;
            
            await user.buildProject(project, 'build');

            const pathToProjectInf = path.join(pathToProjectInfDir, `${project.projectID}.inf`);
            const projectInf = fs.readJsonSync(pathToProjectInf);
            projectInf.autoBuild.should.equal(originalAutoBuildValue);
        });
        it('builds the project then correctly updates the project.inf when `action` is `enableautobuild`', async() => {
            const { user, project } = await createSimpleUserWithProject();
            user.fw.buildProject = () => ({ status: 'success' });
            project.autoBuild = false;
            
            await user.buildProject(project, 'enableautobuild');

            const pathToProjectInf = path.join(pathToProjectInfDir, `${project.projectID}.inf`);
            const projectInf = fs.readJsonSync(pathToProjectInf);
            projectInf.autoBuild.should.be.true;
        });
        it('builds the project then correctly updates the project.inf when `action` is `disableautobuild`', async() => {
            const { user, project } = await createSimpleUserWithProject();
            user.fw.buildProject = () => ({ status: 'success' });
            
            await user.buildProject(project, 'disableautobuild');

            const pathToProjectInf = path.join(pathToProjectInfDir, `${project.projectID}.inf`);
            const projectInf = fs.readJsonSync(pathToProjectInf);
            projectInf.autoBuild.should.be.false;
        });
        it('does nothing after catching an error', async() => {
            const { user, project } = await createSimpleUserWithProject();
            user.fw.buildProject = () => { throw new Error('build error'); };
            const originalAutoBuildValue = project.autoBuild;
            
            await user.buildProject(project, 'disableautobuild');

            const pathToProjectInf = path.join(pathToProjectInfDir, `${project.projectID}.inf`);
            const projectInf = fs.readJsonSync(pathToProjectInf);
            projectInf.autoBuild.should.equal(originalAutoBuildValue);
        });
    });
    describe('restartProject(project, startMode)', () => {
        beforeEach(() => {
            fs.emptyDirSync(testWorkspace);
        });
        afterEach(() => {
            fs.removeSync(testWorkspace);
        });
        it('restarts the project then updates the project.inf when the restart was successful', async() => {
            const { user, project } = await createSimpleUserWithProject();
            user.fw.restartProject = () => {};
            
            await user.restartProject(project, 'some start mode');

            const pathToProjectInf = path.join(pathToProjectInfDir, `${project.projectID}.inf`);
            const projectInf = fs.readJsonSync(pathToProjectInf);
            projectInf.startMode.should.equal('some start mode');
        });
        it('restarts the project then does not update the project.inf when the restart was not successful', async() => {
            const { user, project } = await createSimpleUserWithProject();
            user.fw.restartProject = () => { throw new Error('restart failed'); };

            await user.restartProject(project, 'some start mode')
                .should.eventually.be.rejectedWith('restart failed');

            const pathToProjectInf = path.join(pathToProjectInfDir, `${project.projectID}.inf`);
            const projectInf = fs.readJsonSync(pathToProjectInf);
            projectInf.should.not.have.property('startMode');
        });
    });
    describe('initialiseExistingProjects()', () => {
        beforeEach(() => {
            fs.emptyDirSync(pathToProjectInfDir);
        });
        afterEach(() => {
            fs.removeSync(testWorkspace);
        });
        it('does nothing when the project.inf contains no projects', async() => {
            const user = await newSimpleUser();
            user.directories = { projects: pathToProjectInfDir };
            user.projectList = new ProjectList();

            await user.initialiseExistingProjects();

            user.projectList.should.deep.equal(new ProjectList());
        });
        it('fills the projectList with projects from the project.inf when the .inf contains projects', async() => {
            // arrange
            const user = await newSimpleUser();
            user.directories = { projects: pathToProjectInfDir };
            user.projectList = new ProjectList();
            fs.writeJSONSync(
                path.join(pathToProjectInfDir, `${sampleProjectID}.inf`),
                sampleProjectInf,
            );

            const expectedProjectList = new ProjectList();
            expectedProjectList.addProject(new Project({
                ...sampleProjectInf,
                ...sampleCwSettings,
            }));

            // act
            await user.initialiseExistingProjects();

            // assert
            user.projectList.should.deep.equal(expectedProjectList);
        });
    });
    
    describe('getWatchList()', () => {
        beforeEach(() => {
            fs.emptyDirSync(pathToProjectInfDir);
        });
        afterEach(() => {
            fs.removeSync(testWorkspace);
        });
        it('returns `{ projects: [] }` when the projectList contains no projects', async() => {
            const user = await newSimpleUser();
            user.projectList = new ProjectList();

            const output = await user.getWatchList();

            output.should.deep.equal({ projects: [] });
        });
        it('returns the watchlist when the projectList contains a project', async() => {
            // arrange
            const user = await newSimpleUser();
            user.projectList = new ProjectList();
            const sampleProjectWatchStateId = '89ada577f70a6cbb862b6115087a6b13';
            const projectCreationArgs = {
                ...sampleProjectInf,
                ...sampleCwSettings,
            };
            const sampleProject = new Project(projectCreationArgs);
            sampleProject.projectWatchStateId = sampleProjectWatchStateId;
            user.projectList.addProject(sampleProject);

            // act
            const output = await user.getWatchList();

            // assert
            output.should.deep.equal({
                projects: [{
                    ignoredPaths: undefined, // eslint-disable-line no-undefined
                    pathToMonitor: projectCreationArgs.pathToMonitor,
                    projectCreationTime: projectCreationArgs.creationTime,
                    projectID: projectCreationArgs.projectID,
                    projectWatchStateId: sampleProjectWatchStateId,
                    refPaths: [],
                }],
            });
        });
        it('returns the watchlist when the projectList contains an open project without a projectWatchStateId', async() => {
            // arrange
            const user = await newSimpleUser();
            user.projectList = new ProjectList();
            const projectCreationArgs = {
                ...sampleProjectInf,
                ...sampleCwSettings,
            };
            const sampleProject = new Project(projectCreationArgs);
            user.projectList.addProject(sampleProject);

            // act
            const output = await user.getWatchList();

            // assert
            output.should.have.keys(['projects']);
            output.projects.should.have.length(1);
            output.projects[0].should.have.keys([
                'ignoredPaths',
                'pathToMonitor',
                'projectCreationTime',
                'projectID',
                'refPaths',
                'projectWatchStateId',
            ]);
            output.projects[0].should.deep.include({
                ignoredPaths: undefined, // eslint-disable-line no-undefined
                pathToMonitor: projectCreationArgs.pathToMonitor,
                projectCreationTime: projectCreationArgs.creationTime,
                projectID: projectCreationArgs.projectID,
                refPaths: [],
                // projectWatchStateId is set to a random number, so we can't test it exactly
            });
        });
    });

    describe('getImagePushRegistryStatus()', () => {
        const pathToConfigDir = path.join(testWorkspace, '.config');
        beforeEach(() => {
            fs.emptyDirSync(pathToConfigDir);
        });
        afterEach(() => {
            fs.removeSync(testWorkspace);
        });
        it('throw an error when there is no settings.json file', async() => {
            const user = await newSimpleUser();
            user.directories = { config: pathToConfigDir };

            const output = await user.getImagePushRegistryStatus();

            output.should.deep.equal({ imagePushRegistry: false });
        });
        it('returns no workspace settings when the settings.json contains invalid registry address', async() => {
            // arrange
            const user = await newSimpleUser();
            user.directories = { config: pathToConfigDir };
            const sampleSettingsJson = {
                registryAddress: 123, // 'invalid - needs a length property',
                registryNamespace: 'valid registry namespace',
            };
            fs.writeJSONSync(
                path.join(pathToConfigDir, 'settings.json'),
                sampleSettingsJson,
            );

            // act
            const output = await user.getImagePushRegistryStatus();

            // assert
            output.should.deep.equal({ imagePushRegistry: false });
        });
        it('returns no workspace settings when the settings.json contains no registry namespace', async() => {
            // arrange
            const user = await newSimpleUser();
            user.directories = { config: pathToConfigDir };
            const sampleSettingsJson = {
                registryAddress: [ 'valid - array' ],
                // no registryNamespace
            };
            fs.writeJSONSync(
                path.join(pathToConfigDir, 'settings.json'),
                sampleSettingsJson,
            );

            // act
            const output = await user.getImagePushRegistryStatus();

            // assert
            output.should.deep.equal({ imagePushRegistry: false });
        });
        it('returns workspace settings when the settings.json contains valid registry address and namespace', async() => {
            // arrange
            const user = await newSimpleUser();
            user.directories = { config: pathToConfigDir };
            const sampleSettingsJson = {
                registryAddress: [ 'valid - array' ],
                registryNamespace: 'valid registry namespace',
            };
            fs.writeJSONSync(
                path.join(pathToConfigDir, 'settings.json'),
                sampleSettingsJson,
            );

            // act
            const output = await user.getImagePushRegistryStatus();

            // assert
            output.should.deep.equal({
                imagePushRegistry: true,
                address: sampleSettingsJson.registryAddress,
                namespace: sampleSettingsJson.registryNamespace,
            });
        });
    });
});

const uiSocketStub = {
    emit: () => {},
    of: () => ({ emit: () => {} }),
};

const newSimpleUser = () => {
    const user_id = null;
    const userString = null;
    return (new User(user_id, userString, testWorkspace, uiSocketStub));
};

const createSimpleUser = () => {
    const user_id = null;
    const userString = null;
    return User.createUser(user_id, userString, testWorkspace, uiSocketStub);
};

const createSimpleUserWithProject = async() => {
    const user = await createSimpleUser();
    
    const projectCreationOptions = {
        name: 'test project',
        projectID: sampleProjectID,
        workspace: testWorkspace,
        language: 'nodejs',
        locOnDisk: 'locOnDisk',
    };
    const createdProject = await user.createProject(projectCreationOptions);

    return {
        user,
        project: createdProject,
    };
};

const sampleProjectID = 'be4ea4e0-5239-11ea-abf6-f10edc5370f9';
const sampleProjectInf = {
    projectID: sampleProjectID,
    name: 'node8',
    codewindVersion: 'latest',
    language: 'nodejs',
    creationTime: 1582023981607,
    locOnDisk: '/Users/richard.waller@ibm.com/codewind-workspace/node8',
    pathToMonitor: '/Users/richard.waller@ibm.com/codewind-workspace/node8',
    host: '172.18.0.4',
    ports: {
        exposedPort: '32913',
        internalPort: '3000',
        internalDebugPort: '9229',
    },
    workspace: '/codewind-workspace/',
    directory: 'node8',
    loadTestPath: '/codewind-workspace/node8/load-test',
    projectType: 'nodejs',
    isOpenLiberty: false,
    canMetricsBeInjected: true,
    buildLogPath: '/codewind-workspace/.logs/node8-be4ea4e0-5239-11ea-abf6-f10edc5370f9/docker.build.log',
    state: 'open',
    autoBuild: true,
    injectMetrics: false,
    injection: {
        injectable: true,
        injected: false,
    },
    metricsDashboard: {
        hosting: 'project',
        path: '/appmetrics-dash/?theme=dark',
    },
    perfDashboardPath: '/performance/charts?project=be4ea4e0-5239-11ea-abf6-f10edc5370f9',
    buildStatus: 'success',
    detailedBuildStatus: ' ',
    projectWatchStateId: '96a789ff7e40af644729fe2111c488d7',
    ignoredPaths: [
        '*/.idea/*',
        '*.iml',
        '/.project',
        '/load-test*',
        '*/*.swp',
        '*/*.swx',
        '*/.gitignore',
        '*/node_modules*',
        '*/4913',
        '*/.git/*',
        '*/.DS_Store',
        '*/.dockerignore',
        '*/*~',
        '/.settings',
        '/.classpath',
        '/.options',
        '/.vscode/*',
        '/run-dev',
        '/run-debug',
        '/package-lock.json*',
        '/nodejs_restclient.log',
        '/nodejs_dc.log',
        '/manifest.yml',
        '/idt.js',
        '/cli-config.yml',
        '/README.md',
        '/Jenkinsfile',
        '/.cfignore',
    ],
    appStatus: 'started',
    metricsAvailable: true,
    lastbuild: 1582024011081,
    appImageLastBuild: '1582023983000',
    location: '/codewind-workspace/node8',
    validationStatus: 'success',
    validationResults: [],
    isHttps: false,
    statusPingTimeout: '30',
    containerId: 'c016e2cd0b1a2c7861f561877ad21741666aa03b28a96783ce872dffae582aef',
    logs: {
        build: [
            {
                origin: 'workspace',
                files: [
                    '/codewind-workspace/.logs/node8-be4ea4e0-5239-11ea-abf6-f10edc5370f9/docker.build.log',
                ],
            },
        ],
        app: [
            {
                origin: 'workspace',
                files: [
                    '/codewind-workspace/.logs/node8-be4ea4e0-5239-11ea-abf6-f10edc5370f9/app.log',
                ],
            },
        ],
    },
};
              
const sampleCwSettings = {
    contextRoot: '',
    internalPort: '',
    healthCheck: '',
    internalDebugPort: '',
    isHttps: false,
    ignoredPaths: [
        '*/.idea/*',
        '*.iml',
        '/.project',
        '/load-test*',
        '*/*.swp',
        '*/*.swx',
        '*/.gitignore',
        '*/node_modules*',
        '*/4913',
        '*/.git/*',
        '*/.DS_Store',
        '*/.dockerignore',
        '*/*~',
        '/.settings',
        '/.classpath',
        '/.options',
        '/.vscode/*',
        '/run-dev',
        '/run-debug',
        '/package-lock.json*',
        '/nodejs_restclient.log',
        '/nodejs_dc.log',
        '/manifest.yml',
        '/idt.js',
        '/cli-config.yml',
        '/README.md',
        '/Jenkinsfile',
        '/.cfignore',
    ],
    statusPingTimeout: '',
};
