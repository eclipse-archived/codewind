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

const reqService = require('../modules/request.service');
const { ADMIN_COOKIE, WORKSPACE_DIR } = require('../config');

chai.should();

const expectedLanguages = ['java', 'swift', 'nodejs', 'go', 'python'];

describe('Template API tests', function() {
    describe(`GET /api/v1/templates`, function() {
        it('should return a list of available templates', async function() {
            const res = await reqService.chai
                .get('/api/v1/templates')
                .set('Cookie', ADMIN_COOKIE);
            res.should.have.status(200);
            res.body.should.be.an('array');
            // check that all items have the expected keys
            res.body.forEach((template) => {
                template.should.be.an('object');
                template.should.include.all.keys('label', 'description', 'url', 'language');
            });
            // check that we have a template for each supported language
            res.body.map((template) => template.language).should.include.members(expectedLanguages);
        });
    });

    describe(`GET|POST|DELETE /api/v1/templates/repositories`, function() {
        const expectedUrl = 'https://raw.githubusercontent.com/kabanero-io/codewind-templates/master/devfiles/index.json';
        const testUrl = 'https://raw.githubusercontent.com/kabanero-io/codewind-templates/aad4bafc14e1a295fb8e462c20fe8627248609a3/devfiles/index.json';
        it('GET should return a list of available templates repositories', async function() {
            const res = await reqService.chai
                .get('/api/v1/templates/repositories')
                .set('Cookie', ADMIN_COOKIE);
            res.should.have.status(200);
            res.body.should.be.an('array');
            res.body.should.have.length(1);
            // check that all items have the expected keys
            res.body.forEach((repository) => {
                repository.should.be.an('object');
                repository.should.include.all.keys('description', 'url');
            });
        });
        it('POST should fail to add template with a bad url', async function() {
            const res = await reqService.chai
                .post('/api/v1/templates/repositories')
                .set('Cookie', ADMIN_COOKIE)
                .send({
                    url: '/home/user/directory',
                    description: 'Bad template url.',
                });
            res.should.have.status(400);
        });
        it('DELETE should remove a repository', async function() {
            const res = await reqService.chai
                .delete('/api/v1/templates/repositories')
                .set('Cookie', ADMIN_COOKIE)
                .send({url: expectedUrl});
            res.should.have.status(200);
            res.body.should.be.an('array');
            res.body.should.have.length(0);
        });
        it('GET /api/v1/templates should return an empty list of templates', async function() {
            const res = await reqService.chai
                .get('/api/v1/templates')
                .set('Cookie', ADMIN_COOKIE);
            res.should.have.status(204);
        });
        it('POST should add a template repository', async function() {
            const res = await reqService.chai
                .post('/api/v1/templates/repositories')
                .set('Cookie', ADMIN_COOKIE)
                .send({
                    url: expectedUrl,
                    description: 'Default codewind templates.',
                });
            res.should.have.status(200);
            res.body.should.be.an('array');
            res.body.should.have.length(1);
            // check that all items have the expected keys
            res.body.forEach((repository) => {
                repository.should.be.an('object');
                repository.should.include.all.keys('description', 'url');
            });
        });
        let firstLength;
        it('should return a list of available templates', async function() {
            const res = await reqService.chai
                .get('/api/v1/templates')
                .set('Cookie', ADMIN_COOKIE);
            res.should.have.status(200);
            res.body.should.be.an('array');
            // check that all items have the expected keys
            res.body.forEach((template) => {
                template.should.be.an('object');
                template.should.include.all.keys('label', 'description', 'url', 'language');
            });
            firstLength = res.body.length;
            // check that we have a template for each supported language
            res.body.map((template) => template.language).should.include.members(expectedLanguages);
        });
        it('POST should add a second template repository', async function() {
            const res = await reqService.chai
                .post('/api/v1/templates/repositories')
                .set('Cookie', ADMIN_COOKIE)
                .send({
                    url: testUrl,
                    description: 'Copy of default codewind templates.',
                });
            res.should.have.status(200);
            res.body.should.be.an('array');
            res.body.should.have.length(2);
            // check that all items have the expected keys
            res.body.forEach((repository) => {
                repository.should.be.an('object');
                repository.should.include.all.keys('description', 'url');
            });
        });
        it('should return longer list of available templates', async function() {
            const res = await reqService.chai
                .get('/api/v1/templates')
                .set('Cookie', ADMIN_COOKIE);
            res.should.have.status(200);
            res.body.should.be.an('array');
            // check that all items have the expected keys
            res.body.forEach((template) => {
                template.should.be.an('object');
                template.should.include.all.keys('label', 'description', 'url', 'language');
            });
            // There are 6 templates listed in the revision referenced by testUrl
            res.body.should.have.length(firstLength + 7);
            // check that we have a template for each supported language
            res.body.map((template) => template.language).should.include.members(expectedLanguages);
        });
        it('DELETE should remove second repository', async function() {
            const res = await reqService.chai
                .delete('/api/v1/templates/repositories')
                .set('Cookie', ADMIN_COOKIE)
                .send({ url: testUrl });
            res.should.have.status(200);
            res.body.should.be.an('array');
            res.body.should.have.length(1);
        });
        it('should return initial list of available templates', async function() {
            const res = await reqService.chai
                .get('/api/v1/templates')
                .set('Cookie', ADMIN_COOKIE);
            res.should.have.status(200);
            res.body.should.be.an('array');
            // check that all items have the expected keys
            res.body.forEach((template) => {
                template.should.be.an('object');
                template.should.include.all.keys('label', 'description', 'url', 'language');
            });
            res.body.should.have.length(firstLength);
            // check that we have a template for each supported language
            res.body.map((template) => template.language).should.include.members(expectedLanguages);
        });
    });

    describe('Unit tests for Templates.js', function() {

        let templates;
        let expected;

        before(async function() {
            
            global.codewind = { RUNNING_IN_K8S: false };

            const Templates = require('../../src/pfe/portal/modules/Templates');
            templates = new Templates(WORKSPACE_DIR);

            await templates.initializeRepositoryList();
            expected = (await templates.getTemplateList()).length;
        });

        it('getTemplateList should ignore invalid template providers', async function() {

            // null provider is ignored
            templates.addProvider('null', null);

            // empty provider is ignored (no getRepositories function)
            templates.addProvider('empty', {});

            const list = await templates.getTemplateList();
            list.length.should.equal(expected);
        });

        it('getTemplateList should ignore invalid or duplicate repository entries from template provider', async function() {

            // add a template provider that returns the wrong type
            templates.addProvider('invalid_provider', {
                getRepositories: async function() {
                    return 'wrong type';
                }
            });

            // add a template provider that contains invalid or duplicate entries
            templates.addProvider('invalid_provider', {
                getRepositories: async function() {
                    return [
                        'wrong type',
                        { description: 'missing url'},
                        {
                            url: 'https://raw.githubusercontent.com/kabanero-io/codewind-templates/master/devfiles/index.json',
                            description: 'duplicate repo'
                        }
                    ];
                }
            });

            const list = await templates.getTemplateList();
            list.length.should.equal(expected);
        });

        it('getTemplateList should include additional templates from template provider', async function() {

            // add a template provider that returns a valid entry
            templates.addProvider('valid_provider', {
                getRepositories: async function() {
                    return [
                        {
                            url: 'https://raw.githubusercontent.com/kabanero-io/codewind-templates/aad4bafc14e1a295fb8e462c20fe8627248609a3/devfiles/index.json',
                            description: 'valid repo'
                        }
                    ];
                }
            });

            const list = await templates.getTemplateList();
            list.length.should.be.above(expected);
        });
    });
});
