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
const yaml = require('js-yaml');
const chai = require('chai');
const chaiSubset = require('chai-subset');
const chaiAsPromised = require('chai-as-promised');

const Extension = rewire('../../../../src/pfe/portal/modules/Extension');
const { suppressLogOutput } = require('../../../modules/log.service');

chai.use(chaiSubset);
chai.use(chaiAsPromised);
chai.should();

const CODEWIND_YAML = {
    name: 'dummyExtension',
    version: 1,
    description: 'dummy extension for testing',
    projectType: 'dummyExtension',
    commands: 'commands',
    detection: 'package.json',
    config: 'config',
    templates: 'templates',
};

const TEMPLATES_PROVIDER = 'module.exports = { dummyFunction: function() {return "testString";} };';

describe('Extension.js', () => {
    suppressLogOutput(Extension);
    const tempDir = `${__dirname}/extension_temp`;
    const codewindYamlPath = path.join(tempDir, 'codewind.yaml');
    before(() => {
        fs.ensureDirSync(tempDir);
    });
    after(function() {
        this.timeout(5000);
        execSync(`rm -rf ${tempDir}`);
    });
    describe('new Extension()', () => {
        it('Initialises a new Extension', () => {
            const args = {
                name: 'extension',
                path: tempDir,
            };
            const extension = new Extension(args);
            extension.should.be.an('object');
            extension.should.have.keys(['name', 'path', 'version', 'description', 'projectType', 'commands', 'detection', 'templates', 'config']);
        });
    });
    describe('initialise()', () => {
        before(() => {
            const codewindYamlFileContents = yaml.safeDump(CODEWIND_YAML);
            fs.writeFileSync(codewindYamlPath, codewindYamlFileContents);
        });
        it('Fails to find a codewind.yaml in the given directory', () => {
            const pathThatDoesNotExist = 'notapath';
            const extension = new Extension({ path: pathThatDoesNotExist });
            return extension.initialise()
                .should.be.eventually.rejectedWith(`ENOENT: no such file or directory, open '${pathThatDoesNotExist}/codewind.yaml'`);
        });
        it('Successfully initalises given a codewind.yaml file', async() => {
            const extension = new Extension({ path: tempDir });
            await extension.initialise();
            for (const property in CODEWIND_YAML) {
                extension.should.have.property(property, CODEWIND_YAML[property]);
            }
        });
        describe('No templates are added to the extension as templatesProvider.js does not exist', () => {
            const codewindYamlFileWithoutTemplates = { ...CODEWIND_YAML };
            delete codewindYamlFileWithoutTemplates.templates;
            before(() => {
                const codewindYamlFileContents = yaml.safeDump(codewindYamlFileWithoutTemplates);
                fs.writeFileSync(codewindYamlPath, codewindYamlFileContents);
            });
            it('leaves the templates field as null and does not add a templatesProvider field', async() => {
                const extension = new Extension({ path: tempDir });
                await extension.initialise();
                extension.should.have.property('templates', null);
                extension.should.not.have.property('templatesProvider');
            });
            after(() => {
                fs.removeSync(codewindYamlPath);
            });
        });
        describe('templatesProvider.js exists', () => {
            const codewindYamlFileWithoutTemplates = { ...CODEWIND_YAML };
            delete codewindYamlFileWithoutTemplates.templates;
            const templatesProviderPath = path.join(tempDir, 'templatesProvider.js');
            before(() => {
                const codewindYamlFileContents = yaml.safeDump(codewindYamlFileWithoutTemplates);
                fs.writeFileSync(codewindYamlPath, codewindYamlFileContents);
                fs.writeFileSync(templatesProviderPath, TEMPLATES_PROVIDER);
            });
            it('reads the templatesProvider.js file, requires it and can run the function given in it', async() => {
                const extension = new Extension({ path: tempDir });
                await extension.initialise();
                extension.should.have.property('templatesProvider');
                const templateProviderFunction = extension.templatesProvider.dummyFunction;
                templateProviderFunction.should.be.a('function');
                templateProviderFunction().should.equal('testString');
            });
            after(() => {
                fs.removeSync(templatesProviderPath);
                fs.removeSync(codewindYamlPath);
            }); 
        });
    });
});