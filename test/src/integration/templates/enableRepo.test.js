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

const {
    getTemplateRepos,
    enableTemplateRepo,
    disableTemplateRepo,
    getTemplates,
    resetTemplateRepos,
} = require('../../../modules/template.service');

chai.should();

describe('Enabling template repositories in batches', function() {
    let originalTemplateRepos;
    let repoToTest;
    before(async() => {
        const res = await getTemplateRepos();
        originalTemplateRepos = res.body;
        repoToTest = originalTemplateRepos[0];
    });
    after(async() => {
        await resetTemplateRepos(originalTemplateRepos);
    });
    it(`batch enabling a single template repo returns 207 and sub-status 200`, async function() {
        const res = await enableTemplateRepo(repoToTest.url);
        res.should.have.status(207);
        res.body[0].status.should.equal(200);
    });
    it(`that repo appears as enabled in list of template repos`, async function() {
        const res = await getTemplateRepos();
        res.should.have.status(200);
        res.body.should.deep.include({
            ...repoToTest,
            enabled: true,
        });
    });
    it(`batch disabling that template repo returns 207 and sub-status 200`, async function() {
        const res = await disableTemplateRepo(repoToTest.url);
        res.should.have.status(207);
        res.body[0].status.should.equal(200);
    });
    it(`that repo appears as disabled in list of template repos`, async function() {
        const res = await getTemplateRepos();
        res.should.have.status(200);
        res.body.should.deep.include({
            ...repoToTest,
            enabled: false,
        });
    });
    it(`templates from the disabled repo do not appear in list of enabled templates`, async function() {
        const res = await getTemplates({ showEnabledOnly: true });
        res.should.have.status(204);
        // TODO: switch over to the below when we have 2 repos (so that 1 repo can still be enabled, so we return 200 rather than 204 No Content)
        // res.should.have.status(200)
        // res.body.should.not.include.deep.members(defaultTemplates);
    });
});
