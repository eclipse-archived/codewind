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
const uuidv4 = require('uuid/v4');
const { promisify } = require('util');
const git = require('simple-git/promise');
const fs = require('fs-extra');
const path = require('path');
const zlib = require('zlib');
const klawSync = require('klaw-sync');
const globToRegExp = require('glob-to-regexp');

const { projectTypeToIgnoredPaths } = require('../../src/pfe/portal/modules/utils/ignoredPaths');
const { ADMIN_COOKIE, templateOptions } = require('../config');
const reqService = require('./request.service');
const SocketService = require('./socket.service');

chai.should();
const sleep = promisify(setTimeout);

/**
 * Clone, bind and build one of our template projects
 */
async function createProjectFromTemplate(name, projectType, path, autoBuild = false) {
    const { url, language } = templateOptions[projectType];

    await cloneProject(url, path);

    const res = await bindProject({
        name,
        path,
        language,
        projectType,
        autoBuild,
        creationTime: Date.now(),
    });
    return res.body.projectID;
}

/**
 * @param {JSON} [options] e.g. { name: 'example' }
 * @param {number} [expectedResStatus] default 200
 */
async function bindProject(options) {
    const resFromBindStart = await bindStart(options);
    const { projectID } = resFromBindStart.body;
    const { path, projectType } = options;
    await uploadFiles(projectID, path, projectType);
    const resFromBindEnd = await bindEnd(projectID);
    return resFromBindEnd;
}

function recursivelyGetAllPaths(inputPath) {
    const paths = klawSync(inputPath,  { nodir: true });
    const filePaths = paths.map((path) => path.path);
    return filePaths;
};

async function bindStart(options) {
    const res = await reqService.chai
        .post('/api/v1/projects/bind/start')
        .set('Cookie', ADMIN_COOKIE)
        .send(options);
    return res;
};

async function bindEnd(projectID) {
    const res = await reqService.chai
        .post(`/api/v1/projects/${projectID}/bind/end`)
        .set('Cookie', ADMIN_COOKIE)
        .send({ id: projectID });
    return res;
};

async function uploadEnd(projectID, options) {
    const res = await reqService.chai
        .post(`/api/v1/projects/${projectID}/upload/end`)
        .set('Cookie', ADMIN_COOKIE)
        .send(options);
    return res;
};

async function uploadFiles(projectID, pathToDirToUpload, projectType) {
    const relativeFilepathsToUpload = getRelativeFilepathsToUpload(pathToDirToUpload, projectType);
    const promises = relativeFilepathsToUpload.map(
        pathFromDirToFile => uploadFile(projectID, pathToDirToUpload, pathFromDirToFile)
    );
    const responses = await Promise.all(promises);
    return responses;
}

function getRelativeFilepathsToUpload(pathToDirToUpload, projectType) {
    const filepaths = recursivelyGetAllPaths(pathToDirToUpload);
    const relativeFilepaths = filepaths.map(
        filePath => path.relative(pathToDirToUpload, filePath)
    );
    const relativeFilepathsToUpload = relativeFilepaths.filter(
        filepath => !isIgnoredFilepath(filepath, projectType)
    );
    return relativeFilepathsToUpload;
}

function isIgnoredFilepath(relativeFilepath, projectType) {
    const ignoredFilepaths = projectTypeToIgnoredPaths[projectType];
    const regExpIgnoredFilepaths = ignoredFilepaths.map(path => globToRegExp(path));
    const isIgnored = regExpIgnoredFilepaths.some(
        ignoredPath => ignoredPath.test(`/${relativeFilepath}`)
    );
    return isIgnored;
}

async function uploadFile(projectID, pathToDirToUpload, pathFromDirToFile) {
    const absoluteFilepath = path.join(pathToDirToUpload, pathFromDirToFile);
    const base64CompressedContent = zipFileToBase64(absoluteFilepath);
    const options = {
        isDirectory: false,
        mode: 420,
        path: pathFromDirToFile,
        msg: base64CompressedContent,
    };
    const res = await reqService.chai
        .put(`/api/v1/projects/${projectID}/upload`)
        .set('Cookie', ADMIN_COOKIE)
        .send(options);
    return res;
};

function zipFileToBase64(filepath) {
    const fileContent = fs.readFileSync(filepath, 'utf-8');
    const zippedContent = zlib.deflateSync(fileContent);
    const base64CompressedContent = zippedContent.toString('base64');
    return base64CompressedContent;
}

/**
 * @param {JSON} [options] e.g. { name: 'example' }
 * @param {number} [expectedResStatus] default 202
 */
async function unbindProject(projectID, expectedResStatus = 202) {
    const req = () => reqService.chai
        .post(`/api/v1/projects/${projectID}/unbind`)
        .set('Cookie', ADMIN_COOKIE);
    const res = await reqService.makeReqAndAwaitSocketMsg(req, expectedResStatus, { projectID, msgType: 'projectDeletion' });
    return res;
}

/**
 * For cleaning up PFE
 */
async function unbindAllProjects() {
    const projectIds = await getProjectIDs();
    const promises = projectIds.map(id => unbindProject(id));
    await Promise.all(promises);
}

async function buildProject(projectID) {
    const res = await reqService.chai.post(`/api/v1/projects/${projectID}/build`)
        .set('Cookie', ADMIN_COOKIE)
        .send({ action: 'build' });
    return res;
}

function generateUniqueName(baseName = 'test') {
    const uniqueNumbers = uuidv4()
        .replace(/[^0-9]/gi, '')
        .substring(0,10);
    return `${baseName}${uniqueNumbers}`;
}

function createProjects(optionsArray) {
    if (!Array.isArray(optionsArray)) throw new Error(`'${optionsArray}' should be an array`);
    const promises = optionsArray.map(options =>
        createProjectFromTemplate(options.projectName, options.projectType)
    );
    return Promise.all(promises);
}

function openProject(projectID, expectedResStatus = 200) {
    if (typeof projectID !== 'string') throw new Error(`'${projectID}' should be a string`);
    const req = () => reqService.chai
        .put(`/api/v1/projects/${projectID}/open`)
        .set('Cookie', ADMIN_COOKIE);
    return reqService.makeReq(req, expectedResStatus);
}

/**
 * @param {String} projectID
 * @param {number} [expectedResStatus] e.g. 202
 * @param {boolean} [awaitSocketConfirmation] true by default, so will wait for projectClose. Set to false to make it skip confirmation
 */
function closeProject(
    projectID,
    expectedResStatus = 202,
    awaitSocketConfirmation = true
) {
    if (typeof projectID !== 'string') throw new Error(`'${projectID}' should be a string`);
    const req = () => reqService.chai
        .put(`/api/v1/projects/${projectID}/close`)
        .set('Cookie', ADMIN_COOKIE);
    return awaitSocketConfirmation
        ? reqService.makeReqAndAwaitSocketMsg(req, expectedResStatus, { projectID, msgType: 'projectClosed' })
        : reqService.makeReq(req, expectedResStatus);
}

async function removeProject(pathToProjectDir, projectID){
    fs.removeSync(pathToProjectDir);
    await unbindProject(projectID);
}

/**
 *
 * @param {String} projectID
 * @param {String} [startMode] "run", "debug", and "debugNoInit" are permitted startModes
 * @param {number} [expectedResStatus] default 202
 * @param {boolean} [awaitSocketConfirmation] false by default, so won't wait for projectStart. Set to true to make it wait until the project is starting
 */
function restartProject(
    projectID,
    startMode = 'run',
    expectedResStatus = 202,
    awaitSocketConfirmation = false
) {
    if (typeof projectID !== 'string') throw new Error(`'${projectID}' should be a string`);
    const req = () => reqService.chai
        .post(`/api/v1/projects/${projectID}/restart`)
        .set('Cookie', ADMIN_COOKIE)
        .send({ startMode });
    return awaitSocketConfirmation
        ? reqService.makeReqAndAwaitSocketMsg(req, expectedResStatus, { projectID, msgType: 'projectStarting' })
        : reqService.makeReq(req, expectedResStatus);
}

async function getProjects() {
    const req = () => reqService.chai
        .get('/api/v1/projects')
        .set('Cookie', ADMIN_COOKIE);
    const res = await reqService.makeReq(req, 200);
    if (!Array.isArray(res.body)) throw new Error(`'${res.body}' should be an array`);
    return res.body;
}

async function getWatchList() {
    const req = () => reqService.chai
        .get('/api/v1/projects/watchlist')
        .set('Cookie', ADMIN_COOKIE);
    const res = await reqService.makeReq(req, 200);
    if (!Array.isArray(res.body.projects)) throw new Error(`'${res.body.projects}' should be an array`);
    return res.body.projects;
}

async function getProjectIdFromName(projectName) {
    if (typeof projectName !== 'string') throw new Error(`'${projectName}' should be a string`);
    const project = await getProjectByName(projectName);
    const { projectID } = project;
    return projectID;
}
async function getProjectByName(projectName) {
    if (typeof projectName !== 'string') throw new Error(`'${projectName}' should be a string`);
    const projects = await getProjects();
    const project = projects.find(project => project.name === projectName);
    return project;
}

async function getProject(id) {
    const req = () => reqService.chai
        .get(`/api/v1/projects/${id}`)
        .set('Cookie', ADMIN_COOKIE);
    const res = await reqService.makeReq(req, 200);
    const project = res.body;
    if (!project || typeof project !== 'object') throw new Error(`'${project}' should be an object`);
    return project;
}

async function getProjectIDs() {
    const projects = await getProjects();
    const projectIDs = projects.map(project => project.projectID);
    return projectIDs;
}

async function countProjects() {
    const projects = await getProjects();
    return projects.length;
}

/**
 * Waits indefinitely for GET project to succeed
 */
async function awaitProject(projectName) {
    const project = await getProjectByName(projectName);
    if (project) return true;

    await sleep(1000);
    return awaitProject(projectName);
}

async function awaitProjectStarted(projectID) {
    const socketService = await SocketService.createSocket();
    const expectedSocketMsg = {
        projectID,
        msgType: 'projectStarted',
    };
    await socketService.checkForMsg(expectedSocketMsg);
    socketService.close();
}

async function awaitProjectBuilding(projectID) {
    const socketService = await SocketService.createSocket();
    const expectedSocketMsg = {
        projectID,
        msgType: 'projectBuilding',
    };
    await socketService.checkForMsg(expectedSocketMsg);
    socketService.close();
}

async function runLoad(projectID, description) {
    const res = await reqService.chai
        .post(`/api/v1/projects/${projectID}/loadtest`)
        .set('Cookie', ADMIN_COOKIE)
        .send({ description });
    return res;
}

async function cancelLoad(projectID) {
    const res = await reqService.chai
        .post(`/api/v1/projects/${projectID}/loadtest/cancel`)
        .set('Cookie', ADMIN_COOKIE);
    return res;
}

async function getLogStreams(projectID) {
    const res = await reqService.chai
        .get(`/api/v1/projects/${projectID}/logs`)
        .set('Cookie', ADMIN_COOKIE);
    res.should.have.status(200);
    res.should.have.ownProperty('body');
    res.body.should.be.an('object');
    return res.body;
}

async function startLogStreams(projectID) {
    const res = await reqService.chai
        .post(`/api/v1/projects/${projectID}/logs`)
        .set('Cookie', ADMIN_COOKIE);
    res.should.have.status(200);
    res.should.have.ownProperty('body');
    res.body.should.be.an('object');
    return res.body;
}

async function cloneProject(giturl, dest) {
    await git().clone(giturl, dest);
}

function readCwSettings(projectPath) {
    return fs.readJSONSync(`${projectPath}/.cw-settings`);
}

async function notifyPfeOfFileChangesAndAwaitMsg(array, projectID) {
    const deflateAsync = promisify(zlib.deflate);
    const str = JSON.stringify(array);
    const strBuffer = await deflateAsync(str);
    const base64Compressed = strBuffer.toString('base64');

    const req = () => reqService.chai
        .post(`/api/v1/projects/${projectID}/file-changes?timestamp=${Date.now()}&chunk=1&chunk_total=1`)
        .set('Cookie', ADMIN_COOKIE)
        .send({ msg: base64Compressed });
    const expectedSocketMsg = {
        projectID,
        msgType: 'projectChanged',
    };
    await reqService.makeReqAndAwaitSocketMsg(req, 200, expectedSocketMsg);
}


module.exports = {
    generateUniqueName,
    createProjects,
    createProjectFromTemplate,
    openProject,
    closeProject,
    restartProject,
    getProjectIdFromName,
    getProjects,
    getWatchList,
    getProject,
    getProjectIDs,
    countProjects,
    awaitProject,
    awaitProjectStarted,
    awaitProjectBuilding,
    runLoad,
    cancelLoad,
    getLogStreams,
    startLogStreams,
    bindProject,
    bindStart,
    bindEnd,
    uploadEnd,
    uploadFiles,
    uploadFile,
    unbindProject,
    unbindAllProjects,
    removeProject,
    buildProject,
    cloneProject,
    readCwSettings,
    createProjectFromTemplate,
    notifyPfeOfFileChangesAndAwaitMsg,
};
