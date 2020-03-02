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
const assert = require('assert');

global.codewind = { RUNNING_IN_K8S: false };

const Templates = rewire('../../../src/pfe/portal/modules/Templates');
const TemplateError = require('../../../src/pfe/portal/modules/utils/errors/TemplateError');
const {
    styledTemplates,
    defaultCodewindTemplates,
    sampleRepos,
    validUrlNotPointingToIndexJson,
    templateRepositoryURL,
} = require('../../modules/template.service');
const { suppressLogOutput } = require('../../modules/log.service');
const { testTimeout } = require('../../config');

chai.use(chaiAsPromised);
chai.use(chaiSubset);
chai.should();
const should = chai.should();

const testWorkspaceDir = path.join(__dirname, '/templateTestTemp/');
const testWorkspaceConfigDir = path.join(testWorkspaceDir, '.config/');
const testRepositoryFile = path.join(testWorkspaceConfigDir, 'repository_list.json');

const sampleCodewindTemplate = styledTemplates.codewind;
const sampleAppsodyTemplate = styledTemplates.appsody;

const mockRepos = {
    enabled: {
        id: '1',
        url: '1',
        description: '1',
        enabled: true,
    },
    disabled: {
        id: '2',
        url: '2',
        description: '2',
        enabled: false,
    },
    noEnabledStatus: {
        id: '3',
        url: '3',
        description: '3',
    },
    noID: {
        url: '4',
        description: '4',
        enabled: true,
    },
    withOnlyName: {
        name: '5',
    },
};
const mockRepoList = Object.values(mockRepos);

const checkTemplateError = (err, expectedCode) => {
    const { name, code } = err;
    name.should.equal('TemplateError');
    code.should.equal(expectedCode);
};

function getWorkspaceAndDeleteAfterEach(testFolderName) {
    const workspace = path.join(testWorkspaceDir, testFolderName);
    afterEach(() => {
        fs.removeSync(workspace);
    });
    return workspace;
};

describe('Templates.js', function() {
    // Set the default timeout for all tests
    this.timeout(testTimeout.short);
    suppressLogOutput(Templates);
    describe('Class functions', function() {
        describe('initializeRepositoryList()', function() {
            const workspace = getWorkspaceAndDeleteAfterEach(this.title);
            const customRepoFile = path.join(workspace, 'custom_repo_file.json');
            beforeEach(() => {
                fs.ensureDirSync(workspace);
                fs.ensureFileSync(customRepoFile);
                fs.writeJSONSync(customRepoFile, [ sampleRepos.codewind ]);
            });
            afterEach(() => {
                fs.removeSync(workspace);
            });
            it('initializes a Templates Class and creates a repository file', async function() {
                const templateController = new Templates(workspace);
                const existsPre = await fs.pathExists(templateController.repositoryFile);
                existsPre.should.be.false;

                await templateController.initializeRepositoryList();

                templateController.repositoryList.length.should.equal(2);
                const existsPost = await fs.pathExists(templateController.repositoryFile);
                existsPost.should.be.true;
            });
            it('reads an existing repository list file', async function() {
                const templateController = new Templates(workspace);
                templateController.repositoryFile = customRepoFile;

                await templateController.initializeRepositoryList();

                const { repositoryFile, repositoryList } = templateController;
                const contents = await fs.readJson(repositoryFile);
                contents.should.deep.equal([sampleRepos.codewind]);
                repositoryList.should.deep.equal([sampleRepos.codewind]);
            });
        });
        describe('lock()', function() {
            const workspace = getWorkspaceAndDeleteAfterEach(this.title);
            it('should update the value of _lock to be true', () => {
                const templateController = new Templates(workspace);
                templateController._lock = false;
                templateController.lock();
                templateController._lock.should.be.true;
            });
            it('should throw an error if the value of _lock is already true', () => {
                const templateController = new Templates(workspace);
                templateController._lock = true;
                const error = new TemplateError('LOCKED');
                assert.throws(() => templateController.lock(), error);
            });
        });
        describe('unlock()', function() {
            const workspace = getWorkspaceAndDeleteAfterEach(this.title);
            it('should update the value of _lock to be false', () => {
                const templateController = new Templates(workspace);
                templateController._lock = true;
                templateController.unlock();
                templateController._lock.should.be.false;
            });
        });
        describe('getTemplates(showEnabledOnly)', function() {
            const workspace = getWorkspaceAndDeleteAfterEach(this.title);
            it('Gets all templates', async function() {
                const templateController = new Templates(workspace);
                await templateController.initializeRepositoryList();
                const templateList = templateController.getTemplates(false);
                templateList.length.should.be.at.least(defaultCodewindTemplates.length);
            });
            it('gets only enabled templates', async function() {
                const templateController = new Templates(workspace);
                const { repositoryList } = templateController;
                for (const repository of repositoryList) {
                    repository.enabled = false;
                    repository.enabled.should.be.false;
                }
                await templateController.initializeRepositoryList();
                const templateList = await templateController.getTemplates(true);
                templateList.length.should.equal(0);
            });
            it('gets all templates after enabled templates', async function() {
                const templateController = new Templates(workspace);
                const { repositoryList } = templateController;
                for (const repository of repositoryList) {
                    repository.enabled = false;
                    repository.enabled.should.be.false;
                }
                await templateController.initializeRepositoryList();
                const enabledTemplateList = await templateController.getTemplates(true);
                enabledTemplateList.length.should.equal(0);
                const templateList = await templateController.getTemplates(false);
                templateList.length.should.be.at.least(defaultCodewindTemplates.length);
            });
            it('gets enabled templates after all templates', async function() {
                const templateController = new Templates(workspace);
                await templateController.initializeRepositoryList();
                const templateList = await templateController.getTemplates(false);
                templateList.length.should.be.at.least(defaultCodewindTemplates.length);
                const { repositoryList } = templateController;
                for (const repository of repositoryList) {
                    repository.enabled = false;
                    repository.enabled.should.be.false;
                }
                await templateController.initializeRepositoryList();
                const enabledTemplateList = await templateController.getTemplates(true);
                enabledTemplateList.length.should.equal(0);
            });
            describe('verifies the Codewind default templates are there and all others contain the required keys', function() {
                it('returns the default templates', async function() {
                    this.timeout(testTimeout.med);
                    const templateController = new Templates(workspace);
                    await templateController.initializeRepositoryList();
                    const output = await templateController.getTemplates(false);
                    output.should.contain.deep.members(defaultCodewindTemplates);
                    for (const element of output) {
                        // List of keys required are generated from the API docs
                        element.should.contain.keys('label', 'description', 'language', 'url', 'projectType');
                    }
                });
            });
            describe('and add a provider providing a valid template repo', function() {
                let templateController;
                before(async function() {
                    templateController = new Templates(workspace);
                    await templateController.addProvider('valid repo', {
                        getRepositories() {
                            return [sampleRepos.appsody];
                        },
                    });
                });
                it('returns more templates than just the default ones', async function() {
                    const output = await templateController.getTemplates(false);
                    output.should.include.deep.members(defaultCodewindTemplates);
                    (output.length).should.be.above(defaultCodewindTemplates.length);
                });
            });
        });
        describe('getTemplatesByStyle(projectStyle, showEnabledOnly = false)', function() {
            const workspace = getWorkspaceAndDeleteAfterEach(this.title);
            afterEach(() => {
                fs.removeSync(workspace);
            });
            it('gets only templates of a specific style', async function() {
                const templateController = new Templates(workspace);
                await templateController.initializeRepositoryList();
                const templateList = await templateController.getTemplatesByStyle('Codewind');
                templateList.length.should.be.gt(1);
            });
            it('gets no templates for a non-existent style', async function() {
                const templateController = new Templates(workspace);
                await templateController.initializeRepositoryList();
                const templateList = await templateController.getTemplatesByStyle('NotAStyle');
                templateList.length.should.equal(0);
            });
        });
        describe('getAllTemplateStyles()', function() {
            const workspace = getWorkspaceAndDeleteAfterEach(this.title);
            describe('returns only Codewind templates as it is the style in the projectTemplates', function() {
                let templateController;
                before(async function() {
                    templateController = new Templates(workspace);
                    await templateController.initializeRepositoryList();
                });
                afterEach(() => {
                    fs.removeSync(workspace);
                });
                it(`returns ['Codewind', 'Appsody']`, async function() {
                    const output = await templateController.getAllTemplateStyles();
                    output.should.deep.equal(['Codewind', 'Appsody']);
                });
            });
        });
        describe('getRepositories()', function() {
            const workspace = getWorkspaceAndDeleteAfterEach(this.title);
            let templateController;
            before(() => {
                templateController = new Templates(workspace);
                templateController.repositoryList = [...mockRepoList];
            });
            it('returns all repos', function() {
                const output = templateController.getRepositories();
                output.should.deep.equal(mockRepoList);
            });
        });
        describe('getRepository()', function() {
            const workspace = getWorkspaceAndDeleteAfterEach(this.title);
            let templateController;
            before(() => {
                templateController = new Templates(workspace);
                templateController.repositoryList = [mockRepos.enabled];
            });
            it('returns a repository as it exists in the repositoryList', function() {
                const repo = templateController.getRepository(mockRepos.enabled.url);
                repo.should.equal(mockRepos.enabled);
            });
            it('returns null as the requested repo does not exist in the repositoryList', function() {
                const repo = templateController.getRepository(mockRepos.disabled.url);
                should.equal(repo, null);
            });
        });
        describe('batchUpdate(requestedOperations)', function() {
            const workspace = getWorkspaceAndDeleteAfterEach(this.title);
            describe('when the repository has a valid URL to gather templates', function() {
                let templateController;
                let totalNumTemplates;
                before(async() => {
                    fs.ensureDirSync(workspace);
                    templateController = new Templates(workspace);
                    const disabledCodewindRepo = {
                        ...sampleRepos.codewind,
                        enabled: false,
                    };
                    templateController.repositoryList = [{ ...disabledCodewindRepo }];
                    await templateController.initializeRepositoryList();
                    // templateController should have no enabled templates
                    templateController.getTemplates(true).length.should.equal(0);
                    totalNumTemplates = templateController.getTemplates(false).length;
                });
                it('enables a disabled repository and updates the templates', async function() {
                    const operation = {
                        op: 'enable',
                        url: sampleRepos.codewind.url,
                        value: 'true',
                    };
                    const output = await templateController.batchUpdate([operation]);

                    output.should.deep.equal([{
                        status: 200,
                        requestedOperation: operation,
                    }]);

                    // templateController should have enabled templates
                    templateController.getTemplates(true).length.should.equal(totalNumTemplates);

                    const repoFile = fs.readJsonSync(templateController.repositoryFile);
                    repoFile.should.include.deep.members([sampleRepos.codewind]);
                });
            });
            describe('when the requested operations are all valid', function() {
                let templateController;
                beforeEach(() => {
                    fs.ensureDirSync(workspace);
                    templateController = new Templates(workspace);
                    templateController.repositoryList = [{ ...mockRepos.enabled }, { ...mockRepos.disabled }];
                });
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
                                id: '1',
                                url: '1',
                                description: '1',
                                enabled: true,
                            },
                            {
                                id: '2',
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
                                id: '1',
                                url: '1',
                                description: '1',
                                enabled: false,
                            },
                            {
                                id: '2',
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
                                id: '1',
                                url: '1',
                                description: '1',
                                enabled: false,
                            },
                            {
                                id: '2',
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
                                id: '1',
                                url: '1',
                                description: '1',
                                enabled: false,
                            },
                        ],
                    },
                };
                for (const [testName, test] of Object.entries(tests)) {
                    // eslint-disable-next-line no-loop-func
                    it(`${testName}`, async function() {
                        const output = await templateController.batchUpdate(test.input);
                        output.should.deep.equal(test.output);
                        if (test.expectedRepoDetails) {
                            const repoFile = fs.readJsonSync(templateController.repositoryFile);
                            repoFile.should.include.deep.members(test.expectedRepoDetails);
                        }
                    });
                }
            });
        });
        describe('addRepository(repoUrl, repoDescription, repoName, isRepoProtected)', function() {
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
                        const func = () => templateController.addRepository(templateRepositoryURL, 'description', 'name');
                        await (func().should.not.be.rejected);
                        templateController.repositoryList.should.containSubset([{
                            url: templateRepositoryURL,
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
                        const isRepoProtected = false;
                        const func = () => templateController.addRepository(templateRepositoryURL, 'description', 'name', isRepoProtected);
                        await (func().should.not.be.rejected);
                        templateController.repositoryList.should.containSubset([{
                            url: templateRepositoryURL,
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
                        const func = () => templateController.addRepository(templateRepositoryURL, 'description', 'name', false);
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
                        const func = () => templateController.addRepository(templateRepositoryURL, '', '', false);
                        await (func().should.not.be.rejected);
                        templateController.repositoryList.should.containSubset([{ ...sampleRepos.codewind, protected: false }]);
                    });
                });
            });
        });
        describe('deleteRepository(repoUrl)', function() {
            beforeEach(() => {
                fs.ensureDirSync(testWorkspaceConfigDir);
            });
            afterEach(() => {
                fs.removeSync(testWorkspaceDir);
            });
            it('deletes an existing URL and updates the repository_list.json correctly', async function() {
                const mockRepoList = [sampleRepos.codewind];
                const templateController = new Templates(testWorkspaceDir);
                templateController.repositoryList = [...mockRepoList];
                const url = mockRepoList[0].url;
                await templateController.deleteRepository(url);
                templateController.repositoryList.should.deep.equal([]);
            });
            it('attempts to delete a repo that does not exist', function() {
                const mockRepoList = [sampleRepos.codewind];
                const templateController = new Templates(testWorkspaceDir);
                templateController.repositoryList = [...mockRepoList];
                const func = () => templateController.deleteRepository('http://urlthatdoesnotexist.com');
                return func().should.be.rejected;
            });
        });
        describe('addProvider(name, provider)', () => {
            const provider = {
                getRepositories: () => {
                    return [sampleRepos.codewind];
                },
            };
            it('ignores the invalid provider', async() => {
                const templateController = new Templates(testWorkspaceDir);
                const originalProviders = { ...templateController.providers };
                await templateController.addProvider('empty obj', {});
                templateController.providers.should.deep.equal(originalProviders);
            });
            it('fails to add a provider with a getRepositories function that does not return valid repositories', async() => {
                const templateController = new Templates(testWorkspaceDir);
                templateController.repositoryList = [];
                const badProvider = {
                    getRepositories: () => {
                        return [1,2,3];
                    },
                };
                await templateController.addProvider('badProvider', badProvider);
            });
            it('successfully adds a provider', async() => {
                const templateController = new Templates(testWorkspaceDir);
                templateController.repositoryList = [];
                const { providers } = templateController;
                await templateController.addProvider('dummyProvider', provider);
                providers.should.have.property('dummyProvider');
                providers.dummyProvider.should.containSubset(provider);
                // Check repository has been added
                const { length: repoLength } = templateController.getRepositories();
                repoLength.should.equal(1);
            });
            it('does not add a duplicate repository', async() => {
                const templateController = new Templates(testWorkspaceDir);
                templateController.repositoryList = [];
                await templateController.addRepository(sampleRepos.codewind.url);
                templateController.repositoryList.length.should.equal(1);
                await templateController.addProvider('dummyProvider', provider);
                // Check repository has not been duplicated
                const { length: repoLength } = templateController.getRepositories();
                repoLength.should.equal(1);
            });
            describe('test adding a provider does not overwrite the existing repository list', () => {
                let templateController;
                let originalRepositoriesLength;
                let originalTemplatesLength;
                const provider = {
                    getRepositories: () => {
                        return [sampleRepos.codewind];
                    },
                };
                before(() => {
                    templateController = new Templates(testWorkspaceDir);
                    templateController.repositoryList = [...mockRepoList];
                    // Add a dummy entry to the templates
                    templateController.allProjectTemplates = ['template'];
                    originalRepositoriesLength = templateController.getRepositories().length;
                    originalTemplatesLength = templateController.getTemplates(false).length;
                });
                it('adds a new provider and verifies that it does not delete the old repositories and templates', async() => {
                    await templateController.addProvider('dummyProvider', provider);
                    const updatedRepositoryList = templateController.getRepositories();
                    updatedRepositoryList.length.should.equal(originalRepositoriesLength + 1);
                    updatedRepositoryList.should.deep.equal([...mockRepoList, sampleRepos.codewind]);
                    const updatedTemplates = templateController.getTemplates(false);
                    updatedTemplates.length.should.be.above(originalTemplatesLength);
                    // the dummy template will have been removed as addProvider does a fresh fetch of templates
                    updatedTemplates.should.not.contain('template');
                });
            });
        });
    });

    describe('Local functions', function() {
        describe('writeRepositoryList(repositoryFile, repositoryList)', () => {
            const writeRepositoryList = Templates.__get__('writeRepositoryList');
            beforeEach(() => {
                fs.removeSync(testWorkspaceConfigDir);
            });
            after(() => {
                fs.removeSync(testWorkspaceConfigDir);
            });
            it('creates a new repository file if one doesn\'t exist', async() => {
                fs.pathExistsSync(testRepositoryFile).should.be.false;
                await writeRepositoryList(testRepositoryFile, []);
                fs.pathExistsSync(testRepositoryFile).should.be.true;
            });
            it('overwrites an existing repository file', async() => {
                fs.pathExistsSync(testRepositoryFile).should.be.false;
                await writeRepositoryList(testRepositoryFile, [{ field: 'string' }]);
                fs.pathExistsSync(testRepositoryFile).should.be.true;
                const jsonPreChange = await fs.readJson(testRepositoryFile);
                jsonPreChange[0].should.have.property('field', 'string');

                await writeRepositoryList(testRepositoryFile, [{ field: 123 }]);
                const jsonPostChange = await fs.readJson(testRepositoryFile);
                jsonPostChange[0].should.have.property('field', 123);
            });
        });
        describe('validateRepository(repoUrl, repositories)', () => {
            const validateRepository = Templates.__get__('validateRepository');
            it('is rejected as the URL is invalid', () => {
                return validateRepository('invalidurl')
                    .should.be.rejected.then(err => checkTemplateError(err, 'INVALID_URL'));
            });
            it('is rejected as the repositories already contains the given url', () => {
                return validateRepository(sampleRepos.codewind.url, [...mockRepoList, sampleRepos.codewind])
                    .should.be.rejected.then(err => checkTemplateError(err, 'DUPLICATE_URL'));
            });
            it('is rejected as url does not point to a valid index.json', () => {
                return validateRepository('https://eclipse.org', [...mockRepoList])
                    .should.be.rejected.then(err => checkTemplateError(err, 'URL_DOES_NOT_POINT_TO_INDEX_JSON'));
            });
            it('returns a validated url', async() => {
                const validatedURL = await validateRepository(sampleRepos.codewind.url, [...mockRepoList]);
                validatedURL.should.equal(sampleRepos.codewind.url);
            });
        });
        describe('constructRepositoryObject(url, description, name, isRepoProtected)', () => {
            const constructRepositoryObject = Templates.__get__('constructRepositoryObject');
            it('returns a repository object when all arguments are given', async() => {
                const { url, description, name, protected } = sampleRepos.codewind;
                const repository = await constructRepositoryObject(url, description, name, protected);
                repository.should.have.keys('id', 'name', 'url', 'description', 'enabled', 'protected', 'projectStyles');
            });
            it('returns a repository object when only a url is given - gets the name, description from the url and does not have a protected field', async() => {
                const { url } = sampleRepos.codewind;
                const repository = await constructRepositoryObject(url);
                repository.should.have.keys('id', 'name', 'url', 'description', 'enabled', 'projectStyles');
                repository.should.not.have.keys('protected');
            });
        });
        describe('updateRepoListWithReposFromProviders(providers, repositoryList)', function() {
            const updateRepoListWithReposFromProviders = Templates.__get__('updateRepoListWithReposFromProviders');
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
                        before(() => {
                            fs.ensureDirSync(testWorkspaceConfigDir);
                        });
                        after(() => {
                            fs.removeSync(testWorkspaceDir);
                        });
                        it(`does not update the repositoryList`, async function() {
                            const updatedRepositoryList = await updateRepoListWithReposFromProviders([test.provider], [...mockRepoList]);
                            updatedRepositoryList.should.deep.equal([...mockRepoList]);
                        });
                    });
                }
            });
            describe('when providers list valid repos', function() {
                const validCodewindRepo = {
                    url: templateRepositoryURL,
                    description: 'The default set of templates for new projects in Codewind.',
                };
                before(() => {
                    fs.ensureFileSync(testRepositoryFile);
                });
                after(() => {
                    fs.removeSync(testWorkspaceDir);
                });
                it(`updates the repository successfully`, async function() {
                    const expectedRepo = {
                        ...validCodewindRepo,
                        enabled: true,
                        protected: true,
                        name: 'Default templates',
                        projectStyles: ['Codewind'],
                    };
                    const provider = {
                        getRepositories() {
                            return [validCodewindRepo];
                        },
                    };
                    const updatedRepositoryList = await updateRepoListWithReposFromProviders([provider], [...mockRepoList], testRepositoryFile);
                    updatedRepositoryList.length.should.equal([...mockRepoList].length + 1);
                    updatedRepositoryList.should.deep.include(expectedRepo);
                });
            });
        });
        describe('addCodewindSettingsToRepository(repos)', () => {
            const addCodewindSettingsToRepository = Templates.__get__('addCodewindSettingsToRepository');
            const url = 'https://raw.githubusercontent.com/kabanero-io/codewind-appsody-templates/master/devfiles/index.json';
            it('should update a repository to have the enabled and protected fields when they don\'t exist', async() => {
                const testRepositoryList = [{ name: 'test', url }];
                const updatedList = await addCodewindSettingsToRepository(testRepositoryList);
                updatedList.length.should.equal(1);
                updatedList[0].should.have.property('enabled', true);
                updatedList[0].should.have.property('protected', true);
            });
            it('should overwrite a repository\s enabled and protected fields when they do exist', async() => {
                const testRepositoryList = [{ name: 'test', url, enabled: false, protected: false }];
                const updatedList = await addCodewindSettingsToRepository(testRepositoryList);
                updatedList.length.should.equal(1);
                updatedList[0].should.have.property('enabled', true);
                updatedList[0].should.have.property('protected', true);
            });
        });
        describe('fetchAllRepositoryDetails(repos)', function() {
            const fetchAllRepositoryDetails = Templates.__get__('fetchAllRepositoryDetails');
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
                        const output = await fetchAllRepositoryDetails(test.input);
                        output.should.deep.equal(test.output);
                    });
                });
            }
        });
        describe('fetchRepositoryDetails(repo)', function() {
            const fetchRepositoryDetails = Templates.__get__('fetchRepositoryDetails');
            it('returns the details for a repository', async() => {
                const details = await fetchRepositoryDetails(sampleRepos.codewind);
                details.should.have.keys(['url', 'description', 'enabled', 'protected', 'projectStyles', 'name']);
                details.should.deep.equal(sampleRepos.codewind);
            });
            it('returns the correct name and description for a repository from its url (json file)', async() => {
                const repo = { ...sampleRepos.codewind };
                delete repo.name;
                delete repo.description;
                repo.should.not.have.keys(['name', 'description']);
                const details = await fetchRepositoryDetails(sampleRepos.codewind);
                details.should.have.keys(['url', 'description', 'enabled', 'protected', 'projectStyles', 'name']);
                details.should.deep.equal(sampleRepos.codewind);
            });
            it('returns the default "Codewind" projectStyles when it is doesn\'t exist', async() => {
                const repo = { ...sampleRepos.codewind };
                delete repo.projectStyles;
                repo.should.not.have.key('projectStyles');
                const details = await fetchRepositoryDetails(sampleRepos.codewind);
                details.should.have.deep.property('projectStyles', ['Codewind']);
            });
        });
        describe('getNameAndDescriptionFromRepoTemplatesJSON(url)', function() {
            const getNameAndDescriptionFromRepoTemplatesJSON = Templates.__get__('getNameAndDescriptionFromRepoTemplatesJSON');
            it('throws an error as no url is given', () => {
                return getNameAndDescriptionFromRepoTemplatesJSON('')
                    .should.be.eventually.rejectedWith('must supply a URL');
            });
            it('returns an empty object as the URL given is a file', async() => {
                const repo = await getNameAndDescriptionFromRepoTemplatesJSON('file://something/something');
                repo.should.deep.equal({});
            });
            it('returns an empty object as the url does not point to correct JSON', async() => {
                const repo = await getNameAndDescriptionFromRepoTemplatesJSON('https://google.com');
                repo.should.deep.equal({});
            });
            it('returns a name and description as the URL is valid', async() => {
                const { url } = sampleRepos.codewind;
                const repo = await getNameAndDescriptionFromRepoTemplatesJSON(url);
                repo.should.contain.keys('name', 'description');
            });
        });
        describe('getRepositoryFromTemplate(repositoryList, template)', function() {
            const getRepositoryFromTemplate = Templates.__get__('getRepositoryFromTemplate');
            const repositoryList = [...mockRepoList];
            it('returns a repository for a template where the source ID matches the repository ID', () => {
                const repo = getRepositoryFromTemplate(repositoryList, { sourceId: mockRepos.enabled.id });
                repo.should.deep.equal(mockRepos.enabled);
            });
            it('returns a repository for a template with no source ID but the where the sourceURL matches the repository url', () => {
                const repo = getRepositoryFromTemplate(repositoryList, { sourceURL: mockRepos.noID.url });
                repo.should.deep.equal(mockRepos.noID);
            });
            it('returns a repository for a template with no source ID or sourceURL but the where the source (repo name) matches the repository name', () => {
                const repo = getRepositoryFromTemplate(repositoryList, { source: mockRepos.withOnlyName.name });
                repo.should.deep.equal(mockRepos.withOnlyName);
            });
            it('returns null as the template does not have a sourceId, sourceURL or a source field', () => {
                const repo = getRepositoryFromTemplate(repositoryList,  {});
                should.equal(repo, null);
            });
            it('returns null as a repository does not exist in the list that matches the given template', () => {
                const repo = getRepositoryFromTemplate(repositoryList,  { sourceId: '123', sourceURL: 'url', source: 'invalid' });
                should.equal(repo, null);
            });
        });
        describe('updateTemplates(repositories, allTemplates)', function() {
            const updateTemplates = Templates.__get__('updateTemplates');
            it('returns a populated enabledTemplates list as the given repository is enabled', async() => {
                const originalAllTemplates = [...defaultCodewindTemplates];
                const repositories = [{
                    ...sampleRepos.codewind,
                    enabled: true,
                }];
                const { enabledTemplates, allTemplates } = await updateTemplates(repositories, originalAllTemplates);
                allTemplates.should.deep.equal(originalAllTemplates);
                enabledTemplates.should.deep.equal(allTemplates);
            });
            it('returns an empty enabledTemplates list as the given repository is disabled', async() => {
                const originalAllTemplates = [...defaultCodewindTemplates];
                const repositories = [{
                    ...sampleRepos.codewind,
                    enabled: false,
                }];
                const { enabledTemplates, allTemplates } = await updateTemplates(repositories, originalAllTemplates);
                allTemplates.should.deep.equal(originalAllTemplates);
                enabledTemplates.length.should.equal(0);
            });
        });
        describe('fetchTemplates(repositories)', function() {
            const fetchTemplates = Templates.__get__('fetchTemplates');
            it('returns enabledTemplates and allTemplates as the same list as the only repository is enabled', async function() {
                const repoList = [{ ...sampleRepos.codewind }];
                const { enabledTemplates, allTemplates } = await fetchTemplates(repoList);
                enabledTemplates.length.should.be.above(0);
                allTemplates.length.should.be.above(0);
                enabledTemplates.should.deep.equal(allTemplates);
            });
            it('returns enabledTemplates as empty as the only repository is disabled', async function() {
                const repoList = [{
                    ...sampleRepos.codewind,
                    enabled: false,
                }];
                const { enabledTemplates, allTemplates } = await fetchTemplates(repoList);
                enabledTemplates.length.should.equal(0);
                allTemplates.length.should.be.above(0);
            });
        });
        describe('getTemplatesFromRepos(repositoryList)', function() {
            const getTemplatesFromRepos = Templates.__get__('getTemplatesFromRepos');
            it('throws an error as no repos are given', function() {
                const func = () => getTemplatesFromRepos();
                return func().should.be.rejected;
            });
            it('returns no templates as an empty repository list is given', async function() {
                const output = await getTemplatesFromRepos([]);
                output.should.deep.equal([]);
            });
            it('returns the default Codewind templates', async function() {
                const output = await getTemplatesFromRepos([sampleRepos.codewind]);
                output.should.deep.equal(defaultCodewindTemplates);
            });
        });
        describe('getTemplatesFromRepo(repository)', function() {
            const getTemplatesFromRepo = Templates.__get__('getTemplatesFromRepo');
            it('returns the correct templates from a valid repository', async function() {
                const output = await getTemplatesFromRepo(sampleRepos.codewind);
                output.should.have.deep.members(defaultCodewindTemplates);
            });
            it('throws a useful error when a string is given', function() {
                const func = () => getTemplatesFromRepo('string');
                return func().should.be.rejectedWith(`repo 'string' must have a URL`);
            });
            it('throws a useful error when an invalid url is given', function() {
                const func = () => getTemplatesFromRepo({ url: 'invalidURL' });
                return func().should.be.rejectedWith('Invalid URL');
            });
            it('throws a useful error when a valid URL is given but it does not point to JSON', function() {
                const func = () => getTemplatesFromRepo({ url: 'https://www.google.com/' });
                return func().should.be.rejectedWith(`URL 'https://www.google.com/' did not return JSON`);
            });
            it('throws a useful error when an invalid file path is given', function() {
                const func = () => getTemplatesFromRepo({ url: 'file://something.json' });
                return func().should.be.rejectedWith(`repo file 'file://something.json/' did not return JSON`);
            });
        });
        describe('getTemplatesJSONFromURL(givenURL)', () => {
            const getTemplatesJSONFromURL = Templates.__get__('getTemplatesJSONFromURL');
            it('gets templates JSON back from a valid URL', async() => {
                const templatesJSON = await getTemplatesJSONFromURL(sampleRepos.codewind.url);
                templatesJSON.should.be.an('array');
                templatesJSON.forEach(templateObject => {
                    templateObject.should.have.keys('displayName', 'description', 'language', 'projectType', 'location', 'links');
                });
            });
            it('should be rejected as URL does not point to JSON', () => {
                const func = () => getTemplatesJSONFromURL('https://www.google.com/');
                return func().should.be.rejectedWith(`URL 'https://www.google.com/' did not return JSON`);
            });
            it('should be rejected as filepath does not exist', function() {
                const func = () => getTemplatesJSONFromURL('file://something.json');
                return func().should.be.rejectedWith(`repo file 'file://something.json/' did not return JSON`);
            });
        });
        describe('filterTemplatesByStyle(templates, projectStyle)', function() {
            const filterTemplatesByStyle = Templates.__get__('filterTemplatesByStyle');
            const templates = [sampleCodewindTemplate, sampleAppsodyTemplate];
            it('returns only Codewind templates', function() {
                const output = filterTemplatesByStyle(templates, 'Codewind');
                output.should.deep.equal([sampleCodewindTemplate]);
            });
            it('returns only Appsody templates', function() {
                const output = filterTemplatesByStyle(templates, 'Appsody');
                output.should.deep.equal([sampleAppsodyTemplate]);
            });
            it('returns no templates as an empty string was given', function() {
                const output = filterTemplatesByStyle(templates, '');
                output.length.should.equal(0);
            });
            it('returns no templates as an invalid string was given', function() {
                const output = filterTemplatesByStyle(templates, 'doNotExist');
                output.length.should.equal(0);
            });
        });
        describe('getTemplateStyles(templates)', function() {
            const getTemplateStyles = Templates.__get__('getTemplateStyles');
            it('returns Codewind by default', function() {
                const output = getTemplateStyles([mockRepos.enabled]);
                output.should.deep.equal(['Codewind']);
            });
            it('returns Codewind', function() {
                const output = getTemplateStyles([sampleCodewindTemplate]);
                output.should.deep.equal(['Codewind']);
            });
            it('returns Other when the projectStyle of Other is given', function() {
                const output = getTemplateStyles([{ projectStyle: 'Other' }]);
                output.should.deep.equal(['Other']);
            });
            it('returns Codewind and Other when both styles of templates are given', function() {
                const output = getTemplateStyles([sampleCodewindTemplate, { projectStyle: 'Other' }]);
                output.should.deep.equal(['Codewind', 'Other']);
            });
        });
        describe('getTemplateStyle(template)', () => {
            const getTemplateStyle = Templates.__get__('getTemplateStyle');
            it('returns Codewind by default', function() {
                const output = getTemplateStyle({});
                output.should.deep.equal('Codewind');
            });
            it('returns Other when the projectStyle of Other is given', function() {
                const output = getTemplateStyle({ projectStyle: 'Other' });
                output.should.deep.equal('Other');
            });
        });
        describe('getReposFromProviders(providers)', function() {
            const getReposFromProviders = Templates.__get__('getReposFromProviders');
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
                        const output = await getReposFromProviders(test.input);
                        output.should.deep.equal(test.output);
                    });
                });
            }
        });
        describe('isRepo(obj)', () => {
            const isRepo = Templates.__get__('isRepo');
            it('returns true as obj with a url field is a repo', () => {
                isRepo({ url: 'something' }).should.be.true;
            });
            it('returns false as obj is undefined', () => {
                const output = isRepo();
                output.should.be.false;
            });
            it('returns false as obj has no url field', () => {
                const output = isRepo({});
                output.should.be.false;
            });
        });
        describe('doesURLPointToIndexJSON(obj)', () => {
            const doesURLPointToIndexJSON = Templates.__get__('doesURLPointToIndexJSON');
            it('returns true a valid URL is given', () => {
                const { url } = sampleRepos.codewind;
                return doesURLPointToIndexJSON(url).should.eventually.be.true;
            });
            it('returns false as the URL does not point to JSON', function() {
                return doesURLPointToIndexJSON('http://google.com').should.eventually.be.false;
            });
            it('returns false as the file URL does not point to JSON', () => {
                return doesURLPointToIndexJSON('file://doesNotExist').should.eventually.be.false;
            });
            it('returns true as the file URL does point to JSON', () => {
                const testFile = path.join(__dirname, 'doesURLPointToIndexJSON.json');
                fs.ensureFileSync(testFile);
                const template = {
                    displayName: 'test',
                    description: 'test',
                    language: 'test',
                    projectType: 'test',
                    location: 'test',
                    links: 'test',
                };
                fs.writeJSONSync(testFile, [template]);
                return doesURLPointToIndexJSON(path.join('file://', testFile)).should.eventually.be.true;
            });
            after(() => {
                fs.removeSync(path.join(__dirname, 'doesURLPointToIndexJSON.json'));
            });
        });
        describe('isTemplateSummary(obj)', () => {
            const isTemplateSummary = Templates.__get__('isTemplateSummary');
            const dummyTemplate = {
                displayName: 'test',
                description: 'test',
                language: 'test',
                projectType: 'test',
                location: 'test',
                links: 'test',
            };
            it('returns true as the given object has all the required fields', () => {
                isTemplateSummary(dummyTemplate).should.be.true;
            });
            it('returns false as the given object does not have a description field', () => {
                const template = { ...dummyTemplate };
                delete template.description;
                template.should.not.have.property('description');
                isTemplateSummary(template).should.be.false;
            });
            it('returns true as the given object has all the required fields and an extra one', () => {
                const template = { ...dummyTemplate };
                template.extraField = 'string';
                isTemplateSummary(template).should.be.true;
            });
        });
        describe('addRepositoryToProviders(repo, providers)', () => {
            const addRepositoryToProviders = Templates.__get__('addRepositoryToProviders');
            const validProvider = {
                repositories: [],
                canHandle() {
                    return true;
                },
                addRepository(newRepo) {
                    this.repositories.push(newRepo);
                    return this.repositories;
                },
            };
            it('adds a repository to a provider', async() => {
                const providers = {
                    firstProvider: { ...validProvider },
                };
                const { firstProvider } = providers;
                firstProvider.repositories.should.have.length(0);
                const updatedProviders = await addRepositoryToProviders({ ...sampleRepos.codewind }, providers);
                const { firstProvider: updatedFirstProvider } = updatedProviders;
                updatedFirstProvider.repositories.should.have.length(1);
            });
            it('throws a TemplateError if one of the providers errors while adding the repository', () => {
                const errorFunction = () => {
                    throw new Error();
                };
                const providerThrowsError = {
                    ...validProvider,
                    async addRepository() {
                        await errorFunction();
                    },
                };
                const providers = {
                    badProvider: { ...providerThrowsError },
                };
                return addRepositoryToProviders({ ...sampleRepos.codewind }, providers)
                    .should.be.rejected.then(err => checkTemplateError(err, 'ADD_TO_PROVIDER_FAILURE'));
            });
        });
        describe('removeRepositoryFromProviders(repo)', () => {
            const removeRepositoryFromProviders = Templates.__get__('removeRepositoryFromProviders');
            it('removes a repository from a provider', async() => {
                const providers = {
                    firstProvider: {
                        repositories: [{ ...sampleRepos.codewind }],
                        canHandle() {
                            return true;
                        },
                        removeRepository(repoURLToDelete) {
                            this.repositories.splice(this.repositories.findIndex(repo => repo.url === repoURLToDelete), 1);
                            return this.repositories;
                        },
                    },
                };
                const { firstProvider } = providers;
                firstProvider.repositories.should.have.length(1);
                const updatedProviders = await removeRepositoryFromProviders(sampleRepos.codewind.url, providers);
                const { firstProvider: updatedFirstProvider } = updatedProviders;
                updatedFirstProvider.repositories.should.have.length(0);
            });
        });
        describe('performOperationsOnRepositoryList(requestedOperations, repositoryList)', function() {
            const performOperationsOnRepositoryList = Templates.__get__('performOperationsOnRepositoryList');
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
                                id: '1',
                                url: '1',
                                description: '1',
                                enabled: false,
                            },
                        ],
                    },
                };
                for (const [testName, test] of Object.entries(tests)) {
                    // eslint-disable-next-line no-loop-func
                    it(`${testName}`, async function() {
                        const repoList = [{ ...mockRepos.enabled }, { ...mockRepos.disabled }];
                        const { operationResults, newRepositoryList } = await performOperationsOnRepositoryList(test.input, repoList);
                        operationResults.should.deep.equal(test.output);
                        if (test.expectedRepoDetails) {
                            newRepositoryList.should.containSubset(test.expectedRepoDetails);
                        }
                    });
                }
            });
        });
        describe('performOperationOnRepository(operation, repositoryList)', function() {
            const performOperationOnRepository = Templates.__get__('performOperationOnRepository');
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
                            id: '1',
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
                            id: '1',
                            url: '1',
                            description: '1',
                            enabled: false,
                        },
                    },
                };
                for (const [testName, test] of Object.entries(tests)) {
                    describe(testName, function() { // eslint-disable-line no-loop-func
                        it(`returns the expected operation info and correctly updates the repository file`, async function() {
                            const repositoryList = [{ ...mockRepos.enabled }, { ...mockRepos.disabled }];
                            const { operationResult, updatedRepo } = await performOperationOnRepository(test.input, repositoryList);
                            operationResult.should.deep.equal(test.output);
                            updatedRepo.should.deep.equal(test.expectedRepoDetails);
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
                        it(`returns the expected operation info`, async function() {
                            const repositoryList = [...mockRepoList];
                            const { operationResult, updatedRepo } = await performOperationOnRepository(test.input, repositoryList);
                            operationResult.should.deep.equal(test.output);
                            // eslint-disable-next-line no-undefined
                            should.equal(updatedRepo, undefined);
                        });
                    });
                }
            });
        });
        describe('enableOrDisableRepository({ url, value }, repo)', () => {
            const enableOrDisableRepository = Templates.__get__('enableOrDisableRepository');
            it('returns 404 as its status as the repository does not exist', async() => {
                const { response: operationResponse } = await enableOrDisableRepository({ url: 'urlThatDoesNotExist' });
                operationResponse.should.have.property('status', 404);
                operationResponse.should.have.property('error', 'Unknown repository URL');
            });
            const tests = {
                'enables a project (Boolean)': { input: true, output: true, testRepo: mockRepos.disabled },
                'enables a project (String)': { input: 'true', output: true, testRepo: mockRepos.disabled },
                'disables a project (Boolean)': { input: false, output: false, testRepo: mockRepos.enabled },
                'disables a project (String)': { input: 'false', output: false, testRepo: mockRepos.enabled },
            };
            for (const [testName, test] of Object.entries(tests)) {
                const { input, output, testRepo } = test;
                // eslint-disable-next-line no-loop-func
                it(`returns 200 and ${testName}`, async() => {
                    const { response: operationResponse, updatedRepo } = await enableOrDisableRepository({ url: testRepo.url, value: input }, testRepo);
                    operationResponse.should.have.property('status', 200);
                    operationResponse.should.not.have.property('error');

                    updatedRepo.should.have.property('enabled', output);
                });
            }
        });
        describe('updateRepositoryList(currentRepositoryList, updatedRepositories)', function() {
            const updateRepositoryList = Templates.__get__('updateRepositoryList');
            it('returns an updated repositoryList in which the given updatedRepository is enabled', () => {
                const repositoryList = [...mockRepoList];
                const updatedRepo = {
                    ...mockRepos.disabled,
                    enabled: true,
                };
                const updatedList = updateRepositoryList(repositoryList, [updatedRepo]);
                updatedList.should.include(updatedRepo);
            });
            it('returns the original repositoryList as the updated repository is not in the orignal list', () => {
                const repositoryList = [...mockRepoList];
                const updatedRepo = {
                    url: 'na',
                    enabled: true,
                };
                const updatedList = updateRepositoryList(repositoryList, [updatedRepo]);
                updatedList.should.not.include(updatedRepo);
                updatedList.should.deep.equal(repositoryList);
            });
        });
    });
});
