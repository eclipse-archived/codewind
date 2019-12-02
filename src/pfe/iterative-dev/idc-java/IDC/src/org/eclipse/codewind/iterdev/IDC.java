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

package org.eclipse.codewind.iterdev;

import java.io.File;
import java.io.IOException;
import java.util.List;

import org.apache.commons.codec.digest.DigestUtils;
import org.eclipse.codewind.iterdev.Constants.ErrorCode;
import org.eclipse.codewind.iterdev.tasks.BuildApplicationTask;
import org.eclipse.codewind.iterdev.tasks.ContainerBuildTask;
import org.eclipse.codewind.iterdev.tasks.ContainerCleanTask;
import org.eclipse.codewind.iterdev.tasks.ContainerRefreshTask;
import org.eclipse.codewind.iterdev.tasks.ContainerRemoveTask;
import org.eclipse.codewind.iterdev.tasks.ContainerRunTask;
import org.eclipse.codewind.iterdev.tasks.SwitchModeTask;
import org.eclipse.codewind.iterdev.tasks.TaskUtils;

public class IDC {

	private static String HOST_OS = System.getProperty(Constants.HOST_OS, "");
	private static String LOCAL_IDC_OS = System.getProperty(Constants.LOCAL_IDC_OS, "");
	private static String WIN_IDC_PATH = System.getProperty(Constants.WIN_IDC_PATH, "");
	private static String CONTAINER_NAME = System.getProperty(Constants.CONTAINER_NAME, null);
	private static String LOG_NAME = System.getProperty(Constants.LOG_NAME, null);
	private static String PROJECT_ID = System.getProperty(Constants.PROJECT_ID, null);
	private static String LOCAL_WORKSPACE_ORIGIN = System.getProperty(Constants.LOCAL_WORKSPACE_ORIGIN, null);
	private static String IMAGE_PUSH_REGISTRY = System.getProperty(Constants.IMAGE_PUSH_REGISTRY, null);
	private static String START_MODE = System.getProperty(Constants.START_MODE, null);
	private static String DEBUG_PORT = System.getProperty(Constants.DEBUG_PORT, null);

	private static String rootPassword = null;

	public static void main(String[] args) throws IOException, InterruptedException {

		int returnCode = 0;

		try {

			if (args.length < 1 || args[0].equalsIgnoreCase(Constants.OPTION_HELP)) {
				Logger.printUsage();
				System.exit(ErrorCode.unexpectedError.ordinal());
			}

			// If the 'appid' param is used, print the sha1 sum of the current dir and exit.
			// This is a hidden command that is only used by 'docker shell' in idc.sh.
			if (args.length >= 1 && args[0].equalsIgnoreCase("appid")) {
				Logger.info(DigestUtils.sha1Hex(System.getProperty("user.dir").getBytes()));
				return;
			}

			String cmd = args[0];
			
			//Handle set option
			if (cmd.equalsIgnoreCase(Constants.OPTION_SET)) {
				if (args.length > 1) {
					for (int i = 1; i < args.length; i++) {
						//container and image names
						if (args[i].startsWith(Constants.CONTAINER_NAME_KEY)) {
							CONTAINER_NAME = args[i].replace(Constants.CONTAINER_NAME_KEY, "");
							Logger.info("The application container and image name is set to " + CONTAINER_NAME);
						}
						
						//app log name
						//Refer projectUtil.js getLogName() function for usage
						if (args[i].startsWith(Constants.LOG_NAME_KEY)) {
							LOG_NAME = args[i].replace(Constants.LOG_NAME_KEY, "");
							Logger.info("The application log name is set to " + LOG_NAME);
						}
						
						// Set the project id
						if (args[i].startsWith(Constants.PROJECT_ID_KEY)) {
							PROJECT_ID = args[i].replace(Constants.PROJECT_ID_KEY, "");
							Logger.info("The project id is set to " + PROJECT_ID);
						}
						
						// Set the local workspace origin if it was provided
						if (args[i].startsWith(Constants.LOCAL_WORKSPACE_ORIGIN_KEY)) {
							LOCAL_WORKSPACE_ORIGIN = args[i].replace(Constants.LOCAL_WORKSPACE_ORIGIN_KEY, "");
							Logger.info("Local workspace origin is set to " + LOCAL_WORKSPACE_ORIGIN);
						}

						if (args[i].startsWith(Constants.HOST_OS_KEY)) {
							HOST_OS = args[i].replace(Constants.HOST_OS_KEY, "export HOST_OS=");
							
							IDCUtils.updateEnvvarsScript(new File("/file-watcher/idc/artifacts/envvars.sh"), HOST_OS);
							Logger.info("Windows host detected, script file has been modified.");
						}

						if (args[i].startsWith(Constants.IMAGE_PUSH_REGISTRY_KEY)) {
							IMAGE_PUSH_REGISTRY = args[i].replace(Constants.IMAGE_PUSH_REGISTRY_KEY, "");
							Logger.info("The docker registry is set to " + IMAGE_PUSH_REGISTRY);
						}

						if (args[i].startsWith(Constants.START_MODE_KEY)) {
							START_MODE = args[i].replace(Constants.START_MODE_KEY, "");
							Logger.info("The start mode is set to " + START_MODE);
						}

						if (args[i].startsWith(Constants.DEBUG_PORT_KEY)) {
							DEBUG_PORT = args[i].replace(Constants.DEBUG_PORT_KEY, "");
							Logger.info("The debug port is set to " + DEBUG_PORT);
						}

					}
				}
			}

			// Handle command line options explicitly set in idc.bat
			if (args.length > 1) {
				for (int i = 1; i < args.length; i++) {
					
					//The following is for running idc locally on Windows
					if (args[i].startsWith(Constants.LOCAL_IDC_OS_KEY)) {
						LOCAL_IDC_OS = args[i].replace(Constants.LOCAL_IDC_OS_KEY, "export HOST_OS=");
					}
					
					if (args[i].startsWith(Constants.WIN_IDC_PATH_KEY)) {
						WIN_IDC_PATH = args[i].replace(Constants.WIN_IDC_PATH_KEY, "");
							
						IDCUtils.updateEnvvarsScript(new File(WIN_IDC_PATH + "\\artifacts\\envvars.sh"), LOCAL_IDC_OS);
					}

				}
			}
			
			// Check if the command passed in is valid
			if (!IDCUtils.isValidCommmand(cmd, Constants.VALID_COMMANDS)) {
				Logger.error("'idc " + cmd +"' is not a valid command.");
				Logger.printUsage();
				return;
			}

			// Initialize password if required
			// boolean rootPasswordRequired = false;
			// 
			// if(System.getProperty("os.name").toLowerCase().contains("linux")) {
			// 	rootPasswordRequired = true;
			// }
			//
			// if(rootPasswordRequired) {
			// 	rootPassword = System.getenv("IDC_ROOT_PWD"); 
			// 	if(rootPassword == null) {
			// 		println("Error: Root password environment variable is not set. ");
			// 		println();
			// 		println("Use export IDC_ROOT_PWD=(... your password..)");
			// 		return;
			// 	}
			// }

			// Create the application context object -- this object contains (mostly) immutable values which are commonly used to implement command functionality across IDC  
			IDCContext context = new IDCContext(rootPassword, LOCAL_WORKSPACE_ORIGIN, CONTAINER_NAME, PROJECT_ID, LOG_NAME, IMAGE_PUSH_REGISTRY, START_MODE, DEBUG_PORT);
			
			// Set up IDC options and exit. Should not attempt to build/run container.
			if (cmd.equalsIgnoreCase(Constants.OPTION_SET)) {
				if (HOST_OS.contains("windows")) {
					// Re-archive the artifacts dir, since envvars.sh has changed
					// Calling here as context is initialized right above

					// Remove any old artifacts.tar.gz first so it does not get
					// included in the new one
					File file = new File("/file-watcher/idc/artifacts/artifacts.tar.gz");
					if (file.exists() && !file.delete()) {
						Logger.error("Failed to remove the old artifacts.tar.gz from /file-watcher/idc/artifacts before re-archiving");
					}
					ProcessRunner pr = TaskUtils.runCmd("tar czf /file-watcher/idc/artifacts.tar.gz -C /file-watcher/idc/artifacts .", context, true);
					Logger.info("Archiving /file-watcher/idc/artifacts dir: " + pr.getReceived());
					pr = TaskUtils.runCmd("mv /file-watcher/idc/artifacts.tar.gz /file-watcher/idc/artifacts/artifacts.tar.gz", context, true);
					Logger.info("Moving artifacts.tar.gz to /file-watcher/idc/artifacts " + pr.getReceived());
					pr = TaskUtils.runCmd("chmod -R +rx /file-watcher/idc/artifacts/artifacts.tar.gz", context, true);
					Logger.info("Giving read and execute permissions to artifacts.tar.gz " + pr.getReceived());
					Logger.info("Re-archived /file-watcher/idc/artifacts dir");
				}
				Logger.info("IDC options set.");
				return;
			}
			
			// Switch to dev/prod and exit. Should not attempt to build/run container.
			if (Constants.MODE.dev.name().equals(cmd.toLowerCase())) {
				SwitchModeTask.execute(context, Constants.MODE.dev);
				return;
			}

			if (Constants.MODE.prod.name().equals(cmd.toLowerCase())) {
				SwitchModeTask.execute(context, Constants.MODE.prod);
				return;
			}
			
			// Handle idc commands
			if (cmd.equalsIgnoreCase(Constants.OPTION_SYSTEM_CLEANUP)) {
				boolean success = ContainerCleanTask.execute(context);
				if(!success)
					returnCode = ErrorCode.containerCleanupFailed.ordinal();
				System.exit(returnCode);
			}
			
			if (cmd.equalsIgnoreCase(Constants.OPTION_CONTAINER_REMOVE)) {
				boolean success = ContainerRemoveTask.execute(context);
				if(!success)
					returnCode = ErrorCode.containerRemoveFailed.ordinal();

				// Delete .idc db and docker dir contents for the project
				String appID = context.getAppId();
				if(appID != null) {
					ContainerRemoveTask.deleteCorrespondingIDCContents(context.getIDCBase(), appID);
				}

				System.exit(returnCode);
			}

			DBMap appDb = context.getAppDb();
			String lastContainerId = appDb.get(Constants.DB_LAST_CONTAINER_ID);
			String podId = appDb.get(Constants.DB_POD_ID);
			
			boolean isContainerBuilt = Boolean.parseBoolean(appDb.get(Constants.DB_CONTAINER_BUILT));
			
			// Construct a command string for either Kubernetes or Docker
			String curRunCmd = "";
			if (context.isK8s()) {
				curRunCmd = "kubectl exec " + context.getKubePodId() + " --";
			}
			else {
				curRunCmd = "docker exec " + context.getContainerName();
			}

			// Handle commands that should not start a build here
			if (cmd.equalsIgnoreCase(Constants.OPTION_STATUS_TRACKER)) {
				if (!isContainerBuilt) {
					Logger.error("Container " + context.getContainerName() + " is not running.");
					return;
				}

				Logger.info("Starting the status tracker");

				ProcessRunner runner = TaskUtils.createRunnerForCmd(curRunCmd + " /home/default/artifacts/status_tracker.sh",
						context, false);
				StatusTracker tracker = new StatusTracker(context, runner);
				tracker.start();
				
				return;
			}

			boolean containerBuildRequired = false;

			File appDir = context.getAppDirectory();
			if (!(new File(appDir, "pom.xml").exists())) {
				Logger.error("A pom.xml file is required in this directory, in order to start the container.");
				return;
			}

			if (appDb.get(Constants.DB_VERSION) == null) {
				appDb.put(Constants.DB_VERSION, "0.1");
			}
			
			// The SHA1 hash of the contents of the 'Dockerfile-build' and 'Dockerfile-lang' files, 
			// or null if one or both of these files don't exist 
			boolean isRequireImageRebuild = false;
			String hashOfAppMasterDockerFiles = null;
			{
				hashOfAppMasterDockerFiles = DockerUtils.calculateHashOfAppDirMasterDockerFiles(context);

				// Determine if the user has modified the app directory dockerfiles from since when the container was last built
				String expectedDockerFileHash = appDb.get(Constants.DB_MASTER_DOCKER_FILE_HASH);
				if (expectedDockerFileHash != null) {

					if (hashOfAppMasterDockerFiles != null && !hashOfAppMasterDockerFiles.equals(expectedDockerFileHash)
							&& !cmd.equalsIgnoreCase(Constants.OPTION_CONTAINER_REFRESH)) {
						
						isRequireImageRebuild = true;
						ContainerRefreshTask.execute(context);
					}
				} else {
					
					// Since there's no Dockerfile hash, we can expect this to
					// be the first idc run.
					// Delete any existing stale app container and image
					// since we're not sure of their state as .idc was deleted.
					
					if(!context.isK8s()) {
						if(DockerUtils.checkForContainerImage(context)) {
							Logger.info("Erasing any stale app container/image.");
							
							// Erase the container
							TaskUtils.runCmd("docker rm -f " + context.getContainerName(), context, true);
							
							// Erase the container image
							TaskUtils.runCmd("docker rmi -f " + context.getImageName(), context, true);
						}
					}
					
					// There is not a hash in the database yet, so add one
					if (hashOfAppMasterDockerFiles != null) {
						appDb.put(Constants.DB_MASTER_DOCKER_FILE_HASH, hashOfAppMasterDockerFiles);
					}
				}
			}
			
			// Determine if the user has modified any *.yaml files in the chart subdirectory 
			// and trigger container build as necessary for Kubernetes scenarios
			{
				if ( context.isK8s() && new File(appDir, "chart").exists() ) {
					String chartDir = appDir.getAbsolutePath() + "/chart";
					String calchHashCmd = "find " + chartDir + " -type f -name \"*.yaml\" -exec sha256sum {} + | awk '{print $1}' | sort | sha256sum";
					ProcessRunner pr = TaskUtils.runCmd(calchHashCmd, context, false);
					String hashOfChartDir = pr.getReceived().split("\\r?\\n")[0];
					String expectedHashofChartDir = appDb.get(Constants.DB_CHARTDIR_HASH);
				
					// Only flag image build required if previous hash exists (i.e. not first time idc being run), 
					// and if current hash is different, and if container not already refreshed above, etc
					if ( !isRequireImageRebuild &&
						 expectedHashofChartDir != null && 
						 hashOfChartDir != null && 
						 !hashOfChartDir.equals(expectedHashofChartDir) && 
						 !cmd.equalsIgnoreCase(Constants.OPTION_CONTAINER_REFRESH)) {
						isRequireImageRebuild = true;
						ContainerRefreshTask.execute(context);
					}
				
					// update chart dir hash
					if ( hashOfChartDir != null )
						appDb.put(Constants.DB_CHARTDIR_HASH, hashOfChartDir);
				}
			}
			

			if (!isContainerBuilt || isRequireImageRebuild || !DockerUtils.checkForContainerImage(context)) {
				if (cmd.equalsIgnoreCase(Constants.OPTION_BUILD)) {
					Logger.info("* Container build is required.");
					containerBuildRequired = true;
					// Update hash
					if (hashOfAppMasterDockerFiles != null) {
						appDb.put(Constants.DB_MASTER_DOCKER_FILE_HASH, hashOfAppMasterDockerFiles);
					}
					String curNewPomUpdateHash = FileMonitor.getNewPomUpdateHash(appDb, appDir.getAbsolutePath());
					if (curNewPomUpdateHash != null) {
						appDb.put(FileMonitor.POMCHANGE_HASH, curNewPomUpdateHash);
					}
					String curNewConfigUpdateHash = FileMonitor.getNewConfigUpdateHash(appDb, appDir.getAbsolutePath());
					if (curNewConfigUpdateHash != null) {
						appDb.put(FileMonitor.CONFIGUPDATE_HASH, curNewConfigUpdateHash);
					}
				}
			}

			if (containerBuildRequired) {
				// The application docker base file has the full path to the .idc/docker/docker-<appid> folder
				File appDockerBase = context.getAppDockerBase();

				if (!appDockerBase.exists() && !appDockerBase.mkdirs()) {
					Logger.error("Error creating docker database dir: " + appDockerBase.getPath());
					return;
				}

				boolean result = ContainerBuildTask.execute(context);

				if (!result) {
					Logger.error(ErrorCode.containerBuildFailed.message());
					System.exit(ErrorCode.containerBuildFailed.ordinal());
				}

				isContainerBuilt = true;

				// There is not a hash in the database yet, add one
				if (hashOfAppMasterDockerFiles == null) {
					hashOfAppMasterDockerFiles = DockerUtils.calculateHashOfAppDirMasterDockerFiles(context);
					appDb.put(Constants.DB_MASTER_DOCKER_FILE_HASH, hashOfAppMasterDockerFiles);
				}
				
				Logger.info("Container built");
			}

			boolean containerStartRequired = false;
			boolean isPodRunning = false;

			if (isContainerBuilt) {
				if (context.isK8s()) {
					if (podId != null) {
						// This checks for if a pod with the PodId exist
						// On a dockerfile edit - a container refresh will
						// take down the pod. So the pod may be deleted or 
						// in a terminating state over here.
						// If for some reason, a pod is in a terminating 
						// state, isPodRunning will be false and the code
						// will proceed to run a new one.
						for (String line : KubeUtils.kubectlPs(context)) {
							if (line.contains(context.getKubePodId()) && line.contains("Running")) {
								isPodRunning = true;
							}
						}
						if(!isPodRunning) {
							containerStartRequired = true;
						}
					}
					else {
						containerStartRequired = true;
					}
				}
				else {
					// The container needs to be started if we can't find its ID in the list of started containers 
					if (lastContainerId != null) {

						boolean matched = false;
						for (List<String> line : DockerUtils.dockerPs(context)) {
							if (line.contains(lastContainerId)) {
								matched = true;
								break;
							}
						}

						if (!matched) {
							Logger.info(
									"The database indicates a container exists but it was not found. Proceeding to run a new container.");
							containerStartRequired = true;
						}

					} else {
						containerStartRequired = true;
					}
				}
				
			}
			
			if (containerStartRequired) {
				Logger.info("* Starting container. ");
				String id = ContainerRunTask.execute(context);
				if (id == null) {
					Logger.error(ErrorCode.containerStartFailed.message());
					System.exit(ErrorCode.containerStartFailed.ordinal());
				} else if(id == "registryError") {
					Logger.error(ErrorCode.invalidImagePushRegistry.message());
					System.exit(ErrorCode.invalidImagePushRegistry.ordinal());
				}
			}
			
			// Recalculate the run command since ContainerRunTask may
			// have been called which could have created a new Kube Pod Id
			if (context.isK8s()) {
				curRunCmd = "kubectl exec " + context.getKubePodId() + " --";
			}
			else {
				curRunCmd = "docker exec " + context.getContainerName();
			}
			
			if (cmd.equalsIgnoreCase(Constants.OPTION_CONTAINER_REFRESH)) {
				ContainerRefreshTask.execute(context);
				return;
			}

			else if (cmd.equalsIgnoreCase(Constants.OPTION_BUILD)) {
				boolean result = BuildApplicationTask.execute(context, args);
				
				if (!result) {
					Logger.error(ErrorCode.applicationBuildFailed.message());
					System.exit(ErrorCode.applicationBuildFailed.ordinal());
				}

				// Container and application builds are complete now
				StatusTracker.updateProjectState(context, "build", "success", " ", null);

				/* 
				 * Always call the start server script, it will check if the server is running and start if not.
				 * Especially important in K8 when pods are auto restarted when the cluster is restarted, the server within the container is not started.
				 */
				startServer(context, curRunCmd, appDb);
				
				return;
			}

			else if (cmd.equalsIgnoreCase(Constants.OPTION_SHELL)) {
				Logger.error("Not currently supported.");
				return;
			}
			
			else if (cmd.equalsIgnoreCase(Constants.OPTION_START)) {
				startServer(context, curRunCmd, appDb);
				return;
			}

			else if (cmd.equalsIgnoreCase(Constants.OPTION_STOP)) {

				if (!isContainerBuilt) {
					Logger.info("Container " + context.getContainerName() + " is not running.");
					return;
				}

				StatusTracker.updateProjectState(context, "app", "stopping", null, null);

				TaskUtils.runCmd(curRunCmd + " /home/default/artifacts/stop_server.sh",
						context, true);

				return;
			}

			else if (cmd.equalsIgnoreCase(Constants.OPTION_TAIL)) {
				if (!isContainerBuilt) {
					Logger.error("Container " + context.getContainerName() + " is not running.");
					return;
				}

				TaskUtils.runCmd(curRunCmd + " /home/default/artifacts/tail_server.sh",
						context, true);

				return;

			}

			else if (cmd.equalsIgnoreCase(Constants.OPTION_CLEAN)) {
				if (!isContainerBuilt) {
					Logger.error("Container " + context.getContainerName() + " is not running.");
					return;
				}
				
				String logFileName = context.getLogFileName();
				
				String libertyEnv = context.getIDCConfiguration().getProperty("libertyEnv");
				String libertyEnvValue = libertyEnv == null ? "default" : libertyEnv;
				
				TaskUtils.runCmd(curRunCmd + " /home/default/artifacts/clean_server.sh" + " "
						+ logFileName + " " + libertyEnvValue, context, true);

				return;
			}

		} catch (Exception e) {
			Logger.error(ErrorCode.unexpectedError.message(), e);
			System.exit(ErrorCode.unexpectedError.ordinal());
		}
	}

	private static void startServer(IDCContext context, String curRunCmd, DBMap appDb) throws Exception {
		Logger.info("Starting server in start mode: " + context.getStartMode());
		StatusTracker.updateProjectState(context, "app", "starting", null, null);
		

		String logPathPrefix = context.isWin() ? "/tmp/liberty/" : "/home/default/app/mc-target/";
		String messagesLog = logPathPrefix + "liberty/wlp/usr/servers/defaultServer/logs/messages.log";
		Logger.info("Touching application messages log: " + messagesLog);
		boolean logFileTouched = BuildApplicationTask.touchLogFile(curRunCmd, messagesLog, context);
		if (!logFileTouched) {
			appDb.put(Constants.DB_SERVER_START, "false");
			StatusTracker.updateProjectState(context, "app", "stopped", "projectStatusController.serverNotStarted",  null);
		}

		// only messages.log is available till now so we emit that
		Logger.info("Triggering log file event for: application messages log");
		StatusTracker.newLogFileAvailable(context, "app");
			 
		ProcessRunner pr;
		if (Constants.START_MODE_DEBUG.equals(context.getStartMode())) {
			pr = TaskUtils.runCmd(curRunCmd + " /home/default/artifacts/debug_server.sh",
							context, true);
		} else {
			pr = TaskUtils.runCmd(curRunCmd + " /home/default/artifacts/start_server.sh",
							context, true);
		}

		if (pr.getErrorCode().orElse(0) != 0){
			appDb.put(Constants.DB_SERVER_START, "false");
			StatusTracker.updateProjectState(context, "app", "stopped", "projectStatusController.serverNotStarted",  null);
		} else {
			appDb.put(Constants.DB_SERVER_START, "true");
		}

		String consoleLog = logPathPrefix + "liberty/wlp/usr/servers/defaultServer/logs/console.log";
		Logger.info("Touching application console log: " + consoleLog);
		logFileTouched = BuildApplicationTask.touchLogFile(curRunCmd, consoleLog, context);
		if (!logFileTouched) {
			appDb.put(Constants.DB_SERVER_START, "false");
			StatusTracker.updateProjectState(context, "app", "stopped", "projectStatusController.serverNotStarted",  null);
		}

		// console.log is available till now so we emit that
		Logger.info("Triggering log file event for: application console log");
		StatusTracker.newLogFileAvailable(context, "app");
	}
}
