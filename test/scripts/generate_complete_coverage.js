#!/usr/bin/env node
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
const { promisify } = require('util');
const exec = promisify(require('child_process').exec);
const dockerode = require('dockerode');
const docker = new dockerode();
const NYC = require('nyc');
const Logger = require(path.join(__dirname, '../../', 'src/pfe/portal/modules/utils/Logger'));
const log = new Logger('generate_complete_coverage.js');

Logger.setLoggingLevel('info');

const sleep = promisify(setTimeout);

const CONTAINER_NAME = 'codewind-pfe';

const PFE_DIR_ON_DISK = path.join(__dirname, '../../', './src/pfe');
const PORTAL_DIR_ON_DISK = path.join(PFE_DIR_ON_DISK, '/portal');
const FW_DIR_ON_DISK = path.join(PFE_DIR_ON_DISK, '/file-watcher');

const PFE_ENV_REQUIRED_NAME = 'ENABLE_CODE_COVERAGE';
const PFE_ENV_REQUIRED_VALUE = 'true';

const MERGED_NYC_COVERAGE_DIR = path.join(__dirname, '..', 'complete_nyc_coverage');
const MERGED_NYC_OUTPUT_DIR = path.join(MERGED_NYC_COVERAGE_DIR, 'merged_nyc_output');

const CONTAINER_NYC_OUTPUT_DIR = path.join(__dirname, '../container.nyc_output');
const CONTAINER_NYC_MERGED_JSON = path.join(MERGED_NYC_OUTPUT_DIR, 'containerNYCCoverage.json');

const LOCAL_NYC_OUTPUT_DIR = path.join(__dirname, '../coverage/.nyc_output');
const LOCAL_NYC_MERGED_JSON = path.join(MERGED_NYC_OUTPUT_DIR, 'localNYCCoverage.json');

const PORTAL_DIR_LOCATION_IN_CONTAINER = '/portal';
const PORTAL_NYC_OUTPUT_DIR_LOCATION_IN_CONTAINER = path.join(PORTAL_DIR_LOCATION_IN_CONTAINER, '.nyc_output');

const FW_NYC_OUTPUT_DIR = path.join(FW_DIR_ON_DISK, 'server/.nyc_output');
const FW_NYC_MERGED_JSON = path.join(MERGED_NYC_OUTPUT_DIR, 'filewatcherNYCCoverage.json');


const NYC_CONFIG = {
    cwd: PFE_DIR_ON_DISK,
    tempDir: MERGED_NYC_OUTPUT_DIR,
    reportDir: MERGED_NYC_COVERAGE_DIR,
    reporter: ['html', 'text', 'text-summary'], 
};

const main = async() => {
    await setup();

    // local first as we can only kill the container once
    await mergeNYCOutputIntoJSON(LOCAL_NYC_OUTPUT_DIR, LOCAL_NYC_MERGED_JSON);

    const container = docker.getContainer(CONTAINER_NAME);
    await ensureContainerCanReportCoverage(container);
    await sendKillCommandToContainer(container);
    await copyFileFromPFEContainer(PORTAL_NYC_OUTPUT_DIR_LOCATION_IN_CONTAINER, CONTAINER_NYC_OUTPUT_DIR);
    await mergeNYCOutputIntoJSON(CONTAINER_NYC_OUTPUT_DIR, CONTAINER_NYC_MERGED_JSON);
    await replaceStringInFile(CONTAINER_NYC_MERGED_JSON, PORTAL_DIR_LOCATION_IN_CONTAINER, PORTAL_DIR_ON_DISK);

    const FW_COVERAGE_ENABLED = process.env.FW_COVERAGE_ENABLED;
    const doesFWNYCOutputDirExist = await fs.pathExists(FW_NYC_OUTPUT_DIR);
    log.debug(`FW Coverage: ${FW_COVERAGE_ENABLED}, FW NYC Output: ${doesFWNYCOutputDirExist}`);
    if (FW_COVERAGE_ENABLED && FW_COVERAGE_ENABLED === 'true' && doesFWNYCOutputDirExist) {
        await mergeNYCOutputIntoJSON(FW_NYC_OUTPUT_DIR, FW_NYC_MERGED_JSON);
    }

    await createNYCReport();

    await cleanUp();
};

const setup = async() => {
    log.debug(`Removing old coverage directories and creating new ones`);
    await fs.remove(MERGED_NYC_COVERAGE_DIR);
    log.debug(`Creating output directories`);
    return fs.ensureDir(MERGED_NYC_OUTPUT_DIR); 
};

const ensureContainerCanReportCoverage = async container => {
    log.info(`Checking ${CONTAINER_NAME} is running`);
    const containerInfo = await container.inspect();
    const { State: { Running }, Config: { Env: envArray } } = containerInfo;
    if (!Running) {
        throw new Error(`${CONTAINER_NAME} is not running, Codewind must be running`);
    }
    checkEnvSetInArray(envArray);
};

const checkEnvSetInArray = array => {
    log.info(`Checking ${CONTAINER_NAME} contains the correct NODE_ENV variable`);
    for (const env of array) {
        if (env.startsWith(`${PFE_ENV_REQUIRED_NAME}=`)) {
            const envValue = env.replace(`${PFE_ENV_REQUIRED_NAME}=`, '');
            if (envValue === PFE_ENV_REQUIRED_VALUE) {
                return;
            }
            const errString = `${CONTAINER_NAME}'s ${PFE_ENV_REQUIRED_NAME} is not set to ${PFE_ENV_REQUIRED_VALUE} and so does not have coverage enabled \
                                (actually set to ${envValue}) - Restart Codewind with the ${PFE_ENV_REQUIRED_NAME} env set to ${PFE_ENV_REQUIRED_VALUE}`;
            throw new Error(errString);
        }
    }
    throw new Error(`${CONTAINER_NAME} does not contains NODE_ENV variable`);
};

const sendKillCommandToContainer = async container => {
    log.info(`Sending the exit command to ${CONTAINER_NAME}`);
    const exec = await container.exec({ Cmd: ['pkill', '-o', 'node'] });
    await exec.start();
    const timeoutAmount = 10;
    let containerRunning = true;
    for (let index = 0; (index < timeoutAmount && containerRunning); index++) {
        log.debug(`Waiting for ${CONTAINER_NAME} to exit, been waiting for ${index} seconds`);
        const containerInfo = await container.inspect();
        const { State: { Running } } = containerInfo;
        containerRunning = Running;
        await sleep(1000);
    }
    if (containerRunning) {
        throw new Error(`The container ${CONTAINER_NAME} failed to exit`);
    }
    log.info(`${CONTAINER_NAME} has exited`);
};

const copyFileFromPFEContainer = (pathInContainer, pathToCopyFileTo) => {
    // Use docker cp as using the Docker API would mean downloading and untarring a directory
    log.info(`Using 'docker cp' to copy the nyc file out of the ${CONTAINER_NAME} container`);
    const dockerCP = `docker cp codewind-pfe:${pathInContainer} ${pathToCopyFileTo}`;
    log.debug(`docker cp command: ${dockerCP}`);
    return exec(dockerCP);
};

const replaceStringInFile = async(filePath, oldString, newString) => {
    log.debug(`Replacing the string ${oldString} in ${filePath} with ${newString}`);
    const fileContents = await fs.readFile(filePath, 'utf8');
    const regExp = new RegExp(oldString, 'g');
    const newFileContents = fileContents.replace(regExp, newString);
    return fs.writeFile(filePath, newFileContents, 'utf8');
};

const mergeNYCOutputIntoJSON = async(nycOutputDir, nycJsonFile) => {
    log.info(`Merging ${nycOutputDir} into a single JSON file`);
    const dirExists = await fs.pathExists(nycOutputDir);
    if (!dirExists) throw new Error(`NYC output directory "${nycOutputDir}" does not exist`);
    const files = await fs.readdir(nycOutputDir);
    if (files.length === 0) throw new Error(`NYC output directory "${nycOutputDir}" is empty`);
    const nyc = new NYC(NYC_CONFIG);
    const map = await nyc.getCoverageMapFromAllCoverageFiles(nycOutputDir);
    return fs.writeJSON(nycJsonFile, map, 'utf8');
};

const createNYCReport = async() => {
    log.info(`Creating the single nyc report`);
    const nyc = new NYC(NYC_CONFIG);
    await nyc.report();
    const indexHTMLPath = path.join(MERGED_NYC_COVERAGE_DIR, 'index.html');
    const indexHTMLExists = await fs.pathExists(indexHTMLPath);
    log.debug(`index.html exists = ${indexHTMLExists}`);
    if (indexHTMLExists) {
        log.info(`Open ${indexHTMLPath} in a browser to view the coverage`);
    }
};

const cleanUp = () => {
    log.debug('Cleaning up');
    return fs.remove(CONTAINER_NYC_OUTPUT_DIR);
};

main().catch(err => {
    log.error(err);
    process.exit(1);
});
