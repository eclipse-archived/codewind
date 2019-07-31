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
    projectStyle: 'appsody',
};

describe('Templates.js', function() {
    describe('getTemplateStyles() when Codewind is aware of:', function() {
        describe('codewind and appsody templates', function() {
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
            it(`returns ['codewind', 'appsody']`, async function() {
                const output = await templateController.getTemplateStyles();
                output.should.deep.equal(['codewind', 'appsody']);
            });
        });
        describe('only codewind templates', function() {
            const sampleTemplateList = [sampleCodewindTemplate];
            let templateController;
            before(() => {
                templateController = new Templates('');
                templateController.projectTemplates = sampleTemplateList;
                templateController.needsRefresh = false;
            });
            it(`returns ['codewind']`, async function() {
                const output = await templateController.getTemplateStyles();
                output.should.deep.equal(['codewind']);
            });
        });
        describe('only appsody templates', function() {
            const sampleTemplateList = [sampleAppsodyTemplate];
            let templateController;
            before(() => {
                templateController = new Templates('');
                templateController.projectTemplates = sampleTemplateList;
                templateController.needsRefresh = false;
            });
            it(`returns ['appsody']`, async function() {
                const output = await templateController.getTemplateStyles();
                output.should.deep.equal(['appsody']);
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
        describe('(codewind)', function() {
            const sampleTemplateList = [sampleCodewindTemplate];
            let templateController;
            before(() => {
                templateController = new Templates('');
                templateController.projectTemplates = sampleTemplateList;
                templateController.needsRefresh = false;
            });
            it('returns only codewind templates', async function() {
                const output = await templateController.getTemplatesOfStyle('codewind');
                output.should.deep.equal(sampleTemplateList);
            });
        });
        describe('(appsody)', function() {
            const sampleTemplateList = [sampleAppsodyTemplate];
            let templateController;
            before(() => {
                templateController = new Templates('');
                templateController.projectTemplates = sampleTemplateList;
                templateController.needsRefresh = false;
            });
            it('returns only appsody templates', async function() {
                const output = await templateController.getTemplatesOfStyle('appsody');
                output.should.deep.equal(sampleTemplateList);
            });
        });
    });
});
