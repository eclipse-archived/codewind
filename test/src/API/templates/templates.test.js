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
    describe.skip('GET /api/v1/templates', function() {
        describe('?projectStyle=', function() {
            describe('empty', function() {
                it('should return a list of all available templates which should be atleast the number of default Codewind ones', async function() {
                    this.timeout(testTimeout.short);
                    const res = await getTemplates();
                    res.should.have.status(200).and.satisfyApiSpec;
                    res.body.length.should.be.above(defaultCodewindTemplates.length);
                });
            });
            describe('Codewind', function() {
                it('should return only Codewind templates', async function() {
                    this.timeout(testTimeout.short);
                    const res = await getTemplates({ projectStyle: 'Codewind' });
                    res.should.have.status(200).and.satisfyApiSpec;
                    res.body.forEach(template => {
                        if (template.projectStyle) {
                            template.projectStyle.should.equal('Codewind');
                        }
                    });
                });
            });
            describe('unknownStyle', function() {
                it('should return 204', async function() {
                    this.timeout(testTimeout.short);
                    const res = await getTemplates({ projectStyle: 'unknownStyle' });
                    res.should.have.status(204);
                    res.body.should.be.empty;
                });
            });
        });
        describe('?showEnabledOnly=', function() {
            describe('false', function() {
                it('should return all templates (from enabled and disabled repos)', async function() {
                    this.timeout(testTimeout.short);
                    const res = await getTemplates({ showEnabledOnly: false });
                    res.should.have.status(200).and.satisfyApiSpec;
                    res.body.length.should.be.above(defaultCodewindTemplates.length);
                });
            });
            describe('true', function() {
                it('should return only templates from enabled repos', async function() {
                    this.timeout(testTimeout.short);
                    const res = await getTemplates({ showEnabledOnly: true });
                    res.should.have.status(200).and.satisfyApiSpec;
                    res.body.length.should.be.above(defaultCodewindTemplates.length);
                });
            });
        });
    });

    describe.skip('GET /api/v1/templates/repositories', function() {
        saveReposBeforeTestAndRestoreAfter();
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
                element.should.contain.keys('id', 'name', 'description', 'url', 'projectStyles', 'enabled', 'protected');
                delete element.id;
            }
            res.should.have.status(200).and.satisfyApiSpec;
            res.body.should.deep.containSubset([sampleRepos.codewind]);
        });
    });

    describe.skip('POST /api/v1/templates/repositories', function() {
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
                saveReposBeforeTestAndRestoreAfter();
                let originalTemplateReposLength;
                before(async function() {
                    this.timeout(testTimeout.short);
                    const { body: repos } = await getTemplateRepos();
                    originalTemplateReposLength = repos.length;                    
                });
                it('should add a template repository', async function() {
                    this.timeout(testTimeout.short);
                    const repoToAdd = {
                        url: 'https://github.com/kabanero-io/collections/releases/download/0.3.0/kabanero-index.json',
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
        saveReposBeforeTestAndRestoreAfter();
        const repoToDelete = sampleRepos.codewind;
        const repoToAdd = {
            url: 'https://raw.githubusercontent.com/codewind-resources/codewind-templates/aad4bafc14e1a295fb8e462c20fe8627248609a3/devfiles/index.json',
            description: 'Additional Codewind templates.',
            protected: false,
        };
        let originalTemplateRepos;
        let originalNumTemplates;
        before(async function() {
            this.timeout(testTimeout.short);
            const { body: repos } = await getTemplateRepos();
            console.log(repos);
            
            originalTemplateRepos = repos;
            const { body: templates } = await getTemplates();
            originalNumTemplates = templates.length;
            
        });
        // after(async function() {
        //     this.timeout(testTimeout.short);
        //     await setTemplateReposTo(originalTemplateRepos);
        // });
        // Test deleting repos
        it('DELETE should try to remove a template repository that doesn\'t exist', async function() {
            const res = await deleteTemplateRepo('http://something.com/index.json');
            console.log(res.body);
            
            res.should.have.status(200).and.satisfyApiSpec;
            res.body.should.not.deep.include(repoToDelete);
            res.body.length.should.equal(originalTemplateRepos.length - 1);
        });
        it.skip('DELETE should remove a template repository', async function() {
            const res = await deleteTemplateRepo(repoToDelete.url);
            console.log(res.body);
            
            res.should.have.status(200).and.satisfyApiSpec;
            res.body.should.not.deep.include(repoToDelete);
            res.body.length.should.equal(originalTemplateRepos.length - 1);
        });
        it.skip('GET /api/v1/templates should return fewer templates', async function() {
            this.timeout(testTimeout.short);
            const res = await getTemplates();
            console.log(res.body);
            
            res.should.have.status(200).and.satisfyApiSpec;
            console.log('new length', res.body.length);
            
            res.body.length.should.be.below(originalNumTemplates);
        });
        // Test adding repos
        it.skip('POST should re-add the deleted template repository', async function() {
            this.timeout(testTimeout.short);
            const res = await addTemplateRepo(repoToDelete);
            res.should.have.status(200).and.satisfyApiSpec;
            res.body.should.deep.include(repoToDelete);
            res.body.length.should.equal(originalTemplateRepos.length);
        });
        it.skip('should return the original list of available templates', async function() {
            this.timeout(testTimeout.short);
            const res = await getTemplates();
            res.should.have.status(200).and.satisfyApiSpec;
            res.body.length.should.equal(originalNumTemplates);
        });
        it.skip('POST should add a 2nd template repository', async function() {
            this.timeout(testTimeout.short);
            const res = await addTemplateRepo(repoToAdd);
            res.should.have.status(200).and.satisfyApiSpec;
            res.body.should.deep.include({
                ...repoToAdd,
                enabled: true,
                projectStyles: ['Codewind'],
            });
            res.body.length.should.equal(originalTemplateRepos.length + 1);
        });
        it.skip('should return a longer list of available templates', async function() {
            this.timeout(testTimeout.short);
            const res = await getTemplates();
            res.should.have.status(200).and.satisfyApiSpec;
            res.body.length.should.be.above(originalNumTemplates);
        });
    });
    // describe('PATCH /api/v1/batch/templates/repositories', function() {
    //     const existingRepoUrl = sampleRepos.fromAppsodyExtension.url;
    //     const tests = {
    //         'enable an existing repo': {
    //             input: [{
    //                 op: 'enable',
    //                 url: existingRepoUrl,
    //                 value: 'true',
    //             }],
    //             output: [{
    //                 status: 200,
    //                 requestedOperation: {
    //                     op: 'enable',
    //                     url: existingRepoUrl,
    //                     value: 'true',
    //                 },
    //             }],
    //         },
    //         'disable an existing repo': {
    //             input: [{
    //                 op: 'enable',
    //                 url: existingRepoUrl,
    //                 value: 'false',
    //             }],
    //             output: [{
    //                 status: 200,
    //                 requestedOperation: {
    //                     op: 'enable',
    //                     url: existingRepoUrl,
    //                     value: 'false',
    //                 },
    //             }],
    //         },
    //         'enable an unknown repo': {
    //             input: [{
    //                 op: 'enable',
    //                 url: 'unknownRepoUrl',
    //                 value: 'true',
    //             }],
    //             output: [{
    //                 status: 404,
    //                 error: 'Unknown repository URL',
    //                 requestedOperation: {
    //                     op: 'enable',
    //                     url: 'unknownRepoUrl',
    //                     value: 'true',
    //                 },
    //             }],
    //         },
    //         'disable an unknown repo': {
    //             input: [{
    //                 op: 'enable',
    //                 url: 'unknownRepoUrl',
    //                 value: 'false',
    //             }],
    //             output: [{
    //                 status: 404,
    //                 error: 'Unknown repository URL',
    //                 requestedOperation: {
    //                     op: 'enable',
    //                     url: 'unknownRepoUrl',
    //                     value: 'false',
    //                 },
    //             }],
    //         },
    //     };
    //     saveReposBeforeEachTestAndRestoreAfterEach();
    //     for (const [testName, test] of Object.entries(tests)) {
    //         describe(`to ${testName}`, function() {
    //             it(`should return 207 and the expected operations info`, async function() {
    //                 const res = await batchPatchTemplateRepos(test.input);
    //                 res.should.have.status(207).and.satisfyApiSpec;
    //                 res.body.should.deep.equal(test.output);
    //             });
    //         });
    //     }
    // });
    // describe('GET /api/v1/templates/styles', function() {
    //     it('should return a list of available template styles', async function() {
    //         this.timeout(testTimeout.short);
    //         const res = await getTemplateStyles();
    //         res.should.have.status(200).and.satisfyApiSpec;
    //         res.body.should.have.members(['Codewind', 'Appsody']);
    //     });
    // });
});
