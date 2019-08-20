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
"use strict";
import * as fs from "fs";
import { promisify } from "util";
import { Operation } from "./operation";
import { ProjectInfo, AppLog, BuildLog } from "./Project";
import * as path from "path";
import * as projectUtil from "./projectUtil";
import * as utils from "../utils/utils";
import { getTranslation } from "../utils/locale";
import { LibertyValidator } from "./LibertyValidator";
import * as dockerutil from "../utils/dockerutil";
import { Validator, ValidationResult, Severity, ProblemType } from "./Validator";
import { ProjectCapabilities, defaultProjectCapabilities } from  "./Project";
import { StartModes, ControlCommands } from "./constants";
import * as locale from "../utils/locale";
import * as logger from "../utils/logger";
import * as logHelper from "./logHelper";
import * as projectEventsController from "../controllers/projectEventsController";


const readFileAsync = promisify(fs.readFile);

const serverXmlPath = "/src/main/liberty/config/server.xml";

export const requiredFiles = [ "/Dockerfile | /Dockerfile-lang", "/Dockerfile-build", "/pom.xml", serverXmlPath ];
const capabilities = new ProjectCapabilities([StartModes.run, StartModes.debug], [ControlCommands.restart]);

export const supportedType: string = "liberty";

/**
 * @description Relative path from project's root directory
 *
 * liberty project directory contains:
 * Dockerfile		Jenkinsfile		cli-config.yml		src
 * Dockerfile-build	README.md		mc-target		target
 * Dockerfile-tools	chart			pom.xml
 * .cfignore        .dockerignore       .gitignore          .cw-settings
 *
 * only want to watch ["/src", "/pom.xml", "/Dockerfile-build", "/.cw-settings", "/Dockerfile"], and "/chart" if on cloud
 * .swp, swx, 4913 files are all temporary files created by vim & vi, need to ignore thoses files
 *
 */
export const defaultIgnoredPath: string[] = ["/.project", "/Dockerfile-tools", "/target",
                                             "/mc-target", "/cli-config.yml", "/README.md", "/Jenkinsfile", "/.cfignore", "/load-test*",
                                             "*/node_modules*", "*/.git/*", "*/.DS_Store", "*/*.swp", "*/*.swx", "*/4913", "*/.dockerignore",
                                             "*/.gitignore", "*/*~", "/.settings", "/localm2cache.zip", "/libertyrepocache.zip"];
if (!process.env.IN_K8) {
    defaultIgnoredPath.push("/chart");
}

export const libertyAppLogs = {
    "messages": "messages", // for liberty project messages log
    "console": "console" // for liberty project console log
};

/**
 * @function
 * @description Create operation for a liberty project.
 *
 * @param operation <Required | Operation> - The create operation.
 *
 * @returns void
 */
export function create(operation: Operation): void {
    projectUtil.containerCreate(operation, "/file-watcher/scripts/liberty-container.sh", "create");
}

/**
 * @function
 * @description Update operation for a liberty project.
 *
 * @param operation <Required | Operation> - The update operation.
 * @param changedFiles <Optional | projectEventsController.IFileChangeEvent[]> - The file changed event array.
 *
 * @returns void
 */
export function update(operation: Operation, changedFiles?: projectEventsController.IFileChangeEvent[]): void {
    projectUtil.containerUpdate(operation, "/file-watcher/scripts/liberty-container.sh", "update");
}

/**
 * @function
 * @description Delete the container for a liberty project.
 *
 * @param projectInfo <Required | ProjectInfo> - The metadata information for a project.
 *
 * @returns Promise<void>
 */
export async function deleteContainer(projectInfo: ProjectInfo): Promise<void> {
    await projectUtil.containerDelete(projectInfo, "/file-watcher/scripts/liberty-container.sh");
}

/**
 * @function
 * @description Check to see if the project in the given location is of type liberty project.
 *
 * @param location <Required | String> - The folder location of the project.
 *
 * @returns Promise<boolean>
 */
export async function typeMatches(location: string): Promise<boolean> {
    const file = `${location}/pom.xml`;
    if (await utils.asyncFileExists(`${location}/pom.xml`)) {
        const data = await readFileAsync(file, "utf8");
        return data.indexOf("<groupId>net.wasdev.wlp.maven.plugins</groupId>") >= 0;
    }
    return false;
}

/**
 * @function
 * @description Validate a liberty project.
 *
 * @param operation <Required | Operation> - The validate operation for a liberty project.
 *
 * @returns Promise<void>
 */
export async function validate(operation: Operation): Promise<void> {

    const validator = new LibertyValidator(operation);

    await validator.validateRequiredFiles(requiredFiles);

    // Separately validate the server.xml and pom.xml since these files are required for successful builds
    const fullServerXmlPath = path.join(operation.projectInfo.location, serverXmlPath);

    if (!await utils.asyncFileExists(fullServerXmlPath)) {
        logger.logProjectError("server.xml not found at: " + fullServerXmlPath, operation.projectInfo.projectID);

        const missingServerXmlMsg = await getTranslation("buildApplicationTask.missingServerXml", { path: fullServerXmlPath });
        await logBuildEvent(operation.projectInfo, missingServerXmlMsg, true);
    }

    const filepath = operation.projectInfo.location + "/pom.xml";
    try {
        if (await utils.asyncFileExists(filepath)) {
            const pomResults = await validator.validatePOM(filepath);
            pomResults.forEach((val: any) => { validator.results.push(val); });
        }
    } catch (err) {
        logger.logProjectError("POM validation encountered an error.", operation.projectInfo.projectID);
        logger.logProjectError(err, operation.projectInfo.projectID);
        const filename = Validator.prototype.getFileName(filepath);
        const relativePath = filepath.replace("/codewind-workspace/", "");
        const result = new ValidationResult(
            Severity.error,
            filename,
            relativePath,
            ProblemType.invalid,
            await locale.getTranslation("libertyProject.pomParsingError"),
            "POM parsing error: " + err
        );
        validator.results.push(result);
    }
    const dockerfileBuildPath = operation.projectInfo.location + "/Dockerfile-build";
    try {
        if (await utils.asyncFileExists(dockerfileBuildPath)) {
            const dockerfileBuildResults = await validator.validateDockerfileBuild(dockerfileBuildPath);
            dockerfileBuildResults.forEach((val: any) => { validator.results.push(val); });
        }
    } catch (err) {
        logger.logProjectError("Dockerfile-Build validation encountered an error.", operation.projectInfo.projectID);
        logger.logProjectError(err, operation.projectInfo.projectID);

        const filename = Validator.prototype.getFileName(dockerfileBuildPath);
        const relativePath = dockerfileBuildPath.replace("/codewind-workspace/", "");
        const result = new ValidationResult(
            Severity.error,
            filename,
            relativePath,
            ProblemType.invalid,
            await locale.getTranslation("libertyProject.DockerfileBuildParsingError"),
            "Dockerfile-Build parsing error: " + err
        );
        validator.results.push(result);
    }

    validator.sendResult();
}

/**
 * @function
 * @description Log a message to the build.log for the given project.
 *
 * @param projectInfo <Required | ProjectInfo> - The metadata information for a project.
 * @param msg <Required | String> - The build log message.
 * @param isError <Required | Boolean> - Boolean to append error to the log.
 *
 * @returns Promise<any>
 */
export async function logBuildEvent(projectInfo: ProjectInfo, msg: String, isError: boolean): Promise<any> {
    if (process.env.NODE_ENV === "test") return;
    // have the message match the Maven format
    const msgLabel = isError ? "ERROR" : "INFO";
    const fullMsg = `\n[${msgLabel}] ${msg}`;

    const buildLog = await projectUtil.getProjectLogs(projectInfo);
    let buildLogPath;

    if (buildLog && buildLog.build && buildLog.build.files) {
        // the log build event is only called from liberty project and the file info is dumped into maven build file
        buildLogPath = buildLog.build.files.filter((value) => {
            return value.indexOf(logHelper.buildLogs.mavenBuild) > -1;
        })[0];
    }
    else {
        logger.logProjectError("Could not get build log for project", projectInfo.projectID);
        return;
    }

    logger.logProjectInfo(`Writing to build log at ${buildLog} :\n\t${fullMsg}`, projectInfo.projectID);

    fs.appendFile(buildLogPath, fullMsg, (err) => {
        if (err) {
            logger.logProjectError("File system error writing to build log: " + err, projectInfo.projectID);
        }
    });
}

/**
 * @function
 * @description Get the build log for a liberty project.
 *
 * @param projectLocation <Required | String> - The project location directory.
 * @param projectID <Required | String> - An alphanumeric identifier for a project.
 * @param logDirectory <Required | String> - The log location directory.
 * @param apiVersion <Required | String> - The filewatcher log api version.
 *
 * @returns Promise<BuildLog>
 */
export async function getBuildLog(logDirectory: string): Promise<BuildLog> {
    const logSuffixes = [logHelper.buildLogs.mavenBuild, logHelper.buildLogs.dockerBuild];
    return await logHelper.getBuildLogs(logDirectory, logSuffixes);
}

/**
 * @function
 * @description Get the app log for a liberty project.
 *
 * @param logDirectory <Required | String> - The log location directory.
 * @param projectID <Required | String> - An alphanumeric identifier for a project.
 * @param projectName <Required | String> - The project name.
 * @param projectLocation <Required | String> - The project location directory.
 *
 * @returns Promise<AppLog>
 */
export async function getAppLog(logDirectory: string, projectID: string, projectName: string, projectLocation: string): Promise<AppLog> {
    const appLogOrigin = process.env.HOST_OS === "windows" ? "container" : "workspace";
    const appLog: AppLog = {
        origin: appLogOrigin,
        files: []
    };

    const logDirs = [
        path.resolve(projectLocation + "/mc-target/liberty/wlp/usr/servers/defaultServer/logs/"), // for console.log and messages.log
        logDirectory, // for app.log
    ];

    const logSuffixes = [libertyAppLogs.console, libertyAppLogs.messages];
    const ffdclogPath = path.join(logDirs[0], `ffdc`);
    const inWorkspaceLogFiles = await logHelper.getLogFilesWithTimestamp(logDirs[1], [logHelper.appLogs.app]);

    let allAppLogFiles: logHelper.LogFiles[] = [];

    if (process.env.HOST_OS === "windows") {
        logDirs[0] = "/tmp/liberty/liberty/wlp/usr/servers/defaultServer/logs/";

        const containerName = projectUtil.getDefaultContainerName(projectID, projectLocation);
        const inContainerLogFiles = await logHelper.getLogFilesFromContainer(projectID, containerName, logDirs[0], logSuffixes);
        allAppLogFiles = inContainerLogFiles ? inContainerLogFiles.concat(inWorkspaceLogFiles) : allAppLogFiles;

        if ((await dockerutil.fileExistInContainer(projectID, containerName, ffdclogPath, projectName))) {
            appLog.dir = ffdclogPath;
        }
    } else {
        const inAppLogFiles = await logHelper.getLogFilesWithTimestamp(logDirs[0], logSuffixes);
        allAppLogFiles = inAppLogFiles ? inAppLogFiles.concat(inWorkspaceLogFiles) : allAppLogFiles;

        if (await utils.asyncFileExists(ffdclogPath)) {
            appLog.dir = ffdclogPath;
        }
    }

    // sort the log files in the recent order
    appLog.files = await logHelper.sortLogFiles(allAppLogFiles);

    return appLog;
}

/**
 * @function
 * @description Get the default app port of a liberty project.
 *
 * @returns string
 */
export function getDefaultAppPort(): string {
    return "9080";
}

/**
 * @function
 * @description Get the default debug port of a liberty project.
 *
 * @returns string
 */
export function getDefaultDebugPort(): string {
    return "7777";
}

/**
 * @function
 * @description Stop a liberty project.
 *
 * @param projectInfo <Required | ProjectInfo> - The metadata information for a project.
 *
 * @returns Promise<void>
 */
export async function stop(projectInfo: ProjectInfo): Promise<void> {
    await projectUtil.runScript(projectInfo, "/file-watcher/scripts/liberty-container.sh", "stop");
}

/**
 * @function
 * @description Start a liberty project.
 *
 * @param projectInfo <Required | ProjectInfo> - The metadata information for a project.
 *
 * @returns Promise<void>
 */
export async function start(projectInfo: ProjectInfo): Promise<void> {
    await projectUtil.runScript(projectInfo, "/file-watcher/scripts/liberty-container.sh", "start");
}

/**
 * @function
 * @description Rebuild a liberty project.
 *
 * @param projectInfo <Required | ProjectInfo> - The metadata information for a project.
 *
 * @returns Promise<void>
 */
export async function rebuild(projectInfo: ProjectInfo): Promise<void> {
    await projectUtil.runScript(projectInfo, "/file-watcher/scripts/liberty-container.sh", "rebuild");
}

/**
 * @function
 * @description Get the project capabilities of a liberty project.
 *
 * @returns ProjectCapabilities
 */
export function getCapabilities(): ProjectCapabilities {
    if (process.env.IN_K8 === "true") {
        return defaultProjectCapabilities;
    }
    return capabilities;
}
