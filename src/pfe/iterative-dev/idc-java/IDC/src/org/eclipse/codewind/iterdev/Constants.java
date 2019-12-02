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

public class Constants {

	// Container naming
	public static final String IDC_TAG = "-idc-";
	public static final String ITERATIVE_DEV = "iterative-dev-";

	// DB keys
    public static final String DB_LAST_CONTAINER_ID = "LAST_CONTAINER_ID";
	public static final String DB_APP_ID = "APP_ID";
	public static final String DB_APP_DIR = "APP_DIR";
	public static final String DB_CONTAINER_NAME = "CONTAINER_NAME";
	public static final String DB_LOG_NAME = "LOG_NAME";
	public static final String DB_CONTAINER_BUILT = "CONTAINER_BUILT";
	public static final String DB_PROJECT_ID = "PROJECT_ID";
	public static final String DB_VERSION = "VERSION";
	public static final String DB_IMAGEREBUILD_HASH = "IMAGEREBUILD_HASH";
	public static final String DB_CONFIGUPDATE_HASH = "CONFIGUPDATE_HASH";
	public static final String DB_POMCHANGE_HASH = "POMCHANGE_HASH";
	public static final String DB_POD_ID = "POD_ID";
	public static final String DB_DEPLOYMENT_ID = "DEPLOYMENT_ID";
	public static final String DB_KUBE_PORT = "KUBE_PORT";
	public static final String DB_HELM_RELEASE = "HELM_RELEASE";
	public static final String DB_WORKSPACE_ORIGIN = "WORKSPACE_ORIGIN";
	public static final String DB_SERVER_START = "SERVER_START";
	public static final String DB_IMAGE_PUSH_REGISTRY = "IMAGE_PUSH_REGISTRY";
	public static final String DB_START_MODE = "START_MODE";
	public static final String DB_DEBUG_PORT = "DEBUG_PORT";
	
	
	// IDC modes
	public static final String MODE_KEY = "MODE";
	public enum MODE {
		dev("Development"),
		prod("Production");

		public final String label;
		
		MODE(String label){
			this.label = label;
		}
	};

	// IDC command options
	public static final String OPTION_PROD = "prod";
	public static final String OPTION_DEV = "dev";
	public static final String OPTION_SET = "set";
	public static final String OPTION_BUILD = "build";
	public static final String OPTION_CLEAN = "clean";
	public static final String OPTION_START = "start";
	public static final String OPTION_DEBUG = "debug";
	public static final String OPTION_STOP = "stop";
	public static final String OPTION_TAIL = "tail";
	public static final String OPTION_STATUS_TRACKER = "status-tracker";
	public static final String OPTION_SHELL = "shell";
	// public static final String OPTION_PORT = "port"; // currently disabled
	// public static final String OPTION_EXIT = "exit"; // not implemented yet
	public static final String OPTION_CONTAINER_REFRESH = "container-refresh";
	public static final String OPTION_CONTAINER_REMOVE = "container-remove";
	public static final String OPTION_SYSTEM_CLEANUP = "system-cleanup";
	public static final String OPTION_HELP = "help";
	
	// Build options
	public static final String BUILD_OPTION_CONFIG = "config";

	// List of valid commands
	public static final String[] VALID_COMMANDS = {
			OPTION_PROD, OPTION_DEV, OPTION_SET, OPTION_BUILD, OPTION_CLEAN,
			OPTION_START, OPTION_DEBUG, OPTION_STOP, OPTION_TAIL, OPTION_STATUS_TRACKER, OPTION_SHELL,
			OPTION_CONTAINER_REFRESH, OPTION_CONTAINER_REMOVE, OPTION_SYSTEM_CLEANUP,
			OPTION_HELP };
	
	// Dockerfiles
	public static final String MASTER_DOCKERFILES_DIRNAME = "masterDockerfiles";
	public static final String DOCKERFILE_SETUP = "Dockerfile-dev-setup";

	public static final String DB_MASTER_DOCKER_FILE_HASH = "MASTER_DOCKER_FILE_HASH";

	public static final String SLASH = File.separator;

	public static final String IDC_DIR = ".idc";
	public static final String IDC_CONFIG_FILE = "idc.config";
    public static final String BASE_PATH_PROPERTY_KEY = "idcBasePath";
    public static final String APP_PREFIX_KEY = "appPrefix";
    
    public static final String modifiedAppDirPromptQues = "Warning: The above app directory cannot be detected either because it was deleted or modified. Stop and remove the above container? (yes/no): ";
	public static final String missingIDCDirPromptQues = "Warning: The .idc directory cannot be detected. Stop and remove the above container? (yes/no): ";

    public static final String HOST_OS = "HOST_OS";
	public static final String HOST_OS_KEY = "--hostOS=";
	
	public static final String LOCAL_IDC_OS = "LOCAL_IDC_OS";
	public static final String LOCAL_IDC_OS_KEY = "--idcLocalOS=";
	
	public static final String WIN_IDC_PATH = "WIN_IDC_PATH";
	public static final String WIN_IDC_PATH_KEY = "--idcWinPath=";
	
	public static final String IN_K8 = "IS_K8";
	public static final String IN_K8_KEY = "--inK8=";
	
	public static final String CONTAINER_NAME = "CONTAINER_NAME";
	public static final String CONTAINER_NAME_KEY = "--containerName=";
	
	public static final String LOG_NAME = "LOG_NAME";
	public static final String LOG_NAME_KEY = "--logName=";
	
	public static final String PROJECT_ID = "PROJECT_ID";
	public static final String PROJECT_ID_KEY = "--projectID=";
	
	public static final String LOCAL_WORKSPACE_ORIGIN = "localWorkspaceOrigin";
	public static final String LOCAL_WORKSPACE_ORIGIN_KEY = "--localWorkspaceOrigin=";

	

	public static final String IMAGE_PUSH_REGISTRY = "IMAGEPUSH_REGISTRY";
	public static final String IMAGE_PUSH_REGISTRY_KEY = "--imagePushRegistry=";

	public static final String START_MODE = "START_MODE";
	public static final String START_MODE_KEY = "--startMode=";

	public static final String DEBUG_PORT = "DEBUG_PORT";
	public static final String DEBUG_PORT_KEY = "--debugPort=";

	public static final String MAVEN_SETTINGS = "MAVEN_SETTINGS";
	public static final String MAVEN_SETTINGS_KEY = "--mavenSettings=";

	public static final String START_MODE_RUN = "run";
	public static final String START_MODE_DEBUG = "debug";
	public static final String START_MODE_DEBUG_NO_INIT = "debugNoInit";
	
	public static final String DB_CHARTDIR_HASH = "CHARTDIR_HASH";
	
	enum ErrorCode {
		dummyEC("Error Code needs to start from exit code 1"),
		unexpectedError("An unexpected error occurred"),
		containerBuildFailed("Container build failed."),
		containerStartFailed("Unable to start container."),
		containerRemoveFailed("The container was not successfully removed"),
		containerCleanupFailed("The container cleanup was not successful"),
		applicationBuildFailed("Application build failed."),
		invalidImagePushRegistry("Failed to push image to invalid Image Push Registry"),
		missingDockerfile("Missing required Dockerfile");

		private String msg;
	
		ErrorCode(String msg) {
			this.msg = msg;
		}

		public String message(){
			return msg;
		}
		
	}

}