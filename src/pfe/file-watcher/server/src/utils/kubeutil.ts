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

import { promisify } from "util";
import { exec } from "child_process";
import { Operation } from "../projects/operation";
const execAsync = promisify(exec);
import * as path from "path";
import * as logger from "./logger";
import { ContainerStates } from "../projects/constants";
import * as processManager from "./processManager";
import { ProcessResult } from "./processManager";
import { ProjectInfo } from "../projects/Project";
import * as logHelper from "../projects/logHelper";

const Client = require("kubernetes-client").Client; // tslint:disable-line:no-require-imports
const config = require("kubernetes-client").config; // tslint:disable-line:no-require-imports
let k8sClient: any = undefined;

if (process.env.IN_K8) {
    k8sClient = new Client({ config: config.getInCluster(), version: "1.9"});
}

const KUBE_NAMESPACE = process.env.KUBE_NAMESPACE || "default";

export interface PodInfo {
    podName: string;
    ip: string;
    serviceName: string;
    exposedPort: string;
    internalPort: string;
    podPorts: string[];
  }

  /**
   * @function
   * @description Get kube pod info.
   *
   * @param projectInfo <Required | ProjectInfo> - The metadata information for a project.
   * @param operation <Required | Operation> - The operation to get kube pod info.
   *
   * @returns Promise<PodInfo>
   */
export async function getApplicationContainerInfo(projectInfo: ProjectInfo, operation: Operation): Promise<PodInfo> {
    const projectID = projectInfo.projectID;
    const info: PodInfo = {
        podName: "",
        ip: "",
        serviceName: "",
        exposedPort: "",
        internalPort: "",
        podPorts: []
      };
    const projectLocation = operation.projectInfo.location;
    if (projectLocation.endsWith("/")) {
        projectLocation.slice(0, -1);
    }

    const releaseName = operation.containerName;
    let releaseLabel = "release=" + releaseName;
    if (projectInfo.projectType == "odo") {
        if (!projectInfo.compositeAppName) {
            return undefined;
        }

        const componentName = path.basename(projectInfo.location);
        releaseLabel = "deploymentconfig=" + "cw-" + componentName + "-" + projectInfo.compositeAppName;
    }
    const projectName = path.basename(projectLocation);

    // Before deploying the application, we added a release label to the deployment, pod, and service,
    // Use that to get the application's pod and service names.
    // If the application is stuck in the starting state with missing ports, it's likely a step below here failed.

    // Get the pod name for project
    try {
        let podName;
        const resp = await k8sClient.api.v1.namespaces(KUBE_NAMESPACE).pods.get({ qs: { labelSelector: releaseLabel } });
        // We are getting the list of pods by the release label
        for ( let i = 0 ; i < resp.body.items.length ; i++ ) {
            if (resp.body.items[i].status && resp.body.items[i].status.phase) {
                // For a terminating pod, the metadata.deletionTimestamp will be set
                if (resp.body.items[i].status.phase !== "Running") {
                    logger.logProjectInfo("Application pod is not running, the status is: " + resp.body.items[i].status.phase, projectID, projectName);
                    continue;
                } else if (resp.body.items[i].metadata.deletionTimestamp == undefined) {
                    podName = resp.body.items[i].metadata.name;
                }
            }
        }

        info.podName = podName;
        if (podName) {
            logger.logProjectInfo("Found the pod while looking up service information for project.", projectID, projectName);
            logger.logProjectInfo("Pod name: " + podName, projectID, projectName);
        } else {
            logger.logProjectInfo("Pod name was not found while looking up service information for project.", projectID, projectName);
        }
    } catch (err) {
        logger.logProjectError("Failed to get the pod name for: " + path.basename(projectLocation), projectID, projectName);
        logger.logProjectError(err, projectID, projectName);
    }

    /*
     *  IMPORTANT: If the pod name is undefined that means the helm install failed so there isn't actually a release so we should return
     *  at this point since it's possible that another release can have a deployment with the same name and we'd end up sending the port/ip
     *  information for the wrong deployment and marking the application as running.
     */
    if (info.podName === undefined) {
        return info;
    }

    // Get the internal and exposed ports
    try {
        const internalPorts: Array<string> = [];
        const exposedPorts: Array<string> = [];
        const appPorts = projectInfo.appPorts;
        let resp: any = undefined;
        let deploymentconfig: string = undefined;

        if (projectInfo.projectType == "odo") {
            resp = await k8sClient.api.v1.namespaces(KUBE_NAMESPACE).services.get();
            const res: string[] = releaseLabel.split("=");
            deploymentconfig = res[1].trim();
        } else {
            resp = await k8sClient.api.v1.namespaces(KUBE_NAMESPACE).services.get({ qs: { labelSelector: releaseLabel } });
        }

        // iterate through the available ports and store both the internal and exposed ports
        for ( let i = 0 ; i < resp.body.items.length ; i++ ) {
            if (projectInfo.projectType != "odo" || (projectInfo.projectType == "odo" && resp.body.items[i].spec.selector.deploymentconfig == deploymentconfig)) {
                info.serviceName = resp.body.items[i].metadata.name;
                for (let j = 0; j < resp.body.items[i].spec.ports.length; j++) {
                    internalPorts.push(String(resp.body.items[i].spec.ports[j].targetPort));
                    exposedPorts.push(String(resp.body.items[i].spec.ports[j].nodePort));
                }
            }
        }

        info.podPorts = internalPorts;

        let appPortMatched = false;

        // iterate through the list of ports recieved to match with the internal ports
        for (let i = 0; i < appPorts.length; i++) {
            const port = appPorts[i];

            // check if the appPort recieved matches any of the available ports
            if (internalPorts.includes(port)) {

              // set the internal port to be the matched appPort
              info.internalPort = port;

              const indexOfPort = internalPorts.indexOf(port);
              // set the exposed port that matches the matched internal port
              info.exposedPort = exposedPorts[indexOfPort];

              // set the app port to be matched only if the exposed port has been set
              appPortMatched = info.exposedPort ? true : false;

              // break out of the loop if the port has been assigned
              break;
            }
        }

        // if the app ports didn't match, assign them to the first available port
        if (!appPortMatched) {
            info.internalPort = internalPorts[0];
            info.exposedPort = exposedPorts[0];
        }

        // For Che on K8s, we are now using the service name for the application ping hostname
        // Check projectUtil.isApplicationUp() for relevant logic
        // log the service name/hostname
        logger.logProjectInfo("IP address info: " + info.serviceName, projectID, projectName);

        // log internalPorts and exposedPorts
        logger.logProjectInfo("Internal port: " + info.internalPort, projectInfo.projectID, projectInfo.projectName);
        logger.logProjectInfo("Exposed port: " + info.exposedPort, projectInfo.projectID, projectInfo.projectName);

        // log podPorts
        logger.logProjectInfo("All the exposed pod ports: " + JSON.stringify(info.podPorts), projectInfo.projectID, projectInfo.projectName);
    } catch (err) {
        logger.logProjectError("Failed to get the service internal/exposed port for project: " + projectName, projectID, projectName);
        logger.logProjectError(err, projectID, projectName);
    }

    return info;
}

/**
 * @function
 * @description Get files of folders from a kube container with timestamps.
 *
 * @param projectID <Required | String> - An alphanumeric identifier for a project.
 * @param containerName <Required | String> - The docker container name.
 * @param fileLocation <Required | String> - The file location inside the container.
 * @param folderName <Optional | String> - Check for folder names if specified.
 *
 * @returns Promise<Array<logHelper.LogFiles>>
 */
export async function getFilesOrFoldersInContainerWithTimestamp(projectID: string, containerName: string, fileLocation: string, folderName?: string): Promise<Array<logHelper.LogFiles>> {
    logger.logProjectInfo("Looking for all log files in container " + containerName, projectID);
    const containerIsActive = await isContainerActive(containerName);
    if (!containerName || !containerIsActive.state || containerIsActive.state === ContainerStates.containerNotFound) return [];
    else {
        const releaseLabel = "release=" + containerName;
        const podName = await getPodName(projectID, releaseLabel);
        if (!podName) return [];
        const cmd = `ls --full-time ${fileLocation} | tail -n +2`;
        try {
            // get all data from the container exec
            const data: ProcessResult = await runKubeCommand(projectID, ["exec", "-i", podName, "--", "sh", "-c", cmd]);
            if (data.exitCode != 0) {
                logger.logInfo("Failed to execute kubectl command");
                return;
            } else if (data.stdout.indexOf("No such file or directory") > -1) {
                logger.logInfo("No files were found");
                return [];
            } else {
                logger.logInfo("At least one file was found");
                const lines = data.stdout.split("\n");
                const fileIndex = 8; // file is the 9th argument from the above command
                const filesTimestamp: Array<logHelper.LogFiles> = [];
                for (let line of lines) {
                    line = line.replace(/[^ -~]+/g, "").replace(/\s+/g, " ").trim();
                    if (line != "") {
                        const file = line.split(" ")[fileIndex];
                        const dateString = line.split(" ")[fileIndex - 3] + " " + line.split(" ")[fileIndex - 2] + " " + line.split(" ")[fileIndex - 1];
                        if (!folderName) {
                            filesTimestamp.push({file: path.join(fileLocation, file), time: +new Date(dateString)});
                        } else {
                            if (file.toLowerCase() === folderName.toLowerCase()) {
                                filesTimestamp.push({file: path.join(fileLocation, folderName), time: +new Date(dateString)});
                                break;
                            }
                        }
                    }
                }
                return filesTimestamp;
            }
        } catch (err) {
            const errMsg = "Error checking existence for " + fileLocation + " in container " + containerName;
            logger.logProjectError(errMsg, projectID);
            logger.logProjectError(err, projectID);
        }
        return;
    }
  }

/**
 * @function
 * @description Check to see if container is active.
 *
 * @param containerName <Required | String> - The kube container name.
 *
 * @returns Promise<any>
 */
export async function isContainerActive(containerName: string, projectInfo?: ProjectInfo): Promise<any> {
    try {
        let releaseLabel = "release=" + containerName;
        if (projectInfo && projectInfo.projectType == "odo") {
            const componentName = path.basename(projectInfo.location);
            releaseLabel = "deploymentconfig=" + "cw-" + componentName + "-" + projectInfo.compositeAppName;
        }
        let containerState = {state: ContainerStates.containerNotFound};
        // We are getting the list of pods by the release label
        const resp = await k8sClient.api.v1.namespaces(KUBE_NAMESPACE).pods.get({ qs: { labelSelector: releaseLabel } });
        const podInfo = resp.body;

        if (podInfo && podInfo.items && (Object.keys(podInfo.items).length > 0)) {
            for (const pod of podInfo.items) {
                if (pod.status && pod.status.phase) {
                    const podPhase =  pod.status.phase;
                    // Pod phases are Pending, Running, Succeeded (terminated in success),
                    // Failed, Unknown
                    if (podPhase !== "Pending" && podPhase !== "Running") {
                        continue;
                    }
                }
                if (pod.status && pod.status.containerStatuses &&
                    Object.keys(pod.status.containerStatuses).length > 0) {
                    for (const containerStatus of pod.status.containerStatuses) {
                        // Container state entries are running, terminated, waiting
                        // Container waiting reasons are: PodInitializing, ContainerCreating, CrashLoopBackOff, ErrImagePull, ImagePullBackOff
                        if (containerStatus.state && containerStatus.state.running) {
                            containerState = {state: ContainerStates.containerActive};
                        } else if (containerStatus.state && containerStatus.state.waiting &&
                            containerStatus.state.waiting.reason &&
                            (containerStatus.state.waiting.reason === "PodInitializing" || containerStatus.state.waiting.reason === "ContainerCreating")) {
                            containerState = {state: ContainerStates.containerStarting};
                        } else {
                            // No active pods or containers
                            containerState = {state: ContainerStates.containerStopped};
                        }
                    }
                }
            }
        } else {
            containerState = {state: ContainerStates.containerNotFound};
        }

        return containerState;
    } catch (err) {
        const msg = "Error getting container status: " + err;
        logger.logError(msg);
        return {error: err};
    }
}


/**
 * @function
 * @description Remove the project's Helm release
 *
 * @param projectID <Required | String> - An alphanumeric identifier for a project.
 * @param deploymentName <Required | String> - The name of the release.
 *
 * @returns Promise<ProcessResult>
 */
export async function deleteHelmRelease(projectID: string, releaseName: string): Promise<ProcessResult> {
    const deleteRelease: string[] = ["delete", releaseName];
    let response: ProcessResult;

    // Remove deployment
    try {
        logger.logProjectInfo("Removing Helm release", projectID);
        response = await runHelmCommand(projectID, deleteRelease);
    } catch (err) {
        logger.logProjectError("Error removing Helm release", projectID);
        logger.logProjectError(err, projectID);
        throw err;
    }

    return response;
}

/**
 * @function
 * @description Print helm status
 *
 * @param projectID <Required | String> - An alphanumeric identifier for a project.
 * @param releaseName <Required | String> - The name of the deployment.
 *
 * @returns Promise<void>
 */
export async function printHelmStatus(projectID: string, releaseName: string): Promise<void> {
    const helmStatus: string[] = ["status", releaseName];
    let response: ProcessResult;

    // Print the release
    try {
        logger.logProjectInfo("Printing Helm release", projectID);
        response = await runHelmCommand(projectID, helmStatus);
        logger.logProjectInfo(response.stdout, projectID);
    } catch (err) {
        logger.logProjectError("Error getting the Helm release", projectID);
        logger.logProjectError(err, projectID);
    }
}

/**
 * @function
 * @description Install helm chart.
 *
 * @param projectID <Required | String> - An alphanumeric identifier for a project.
 * @param deploymentName <Required | String> - The name of the deployment.
 * @param chartLocation <Required | String> - The location of the chart file.
 *
 * @returns Promise<ProcessResult>
 */
export async function installChart(projectID: string, deploymentName: string, chartLocation: string, imagePushRegistry: string): Promise<ProcessResult> {
    const installDeployment: string[] = ["upgrade", deploymentName, chartLocation, "--install", "--recreate-pods", "--values=/file-watcher/scripts/override-values.yaml", "--set", "image.repository=" + imagePushRegistry + "/" + deploymentName];
    let response: ProcessResult;

    // Install deployment
    try {
        logger.logProjectInfo("Installing helm chart", projectID);
        response = await runHelmCommand(projectID, installDeployment);
    } catch (err) {
        logger.logProjectError("Error installing helm chart", projectID);
        logger.logProjectError(err, projectID);
        throw err;
    }

    return response;
}

export async function exposeOverIngress(projectID: string, isHTTPS: boolean, appPort?: number): Promise<string> {
    let ownerReferenceName: string;
    let ownerReferenceUID: string;
    let serviceName: string;
    let servicePort: number;

    try {
        let resp: any = undefined;

        // Get the deployment name and uid labeled with the unique project ID
        resp = await k8sClient.apis.apps.v1.namespaces(KUBE_NAMESPACE).deployments.get({ qs: { labelSelector: "projectID=" + projectID } });
        ownerReferenceName = resp.body.items[0].metadata.name;
        ownerReferenceUID = resp.body.items[0].metadata.uid;

        // Get the service name labeled with the unique project ID
        resp = await k8sClient.api.v1.namespaces(KUBE_NAMESPACE).services.get({ qs: { labelSelector: "projectID=" + projectID } });
        if (!appPort) {
            // If the servicePort wasn't passed in, retrieve it from the service
            servicePort = parseInt(resp.body.items[0].spec.ports[0].port, 10);
        } else {
            servicePort = appPort;
        }
        serviceName = resp.body.items[0].metadata.name;
    } catch (err) {
        logger.logProjectError("Unable to retrieve project deployment or service", projectID);
        throw err;
    }

    // Calculate the ingress domain
    // Thanks to Kubernetes and Ingress, some ingress controllers impose a character limitation on the host name, so:
    // If the ingress domain prefix is < 62 characters, trim the resultant app's ingress domain to fit within the limit
    // If the ingress domain prefix is >= 62 characters, don't trim, as the character limit likely doesn't apply here.
    const ingressPrefix = process.env.INGRESS_PREFIX;
    const ingressPrefixLength = ingressPrefix.length;
    let ingressDomain: string;
    if (ingressPrefixLength < 62) {
        // Since we include a dash, calculate the difference between 62 chars and the prefix
        const spaceRemaining = 62 - ingressPrefixLength;
        ingressDomain = serviceName.substring(0, spaceRemaining) + "-" + ingressPrefix;
    } else {
        ingressDomain = serviceName + "-" + ingressPrefix;
    }

    logger.logProjectInfo("*** Ingress: " + ingressDomain, projectID);

    try {
        // Re-use the unique service name as the ingress name
        const ingressName = serviceName;

        // Create an ingress resource for the specified service name and port
        const ingress = {
            "apiVersion": "extensions/v1beta1",
            "kind": "Ingress",
            "metadata": {
                "labels": {
                    "projectID": `${projectID}`
                },
                "name": `${ingressName.substring(0, 62)}`,
                "ownerReferences": [
                    {
                        "apiVersion": "apps/v1",
                        "blockOwnerDeletion": true,
                        "controller": true,
                        "kind": "ReplicaSet",
                        "name": `${ownerReferenceName}`,
                        "uid": `${ownerReferenceUID}`
                    }
                ]
            },
            "spec": {
                "rules": [
                    {
                        "host": `${ingressDomain}`,
                        "http": {
                            "paths": [
                                {
                                    "backend": {
                                        "serviceName": `${serviceName}`,
                                        "servicePort": servicePort
                                    },
                                    "path": "/"
                                }
                            ]
                        }
                    }
                ]
            }
        };

        // If an old ingress already exists, delete it first (to ensure port updates are reflected)
        // Then create the ingress resource for the application
        const resp = await k8sClient.apis.extensions.v1beta1.namespaces(KUBE_NAMESPACE).ingresses.get({ qs: { labelSelector: "projectID=" + projectID } });
        if (resp.body.items.length > 0) {
            const ingressName = resp.body.items[0].metadata.name;
            await k8sClient.apis.extensions.v1beta1.namespaces(KUBE_NAMESPACE).ingresses(ingressName).delete();
        }
        await k8sClient.apis.extensions.v1beta1.namespaces(KUBE_NAMESPACE).ingresses.post({body: ingress});
    } catch (err) {
        logger.logProjectError("Unable to deploy ingress for project", projectID);
        throw err;
    }

    // Add the scheme to the ingress domain and return it as the URL
    if (isHTTPS) {
        return "https://" + ingressDomain;
    } else {
        return "http://" + ingressDomain;
    }
}

/**
 * @function
 * @description Run a helm command.
 *
 * @param projectID <Required | String> - An alphanumeric identifier for a project.
 * @param args <Required | String[]> - List of args to pass to the helm command.
 *
 * @returns Promise<ProcessResult>
 */
async function runHelmCommand(projectID: string, args: string[]): Promise<ProcessResult> {
    try {
        logger.logProjectInfo("Running helm command: helm " + args, projectID);
        return await processManager.spawnDetachedAsync(projectID, "helm", args, {});
    } catch (err) {
        throw err;
    }
}

/**
 * @function
 * @description Run a kubectl command.
 *
 * @param projectID <Required | String> - An alphanumeric identifier for a project.
 * @param args <Required | String[]> - List of args to pass to the kubectl command.
 *
 * @returns Promise<ProcessResult>
 */
export async function runKubeCommand(projectID: string, args: string[]): Promise<ProcessResult> {
    try {
        logger.logProjectInfo("Running kube command: kubectl " + args, projectID);
        return await processManager.spawnDetachedAsync(projectID, "kubectl", args, {});
    } catch (err) {
        throw err;
    }
}

/**
 * @function
 * @description Get pod name give the release label.
 *
 * @param projectID <Required | String> - An alphanumeric identifier for a project.
 * @param releaseLabel <Required | String> - The release label generated from the container id.
 *
 * @returns Promise<string>
 */
export async function getPodName(projectID: string, releaseLabel: string): Promise<string> {
    let podName;
    const resp = await k8sClient.api.v1.namespaces(KUBE_NAMESPACE).pods.get({ qs: { labelSelector: releaseLabel } });
    // We are getting the list of pods by the release label
    for ( let i = 0 ; i < resp.body.items.length ; i++ ) {
        if (resp.body.items[i].status && resp.body.items[i].status.phase) {
            // For a terminating pod, the metadata.deletionTimestamp will be set
            if (resp.body.items[i].status.phase !== "Running") {
                logger.logProjectInfo("Application pod is not running, the status is: " + resp.body.items[i].status.phase, projectID);
                continue;
            } else if (resp.body.items[i].metadata.deletionTimestamp == undefined) {
                podName = resp.body.items[i].metadata.name;
            }
        }
    }

    return podName;
}
