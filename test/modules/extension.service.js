/*******************************************************************************
 * Copyright (c) 2020 IBM Corporation and others.
 * All rights reserved. This program and the accompanying materials
 * are made available under the terms of the Eclipse Public License v2.0
 * which accompanies this distribution, and is available at
 * http://www.eclipse.org/legal/epl-v20.html
 *
 * Contributors:
 *     IBM Corporation - initial API and implementation
 *******************************************************************************/
const fs = require('fs-extra');
const path = require('path');
const yaml = require('js-yaml');

const CODEWIND_YAML_FILENAME = 'codewind.yaml';
const TEMPLATES_PROVIDER_FILENAME = 'templatesProvider.js';

const CODEWIND_YAML = {
    name: 'dummyExtension',
    description: 'dummy extension for testing',
};

const COMPLETE_CODEWIND_YAML = {
    ...CODEWIND_YAML,
    version: 1,
    projectType: 'dummyExtension',
    commands: 'commands',
    detection: 'package.json',
    config: 'config',
    templates: 'templates',
};

const createCodewindYamlFile = (directory, overwriteValues = {}) => {
    const codewindJson = { ...CODEWIND_YAML };
    for (const key in overwriteValues) {
        codewindJson[key] = overwriteValues[key];
    }
    const codewindYamlFileContents = yaml.safeDump(codewindJson);
    fs.ensureDirSync(directory);
    fs.writeFileSync(path.join(directory, CODEWIND_YAML_FILENAME), codewindYamlFileContents);
};

const deleteCodewindYamlFile = (directory) => {
    fs.removeSync(path.join(directory, CODEWIND_YAML_FILENAME));
};

const createTemplatesProviderFile = (directory) => {
    const getRepoFunc = 'getRepositories: () => { return []; }';
    const templates_provider_content = `module.exports = { ${getRepoFunc} };`;
    fs.ensureDirSync(directory);
    fs.writeFileSync(path.join(directory, TEMPLATES_PROVIDER_FILENAME), templates_provider_content);
};

const deleteTemplatesProviderFile = (directory) => {
    fs.removeSync(path.join(directory, TEMPLATES_PROVIDER_FILENAME));
};

module.exports = {
    CODEWIND_YAML,
    COMPLETE_CODEWIND_YAML,
    createCodewindYamlFile,
    deleteCodewindYamlFile,
    createTemplatesProviderFile,
    deleteTemplatesProviderFile,
};