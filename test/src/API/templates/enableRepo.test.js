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
    sampleRepos,
    getTemplates,
    getTemplateRepos,
    enableTemplateRepos,
    disableTemplateRepos,
    resetTemplateReposTo,
} = require('../../../modules/template.service');

chai.should();

describe('Batch enabling repositories', function() {
    const tests = {
        '1 repo': {
            testRepos: [{ ...sampleRepos.codewind }],
        },
        'multiple repos': {
            testRepos: [
                { ...sampleRepos.codewind },
                { ...sampleRepos.appsody },
            ],
        },
    };

    for (const [testName, test] of Object.entries(tests)) {
        describe(testName, function() { // eslint-disable-line
            let originalTemplateRepos;
            const { testRepos } = test;
            let templatesFromTestRepos;
            before(async() => {
                const res = await getTemplateRepos();
                originalTemplateRepos = res.body;

                await resetTemplateReposTo(testRepos);

                const res2 = await getTemplates();
                templatesFromTestRepos = res2.body;
            });
            after(async() => {
                await resetTemplateReposTo(originalTemplateRepos);
            });
            it(`batch DISabling ${testRepos.length} repos returns 207 and sub-status 200 for each subrequest`, async function() {
                const repoUrls = testRepos.map(repo => repo.url);
                const res = await disableTemplateRepos(repoUrls);

                res.should.have.status(207);
                res.body.forEach(subResponse =>
                    subResponse.status.should.equal(200)
                );
            });
            it(`those repos are listed as DISabled`, async function() {
                const disabledRepos = testRepos.map(repo => {
                    return {
                        ...repo,
                        enabled: false,
                    };
                });

                const res = await getTemplateRepos();

                res.should.have.status(200);
                res.body.should.have.deep.members(disabledRepos);
            });
            it(`those repos' templates DON'T appear in list of ENabled templates`, async function() {
                const res = await getTemplates({ showEnabledOnly: true });
                res.should.have.status(200);
                res.body.should.not.have.deep.members(templatesFromTestRepos);
            });

            it(`batch ENabling repos ${testRepos.length} returns 207 and sub-status 200 for each subrequest`, async function() {
                const repoUrls = testRepos.map(repo => repo.url);
                const res = await enableTemplateRepos(repoUrls);

                res.should.have.status(207);
                res.body.forEach(subResponse =>
                    subResponse.status.should.equal(200)
                );
            });
            it(`those repos are listed as ENabled`, async function() {
                const enabledRepos = testRepos.map(repo => {
                    return {
                        ...repo,
                        enabled: true,
                    };
                });

                const res = await getTemplateRepos();

                res.should.have.status(200);
                res.body.should.have.deep.members(enabledRepos);
            });
            it(`those repos' templates DO appear in list of ENabled templates`, async function() {
                const res = await getTemplates({ showEnabledOnly: true });
                res.should.have.status(200);
                res.body.should.have.deep.members(templatesFromTestRepos);
            });
        });
    }
});
