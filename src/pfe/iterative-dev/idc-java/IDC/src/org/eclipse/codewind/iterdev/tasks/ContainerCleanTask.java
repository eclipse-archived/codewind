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
import java.util.ArrayList;

import org.eclipse.codewind.iterdev.Constants;
import org.eclipse.codewind.iterdev.DBMap;
import org.eclipse.codewind.iterdev.IDCContext;
import org.eclipse.codewind.iterdev.IDCUtils;
import org.eclipse.codewind.iterdev.Logger;
import org.eclipse.codewind.iterdev.ProcessRunner;

public class ContainerCleanTask {

	public static boolean execute(IDCContext context) throws Exception {
		//boolean isK8s = System.getenv(Constants.IN_K8).equals("true");
		String imageCommand = context.getImageCommand();

		Logger.info("* Cleaning up containers... ");
		
		if (context.isK8s()) {
			if (!context.getIDCBase().exists()) {
				ProcessRunner pr = TaskUtils.runCmd("helm list -q", context, false);
				for (String str : pr.getReceived().split("\\r?\\n")) {
					Logger.info("----");
					Logger.info("Helm Release Name: " + str);
					Logger.info("----");
					if (str != null) {
						if (str.contains("idc") && IDCUtils.getUserResponse(Constants.missingIDCDirPromptQues).equalsIgnoreCase("yes")) {
							Logger.info("* Deleting the helm release");
							TaskUtils.runCmd("helm delete " + str, context, false);
						}
					}
				}
				Thread.sleep(1000);
			}
			else {
				/*
				 * If the user modifies/deletes the app dir then we need to handle the associated idc 
				 * container. Print the modified/deleted dir container id and prompt the user before 
				 * removing the container.
				 */
				String dbDirPath = context.getIDCBase().toString() + Constants.SLASH + "db";
				File dbDir = new File(dbDirPath);
				File dbFiles[] = dbDir.listFiles();

				for (int i = 0; i < dbFiles.length; i++) {
					DBMap appDB = new DBMap(dbFiles[i].getName().substring(DBMap.DBPREFIX.length()), context.getIDCBase());

					String fileName = appDB.get(Constants.DB_APP_DIR);
					if(fileName == null)
						continue;
					Logger.info("checking if filename is present: " + fileName);
					File appDir = new File(fileName);
					if (!appDir.exists()) {
						String releaseID = appDB.get(Constants.DB_HELM_RELEASE);
						Logger.info("----");
						Logger.info("Missing Application Directory: " + fileName);
						Logger.info("Helm Release: " + releaseID);
						Logger.info("----");
						if (IDCUtils.getUserResponse(Constants.modifiedAppDirPromptQues).equalsIgnoreCase("yes")) {
							Logger.info("* Deleting the Helm release. ");

							TaskUtils.runCmd("helm delete " + releaseID, context, false);
							TaskUtils.runCmd(imageCommand + " image rm " + appDB.get(Constants.DB_CONTAINER_NAME) + " -f", context, false);

							// Delete .idc db and docker dir contents
							deleteCorrespondingIDCContents(context.getIDCBase(), appDB.get(Constants.DB_APP_ID));
						}
					}
				}
				
				/*
				 * If the user explicitly deletes a container using the docker command, we 
				 * need to clean up the corresponding .idc db and docker dir contents
				 */

				ArrayList<String> runningDeployments = new ArrayList<String>();
				Logger.info("Checking if any deployments have been explicitly removed without IDC.");
				Logger.info("If yes, the corresponding .idc db and docker contents will be deleted.");
				ProcessRunner pr = TaskUtils.runCmd("kubectl get deployments --no-headers=true -o=custom-columns=NAME:.metadata.name", context, false);

				Thread.sleep(1000);
				for (String str : pr.getReceived().split("\\r?\\n")) {
					if (str != null) {
						runningDeployments.add(str);
					}
				}

				nextdbfile : for (int i = 0; i < dbFiles.length; i++) {
					DBMap appDB = new DBMap(dbFiles[i].getName().substring(DBMap.DBPREFIX.length()), context.getIDCBase());
					String deploymentID = appDB.get(Constants.DB_LAST_CONTAINER_ID);
					if(deploymentID == null)
						continue nextdbfile;
					Logger.info("Checking for deployment " + deploymentID);
					for (int j = 0; j < runningDeployments.size(); j++) {
						if (deploymentID.equals(runningDeployments.get(j))) {
							// Found a running container for this db file so no need to clean up
							continue nextdbfile;
						}
					}

					// Delete .idc db and docker dir contents
					Logger.info("Deleting db contents with app id: " + appDB.get(Constants.DB_APP_ID));
					deleteCorrespondingIDCContents(context.getIDCBase(), appDB.get(Constants.DB_APP_ID));
				}
				
				
			}
			Logger.info("Finished cleaning up helm releases");
			return true;
		}
		else {
			if (!context.getIDCBase().exists()) {
				/*If the user deletes the .idc dir,
				then we need to handle the associated idc 
				containers. Print the container image name 
				and prompt the user before removing the 
				container.*/
				ProcessRunner pr = TaskUtils.runCmd(imageCommand + " ps --format \"{{.Image}}\"", context, false);

				Thread.sleep(1000);
				for (String str : pr.getReceived().split("\\r?\\n")) {
					Logger.info("----");
					Logger.info("Container Image Name: " + str);
					Logger.info("----");
					if (str != null) {

						if (str.contains("-idc-")
								&& IDCUtils.getUserResponse(Constants.missingIDCDirPromptQues).equalsIgnoreCase("yes")) {
							Logger.info("* Stopping and Removing the Container. ");

							TaskUtils.runCmd(imageCommand + " stop " + str, context, false);
							TaskUtils.runCmd(imageCommand + " rm " + str, context, false);
							TaskUtils.runCmd(imageCommand + " image rm " + str, context, false);
						}
					}
				}
			} else {
				/*
				 * If the user modifies/deletes the app dir then we need to handle the associated idc 
				 * container. Print the modified/deleted dir container id and prompt the user before 
				 * removing the container.
				 */
				String dbDirPath = context.getIDCBase().toString() + Constants.SLASH + "db";
				File dbDir = new File(dbDirPath);
				File dbFiles[] = dbDir.listFiles();

				for (int i = 0; i < dbFiles.length; i++) {
					DBMap appDB = new DBMap(dbFiles[i].getName().substring(DBMap.DBPREFIX.length()), context.getIDCBase());

					String fileName = appDB.get(Constants.DB_APP_DIR);
					if(fileName == null)
						continue;
					Logger.info("checking if filename is present: " + fileName);
					File appDir = new File(fileName);
					if (!appDir.exists()) {
						String containerID = appDB.get(Constants.DB_LAST_CONTAINER_ID);
						Logger.info("----");
						Logger.info("Missing Application Directory: " + fileName);
						Logger.info("Container ID: " + containerID);
						Logger.info("----");
						if (IDCUtils.getUserResponse(Constants.modifiedAppDirPromptQues).equalsIgnoreCase("yes")) {
							Logger.info("* Stopping and Removing the Container. ");

							TaskUtils.runCmd(imageCommand + " rm -f " + containerID, context, false);
							TaskUtils.runCmd(imageCommand + " image rm " + appDB.get(Constants.DB_CONTAINER_NAME), context,
									false);

							// Delete .idc db and docker dir contents
							deleteCorrespondingIDCContents(context.getIDCBase(), appDB.get(Constants.DB_APP_ID));
						}
					}
				}

				/*
				 * If the user explicitly deletes a container using the docker command, we 
				 * need to clean up the corresponding .idc db and docker dir contents
				 */

				ArrayList<String> runningContainers = new ArrayList<String>();
				Logger.info("Checking if any containers have been explicitly removed without IDC.");
				Logger.info("If yes, the corresponding .idc db and docker contents will be deleted.");
				ProcessRunner pr = TaskUtils.runCmd(imageCommand + " ps --no-trunc -q", context, false);

				Thread.sleep(1000);
				for (String str : pr.getReceived().split("\\r?\\n")) {
					if (str != null) {
						runningContainers.add(str);
					}
				}

				nextdbfile : for (int i = 0; i < dbFiles.length; i++) {
					DBMap appDB = new DBMap(dbFiles[i].getName().substring(DBMap.DBPREFIX.length()), context.getIDCBase());
					String containerID = appDB.get(Constants.DB_LAST_CONTAINER_ID);
					if(containerID == null)
						continue nextdbfile;
					Logger.info("Checking for container " + containerID);
					for (int j = 0; j < runningContainers.size(); j++) {
						if (containerID.equals(runningContainers.get(j))) {
							// Found a running container for this db file so no need to clean up
							continue nextdbfile;
						}
					}

					// Delete .idc db and docker dir contents
					Logger.info("Deleting db contents with app id: " + appDB.get(Constants.DB_APP_ID));
					deleteCorrespondingIDCContents(context.getIDCBase(), appDB.get(Constants.DB_APP_ID));
				}

			}
			Logger.info("* Finished cleaning up containers.");
			return true;
		}
		
	}

	private static void deleteCorrespondingIDCContents(File IDC_BASE, String appid) throws IOException {

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
