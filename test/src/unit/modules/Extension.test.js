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
const rewire = require('rewire');
const chai = require('chai');
const chaiSubset = require('chai-subset');
const chaiAsPromised = require('chai-as-promised');

const Extension = rewire('../../../../src/pfe/portal/modules/Extension');
const { suppressLogOutput } = require('../../../modules/log.service');
const { 
    CODEWIND_YAML,
    COMPLETE_CODEWIND_YAML,
    createCodewindYamlFile,
    deleteCodewindYamlFile,
    createTemplatesProviderFile,
    deleteTemplatesProviderFile,    
} = require('../../../modules/extension.service');

chai.use(chaiSubset);
chai.use(chaiAsPromised);
chai.should();

describe('Extension.js', () => {
    suppressLogOutput(Extension);
    const tempDir = `${__dirname}/extension_temp`;
    // const codewindYamlPath = path.join(tempDir, 'codewind.yaml');
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
            createCodewindYamlFile(tempDir, COMPLETE_CODEWIND_YAML);
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
            before(() => {
                createCodewindYamlFile(tempDir);
            });
            it('leaves the templates field as null and does not add a templatesProvider field', async() => {
                const extension = new Extension({ path: tempDir });
                await extension.initialise();
                extension.should.have.property('templates', null);
                extension.should.not.have.property('templatesProvider');
            });
            after(() => {
                deleteCodewindYamlFile(tempDir);
            });
        });
        describe('templatesProvider.js exists', () => {
            before(() => {
                createCodewindYamlFile(tempDir);
                createTemplatesProviderFile(tempDir);
            });
            it('reads the templatesProvider.js file, requires it and can run the function given in it', async() => {
                const extension = new Extension({ path: tempDir });
                await extension.initialise();
                extension.should.have.property('templatesProvider');
                const templateProviderFunction = extension.templatesProvider.getRepositories;
                templateProviderFunction.should.be.a('function');
                templateProviderFunction().should.deep.equal([]);
            });
            after(() => {
                deleteCodewindYamlFile(tempDir);
                deleteTemplatesProviderFile(tempDir);
            }); 
        });
    });
});