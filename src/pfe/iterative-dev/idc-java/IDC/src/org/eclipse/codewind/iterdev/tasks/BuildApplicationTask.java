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
import org.eclipse.codewind.iterdev.DBMap;
import org.eclipse.codewind.iterdev.FileMonitor;
import org.eclipse.codewind.iterdev.IDCContext;
import org.eclipse.codewind.iterdev.Logger;
import org.eclipse.codewind.iterdev.ProcessRunner;
import org.eclipse.codewind.iterdev.StatusTracker;

public class BuildApplicationTask {

	public static boolean execute(IDCContext context, String[] args) throws Exception {
		String logFileName = context.getLogFileName();
		String MAVEN_SETTINGS = System.getProperty(Constants.MAVEN_SETTINGS, "");
		String libertyEnv = context.getIDCConfiguration().getProperty("libertyEnv");
		String libertyEnvValue = libertyEnv == null ? "default" : libertyEnv;
		String statusMsg;
		boolean result;
		int errorCode;
		Logger.info("Log file name for build: " + logFileName);

		String cmdTemplate = "";
		if (context.isK8s()) {
			cmdTemplate = "kubectl exec " + context.getKubePodId() + " --";
		}
		else {
			cmdTemplate = "docker exec " + context.getContainerName();
			
		}

		if (args.length > 1) {
			for (int i = 1; i < args.length; i++) {
				if (args[i].startsWith(Constants.MAVEN_SETTINGS_KEY)) {
					MAVEN_SETTINGS = args[i].replace(Constants.MAVEN_SETTINGS_KEY, "");
				} else {
					MAVEN_SETTINGS = MAVEN_SETTINGS + " " + args[i];
				}
			}
		}
		if(MAVEN_SETTINGS.length() > 0) {
			Logger.info("The application will run with the following custom Maven profiles: " + MAVEN_SETTINGS);
		}

		String curRunCmd = cmdTemplate + " /home/default/artifacts/build_server.sh" + " "
		+ logFileName + " " + libertyEnvValue + " " + null + " \"" + MAVEN_SETTINGS + "\"";

		DBMap appDb = context.getAppDb();

		if(appDb.get(Constants.DB_SERVER_START)!= null && !Boolean.parseBoolean(appDb.get(Constants.DB_SERVER_START))) {
			Logger.info("Server is not started. Running clean_build_server to build the project and start the server.");
			curRunCmd = cmdTemplate + " /home/default/artifacts/clean_build_server.sh" + " "
			+ logFileName + " " + libertyEnvValue + " \"" + MAVEN_SETTINGS + "\"";
		}

		String curNewPomUpdateHash = FileMonitor.getNewPomUpdateHash(appDb,
				context.getAppDirectory().getAbsolutePath());
		if (curNewPomUpdateHash != null) {
			Logger.info("pom.xml file change detected.");
			appDb.put(FileMonitor.POMCHANGE_HASH, curNewPomUpdateHash);
		}

		if (commandContainsOption(args, Constants.OPTION_CLEAN) || curNewPomUpdateHash != null) {
			if (curNewPomUpdateHash != null) {
				Logger.info("pom.xml change detected, running clean build for project " + context.getAppName());
				statusMsg = "buildApplicationTask.pomChangeDetected";
			}
			else {
				Logger.info("Running clean build for project " + context.getAppName());
				statusMsg = "buildApplicationTask.runCleanBuild";
			}
			StatusTracker.updateProjectState(context, "build", "inProgress", statusMsg, null);
			
			if (!Boolean.parseBoolean(appDb.get(Constants.DB_CONTAINER_BUILT))) {
				statusMsg = "buildApplicationTask.containerNotRunning";
				Logger.error("The container is not running for project " + context.getAppName());
				StatusTracker.updateProjectState(context, "build", "failed", statusMsg, null);
				return false;
			}
			// Update config hash
			String curNewConfigUpdateHash = FileMonitor.getNewConfigUpdateHash(appDb,
					context.getAppDirectory().getAbsolutePath());
			if (curNewConfigUpdateHash != null) {
				appDb.put(FileMonitor.CONFIGUPDATE_HASH, curNewConfigUpdateHash);
			}
			
			ProcessRunner pr = TaskUtils.runCmd(cmdTemplate + " /home/default/artifacts/clean_build_server.sh"
							+ " " + logFileName + " " + libertyEnvValue + " \"" + MAVEN_SETTINGS + "\"", context, true);
			errorCode = pr.getErrorCode().orElseThrow(() -> new IllegalStateException("Build process did not complete."));
			result = (errorCode == 0 && (!isBuildFailed(cmdTemplate,logFileName, context)));
			if (result) {
				Logger.info("Clean build completed for project " + context.getAppName());
				return true;
			}
			else {
				statusMsg = "buildApplicationTask.cleanBuildFailed";
				Logger.error("Clean build failed for project " + context.getAppName());
				StatusTracker.updateProjectState(context, "build", "failed", statusMsg, null);
				return false;
			}
		} else if (commandContainsOption(args, Constants.OPTION_PROD)) {
			Logger.info("Building production image...");
			curRunCmd = curRunCmd + " " + Constants.OPTION_PROD;
		} else {
			// Check if server config files has been changed.
			String curNewConfigUpdateHash = FileMonitor.getNewConfigUpdateHash(appDb,
					context.getAppDirectory().getAbsolutePath());
			if (curNewConfigUpdateHash != null) {
				statusMsg="buildApplicationTask.configChangeDetected";
				Logger.info("Server config file change detected, running application build.");
				StatusTracker.updateProjectState(context, "build", "inProgress", statusMsg, null);
				curRunCmd = curRunCmd + " " + Constants.BUILD_OPTION_CONFIG;
				appDb.put(FileMonitor.CONFIGUPDATE_HASH, curNewConfigUpdateHash);
				
				ProcessRunner pr = TaskUtils.runCmd(cmdTemplate + " /home/default/artifacts/build_and_update_features.sh"
								+ " " + logFileName + " " + libertyEnvValue + " \"" + MAVEN_SETTINGS + "\"", context, true);
				errorCode = pr.getErrorCode().orElseThrow(() -> new IllegalStateException("Build process did not complete."));
				result = (errorCode == 0 && (!isBuildFailed(cmdTemplate,logFileName, context)));
				if (result) {
					statusMsg = "Application build for server config change completed for project " + context.getAppName(); // :NLS
					Logger.info("Application build for server config change completed for project " + context.getAppName());
					return true;
				}
				else {
					statusMsg = "buildApplicationTask.configBuildFail";
					Logger.error("Application build for server config change failed for project " + context.getAppName() +
					". Please check the log in the build log view for more details.");
					StatusTracker.updateProjectState(context, "build", "failed", statusMsg, null);
					return false;
				}

			}
		}
		statusMsg = "buildApplicationTask.compileApplication";
		Logger.info("Compiling application for project " + context.getAppName());
		StatusTracker.updateProjectState(context, "build", "inProgress", statusMsg, null);

		String mavenBuildLog = "/home/default/logs/maven.build.log";
		Logger.info("Touching maven build log file: " + mavenBuildLog);
		boolean logFileTouched = touchLogFile(cmdTemplate, mavenBuildLog, context);
		if (!logFileTouched) {
			statusMsg =  "buildApplicationTask.buildFail";
			Logger.error("Application build failed for project " + context.getAppName() +
			". Please check the log in the build log view for more details");
			StatusTracker.updateProjectState(context, "build", "failed", statusMsg, null);
			return false;
		}

		ProcessRunner pr = TaskUtils.runCmd(curRunCmd, context, true);

		Logger.info("Triggering log file event for: maven build log");
		StatusTracker.newLogFileAvailable(context, "build");

		errorCode = pr.getErrorCode().orElseThrow(() -> new IllegalStateException("Build process did not complete."));
		result = (errorCode == 0 && (!isBuildFailed(cmdTemplate,logFileName, context)));
		if (result) {
			Logger.info("Application build completed for project " + context.getAppName());
			return true;
		}
		else {
			statusMsg =  "buildApplicationTask.buildFail";
			Logger.error("Application build failed for project " + context.getAppName() +
			". Please check the log in the build log view for more details");
			StatusTracker.updateProjectState(context, "build", "failed", statusMsg, null);
			return false;
		}
	}

	public static boolean touchLogFile(String cmdTemplate, String logFilePath, IDCContext context) throws Exception {
		String curRunCmd = cmdTemplate + " touch " + logFilePath;
		ProcessRunner pr = TaskUtils.runCmd(curRunCmd, context, true);
		String buildOutput = pr.getReceived();

		System.out.println(">> Build output: " + buildOutput);
		return !buildOutput.contains("No such file or directory");
	}

	private static boolean commandContainsOption(String args[], String curOption) {
		if (curOption == null || curOption.isEmpty()) {
			return false;
		}
		// Options always starts with "--"
		curOption = "--" + curOption;
		int argLen = args.length;
		if (argLen > 1) {
			for (int i = 1; i < argLen; i++) {
				if (curOption.equals(args[i])) {
					return true;
				}
			}
		}
		return false;
	}

	private static boolean isBuildFailed(String cmdTemplate, String logFileName, IDCContext context) throws Exception {
		String logFilePath = "/home/default/logs/" + "maven.build.log";
		String curRunCmd;
		if (context.isK8s())
			curRunCmd = "kubectl exec " + context.getKubePodId() + " cat "+ logFilePath;
		else
			curRunCmd = cmdTemplate + " cat "+ logFilePath;
		ProcessRunner pr = TaskUtils.runCmd(curRunCmd, context, true);
		String buildOutput = pr.getReceived();

		// If build log does not exist
		if(buildOutput.contains("No such file or directory"))
			Logger.info("Build log " + logFilePath + " does not exist for project " + context.getAppName());

		return !buildOutput.contains("BUILD SUCCESS");
	}
}
