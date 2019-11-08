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

const defaultCodewindTemplates = [
    {
        label: 'Go',
        description: 'Eclipse Codewind Go sample application',
        language: 'go',
        url: 'https://github.com/codewind-resources/goTemplate',
        projectType: 'docker',
        source: 'Default templates',
    },
    {
        label: 'Lagom Java',
        description: 'Eclipse Codewind Lagom Reactive microservice in Java',
        language: 'java',
        url: 'https://github.com/codewind-resources/lagomJavaTemplate',
        projectType: 'docker',
        source: 'Default templates',
    },
    {
        label: 'Node.js Express',
        description: 'Eclipse Codewind Express sample application',
        language: 'nodejs',
        url: 'https://github.com/codewind-resources/nodeExpressTemplate',
        projectType: 'nodejs',
        source: 'Default templates',
    },
    {
        label: 'Open Liberty',
        description: 'Eclipse Codewind Open Liberty sample application in Java',
        language: 'java',
        url: 'https://github.com/codewind-resources/openLibertyTemplate',
        projectType: 'docker',
        source: 'Default templates',
    },
    {
        label: 'Python',
        description: 'Eclipse Codewind Python sample application',
        language: 'python',
        url: 'https://github.com/codewind-resources/pythonTemplate',
        projectType: 'docker',
        source: 'Default templates',
    },
    {
        label: 'Spring Boot®',
        description: 'Eclipse Codewind Spring Boot® sample application',
        language: 'java',
        url: 'https://github.com/codewind-resources/springJavaTemplate',
        projectType: 'spring',
        source: 'Default templates',
    },
    {
        label: 'Swift',
        description: 'Eclipse Codewind Swift sample application',
        language: 'swift',
        url: 'https://github.com/codewind-resources/swiftTemplate',
        projectType: 'swift',
        source: 'Default templates',
    },
    {
        label: 'WebSphere Liberty MicroProfile®',
        description: 'Eclipse MicroProfile® on Websphere Liberty',
        language: 'java',
        url: 'https://github.com/codewind-resources/javaMicroProfileTemplate',
        projectType: 'liberty',
        source: 'Default templates',
    },
];

const defaultAppsodyTemplates = [
    {
        label: 'Appsody Eclipse MicroProfile® template',
        description: 'Eclipse MicroProfile on Open Liberty & OpenJ9 using Maven',
        language: 'java',
        url: 'https://github.com/appsody/stacks/releases/download/java-microprofile-v0.2.18/incubator.java-microprofile.v0.2.18.templates.default.tar.gz',
        projectType: 'appsodyExtension',
        projectStyle: 'Appsody',
    },
    {
        label: 'Appsody LoopBack 4 template',
        description: 'LoopBack 4 API Framework for Node.js',
        language: 'nodejs',
        url: 'https://github.com/appsody/stacks/releases/download/nodejs-loopback-v0.1.5/incubator.nodejs-loopback.v0.1.5.templates.scaffold.tar.gz',
        projectType: 'appsodyExtension',
        projectStyle: 'Appsody',
    },
    {
        label: 'Appsody Node.js Express scaffold template',
        description: 'Express web framework for Node.js',
        language: 'nodejs',
        url: 'https://github.com/appsody/stacks/releases/download/nodejs-express-v0.2.7/incubator.nodejs-express.v0.2.7.templates.scaffold.tar.gz',
        projectType: 'appsodyExtension',
        projectStyle: 'Appsody',
    },
    {
        label: 'Appsody Node.js Express simple template',
        description: 'Express web framework for Node.js',
        language: 'nodejs',
        url: 'https://github.com/appsody/stacks/releases/download/nodejs-express-v0.2.7/incubator.nodejs-express.v0.2.7.templates.simple.tar.gz',
        projectType: 'appsodyExtension',
        projectStyle: 'Appsody',
    },
    {
        label: 'Appsody Node.js template',
        description: 'Runtime for Node.js applications',
        language: 'nodejs',
        url: 'https://github.com/appsody/stacks/releases/download/nodejs-v0.2.5/incubator.nodejs.templates.simple.tar.gz',
        projectType: 'appsodyExtension',
        projectStyle: 'Appsody',
    },
    {
        label: 'Appsody Python Flask template',
        description: 'Flask web Framework for Python',
        language: 'python',
        url: 'https://github.com/appsody/stacks/releases/download/python-flask-v0.1.4/incubator.python-flask.v0.1.4.templates.simple.tar.gz',
        projectType: 'appsodyExtension',
        projectStyle: 'Appsody',
    },
    {
        label: 'Appsody Spring Boot® default template',
        description: 'Spring Boot using OpenJ9 and Maven',
        language: 'java',
        url: 'https://github.com/appsody/stacks/releases/download/java-spring-boot2-v0.3.15/incubator.java-spring-boot2.v0.3.15.templates.default.tar.gz',
        projectType: 'appsodyExtension',
        projectStyle: 'Appsody',
    },
    {
        label: 'Appsody Spring Boot® kotlin template',
        description: 'Spring Boot using OpenJ9 and Maven',
        language: 'java',
        url: 'https://github.com/appsody/stacks/releases/download/java-spring-boot2-v0.3.15/incubator.java-spring-boot2.v0.3.15.templates.kotlin.tar.gz',
        projectType: 'appsodyExtension',
        projectStyle: 'Appsody',
    },
    {
        label: 'Appsody starter sample runnable stack template',
        description: 'starter sample stack that can be run by ' +
          'appsody, to help creation of more stacks',
        language: 'bash',
        url: 'https://github.com/appsody/stacks/releases/download/starter-v0.1.0/incubator.starter.v0.1.0.templates.simple.tar.gz',
        projectType: 'appsodyExtension',
        projectStyle: 'Appsody',
    },
    {
        label: 'Appsody Swift template',
        description: 'Runtime for Swift applications',
        language: 'swift',
        url: 'https://github.com/appsody/stacks/releases/download/swift-v0.1.4/incubator.swift.templates.simple.tar.gz',
        projectType: 'appsodyExtension',
        projectStyle: 'Appsody',
    },
];

const defaultKabaneroTemplates = [
    {
        label: 'Appsody Eclipse MicroProfile® template',
        description: 'Eclipse MicroProfile on Open Liberty & OpenJ9 using Maven',
        language: 'java',
        url: 'https://github.com/kabanero-io/collections/releases/download/v0.1.2/incubator.java-microprofile.v0.2.11.templates.default.tar.gz',
        projectType: 'appsodyExtension',
        projectStyle: 'Appsody',
        source: 'Kabanero Collections',
    },
    {
        label: 'Appsody LoopBack 4 template',
        description: 'LoopBack 4 API Framework for Node.js',
        language: 'nodejs',
        url: 'https://github.com/kabanero-io/collections/releases/download/v0.1.2/incubator.nodejs-loopback.v0.1.4.templates.scaffold.tar.gz',
        projectType: 'appsodyExtension',
        projectStyle: 'Appsody',
        source: 'Kabanero Collections',
    },
    {
        label: 'Appsody Node.js Express simple template',
        description: 'Express web framework for Node.js',
        language: 'nodejs',
        url: 'https://github.com/kabanero-io/collections/releases/download/v0.1.2/incubator.nodejs-express.v0.2.5.templates.simple.tar.gz',
        projectType: 'appsodyExtension',
        projectStyle: 'Appsody',
        source: 'Kabanero Collections',
    },
    {
        label: 'Appsody Node.js Express skaffold template',
        description: 'Express web framework for Node.js',
        language: 'nodejs',
        url: 'https://github.com/kabanero-io/collections/releases/download/v0.1.2/incubator.nodejs-express.v0.2.5.templates.skaffold.tar.gz',
        projectType: 'appsodyExtension',
        projectStyle: 'Appsody',
        source: 'Kabanero Collections',
    },
    {
        label: 'Appsody Node.js template',
        description: 'Runtime for Node.js applications',
        language: 'nodejs',
        url: 'https://github.com/kabanero-io/collections/releases/download/v0.1.2/incubator.nodejs.v0.2.5.templates.simple.tar.gz',
        projectType: 'appsodyExtension',
        projectStyle: 'Appsody',
        source: 'Kabanero Collections',
    },
    {
        label: 'Appsody Spring Boot® default template',
        description: 'Spring Boot using OpenJ9 and Maven',
        language: 'java',
        url: 'https://github.com/kabanero-io/collections/releases/download/v0.1.2/incubator.java-spring-boot2.v0.3.9.templates.default.tar.gz',
        projectType: 'appsodyExtension',
        projectStyle: 'Appsody',
        source: 'Kabanero Collections',
    },
    {
        label: 'Appsody Spring Boot® kotlin template',
        description: 'Spring Boot using OpenJ9 and Maven',
        language: 'java',
        url: 'https://github.com/kabanero-io/collections/releases/download/v0.1.2/incubator.java-spring-boot2.v0.3.9.templates.kotlin.tar.gz',
        projectType: 'appsodyExtension',
        projectStyle: 'Appsody',
        source: 'Kabanero Collections',
    },
];

const defaultTemplates = [
    ...defaultCodewindTemplates,
    ...defaultAppsodyTemplates,
];

const styledTemplates = {
    codewind: {
        label: 'Codewind template',
        description: 'Codewind template',
        language: 'go',
        url: 'https://github.com/microclimate-dev2ops/microclimateGoTemplate',
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

const sampleRepos = {
    codewind: {
        url: 'https://raw.githubusercontent.com/codewind-resources/codewind-templates/master/devfiles/index.json',
        description: 'The default set of templates for new projects in Codewind.',
        enabled: true,
        protected: true,
        projectStyles: ['Codewind'],
        name: 'Default templates',
    },
    appsody: {
        url: 'https://raw.githubusercontent.com/kabanero-io/codewind-appsody-templates/master/devfiles/index.json',
        description: 'Appsody extension for Codewind',
        enabled: true,
        projectStyles: ['Appsody'],
    },
    fromAppsodyExtension: {
        url: 'https://github.com/appsody/stacks/releases/latest/download/incubator-index.json',
        description: 'Appsody Stacks - appsodyhub',
        enabled: true,
        protected: true,
        projectStyles: ['Appsody'],
    },
};
const defaultRepoList = [
    sampleRepos.codewind,
    sampleRepos.fromAppsodyExtension,
];

const validUrlNotPointingToIndexJson = 'https://support.oneskyapp.com/hc/en-us/article_attachments/202761627/example_1.json';

async function getTemplateRepos() {
    const res = await reqService.chai
        .get('/api/v1/templates/repositories')
        .set('Cookie', ADMIN_COOKIE);
    return res;
}

async function addTemplateRepo(repo) {
    const res = await reqService.chai
        .post('/api/v1/templates/repositories')
        .set('Cookie', ADMIN_COOKIE)
        .send(repo);
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

/**
 * Removes all templates repos known to PFE, and adds the supplied repos
 * @param {[JSON]} repoList
 */
async function setTemplateReposTo(repoList) {
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

module.exports = {
    defaultTemplates,
    defaultCodewindTemplates,
    defaultKabaneroTemplates,
    styledTemplates,
    sampleRepos,
    defaultRepoList,
    validUrlNotPointingToIndexJson,
    getTemplateRepos,
    addTemplateRepo,
    deleteTemplateRepo,
    batchPatchTemplateRepos,
    enableTemplateRepos,
    disableTemplateRepos,
    getTemplates,
    setTemplateReposTo,
    getTemplateStyles,
    saveReposBeforeTestAndRestoreAfter,
    saveReposBeforeEachTestAndRestoreAfterEach,
};
