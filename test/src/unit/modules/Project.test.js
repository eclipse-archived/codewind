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

const Project = require('../../../../src/pfe/portal/modules/Project');

const chai = require('chai');
const chaiSubset = require('chai-subset');
chai.use(chaiSubset);
chai.should();

describe('Project.js', () => {
    describe('new Project', () => {
        it('Initialises a new Project with minimal arguments', () => {
            const project = new Project({
                name: 'newdummyproject'
            }, './someworkspace');
            project.should.be.an('object');
            project.should.have.property('projectID').to.be.a('string');
            project.should.have.property('name');
            project.name.should.equal('newdummyproject');
            project.should.have.property('workspace');
            project.workspace.should.equal('./someworkspace');
        });
        it('Sets directory to name-id', () => {
            const project = new Project({
                name: 'newdummyproject'
            }, './someworkspace');
            project.should.be.an('object');
            const id = project.projectID;
            const name = project.name;
            project.should.have.property('directory');
            project.directory.should.equal(`${name}-${id}`);
        });
        it('Correctly initialises using a comprehensive list of arguments', () => {
            const args = {
                projectID: '9318ab10-fef9-11e9-8761-9bf62d92b58b',
                name: 'my-java-project',
                codewindVersion: 'someversion',
                language: 'java',
                locOnDisk: 'location',
                workspace: '/codewind-workspace/',
                directory: 'directorythatisntname-id',
                infLockFlag: false,
                startMode: 'run',
                projectType: 'docker',
                buildLogPath: '/codewind-workspace/.logs/my-java-project-9318ab10-fef9-11e9-8761-9bf62d92b58b-9318ab10-fef9-11e9-8761-9bf62d92b58b/docker.build.log',
                state: 'open',
                autoBuild: false
                
            }
            const project = new Project(args, '/codewind-workspace/');
            project.should.be.an('object');
            project.should.containSubset(args);
            const { projectID, name } = project;
            project.directory.should.not.equal(`${name}-${projectID}`);
        });
        it('Correctly sets directory to name-id', () => {
            const project = new Project({
                name: 'newdummyproject'
            }, './someworkspace');
            project.should.be.an('object');
            const { projectID, name } = project;
            project.should.have.property('directory');
            project.directory.should.equal(`${name}-${projectID}`);
        });
    })
    describe('toJSON', () => {
        it('Checks that toJSON removes fields which shouldn\'t be written to .info file on disk', () => {
            const obj = {
                logStreams: 'logstream',
                loadInProgress: true,
                loadConfig: 'someconfig'
            }
            const project = new Project({ name: 'dummy'}, '/codewind-workspace/');
            project.should.be.an('object');
            project.should.containSubset({ name: 'dummy' });
            project.should.not.containSubset(obj);
    
            project.logStreams = obj.logStreams,
            project.loadInProgress = obj.loadInProgress;
            project.loadConfig = obj.loadConfig;
    
            project.should.containSubset(obj);
    
            const json = project.toJSON();
            json.should.not.containSubset(obj);
        });
    })
    describe('getPort', () => {
        it('Checks that the port returned is internal as RUNNING_IN_K8S is false', () => {
            const project = new Project({ name: 'dummy'}, '/codewind-workspace/');
            project.should.be.an('object');
            project.ports = {
                internalPort: 5000,
                exposedPort: 10000
            }
            const port = project.getPort();
            port.should.equal(5000);
        });
        it('Checks that the port returned is exposed as RUNNING_IN_K8S is true', () => {
            const project = new Project({ name: 'dummy'}, '/codewind-workspace/');
            global.codewind = { RUNNING_IN_K8S: true };
            project.should.be.an('object');
            project.ports = {
                internalPort: 5000,
                exposedPort: 10000
            }
            const port = project.getPort();
            port.should.equal(10000);
            global.codewind = { RUNNING_IN_K8S: false };
        });
    })
    describe('projectPath', () => {
        it('Checks that projectPath() is workspace+directory', () => {
            const project = new Project({ name: 'dummy', directory: 'directory' }, '/codewind-workspace/');
            const projectPath = project.projectPath();
            projectPath.should.equal('/codewind-workspace/directory');
        });
    })
    describe('isValidName', () => {
        it('Checks that name given is valid', () => {
            const validName = Project.isValidName('s0mething');
            validName.should.be.true;
        });
        it('Checks that name given is invalid', () => {
            const validName = Project.isValidName('_SOMETHING');
            validName.should.be.false;
        });
    })
    describe('getSettingsFilePath', () => {
        it('Gets the settingsFilePath', () => {
            const project = new Project({ name: 'dummy' }, '/codewind-workspace/');
            const settingsFilePath = project.getSettingsFilePath();
            const projectPath = project.projectPath();
            settingsFilePath.should.equal(`${projectPath}/.cw-settings`);
        });
    })
});
