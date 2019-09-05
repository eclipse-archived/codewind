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
    setTemplateReposTo,
    saveReposBeforeTestAndRestoreAfter,
} = require('../../../modules/template.service');

chai.should();

describe('Batch enabling repositories', function() {
    const tests = {
        '1 repo': {
            testRepos: [{ ...sampleRepos.codewind }],
        },
        // 'multiple repos': {
        //     testRepos: [
        //         { ...sampleRepos.appsody },
        //         { ...sampleRepos.fromAppsodyExtension },
        //     ],
        // },
    };

    for (const [testName, test] of Object.entries(tests)) {
        describe(testName, function() { // eslint-disable-line no-loop-func
            const { testRepos } = test;
            let templatesFromTestRepos;
            saveReposBeforeTestAndRestoreAfter();
            before(async() => {
                await setTemplateReposTo(testRepos);

                const res = await getTemplates();
                templatesFromTestRepos = res.body;
            });
            it(`returns 207 and sub-status 200 for each subrequest when batch disabling ${testRepos.length} repos`, async function() {
                const repoUrls = testRepos.map(repo => repo.url);
                const res = await disableTemplateRepos(repoUrls);

                res.should.have.status(207);
                res.body.forEach(subResponse =>
                    subResponse.status.should.equal(200)
                );
            });
            it(`lists those repos as disabled`, async function() {
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
            it(`checks templates from the disabled repos do not appear in the list of enabled templates`, async function() {
                const res = await getTemplates({ showEnabledOnly: true });
                res.should.have.status(200);
                res.body.should.not.have.deep.members(templatesFromTestRepos);
            });

            it(`returns 207 and sub-status 200 for each subrequest when batch enabling ${testRepos.length} repos`, async function() {
                const repoUrls = testRepos.map(repo => repo.url);
                const res = await enableTemplateRepos(repoUrls);

                res.should.have.status(207);
                res.body.forEach(subResponse =>
                    subResponse.status.should.equal(200)
                );
            });
            it(`lists those repos as enabled`, async function() {
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
            it(`checks templates from the enabled repos do not appear in the list of enabled templates`, async function() {
                const res = await getTemplates({ showEnabledOnly: true });
                res.should.have.status(200);
                res.body.should.have.deep.members(templatesFromTestRepos);
            });
        });
    }
});
