/*******************************************************************************
 * Copyright (c) 2019 IBM Corporation and others.
 * All rights reserved. This program and the accompanying materials
 * are made available under the terms of the Eclipse Public License v2.0
 * which accompanies this distribution, and is available at
 * http://www.eclipse.org/legal/epl-v20.html
 *
 * Contributors:
 *     IBM Corporation - initial API and implementation
 ******************************************************************************/

const chai = require('chai');
const chaiResValidator = require('chai-openapi-response-validator');
const chaiSubset = require('chai-subset');

const {
    defaultCodewindTemplates,
    validUrlNotPointingToIndexJson,
    sampleRepos,
    batchPatchTemplateRepos,
    getTemplateRepos,
    getTemplates,
    addTemplateRepo,
    deleteTemplateRepo,
    setTemplateReposTo,
    getTemplateStyles,
    saveReposBeforeTestAndRestoreAfter,
    saveReposBeforeEachTestAndRestoreAfterEach,
} = require('../../../modules/template.service');
const { pathToApiSpec, testTimeout } = require('../../../config');

chai.should();
chai.use(chaiSubset);
chai.use(chaiResValidator(pathToApiSpec));

describe('Template API tests', function() {
    // Save the state of the repos before any test and restore the exact state after
    saveReposBeforeTestAndRestoreAfter();
    describe('GET /api/v1/templates', function() {
        before(async() => {
            this.timeout(testTimeout.short);
            await setTemplateReposTo([
                { ...sampleRepos.codewind },
            ]);
        });
        describe('?projectStyle=', function() {
            it('should return at least the default Codewind templates as no projectStyle is given', async function() {
                this.timeout(testTimeout.short);
                const res = await getTemplates();
                res.should.have.status(200).and.satisfyApiSpec;
                res.body.length.should.be.at.least(defaultCodewindTemplates.length);
            });
            it('should return only Codewind templates as projectStyle is Codewind', async function() {
                this.timeout(testTimeout.short);
                const res = await getTemplates({ projectStyle: 'Codewind' });
                res.should.have.status(200).and.satisfyApiSpec;
                res.body.forEach(template => {
                    if (template.projectStyle) {
                        template.projectStyle.should.equal('Codewind');
                    }
                });
            });
            it('should return 204 as there exists no templates with the given projectStyle', async function() {
                this.timeout(testTimeout.short);
                const res = await getTemplates({ projectStyle: 'unknownStyle' });
                res.should.have.status(204);
                res.body.should.be.empty;
            });
        });
        describe('?showEnabledOnly=', function() {
            it('should return all templates (from enabled and disabled repos)', async function() {
                this.timeout(testTimeout.short);
                const res = await getTemplates({ showEnabledOnly: false });
                res.should.have.status(200).and.satisfyApiSpec;
                res.body.length.should.be.at.least(defaultCodewindTemplates.length);
            });
            it('should return only templates from enabled repos', async function() {
                this.timeout(testTimeout.short);
                const res = await getTemplates({ showEnabledOnly: true });
                res.should.have.status(200).and.satisfyApiSpec;
                res.body.length.should.be.at.least(defaultCodewindTemplates.length);
            });
        });
    });

    describe('GET /api/v1/templates/repositories', function() {
        before(async function() {
            this.timeout(testTimeout.short);
            await setTemplateReposTo([
                { ...sampleRepos.codewind },
            ]);
        });
        it('should return 200 and a list of available template repositories', async function() {
            this.timeout(testTimeout.short);
            const res = await getTemplateRepos();
            for (let i = 0; i < res.body.length; i++) {
                const element = res.body[i];
                element.should.contain.keys('url');
                delete element.id;
            }
            res.should.have.status(200).and.satisfyApiSpec;
            res.body.should.deep.containSubset([sampleRepos.codewind]);
        });
    });

    describe('POST /api/v1/templates/repositories', function() {
        describe('when trying to add a repository with', function() {
            describe('an invalid url', function() {
                it('should return 400', async function() {
                    this.timeout(testTimeout.short);
                    const res = await addTemplateRepo({
                        url: '/invalid/url',
                        description: 'Invalid url.',
                    });
                    res.should.have.status(400);
                });
            });
            describe('a duplicate url', function() {
                it('should return 400', async function() {
                    this.timeout(testTimeout.short);
                    // Arrange
                    const res = await getTemplateRepos();
                    const originalTemplateRepos = res.body;
                    const duplicateRepoUrl = originalTemplateRepos[0].url;
                    // Act
                    const res2 = await addTemplateRepo({
                        url: duplicateRepoUrl,
                        description: 'duplicate url',
                    });
                    // Assert
                    res2.should.have.status(400);
                });
            });
            describe('a valid url that does not point to an index.json', function() {
                it('should return 400', async function() {
                    this.timeout(testTimeout.short);
                    const res = await addTemplateRepo({
                        url: validUrlNotPointingToIndexJson,
                        description: 'valid url that does not point to an index.json',
                    });
                    res.should.have.status(400);
                });
            });
            describe('a valid url', function() {
                let originalTemplateReposLength;
                before(async function() {
                    this.timeout(testTimeout.short);
                    const { body: repos } = await getTemplateRepos();
                    originalTemplateReposLength = repos.length;
                });
                it('should add a template repository', async function() {
                    this.timeout(testTimeout.short);
                    const repoToAdd = {
                        // Use an early version of kabanero-io collections to avoid clashes inside the Appsody CLI
                        url: 'https://github.com/kabanero-io/collections/releases/download/v0.0.6/kabanero-index.json',
                        description: 'Additional Codewind templates',
                        protected: false,
                    };
                    const res = await addTemplateRepo(repoToAdd);
                    res.should.have.status(200).and.satisfyApiSpec;
                    res.body.should.deep.containSubset([repoToAdd]);
                    res.body.length.should.equal(originalTemplateReposLength + 1);
                });
            });
        });
    });

    describe('DELETE /api/v1/templates/repositories', function() {
        it('DELETE should try to remove a template repository that doesn\'t exist', async function() {
            const res = await deleteTemplateRepo('http://something.com/index.json');            
            res.should.have.status(404);
        });
    });

    describe('DELETE | GET | POST /api/v1/templates/repositories', function() {
        // Save state for this test
        saveReposBeforeTestAndRestoreAfter();
        const repo = sampleRepos.codewind;
        let originalTemplateRepos;
        let originalTemplates;
        let originalNumTemplates;
        before(async function() {
            this.timeout(testTimeout.short);
            const { body: repos } = await getTemplateRepos();
            originalTemplateRepos = repos;
            const { body: templates } = await getTemplates();
            originalTemplates = templates;
            originalNumTemplates = templates.length;
            
        });
        it('DELETE /api/v1/templates should remove a template repository', async function() {
            const res = await deleteTemplateRepo(repo.url);
            res.should.have.status(200).and.satisfyApiSpec;
            res.body.should.not.deep.include(repo);
            res.body.length.should.equal(originalTemplateRepos.length - 1);
        });
        it('GET /api/v1/templates should return fewer templates', async function() {
            this.timeout(testTimeout.short);
            const res = await getTemplates();
            res.should.have.status(200).and.satisfyApiSpec;
            res.body.should.not.deep.include(originalTemplates);
            res.body.length.should.be.below(originalNumTemplates);
        });
        it('POST /api/v1/templates should re-add the deleted template repository', async function() {
            this.timeout(testTimeout.short);
            const res = await addTemplateRepo(repo);
            res.should.have.status(200).and.satisfyApiSpec;
            res.body.should.containSubset([repo]);
            res.body.length.should.equal(originalTemplateRepos.length);
        });
        it('GET /api/v1/templates should return the original templates', async function() {
            this.timeout(testTimeout.short);
            const res = await getTemplates();
            res.should.have.status(200).and.satisfyApiSpec;
            res.body.should.deep.equal(originalTemplates);
            res.body.length.should.equal(originalNumTemplates);
        });
    });
    describe('PATCH /api/v1/batch/templates/repositories', function() {
        const { url: existingRepoUrl } = sampleRepos.codewind;
        const tests = {
            'enable an existing repo': {
                input: [{
                    op: 'enable',
                    url: existingRepoUrl,
                    value: 'true',
                }],
                output: [{
                    status: 200,
                    requestedOperation: {
                        op: 'enable',
                        url: existingRepoUrl,
                        value: 'true',
                    },
                }],
            },
            'disable an existing repo': {
                input: [{
                    op: 'enable',
                    url: existingRepoUrl,
                    value: 'false',
                }],
                output: [{
                    status: 200,
                    requestedOperation: {
                        op: 'enable',
                        url: existingRepoUrl,
                        value: 'false',
                    },
                }],
            },
            'enable an unknown repo': {
                input: [{
                    op: 'enable',
                    url: 'unknownRepoUrl',
                    value: 'true',
                }],
                output: [{
                    status: 404,
                    error: 'Unknown repository URL',
                    requestedOperation: {
                        op: 'enable',
                        url: 'unknownRepoUrl',
                        value: 'true',
                    },
                }],
            },
            'disable an unknown repo': {
                input: [{
                    op: 'enable',
                    url: 'unknownRepoUrl',
                    value: 'false',
                }],
                output: [{
                    status: 404,
                    error: 'Unknown repository URL',
                    requestedOperation: {
                        op: 'enable',
                        url: 'unknownRepoUrl',
                        value: 'false',
                    },
                }],
            },
        };
        saveReposBeforeEachTestAndRestoreAfterEach();
        for (const [testName, test] of Object.entries(tests)) {
            it(`should ${testName} and return 207 and the expected operations info`, async function() {
                const res = await batchPatchTemplateRepos(test.input);
                res.should.have.status(207).and.satisfyApiSpec;
                res.body.should.deep.equal(test.output);
            });
        }
    });
    describe('GET /api/v1/templates/styles', function() {
        it('should return a list of available template styles', async function() {
            this.timeout(testTimeout.short);
            const res = await getTemplateStyles();
            res.should.have.status(200).and.satisfyApiSpec;
            res.body.should.have.members(['Codewind', 'Appsody']);
        });
    });
});
