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
const {
    styledTemplates,
    defaultTemplates,
    defaultRepoList,
} = require('../../modules/template.service');

chai.use(chaiAsPromised);
chai.should();
const testWorkspaceDir = './src/unit/temp/';
const testWorkspaceConfigDir = path.join(testWorkspaceDir, '.config/');

const sampleCodewindTemplate = styledTemplates.codewind;
const sampleAppsodyTemplate = styledTemplates.appsody;

const sampleRepos = {
    enabled: {
        url: '1',
        description: '1',
        enabled: true,
    },
    disabled: {
        url: '2',
        description: '2',
        enabled: false,
    },
    noEnabledStatus: {
        url: '3',
        description: '3',
    },
};
const sampleRepoList = Object.values(sampleRepos);

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
    describe('getAllTemplates()', function() {
        describe(`when we don't refresh`, function() {
            const sampleTemplateList = [sampleAppsodyTemplate];
            let templateController;
            before(() => {
                templateController = new Templates('');
                templateController.projectTemplates = sampleTemplateList;
                templateController.needsRefresh = false;
            });
            it('returns the templates we inserted', async function() {
                const output = await templateController.getAllTemplates();
                output.should.deep.equal(sampleTemplateList);
            });
        });
        describe(`when we do refresh`, function() {
            it('returns the default templates', async function() {
                const templateController = new Templates('');
                const output = await templateController.getAllTemplates();
                output.should.deep.equal(defaultTemplates);
            });
        });
    });
    describe('getTemplatesFromRepos(repositoryList)', function() {
        describe('(undefined)', function() {
            it('throws an error', function() {
                const templateController = new Templates('');
                const func = () => templateController.getTemplatesFromRepos();
                func().should.eventually.be.rejected;
            });
        });
        describe('([])', function() {
            it('returns no templates ([])', async function() {
                const templateController = new Templates('');
                const output = await templateController.getTemplatesFromRepos([]);
                output.should.deep.equal([]);
            });
        });
        describe('(<defaultRepoList>)', function() {
            describe('when we have no providers', function() {
                it('returns the default templates', async function() {
                    const templateController = new Templates('');
                    const output = await templateController.getTemplatesFromRepos(defaultRepoList);
                    output.should.deep.equal(defaultTemplates);
                });
            });
            describe(`when providers don't provide repo lists`, function() {
                let templateController;
                before(() => {
                    templateController = new Templates('');
                    templateController.addProvider('should provide array', {
                        getRepositories() { return 'should be array'; },
                    });
                });
                it('still returns the default templates (ignoring the invalid providers)', async function() {
                    const output = await templateController.getTemplatesFromRepos(defaultRepoList);
                    output.should.deep.equal(defaultTemplates);
                });
            });
            describe('when providers list invalid repos', function() {
                describe('wrong type', function() {
                    let templateController;
                    before(() => {
                        templateController = new Templates('');
                        templateController.addProvider('wrong type', {
                            getRepositories() { return ['should be object']; },
                        });
                    });
                    it('still returns the default templates (ignoring the invalid repos)', async function() {
                        const output = await templateController.getTemplatesFromRepos(defaultRepoList);
                        output.should.deep.equal(defaultTemplates);
                    });
                });
                describe('missing URL', function() {
                    let templateController;
                    before(() => {
                        templateController = new Templates('');
                        templateController.addProvider('missing URL', {
                            getRepositories() {
                                return [{ description: 'missing URL' }];
                            },
                        });
                    });
                    it('still returns the default templates (ignoring the invalid repos)', async function() {
                        const output = await templateController.getTemplatesFromRepos(defaultRepoList);
                        output.should.deep.equal(defaultTemplates);
                    });
                });
                describe('invalid URL', function() {
                    let templateController;
                    before(() => {
                        templateController = new Templates('');
                        templateController.addProvider('invalid URL', {
                            getRepositories() {
                                return [{
                                    description: 'invalid URL',
                                    url: 'invalid',
                                }];
                            },
                        });
                    });
                    it('still returns the default templates (ignoring the invalid repos)', async function() {
                        const output = await templateController.getTemplatesFromRepos(defaultRepoList);
                        output.should.deep.equal(defaultTemplates);
                    });
                });
                describe('duplicate URL', function() {
                    let templateController;
                    before(() => {
                        templateController = new Templates('');
                        templateController.addProvider('duplicate URL', {
                            getRepositories() {
                                return [{
                                    description: 'duplicate URL',
                                    url: templateController.repositoryList[0].url,
                                }];
                            },
                        });
                    });
                    it('still returns the default templates (ignoring the invalid repos)', async function() {
                        const output = await templateController.getTemplatesFromRepos(defaultRepoList);
                        output.should.deep.equal(defaultTemplates);
                    });
                });
            });
            describe('when providers list valid repos', function() {
                let templateController;
                before(() => {
                    templateController = new Templates('');
                    templateController.addProvider('valid repo', {
                        getRepositories() {
                            return [{
                                url: 'https://raw.githubusercontent.com/kabanero-io/codewind-templates/aad4bafc14e1a295fb8e462c20fe8627248609a3/devfiles/index.json',
                                description: 'valid repo',
                            }];
                        },
                    });
                });
                it(`returns the default templates and the provider's templates`, async function() {
                    const output = await templateController.getTemplatesFromRepos(defaultRepoList);
                    output.should.include.deep.members(defaultTemplates);
                    (output.length).should.be.above(defaultTemplates.length);
                });
            });
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
            output.should.deep.equal([sampleRepos.enabled, sampleRepos.noEnabledStatus]);
        });
    });
    describe('enableRepository(url)', function() {
        let templateController;
        beforeEach(() => {
            templateController = new Templates('');
            templateController.repositoryList = sampleRepoList;
        });
        describe('(existing url)', function() {
            it('enables the correct repo', function() {
                templateController.enableRepository('2');
                const expectedRepoDetails = {
                    url: '2',
                    description: '2',
                    enabled: true,
                };
                templateController.getRepositories().should.deep.include(expectedRepoDetails);
            });
        });
        describe('(non-existent url)', function() {
            it('throws a useful error', function() {
                const func = () => templateController.enableRepository('non-existent');
                func.should.throw(`no repository found with URL 'non-existent'`);
            });
        });
    });
    describe('disableRepository(url)', function() {
        let templateController;
        beforeEach(() => {
            templateController = new Templates('');
            templateController.repositoryList = sampleRepoList;
        });
        describe('(existing url)', function() {
            it('disables the correct repo', function() {
                templateController.disableRepository('1');
                const expectedRepoDetails = {
                    url: '1',
                    description: '1',
                    enabled: false,
                };
                templateController.getRepositories().should.deep.include(expectedRepoDetails);
            });
        });
        describe('(non-existent url)', function() {
            it('throws a useful error', function() {
                const func = () => templateController.disableRepository('non-existent');
                func.should.throw(`no repository found with URL 'non-existent'`);
            });
        });
    });
    describe('batchUpdate(requestedOperations)', function() {
        let templateController;
        beforeEach(() => {
            fs.ensureDirSync(testWorkspaceConfigDir);
            templateController = new Templates(testWorkspaceDir);
            templateController.repositoryList = sampleRepoList;
        });
        afterEach(() => {
            fs.removeSync(testWorkspaceDir);
        });
        describe('when the requested operations are all valid', function() {
            const tests = {
                'enable 2 existing repos': {
                    input: [
                        {
                            op: 'enable',
                            url: '1',
                            value: 'true',
                        },
                        {
                            op: 'enable',
                            url: '2',
                            value: 'true',
                        },
                    ],
                    output: [
                        {
                            status: 200,
                            requestedOperation: {
                                op: 'enable',
                                url: '1',
                                value: 'true',
                            },
                        },
                        {
                            status: 200,
                            requestedOperation: {
                                op: 'enable',
                                url: '2',
                                value: 'true',
                            },
                        },
                    ],
                    expectedRepoDetails: [
                        {
                            url: '1',
                            description: '1',
                            enabled: true,
                        },
                        {
                            url: '2',
                            description: '2',
                            enabled: true,
                        },
                    ],
                },
                'disable 2 existing repos': {
                    input: [
                        {
                            op: 'enable',
                            url: '1',
                            value: 'false',
                        },
                        {
                            op: 'enable',
                            url: '2',
                            value: 'false',
                        },
                    ],
                    output: [
                        {
                            status: 200,
                            requestedOperation: {
                                op: 'enable',
                                url: '1',
                                value: 'false',
                            },
                        },
                        {
                            status: 200,
                            requestedOperation: {
                                op: 'enable',
                                url: '2',
                                value: 'false',
                            },
                        },
                    ],
                    expectedRepoDetails: [
                        {
                            url: '1',
                            description: '1',
                            enabled: false,
                        },
                        {
                            url: '2',
                            description: '2',
                            enabled: false,
                        },
                    ],
                },
                'enable an unknown repo': {
                    input: [
                        {
                            op: 'enable',
                            url: '1',
                            value: 'false',
                        },
                        {
                            op: 'enable',
                            url: '2',
                            value: 'false',
                        },
                    ],
                    output: [
                        {
                            status: 200,
                            requestedOperation: {
                                op: 'enable',
                                url: '1',
                                value: 'false',
                            },
                        },
                        {
                            status: 200,
                            requestedOperation: {
                                op: 'enable',
                                url: '2',
                                value: 'false',
                            },
                        },
                    ],
                    expectedRepoDetails: [
                        {
                            url: '1',
                            description: '1',
                            enabled: false,
                        },
                        {
                            url: '2',
                            description: '2',
                            enabled: false,
                        },
                    ],
                },
                'enable an unknown repo': {
                    input: [
                        {
                            op: 'enable',
                            url: 'unknownRepoUrl',
                            value: 'true',
                        },
                    ],
                    output: [
                        {
                            status: 404,
                            error: 'Unknown repository URL',
                            requestedOperation: {
                                op: 'enable',
                                url: 'unknownRepoUrl',
                                value: 'true',
                            },
                        },
                    ],
                },
                'disable an unknown repo': {
                    input: [
                        {
                            op: 'enable',
                            url: 'unknownRepoUrl',
                            value: 'false',
                        },
                    ],
                    output: [
                        {
                            status: 404,
                            error: 'Unknown repository URL',
                            requestedOperation: {
                                op: 'enable',
                                url: 'unknownRepoUrl',
                                value: 'false',
                            },
                        },
                    ],
                },
                'disable an existing repo and an unknown repo': {
                    input: [
                        {
                            op: 'enable',
                            url: '1',
                            value: 'false',
                        },
                        {
                            op: 'enable',
                            url: 'unknownRepoUrl',
                            value: 'false',
                        },
                    ],
                    output: [
                        {
                            status: 200,
                            requestedOperation: {
                                op: 'enable',
                                url: '1',
                                value: 'false',
                            },
                        },
                        {
                            status: 404,
                            error: 'Unknown repository URL',
                            requestedOperation: {
                                op: 'enable',
                                url: 'unknownRepoUrl',
                                value: 'false',
                            },
                        },
                    ],
                    expectedRepoDetails: [
                        {
                            url: '1',
                            description: '1',
                            enabled: false,
                        },
                    ],
                },
            };
            for (const [testName, test] of Object.entries(tests)) {
                describe(testName, function() { // eslint-disable-line
                    it(`returns the expected operation info and correctly updates the repository file`, async function() {
                        const output = await templateController.batchUpdate(test.input);
                        output.should.deep.equal(test.output);

                        if (test.expectedRepoDetails) {
                            const repoFile = fs.readJsonSync(templateController.repositoryFile);
                            repoFile.should.include.deep.members(test.expectedRepoDetails);
                        }
                    });
                });
            }
        });
    });
    describe('performOperation(operation)', function() {
        let templateController;
        beforeEach(() => {
            templateController = new Templates('');
            templateController.repositoryList = sampleRepoList;
        });
        describe('when `operation.url` is an existing url', function() {
            const tests = {
                'enable an existing repo': {
                    input: {
                        op: 'enable',
                        url: '1',
                        value: 'true',
                    },
                    output: {
                        status: 200,
                        requestedOperation: {
                            op: 'enable',
                            url: '1',
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
                        url: '1',
                        value: 'false',
                    },
                    output: {
                        status: 200,
                        requestedOperation: {
                            op: 'enable',
                            url: '1',
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
                    it(`returns the expected operation info and correctly updates the repository file`, function() {
                        const output = templateController.performOperation(test.input);
                        output.should.deep.equal(test.output);
                    });
                });
            }
        });
        describe('when `operation.url` is an unknown url', function() {
            const tests = {
                'enable an unknown repo': {
                    input: {
                        op: 'enable',
                        url: 'unknownRepoUrl',
                        value: 'true',
                    },
                    output: {
                        status: 404,
                        error: 'Unknown repository URL',
                        requestedOperation: {
                            op: 'enable',
                            url: 'unknownRepoUrl',
                            value: 'true',
                        },
                    },
                },
                'disable an unknown repo': {
                    input: {
                        op: 'enable',
                        url: 'unknownRepoUrl',
                        value: 'false',
                    },
                    output: {
                        status: 404,
                        error: 'Unknown repository URL',
                        requestedOperation: {
                            op: 'enable',
                            url: 'unknownRepoUrl',
                            value: 'false',
                        },
                    },
                },
            };
            for (const [testName, test] of Object.entries(tests)) {
                describe(testName, function() { // eslint-disable-line
                    it(`returns the expected operation info`, function() {
                        const output = templateController.performOperation(test.input);
                        output.should.deep.equal(test.output);
                    });
                });
            }
        });
    });
    describe('addProvider(name, provider)', function() {
        describe('invalid args', function() {
            describe('(<name>, {})', function() {
                it('getTemplateList should ignore invalid template providers', function() {
                    const templateController = new Templates('');
                    const originalProviders = { ...templateController.providers };

                    templateController.addProvider('empty obj', {});

                    templateController.providers.should.deep.equal(originalProviders);
                });
            });
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
});
