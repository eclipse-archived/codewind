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
const { ADMIN_COOKIE } = require('../config');

chai.should();

const expectedLanguages = ['java', 'swift', 'nodejs', 'go', 'python'];

describe('Template API tests', function() {
    describe('GET /api/v1/templates?projectStyle=', function() {
        describe('empty', function() {
            it('should return a list of all available templates', async function() {
                const res = await getTemplates();
                res.should.have.status(200);
                res.body.should.be.an('array');
                res.body.forEach((template) => {
                    template.should.be.an('object').with.all.keys('label', 'description', 'url', 'language', 'projectType');
                });
                // check that we have a template for each supported language
                res.body.map((template) => template.language).should.include.members(expectedLanguages);
            });
        });
        for (const projectStyle of ['IBM Cloud']) {  // Add 'Appsody' when we ship them by default
            describe(projectStyle, function() {
                it(`should return only ${projectStyle} templates`, async function() {
                    const res = await getTemplates(projectStyle);
                    res.should.have.status(200);
                    res.body.should.be.an('array');
                    res.body.forEach((template) => {
                        template.should.be.an('object').with.all.keys('label', 'description', 'url', 'language', 'projectType');
                        if (template.projectStyle) template.projectStyle.should.equal(projectStyle);
                    });
                    // check that we have a template for each supported language
                    res.body.map((template) => template.language).should.include.members(expectedLanguages);
                });
            });
        }
        describe('unknownStyle', function() {
            it('should return 204', async function() {
                const res = await getTemplates('unknownStyle');
                res.should.have.status(204);
            });
        });
    });

    describe('GET|POST|DELETE /api/v1/templates/repositories', function() {
        const expectedUrl = 'https://raw.githubusercontent.com/kabanero-io/codewind-templates/master/devfiles/index.json';
        const testUrl = 'https://raw.githubusercontent.com/kabanero-io/codewind-templates/aad4bafc14e1a295fb8e462c20fe8627248609a3/devfiles/index.json';
        it('GET should return a list of available templates repositories', async function() {
            const res = await getTemplateRepositories();
            res.should.have.status(200);
            res.body.should.be.an('array').with.length(1);
            res.body.forEach((repository) => {
                repository.should.be.an('object').with.all.keys('description', 'url');
            });
        });
        it('POST should fail to add template repository with a bad url', async function() {
            const res = await addTemplateRepository({
                url: '/home/user/directory',
                description: 'Bad template url.',
            });
            res.should.have.status(400);
        });
        it('DELETE should remove a template repository', async function() {
            const res = await deleteTemplateRepository(expectedUrl);
            res.should.have.status(200);
            res.body.should.be.an('array');
            res.body.should.have.length(0);
        });
        it('GET /api/v1/templates should return an empty list of templates', async function() {
            const res = await getTemplates();
            res.should.have.status(204);
        });
        it('POST should add a template repository', async function() {
            const res = await addTemplateRepository({
                url: expectedUrl,
                description: 'Default codewind templates.',
            });
            res.should.have.status(200);
            res.body.should.be.an('array').with.length(1);
            res.body.forEach((repository) => {
                repository.should.be.an('object').with.all.keys('description', 'url');
            });
        });
        let firstLength;
        it('should return a list of available templates', async function() {
            const res = await getTemplates();
            res.should.have.status(200);
            res.body.should.be.an('array');
            res.body.forEach((repository) => {
                repository.should.be.an('object').with.all.keys('label', 'description', 'url', 'language', 'projectType');
            });
            firstLength = res.body.length;
            // check that we have a template for each supported language
            res.body.map((template) => template.language).should.include.members(expectedLanguages);
        });
        it('POST should add a second template repository', async function() {
            const res = await addTemplateRepository({
                url: testUrl,
                description: 'Copy of default codewind templates.',
            });
            res.should.have.status(200);
            res.body.should.be.an('array').with.length(2);
            res.body.forEach((repository) => {
                repository.should.be.an('object').with.all.keys('description', 'url');
            });
        });
        it('should return longer list of available templates', async function() {
            const res = await getTemplates();
            res.should.have.status(200);
            res.body.should.be.an('array');
            res.body.forEach((repository) => {
                repository.should.be.an('object').with.all.keys('label', 'description', 'url', 'language', 'projectType');
            });
            // There are 6 templates listed in the revision referenced by testUrl
            res.body.should.have.length(firstLength + 7);
            // check that we have a template for each supported language
            res.body.map((template) => template.language).should.include.members(expectedLanguages);
        });
        it('DELETE should remove second repository', async function() {
            const res = await deleteTemplateRepository(testUrl);
            res.should.have.status(200);
            res.body.should.be.an('array').with.length(1);
        });
        it('should return initial list of available templates', async function() {
            const res = await getTemplates();
            res.should.have.status(200);
            res.body.should.be.an('array');
            res.body.forEach((repository) => {
                repository.should.be.an('object').with.all.keys('label', 'description', 'url', 'language', 'projectType');
            });
            res.body.should.have.length(firstLength);
            // check that we have a template for each supported language
            res.body.map((template) => template.language).should.include.members(expectedLanguages);
        });
    });
    describe('GET /api/v1/templates/styles', function() {
        it('should return a list of available template styles', async function() {
            const res = await getTemplateStyles();
            res.should.have.status(200);
            res.body.should.deep.equal(['IBM Cloud']);  // Add 'Appsody' when we ship them by default
        });
    });
});

async function getTemplates(projectStyle) {
    const res = await reqService.chai
        .get('/api/v1/templates')
        .query({ projectStyle })
        .set('Cookie', ADMIN_COOKIE);
    return res;
}

async function getTemplateRepositories() {
    const res = await reqService.chai
        .get('/api/v1/templates/repositories')
        .set('Cookie', ADMIN_COOKIE);
    return res;
}

async function addTemplateRepository({ url, description }) {
    const res = await reqService.chai
        .post('/api/v1/templates/repositories')
        .set('Cookie', ADMIN_COOKIE)
        .send({ url, description });
    return res;
}

async function deleteTemplateRepository(repoUrl) {
    const res = await reqService.chai
        .delete('/api/v1/templates/repositories')
        .set('Cookie', ADMIN_COOKIE)
        .send({ url: repoUrl });
    return res;
}

async function getTemplateStyles() {
    const res = await reqService.chai
        .get('/api/v1/templates/styles')
        .set('Cookie', ADMIN_COOKIE);
    return res;
}
