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
const assert = require('assert');
const chai = require('chai');
const chaiSubset = require('chai-subset');
const chaiAsPromised = require('chai-as-promised');

const Project = rewire('../../../../src/pfe/portal/modules/Project');
const ProjectList = rewire('../../../../src/pfe/portal/modules/ProjectList');
const ProjectListError = require('../../../../src/pfe/portal/modules/utils/errors/ProjectListError');
const { suppressLogOutput } = require('../../../modules/log.service');

chai.use(chaiSubset);
chai.use(chaiAsPromised);
chai.should();

describe('ProjectList.js', () => {
    suppressLogOutput(Project);
    suppressLogOutput(ProjectList);
    before(() => {
        global.codewind = { CODEWIND_WORKSPACE: `${__dirname}/projectlist_temp` };
        fs.ensureDirSync(global.codewind.CODEWIND_WORKSPACE);
    });
    after(function() {
        this.timeout(5000);
        execSync(`rm -rf ${global.codewind.CODEWIND_WORKSPACE}`);
    });
    describe('new ProjectList()', () => {
        it('Initialises a new, empty ProjectList', () => {
            const projectList = new ProjectList();
            projectList.should.be.an('object');
            projectList.list.should.deep.equal({});
        });
    });
    describe('addProject(project)', () => {
        it('Creates a new Project and adds it to the ProjectList', () => {
            const projectList = new ProjectList();
            const project = new Project({
                name: 'newdummyproject',
                locOnDisk: '/Documents/projectDir/',
                workspace: global.codewind.CODEWIND_WORKSPACE,
            });
            projectList.addProject(project);
            const { list } = projectList;
            list.should.not.eql({});
            Object.keys(list).length.should.equal(1);
            list.should.have.property(project.projectID);
        });
        it('Throws an error as the project already exists', () => {
            const projectList = new ProjectList();
            const project = new Project({
                name: 'newdummyproject',
                locOnDisk: '/Documents/projectDir/',
                workspace: global.codewind.CODEWIND_WORKSPACE,
            });
            projectList.addProject(project);
            const { list } = projectList;
            list.should.not.eql({});
            Object.keys(list).length.should.equal(1);
            list.should.have.property(project.projectID);

            const error = new ProjectListError('ALREADY_EXISTS', project.projectID);
            assert.throws(() => projectList.addProject(project), error);
        });
    });
    describe('projectNameExists(name)', () => {
        it('Returns true as project name exists', () => {
            const projectList = new ProjectList();
            const project = new Project({
                name: 'newdummyproject',
                locOnDisk: '/Documents/projectDir/',
                workspace: global.codewind.CODEWIND_WORKSPACE,
            });
            projectList.addProject(project);
            const exists = projectList.projectNameExists('newdummyproject');
            exists.should.be.true;
        });
        it('Returns false as ProjectList is empty', () => {
            const projectList = new ProjectList();
            const exists = projectList.projectNameExists('random');
            exists.should.be.false;
        });
        it('Returns false as a project with the name "random" is not in the ProjectList', () => {
            const projectList = new ProjectList();
            const project = new Project({
                name: 'newdummyproject',
                locOnDisk: '/Documents/projectDir/',
                workspace: global.codewind.CODEWIND_WORKSPACE,
            });
            projectList.addProject(project);
            const exists = projectList.projectNameExists('random');
            exists.should.be.false;
        });
    });
    describe('removeProject(id)', () => {
        it('Removes a project from the ProjectList', () => {
            const projectList = new ProjectList();
            const project = new Project({
                name: 'newdummyproject',
                locOnDisk: '/Documents/projectDir/',
                workspace: global.codewind.CODEWIND_WORKSPACE,
            });
            projectList.addProject(project);
            const { list } = projectList;
            list.should.have.property(project.projectID);

            projectList.removeProject(project.projectID);
            list.should.eql({});
            Object.keys(list).length.should.equal(0);
            list.should.not.have.property(project.projectID);
        });
        it('Throws an error as a project with the projectID "123" is not in the ProjectList', () => {
            const projectList = new ProjectList();
            const id = '123';
            const error = new ProjectListError('NOT_FOUND', id);
            assert.throws(() => projectList.removeProject(id), error);
        });
    });
    describe('retrieveProject(id)', () => {
        it('Retrieves a project that exists', () => {
            const projectList = new ProjectList();
            const project = new Project({
                name: 'newdummyproject',
                locOnDisk: '/Documents/projectDir/',
                workspace: global.codewind.CODEWIND_WORKSPACE,
            });
            projectList.addProject(project);
            const { list } = projectList;
            list.should.have.property(project.projectID);

            const retrievedProject = projectList.retrieveProject(project.projectID);
            retrievedProject.should.deep.equal(project);
        });
        it('Receives undefined as project with the projectID "123" is not in the ProjectList', () => {
            const projectList = new ProjectList();
            const id = '123';
            const retrievedProject = projectList.retrieveProject(id);
      // eslint-disable-next-line no-undefined
            assert.equal(retrievedProject, undefined);
        });
    });
    describe('updateProject(updatedProject)', () => {
        it('Errors as project does not have a projectID', () => {
            const projectList = new ProjectList();
            const func = () => projectList.updateProject({});
            return func().should.be.rejectedWith(
                'MALFORMED',
                null,
                'Project does not have a project ID'
            );
        });
        it('Errors as project is not a member of the ProjectList', () => {
            const projectList = new ProjectList();
            const func = () => projectList.updateProject({ projectID: '123' });
            return func().should.be.rejectedWith('NOT_FOUND', '123');
        });
        it('Updates a project by adding new field', async() => {
            const projectList = new ProjectList();
            const project = new Project({
                name: 'newdummyproject',
                locOnDisk: '/Documents/projectDir/',
                workspace: global.codewind.CODEWIND_WORKSPACE,
            });
            projectList.addProject(project);

            const updatedProject = { ...project };
            updatedProject.newField = 'NEW';

            project.should.not.haveOwnProperty('newField');
            updatedProject.should.haveOwnProperty('newField');

            const returnedProject = await projectList.updateProject(updatedProject);
            returnedProject.should.haveOwnProperty('newField').and.equal('NEW');
            const returnedProjectInfPath = path.join(
                global.codewind.CODEWIND_WORKSPACE,
                '.projects',
                `${returnedProject.projectID}.inf`
            );
            fs.existsSync(returnedProjectInfPath).should.be.true;
        });
        it('Updates a project by changing an existing field', async() => {
            const projectList = new ProjectList();
            const project = new Project({
                name: 'newdummyproject',
                locOnDisk: '/Documents/projectDir/',
                workspace: global.codewind.CODEWIND_WORKSPACE,
            });
            projectList.addProject(project);

            const updatedProject = { ...project };
            updatedProject.name = 'NEW';

            project.should.haveOwnProperty('name').and.equal('newdummyproject');
            updatedProject.should.haveOwnProperty('name').and.equal('NEW');

            const returnedProject = await projectList.updateProject(updatedProject);
            returnedProject.should.haveOwnProperty('name').and.equal('NEW');
            const returnedProjectInfPath = path.join(
                global.codewind.CODEWIND_WORKSPACE,
                '.projects',
                `${returnedProject.projectID}.inf`
            );
            fs.existsSync(returnedProjectInfPath).should.be.true;
        });
        it('Updates a project\'s host to "ingress_host" and appStatus to "started"', async() => {
            const projectList = new ProjectList();
            const project = new Project({
                name: 'newdummyproject',
                locOnDisk: '/Documents/projectDir/',
                workspace: global.codewind.CODEWIND_WORKSPACE,
            });
            projectList.addProject(project);
      // CHE_INGRESS_HOST is set when appStatus is set to started
            process.env.CHE_INGRESS_HOST = 'ingress_host';

            const updatedProject = { ...project };
            updatedProject.appStatus = 'started';

            project.should.not.haveOwnProperty('appStatus');
            project.should.haveOwnProperty('host').and.equal('');
            updatedProject.should.haveOwnProperty('appStatus').and.equal('started');
            updatedProject.should.haveOwnProperty('host').and.equal('');

            const returnedProject = await projectList.updateProject(updatedProject);
            returnedProject.should.haveOwnProperty('appStatus').and.equal('started');
            returnedProject.should.haveOwnProperty('host').and.equal('ingress_host');
            const returnedProjectInfPath = path.join(
                global.codewind.CODEWIND_WORKSPACE,
                '.projects',
                `${returnedProject.projectID}.inf`
            );
            fs.existsSync(returnedProjectInfPath).should.be.true;
        });
    });
    describe('reloadSettingsFile(reloadProject)', () => {
        it('Errors as project does not have a projectID', () => {
            const projectList = new ProjectList();
            const func = () => projectList.reloadSettingsFile({});
            return func().should.be.rejectedWith(
                'MALFORMED',
                null,
                'Project does not have a project ID'
            );
        });
        it('Errors as project is not a member of the ProjectList', () => {
            const projectList = new ProjectList();
            const func = () => projectList.reloadSettingsFile({ projectID: '123' });
            return func().should.be.rejectedWith('NOT_FOUND', '123');
        });
        it('Reloads a project by reading from its .cw-settings file. A field found in .cw-settings is added to the project object', async() => {
            const projectList = new ProjectList();
            const project = new Project({
                name: 'reloadNewField',
                locOnDisk: '/Documents/projectDir/',
                workspace: global.codewind.CODEWIND_WORKSPACE,
            });

      // Create .inf file
            const projectInfPath = path.join(
                global.codewind.CODEWIND_WORKSPACE,
                '.projects',
                `${project.projectID}.inf`
            );
            await project.writeInformationFile();
            projectList.addProject(project);
            fs.existsSync(projectInfPath).should.be.true;

      // Create .cw-settings file
            const settingsFilePath = path.join(project.projectPath(), '.cw-settings');
            fs.existsSync(settingsFilePath).should.be.false;
            await fs.ensureFile(settingsFilePath);
            await fs.writeJSON(settingsFilePath, { newField: 'NEW' });
            fs.existsSync(settingsFilePath).should.be.true;

      // Reload project to pick up new .cw-settings
            const reloadedProject = await projectList.reloadSettingsFile(project);
            reloadedProject.should.haveOwnProperty('newField').and.equal('NEW');
            fs.existsSync(projectInfPath).should.be.true;
        });
        it("Reloads a project by reading from its .cw-settings file and ignores the projectID property (Don't overwrite projectID)", async() => {
            const projectList = new ProjectList();
            const project = new Project({
                name: 'reloadProjectID',
                locOnDisk: '/Documents/projectDir/',
                workspace: global.codewind.CODEWIND_WORKSPACE,
            });

      // Create .inf file
            const projectInfPath = path.join(
                global.codewind.CODEWIND_WORKSPACE,
                '.projects',
                `${project.projectID}.inf`
            );
            await project.writeInformationFile();
            projectList.addProject(project);
            fs.existsSync(projectInfPath).should.be.true;

      // Create .cw-settings file
            const settingsFilePath = path.join(project.projectPath(), '.cw-settings');
            fs.existsSync(settingsFilePath).should.be.false;
            await fs.ensureFile(settingsFilePath);
            await fs.writeJSON(settingsFilePath, { projectID: '123' });
            fs.existsSync(settingsFilePath).should.be.true;

      // Reload project to pick up new .cw-settings
            const reloadedProject = await projectList.reloadSettingsFile(project);
            reloadedProject.should
                .haveOwnProperty('projectID')
                .and.equal(project.projectID);
            fs.existsSync(projectInfPath).should.be.true;
        });
    });
    describe('deleteProjectKey(projectID, key)', () => {
        it('Errors as project is not a member of the ProjectList', () => {
            const projectList = new ProjectList();
            const func = () => projectList.deleteProjectKey('123', 'name');
            return func().should.be.rejectedWith('NOT_FOUND', '123');
        });
        it('Deletes a property (key) from a Project and writes to the .inf file', async() => {
            const projectList = new ProjectList();
            const project = new Project({
                name: 'dummyproject',
                locOnDisk: '/Documents/projectDir/' ,
                workspace: global.codewind.CODEWIND_WORKSPACE,
            });
            project.should.haveOwnProperty('name').and.equal('dummyproject');

      // Create .inf file
            const projectInfPath = path.join(
                global.codewind.CODEWIND_WORKSPACE,
                '.projects',
                `${project.projectID}.inf`
            );
            await project.writeInformationFile();
            projectList.addProject(project);
            fs.existsSync(projectInfPath).should.be.true;

      // Delete key from project
            const projectWithoutName = await projectList.deleteProjectKey(
                project.projectID,
                'name'
            );
            projectWithoutName.should.not.haveOwnProperty('name');

      // Verify key is deleted from .inf
            fs.existsSync(projectInfPath).should.be.true;
            const infContents = await fs.readJson(projectInfPath);
            infContents.should.not.haveOwnProperty('name');
        });
    });
    describe('getAsArray()', () => {
        it('Gets the projectList as an array (empty)', () => {
            const projectList = new ProjectList();

            const array = projectList.getAsArray();
            array.should.be.an('array');
            array.length.should.equal(0);
        });
        it('Gets the projectList as an array (2 elements)', () => {
            const projectList = new ProjectList();
            const project1 = new Project({
                name: 'newdummyproject',
                locOnDisk: '/Documents/projectDir/',
                workspace: global.codewind.CODEWIND_WORKSPACE,
            });
            projectList.addProject(project1);
            const project2 = new Project({
                name: 'newdummyproject',
                locOnDisk: '/Documents/projectDir/',
                workspace: global.codewind.CODEWIND_WORKSPACE,
            });
            projectList.addProject(project2);
            Object.keys(projectList.list).length.should.equal(2);

            const array = projectList.getAsArray();
            array.should.be.an('array');
            array.length.should.equal(2);
        });
    });
});
