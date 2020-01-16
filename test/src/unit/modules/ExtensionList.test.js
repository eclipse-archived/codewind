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
global.codewind = { RUNNING_IN_K8S: false };

const fs = require('fs-extra');
const { execSync } = require('child_process');
const path = require('path');
const rewire = require('rewire');
const chai = require('chai');
const chaiSubset = require('chai-subset');
const chaiAsPromised = require('chai-as-promised');
const yaml = require('js-yaml');

const Extension = rewire('../../../../src/pfe/portal/modules/Extension');
const ExtensionList = rewire('../../../../src/pfe/portal/modules/ExtensionList');
const ExtensionListError = require('../../../../src/pfe/portal/modules/utils/errors/ExtensionListError');
const Templates = rewire('../../../../src/pfe/portal/modules/Templates');
const { templateRepositoryURL } = require('./../../../modules/template.service');
const { suppressLogOutput } = require('../../../modules/log.service');
const { testTimeout } = require('../../../config');

chai.use(chaiSubset);
chai.use(chaiAsPromised);
chai.should();

const EXTENSION_DIR =  `${__dirname}/extensionlist_temp`;

describe('ExtensionList.js', () => {
    suppressLogOutput(Extension);
    suppressLogOutput(ExtensionList);
    suppressLogOutput(Templates);
    before(() => {
        fs.ensureDirSync(EXTENSION_DIR);
    });
    after(function() {
        this.timeout(5000);
        execSync(`rm -rf ${EXTENSION_DIR}`);
    });
    describe('new ExtensionList()', () => {
        it('Initialises a new, empty ExtensionList', () => {
            const extensionList = new ExtensionList();
            extensionList.should.be.an('object');
            extensionList._list.should.deep.equal({});
        });
    });
    describe('initialise(extensionsPath, templates)', () => {
        let templateController;
        beforeEach(async() => {
            fs.ensureDirSync(EXTENSION_DIR);
            templateController = new Templates(EXTENSION_DIR);
            await templateController.deleteRepository(templateRepositoryURL);
        });
        afterEach(() => {
            execSync(`rm -rf ${EXTENSION_DIR}`);
        });
        it('Fails to load extensions from a directory that does not exist', () => {
            const extensionList = new ExtensionList();
            return extensionList.initialise('nonexistant_dir', templateController)
                .should.be.eventually.rejectedWith(`FAILED_TO_LOAD: Failed to load extensions`)
                .and.be.an.instanceOf(ExtensionListError)
                .and.have.property('code', 'FAILED_TO_LOAD');
        });
        it('Ignores an invalid directory without crashing', async() => {
            fs.ensureDirSync(path.join(EXTENSION_DIR, 'notanextension'));
            const extensionList = new ExtensionList();
            await extensionList.initialise(EXTENSION_DIR, templateController);
            extensionList._list.should.not.have.property('notanextension');
        });
        it('Loads an extension', async() => {
            createDummyExtension('extension');
            const extensionList = new ExtensionList();
            await extensionList.initialise(EXTENSION_DIR, templateController);
            extensionList._list.should.have.property('extension');
        });
        it('Loads an extension which contains a template repository URL', async function() {
            this.timeout(testTimeout.short);
            createDummyExtension('extensionWithURL', templateRepositoryURL);
            const extensionList = new ExtensionList();
            await extensionList.initialise(EXTENSION_DIR, templateController);
            extensionList._list.should.have.property('extensionWithURL');
            const { extensionWithURL } = extensionList._list;
            extensionWithURL.should.have.property('templates');

            // Ensure template repository has been added
            await templateController.getRepository(extensionWithURL.templates).should.be.fulfilled;
        });
        it('Loads an extension which contains a templateProvider.js file and no template repository URL', async function() {
            this.timeout(testTimeout.short);
            createDummyExtensionWithTemplateProvider('extensionWithTemplateProvider');
            const extensionList = new ExtensionList();
            await extensionList.initialise(EXTENSION_DIR, templateController);
            extensionList._list.should.have.property('extensionWithTemplateProvider');
            const { extensionWithTemplateProvider } = extensionList._list;
            extensionWithTemplateProvider.should.not.have.property('templateProvider');

            // Ensure provider has been added
            templateController.providers.should.have.property('extensionWithTemplateProvider');
        });
        it('Loads an extension which contains both a template repository URL and a templateProvider.js file (ignores the templateProvider.js file)', async function() {
            this.timeout(testTimeout.short);
            createDummyExtensionWithTemplateProvider('extensionWithBoth', templateRepositoryURL);
            const extensionList = new ExtensionList();
            await extensionList.initialise(EXTENSION_DIR, templateController);
            extensionList._list.should.have.property('extensionWithBoth');
            const { extensionWithBoth } = extensionList._list;
            
            // Ensure template repository has been added
            await templateController.getRepository(extensionWithBoth.templates).should.be.fulfilled;

            // Ensure provider has not been added
            templateController.providers.should.not.have.property('extensionWithBoth');
        });
    });
    describe('add(extension)', () => {
        it('Adds a new Extension to the ExtensionList', () => {
            const extension = new Extension({ name: 'dummyextension' });
            const extensionList = new ExtensionList();
            extensionList.add(extension);
            extensionList._list.should.have.property(extension.name);
        });
        it('Fails to add an extension with the same name as an existing one', () => {
            const extension = new Extension({ name: 'dummyextension' });
            const extensionList = new ExtensionList();
            extensionList.add(extension);
            extensionList._list.should.have.property(extension.name);
            const error = new ExtensionListError('EXISTS', extension.name);
            (() => extensionList.add(extension)).should.throws(error.message, error.code);
        });
    });
    describe('remove(name)', () => {
        it('Removes an Extension from the ExtensionList', () => {
            const extension = new Extension({ name: 'dummyextension' });
            const extensionList = new ExtensionList();
            extensionList.add(extension);
            extensionList._list.should.have.property(extension.name);
            extensionList.remove(extension.name);
            extensionList._list.should.not.have.property(extension.name);
        });
        it('Fails to remove an extension that does not exist', () => {
            const extensionList = new ExtensionList();
            const error = new ExtensionListError('NOT_FOUND', 'nonexsistant');
            (() => extensionList.remove('nonexsistant')).should.throws(error.message, error.code);
        });
    });
    describe('retrieve(name)', () => {
        it('Retrieves an Extension from the ExtensionList', () => {
            const extension = new Extension({ name: 'dummyextension' });
            const extensionList = new ExtensionList();
            extensionList.add(extension);
            extensionList._list.should.have.property(extension.name);
            const retrievedExtension = extensionList.retrieve(extension.name);
            retrievedExtension.should.equal(extension);
        });
        it('Fails to remove an extension that does not exist', () => {
            const extensionList = new ExtensionList();
            const retrievedExtension = extensionList.retrieve('nonexsistant');
            (typeof retrievedExtension).should.equal('undefined');
        });
    });
    describe('getNames()', () => {
        it('Gets all the extension names in the ExtensionList', () => {
            const extension1 = new Extension({ name: 'dummyextension1' });
            const extension2 = new Extension({ name: 'dummyextension2' });
            const extensionList = new ExtensionList();
            extensionList.add(extension1);
            extensionList.add(extension2);
            const names = extensionList.getNames();
            names.length.should.equal(2);
            names.should.include('dummyextension1', 'dummyextension2');
        });
        it('Gets an empty array when no Extensions exist in the ExtensionList', () => {
            const extensionList = new ExtensionList();
            const names = extensionList.getNames();
            names.length.should.equal(0);
        });
    });
    describe.skip('getProjectTypes()', () => {
        before(() => {

        });
        it('Gets all the extension names in the ExtensionList', () => {
            const extension1 = new Extension({ name: 'dummyextension1', projectType: 'codewind' });
            const extension2 = new Extension({ name: 'dummyextension2', projectType: 'appsody' });
            const extensionList = new ExtensionList();
            extensionList.add(extension1);
            extensionList.add(extension2);
            const projectTypes = extensionList.getProjectTypes();
            projectTypes.length.should.equal(2);
            projectTypes.should.include('codewind', 'appsody');
        });
        it('Gets an empty array when no Extensions exist in the ExtensionList', () => {
            const extensionList = new ExtensionList();
            const names = extensionList.getNames();
            names.length.should.equal(0);
        });
    });
});

function createDummyExtension(name, repositoryURL = false) {
    // Create extension directory
    const dir = path.join(EXTENSION_DIR, name);
    fs.ensureDirSync(dir);

    // Create codewind.yaml file
    const codewindFileJson = {
        name,
        version: 1,
        description: 'dummy extension for testing',
        projectType: 'dummyExtension',
    };
    if (repositoryURL) {
        codewindFileJson.templates = repositoryURL;
    }
    const codewindFileYaml = yaml.safeDump(codewindFileJson);
    fs.writeFileSync(path.join(dir, 'codewind.yaml'), codewindFileYaml);
}

function createDummyExtensionWithTemplateProvider(name, repositoryURL = false) {
    createDummyExtension(name, repositoryURL);
    const getRepoFunc = 'getRepositories: () => { return []; }';
    const templates_provider_content = `module.exports = { ${getRepoFunc} };`;
    fs.writeFileSync(path.join(EXTENSION_DIR, name, 'templatesProvider.js'), templates_provider_content);
}