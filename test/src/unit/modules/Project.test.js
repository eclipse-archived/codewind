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
global.codewind = { RUNNING_IN_K8S: false };
const fs = require('fs-extra');
const { execSync } = require('child_process');
const path = require('path');
const rewire = require('rewire');
const sinon = require('sinon');
const chai = require('chai');
const chaiSubset = require('chai-subset');
const chaiAsPromised = require('chai-as-promised');

const { testTimeout } = require('../../../config');
const Project = rewire('../../../../src/pfe/portal/modules/Project');
const ProjectError = require('../../../../src/pfe/portal/modules/utils/errors/ProjectError');
const ProjectMetricsError = require('../../../../src/pfe/portal/modules/utils/errors/ProjectMetricsError');

const { suppressLogOutput } = require('../../../modules/log.service');

chai.use(chaiSubset);
chai.use(chaiAsPromised);
chai.should();
const { expect } = chai;

const loadTestResources = path.join(__dirname, '../../../resources/load-test-data/');

describe('Project.js', function() {
    suppressLogOutput(Project);
    beforeEach(() => {
        global.codewind = {
            RUNNING_IN_K8S: false,
            CODEWIND_WORKSPACE: `${__dirname}/project_temp/`,
            CODEWIND_TEMP_WORKSPACE: `${__dirname}/project_temp/temp/`,
        };
        fs.ensureDirSync(global.codewind.CODEWIND_TEMP_WORKSPACE);
    });
    after(function() {
        this.timeout(5000);
        execSync(`rm -rf ${global.codewind.CODEWIND_WORKSPACE}`);
    });
    describe('new Project()', () => {
        it('Initialises a new Project with minimal arguments', () => {
            const project = new Project({
                name: 'newdummyproject',
                locOnDisk: '/Documents/projectDir/',
                workspace: './someworkspace',
            });
            project.should.be.an('object');
            project.should.have.property('projectID').to.be.a('string');
            project.should.have.property('name');
            project.name.should.equal('newdummyproject');
            project.should.have.property('workspace');
            project.workspace.should.equal('./someworkspace');
            project.perfDashboardPath.should.equal(`/performance/charts?project=${project.projectID}`);
        });
        it('Sets directory to name', () => {
            const project = createProjectAndCheckIsAnObject({
                name: 'newdummyproject', locOnDisk: '/Documents/projectDir/',
            }, './someworkspace');
            const name = project.name;
            project.should.have.property('directory');
            project.directory.should.equal(name);
        });
        it('Correctly initialises using a comprehensive list of arguments', () => {
            const args = {
                projectID: '9318ab10-fef9-11e9-8761-9bf62d92b58b',
                name: 'my-java-project',
                codewindVersion: 'someversion',
                language: 'java',
                locOnDisk: 'location',
                workspace: global.codewind.CODEWIND_WORKSPACE,
                directory: 'directorythatisntname-id',
                infLockFlag: false,
                startMode: 'run',
                projectType: 'liberty',
                buildLogPath: '/codewind-workspace/.logs/my-java-project-9318ab10-fef9-11e9-8761-9bf62d92b58b-9318ab10-fef9-11e9-8761-9bf62d92b58b/docker.build.log',
                state: 'open',
                autoBuild: false,
                metricsCapabilities: {
                    liveMetricsAvailable: true,
                    microprofilePackageAuthenticationDisabled: true,
                },
            };
            const project = createProjectAndCheckIsAnObject(args, global.codewind.CODEWIND_WORKSPACE);
            project.should.containSubset(args);
            const { projectID, name } = project;
            project.directory.should.not.equal(`${name}-${projectID}`);
        });
    });
    describe('toJSON()', () => {
        it('Checks that toJSON removes fields which shouldn\'t be written to .info file on disk', () => {
            const obj = {
                logStreams: 'logstream',
                loadInProgress: true,
                loadConfig: 'someconfig',
            };
            const project = createDefaultProjectAndCheckIsAnObject();
            project.should.containSubset({ name: 'dummy' });
            project.should.not.containSubset(obj);

            project.logStreams = obj.logStreams;
            project.loadInProgress = obj.loadInProgress;
            project.loadConfig = obj.loadConfig;

            project.should.containSubset(obj);

            const json = project.toJSON();
            json.should.not.containSubset(obj);
        });
    });
    describe('setMetricsState()', function() {
        this.timeout(testTimeout.short);
        it('returns all capabilities as false, correctly sets the metricsCapabilities, metricsAvailable and metricsDashboard values in project', async() => {
            // arrange
            const expectedCapabilities = {
                liveMetricsAvailable: false,
                metricsEndpoint: false,
                appmetricsEndpoint: false,
                microprofilePackageFoundInBuildFile: false,
                appmetricsPackageFoundInBuildFile: false,
                hasTimedMetrics: false,
                microprofilePackageAuthenticationDisabled: false,
            };
            const project = createDefaultProjectAndCheckIsAnObject();

            // act
            const { capabilities } = await project.setMetricsState();

            // assert
            capabilities.should.deep.equal(expectedCapabilities);
            project.getMetricsCapabilities().should.deep.equal(expectedCapabilities);
            project.metricsAvailable.should.be.false;
            project.metricsDashboard.should.deep.equal({
                hosting: null,
                path: null,
            });

            // Verify the project inf has been updated
            const infPath = path.join(global.codewind.CODEWIND_WORKSPACE, '/.projects', `${project.projectID}.inf`);
            const updatedProjectInf = await fs.readJSON(infPath);
            updatedProjectInf.should.containSubset({
                metricsCapabilities: expectedCapabilities,
            });
        });
        it('returns metrics capabilities and sets metricsAvailable and metricsDash when a metrics dashboard is available', async() => {
            // arrange
            const mockedMetricStatusReturn = {
                capabilities: {
                    liveMetricsAvailable: true,
                    metricsEndpoint: '/metrics',
                    appmetricsEndpoint: '/appmetrics-dash',
                    microprofilePackageFoundInBuildFile: true,
                    appmetricsPackageFoundInBuildFile: true,
                    hasTimedMetrics: false,
                    microprofilePackageAuthenticationDisabled: false,
                },
                metricsDashHost: {
                    hosting: 'project',
                    path: '/appmetrics-dash',
                },
            };
            Project.__set__('metricsStatusChecker', {
                getMetricStatusForProject: sinon.stub().returns(mockedMetricStatusReturn),
            });
            const project = createDefaultProjectAndCheckIsAnObject();

            // act
            const { capabilities } = await project.setMetricsState();

            // assert
            capabilities.should.deep.equal(mockedMetricStatusReturn.capabilities);
            project.getMetricsCapabilities().should.deep.equal(mockedMetricStatusReturn.capabilities);
            project.metricsAvailable.should.be.true;
            project.metricsDashboard.should.deep.equal(mockedMetricStatusReturn.metricsDashHost);

            // Verify the project inf has been updated
            const infPath = path.join(global.codewind.CODEWIND_WORKSPACE, '/.projects', `${project.projectID}.inf`);
            const updatedProjectInf = await fs.readJSON(infPath);
            updatedProjectInf.should.containSubset({
                metricsCapabilities: mockedMetricStatusReturn.capabilities,
            });
        });
        it('does not change or remove the microprofilePackageAuthenticationDisabled field', async() => {
            // arrange
            const mockedMetricStatusReturn = {
                capabilities: {
                    liveMetricsAvailable: true,
                    metricsEndpoint: '/metrics',
                    appmetricsEndpoint: '/appmetrics-dash',
                    microprofilePackageFoundInBuildFile: true,
                    appmetricsPackageFoundInBuildFile: true,
                    hasTimedMetrics: false,
                },
                metricsDashHost: {
                    hosting: 'project',
                    path: '/appmetrics-dash',
                },
            };
            Project.__set__('metricsStatusChecker', {
                getMetricStatusForProject: sinon.stub().returns(mockedMetricStatusReturn),
            });
            const project = createDefaultProjectAndCheckIsAnObject();
            project.metricsCapabilities.microprofilePackageAuthenticationDisabled = 'isNotOverwritten';

            // act
            await project.setMetricsState();

            // assert
            const capabilities = project.getMetricsCapabilities();
            capabilities.should.deep.equal({
                ...mockedMetricStatusReturn.capabilities,
                microprofilePackageAuthenticationDisabled: 'isNotOverwritten',
            });
        });
        it('throws an error when metricsStatusChecker.getMetricStatusForProject is rejected', () => {
            Project.__set__('metricsStatusChecker', {
                getMetricStatusForProject: sinon.stub().rejects,
            });
            const project = createDefaultProjectAndCheckIsAnObject();

            return project.setMetricsState().should.be.eventually.rejected;
        });
    });
    describe('getMetricsCapabilities()', () => {
        it('returns the default metricsCapabilities object from a project', () => {
            const project = createDefaultProjectAndCheckIsAnObject();
            const metricsCapabilities = project.getMetricsCapabilities();
            metricsCapabilities.should.deep.equal({
                liveMetricsAvailable: false,
                metricsEndpoint: false,
                appmetricsEndpoint: false,
                microprofilePackageFoundInBuildFile: false,
                appmetricsPackageFoundInBuildFile: false,
                hasTimedMetrics: false,
                microprofilePackageAuthenticationDisabled: false,
            });
        });
    });
    describe('setOpenLiberty()', () => {
        const testResourcesDir = path.join(__dirname, '../../../', 'resources', 'metricsService');
        const pathToOpenLibertyPomXml = path.join(testResourcesDir, 'openLiberty', 'pom.xml', 'withoutCollector.xml');
        const pathToLibertyPomXml = path.join(testResourcesDir, 'liberty', 'pom.xml', 'withoutCollector.xml');
        const testTempDir = path.join(__dirname, 'setOpenLibertyTemp');
        before(() => {
            // Copy a Open Liberty pom.xml into a temp dir
            const validPomPath = path.join(testTempDir, 'openLibertyPom', 'pom.xml');
            fs.ensureFileSync(validPomPath);
            fs.copyFileSync(pathToOpenLibertyPomXml, validPomPath);
            // Copy a non Open Liberty pom.xml into a temp dir
            const invalidPomPath = path.join(testTempDir, 'invalidPom', 'pom.xml');
            fs.ensureFileSync(invalidPomPath);
            fs.copyFileSync(pathToLibertyPomXml, invalidPomPath);
            // Create an Open Liberty Dockerfile
            const dockerfileContents = 'FROM open-liberty:latest\nCOPY /something /somewhere\nCMD ["npm", "start"]';
            fs.outputFileSync(path.join(testTempDir, 'openLibertyDockerfile', 'Dockerfile'), dockerfileContents);
        });
        after(() => {
            fs.removeSync(testTempDir);
        });
        it('Check that isOpenLiberty is initialised as false', () => {
            const project = createDefaultProjectAndCheckIsAnObject();
            project.isOpenLiberty.should.be.false;
            project.canMetricsBeInjected.should.be.false;
        });
        it('Check that isOpenLiberty is set to true when the language is Java, projectType is Docker and a valid Open Liberty Pom.xml exists in the project directory', async() => {
            const args = {
                projectID: '9318ab10-fef9-11e9-8761-9bf62d92b58b',
                name: 'my-open-lib-project',
                language: 'java',
                locOnDisk: '/Documents/projectDir/',
                workspace: testTempDir,
                directory: 'openLibertyPom',
                projectType: 'docker',
            };
            const project = createProjectAndCheckIsAnObject(args, testTempDir);
            await project.setOpenLiberty();
            project.isOpenLiberty.should.be.true;
            project.canMetricsBeInjected.should.be.true;
        });
        it('Check that isOpenLiberty is set to true when the language is Java, projectType is Docker and a valid Open Liberty Dockerfile exists in the project directory', async() => {
            const args = {
                projectID: '9318ab10-fef9-11e9-8761-9bf62d92b58b',
                name: 'my-open-lib-project',
                language: 'java',
                locOnDisk: '/Documents/projectDir/',
                workspace: testTempDir,
                directory: 'openLibertyDockerfile',
                projectType: 'docker',
            };
            const project = createProjectAndCheckIsAnObject(args, testTempDir);
            await project.setOpenLiberty();
            project.isOpenLiberty.should.be.true;
            project.canMetricsBeInjected.should.be.true;
        });
        it('Check that isOpenLiberty stays false when the language is not Java (Node.js)', async() => {
            const args = {
                projectID: '9318ab10-fef9-11e9-8761-9bf62d92b58b',
                name: 'my-open-lib-project',
                language: 'nodejs',
                locOnDisk: '/Documents/projectDir/',
                workspace: testTempDir,
                directory: 'openLibertyDockerfile',
                projectType: 'docker',
            };
            const project = createProjectAndCheckIsAnObject(args, testTempDir);
            const { canMetricsBeInjected: canMetricsBeInjectedPreOpenLiberty } = project;
            await project.setOpenLiberty();
            project.isOpenLiberty.should.be.false;
            project.canMetricsBeInjected.should.equal(canMetricsBeInjectedPreOpenLiberty);
        });
        it('Check that isOpenLiberty stays false when the projectType is not Docker', async() => {
            const args = {
                projectID: '9318ab10-fef9-11e9-8761-9bf62d92b58b',
                name: 'my-open-lib-project',
                language: 'java',
                locOnDisk: '/Documents/projectDir/',
                workspace: testTempDir,
                directory: 'openLibertyDockerfile',
                projectType: 'java',
            };
            const project = createProjectAndCheckIsAnObject(args, testTempDir);
            const { canMetricsBeInjected: canMetricsBeInjectedPreOpenLiberty } = project;
            await project.setOpenLiberty();
            project.isOpenLiberty.should.be.false;
            project.canMetricsBeInjected.should.equal(canMetricsBeInjectedPreOpenLiberty);
        });
        it('Check that isOpenLiberty is set to false when the language is Java, projectType is Docker but the Pom.xml is not an Open Liberty one and no Dockerfile exists', async() => {
            const args = {
                projectID: '9318ab10-fef9-11e9-8761-9bf62d92b58b',
                name: 'my-open-lib-project',
                language: 'java',
                locOnDisk: '/Documents/projectDir/',
                workspace: testTempDir,
                directory: 'invalidPom',
                projectType: 'docker',
            };
            const project = createProjectAndCheckIsAnObject(args, testTempDir);
            const { canMetricsBeInjected: canMetricsBeInjectedPreOpenLiberty } = project;
            await project.setOpenLiberty();
            project.isOpenLiberty.should.be.false;
            project.canMetricsBeInjected.should.equal(canMetricsBeInjectedPreOpenLiberty);
        });
    });
    describe('getPort()', () => {
        it('Checks that the port returned is internal as RUNNING_IN_K8S is false', () => {
            const project = createDefaultProjectAndCheckIsAnObject();
            project.ports = {
                internalPort: 5000,
                exposedPort: 10000,
            };
            const port = project.getPort();
            port.should.equal(5000);
        });
        it('Checks that the port returned is exposed as RUNNING_IN_K8S is true', () => {
            const project = createDefaultProjectAndCheckIsAnObject();
            global.codewind = { RUNNING_IN_K8S: true };
            project.ports = {
                internalPort: 5000,
                exposedPort: 10000,
            };
            const port = project.getPort();
            port.should.equal(10000);
        });
    });
    describe('getMetricsContextRoot()', () => {
        it('Gets metrics root for a Node.js project', () => {
            const project = createProjectAndCheckIsAnObject({ name: 'dummy', language: 'nodejs', locOnDisk: '/Documents/projectDir/' }, global.codewind.CODEWIND_WORKSPACE);
            const metricsRoot = project.getMetricsContextRoot();
            metricsRoot.should.equal('appmetrics');
        });
        it('Gets metrics root for a Java project', () => {
            const project = createProjectAndCheckIsAnObject({ name: 'dummy', language: 'java', locOnDisk: '/Documents/projectDir/' }, global.codewind.CODEWIND_WORKSPACE);
            const metricsRoot = project.getMetricsContextRoot();
            metricsRoot.should.equal('javametrics');
        });
        it('Gets metrics root for a Swift project', () => {
            const project = createProjectAndCheckIsAnObject({ name: 'dummy', language: 'swift', locOnDisk: '/Documents/projectDir/' }, global.codewind.CODEWIND_WORKSPACE);
            const metricsRoot = project.getMetricsContextRoot();
            metricsRoot.should.equal('swiftmetrics');
        });
        it('Gets a blank string metrics root for an invalid project', () => {
            const project = createProjectAndCheckIsAnObject({ name: 'dummy', language: 'invalid', locOnDisk: '/Documents/projectDir/' }, global.codewind.CODEWIND_WORKSPACE);
            const metricsRoot = project.getMetricsContextRoot();
            metricsRoot.should.equal('');
        });
        it('Gets a blank string root for a Project with no language', () => {
            const project = createDefaultProjectAndCheckIsAnObject();
            const metricsRoot = project.getMetricsContextRoot();
            metricsRoot.should.equal('');
        });
    });
    describe('projectPath()', () => {
        it('Checks that projectPath() is workspace+directory', () => {
            const project = createProjectAndCheckIsAnObject({ name: 'dummy', directory: 'directory', locOnDisk: '/Documents/projectDir/' }, 'workspace');
            const projectPath = project.projectPath();
            projectPath.should.equal(path.join('workspace', 'directory'));
        });
    });
    describe('readSettingsFile()', () => {
        it('Returns a blank object is returned if the settings file does not exist', async() => {
            const project = createDefaultProjectAndCheckIsAnObject();
            const settings = await project.readSettingsFile();
            settings.should.deep.equal({});
        });
        it('Returns the contents of a created .cw-settings file', async() => {
            const project = createDefaultProjectAndCheckIsAnObject();
            const settingsPath = path.join(project.projectPath(), '.cw-settings');
            await fs.ensureFile(settingsPath);
            await fs.writeJson(settingsPath, { property: 'string' });
            const settings = await project.readSettingsFile();
            settings.should.have.property('property').and.equal('string');
        });
    });
    describe('writeInformationFile()', () => {
        it('Checks that the information file is created', async() => {
            const project = createProjectAndCheckIsAnObject({ name: 'dummy', directory: 'directory', locOnDisk: '/Documents/projectDir/' }, global.codewind.CODEWIND_WORKSPACE);
            const infPath = path.join(global.codewind.CODEWIND_WORKSPACE, '/.projects', `${project.projectID}.inf`);
            fs.existsSync(infPath).should.be.false;
            await project.writeInformationFile();
            fs.existsSync(infPath).should.be.true;
        });
        it('Checks that the information file is correct for a generic Project', async() => {
            const project = createDefaultProjectAndCheckIsAnObject();
            const infPath = path.join(global.codewind.CODEWIND_WORKSPACE, '/.projects', `${project.projectID}.inf`);
            await project.writeInformationFile();
            fs.existsSync(infPath).should.be.true;

            const infJson = await fs.readJson(infPath);
            infJson.should.have.property('projectID').and.equal(project.projectID);
        });
        it('Checks that an information file can be used to create a project', async() => {
            const project = createDefaultProjectAndCheckIsAnObject();
            const infPath = path.join(global.codewind.CODEWIND_WORKSPACE, '/.projects', `${project.projectID}.inf`);
            await project.writeInformationFile();
            fs.existsSync(infPath).should.be.true;
            const infJson = await fs.readJson(infPath);
            infJson.should.have.property('projectID').and.equal(project.projectID);

            const projectFromInf = createProjectAndCheckIsAnObject(infJson, global.codewind.CODEWIND_WORKSPACE);
            projectFromInf.should.deep.equal(project);
        });
        it('Checks the Project cannot be written when it is locked', function() {
            // The lock check waits for 1000
            this.slow(1500);
            const project = createDefaultProjectAndCheckIsAnObject();
            project.infLockFlag = true;
            return project.writeInformationFile()
                .should.be.eventually.rejectedWith(`Unable to obtain lock for project inf file for project ${project.name}.`)
                .and.be.an.instanceOf(ProjectError)
                .and.have.property('code', 'LOCK_FAILURE');

        });
    });
    describe('getBuildLogPath()', () => {
        it('Checks that null is returned when a buildLogPath does not exist', () => {
            const project = createDefaultProjectAndCheckIsAnObject();
            project.should.have.property('buildLogPath').and.be.null;
            const logPath = project.getBuildLogPath();
            expect(logPath).to.be.null;
        });
        it('Checks that the buildLogPath is returned', () => {
            const project = createProjectAndCheckIsAnObject({ name: 'dummy', buildLogPath: 'somepath', locOnDisk: '/Documents/projectDir/' }, global.codewind.CODEWIND_WORKSPACE);
            project.should.have.property('buildLogPath').and.equal('somepath');
            const logPath = project.getBuildLogPath();
            logPath.should.equal('somepath');
        });
        it('Checks that the buildLogPath has codewind-workspace substituted with global workspace', () => {
            const project = createProjectAndCheckIsAnObject({ name: 'dummy', buildLogPath: '/codewind-workspace/somelogfile', locOnDisk: '/Documents/projectDir/' }, global.codewind.CODEWIND_WORKSPACE);
            project.should.have.property('buildLogPath').and.equal('/codewind-workspace/somelogfile');
            const logPath = project.getBuildLogPath();
            logPath.should.equal(path.join(global.codewind.CODEWIND_WORKSPACE, 'somelogfile'));
        });
    });
    describe('getMetricTypes()', () => {
        it('Returns the metrics types', () => {
            const metricsTypes = Project.getMetricTypes();
            metricsTypes.should.be.an('array');
            metricsTypes.should.deep.equal(['cpu', 'gc', 'memory', 'http']);
        });
    });
    describe('getMetrics()', () => {
        it('Fails to get the metrics as the loadTestDirectory does not exist', () => {
            const project = createDefaultProjectAndCheckIsAnObject();
            return project.getMetrics('invalidType')
                .should.be.eventually.rejectedWith('Failed to read load-test directories')
                .and.be.an.instanceOf(ProjectError)
                .and.have.property('code', 'LOAD_TEST_DIR_ERROR');
        });
        it('Fails to get the metrics of an invalid type', () => {
            const project = createDefaultProjectAndCheckIsAnObject();
            project.loadTestPath = global.codewind.CODEWIND_WORKSPACE;
            return project.getMetrics('invalidType')
                .should.be.eventually.rejectedWith('invalidType is not a valid metric type. Valid metric types are\n[cpu,gc,memory,http]')
                .and.be.an.instanceOf(ProjectError)
                .and.have.property('code', 'INVALID_METRIC_TYPE');
        });
        it('Gets an empty array of metrics as none exist in the loadTestPath', async() => {
            const project = createDefaultProjectAndCheckIsAnObject();
            project.loadTestPath = global.codewind.CODEWIND_WORKSPACE;
            const cpuMetrics = await project.getMetrics('cpu');
            cpuMetrics.should.be.an('array');
            cpuMetrics.should.be.empty;
        });
        describe('Gets metrics using the load tests in the resources directory', () => {
            const metrics = ['cpu', 'gc', 'memory', 'http'];
            metrics.forEach(function(type) {
                it(type, async() => {
                    const files = await fs.readdir(loadTestResources);
                    const noLoadTests = files.length;
                    const project = createDefaultProjectAndCheckIsAnObject();
                    project.loadTestPath = loadTestResources;
                    const cpuMetrics = await project.getMetrics(type);
                    cpuMetrics.should.have.length(noLoadTests);
                    cpuMetrics.forEach(function(results) {
                        results.should.have.property('value');
                        results.value.should.have.property('data');
                    });
                });
            });
        });
    });
    describe('getMetricsByTime(timeOfTestRun)', () => {
        const metricList = ['id', 'time', 'desc', 'cpu', 'gc', 'memory', 'httpUrls'];
        it('Fails to get a metrics file using an invalid time stamp', () => {
            const project = createDefaultProjectAndCheckIsAnObject();
            project.loadTestPath = loadTestResources;
            return project.getMetricsByTime('123')
                .should.be.eventually.rejectedWith(`Unable to find metrics for project ${project.projectID}`)
                .and.be.an.instanceOf(ProjectMetricsError)
                .and.have.property('code', 'NOT_FOUND');
        });
        it('Gets a metrics file using a valid time stamp (String)', async() => {
            const project = createDefaultProjectAndCheckIsAnObject();
            project.loadTestPath = loadTestResources;
            const metricsFile = '20190326154749';
            const metricsTypes = await project.getMetricsByTime(metricsFile);
            for (let i = 0; i < metricList.length; i++) {
                const metric = metricList[i];
                metricsTypes.should.have.property(metric);
            }
            metricsTypes.id.should.equal(0);
            const actualMetricsFromFile = await fs.readJSON(path.join(loadTestResources, metricsFile, 'metrics.json'));
            metricsTypes.should.deep.equal(actualMetricsFromFile);
        });
        it('Gets a metrics file using a valid time stamp (Int)', async() => {
            const project = createDefaultProjectAndCheckIsAnObject();
            project.loadTestPath = loadTestResources;
            const metricsFile = 20190326154749;
            const metricsTypes = await project.getMetricsByTime(metricsFile);
            for (let i = 0; i < metricList.length; i++) {
                const metric = metricList[i];
                metricsTypes.should.have.property(metric);
            }
            metricsTypes.id.should.equal(0);
            const actualMetricsFromFile = await fs.readJSON(path.join(loadTestResources, String(metricsFile), 'metrics.json'));
            metricsTypes.should.deep.equal(actualMetricsFromFile);
        });
    });
    describe('deleteMetrics(timeOfTestRun)', () => {
        it('Fails to delete a metrics file using an invalid time stamp', () => {
            const project = createDefaultProjectAndCheckIsAnObject();
            project.loadTestPath = loadTestResources;
            return project.deleteMetrics('123')
                .should.be.eventually.rejectedWith(`Unable to find metrics for project ${project.projectID}`)
                .and.be.an.instanceOf(ProjectMetricsError)
                .and.have.property('code', 'NOT_FOUND');
        });
        it('Deletes a metrics file using a valid time stamp (String)', async() => {
            const tempMetricsDir = path.join(global.codewind.CODEWIND_TEMP_WORKSPACE, 'metrics');
            const tempMetricsPath = path.join(tempMetricsDir, '123');
            await fs.copy(path.join(loadTestResources,'20190326154749'), tempMetricsPath);
            const project = createDefaultProjectAndCheckIsAnObject();
            project.loadTestPath = tempMetricsDir;
            fs.existsSync(tempMetricsPath).should.be.true;
            await project.deleteMetrics('123');
            fs.existsSync(tempMetricsPath).should.be.false;
        });
        it('Deletes a metrics file using a valid time stamp (Int)', async() => {
            const tempMetricsDir = path.join(global.codewind.CODEWIND_TEMP_WORKSPACE, 'metrics');
            const tempMetricsPath = path.join(tempMetricsDir, '123');
            await fs.copy(path.join(loadTestResources,'20190326154749'), tempMetricsPath);
            const project = createDefaultProjectAndCheckIsAnObject();
            project.loadTestPath = tempMetricsDir;
            fs.existsSync(tempMetricsPath).should.be.true;
            await project.deleteMetrics(123);
            fs.existsSync(tempMetricsPath).should.be.false;
        });
    });
    describe('getClosestPathToLoadTestDir(timeOfTestRun)', () => {
        it('Fails to get a LoadTestDir using an invalid time stamp (time given is too low)', () => {
            const project = createDefaultProjectAndCheckIsAnObject();
            project.loadTestPath = loadTestResources;
            return project.getClosestPathToLoadTestDir('123')
                .should.be.eventually.rejectedWith(`found no load-test metrics from time 123`)
                .and.be.an.instanceOf(ProjectMetricsError)
                .and.have.property('code', 'NOT_FOUND');
        });
        it('Gets a LoadTestDir using a valid time stamp (String)', async() => {
            const project = createDefaultProjectAndCheckIsAnObject();
            project.loadTestPath = loadTestResources;
            const metricsFilePath = await project.getClosestPathToLoadTestDir('30000000000000');
            fs.existsSync(metricsFilePath).should.be.true;
        });
        it('Gets a LoadTestDir using a valid time stamp (Int)', async() => {
            const project = createDefaultProjectAndCheckIsAnObject();
            project.loadTestPath = loadTestResources;
            const metricsFilePath = await project.getClosestPathToLoadTestDir(30000000000000);
            fs.existsSync(metricsFilePath).should.be.true;
        });
    });
    describe('getPathToLoadTestDir(timeOfTestRun)', () => {
        it('Fails to get a LoadTestDir using an invalid time stamp', () => {
            const project = createDefaultProjectAndCheckIsAnObject();
            project.loadTestPath = loadTestResources;
            return project.getPathToLoadTestDir('123')
                .should.be.eventually.rejectedWith(`found no exact match load-test metrics from time 123`)
                .and.be.an.instanceOf(ProjectMetricsError)
                .and.have.property('code', 'NOT_FOUND');
        });
        it('Gets a LoadTestDir using a valid time stamp (String)', async() => {
            const project = createDefaultProjectAndCheckIsAnObject();
            project.loadTestPath = loadTestResources;
            const metricsFilePath = await project.getPathToLoadTestDir('20190326154749');
            fs.existsSync(metricsFilePath).should.be.true;
        });
        it('Gets a LoadTestDir using a valid time stamp (Int)', async() => {
            const project = createDefaultProjectAndCheckIsAnObject();
            project.loadTestPath = loadTestResources;
            const metricsFilePath = await project.getPathToLoadTestDir(20190326154749);
            fs.existsSync(metricsFilePath).should.be.true;
        });
    });
    describe('getPathToMetricsFile(timeOfTestRun)', () => {
        it('Fails to get a LoadTestDir using an invalid time stamp', () => {
            const project = createDefaultProjectAndCheckIsAnObject();
            project.loadTestPath = loadTestResources;
            return project.getPathToMetricsFile('123')
                .should.be.eventually.rejectedWith(`Unable to find metrics for project ${project.projectID}`)
                .and.be.an.instanceOf(ProjectMetricsError)
                .and.have.property('code', 'NOT_FOUND');
        });
        it('Gets a LoadTestDir using a valid time stamp which is an existing filename', async() => {
            const project = createDefaultProjectAndCheckIsAnObject();
            project.loadTestPath = loadTestResources;
            const metricsFilePath = await project.getPathToMetricsFile('20190326154749');
            fs.existsSync(metricsFilePath).should.be.true;
        });
        it('Gets a LoadTestDir using a valid time stamp which larger than an existing filename', async() => {
            const project = createDefaultProjectAndCheckIsAnObject();
            project.loadTestPath = loadTestResources;
            const metricsFilePath = await project.getPathToMetricsFile('30000000000000');
            fs.existsSync(metricsFilePath).should.be.true;
        });
    });
    describe('updateMetricsDescription(timeOfTestRun, newDescription)', () => {
        it('Fails to get a LoadTestDir using an invalid time stamp', () => {
            const project = createDefaultProjectAndCheckIsAnObject();
            project.loadTestPath = loadTestResources;
            return project.updateMetricsDescription('123', 'newdesc')
                .should.be.eventually.rejectedWith(`Unable to find metrics for project ${project.projectID}`)
                .and.be.an.instanceOf(ProjectMetricsError)
                .and.have.property('code', 'NOT_FOUND');
        });
        it('Gets a LoadTestDir using a valid time stamp which is an existing filename', async() => {
            const testRun = '20190326154749';
            const description = 'a new description';
            const tempMetricsDir = path.join(global.codewind.CODEWIND_TEMP_WORKSPACE, 'metrics');
            const tempMetricsPath = path.join(tempMetricsDir, testRun);
            const tempMetricsFile = path.join(tempMetricsPath, 'metrics.json');

            await fs.copy(path.join(loadTestResources, testRun), tempMetricsPath);
            const project = createDefaultProjectAndCheckIsAnObject();
            project.loadTestPath = tempMetricsDir;

            const { desc: descPreChange } = await fs.readJSON(tempMetricsFile);
            descPreChange.should.equal('Test run 1');

            await project.updateMetricsDescription(testRun, description);
            const { desc: descPostChange } = await fs.readJSON(tempMetricsFile);
            descPostChange.should.equal(description);
        });
    });
    describe('getProfilingByTime(timeOfTestRun)', () => {
        it('Gets a profiling file using a valid time stamp (String)', async() => {
            const project = createDefaultProjectAndCheckIsAnObject();
            project.language = 'nodejs';
            project.loadTestPath = loadTestResources;
            const profilingFile = '20190326154749';
            const profilingStream = await project.getProfilingByTime(profilingFile);
            const actualProfilingFromFile = await fs.readJSON(path.join(loadTestResources, String(profilingFile), 'profiling.json'));
            const bufferS = [];
            let buffer = null;
            profilingStream.on('data', function(data) {
                bufferS.push(data);
            });
            profilingStream.on('end', function() {
                buffer = Buffer.concat(bufferS);
                const profilingOutput = JSON.parse(buffer);
                profilingOutput.should.deep.equal(actualProfilingFromFile);
            });
        });
        it('Gets a profiling file using a valid time stamp (Int)', async() => {
            const project = createDefaultProjectAndCheckIsAnObject();
            project.language = 'nodejs';
            project.loadTestPath = loadTestResources;
            const profilingFile = 20190326154749;
            const profilingStream = await project.getProfilingByTime(profilingFile);
            const actualProfilingFromFile = await fs.readJSON(path.join(loadTestResources, String(profilingFile), 'profiling.json'));
            const bufferS = [];
            let buffer = null;
            profilingStream.on('data', function(data) {
                bufferS.push(data);
            });
            profilingStream.on('end', function() {
                buffer = Buffer.concat(bufferS);
                const profilingOutput = JSON.parse(buffer);
                profilingOutput.should.deep.equal(actualProfilingFromFile);
            });
        });
    });
    describe('getPathToProfilingFile(timeOfTestRun)', () => {
        it('Fails to get a profiling.json path using an invalid time stamp', () => {
            const project = createDefaultProjectAndCheckIsAnObject();
            project.loadTestPath = loadTestResources;
            project.language = 'nodejs';
            return project.getPathToProfilingFile('123')
                .should.be.eventually.rejectedWith(`profiling.json was not found for load run 123`)
                .and.be.an.instanceOf(ProjectMetricsError)
                .and.have.property('code', 'PROFILING_NOT_FOUND');
        });
        it('Gets a profiling.json path using a valid time stamp which is an existing filename', async() => {
            const project = createDefaultProjectAndCheckIsAnObject();
            project.loadTestPath = loadTestResources;
            project.language = 'nodejs';
            const profilingFilePath = await project.getPathToProfilingFile('20190326154749');
            fs.existsSync(profilingFilePath).should.be.true;
        });
        it('Fails to get an .hcd path when java project container is not running', async() => {
            const project = createDefaultProjectAndCheckIsAnObject();
            project.loadTestPath = loadTestResources;
            project.language = 'java';

            const mockedCwUtils = {
                findHCDFile: () => { project.hcdName = 'dummyName'; },
            };
            const revertCwUtils = Project.__set__('cwUtils', mockedCwUtils);

            await project.getPathToProfilingFile('30000000000000')
                .should.be.eventually.rejectedWith('Unable to perform docker cp for project')
                .and.be.an.instanceOf(ProjectMetricsError)
                .and.have.property('code', 'DOCKER_CP');

            revertCwUtils();
        });
    });
    describe('getComparison()', () => {
        it('gets comparison', async() => {
            const project = createDefaultProjectAndCheckIsAnObject();
            project.loadTestPath = loadTestResources;
            const comparision = await project.getComparison();
            comparision.should.have.length(4);
            comparision.should.containSubset([
                { type: 'cpu', delta: {} },
                { type: 'gc', delta: {} },
                { type: 'memory', delta: {} },
                { type: 'http', delta: {} },
            ]);
        });
    });
    describe('Project States', () => {
        it('isOpen() Checks if a project is open', () => {
            const project = createDefaultProjectAndCheckIsAnObject();
            project.isOpen().should.be.true;
        });
        it('isClosed() Checks if a Project is closed', () => {
            const project = createDefaultProjectAndCheckIsAnObject();
            project.state = Project.STATES.closed;
            project.isClosed().should.be.true;
        });
        it('isValidating() Checks if a Project is validating', () => {
            const project = createDefaultProjectAndCheckIsAnObject();
            project.state = Project.STATES.validating;
            project.isValidating().should.be.true;
        });
    });
    describe('Project Action', () => {
        it('isClosing() Checks if a project is closing', () => {
            const project = createDefaultProjectAndCheckIsAnObject();
            project.action = Project.STATES.closing;
            project.isClosing().should.be.true;
        });
        it('isDeleting() Checks if a Project is deleting', () => {
            const project = createDefaultProjectAndCheckIsAnObject();
            project.action = Project.STATES.deleting;
            project.isDeleting().should.be.true;
        });
    });
    describe('getLoadTestConfig()', () => {
        it('Gets test config when it does not exist (creates a new config)', async() => {
            const project = createDefaultProjectAndCheckIsAnObject();
            const tempLoadDir = path.join(global.codewind.CODEWIND_TEMP_WORKSPACE, 'getLoadTestConfig');
            await fs.ensureDir(tempLoadDir);
            project.loadTestPath = tempLoadDir;
            fs.existsSync(path.join(tempLoadDir, 'config.json')).should.be.false;
            const config = await project.getLoadTestConfig();

            const expectedConfig = {
                path: '/',
                requestsPerSecond: '1',
                concurrency: '1',
                maxSeconds: '180',
            };
            config.should.deep.equal(expectedConfig);
            fs.existsSync(path.join(tempLoadDir, 'config.json')).should.be.true;
        });
        it('Gets test config when it does exist (reads existing config)', async() => {
            const project = createDefaultProjectAndCheckIsAnObject();
            const tempLoadDir = path.join(global.codewind.CODEWIND_TEMP_WORKSPACE, 'getLoadTestConfig');
            await fs.ensureDir(tempLoadDir);
            project.loadTestPath = tempLoadDir;

            const expectedConfig = {
                path: '/randompath',
                requestsPerSecond: '14',
                concurrency: '333333',
                maxSeconds: '234234',
            };
            await project.writeNewLoadTestConfigFile(expectedConfig);
            fs.existsSync(path.join(tempLoadDir, 'config.json')).should.be.true;

            const config = await project.getLoadTestConfig();
            config.should.deep.equal(expectedConfig);
            fs.existsSync(path.join(tempLoadDir, 'config.json')).should.be.true;
        });
    });
    describe('writeNewLoadTestConfigFile()', function() {
        it('Gets test config when it does not exist (creates a new config)', async() => {
            this.timeout(5000);
            const project = createDefaultProjectAndCheckIsAnObject();
            const tempLoadDir = path.join(global.codewind.CODEWIND_TEMP_WORKSPACE, 'writeNewLoadTestConfigFile');
            await fs.ensureDir(tempLoadDir);
            project.loadTestPath = tempLoadDir;
            fs.existsSync(path.join(tempLoadDir, 'config.json')).should.be.false;
            await project.writeNewLoadTestConfigFile({
                path: 'randompath',
            });

            fs.existsSync(path.join(tempLoadDir, 'config.json')).should.be.true;
        });
        it('Gets test config when it does exist (reads existing config)', async() => {
            const project = createDefaultProjectAndCheckIsAnObject();
            const tempLoadDir = path.join(global.codewind.CODEWIND_TEMP_WORKSPACE, 'getLoadTestConfig');
            await fs.ensureDir(tempLoadDir);
            project.loadTestPath = tempLoadDir;

            const expectedConfig = {
                path: '/randompath',
                requestsPerSecond: '14',
                concurrency: '333333',
                maxSeconds: '234234',
            };
            await project.writeNewLoadTestConfigFile(expectedConfig);
            fs.existsSync(path.join(tempLoadDir, 'config.json')).should.be.true;

            const config = await project.getLoadTestConfig();
            config.should.deep.equal(expectedConfig);
            fs.existsSync(path.join(tempLoadDir, 'config.json')).should.be.true;
        });
    });
    describe('createLoadTestConfigFile()', () => {
        it('Creates a new config file', async() => {
            const project = createDefaultProjectAndCheckIsAnObject();
            const tempLoadDir = path.join(global.codewind.CODEWIND_TEMP_WORKSPACE, 'createLoadTestConfigFileTest1');
            await fs.ensureDir(tempLoadDir);
            project.loadTestPath = tempLoadDir;
            const configPath = path.join(tempLoadDir, 'config.json');
            fs.existsSync(configPath).should.be.false;
            await project.createLoadTestConfigFile();

            fs.existsSync(configPath).should.be.true;
            const config = await fs.readJson(configPath);
            const expectedConfig = {
                path: '/',
                requestsPerSecond: '1',
                concurrency: '1',
                maxSeconds: '180',
            };
            config.should.deep.equal(expectedConfig);
        });
        it('Creates a new config file with a custom path', async() => {
            const project = createDefaultProjectAndCheckIsAnObject();
            const tempLoadDir = path.join(global.codewind.CODEWIND_TEMP_WORKSPACE, 'createLoadTestConfigFileTest2');
            await fs.ensureDir(tempLoadDir);
            project.loadTestPath = tempLoadDir;
            project.contextRoot = 'custompath';
            const configPath = path.join(tempLoadDir, 'config.json');
            fs.existsSync(configPath).should.be.false;
            await project.createLoadTestConfigFile();

            fs.existsSync(configPath).should.be.true;
            const { path: newPath } = await fs.readJson(configPath);
            newPath.should.equal('/custompath');
        });
        it('Overwrites an existing config file', async() => {
            const project = createDefaultProjectAndCheckIsAnObject();
            const tempLoadDir = path.join(global.codewind.CODEWIND_TEMP_WORKSPACE, 'createLoadTestConfigFileTest3');
            await fs.ensureDir(tempLoadDir);
            project.loadTestPath = tempLoadDir;
            const configPath = path.join(tempLoadDir, 'config.json');
            fs.existsSync(configPath).should.be.false;

            await project.writeNewLoadTestConfigFile({
                path: 'randompath',
            });
            fs.existsSync(configPath).should.be.true;
            const { path: prechangedPath } = await fs.readJson(configPath);
            prechangedPath.should.equal('randompath');

            fs.existsSync(configPath).should.be.true;
            await project.createLoadTestConfigFile();
            const { path: newPath } = await fs.readJson(configPath);
            newPath.should.equal('/');
        });
    });
    describe('Private functions using rewire', () => {
        describe('getLoadTestDirs(loadTestPath) ', () => {
            const getLoadTestDirs = Project.__get__('getLoadTestDirs');
            it('Should get all load test dirs in the resources directory', async() => {
                const resourceLoadTests = await fs.readdir(loadTestResources);
                const loadTestDirs = await getLoadTestDirs(loadTestResources);
                loadTestDirs.should.deep.equal(resourceLoadTests);
            });
            it('Should get an empty array as there are no load tests in the directory', async() => {
                const getLoadTestDirs = Project.__get__('getLoadTestDirs');
                const loadTestDirs = await getLoadTestDirs(__dirname);
                loadTestDirs.length.should.equal(0);
            });
            it('Should error as the directory does not exist', () => {
                const getLoadTestDirs = Project.__get__('getLoadTestDirs');
                return getLoadTestDirs('invaliddirectory')
                    .should.be.eventually.rejectedWith('Failed to read load-test directories')
                    .and.be.an.instanceOf(ProjectError)
                    .and.have.property('code', 'LOAD_TEST_DIR_ERROR');
            });
        });
        describe('getOverallAvgResTime(metricsFile)', () => {
            const getOverallAvgResTime = Project.__get__('getOverallAvgResTime');
            it('Should get the average response times for the given metrics.json', () => {
                const metricsFile = path.join(loadTestResources,'20190326154749', 'metrics.json');
                const averages = getOverallAvgResTime(fs.readJsonSync(metricsFile));
                averages.should.not.equal(0);
                averages.should.equal(3.0987205098728188);
            });
            it('Should error as null is given', () => {
                expect(() => {
                    getOverallAvgResTime({ httpUrls: null });
                }).to.throw('httpUrls data not found in metrics file');
            });
            it('Should error as JSON object given does not contain httpUrls', () => {
                expect(() => {
                    getOverallAvgResTime({ httpUrls: null });
                }).to.throw('httpUrls data not found in metrics file');
            });
        });
    });
});

function createProjectAndCheckIsAnObject(options, workspace) {
    const project = new Project({
        ...options,
        workspace,
    });
    project.should.be.an('object');
    return project;
}

function createDefaultProjectAndCheckIsAnObject() {
    const options = { name: 'dummy', locOnDisk: '/Documents/projectDir/' };
    const workspace = global.codewind.CODEWIND_WORKSPACE;
    return createProjectAndCheckIsAnObject(options, workspace);
}
