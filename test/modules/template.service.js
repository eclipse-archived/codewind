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
const { ADMIN_COOKIE, testTimeout } = require('../config');
const reqService = require('./request.service');

const templateRepositoryURL = 'https://raw.githubusercontent.com/codewind-resources/codewind-templates/master/devfiles/index.json';

const styledTemplates = {
    codewind: {
        label: 'Codewind template',
        description: 'Codewind template',
        language: 'go',
        url: 'https://github.com/codewind-resources/goTemplate',
        projectType: 'docker',
        source: 'Default templates',
        // defaults to projectStyle 'Codewind'
    },
    appsody: {
        label: 'Appsody template',
        description: 'Appsody stack',
        language: 'nodejs',
        url: 'https://github.com/appsody/template/repo',
        projectType: 'nodejs',
        projectStyle: 'Appsody',
    },
};

// Insert your own credentials to run relevant tests
const gheCredentials = {
    username: 'foo.bar@domain.com',
    // password: 'INSERT_TO_RUN_RELEVANT_TESTS',
};

const sampleRepos = {
    codewind: {
        url: templateRepositoryURL,
        description: 'The default set of templates for new projects in Codewind.',
        enabled: true,
        protected: true,
        projectStyles: ['Codewind'],
        name: 'Default templates',
    },
    disabledcodewind: {
        url: templateRepositoryURL,
        description: 'The disabled default set of templates for new projects in Codewind.',
        enabled: false,
        protected: true,
        projectStyles: ['Codewind'],
        name: 'Default disabled templates',
    },
    GHE: {
        url: 'https://raw.github.ibm.com/Richard-Waller/sampleGHETemplateRepo/415ece47958250175f182c095af7da6cfe40e58a/devfiles/index.json',
        description: 'Example GHE template repository',
        name: 'Example GHE template repository',
    },
};

const validUrlNotPointingToIndexJson = 'https://support.oneskyapp.com/hc/en-us/article_attachments/202761627/example_1.json';

async function getDefaultTemplatesFromGithub() {
    const { status, text } = await reqService.externalChaiRequest(templateRepositoryURL).get('');
    status.should.equal(200);
    // Parse the index.json into our template format
    const rawTemplates = JSON.parse(text);
    const parsedTemplates = rawTemplates.map(({ displayName, description, language, projectType, location }) => {
        return {
            label: displayName,
            description,
            language,
            url: location,
            projectType,
            source: 'Default templates',
            sourceURL: templateRepositoryURL,
        };
    });
    return parsedTemplates;
}

async function getTemplateRepos() {
    const res = await reqService.chai
        .get('/api/v1/templates/repositories')
        .set('Cookie', ADMIN_COOKIE);
    return res;
}

async function addTemplateRepo(repoOptions) {
    const res = await reqService.chai
        .post('/api/v1/templates/repositories')
        .set('Cookie', ADMIN_COOKIE)
        .send(repoOptions);
    return res;
}

async function deleteTemplateRepo(repoUrl) {
    const res = await reqService.chai
        .delete('/api/v1/templates/repositories')
        .set('Cookie', ADMIN_COOKIE)
        .send({ url: repoUrl });
    return res;
}

async function batchPatchTemplateRepos(operations) {
    const res = await reqService.chai
        .patch('/api/v1/batch/templates/repositories')
        .set('Cookie', ADMIN_COOKIE)
        .send(operations);
    return res;
}

async function enableTemplateRepos(repoUrls) {
    const operations = repoUrls.map(url => {
        return {
            url,
            op: 'enable',
            value: 'true',
        };
    });
    const res = await batchPatchTemplateRepos(operations);
    return res;
}

async function disableTemplateRepos(repoUrls) {
    const operations = repoUrls.map(url => {
        return {
            url,
            op: 'enable',
            value: 'false',
        };
    });
    const res = await batchPatchTemplateRepos(operations);
    return res;
}

async function getTemplates(queryParams) {
    const res = await reqService.chai
        .get('/api/v1/templates')
        .query(queryParams)
        .set('Cookie', ADMIN_COOKIE);
    return res;
}

async function getEnabledTemplates(queryParams) {
    const res = await reqService.chai
        .get('/api/v1/templates/?showEnabledOnly=true')
        .query(queryParams)
        .set('Cookie', ADMIN_COOKIE);
    return res;
}

async function getNumberOfTemplates(queryParams) {
    const { statusCode, body: templates } = await getTemplates(queryParams);
    // If we get a 204 HTTP Code the templates list is empty
    if (statusCode === 204) {
        return 0;
    } else if (statusCode === 200) {
        return templates.length;
    }
    // If we haven't got a 204 or 200 we cannot report the number of templates
    throw new Error(`getNumberOfTemplates - Unknown status code received: ${statusCode}`);
}

async function getNumberOfEnabledTemplates(queryParams) {
    const { statusCode, body: templates } = await getEnabledTemplates(queryParams);
    // If we get a 204 HTTP Code the templates list is empty
    if (statusCode === 204) {
        return 0;
    } else if (statusCode === 200) {
        return templates.length;
    }
    // If we haven't got a 204 or 200 we cannot report the number of templates
    throw new Error(`getNumberOfTemplates - Unknown status code received: ${statusCode}`);
}


const idOfImmutableRepo = 'incubator';
/**
 * Removes all templates repos known to PFE, and adds the supplied repos
 * @param {[JSON]} repoList
 */
async function setTemplateReposTo(repoList) {
    const currentRepos = (await getTemplateRepos()).body;
    if (currentRepos.length > 0) {
        const reposToDelete = currentRepos.filter(repo => repo.id !== idOfImmutableRepo);
        console.log(reposToDelete);
        for (const repo of reposToDelete) {
            await deleteTemplateRepo(repo.url);
        }
    }
    const templatesToAdd = repoList.filter(repo => repo.id !== idOfImmutableRepo);
    for (const repo of templatesToAdd) {
        await addTemplateRepo(repo);
    }
}

async function getTemplateStyles() {
    const res = await reqService.chai
        .get('/api/v1/templates/styles')
        .set('Cookie', ADMIN_COOKIE);
    return res;
}

function saveReposBeforeTestAndRestoreAfter() {
    let originalTemplateRepos;
    before(async function() {
        this.timeout(testTimeout.short);
        const res = await getTemplateRepos();
        originalTemplateRepos = res.body;
    });
    after(async function() {
        this.timeout(testTimeout.short);
        await setTemplateReposTo(originalTemplateRepos);
    });
}

function saveReposBeforeEachTestAndRestoreAfterEach() {
    let originalTemplateRepos;
    beforeEach(async function() {
        this.timeout(testTimeout.short);
        const res = await getTemplateRepos();
        originalTemplateRepos = res.body;
    });
    afterEach(async function() {
        this.timeout(testTimeout.short);
        await setTemplateReposTo(originalTemplateRepos);
    });
}

function setupReposAndTemplatesForTesting() {
    // Removes all repos that already exist and replaces them with ones for testing
    let originalTemplateRepos;
    before(async function() {
        this.timeout(testTimeout.med);
        // Save original repositories
        const { body: getBody } = await getTemplateRepos();
        originalTemplateRepos = getBody;
        await setTemplateReposTo([sampleRepos.codewind]);
    });
    after(async function() {
        this.timeout(testTimeout.med);
        // Restore orignal list
        await setTemplateReposTo(originalTemplateRepos);
    });
}

module.exports = {
    getDefaultTemplatesFromGithub,
    styledTemplates,
    templateRepositoryURL,
    sampleRepos,
    validUrlNotPointingToIndexJson,
    gheCredentials,
    getTemplateRepos,
    addTemplateRepo,
    deleteTemplateRepo,
    batchPatchTemplateRepos,
    enableTemplateRepos,
    disableTemplateRepos,
    getTemplates,
    getNumberOfEnabledTemplates,
    getNumberOfTemplates,
    setTemplateReposTo,
    getTemplateStyles,
    saveReposBeforeTestAndRestoreAfter,
    saveReposBeforeEachTestAndRestoreAfterEach,
    setupReposAndTemplatesForTesting,
};
