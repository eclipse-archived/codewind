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
const path = require('path');
const rewire = require('rewire');
const chai = require('chai');
const chaiSubset = require('chai-subset');
const chaiAsPromised = require('chai-as-promised');

const Project = rewire('../../../../src/pfe/portal/modules/Project');
const ProjectError = require('../../../../src/pfe/portal/modules/utils/errors/ProjectError');
const ProjectMetricsError = require('../../../../src/pfe/portal/modules/utils/errors/ProjectMetricsError');

const { suppressLogOutput } = require('../../../modules/log.service');

chai.use(chaiSubset);
chai.use(chaiAsPromised);
chai.should();
const { expect } = chai;

const loadTestResources = path.join(__dirname, '../../../resources/load-test-data/');

describe('Project.js', () => {
    suppressLogOutput(Project);
    beforeEach(() => {
        global.codewind = { 
            RUNNING_IN_K8S: false,  
            CODEWIND_WORKSPACE: `${__dirname}/project_temp/`, 
            CODEWIND_TEMP_WORKSPACE: `${__dirname}/project_temp/temp/`,
        };
        fs.ensureDirSync(global.codewind.CODEWIND_TEMP_WORKSPACE);
    });
    after(() => {
        fs.removeSync(global.codewind.CODEWIND_WORKSPACE);
    });
    describe('new Project()', () => {
        it('Initialises a new Project with minimal arguments', () => {
            const project = new Project({
                name: 'newdummyproject',
            }, './someworkspace');
            project.should.be.an('object');
            project.should.have.property('projectID').to.be.a('string');
            project.should.have.property('name');
            project.name.should.equal('newdummyproject');
            project.should.have.property('workspace');
            project.workspace.should.equal('./someworkspace');
        });
        it('Sets directory to name', () => {
            const project = new Project({
                name: 'newdummyproject',
            }, './someworkspace');
            project.should.be.an('object');
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
                projectType: 'docker',
                buildLogPath: '/codewind-workspace/.logs/my-java-project-9318ab10-fef9-11e9-8761-9bf62d92b58b-9318ab10-fef9-11e9-8761-9bf62d92b58b/docker.build.log',
                state: 'open',
                autoBuild: false,  
            };
            const project = new Project(args, 'global.codewind.CODEWIND_WORKSPACE');
            project.should.be.an('object');
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
            const project = new Project({ name: 'dummy' }, global.codewind.CODEWIND_WORKSPACE);
            project.should.be.an('object');
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
    describe('checkIfMetricsAvailable()', () => {
        describe('Checks if metrics are available for Normal projects', () => {
            it('Generic project with no language', async() => {
                const project = new Project({ name: 'dummy' }, global.codewind.CODEWIND_WORKSPACE);
                project.should.be.an('object');
                const areMetricsAvailable = await project.checkIfMetricsAvailable();
                areMetricsAvailable.should.be.false;
            });
            it('Node.js', async() => {
                const project = new Project({ name: 'dummy', language: 'nodejs' }, global.codewind.CODEWIND_WORKSPACE);
                project.should.be.an('object');
                const packageJSONContents = {
                    dependencies: {
                        'appmetrics-dash': true,
                    },
                };
                const packageJSONPath = path.join(project.projectPath(), 'package.json');
                await fs.ensureFile(packageJSONPath);
                await fs.writeJSON(packageJSONPath, packageJSONContents);
                const areMetricsAvailable = await project.checkIfMetricsAvailable();
                areMetricsAvailable.should.be.true;
            });
            it('Java', async() => {
                const project = new Project({ name: 'dummy', language: 'java' }, global.codewind.CODEWIND_WORKSPACE);
                project.should.be.an('object');
                const pomXmlPath = path.join(project.projectPath(), 'pom.xml');
                await fs.ensureFile(pomXmlPath);
                await fs.writeFile(pomXmlPath, 'javametrics');
                const areMetricsAvailable = await project.checkIfMetricsAvailable();
                areMetricsAvailable.should.be.true;
            });
            it('Swift', async() => {
                const project = new Project({ name: 'dummy', language: 'swift' }, global.codewind.CODEWIND_WORKSPACE);
                project.should.be.an('object');
                const packageSwiftPath = path.join(project.projectPath(), 'Package.swift');
                await fs.ensureFile(packageSwiftPath);
                await fs.writeFile(packageSwiftPath, 'SwiftMetrics.git');
                const areMetricsAvailable = await project.checkIfMetricsAvailable();
                areMetricsAvailable.should.be.true;
            });
        });
        describe('Checks if metrics are available for Appsody projects', () => {
            it('Node.js', async() => {
                const projectObj = { name: 'dummy', projectType: 'appsodyExtension', language: 'nodejs' };
                const project = new Project(projectObj, global.codewind.CODEWIND_WORKSPACE);
                project.should.be.an('object');
                const areMetricsAvailable = await project.checkIfMetricsAvailable();
                areMetricsAvailable.should.be.true;
            });
            it('Java', async() => {
                const projectObj = { name: 'dummy', projectType: 'appsodyExtension', language: 'java' };
                const project = new Project(projectObj, global.codewind.CODEWIND_WORKSPACE);
                project.should.be.an('object');
                const areMetricsAvailable = await project.checkIfMetricsAvailable();
                areMetricsAvailable.should.be.true;
            });
            it('Swift', async() => {
                const projectObj = { name: 'dummy', projectType: 'appsodyExtension', language: 'swift' };
                const project = new Project(projectObj, global.codewind.CODEWIND_WORKSPACE);
                project.should.be.an('object');
                const areMetricsAvailable = await project.checkIfMetricsAvailable();
                areMetricsAvailable.should.be.true;
            });
            it('Invalid Language', async() => {
                const projectObj = { name: 'dummy', projectType: 'appsodyExtension', language: 'invalid' };
                const project = new Project(projectObj, global.codewind.CODEWIND_WORKSPACE);
                project.should.be.an('object');
                const areMetricsAvailable = await project.checkIfMetricsAvailable();
                areMetricsAvailable.should.be.false;
            });
        });
        
    });
    describe('getPort()', () => {
        it('Checks that the port returned is internal as RUNNING_IN_K8S is false', () => {
            const project = new Project({ name: 'dummy' }, global.codewind.CODEWIND_WORKSPACE);
            project.should.be.an('object');
            project.ports = {
                internalPort: 5000,
                exposedPort: 10000,
            };
            const port = project.getPort();
            port.should.equal(5000);
        });
        it('Checks that the port returned is exposed as RUNNING_IN_K8S is true', () => {
            const project = new Project({ name: 'dummy' }, global.codewind.CODEWIND_WORKSPACE);
            global.codewind = { RUNNING_IN_K8S: true };
            project.should.be.an('object');
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
            const project = new Project({ name: 'dummy', language: 'nodejs' }, global.codewind.CODEWIND_WORKSPACE);
            const metricsRoot = project.getMetricsContextRoot();
            metricsRoot.should.equal('appmetrics');
        });
        it('Gets metrics root for a Java project', () => {
            const project = new Project({ name: 'dummy', language: 'java' }, global.codewind.CODEWIND_WORKSPACE);
            const metricsRoot = project.getMetricsContextRoot();
            metricsRoot.should.equal('javametrics');
        });
        it('Gets metrics root for a Swift project', () => {
            const project = new Project({ name: 'dummy', language: 'swift' }, global.codewind.CODEWIND_WORKSPACE);
            const metricsRoot = project.getMetricsContextRoot();
            metricsRoot.should.equal('swiftmetrics');
        });
        it('Gets a blank string root for an invalid Project', () => {
            const project = new Project({ name: 'dummy', language: 'invalid' }, global.codewind.CODEWIND_WORKSPACE);
            const metricsRoot = project.getMetricsContextRoot();
            metricsRoot.should.equal('');
        });
        it('Gets a blank string root for a Project with no language', () => {
            const project = new Project({ name: 'dummy' }, global.codewind.CODEWIND_WORKSPACE);
            const metricsRoot = project.getMetricsContextRoot();
            metricsRoot.should.equal('');
        });
    });
    describe('projectPath(_)', () => {
        it('Checks that projectPath() is workspace+directory', () => {
            const project = new Project({ name: 'dummy', directory: 'directory' }, global.codewind.CODEWIND_WORKSPACE);
            const projectPath = project.projectPath();
            projectPath.should.equal(path.join(global.codewind.CODEWIND_WORKSPACE, 'directory'));
        });
    });
    describe('readSettingsFile()', () => {
        it('Returns a blank object is returned if the settings file does not exist', async() => {
            const project = new Project({ name: 'dummy' }, global.codewind.CODEWIND_WORKSPACE);
            const settings = await project.readSettingsFile();
            settings.should.deep.equal({});
        });
        it('Returns the contents of a created .cw-settings file', async() => {
            const project = new Project({ name: 'dummy' }, global.codewind.CODEWIND_WORKSPACE);
            const settingsPath = path.join(project.projectPath(), '.cw-settings');
            await fs.ensureFile(settingsPath);
            await fs.writeJson(settingsPath, { property: 'string' });
            const settings = await project.readSettingsFile();
            settings.should.have.property('property').and.equal('string');
        });
    });
    describe('writeInformationFile()', () => {
        it('Checks that the information file is created', async() => {
            const project = new Project({ name: 'dummy', directory: 'directory' }, global.codewind.CODEWIND_WORKSPACE);
            const infPath = path.join(global.codewind.CODEWIND_WORKSPACE, '/.projects', `${project.projectID}.inf`);
            fs.existsSync(infPath).should.be.false;
            await project.writeInformationFile();
            fs.existsSync(infPath).should.be.true;
        });
        it('Checks that the information file is correct for a generic Project', async() => {
            const project = new Project({ name: 'dummy' }, global.codewind.CODEWIND_WORKSPACE);
            const infPath = path.join(global.codewind.CODEWIND_WORKSPACE, '/.projects', `${project.projectID}.inf`);
            await project.writeInformationFile();
            fs.existsSync(infPath).should.be.true;

            const infJson = await fs.readJson(infPath);
            infJson.should.have.property('projectID').and.equal(project.projectID);
        });
        it('Checks that an information file can be used to create a project', async() => {
            const project = new Project({ name: 'dummy' }, global.codewind.CODEWIND_WORKSPACE);
            const infPath = path.join(global.codewind.CODEWIND_WORKSPACE, '/.projects', `${project.projectID}.inf`);
            await project.writeInformationFile();
            fs.existsSync(infPath).should.be.true;
            const infJson = await fs.readJson(infPath);
            infJson.should.have.property('projectID').and.equal(project.projectID);

            const projectFromInf = new Project(infJson, global.codewind.CODEWIND_WORKSPACE);
            projectFromInf.should.deep.equal(project);
        });
        it('Checks the Project cannot be written when it is locked', function() {
            // The lock check waits for 1000
            this.slow(1500);
            const project = new Project({ name: 'dummy' }, global.codewind.CODEWIND_WORKSPACE);
            project.infLockFlag = true;
            return project.writeInformationFile()
                .should.be.eventually.rejectedWith(`Unable to obtain lock for project in file for project ${project.name}.`)
                .and.be.an.instanceOf(ProjectError)
                .and.have.property('code', 'LOCK_FAILURE');

        });
    });
    describe('getBuildLogPath()', () => {
        it('Checks that null is returned when a buildLogPath does not exist', () => {
            const project = new Project({ name: 'dummy' }, global.codewind.CODEWIND_WORKSPACE);
            project.should.have.property('buildLogPath').and.be.null;
            const logPath = project.getBuildLogPath();
            expect(logPath).to.be.null;
        });
        it('Checks that the buildLogPath is returned', () => {
            const project = new Project({ name: 'dummy', buildLogPath: 'somepath' }, global.codewind.CODEWIND_WORKSPACE);
            project.should.have.property('buildLogPath').and.equal('somepath');
            const logPath = project.getBuildLogPath();
            logPath.should.equal('somepath');
        });
        it('Checks that the buildLogPath has codewind-workspace substituted with global workspace', () => {
            const project = new Project({ name: 'dummy', buildLogPath: '/codewind-workspace/somelogfile' }, global.codewind.CODEWIND_WORKSPACE);
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
            const project = new Project({ name: 'dummy' }, global.codewind.CODEWIND_WORKSPACE);
            return project.getMetrics('invalidType')
                .should.be.eventually.rejectedWith('Failed to read load-test directories')
                .and.be.an.instanceOf(ProjectError)
                .and.have.property('code', 'LOAD_TEST_DIR_ERROR');
        });
        it('Fails to get the metrics of an invalid type', () => {
            const project = new Project({ name: 'dummy' }, global.codewind.CODEWIND_WORKSPACE);
            project.loadTestPath = global.codewind.CODEWIND_WORKSPACE;
            return project.getMetrics('invalidType')
                .should.be.eventually.rejectedWith('invalidType is not a valid metric type. Valid metric types are\n[cpu,gc,memory,http]')
                .and.be.an.instanceOf(ProjectError)
                .and.have.property('code', 'INVALID_METRIC_TYPE');
        });
        it('Gets an empty array of metrics as none exist in the loadTestPath', async() => {
            const project = new Project({ name: 'dummy' }, global.codewind.CODEWIND_WORKSPACE);
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
                    const project = new Project({ name: 'dummy' }, global.codewind.CODEWIND_WORKSPACE);
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
        it('Fails to get a metrics file using an invalid time stamp', () => {
            const project = new Project({ name: 'dummy' }, global.codewind.CODEWIND_WORKSPACE);
            project.loadTestPath = loadTestResources;
            return project.getMetricsByTime('123')
                .should.be.eventually.rejectedWith(`Unable to find metrics for project ${project.projectID}`)
                .and.be.an.instanceOf(ProjectMetricsError)
                .and.have.property('code', 'NOT_FOUND');
        });
        it('Gets a metrics file using a valid time stamp (String)', async() => {
            const project = new Project({ name: 'dummy' }, global.codewind.CODEWIND_WORKSPACE);
            project.loadTestPath = loadTestResources;
            const metricsFile = '20190326154749';
            const metricsTypes = await project.getMetricsByTime(metricsFile);
            metricsTypes.should.have.property('id').and.equal(0);
            metricsTypes.should.have.property('time');
            metricsTypes.should.have.property('desc');
            metricsTypes.should.have.property('cpu');
            metricsTypes.should.have.property('gc');
            metricsTypes.should.have.property('memory');
            metricsTypes.should.have.property('httpUrls');
            const actualMetricsFromFile = await fs.readJSON(path.join(loadTestResources, metricsFile, 'metrics.json'));
            metricsTypes.should.deep.equal(actualMetricsFromFile);
        });
        it('Gets a metrics file using a valid time stamp (Int)', async() => {
            const project = new Project({ name: 'dummy' }, global.codewind.CODEWIND_WORKSPACE);
            project.loadTestPath = loadTestResources;
            const metricsFile = 20190326154749;
            const metricsTypes = await project.getMetricsByTime(metricsFile);
            metricsTypes.should.have.property('id').and.equal(0);
            metricsTypes.should.have.property('time');
            metricsTypes.should.have.property('desc');
            metricsTypes.should.have.property('cpu');
            metricsTypes.should.have.property('gc');
            metricsTypes.should.have.property('memory');
            metricsTypes.should.have.property('httpUrls');
            const actualMetricsFromFile = await fs.readJSON(path.join(loadTestResources, String(metricsFile), 'metrics.json'));
            metricsTypes.should.deep.equal(actualMetricsFromFile);
        });
    });
    describe('deleteMetrics(timeOfTestRun)', () => {
        it('Fails to delete a metrics file using an invalid time stamp', () => {
            const project = new Project({ name: 'dummy' }, global.codewind.CODEWIND_WORKSPACE);
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
            const project = new Project({ name: 'dummy' }, global.codewind.CODEWIND_WORKSPACE);
            project.loadTestPath = tempMetricsDir;
            fs.existsSync(tempMetricsPath).should.be.true;
            await project.deleteMetrics('123');
            fs.existsSync(tempMetricsPath).should.be.false;
        });
        it('Deletes a metrics file using a valid time stamp (Int)', async() => {
            const tempMetricsDir = path.join(global.codewind.CODEWIND_TEMP_WORKSPACE, 'metrics');
            const tempMetricsPath = path.join(tempMetricsDir, '123');
            await fs.copy(path.join(loadTestResources,'20190326154749'), tempMetricsPath);
            const project = new Project({ name: 'dummy' }, global.codewind.CODEWIND_WORKSPACE);
            project.loadTestPath = tempMetricsDir;
            fs.existsSync(tempMetricsPath).should.be.true;
            await project.deleteMetrics(123);
            fs.existsSync(tempMetricsPath).should.be.false;
        });
    });
    describe('getClosestPathToLoadTestDir(timeOfTestRun)', () => {
        it('Fails to get a LoadTestDir using an invalid time stamp (time given is too low)', () => {
            const project = new Project({ name: 'dummy' }, global.codewind.CODEWIND_WORKSPACE);
            project.loadTestPath = loadTestResources;
            return project.getClosestPathToLoadTestDir('123')
                .should.be.eventually.rejectedWith(`found no load-test metrics from time 123`)
                .and.be.an.instanceOf(ProjectMetricsError)
                .and.have.property('code', 'NOT_FOUND');
        });
        it('Gets a LoadTestDir using a valid time stamp (String)', async() => {
            const project = new Project({ name: 'dummy' }, global.codewind.CODEWIND_WORKSPACE);
            project.loadTestPath = loadTestResources;
            const metricsFilePath = await project.getClosestPathToLoadTestDir('30000000000000');
            fs.existsSync(metricsFilePath).should.be.true;
        });
        it('Gets a LoadTestDir using a valid time stamp (Int)', async() => {
            const project = new Project({ name: 'dummy' }, global.codewind.CODEWIND_WORKSPACE);
            project.loadTestPath = loadTestResources;
            const metricsFilePath = await project.getClosestPathToLoadTestDir(30000000000000);
            fs.existsSync(metricsFilePath).should.be.true;
        });
    });
    describe('getPathToLoadTestDir(timeOfTestRun)', () => {
        it('Fails to get a LoadTestDir using an invalid time stamp', () => {
            const project = new Project({ name: 'dummy' }, global.codewind.CODEWIND_WORKSPACE);
            project.loadTestPath = loadTestResources;
            return project.getPathToLoadTestDir('123')
                .should.be.eventually.rejectedWith(`found no exact match load-test metrics from time 123`)
                .and.be.an.instanceOf(ProjectMetricsError)
                .and.have.property('code', 'NOT_FOUND');
        });
        it('Gets a LoadTestDir using a valid time stamp (String)', async() => {
            const project = new Project({ name: 'dummy' }, global.codewind.CODEWIND_WORKSPACE);
            project.loadTestPath = loadTestResources;
            const metricsFilePath = await project.getPathToLoadTestDir('20190326154749');
            fs.existsSync(metricsFilePath).should.be.true;
        });
        it('Gets a LoadTestDir using a valid time stamp (Int)', async() => {
            const project = new Project({ name: 'dummy' }, global.codewind.CODEWIND_WORKSPACE);
            project.loadTestPath = loadTestResources;
            const metricsFilePath = await project.getPathToLoadTestDir(20190326154749);
            fs.existsSync(metricsFilePath).should.be.true;
        });
    });
});
