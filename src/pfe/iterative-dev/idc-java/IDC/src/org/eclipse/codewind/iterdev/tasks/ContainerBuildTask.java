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

import java.io.File;
import java.io.IOException;

import org.eclipse.codewind.iterdev.Constants;
import org.eclipse.codewind.iterdev.DockerUtils;
import org.eclipse.codewind.iterdev.IDCContext;
import org.eclipse.codewind.iterdev.IDCUtils;
import org.eclipse.codewind.iterdev.Logger;
import org.eclipse.codewind.iterdev.ProcessRunner;
import org.eclipse.codewind.iterdev.StatusTracker;

public class ContainerBuildTask {

    public static boolean execute(IDCContext context) throws IOException, InterruptedException {
        String statusMsg = "containerBuildTask.containerBuild";
        Logger.info("Building container image");
        StatusTracker.updateProjectState(context, "build", "inProgress", statusMsg, null);
        boolean result = DockerUtils.generateDockerfile(context.getAppDockerBase(), context);
        if(!result) {
            statusMsg = "containerBuildTask.containerBuildFailDockerfileGenerate";
            Logger.error("Container image failed to build: failed on generating Dockerfile");
            StatusTracker.updateProjectState(context, "build", "failed", statusMsg, null);
            return false;
        }

       result = DockerUtils.handleDockerImageBuildSetup(context.getAppDirectory(), context.getAppDockerBase());	
        	
        if (!result) {	
            statusMsg = "containerBuildTask.containerBuildFailDockerfileSetup";	
            Logger.error("Container image failed to build: failed on Dockerfile setup");	
            StatusTracker.updateProjectState(context, "build", "failed", statusMsg, null);	
            return false;	
        }

		boolean isContainerImagePresent = DockerUtils.checkForContainerImage(context);

        if (isContainerImagePresent) {
            statusMsg = "containerBuildTask.containerBuildFailImageExist";
            Logger.error("Container image failed to build: container image already exists");
            StatusTracker.updateProjectState(context, "build", "failed", statusMsg, null);
            return false;
        }

        String logFileName = context.getLogFileName();
        
        String buildCmd = "/file-watcher/idc/artifacts/build_docker_image.sh " + 
            "\"" + context.getAppDirectory().getAbsolutePath() + "\" " +
            context.getImageName() + " " +
            context.getAppDockerBase().getAbsolutePath() + " " + 
            logFileName + " " +
            "\"" + context.getAppName() + "-" + context.getprojectID() + "\" " +
            context.getprojectID();
        Logger.info("*** Build Command " + buildCmd);
        
        // Copy artifacts that are needed by the application image into the same location as the Dockerfile
        File artifactsDir = context.getArtifactsDirectory();
        if (!artifactsDir.exists()) {
            statusMsg = "containerBuildTask.containerBuildFailArtifactsMissing";
            Logger.error("Container image failed to build: the image could not be built because the artifacts directory was not found: "  
            + artifactsDir.getAbsolutePath());
            StatusTracker.updateProjectState(context, "build", "failed", statusMsg, null);
            return false;
        }
        IDCUtils.copyDir(artifactsDir.getAbsolutePath(),
                context.getAppDockerBase().getPath() + Constants.SLASH + artifactsDir.getName());

        Logger.info("Build app image using cmd: " + buildCmd);

        // "iterative-dev" here is the container image name, not the container name
        ProcessRunner pr = TaskUtils.runCmd(buildCmd, context, true);

        int errorCode = pr.getErrorCode()
                .orElseThrow(() -> new IllegalStateException("Build process did not complete."));
        
        // ignore the failure case if any file under .idc folder is failed to be deleted
        result = ((errorCode == 0 || pr.getReceived().contains("Directory not empty")) && pr.getReceived().contains("Successfully built"));

        if (result) {
            context.getAppDb().put(Constants.DB_CONTAINER_BUILT, Boolean.TRUE.toString());
            Logger.info("Container image has been built successfully");
            statusMsg = "containerBuildTask.containerBuildSuccess";
            String imageLastBuild= Long.toString(System.currentTimeMillis()); 
            StatusTracker.updateProjectState(context, "build", "inProgress", statusMsg, imageLastBuild);
        } else {
            statusMsg = "containerBuildTask.containerBuildFail";
            Logger.error("Container image failed to build: failed on running build command - " + buildCmd);
            StatusTracker.updateProjectState(context, "build", "failed", statusMsg, null);
        }

        return result;
    }

}
