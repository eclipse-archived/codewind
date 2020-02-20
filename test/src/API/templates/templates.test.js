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
const deepEqualInAnyOrder = require('deep-equal-in-any-order');

const {
    defaultCodewindTemplates,
    validUrlNotPointingToIndexJson,
    sampleRepos,
    batchPatchTemplateRepos,
    getTemplateRepos,
    getTemplates,
    addTemplateRepo,
    deleteTemplateRepo,
    getTemplateStyles,
    saveReposBeforeTestAndRestoreAfter,
    saveReposBeforeEachTestAndRestoreAfterEach,
    setupReposAndTemplatesForTesting,
} = require('../../../modules/template.service');
const { pathToApiSpec, testTimeout } = require('../../../config');

chai.should();
chai.use(chaiSubset);
chai.use(deepEqualInAnyOrder);

chai.use(chaiResValidator(pathToApiSpec));

describe('Template API tests', function() {
    // Set the default timeout for all tests
    this.timeout(testTimeout.short);
    // Save the state of the repos before any test and restore the exact state after
    saveReposBeforeTestAndRestoreAfter();
    describe('GET /api/v1/templates', function() {
        setupReposAndTemplatesForTesting();
        describe('?projectStyle=', function() {
            it('should return at least the default Codewind templates as no projectStyle is given', async function() {
                const res = await getTemplates();
                res.should.have.status(200).and.satisfyApiSpec;
                res.body.length.should.be.at.least(defaultCodewindTemplates.length);
            });
            it('should return only Codewind templates as projectStyle is Codewind', async function() {
                const res = await getTemplates({ projectStyle: 'Codewind' });
                res.should.have.status(200).and.satisfyApiSpec;
                res.body.forEach(template => {
                    if (template.projectStyle) {
                        template.projectStyle.should.equal('Codewind');
                    }
                });
            });
            it('should return 204 as there exists no templates with the given projectStyle', async function() {
                const res = await getTemplates({ projectStyle: 'unknownStyle' });
                res.status.should.equal(204, res.text); // print res.text if assertion fails
                res.body.should.be.empty;
            });
        });
        describe('?showEnabledOnly=', function() {
            it('should return all templates (from enabled and disabled repos)', async function() {
                const res = await getTemplates({ showEnabledOnly: false });
                res.should.have.status(200).and.satisfyApiSpec;
                res.body.length.should.be.at.least(defaultCodewindTemplates.length);
            });
            it('should return only templates from enabled repos', async function() {
                const res = await getTemplates({ showEnabledOnly: true });
                res.should.have.status(200).and.satisfyApiSpec;
                res.body.length.should.be.at.least(defaultCodewindTemplates.length);
            });
        });
    });

    describe('GET /api/v1/templates/repositories', function() {
        setupReposAndTemplatesForTesting();
        it('should return 200 and a list of available template repositories', async function() {
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
        setupReposAndTemplatesForTesting();
        describe('when trying to add a repository with', function() {
            describe('an invalid url', function() {
                it('should return 400', async function() {
                    const res = await addTemplateRepo({
                        url: '/invalid/url',
                        description: 'Invalid url.',
                    });
                    res.status.should.equal(400, res.text); // print res.text if assertion fails
                });
            });
            describe('a duplicate url', function() {
                it('should return 400', async function() {
                    // Arrange
                    const res = await getTemplateRepos();
                    const originalTemplateRepos = res.body;
                    const duplicateRepoUrl = originalTemplateRepos[0].url;
                    // Act
                    const duplicateUrlRes = await addTemplateRepo({
                        url: duplicateRepoUrl,
                        description: 'duplicate url',
                    });
                    // Assert
                    duplicateUrlRes.should.have.status(400, duplicateUrlRes.text);
                });
            });
            describe('a valid url that does not point to an index.json', function() {
                it('should return 400', async function() {
                    const res = await addTemplateRepo({
                        url: validUrlNotPointingToIndexJson,
                        description: 'valid url that does not point to an index.json',
                    });
                    res.status.should.equal(400, res.text); // print res.text if assertion fails
                });
            });
            describe('a valid url', function() {
                let originalTemplateReposLength;
                let originalTemplatesLength;
                before(async function() {
                    await deleteTemplateRepo(sampleRepos.codewind.url);
                    const { body: repos } = await getTemplateRepos();
                    originalTemplateReposLength = repos.length;

                    const { body: templates } = await getTemplates();
                    originalTemplatesLength = templates.length;
                });
                it('should add a template repository and update the templates', async function() {
                    const addTemplateRepoRes = await addTemplateRepo(sampleRepos.codewind);
                    addTemplateRepoRes.should.have.status(200).and.satisfyApiSpec;
                    addTemplateRepoRes.body.should.deep.containSubset([sampleRepos.codewind]);
                    addTemplateRepoRes.body.length.should.equal(originalTemplateReposLength + 1);

                    const getTemplatesRes = await getTemplates();
                    getTemplatesRes.should.have.status(200).and.satisfyApiSpec;
                    getTemplatesRes.body.length.should.be.above(originalTemplatesLength);
                });
            });
        });
    });

    describe('DELETE /api/v1/templates/repositories', function() {
        setupReposAndTemplatesForTesting();
        it('DELETE should try to remove a template repository that doesn\'t exist', async function() {
            const res = await deleteTemplateRepo('http://something.com/index.json');
            res.status.should.equal(404, res.text); // print res.text if assertion fails
        });
        it('DELETE removes a template repository', async function() {
            const res = await deleteTemplateRepo(sampleRepos.codewind.url);
            res.should.have.status(200);
        });
    });

    describe('DELETE | GET | POST /api/v1/templates/repositories', function() {
        // Save state for this test
        setupReposAndTemplatesForTesting();
        const repo = sampleRepos.codewind;
        let originalTemplateRepos;
        let originalTemplates;
        let originalNumTemplates;
        before(async function() {
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
            const res = await getTemplates();
            res.should.have.status(200).and.satisfyApiSpec;
            res.body.should.not.deep.include(originalTemplates);
            res.body.length.should.be.below(originalNumTemplates);
        });
        it('POST /api/v1/templates should re-add the deleted template repository', async function() {
            const res = await addTemplateRepo(repo);
            res.should.have.status(200).and.satisfyApiSpec;
            res.body.should.containSubset([repo]);
            res.body.length.should.equal(originalTemplateRepos.length);
        });
        it('GET /api/v1/templates should return the original templates', async function() {
            const res = await getTemplates();
            res.should.have.status(200).and.satisfyApiSpec;
            res.body.should.deep.equalInAnyOrder(originalTemplates);
            res.body.length.should.equal(originalNumTemplates);
        });
    });
    describe('PATCH /api/v1/batch/templates/repositories', function() {
        setupReposAndTemplatesForTesting();
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
        setupReposAndTemplatesForTesting();
        it('should return a list of available template styles', async function() {
            const res = await getTemplateStyles();
            res.should.have.status(200).and.satisfyApiSpec;
            res.body.should.have.members(['Codewind', 'Appsody']);
        });
    });
});
