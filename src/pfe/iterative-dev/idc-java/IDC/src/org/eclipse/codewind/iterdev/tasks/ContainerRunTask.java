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

package org.eclipse.codewind.iterdev.tasks;

import org.eclipse.codewind.iterdev.Constants;
import org.eclipse.codewind.iterdev.IConsoleFilter;
import org.eclipse.codewind.iterdev.IDCContext;
import org.eclipse.codewind.iterdev.Logger;
import org.eclipse.codewind.iterdev.ProcessRunner;
import org.eclipse.codewind.iterdev.ProcessRunner.ConsoleStream;
import org.eclipse.codewind.iterdev.StatusTracker;

public class ContainerRunTask {

    public static String execute(IDCContext context) throws Exception {
        Logger.info("Start the container");

        boolean isWindows = System.getProperty("os.name").toLowerCase().contains("windows");

        // https://docs.docker.com/engine/reference/run/#expose-incoming-ports
        // arg to be passed after -p to expose debug port to localhost only
        final String debugPortPublishArg = "127.0.0.1::" + context.getDebugPort();

        String cmd = null;
        if (isWindows) {
            cmd = context.getArtifactsDirectory().getPath() + Constants.SLASH + "run_docker.bat "
                    + context.getContainerName() + " " + context.getImageName() + " \"-p "
                    + debugPortPublishArg + " -P\"" + " "
                    + context.getAppDockerBase() + " " + context.getLocalWorkspaceOrigin() + " "
                    + context.getLogDir();
        } else if (context.isK8s()) {
            cmd = context.getArtifactsDirectory().getPath() + Constants.SLASH + "run_kubernetes.sh "
                    + context.getContainerName() + " " + context.getImageName() + " "
                    + context.getAppDockerBase() + " " + context.getLocalWorkspaceOrigin() + " "
                    + context.getprojectID() + " "
                    + context.getLogDir() + " "
                    + context.getImagePushRegistry();
        }  else {
            cmd = context.getArtifactsDirectory().getPath() + Constants.SLASH + "run_docker.sh "
                    + context.getContainerName() + " " + context.getImageName() + " \"-p "
                    + debugPortPublishArg + " -P\"" + " "
                    + context.getAppDockerBase() + " " + context.getLocalWorkspaceOrigin() + " "
                    + context.getLogDir();
        }

        ProcessRunner pr = runContainer(cmd, context);
        int exitCode = 0;
        try {
            exitCode = pr.getErrorCode().orElseThrow(() -> new IllegalStateException("Process did not terminate."));
        } catch (Exception e) {
            Logger.error("The process did not terminate on the first try");
        }

        if(exitCode != 0 && !context.isK8s()) {
            /* Docker run can sometimes inexplicably fail with the following error:
             *   docker: Error response from daemon: driver failed programming external connectivity
             *   on endpoint <project>: Error starting userland proxy: listen tcp 0.0.0.0:43273: bind: address already in use.
             *
             * Workaround: Retry once if we hit this error.
             */
            Logger.info("The first attempt to run the container was unsuccessful. Exit code: " + exitCode);
            Logger.info("Retrying start container stage");
            pr = runContainer(cmd, context);
            exitCode = pr.getErrorCode().orElseThrow(() -> new IllegalStateException("Process did not terminate."));
        }

        // Container ID is the last line of the output
        String[] lines = pr.getReceived().split("\\r?\\n");
        if (context.isK8s()) {
            if (exitCode == 7) {
                Logger.info("ContainerRunTask: run_kubernetes.sh has failed with exit code " + exitCode);
                return "registryError";
            }

        	// Get the release name, deployment, and pod IDs (last three lines of output)
            if (lines.length < 3) {
                String statusMsg = "containerRunTask.containerRunTaskFailed";	
                Logger.error("Start container stage failed: failed to get deploymentID/podID/releaseID");
                StatusTracker.updateProjectState(context, "build", "failed", statusMsg, null);	
                return null;
            }

            // The release name, pod id and deployment id are the last three lines of output from run_kubernetes.sh
            String deploymentID = lines[lines.length-3];
            String podID = lines[lines.length-2];
            String releaseID = lines[lines.length-1];

            // Get the port the deployment is running on
            for (String line : lines) {
                if (line.contains("9080:")) {
                   context.getAppDb().put(Constants.DB_KUBE_PORT, line.split(":")[1].split("/TCP")[0]);
                   break;
                }
            }

            // Add the app db. (Store the deployment id in DB_LAST_CONTAINER_ID)
            context.getAppDb().put(Constants.DB_LAST_CONTAINER_ID, deploymentID);
            context.getAppDb().put(Constants.DB_HELM_RELEASE, releaseID);
            context.getAppDb().put(Constants.DB_DEPLOYMENT_ID, deploymentID);
            context.getAppDb().put(Constants.DB_POD_ID, podID);
            context.getAppDb().put(Constants.DB_APP_ID, context.getAppId());
            context.getAppDb().put(Constants.DB_APP_DIR, context.getAppDirectory().toString());
            context.getAppDb().put(Constants.DB_CONTAINER_NAME, context.getContainerName());
            return releaseID;
        }
        else {
            String containerId = lines[lines.length - 1];

            boolean result = (exitCode == 0 && containerId.length() == 64);

            if (result) {
                Logger.info("Stored application container for " + context.getAppName() + ": " + containerId);
                context.getAppDb().put(Constants.DB_LAST_CONTAINER_ID, containerId);
                context.getAppDb().put(Constants.DB_APP_ID, context.getAppId());
                context.getAppDb().put(Constants.DB_APP_DIR, context.getAppDirectory().toString());
                context.getAppDb().put(Constants.DB_CONTAINER_NAME, context.getContainerName());
            } else {
                Logger.error("Start container stage failed: failed to get containerID");
                containerId = null;
            }

            return containerId;
        }

    }

    private static ProcessRunner runContainer(String cmd, IDCContext context) throws Exception {
        Logger.info("Run command to start the container: " + cmd);

        ProcessRunner pr = TaskUtils.runCmd(cmd, context, new IConsoleFilter() {
            // The start container stage may print "Error response from daemon: No such container"
            // or "Error: No such container" to the console even when the start container stage
            // succeeds. Filter these messages from the console to prevent confusion.
            @Override
            public boolean excludeConsoleText(ConsoleStream s, String text) {
                if (text.contains("Error response from daemon: No such container")
                        || text.contains("Error: No such container:")) {
                    return true;
                }
                return false;
            }
        }, true);

        return pr;

    }
}