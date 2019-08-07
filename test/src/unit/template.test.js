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
const chai = require('chai');
const chaiAsPromised = require('chai-as-promised');
const fs = require('fs-extra');
const path = require('path');

const Templates = require('../../../src/pfe/portal/modules/Templates');
const { styledTemplates } = require('../../modules/template.service');

chai.use(chaiAsPromised);
chai.should();
const testWorkspaceDir = './src/unit/temp/';
const testWorkspaceConfigDir = path.join(testWorkspaceDir, '.config/');

const sampleCodewindTemplate = styledTemplates.codewind;
const sampleAppsodyTemplate = styledTemplates.appsody;

const sampleRepoEnabled = {
    url: '1',
    description: '1',
    enabled: true,
};
const sampleRepoDisabled = {
    url: '2',
    description: '2',
    enabled: false,
};
const sampleRepoNoEnabledStatus = {
    url: '3',
    description: '3',
};
const sampleRepoList = [
    sampleRepoEnabled,
    sampleRepoDisabled,
    sampleRepoNoEnabledStatus,
];

describe('Templates.js', function() {
    describe('getTemplateStyles() when Codewind is aware of:', function() {
        describe('Codewind and Appsody templates', function() {
            const sampleTemplateList = [
                sampleCodewindTemplate,
                sampleAppsodyTemplate,
            ];
            let templateController;
            before(() => {
                templateController = new Templates('');
                templateController.projectTemplates = sampleTemplateList;
                templateController.needsRefresh = false;
            });
            it(`returns ['Codewind', 'Appsody']`, async function() {
                const output = await templateController.getTemplateStyles();
                output.should.deep.equal(['Codewind', 'Appsody']);
            });
        });
        describe('only Codewind templates', function() {
            const sampleTemplateList = [sampleCodewindTemplate];
            let templateController;
            before(() => {
                templateController = new Templates('');
                templateController.projectTemplates = sampleTemplateList;
                templateController.needsRefresh = false;
            });
            it(`returns ['Codewind']`, async function() {
                const output = await templateController.getTemplateStyles();
                output.should.deep.equal(['Codewind']);
            });
        });
        describe('only Appsody templates', function() {
            const sampleTemplateList = [sampleAppsodyTemplate];
            let templateController;
            before(() => {
                templateController = new Templates('');
                templateController.projectTemplates = sampleTemplateList;
                templateController.needsRefresh = false;
            });
            it(`returns ['Appsody']`, async function() {
                const output = await templateController.getTemplateStyles();
                output.should.deep.equal(['Appsody']);
            });
        });
    });
    describe('getTemplateList()', function() {
        const sampleTemplateList = [
            sampleCodewindTemplate,
            sampleAppsodyTemplate,
        ];
        let templateController;
        before(() => {
            templateController = new Templates('');
            templateController.projectTemplates = sampleTemplateList;
            templateController.needsRefresh = false;
        });
        it('returns an array of all templates', async function() {
            const output = await templateController.getTemplateList();
            output.should.deep.equal(sampleTemplateList);
        });
    });
    describe('getRepositories()', function() {
        let templateController;
        before(() => {
            templateController = new Templates('');
            templateController.repositoryList = sampleRepoList;
            templateController.needsRefresh = false;
        });
        it('returns all repos', function() {
            const output = templateController.getRepositories();
            output.should.deep.equal(sampleRepoList);
        });
    });
    describe('getEnabledRepositories()', function() {
        let templateController;
        before(() => {
            templateController = new Templates('');
            templateController.repositoryList = sampleRepoList;
            templateController.needsRefresh = false;
        });
        it('returns only enabled repos', function() {
            const output = templateController.getEnabledRepositories();
            output.should.deep.equal([sampleRepoEnabled, sampleRepoNoEnabledStatus]);
        });
    });
    describe('enableRepository(url)', function() {
        let templateController;
        beforeEach(() => {
            fs.ensureDirSync(testWorkspaceConfigDir);
            templateController = new Templates(testWorkspaceDir);
            templateController.repositoryList = sampleRepoList;
            templateController.needsRefresh = false;
        });
        afterEach(() => {
            fs.removeSync(testWorkspaceDir);
        });
        describe('(existing url)', function() {
            it('enables the correct repo', async function() {
                const expectedRepoDetails = {
                    url: '2',
                    description: '2',
                    enabled: true,
                };
                await templateController.enableRepository('2');
                templateController.getRepositories().should.deep.include(expectedRepoDetails);

                const repoFile = fs.readJsonSync(templateController.repositoryFile);
                repoFile.should.deep.include(expectedRepoDetails);
            });
        });
        describe('(non-existent url)', function() {
            it('throws a useful error', function() {
                const func = () => templateController.enableRepository('non-existent');
                func().should.eventually.be.rejectedWith(`no repository found with URL 'non-existent'`);
            });
        });
    });
    describe('disableRepository(url)', function() {
        let templateController;
        beforeEach(() => {
            fs.ensureDirSync(testWorkspaceConfigDir);
            templateController = new Templates(testWorkspaceDir);
            templateController.repositoryList = sampleRepoList;
            templateController.needsRefresh = false;
        });
        afterEach(() => {
            fs.removeSync(testWorkspaceDir);
        });
        describe('(existing url)', function() {
            it('disables the correct repo', async function() {
                await templateController.disableRepository('1');

                const expectedRepoDetails = {
                    url: '1',
                    description: '1',
                    enabled: false,
                };
                templateController.getRepositories().should.deep.include(expectedRepoDetails);

                const repoFile = fs.readJsonSync(templateController.repositoryFile);
                repoFile.should.deep.include(expectedRepoDetails);
            });
        });
        describe('(non-existent url)', function() {
            it('throws a useful error', function() {
                const func = () => templateController.disableRepository('non-existent');
                func().should.eventually.be.rejectedWith(`no repository found with URL 'non-existent'`);
            });
        });
    });
    describe('performOperation(operation)', function() {
        let templateController;
        beforeEach(() => {
            fs.ensureDirSync(testWorkspaceConfigDir);
            templateController = new Templates(testWorkspaceDir);
            templateController.repositoryList = sampleRepoList;
            templateController.needsRefresh = false;
        });
        afterEach(() => {
            fs.removeSync(testWorkspaceDir);
        });
        describe('when `operation.path` is an existing url', function() {
            const tests = {
                'enable an existing repo': {
                    input: {
                        op: 'enable',
                        path: '1',
                        value: 'true',
                    },
                    output: {
                        status: 200,
                        requestedOperation: {
                            op: 'enable',
                            path: '1',
                            value: 'true',
                        },
                    },
                    expectedRepoDetails: {
                        url: '1',
                        description: '1',
                        enabled: true,
                    },
                },
                'disable an existing repo': {
                    input: {
                        op: 'enable',
                        path: '1',
                        value: 'false',
                    },
                    output: {
                        status: 200,
                        requestedOperation: {
                            op: 'enable',
                            path: '1',
                            value: 'false',
                        },
                    },
                    expectedRepoDetails: {
                        url: '1',
                        description: '1',
                        enabled: false,
                    },
                },
            };
            for (const [testName, test] of Object.entries(tests)) {
                describe(testName, function() { // eslint-disable-line
                    it(`returns the expected operation info`, async function() {
                        const output = await templateController.performOperation(test.input);
                        output.should.deep.equal(test.output);

                        const repoFile = fs.readJsonSync(templateController.repositoryFile);
                        repoFile.should.deep.include(test.expectedRepoDetails);
                    });
                });
            }
        });
        describe('when `operation.path` is an unknown url', function() {
            const tests = {
                'enable an unknown repo': {
                    input: {
                        op: 'enable',
                        path: 'unknownRepoUrl',
                        value: 'true',
                    },
                    output: {
                        status: 404,
                        error: 'Unknown repository URL',
                        requestedOperation: {
                            op: 'enable',
                            path: 'unknownRepoUrl',
                            value: 'true',
                        },
                    },
                },
                'disable an unknown repo': {
                    input: {
                        op: 'enable',
                        path: 'unknownRepoUrl',
                        value: 'false',
                    },
                    output: {
                        status: 404,
                        error: 'Unknown repository URL',
                        requestedOperation: {
                            op: 'enable',
                            path: 'unknownRepoUrl',
                            value: 'false',
                        },
                    },
                },
            };
            for (const [testName, test] of Object.entries(tests)) {
                describe(testName, function() { // eslint-disable-line
                    it(`returns the expected operation info`, async function() {
                        const output = await templateController.performOperation(test.input);
                        output.should.deep.equal(test.output);
                    });
                });
            }
        });
    });
    describe('filterTemplatesByStyle(templates, projectStyle)', function() {
        const templates = [sampleCodewindTemplate, sampleAppsodyTemplate];
        describe(`projectStyle='Codewind'`, function() {
            it('returns only Codewind templates', function() {
                const output = Templates.filterTemplatesByStyle(templates, 'Codewind');
                output.should.deep.equal([sampleCodewindTemplate]);
            });
        });
        describe(`projectStyle='Appsody'`, function() {
            it('returns only Appsody templates', function() {
                const output = Templates.filterTemplatesByStyle(templates, 'Appsody');
                output.should.deep.equal([sampleAppsodyTemplate]);
            });
        });
    });
    describe('template provider tests', function() {

        let templates;
        let expected;

        before(async function() {
            
            const { WORKSPACE_DIR } = require('../../config');
            templates = new Templates(WORKSPACE_DIR);

            await templates.initializeRepositoryList();
            expected = (await templates.getTemplateList()).length;
        });

        it('getTemplateList should ignore invalid template providers', async function() {

            // null provider is ignored
            templates.addProvider('null', null);

            // empty provider is ignored (no getRepositories function)
            templates.addProvider('empty', {});

            const list = await templates.getTemplateList();
            list.length.should.equal(expected);
        });

        it('getTemplateList should ignore invalid or duplicate repository entries from template provider', async function() {

            // add a template provider that returns the wrong type
            templates.addProvider('invalid_provider1', {
                getRepositories: async function() {
                    return 'wrong type';
                }
            });

            // add a template provider that contains invalid or duplicate entries
            templates.addProvider('invalid_provider2', {
                getRepositories: async function() {
                    return [
                        'wrong type',
                        { description: 'missing url'},
                        {
                            url: 'https://raw.githubusercontent.com/kabanero-io/codewind-templates/master/devfiles/index.json',
                            description: 'duplicate repo'
                        }
                    ];
                }
            });

            const list = await templates.getTemplateList();
            list.length.should.equal(expected);
        });

        it('getTemplateList should include additional templates from template provider', async function() {

            // add a template provider that returns a valid entry
            templates.addProvider('valid_provider', {
                getRepositories: async function() {
                    return [
                        {
                            url: 'https://raw.githubusercontent.com/kabanero-io/codewind-templates/aad4bafc14e1a295fb8e462c20fe8627248609a3/devfiles/index.json',
                            description: 'valid repo'
                        }
                    ];
                }
            });

            const list = await templates.getTemplateList();
            list.length.should.be.above(expected);
        });
    });
});
