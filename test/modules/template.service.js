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
const { ADMIN_COOKIE } = require('../config');
const reqService = require('./request.service');

const defaultTemplates = [
    {
        label: 'Go template',
        description: 'Sample microservice for simple go app',
        language: 'go',
        url: 'https://github.com/microclimate-dev2ops/microclimateGoTemplate',
        projectType: 'docker',
    },
    {
        label: 'Java Lagom template',
        description: 'Template for building Lagom Reactive microservice in Java',
        language: 'java',
        url: 'https://github.com/microclimate-dev2ops/lagomJavaTemplate',
        projectType: 'docker',
    },
    {
        label: 'Java MicroProfile template',
        description: 'Cloud Microservice Starter for Java - MicroProfile / Java EE',
        language: 'java',
        url: 'https://github.com/microclimate-dev2ops/javaMicroProfileTemplate',
        projectType: 'liberty',
    },
    {
        label: 'Node.js template',
        description: 'Cloud-ready Node.js Express sample application',
        language: 'nodejs',
        url: 'https://github.com/microclimate-dev2ops/nodeExpressTemplate',
        projectType: 'nodejs',
    },
    {
        label: 'Open Liberty template',
        description: 'Template for building an Open Liberty microservice in Java',
        language: 'java',
        url: 'https://github.com/microclimate-dev2ops/openLibertyTemplate',
        projectType: 'docker',
    },
    {
        label: 'Python template',
        description: 'HelloWorld microservice written in python',
        language: 'python',
        url: 'https://github.com/microclimate-dev2ops/SVTPythonTemplate',
        projectType: 'docker',
    },
    {
        label: 'Spring template',
        description: 'Template for building a Spring microservice',
        language: 'java',
        url: 'https://github.com/microclimate-dev2ops/springJavaTemplate',
        projectType: 'spring',
    },
    {
        label: 'Swift microservice template',
        description: 'Template for building a Swift microservice',
        language: 'swift',
        url: 'https://github.com/microclimate-dev2ops/swiftTemplate',
        projectType: 'swift',
    },
];

const styledTemplates = {
    codewind: {
        label: 'Codewind template',
        description: 'Codewind template',
        language: 'go',
        url: 'https://github.com/microclimate-dev2ops/microclimateGoTemplate',
        projectType: 'docker',
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

const sampleRepos = {
    default: {
        url: 'https://raw.githubusercontent.com/kabanero-io/codewind-templates/master/devfiles/index.json',
        description: 'Standard Codewind templates.',
        enabled: true,
    },
    appsody: {
        url: 'https://raw.githubusercontent.com/kabanero-io/codewind-appsody-templates/master/devfiles/index.json',
        description: 'Appsody extension for Codewind',
    },
};
const defaultRepoList = [sampleRepos.default];

async function getTemplateRepos() {
    const res = await reqService.chai
        .get('/api/v1/templates/repositories')
        .set('Cookie', ADMIN_COOKIE);
    return res;
}

async function addTemplateRepo({ url, description }) {
    const res = await reqService.chai
        .post('/api/v1/templates/repositories')
        .set('Cookie', ADMIN_COOKIE)
        .send({ url, description });
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

async function resetTemplateReposTo(repoList) {
    const reposToDelete = (await getTemplateRepos()).body;
    await Promise.all(reposToDelete.map(repo =>
        deleteTemplateRepo(repo.url)
    ));
    await Promise.all(repoList.map(repo =>
        addTemplateRepo(repo)
    ));
}

async function getTemplateStyles() {
    const res = await reqService.chai
        .get('/api/v1/templates/styles')
        .set('Cookie', ADMIN_COOKIE);
    return res;
}

module.exports = {
    defaultTemplates,
    styledTemplates,
    sampleRepos,
    defaultRepoList,
    getTemplateRepos,
    addTemplateRepo,
    deleteTemplateRepo,
    batchPatchTemplateRepos,
    enableTemplateRepos,
    disableTemplateRepos,
    getTemplates,
    resetTemplateReposTo,
    getTemplateStyles,
};
