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

const Extension = rewire('../../../../src/pfe/portal/modules/Extension');
const ExtensionList = rewire('../../../../src/pfe/portal/modules/ExtensionList');
const ExtensionListError = require('../../../../src/pfe/portal/modules/utils/errors/ExtensionListError');
const Templates = rewire('../../../../src/pfe/portal/modules/Templates');
const { templateRepositoryURL } = require('./../../../modules/template.service');
const { suppressLogOutput } = require('../../../modules/log.service');
const { testTimeout } = require('../../../config');
const {
    createCodewindYamlFile,
    createTemplatesProviderFile,
} = require('../../../modules/extension.service');

chai.use(chaiSubset);
chai.use(chaiAsPromised);
const should = chai.should();

const EXTENSION_DIR =  `${__dirname}/extensionlist_temp`;

describe('ExtensionList.js', function() {
    // Set the default timeout for all tests
    this.timeout(testTimeout.short);
    suppressLogOutput(Extension);
    suppressLogOutput(ExtensionList);
    suppressLogOutput(Templates);
    before(() => {
        fs.ensureDirSync(EXTENSION_DIR);
    });
    after(function() {
        execSync(`rm -rf ${EXTENSION_DIR}`);
    });
    describe('Class functions', () => {
        describe('new ExtensionList()', () => {
            it('Initialises a new, empty ExtensionList', () => {
                const extensionList = new ExtensionList();
                extensionList.should.be.an('object');
                const { _list: list } = extensionList;
                list.should.deep.equal({});
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
                const { _list: list } = extensionList;
                list.should.not.have.property('notanextension');
            });
            it('Loads an extension', async() => {
                createCodewindYamlFile(path.join(EXTENSION_DIR, 'extension'), { name: 'extension' });
                const extensionList = new ExtensionList();
                await extensionList.initialise(EXTENSION_DIR, templateController);
                const { _list: list } = extensionList;
                list.should.have.property('extension');
            });
            it('Loads an extension which contains a template repository URL', async function() {
                createCodewindYamlFile(path.join(EXTENSION_DIR, 'extensionWithURL'), { name: 'extensionWithURL', templates: templateRepositoryURL });
                const extensionList = new ExtensionList();
                await extensionList.initialise(EXTENSION_DIR, templateController);
                const { _list: list } = extensionList;
                list.should.have.property('extensionWithURL');
                const { extensionWithURL } = list;
                extensionWithURL.should.have.property('templates');

                // Ensure template repository has been added
                templateController.getRepository(extensionWithURL.templates).should.not.equal(null);
            });
            it('Loads an extension which contains a templateProvider.js file and no template repository URL', async function() {
                const extensionName = 'extensionWithTemplateProvider';
                createCodewindYamlFile(path.join(EXTENSION_DIR, extensionName), { name: extensionName });
                createTemplatesProviderFile(path.join(EXTENSION_DIR, extensionName));
                const extensionList = new ExtensionList();

                await extensionList.initialise(EXTENSION_DIR, templateController);
                const { _list: list } = extensionList;
                list.should.have.property(extensionName);
                const { extensionWithTemplateProvider } = list;
                extensionWithTemplateProvider.should.not.have.property('templateProvider');
    
                // Ensure provider has been added
                templateController.providers.should.have.property(extensionName);
            });
            it('Loads an extension which contains both a template repository URL and a templateProvider.js file (ignores the templateProvider.js file)', async function() {
                const extensionName = 'extensionWithBoth';
                createCodewindYamlFile(path.join(EXTENSION_DIR, extensionName), { name: extensionName, templates: templateRepositoryURL });
                createTemplatesProviderFile(path.join(EXTENSION_DIR, extensionName));
                const extensionList = new ExtensionList();
    
                await extensionList.initialise(EXTENSION_DIR, templateController);
                const { _list: list } = extensionList;
                list.should.have.property(extensionName);
                const { extensionWithBoth } = list;
                
                // Ensure template repository has been added
                templateController.getRepository(extensionWithBoth.templates).should.not.equal(null);
    
                // Ensure provider has not been added
                templateController.providers.should.not.have.property(extensionName);
            });
        });
        describe('loadExtensionFromDisk(extensionsPath, name)', () => {
            const extensionName = 'extension';
            const extensionNameOld = `${extensionName}__old`;
            afterEach(() => {
                execSync(`rm -rf ${EXTENSION_DIR}`);
            });
            it('Ignores a file within the given directory (does not Error)', async() => {
                fs.ensureFileSync(path.join(EXTENSION_DIR, 'file.txt'));
                const extensionList = new ExtensionList();
                await extensionList.loadExtensionFromDisk(EXTENSION_DIR, 'file.txt');
                const { _list: list } = extensionList;
                list.should.deep.equal({});
            });
            it('Ignores directory that does not exist and returns null (does not Error)', async() => {
                const extensionList = new ExtensionList();
                const ext = await extensionList.loadExtensionFromDisk(EXTENSION_DIR, 'doesnotexist');
                should.equal(ext, null);
                const { _list: list } = extensionList;
                list.should.deep.equal({});
            });
            it('Ignores directory that does not contain a codewind.yaml and returns null (does not Error)', async() => {
                fs.ensureDirSync(path.join(EXTENSION_DIR, 'invaliddir'));
                const extensionList = new ExtensionList();
                const ext = await extensionList.loadExtensionFromDisk(EXTENSION_DIR, 'invaliddir');
                should.equal(ext, null);
                const { _list: list } = extensionList;
                list.should.deep.equal({});
            });
            it('Ignores a directory with the old suffix in its name (__old) and returns null (does not Error)', async() => {
                createCodewindYamlFile(path.join(EXTENSION_DIR, extensionNameOld), { name: extensionNameOld });
                const extensionList = new ExtensionList();
                const ext = await extensionList.loadExtensionFromDisk(EXTENSION_DIR, extensionNameOld);
                should.equal(ext, null);
                const { _list: list } = extensionList;
                list.should.not.have.property(extensionNameOld);
            });
            it('Loads an extension from disk', async() => {
                createCodewindYamlFile(path.join(EXTENSION_DIR, extensionName), { name: extensionName });
                const extensionList = new ExtensionList();
                const { name } = await extensionList.loadExtensionFromDisk(EXTENSION_DIR, extensionName);
                name.should.equal(extensionName);
                const { _list: list } = extensionList;
                list.should.have.property(extensionName);
            });
            it('Loads an extension from disk and ignores one with old suffix in its name (__old)', async() => {
                createCodewindYamlFile(path.join(EXTENSION_DIR, extensionName), { name: extensionName });
                createCodewindYamlFile(path.join(EXTENSION_DIR, extensionNameOld), { name: extensionNameOld });
                const extensionList = new ExtensionList();
                await extensionList.loadExtensionFromDisk(EXTENSION_DIR, extensionName);
                await extensionList.loadExtensionFromDisk(EXTENSION_DIR, extensionNameOld);
                const { _list: list } = extensionList;
                list.should.have.property(extensionName);
                list.should.not.have.property(extensionNameOld);
            });
        });
        describe('loadExtensionsFromDisk(extensionsPath)', () => {
            const extensionNamePrefix = 'extension';
            const numExtensionsToCreate = 5;
            const extensionNames = [];
            beforeEach(() => {
                for (let i = 0; i < numExtensionsToCreate; i++) {
                    const name = `${extensionNamePrefix}-${i}`;
                    createCodewindYamlFile(path.join(EXTENSION_DIR, name), { name });
                    extensionNames.push(name);
                }
            });
            afterEach(() => {
                execSync(`rm -rf ${EXTENSION_DIR}`);
            });
            it('Loads multiple extensions from disk', async() => { 
                const extensionList = new ExtensionList();
                const extensions = await extensionList.loadExtensionsFromDisk(EXTENSION_DIR);
                extensions.length.should.equal(numExtensionsToCreate);
                for (const extension of extensions) {
                    const { name } = extension;
                    extensionNames.should.include(name);
                }
            });
            it('Loads multiple extensions from disk and ignores an invalid directory', async() => { 
                fs.ensureDirSync(path.join(EXTENSION_DIR, 'invaliddir'));
                const extensionList = new ExtensionList();
                const extensions = await extensionList.loadExtensionsFromDisk(EXTENSION_DIR);
                extensions.length.should.equal(numExtensionsToCreate);
                extensions.should.not.include('invaliddir');
            });
            it('Correctly filters out nulls that are returned when an extension fails to load', async() => { 
                fs.ensureDirSync(path.join(EXTENSION_DIR, 'invaliddir'));
                const extensionList = new ExtensionList();
                const extensions = await extensionList.loadExtensionsFromDisk(EXTENSION_DIR);
                extensions.should.not.include(null);
            });
        });
        describe('add(extension)', () => {
            it('Adds a new Extension to the ExtensionList', () => {
                const extension = new Extension({ name: 'dummyextension' });
                const extensionList = new ExtensionList();
                extensionList.add(extension);
                const { _list: list } = extensionList;
                list.should.have.property(extension.name);
            });
            it('Fails to add an extension with the same name as an existing one', () => {
                const extension = new Extension({ name: 'dummyextension' });
                const extensionList = new ExtensionList();
                extensionList.add(extension);
                const { _list: list } = extensionList;
                list.should.have.property(extension.name);
                const error = new ExtensionListError('EXISTS', extension.name);
                (() => extensionList.add(extension)).should.throws(error.message, error.code);
            });
        });
        describe('remove(name)', () => {
            it('Removes an Extension from the ExtensionList', () => {
                const extension = new Extension({ name: 'dummyextension' });
                const extensionList = new ExtensionList();
                extensionList.add(extension);
                const { _list: list } = extensionList;
                list.should.have.property(extension.name);
                extensionList.remove(extension.name);
                list.should.not.have.property(extension.name);
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
                const { _list: list } = extensionList;
                list.should.have.property(extension.name);
                const retrievedExtension = extensionList.retrieve(extension.name);
                retrievedExtension.should.equal(extension);
            });
            it('Fails to remove an extension that does not exist', () => {
                const extensionList = new ExtensionList();
                const retrievedExtension = extensionList.retrieve('nonexsistant');
                // eslint-disable-next-line no-undefined
                should.equal(retrievedExtension, undefined);
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
        describe('getProjectTypes()', () => {
            it('Gets all the extension names in the ExtensionList', () => {
                const extension1 = new Extension({ name: 'dummyextension1' });
                extension1.projectType = 'codewind';
                const extension2 = new Extension({ name: 'dummyextension2' });
                extension2.projectType = 'appsody';
                const extensionList = new ExtensionList();
                extensionList.add(extension1);
                extensionList.add(extension2);
                const projectTypes = extensionList.getProjectTypes();
                projectTypes.length.should.equal(2);
                projectTypes.should.include('codewind', 'appsody');
            });
            it('Gets an empty array when no Extensions exist in the ExtensionList', () => {
                const extensionList = new ExtensionList();
                const projectTypes = extensionList.getProjectTypes();
                projectTypes.length.should.equal(0);
            });
        });
        describe('getExtensionForProjectType(type)', () => {
            it('Retrieves the Extension for a projectType that exists in the ExtensionList', () => {
                const extension = new Extension({ name: 'dummyextension' });
                extension.projectType = 'codewind';
                const extensionList = new ExtensionList();
                extensionList.add(extension);
                const retrievedExtension = extensionList.getExtensionForProjectType('codewind');
                retrievedExtension.should.have.property('name', 'dummyextension');
            });
            it('Gets null when no Extension with the wanted projectType exists in the ExtensionList', () => {
                const extension = new Extension({ name: 'dummyextension' });
                extension.projectType = 'codewind';
                const extensionList = new ExtensionList();
                extensionList.add(extension);
                const retrievedExtension = extensionList.getExtensionForProjectType('invalidProjectType');
                should.equal(retrievedExtension, null);
            });
        });
        describe('getDetectionList()', () => {
            it('Returns a list of all Extensions detections lists combined', () => {
                const extension1 = new Extension({ name: 'node-ext' });
                extension1.projectType = 'nodejs';
                extension1.detection = 'package.json';
    
                const extension2 = new Extension({ name: 'appsody-ext' });
                extension2.projectType = 'appsody';
                extension2.detection = 'appsody-config.yaml';
    
                const extensionList = new ExtensionList();
                extensionList.add(extension1);
                extensionList.add(extension2);
    
                const detectedList = extensionList.getDetectionList();
                const expectedList = [
                    {
                        file: 'package.json',
                        type: 'nodejs',
                    },
                    {
                        file: 'appsody-config.yaml',
                        type: 'appsody',
                    },
                ];
                detectedList.should.deep.equal(expectedList);
            });
            it('Returns a single element as only one Extensions in the ExtensionList has detection and projectType fields', () => {
                const extension1 = new Extension({ name: 'node-ext' });
                extension1.projectType = 'nodejs';
                extension1.detection = 'package.json';
    
                const extension2 = new Extension({ name: 'appsody-ext' });
    
                const extensionList = new ExtensionList();
                extensionList.add(extension1);
                extensionList.add(extension2);
    
                const detectedList = extensionList.getDetectionList();
                detectedList.length.should.equal(1);
                detectedList.should.deep.equal([{
                    file: 'package.json',
                    type: 'nodejs',
                }]);
            });
            it('Returns an empty array as no Extensions in the ExtensionList that contain detection fields', () => {
                const extension = new Extension({ name: 'node-ext' });
                extension.projectType = 'nodejs';
                const extensionList = new ExtensionList();
                extensionList.add(extension);
                const detectedList = extensionList.getDetectionList();
                detectedList.length.should.equal(0);
            });
            it('Returns an empty array as no Extensions in the ExtensionList that contain projectType fields', () => {
                const extension = new Extension({ name: 'node-ext' });
                extension.detection = 'package.json';
                const extensionList = new ExtensionList();
                extensionList.add(extension);
                const detectedList = extensionList.getDetectionList();
                detectedList.length.should.equal(0);
            });
            it('Returns an empty array as no Extensions exist in the ExtensionList', () => {
                const extensionList = new ExtensionList();
                const detectedList = extensionList.getDetectionList();
                detectedList.length.should.equal(0);
            });
        });
    });
    describe('Local functions', () => {
        describe('addExtensionsToTemplates(extensions, templates)', () => {
            const addExtensionsToTemplates = ExtensionList.__get__('addExtensionsToTemplates');
            const extensionNamePrefix = 'extension';
            const numExtensionsToCreate = 3;
            const extensions = [];
            beforeEach(() => {
                for (let i = 0; i < numExtensionsToCreate; i++) {
                    const name = `${extensionNamePrefix}-${i}`;
                    const extension = new Extension({ name });
                    extensions.push(extension);
                }
            });
            it('Does not add the template repository when the templates field is invalid (Does not crash)', async() => {
                const extension = new Extension({ name: 'extension' });
                extension.templates = 'invalidURL';
                const templateController = new Templates(EXTENSION_DIR);
                await addExtensionsToTemplates([extension], templateController);
                const repo = templateController.getRepository(extension.templates);
                should.equal(repo, null);
            });
            it('Successfully adds the extension templates field as a repository when it exists', async() => {
                const extension = new Extension({ name: 'extension' });
                extension.templates = templateRepositoryURL;
                const templateController = new Templates(EXTENSION_DIR);
                await templateController.deleteRepository(templateRepositoryURL);
                await addExtensionsToTemplates([extension], templateController);

                // Ensure template repository has been added
                templateController.getRepository(extension.templates).should.not.equal(null);
            });
            it('Successfully adds the extension templateProvider as a provider', async() => {
                const extension = new Extension({ name: 'extension' });
                extension.templatesProvider = {
                    getRepositories: () => [],
                };
                const templateController = new Templates(EXTENSION_DIR);
                await addExtensionsToTemplates([extension], templateController);

                // Ensure provider has been added
                templateController.providers.should.have.property('extension');
                extension.should.not.have.property('templatesProvider');
            });
        });
    });
});
