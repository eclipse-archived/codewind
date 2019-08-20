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

const reqService = require('./request.service');
const SocketService = require('./socket.service');
const containerService = require('./container.service');
const { ADMIN_COOKIE, containerDir, templateOptions } = require('../config');

chai.should();
const sleep = promisify(setTimeout);
const isObject = (obj) => (!!obj && obj.constructor === Object);

const fastestCreationOptions = {
    language: 'nodejs',
    framework: 'spring',
};

async function cloneAndBindAndBuildProject(projectName, projectType) {
    const workspace = await findWorkspaceLocation();
    const projectPath = `${workspace}/${projectName}`;
    await cloneProject(templateOptions[projectType].url, projectPath);
    
    const res = await bindProject({
        name: projectName,
        path: projectPath,
        language: templateOptions[projectType].language,
        projectType,
        autoBuild: true,
    });
    return res.body.projectID;
}

async function cloneAndBindProject(projectName, projectType) {
    const workspace = await findWorkspaceLocation();
    const projectPath = `${workspace}/${projectName}`;
    await cloneProject(templateOptions[projectType].url, projectPath);
    
    await validate(projectPath);
    
    const res = await bindProjectWithoutBuilding({
        name: projectName,
        path: projectPath,
        language: templateOptions[projectType].language,
        projectType,
    });
    return res.body.projectID;
}

async function createProjectFromTemplate(options){
    const res = await reqService.chai
        .post('/api/v1/projects')
        .set('cookie', ADMIN_COOKIE)
        .send(options);
    return res;
}

/**
 * DEPRECATED
 * @param {JSON} [options] e.g. { name: 'example' }
 * @param {number} [expectedResStatus] default 202
 * @param {boolean} [awaitSocketConfirmation] false by default, so won't wait for projectStart. Set to true to make it wait until the project is starting
 */
async function createProjectAndAwaitID(
    options,
    expectedResStatus = 202,
    awaitSocketConfirmation = false,
) {
    const completeOptions = completeCreationOptions(options);
    await createProject(completeOptions, expectedResStatus, awaitSocketConfirmation);
    await awaitProject(completeOptions.name);
    const projectID = await getProjectIdFromName(completeOptions.name);
    return projectID;
}

/**
 * DEPRECATED - remove from here when removed from all test files
 * @param {JSON} [options] e.g. { name: 'example' }
 * @param {number} [expectedResStatus] default 202
 * @param {boolean} [awaitSocketConfirmation] false by default, so won't wait for projectStart. Set to true to make it wait until the project is starting
 */
async function createProject(
    options,
    expectedResStatus = 202,
    awaitSocketConfirmation = false,
) {
    const completeOptions = completeCreationOptions(options);
    const req = () => reqService.chai
        .post('/api/v1/projects')
        .set('Cookie', ADMIN_COOKIE)
        .send(completeOptions);
    awaitSocketConfirmation
        ? await reqService.makeReqAndAwaitSocketMsg(req, expectedResStatus, { msgType: 'projectStarting' })
        : await reqService.makeReq(req, expectedResStatus);
}

/**
 * DEPRECATED - remove from here when removed from all test files
 * @param {JSON} [options] e.g. { name: 'example' }
 * @param {number} [expectedResStatus] default 202
 */
async function createNonBuiltProject(
    options,
    expectedResStatus = 202,
) {
    const name = options.name;
    const completeOptions = completeCreationOptions(options);
    completeOptions.autoBuild = false;
    const req = () => reqService.chai
        .post('/api/v1/projects')
        .set('Cookie', ADMIN_COOKIE)
        .send(completeOptions);
    await reqService.makeReqAndAwaitSocketMsg(req, expectedResStatus, { name, msgType: 'projectCreation' });
    const projectID = await getProjectIdFromName(completeOptions.name);
    return projectID;
}

/**
 * DEPRECATED - remove from here when removed from all test files
 * @param {JSON} [options]
 * @returns {JSON} JSON with 'name', 'language', and (if 'language' is Java) 'framework' fields set to default values if they were empty
 */
function completeCreationOptions(options = {}) {
    if (!isObject(options)) throw new Error(`'${options}' should be an object`);
    if (options.extension) return options;

    const completeOptions = { ...options };

    completeOptions.name = options.name || generateUniqueName();
    completeOptions.language = templateOptions[options.type].language;
    completeOptions.url = templateOptions[options.type].url;
    
    return completeOptions;
}

async function validate(projectPath) {
    const res = await reqService.chai
        .post('/api/v1/validate')
        .set('cookie', ADMIN_COOKIE)
        .send({ projectPath });
    return res;
}

/**
 * @param {JSON} [options] e.g. { name: 'example' }
 * @param {number} [expectedResStatus] default 202
 */
async function bindProject(options, expectedResStatus = 202) {
    const req = () => reqService.chai
        .post('/api/v1/projects/bind')
        .set('Cookie', ADMIN_COOKIE)
        .send(options);
    const res = await reqService.makeReqAndAwaitSocketMsg(req, expectedResStatus, { msgType: 'projectBind' });
    return res;
}


async function bindProjectAndWaitForMsg(
    options,
    expectedResStatus = 202,
) {
    const req = () => {
        return reqService.chai
            .post('/api/v1/projects/bind')
            .set('Cookie', ADMIN_COOKIE)
            .send(options);
    };
    const res = await reqService.makeReqAndAwaitSocketMsg(req, expectedResStatus, { msgType: 'projectCreation' });
    return res;
}

function bindProjectWithoutBuilding(options) {
    const newOptions = { ...options };
    newOptions.autoBuild = false;
    return bindProject(newOptions);
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

function createProjects(optionsArray, expectedResStatus) {
    if (!Array.isArray(optionsArray)) throw new Error(`'${optionsArray}' should be an array`);
    const promises = optionsArray.map(options => createProject(options, expectedResStatus));
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

async function deleteProjectDir(projectName){
    const workspace_location = await findWorkspaceLocation();
    const projectPath = path.join(workspace_location, projectName);
    // after is failing in jenkins with permission issues.  This is not
    // actually part of the test, its us trying to be good and clean up   

    //await fs.remove(projectPath);
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

async function findWorkspaceLocation() {
    const res = await reqService.chai
        .get('/api/v1/environment')
        .set('Cookie', ADMIN_COOKIE);
    res.should.have.status(200);
    res.should.have.ownProperty('body');
    const { workspace_location } =  res.body;
    await containerService.ensureDir(containerDir);
    return workspace_location;
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
    fastestCreationOptions,
    generateUniqueName,
    createNonBuiltProject,
    createProjectAndAwaitID,
    createProject,
    createProjects,
    createProjectFromTemplate,
    completeCreationOptions,
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
    validate,
    bindProject,
    unbindProject,
    deleteProjectDir,
    buildProject,
    cloneProject,
    findWorkspaceLocation,
    readCwSettings,
    cloneAndBindAndBuildProject,
    cloneAndBindProject,
    bindProjectAndWaitForMsg,
    notifyPfeOfFileChangesAndAwaitMsg,
};
