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

const {
    defaultTemplates,
    batchPatchTemplateRepos,
    getTemplateRepos,
    getTemplates,
    addTemplateRepo,
    deleteTemplateRepo,
    resetTemplateReposTo,
    getTemplateStyles,
} = require('../modules/template.service');
const { pathToApiSpec } = require('../config');

chai.should();
chai.use(chaiResValidator(pathToApiSpec));
const expectedLanguages = ['java', 'swift', 'nodejs', 'go', 'python'];

describe('Template API tests', function() {
    describe.skip('GET /api/v1/templates', function() {
        describe('?projectStyle=', function() {
            describe('empty', function() {
                it('should return a list of all available templates', async function() {
                    const res = await getTemplates();
                    res.should.have.status(200).and.satisfyApiSpec;
                    res.body.should.deep.equal(defaultTemplates);
                    // check that we have a template for each supported language
                    res.body.map((template) => template.language).should.include.members(expectedLanguages);
                });
            });
            for (const projectStyle of ['Codewind']) {  // TODO: add 'Appsody' when we ship Appsody templates by default
                describe(projectStyle, function() {
                    it(`should return only ${projectStyle} templates`, async function() {
                        const res = await getTemplates({ projectStyle });
                        res.should.have.status(200).and.satisfyApiSpec;
                        // check that we have a template for each supported language
                        res.body.map((template) => template.language).should.include.members(expectedLanguages);
                    });
                });
            }
            describe('unknownStyle', function() {
                it('should return 204', async function() {
                    const res = await getTemplates({ projectStyle: 'unknownStyle' });
                    res.should.have.status(204);
                });
            });
        });
        describe('?showEnabledOnly=', function() {
            describe('false', function() {
                it('should return all templates (from enabled and disabled repos)', async function() {
                    const res = await getTemplates({ showEnabledOnly: false });
                    res.should.have.status(200).and.satisfyApiSpec;
                    res.body.should.deep.equal(defaultTemplates);
                });
            });
            describe('true', function() {
                it('should return only templates from enabled repos', async function() {
                    const res = await getTemplates({ showEnabledOnly: true });
                    res.should.have.status(200).and.satisfyApiSpec;
                    res.body.should.deep.equal(defaultTemplates);
                });
            });
        });
    });

    describe.skip('GET|POST|DELETE /api/v1/templates/repositories', function() {
        const expectedUrl = 'https://raw.githubusercontent.com/kabanero-io/codewind-templates/master/devfiles/index.json';
        const testUrl = 'https://raw.githubusercontent.com/kabanero-io/codewind-templates/aad4bafc14e1a295fb8e462c20fe8627248609a3/devfiles/index.json';
        let originalTemplateRepos;
        before(async() => {
            const res = await getTemplateRepos();
            originalTemplateRepos = res.body;
        });
        after(async() => {
            await resetTemplateReposTo(originalTemplateRepos);
        });
        it('GET should return a list of available templates repositories', async function() {
            const res = await getTemplateRepos();
            res.should.have.status(200).and.satisfyApiSpec;
            res.body.should.be.an('array').with.length(1);
        });
        it('POST should fail to add template repository with a bad url', async function() {
            const res = await addTemplateRepo({
                url: '/home/user/directory',
                description: 'Bad template url.',
            });
            res.should.have.status(400);
        });
        it('POST should fail to add template repository with a duplicate url', async function() {
            const res = await addTemplateRepo({
                url: originalTemplateRepos[0].url,
                description: 'Duplicate template URL',
            });
            res.should.have.status(400);
        });
        it('DELETE should remove a template repository', async function() {
            const res = await deleteTemplateRepo(expectedUrl);
            res.should.have.status(200).and.satisfyApiSpec;
            res.body.should.be.an('array').with.length(0);
        });
        it('GET /api/v1/templates should return an empty list of templates', async function() {
            const res = await getTemplates();
            res.should.have.status(204);
        });
        it('POST should add a template repository', async function() {
            const res = await addTemplateRepo({
                url: expectedUrl,
                description: 'Default codewind templates.',
            });
            res.should.have.status(200).and.satisfyApiSpec;
            res.body.should.be.an('array').with.length(1);
        });
        let firstLength;
        it('should return a list of available templates', async function() {
            const res = await getTemplates();
            res.should.have.status(200).and.satisfyApiSpec;
            res.body.should.be.an('array');
            firstLength = res.body.length;
        });
        it('POST should add a second template repository', async function() {
            const res = await addTemplateRepo({
                url: testUrl,
                description: 'Copy of default codewind templates.',
            });
            res.should.have.status(200).and.satisfyApiSpec;
            res.body.should.be.an('array').with.length(2);
        });
        it('should return longer list of available templates', async function() {
            const res = await getTemplates();
            res.should.have.status(200).and.satisfyApiSpec;
            // There are 6 templates listed in the revision referenced by testUrl
            res.body.should.be.an('array').with.length(firstLength + 7);
        });
        it('DELETE should remove second repository', async function() {
            const res = await deleteTemplateRepo(testUrl);
            res.should.have.status(200).and.satisfyApiSpec;
            res.body.should.be.an('array').with.length(1);
        });
        it('should return initial list of available templates', async function() {
            const res = await getTemplates();
            res.should.have.status(200).and.satisfyApiSpec;
            res.body.should.be.an('array').with.length(firstLength);
        });
    });
    describe('PATCH /api/v1/batch/templates/repositories', function() {
        const existingRepoUrl = 'https://raw.githubusercontent.com/kabanero-io/codewind-templates/master/devfiles/index.json';
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
        let originalTemplateRepos;
        beforeEach(async() => {
            const res = await getTemplateRepos();
            originalTemplateRepos = res.body;
        });
        afterEach(async() => {
            await resetTemplateReposTo(originalTemplateRepos);
        });
        for (const [testName, test] of Object.entries(tests)) {
            describe(`to ${testName}`, function() {
                it(`should return 207 and the expected operations info`, async function() {
                    const res = await batchPatchTemplateRepos(test.input);
                    res.should.have.status(207).and.satisfyApiSpec;
                    res.body.should.deep.equal(test.output);
                });
            });
        }
    });
    describe('GET /api/v1/templates/styles', function() {
        it('should return a list of available template styles', async function() {
            const res = await getTemplateStyles();
            res.should.have.status(200).and.satisfyApiSpec;
            res.body.should.deep.equal(['Codewind']);  // TODO: add 'Appsody' when we ship Appsody templates by default
        });
    });
});
