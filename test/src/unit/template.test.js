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

const Templates = require('../../../src/pfe/portal/modules/Templates');

chai.should();
const sampleCodewindTemplate = {
    label: 'Go template',
    description: 'Sample microservice for simple go app',
    language: 'go',
    url: 'https://github.com/microclimate-dev2ops/microclimateGoTemplate',
    projectType: 'docker',
};
const sampleAppsodyTemplate = {
    label: 'Appsody template',
    description: 'Appsody stack',
    language: 'nodejs',
    url: 'https://github.com/appsody/template/repo',
    projectType: 'nodejs',
    projectStyle: 'Appsody',
};

describe('Templates.js', function() {
    describe('getTemplateStyles() when Codewind is aware of:', function() {
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
                const output = await templateController.getTemplateStyles();
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
                const output = await templateController.getTemplateStyles();
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
                const output = await templateController.getTemplateStyles();
                output.should.deep.equal(['Appsody']);
            });
        });
    });
    describe('getTemplates()', function() {
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
        it('returns an array of all templates', async function() {
            const output = await templateController.getTemplateList();
            output.should.deep.equal(sampleTemplateList);
        });
    });
    describe('getTemplatesOfStyle(projectStyle)', function() {
        describe('(Codewind)', function() {
            const sampleTemplateList = [sampleCodewindTemplate];
            let templateController;
            before(() => {
                templateController = new Templates('');
                templateController.projectTemplates = sampleTemplateList;
                templateController.needsRefresh = false;
            });
            it('returns only Codewind templates', async function() {
                const output = await templateController.getTemplatesOfStyle('Codewind');
                output.should.deep.equal(sampleTemplateList);
            });
        });
        describe('(Appsody)', function() {
            const sampleTemplateList = [sampleAppsodyTemplate];
            let templateController;
            before(() => {
                templateController = new Templates('');
                templateController.projectTemplates = sampleTemplateList;
                templateController.needsRefresh = false;
            });
            it('returns only Appsody templates', async function() {
                const output = await templateController.getTemplatesOfStyle('Appsody');
                output.should.deep.equal(sampleTemplateList);
            });
        });
    });
});
