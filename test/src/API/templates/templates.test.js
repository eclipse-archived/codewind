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
    defaultRepoList,
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
const { pathToApiSpec } = require('../../../config');

chai.should();
chai.use(chaiResValidator(pathToApiSpec));

describe('Template API tests', function() {
    saveReposBeforeTestAndRestoreAfter();
    before(async() => {
        await setTemplateReposTo([{ ...sampleRepos.codewind }]);
    });
    describe('GET /api/v1/templates', function() {
        describe('?projectStyle=', function() {
            describe('empty', function() {
                it('should return a list of all available templates', async function() {
                    this.timeout(10000);
                    const res = await getTemplates();
                    res.should.have.status(200).and.satisfyApiSpec;
                    res.body.length.should.equal(defaultTemplates.length);
                });
            });
            describe('Codewind', function() {
                it('should return only Codewind templates', async function() {
                    this.timeout(10000);
                    const res = await getTemplates({ projectStyle: 'Codewind' });
                    res.should.have.status(200).and.satisfyApiSpec;
                    res.body.forEach(template => {
                        if (template.projectStyle) {
                            template.projectStyle.should.equal('Codewind');
                        }
                    });
                });
            });
            for (const projectStyle of ['Appsody']) {
                describe(projectStyle, function() {
                    it(`should return only ${projectStyle} templates`, async function() {
                        this.timeout(10000);
                        const res = await getTemplates({ projectStyle });
                        res.should.have.status(200).and.satisfyApiSpec;
                        res.body.forEach(template =>
                            template.projectStyle.should.equal(projectStyle)
                        );
                    });
                });
            }
            describe('unknownStyle', function() {
                it('should return 204', async function() {
                    this.timeout(10000);
                    const res = await getTemplates({ projectStyle: 'unknownStyle' });
                    res.should.have.status(204);
                    res.body.should.be.empty;
                });
            });
        });
        describe('?showEnabledOnly=', function() {
            describe('false', function() {
                it('should return all templates (from enabled and disabled repos)', async function() {
                    this.timeout(10000);
                    const res = await getTemplates({ showEnabledOnly: false });
                    res.should.have.status(200).and.satisfyApiSpec;
                    res.body.length.should.equal(defaultTemplates.length);
                });
            });
            describe('true', function() {
                it('should return only templates from enabled repos', async function() {
                    this.timeout(10000);
                    const res = await getTemplates({ showEnabledOnly: true });
                    res.should.have.status(200).and.satisfyApiSpec;
                    res.body.length.should.equal(defaultTemplates.length);
                });
            });
        });
    });

    describe('POST /api/v1/templates/repositories', function() {
        describe('when trying to add a repository with', function() {
            describe('an invalid url', function() {
                it('should return 400', async function() {
                    const res = await addTemplateRepo({
                        url: '/invalid/url',
                        description: 'Invalid url.',
                    });
                    res.should.have.status(400);
                });
            });
            describe('a duplicate url', function() {
                it('should return 400', async function() {
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
                    const res = await addTemplateRepo({
                        url: validUrlNotPointingToIndexJson,
                        description: 'valid url that does not point to an index.json',
                    });
                    res.should.have.status(400);
                });
            });
        });
    });

    describe('GET|POST|DELETE /api/v1/templates/repositories', function() {
        const repoToDelete = sampleRepos.codewind;
        const repoToAdd = sampleRepos.anotherCodewind;
        let originalTemplateRepos;
        let originalNumTemplates;
        before(async function() {
            this.timeout(10000);
            const res = await getTemplateRepos();
            originalTemplateRepos = res.body;

            const res2 = await getTemplates();
            originalNumTemplates = res2.body.length;
        });
        after(async() => {
            await setTemplateReposTo(originalTemplateRepos);
        });
        it('GET should return a list of available template repositories', async function() {
            this.timeout(10000);
            const res = await getTemplateRepos();
            res.should.have.status(200).and.satisfyApiSpec;
            res.body.should.have.deep.members(defaultRepoList);
        });
        // Test deleting repos
        it('DELETE should remove a template repository', async function() {
            const res = await deleteTemplateRepo(repoToDelete.url);
            res.should.have.status(200).and.satisfyApiSpec;
            res.body.should.not.deep.include(repoToDelete);
            res.body.length.should.equal(originalTemplateRepos.length - 1);
        });
        it('GET /api/v1/templates should return fewer templates', async function() {
            this.timeout(10000);
            const res = await getTemplates();
            res.should.have.status(200).and.satisfyApiSpec;
            res.body.length.should.be.below(originalNumTemplates);
        });
        // Test adding repos
        it('POST should re-add the deleted template repository', async function() {
            const res = await addTemplateRepo(repoToDelete);
            res.should.have.status(200).and.satisfyApiSpec;
            res.body.should.deep.include(repoToDelete);
            res.body.length.should.equal(originalTemplateRepos.length);
        });
        it('should return the original list of available templates', async function() {
            this.timeout(10000);
            const res = await getTemplates();
            res.should.have.status(200).and.satisfyApiSpec;
            res.body.length.should.equal(originalNumTemplates);
        });
        it('POST should add a 2nd template repository', async function() {
            const res = await addTemplateRepo(repoToAdd);
            res.should.have.status(200).and.satisfyApiSpec;
            res.body.should.deep.include(repoToAdd);
            res.body.length.should.equal(originalTemplateRepos.length + 1);
        });
        it('should return a longer list of available templates', async function() {
            this.timeout(10000);
            const res = await getTemplates();
            res.should.have.status(200).and.satisfyApiSpec;
            res.body.length.should.be.above(originalNumTemplates);
        });
    });
    describe('PATCH /api/v1/batch/templates/repositories', function() {
        const existingRepoUrl = sampleRepos.fromAppsodyExtension.url;
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
            this.timeout(10000);
            const res = await getTemplateStyles();
            res.should.have.status(200).and.satisfyApiSpec;
            res.body.should.have.members(['Codewind', 'Appsody']);
        });
    });
});
