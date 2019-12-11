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
import org.eclipse.codewind.iterdev.DBMap;
import org.eclipse.codewind.iterdev.IDCContext;
import org.eclipse.codewind.iterdev.IDCUtils;
import org.eclipse.codewind.iterdev.Logger;
import org.eclipse.codewind.iterdev.ProcessRunner;

public class ContainerRemoveTask {

	public static boolean execute(IDCContext context) throws Exception {
		String imageCommand = context.getImageCommand();
		File idcBase = context.getIDCBase();
		if (!idcBase.exists()) {
			/* If the .idc directory doesn't exist then we cannot validate the container that needs to be removed.
			 * The user needs to manually remove the container since they have deleted the .idc directory or they
			 * can use the idc system cleanup command to handle it automatically.  
			 */
			Logger.error("Could not find the metadata directory: " + context.getIDCBase().getAbsolutePath() + " use the command " + Constants.OPTION_SYSTEM_CLEANUP + " to clean up any remaining containers.");
			return false;
		}

		DBMap appDB = context.getAppDb();

		/*
		Use the container name to remove the container instead of relying on the id because if there was a problem with running the container then
		IDC may not have the id but the container still exists.
		*/
		if (context.isK8s()) {
			String releaseName = context.getAppDb().get(Constants.DB_HELM_RELEASE);
			if (releaseName != null) {
				Logger.info("* Stopping and removing application: " + releaseName);
				
				if(releaseName != null && !releaseName.isEmpty()) {
					// Delete the helm release, then the docker image
					ProcessRunner pr = TaskUtils.runCmd("helm delete " + releaseName, context, false);
					if(pr.getErrorCode().orElse(0) != 0) {
						Logger.error("Error code: " + pr.getErrorCode() + ", Failed to remove the the Helm release " + releaseName);
						return false;
					} else {
						Logger.info("Successfully removed the Helm release " + releaseName);
					}
				}

				Logger.info("Awaiting resource deleting confirmation for release " + releaseName);
				int MAX_ATTEMPT = 36; //Set timeout: 36*5 = 3mins
				int numTries = 0;
				boolean terminated = false;
				while (numTries < MAX_ATTEMPT) {
					ProcessRunner pr = TaskUtils.runCmd("kubectl get pods  -l  \"release=" + releaseName + "\"", context, false);
					if(pr.getErrorCode().orElse(0) != 0) {
						Logger.error("Error getting K8 pod with release name " + releaseName + ". Error code: " + pr.getErrorCode());
						return false;
					}
					if (pr.getReceived().contains(releaseName)){
						//K8 pod for this release is still running.
						Thread.sleep(5000);
						numTries++;
					} else {
						Logger.info("K8 pod for release " + releaseName + "has been terminated");
						terminated = true;
						break;
					}

				}
				if (!terminated) {
					Logger.error("Timeout: K8 pod for release " + releaseName + "cannot be terminated within 3 minutes.");
					return false;
				}
				
				String imageName = appDB.get(Constants.DB_CONTAINER_NAME);
				if (imageName != null) {
					ProcessRunner pr = TaskUtils.runCmd(imageCommand + " rmi -f " + imageName, context,
							false);
					if(pr.getErrorCode().orElse(0) != 0) {
						Logger.error("Error code: " + pr.getErrorCode() + ", Failed to remove the image " + imageName);
						return false;
					} else {
						Logger.info("Successfully removed the application image " + imageName);
					}
				}
			}
		}
		else {
			String containerName = context.getContainerName();
			if (containerName != null) {
				Logger.info("* Stopping and removing application: " + containerName);
				
				// Get the container id using the container name
				ProcessRunner pr = TaskUtils.runCmd(imageCommand + " ps -aq -f name=" + containerName, context, false);
				if(pr.getErrorCode().orElse(0) != 0) {
					Logger.error("Error code: " + pr.getErrorCode() + ", No container with the name " + containerName + " was found.");
				}
				String[] lines = pr.getReceived().split("\\r?\\n");
				String containerID = lines[lines.length - 1].trim();
			
				if(containerID != null && !containerID.isEmpty()) {
					pr = TaskUtils.runCmd(imageCommand + " rm -f " + containerID, context, false);
					if(pr.getErrorCode().orElse(0) != 0) {
						Logger.error("Error code: " + pr.getErrorCode() + ", Failed to remove the container " + containerID);
						return false;
					} else {
						Logger.info("Successfully removed the application container " + containerID);
					}
				}
				
				String imageName = appDB.get(Constants.DB_CONTAINER_NAME);
				if(imageName != null){
					pr = TaskUtils.runCmd(imageCommand + " image rm " + imageName, context,
							false);
					if(pr.getErrorCode().orElse(0) != 0) {
						Logger.error("Error Code: " + pr.getErrorCode() + ", Failed to remove the image " + imageName);
						return false;
					} else {
						Logger.info("Successfully removed the application image " + imageName);
					}
				}
			}
		}
		

		Logger.info("* Successfully removed the application");
		return true;
	}

	public static void deleteCorrespondingIDCContents(File IDC_BASE, String appid) throws IOException {
		File IDC_DB_DIR = new File(IDC_BASE.toString() + Constants.SLASH + "db");
		File IDC_DOCKER_DIR = new File(IDC_BASE.toString() + Constants.SLASH + "docker");
		File delFile = null;

		String dBContents[] = IDC_DB_DIR.list();
		String dockerContents[] = IDC_DOCKER_DIR.list();

		//Delete IDC DIR DB CONTENTS
		for (int i = 0; i < dBContents.length; i++) {

			if (dBContents[i].contains(appid)) {
				delFile = new File(IDC_DB_DIR.toString() + Constants.SLASH + dBContents[i]);
				if (IDCUtils.deleteFile(delFile)) {
					Logger.info("The corresponding IDC container metadata content was deleted.");
				}
			}
		}

		//Delete IDC DIR DOCKER CONTENTS
		for (int i = 0; i < dockerContents.length; i++) {

			if (dockerContents[i].contains(appid)) {
				delFile = new File(IDC_DOCKER_DIR.toString() + Constants.SLASH + dockerContents[i]);
				if (IDCUtils.deleteFile(delFile)) {
					Logger.info("The corresponding IDC image metadata content was deleted.");
				}
			}
		}
	}

}
