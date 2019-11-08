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
const chaiSubset = require('chai-subset');
const fs = require('fs-extra');
const path = require('path');
const rewire = require('rewire');

global.codewind = { RUNNING_IN_K8S: false };

const Templates = rewire('../../../src/pfe/portal/modules/Templates');
const {
    styledTemplates,
    defaultCodewindTemplates,
    defaultKabaneroTemplates,
    sampleRepos,
    validUrlNotPointingToIndexJson,
} = require('../../modules/template.service');
const { suppressLogOutput } = require('../../modules/log.service');

chai.use(chaiAsPromised);
chai.use(chaiSubset);
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
    suppressLogOutput(Templates);
    describe('getAllTemplateStyles() when Codewind is aware of:', function() {
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
                const output = await templateController.getAllTemplateStyles();
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
                const output = await templateController.getAllTemplateStyles();
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
                const output = await templateController.getAllTemplateStyles();
                output.should.deep.equal(['Appsody']);
            });
        });
    });
    describe('getAllTemplates()', function() {
        describe('', function() {
            it('returns the default templates', async function() {
                this.timeout(30000);
                const templateController = new Templates('');
                const output = await templateController.getAllTemplates();
                output.should.have.deep.members([
                    ...defaultCodewindTemplates,
                    ...defaultKabaneroTemplates,
                ]);
            });
        });
        describe('and add an extra template repo', function() {
            let templateController;
            before(() => {
                templateController = new Templates('');
                templateController.repositoryList = [
                    sampleRepos.codewind,
                    sampleRepos.appsody,
                ];
            });
            it('returns more templates', async function() {
                this.timeout(30000);
                const output = await templateController.getAllTemplates();
                output.should.include.deep.members(defaultCodewindTemplates);
                (output.length).should.be.above(defaultCodewindTemplates.length);
            });
        });
        describe('and add an extra bad template repo', function() {
            let templateController;
            before(() => {
                templateController = new Templates('');
                templateController.repositoryList = [
                    sampleRepos.codewind,
                    { url: 'https://www.google.com/' },
                ];
            });
            it('returns only the default templates', async function() {
                const output = await templateController.getAllTemplates();
                output.should.deep.equal(defaultCodewindTemplates);
            });
        });
        describe('and add a provider providing a valid template repo', function() {
            let templateController;
            before(async() => {
                fs.ensureDirSync(testWorkspaceConfigDir);
                templateController = new Templates(testWorkspaceDir);
                await templateController.writeRepositoryList();
                templateController.addProvider('valid repo', {
                    getRepositories() {
                        return [sampleRepos.appsody];
                    },
                });
            });
            after(() => {
                fs.removeSync(testWorkspaceDir);
            });
            it('returns the default templates and more', async function() {
                this.timeout = 10000;
                const output = await templateController.getAllTemplates();
                output.should.include.deep.members(defaultCodewindTemplates);
                (output.length).should.be.above(defaultCodewindTemplates.length);
            });
        });
    });
    describe('updateRepoListWithReposFromProviders()', function() {
        describe('when providers do not provide valid repos', function() {
            const tests = {
                'invalid provider: string': {
                    provider: 'string',
                },
                'invalid provider: empty obj': {
                    provider: {},
                },
                'provider provides non-array': {
                    provider: {
                        getRepositories() {
                            return 'should be array';
                        },
                    },
                },
                'provider provides array of non-repo objects': {
                    provider: {
                        getRepositories() {
                            return ['should be repo object'];
                        },
                    },
                },
                'provider provides array of objects missing URLs': {
                    provider: {
                        getRepositories() {
                            return [{ description: 'missing URL' }];
                        },
                    },
                },
                'provider provides a duplicate repo': {
                    provider: {
                        getRepositories() {
                            return [{
                                description: 'duplicate URL',
                                url: mockRepoList[0].url,
                            }];
                        },
                    },
                },
            };
            for (const [testName, test] of Object.entries(tests)) {
                describe(testName, function() { // eslint-disable-line no-loop-func
                    let templateController;
                    before(async() => {
                        fs.ensureDirSync(testWorkspaceConfigDir);
                        templateController = new Templates(testWorkspaceDir);
                        templateController.repositoryList = [...mockRepoList];
                        await templateController.writeRepositoryList();
                        templateController.addProvider(testName, test.provider);
                    });
                    after(() => {
                        fs.removeSync(testWorkspaceDir);
                    });
                    it(`does not update the repository_list.json`, async function() {
                        await templateController.updateRepoListWithReposFromProviders();
                        const repoFile = fs.readJsonSync(templateController.repositoryFile);
                        repoFile.should.deep.equal(mockRepoList);
                    });
                });
            }
        });
        describe('when providers list valid repos', function() {
            let templateController;
            const validCodewindRepo = {
                url: 'https://raw.githubusercontent.com/codewind-resources/codewind-templates/3af4928a928a5c08b07908c54799cc1675b9f965/devfiles/index.json',
                description: 'The default set of templates for new projects in Codewind.',
            };
            before(() => {
                fs.ensureDirSync(testWorkspaceConfigDir);
                templateController = new Templates(testWorkspaceDir);
                templateController.repositoryList = [...mockRepoList];
                templateController.addProvider('valid Codewind repo', {
                    getRepositories() {
                        return [validCodewindRepo];
                    },
                });
            });
            after(() => {
                fs.removeSync(testWorkspaceDir);
            });
            it(`updates the repository_list.json correctly`, async function() {
                const expectedRepo = {
                    ...validCodewindRepo,
                    enabled: true,
                    protected: true,
                    name: 'Default templates',
                    projectStyles: ['Codewind'],
                };
                await templateController.updateRepoListWithReposFromProviders();
                const repoFile = fs.readJsonSync(templateController.repositoryFile);
                repoFile.should.deep.equal([
                    ...mockRepoList,
                    expectedRepo,
                ]);
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
            describe(testName, function() {
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
                const output = await Templates.getTemplatesFromRepo(sampleRepos.codewind);
                output.should.have.deep.members(defaultCodewindTemplates);
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
        describe('([<defaultCodewindRepo>])', function() {
            it('returns the default Codewind templates', async function() {
                const templateController = new Templates('');
                const output = await templateController.getTemplatesFromRepos([sampleRepos.codewind]);
                output.should.deep.equal(defaultCodewindTemplates);
            });
        });
    });
    describe('addRepository(repoUrl, repoDescription)', function() {
        const mockRepoList = [{ id: 'notanid', url: 'https://made.up/url' }];
        let templateController;
        beforeEach(() => {
            fs.ensureDirSync(testWorkspaceConfigDir);
            templateController = new Templates(testWorkspaceDir);
            templateController.repositoryList = [...mockRepoList];
        });
        afterEach(() => {
            fs.removeSync(testWorkspaceDir);
        });
        describe('repo without name and description in templates.json', () => {
            describe('(<invalidUrl>, <validDesc>)', function() {
                it('throws an error', function() {
                    const url = 'some string';
                    const func = () => templateController.addRepository(url, 'description');
                    return func().should.be.rejectedWith(`Invalid URL: ${url}`);
                });
            });
            describe('(<existingUrl>, <validDesc>)', function() {
                it('throws an error', function() {
                    const { url } = mockRepoList[0];
                    const func = () => templateController.addRepository(url, 'description');
                    return func().should.be.rejectedWith(`${url} is already a template repository`);
                });
            });
            describe('(<validUrlNotPointingToIndexJson>, <validDesc>)', function() {
                it('throws an error', function() {
                    const url = validUrlNotPointingToIndexJson;
                    const func = () => templateController.addRepository(url, 'description');
                    return func().should.be.rejectedWith(`${url} does not point to a JSON file of the correct form`);
                });
            });
            describe('(<validUrlPointingToIndexJson>, <validDesc>, <validName>)', function() {
                it('succeeds', async function() {
                    const url = 'https://raw.githubusercontent.com/codewind-resources/codewind-templates/3af4928a928a5c08b07908c54799cc1675b9f965/devfiles/index.json';
                    const func = () => templateController.addRepository(url, 'description', 'name');
                    await (func().should.not.be.rejected);
                    templateController.repositoryList.should.containSubset([{
                        url,
                        name: 'name',
                        description: 'description',
                        enabled: true,
                        projectStyles: ['Codewind'],
                    }]);
                    templateController.repositoryList.forEach(obj => {
                        obj.should.have.property('id');
                        obj.id.should.be.a('string');
                    });
                });
            });
            describe('(<validUrlUnprotected>, <validDesc>, <validName>)', function() {
                it('succeeds', async function() {
                    const url = 'https://raw.githubusercontent.com/codewind-resources/codewind-templates/3af4928a928a5c08b07908c54799cc1675b9f965/devfiles/index.json';
                    const isRepoProtected = false;
                    const func = () => templateController.addRepository(url, 'description', 'name', isRepoProtected);
                    await (func().should.not.be.rejected);
                    templateController.repositoryList.should.containSubset([{
                        url,
                        name: 'name',
                        description: 'description',
                        enabled: true,
                        projectStyles: ['Codewind'],
                        protected: false,
                    }]);
                    templateController.repositoryList.forEach(obj => {
                        obj.should.have.property('id');
                        obj.id.should.be.a('string');
                    });
                });
            });
        });
        describe('repo with name and description in templates.json', () => {
            describe('(<validUrl>, <ValidDesc>, <ValidName>)', function() {
                it('succeeds, and allows the user to set the name and description', async function() {
                    const url = 'https://raw.githubusercontent.com/codewind-resources/codewind-templates/master/devfiles/index.json';
                    const func = () => templateController.addRepository(url, 'description', 'name', false);
                    await (func().should.not.be.rejected);
                    templateController.repositoryList.should.containSubset([{ ...sampleRepos.codewind,
                        name: 'name',
                        description: 'description',
                        protected: false,
                    }]);
                });
            });
            describe('(repo with templates.json, <validUrl>, <NoDesc>, <NoName>)', function() {
                it('succeeds, and gets the name and description from templates.json', async function() {
                    const url = 'https://raw.githubusercontent.com/codewind-resources/codewind-templates/master/devfiles/index.json';
                    const func = () => templateController.addRepository(url, '', '', false);
                    await (func().should.not.be.rejected);
                    templateController.repositoryList.should.containSubset([{ ...sampleRepos.codewind, protected: false }]);
                });
            });
        });
    });
    describe('deleteRepository(repoUrl)', function() {
        const mockRepoList = [sampleRepos.fromAppsodyExtension];
        let templateController;
        beforeEach(() => {
            fs.ensureDirSync(testWorkspaceConfigDir);
            templateController = new Templates(testWorkspaceDir);
            templateController.repositoryList = [...mockRepoList];
        });
        afterEach(() => {
            fs.removeSync(testWorkspaceDir);
        });
        describe('(<existingUrl>)', function() {
            it('updates the repository_list.json correctly', async function() {
                const url = mockRepoList[0].url;
                await templateController.deleteRepository(url);
                templateController.repositoryList.should.deep.equal([]);
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
    describe('getTemplateStyles()', function() {
        it('returns Codewind by default', function() {
            const output = Templates.getTemplateStyles([mockRepos.enabled]);
            output.should.deep.equal(['Codewind']);
        });
    });
    describe('getEnabledRepositories()', function() {
        let templateController;
        before(() => {
            templateController = new Templates('');
            templateController.repositoryList = [mockRepos.enabled, mockRepos.disabled];
        });
        it('returns only enabled repos', function() {
            const output = templateController.getEnabledRepositories();
            output.should.deep.equal([mockRepos.enabled]);
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
                templateController.enableRepository(mockRepos.disabled.url);
                const expectedRepoDetails = {
                    ...mockRepos.disabled,
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
                describe(testName, function() { // eslint-disable-line no-loop-func
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
                describe(testName, function() { // eslint-disable-line no-loop-func
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
                describe(testName, function() { // eslint-disable-line no-loop-func
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

    describe('fetchAllRepositoryDetails(repos)', function() {
        const tests = {
            '1 repo containing only Codewind templates': {
                input: [sampleRepos.codewind],
                output: [{
                    ...sampleRepos.codewind,
                    projectStyles: ['Codewind'],
                }],
            },
            '1 repo containing only Appsody templates': {
                // We don't use `sampleRepos.appsody` here because for some reason it was being modified by a previous test
                // We should prevent decoupling systematically, by deep cloning `sampleRepos` whenever it is used
                input: [{
                    url: 'https://raw.githubusercontent.com/kabanero-io/codewind-appsody-templates/master/devfiles/index.json',
                    description: 'Appsody extension for Codewind',
                    enabled: true,
                }],
                output: [{
                    url: 'https://raw.githubusercontent.com/kabanero-io/codewind-appsody-templates/master/devfiles/index.json',
                    description: 'Appsody extension for Codewind',
                    enabled: true,
                    projectStyles: ['Appsody'],
                }],
            },
        };
        for (const [testName, test] of Object.entries(tests)) {
            describe(testName, function() { // eslint-disable-line no-loop-func
                it(`returns the expected operation info`, async function() {
                    const output = await Templates.fetchAllRepositoryDetails(test.input);
                    output.should.deep.equal(test.output);
                });
            });
        }
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
