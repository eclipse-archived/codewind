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
    sampleRepos,
} = require('../../modules/template.service');

chai.use(chaiAsPromised);
chai.should();
const testWorkspaceDir = './src/unit/temp/';
const testWorkspaceConfigDir = path.join(testWorkspaceDir, '.config/');

const sampleCodewindTemplate = styledTemplates.codewind;
const sampleAppsodyTemplate = styledTemplates.appsody;

const mockRepos = {
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
const mockRepoList = Object.values(mockRepos);

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
            describe('', function() {
                it('returns the default templates', async function() {
                    const templateController = new Templates('');
                    const output = await templateController.getAllTemplates();
                    output.should.deep.equal(defaultTemplates);
                });
            });
            describe('and add an extra template repo', function() {
                let templateController;
                before(() => {
                    templateController = new Templates('');
                    templateController.repositoryList = [
                        sampleRepos.default,
                        sampleRepos.appsody,
                    ];
                });
                it('returns more templates', async function() {
                    const output = await templateController.getAllTemplates();
                    output.should.include.deep.members(defaultTemplates);
                    (output.length).should.be.above(defaultTemplates.length);
                });
            });
            describe('and add an extra bad template repo', function() {
                let templateController;
                before(() => {
                    templateController = new Templates('');
                    templateController.repositoryList = [
                        sampleRepos.default,
                        { url: 'https://www.google.com/' },
                    ];
                });
                it('returns only the default templates', async function() {
                    const output = await templateController.getAllTemplates();
                    output.should.deep.equal(defaultTemplates);
                });
            });
        });
    });
    describe('getReposFromProviders(providers)', function() {
        const tests = {
            'invalid provider: string': {
                input: ['string'],
                output: [],
            },
            'invalid provider: empty obj': {
                input: [{}],
                output: [],
            },
            'provider provides non-array': {
                input: [{
                    getRepositories() {
                        return 'should be array';
                    },
                }],
                output: [],
            },
            'provider provides a repo with URL': {
                input: [{
                    getRepositories() {
                        return [{
                            url: 'https://www.google.com/',
                            description: 'not a GitHub repo',
                        }];
                    },
                }],
                output: [{
                    url: 'https://www.google.com/',
                    description: 'not a GitHub repo',
                }],
            },
        };
        for (const [testName, test] of Object.entries(tests)) {
            describe(testName, function() { // eslint-disable-line
                it(`returns the expected repos`, async function() {
                    const output = await Templates.getReposFromProviders(test.input);
                    output.should.deep.equal(test.output);
                });
            });
        }
    });
    describe('getTemplatesFromRepo(repository)', function() {
        describe('(<validRepository>)', function() {
            it('returns the correct templates', async function() {
                const output = await Templates.getTemplatesFromRepo(defaultRepoList[0]);
                output.should.have.deep.members(defaultTemplates);
            });
        });
        describe('(<invalidRepository>)', function() {
            describe('string', function() {
                it('throws a useful error', function() {
                    const func = () => Templates.getTemplatesFromRepo('string');
                    return func().should.be.rejectedWith(`repo 'string' must have a URL`);
                });
            });
            describe('invalid URL', function() {
                it('throws a useful error', function() {
                    const func = () => Templates.getTemplatesFromRepo({ url: 'invalidURL' });
                    return func().should.be.rejectedWith('Invalid URL');
                });
            });
            describe(`valid URL that doesn't provide JSON`, function() {
                it('throws a useful error', function() {
                    const func = () => Templates.getTemplatesFromRepo({ url: 'https://www.google.com/' });
                    return func().should.be.rejectedWith(`URL 'https://www.google.com/' should return JSON`);
                });
            });
        });
    });
    describe('getTemplatesFromRepos(repositoryList)', function() {
        describe('(undefined)', function() {
            it('throws an error', function() {
                const templateController = new Templates('');
                const func = () => templateController.getTemplatesFromRepos();
                return func().should.be.rejected;
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
                describe(`valid URL that doesn't provide JSON`, function() {
                    let templateController;
                    before(() => {
                        templateController = new Templates('');
                        templateController.addProvider(`doesn't provide JSON`, {
                            getRepositories() {
                                return [{
                                    url: 'https://www.google.com/',
                                    description: `doesn't provide JSON`,
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
    describe('addRepository(repoUrl, repoDescription)', function() {
        let templateController;
        beforeEach(() => {
            fs.ensureDirSync(testWorkspaceConfigDir);
            templateController = new Templates(testWorkspaceDir);
            templateController.repositoryList = [...mockRepoList];
        });
        afterEach(() => {
            fs.removeSync(testWorkspaceDir);
        });
        describe('(<existingUrl>, <validDesc>)', function() {
            it('throws an error', function() {
                const { url, description } = mockRepoList[0];
                const func = () => templateController.addRepository(url, description);
                return func().should.be.rejectedWith(`${1} is not a unique URL. Repository URLs must be unique`);
            });
        });
        describe('(<uniqueString>, <validDesc>)', function() {
            it('succeeds', function() {
                const func = () => templateController.addRepository('unique string', 'description');
                return func().should.not.be.rejected;
            });
        });
    });
    describe('getRepositories()', function() {
        let templateController;
        before(() => {
            templateController = new Templates('');
            templateController.repositoryList = [...mockRepoList];
        });
        it('returns all repos', function() {
            const output = templateController.getRepositories();
            output.should.deep.equal(mockRepoList);
        });
    });
    describe('getEnabledRepositories()', function() {
        let templateController;
        before(() => {
            templateController = new Templates('');
            templateController.repositoryList = [...mockRepoList];
        });
        it('returns only enabled repos', function() {
            const output = templateController.getEnabledRepositories();
            output.should.deep.equal([mockRepos.enabled, mockRepos.noEnabledStatus]);
        });
    });
    describe('enableRepository(url)', function() {
        let templateController;
        beforeEach(() => {
            templateController = new Templates('');
            templateController.repositoryList = [...mockRepoList];
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
            templateController.repositoryList = [...mockRepoList];
        });
        describe('(existing url)', function() {
            it('disables the correct repo', function() {
                const repo = { ...templateController.repositoryList[0] };
                templateController.disableRepository(repo.url);
                const expectedRepoDetails = {
                    ...repo,
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
            templateController.repositoryList = [...mockRepoList];
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
            templateController.repositoryList = [...mockRepoList];
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
            describe('invalid provider type', function() {
                describe('empty object', function() {
                    it('ignores the invalid provider', function() {
                        const templateController = new Templates('');
                        const originalProviders = { ...templateController.providers };

                        templateController.addProvider('empty obj', {});

                        templateController.providers.should.deep.equal(originalProviders);
                    });
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
