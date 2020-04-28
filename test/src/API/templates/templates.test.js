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
    getDefaultTemplatesFromGithub,
    validUrlNotPointingToIndexJson,
    sampleRepos,
    gheCredentials,
    batchPatchTemplateRepos,
    getTemplateRepos,
    getNumberOfTemplates,
    getTemplates,
    addTemplateRepo,
    deleteTemplateRepo,
    getTemplateStyles,
    saveReposBeforeTestAndRestoreAfter,
    saveReposBeforeEachTestAndRestoreAfterEach,
    setupReposAndTemplatesForTesting,
    getNumberOfEnabledTemplates,
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
    let defaultCodewindTemplates;
    before(async function() {
        defaultCodewindTemplates = await getDefaultTemplatesFromGithub();
    });
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
        describe('when trying to add a public repository', function() {
            it('fails with 400 when given an invalid url', async function() {
                const res = await addTemplateRepo({
                    url: '/invalid/url',
                    description: 'Invalid url.',
                });
                res.status.should.equal(400, res.text);
            });
            it('fails with 400 when given an duplicate url', async function() {
                const { body: [existingRepo] } = await getTemplateRepos();
                const res = await addTemplateRepo({
                    url: existingRepo.url,
                    description: 'duplicate url',
                });
                res.should.have.status(400, res.text);
            });
            it('fails with 400 when given a valid url that does not point to an index.json', async function() {
                const res = await addTemplateRepo({
                    url: validUrlNotPointingToIndexJson,
                    description: 'valid url that does not point to an index.json',
                });
                res.status.should.equal(400, res.text);
            });
            it('succeeds with 200 when given a valid url and enabled', async function() {
                // setup
                await deleteTemplateRepo(sampleRepos.codewind.url);
                const { body: originalRepos } = await getTemplateRepos();
                const originalNumTemplates = await getNumberOfTemplates();

                // test
                const resToAddRepoRequest = await addTemplateRepo(sampleRepos.codewind);
                resToAddRepoRequest.should.have.status(200).and.satisfyApiSpec;
                resToAddRepoRequest.body.should.deep.containSubset([sampleRepos.codewind]);
                resToAddRepoRequest.body.should.have.length(originalRepos.length + 1);

                // Then GET /templates should return the templates from the repository we just added
                const getTemplatesRes = await getTemplates();
                getTemplatesRes.body.length.should.be.above(originalNumTemplates);
            });
            it('succeeds with 200 when given a valid url but disabled', async function() {
                // setup
                await deleteTemplateRepo(sampleRepos.codewind.url);
                const { body: originalRepos } = await getTemplateRepos();
                const originalNumTemplates = await getNumberOfTemplates();
                const originalNumEnabledTemplates = await getNumberOfEnabledTemplates();

                // test
                const resToAddRepoRequest = await addTemplateRepo(sampleRepos.disabledcodewind);
                resToAddRepoRequest.should.have.status(200).and.satisfyApiSpec;
                resToAddRepoRequest.body.should.deep.containSubset([sampleRepos.disabledcodewind]);
                resToAddRepoRequest.body.should.have.length(originalRepos.length + 1);

                const newNumTemplates = await getNumberOfTemplates();
                newNumTemplates.should.be.above(originalNumTemplates);

                const newNumEnabledTemplates = await getNumberOfEnabledTemplates();
                newNumEnabledTemplates.should.equal(originalNumEnabledTemplates);
            });
        });
        describe('when trying to add a GHE repository with', function() {
            it('fails with 400 when not given GitHub credentials', async function() {
                const res = await addTemplateRepo(sampleRepos.GHE);
                res.should.have.status(400).and.satisfyApiSpec;
                res.text.should.include(sampleRepos.GHE.url);
            });
            it('fails with 400 when given GitHub username but no password', async function() {
                const res = await addTemplateRepo({
                    ...sampleRepos.GHE,
                    gitCredentials: {
                        username: gheCredentials.basic.username,
                        // no password
                    },
                });
                res.should.have.status(400).and.satisfyApiSpec;
                res.text.should.include('Error while validating request: request.body.gitCredentials should have required property \'password\'');
            });
            it('fails with 400 when given GitHub password but no username', async function() {
                const res = await addTemplateRepo({
                    ...sampleRepos.GHE,
                    gitCredentials: {
                        password: 'validPassword',
                        // no username
                    },
                });
                res.should.have.status(400).and.satisfyApiSpec;
                res.text.should.include('Error while validating request: request.body.gitCredentials should have required property \'username\'');
            });
            it('fails with 400 when given unexpected `gitCredentials` field', async function() {
                const res = await addTemplateRepo({
                    ...sampleRepos.GHE,
                    gitCredentials: {
                        unexpected: 'field',
                    },
                });
                res.should.have.status(400).and.satisfyApiSpec;
                res.text.should.include('Error while validating request: request.body.gitCredentials should NOT have additional properties');
            });
            it('fails with 400 when given incorrect GHE basic credentials', async function() {
                const res = await addTemplateRepo({
                    ...sampleRepos.GHE,
                    gitCredentials: {
                        username: gheCredentials.basic.username,
                        password: 'incorrectPassword',
                    },
                });
                res.should.have.status(400).and.satisfyApiSpec;
                res.text.should.include(sampleRepos.GHE.url);
            });
            it('fails with 400 when given incorrect GHE Personal Access Token', async function() {
                const res = await addTemplateRepo({
                    ...sampleRepos.GHE,
                    gitCredentials: {
                        personalAccessToken: 'incorrectPersonalAccessToken',
                    },
                });
                res.should.have.status(400).and.satisfyApiSpec;
                res.text.should.include(sampleRepos.GHE.url);
            });
            it('succeeds with 200 when given correct GHE basic credentials', async function() {
                if (!gheCredentials.basic.password) {
                    this.skip();
                }

                const { body: originalTemplates } = await getTemplates();

                const res = await addTemplateRepo({
                    ...sampleRepos.GHE,
                    gitCredentials: gheCredentials.basic,
                });
                res.should.have.status(200).and.satisfyApiSpec;
                res.body.should.containSubset([sampleRepos.GHE]);

                // Then GET /templates should return the templates from the repository we just added
                const resToGetRequest = await getTemplates();
                resToGetRequest.should.have.status(200).and.satisfyApiSpec;
                resToGetRequest.body.should.have.length.above(originalTemplates.length);

                // cleanup
                const resToDeleteRequest = await deleteTemplateRepo(sampleRepos.GHE.url);
                resToDeleteRequest.should.have.status(200).and.satisfyApiSpec;
            });
            it('succeeds with 200 when given correct GHE Personal Access Token', async function() {
                if (!gheCredentials.personalAccessToken) {
                    this.skip();
                }

                const { body: originalTemplates } = await getTemplates();

                const res = await addTemplateRepo({
                    ...sampleRepos.GHE,
                    gitCredentials: {
                        personalAccessToken: gheCredentials.personalAccessToken,
                    },
                });
                res.should.have.status(200).and.satisfyApiSpec;
                res.body.should.containSubset([sampleRepos.GHE]);

                // Then GET /templates should return the templates from the repository we just added
                const resToGetRequest = await getTemplates();
                resToGetRequest.should.have.status(200).and.satisfyApiSpec;
                resToGetRequest.body.should.have.length.above(originalTemplates.length);

                // cleanup
                const resToDeleteRequest = await deleteTemplateRepo(sampleRepos.GHE.url);
                resToDeleteRequest.should.have.status(200).and.satisfyApiSpec;
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
        setupReposAndTemplatesForTesting();
        const repo = sampleRepos.codewind;
        let originalTemplateRepos;
        let originalTemplates;
        before(async function() {
            const { body: repos } = await getTemplateRepos();
            originalTemplateRepos = repos;
            const { body: templates } = await getTemplates();
            originalTemplates = templates;
        });
        it('DELETE /api/v1/templates should remove a template repository', async function() {
            const res = await deleteTemplateRepo(repo.url);
            res.should.have.status(200).and.satisfyApiSpec;
            res.body.should.not.deep.include(repo);
            res.body.length.should.equal(originalTemplateRepos.length - 1);
        });
        it('GET /api/v1/templates should return fewer templates', async function() {
            const numberOfTemplates = await getNumberOfTemplates();
            numberOfTemplates.should.be.below(originalTemplates.length);
        });
        it('POST /api/v1/templates/repositories should re-add the deleted template repository', async function() {
            const res = await addTemplateRepo(repo);
            res.should.have.status(200).and.satisfyApiSpec;
            res.body.should.containSubset([repo]);
            res.body.length.should.equal(originalTemplateRepos.length);
        });
        it('GET /api/v1/templates should return the original templates', async function() {
            const res = await getTemplates();
            res.should.have.status(200).and.satisfyApiSpec;
            res.body.should.deep.equalInAnyOrder(originalTemplates);
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
            res.body.should.include.members(['Codewind']);
        });
    });
});
