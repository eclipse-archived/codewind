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

 /**
 * This module's purpose is to centralise as much docker and K8s logic as possible.
 * Example usage:
 *    const containerService = require(../modules/container.js);
 *    const containerInfo = await containerService.awaitContainer(projectName, projectID);
 *    const projectInf = await containerService.awaitProjectInfFile(projectID);
 */
const { promisify } = require('util');
const { exec } = require('child-process-promise');

const { WORKSPACE_DIR, USING_K8S, containerDir, dir } = require('../../config');
const environment = USING_K8S ? 'k8s' : 'docker';
const helperService = require(`./${environment}.service`);

const containerName = 'codewind-pfe';
const podName = process.env.POD_NAME;
const { EXEC_COMMAND, COPY_FROM_COMMAND, COPY_TO_COMMAND } = helperService.getCommands(containerName, podName);

const sleep = promisify(setTimeout);

const execContainer = async(command, env) => {
    let envVariables = ' ';
    if (env) {
        envVariables = 'env ';
        Object.keys(env).forEach(key => {
            envVariables += `${key}=${env[key]} `;
        });
    }
    await exec(`${EXEC_COMMAND} ${envVariables} ${command}`);
};

const ensureDir = (dir) => exec(`${EXEC_COMMAND} mkdir -p ${dir}`);

const removeDir = (dir) => exec(`${EXEC_COMMAND} rm -rf ${dir}`);

function copyFrom(remotePath, localPath) {
    return exec(`${COPY_FROM_COMMAND}${remotePath} ${localPath} 2>/dev/null`);
};

function copyTo(localPath, remotePath) {
    return exec(`${COPY_TO_COMMAND} ${localPath} ${podName || containerName}:${remotePath}`);
};

/**
 * @param {function} func
 * @returns {Promise<Boolean>} true, unless the function errored, in which case this returns false
 */
async function succeeded(func) {
    try {
        await func();
        return true;
    } catch (err) {
        return false;
    }
}

function fileExists(filePath) {
    return succeeded(() => exec(`${EXEC_COMMAND} test -f ${filePath} 2>/dev/null`));
}

function dirExists(dirPath) {
    return succeeded(() => exec(`${EXEC_COMMAND} test -d ${dirPath} 2>/dev/null`));
}

function unlink(filePath) {
    return succeeded(() => exec(`${EXEC_COMMAND} rm -r ${filePath}`));
};

async function readFile(filePath) {
    return (await exec(`${EXEC_COMMAND} cat ${filePath}`)).stdout;
};

async function readJson(filePath) {
    const fileData = await readFile(filePath, 'utf8');
    return JSON.parse(fileData);
};

/**
 * @returns {array} of filenames in the given dirPath
 */
async function readDir(dirPath) {
    const fileList = (await exec(`${EXEC_COMMAND} ls ${dirPath}`)).stdout;

  // Returned value has a trailing carriage return, hence the trim
    return fileList.trim().split('\n');
};

async function getArchitecture() {
    const architecture = (await exec(`${EXEC_COMMAND} uname -m`)).stdout;
    return architecture.toString().trim();
};

/**
 * Tries to find the project .inf file and return it as a JSON
 * @returns {Promise<JSON>} projectInfJSON
 */
async function getProjectInfJSON(projectID) {
    const filepath = `${WORKSPACE_DIR}/.projects/${projectID}.inf`;
    return JSON.parse(await readFile(filepath));
}

/**
 * Tries to find the project .cw-settings file and return it as a JSON
 * @returns {Promise<JSON>} cwSettingsJSON
 */
async function getCWSettingsJSON(projectName) {
    const filepath = `${WORKSPACE_DIR}/${projectName}/.cw-settings`;
    return JSON.parse(await readFile(filepath));
}

/**
 * Periodically checks until a condition is satisfied, at which point this returns true
 * @param {function} condition
 * @param {int} checkingInterval
 * @param {int} timeAwaited
 * @param {int} maxWaitingTime
 * @returns {Promise<Boolean>} resolves to true when the condition is satisfied, else false when the maxWaitingTime has elapsed
 */
async function awaitCondition(
    condition,
    checkingInterval = 500,
    timeAwaited = 0,
    maxWaitingTime = 2 * 60 * 1000,
) {
    if (timeAwaited > maxWaitingTime) return false;
    if (await condition()) return true;
    await sleep(checkingInterval);
    return awaitCondition(condition, checkingInterval, timeAwaited + checkingInterval);
};

/**
 * Periodically checks for a file until it is found, at which point this returns true
 * @returns {Promise<Boolean>} resolves to true when the file is found, else false when the maxWaitingTime has elapsed
 */
function awaitFile(filePath) {
    return awaitCondition(() => fileExists(filePath));
};

/**
 * Periodically checks for a dir until it is found, at which point this returns true
 * @returns {Promise<Boolean>} resolves to true when the dir is found, else false when the maxWaitingTime has elapsed
 */
function awaitDir(dirPath) {
    return awaitCondition(() => dirExists(dirPath));
};

/**
 * Periodically checks for the project inf file until it is found, at which point this returns the file as a JSON
 * @returns {Promise<JSON>} projectInfJSON
 */
async function awaitProjectInfFile(projectID) {
    const filepath = `${WORKSPACE_DIR}/.projects/${projectID}.inf`;
    await awaitFile(filepath);
    return getProjectInfJSON(projectID);
}

/**
 * Periodically checks for the project container until it is found, at which point this returns the containerInfo as a JSON
 * @returns {Promise<JSON>} containerInfo
 */
async function awaitContainer(projectName, projectID) {
    const containerInfoList = await helperService.getAppContainers();
    const containerName = helperService.getContainerName(projectName, projectID);

    for (const containerInfo of containerInfoList) {
        containerInfo.should.have.property('name');
        if (containerInfo.name.startsWith(containerName) && !containerInfo.name.endsWith('-build') ) {
            return containerInfo;
        }
    }
    await sleep(1000);
    return awaitContainer(projectName, projectID);
}

async function createProjectAndZip(name, script, env) {
    await execContainer(`sh ${script}`, env);
    await copyFrom(`${containerDir}${name}`, `${dir}${name}`);
    await exec(`cd ${dir}${name} && zip -r ../${name}.zip ./*`);
};

async function createProjectInFolder(name, script, env, dest) {
    await execContainer(`sh ${script}`, env);
    await copyFrom(`${containerDir}${name}`, `${dest}/${name}`);
};

/**
 * Runs through a directory and searches for any files containing the given string. Returns an array of file paths containing the string
 * @returns {Promise<Array>} matching file paths
 */
async function findInFiles(stringToFind, dirToSearch){
    let output;
    try {
        const grep = (await exec(`${EXEC_COMMAND} grep --files-with-matches --recursive "${stringToFind}" ${dirToSearch}`));
        output = grep.stdout;
    } catch (err) {
    // grep returns 0 on matches, 1 on no matches which triggers an exception.
        if (err.code == 1) {
      // No matches so use empty output.
            output = '';
        } else if (err.code > 1) {
      // return code > 1 means an error occured.
            throw err;
        }
    }
    const matches = output.trim().split('\n').filter(s => s != '');
    return matches;
}

async function findStringInFilenames(stringToFind, dirToSearch) {
    const find = (await exec(`${EXEC_COMMAND} find ${dirToSearch} -name "*${stringToFind}*"`));
    const output = find.stdout;
    const fileList = output.trim().split('\n').filter(s => s != '');
    return fileList;
}

module.exports = {
    ensureDir,
    removeDir,
    copyFrom,
    copyTo,
    fileExists,
    dirExists,
    unlink,
    awaitFile,
    awaitDir,
    readFile,
    readJson,
    readDir,
    getArchitecture,
    getProjectInfJSON,
    getCWSettingsJSON,
    awaitProjectInfFile,
    awaitContainer,
    createProjectAndZip,
    createProjectInFolder,
    findInFiles,
    findStringInFilenames,
};
