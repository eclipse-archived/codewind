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
import java.io.FileInputStream;
import java.io.FileNotFoundException;
import java.io.IOException;
import java.util.Optional;
import java.util.Properties;

import org.apache.commons.codec.digest.DigestUtils;

public class IDCContext {

	private final DBMap appDb;

	private final String appName;

	private final String appId;
	
	private final String containerName;
	
	private final String logName;
	
	private final String projectID;

	private final String rootPassword;

	private final String localWorkspaceOrigin;

	private final String imagePushRegistry;

	private final String startMode;

	private final String debugPort;

	private final DBMap globalDb;

	private final File appDirectory;

	private final File artifactsDirectory;

	private final Properties idcConfig;

	private final File idcBase;
	
	private final boolean isK8s;
	
	private final boolean isWin;

	private final String imageCommand;

	private final String imagesFormatString;
	
	public IDCContext(String rootPassword, String localWorkspaceOrigin, String containerName, String projectID, String logName, String imagePushRegistry, String startMode, String debugPort) throws IOException {

		this.rootPassword = rootPassword;

		this.idcConfig = loadIDCConfigPropertiesFromFile();
		// Set the idc base path
		String idcBasePath = idcConfig.getProperty(Constants.BASE_PATH_PROPERTY_KEY);

		// Default idc base path is the user home directory
		if (idcBasePath == null)
			idcBasePath = System.getProperty("user.home");

		// Append idc base folder (.idc) to the base path
		if (!idcBasePath.endsWith(Constants.SLASH))
			idcBasePath += Constants.SLASH;
		idcBasePath += Constants.IDC_DIR;

		this.idcBase = new File(idcBasePath);

		/** app id is a hash of the path */
		this.appId = DigestUtils.sha1Hex(System.getProperty("user.dir").getBytes());

		this.appDb = new DBMap(appId, idcBase);
		
		this.localWorkspaceOrigin = localWorkspaceOrigin;
		if (this.localWorkspaceOrigin != null && appDb.get(Constants.DB_PROJECT_ID) != this.localWorkspaceOrigin) {
			appDb.put(Constants.DB_WORKSPACE_ORIGIN, this.localWorkspaceOrigin);
		}
		
		// Store the container/image name in the appdb for future access
		this.containerName = containerName;
		if (this.containerName != null && appDb.get(Constants.DB_CONTAINER_NAME) != this.containerName)  {
			appDb.put(Constants.DB_CONTAINER_NAME, this.containerName);
		}
		
		// Store the app log name in the appdb for future access
		this.logName = logName;
		if (this.logName != null && appDb.get(Constants.DB_LOG_NAME) != this.logName) {
			appDb.put(Constants.DB_LOG_NAME, this.logName);
		}
		
		this.projectID = projectID;
		if (this.projectID != null && appDb.get(Constants.DB_PROJECT_ID) != this.projectID) {
			appDb.put(Constants.DB_PROJECT_ID, this.projectID);
		}

		this.imagePushRegistry = imagePushRegistry;
		if (this.imagePushRegistry != null) {
			appDb.put(Constants.DB_IMAGE_PUSH_REGISTRY, this.imagePushRegistry);
		}

		this.startMode = startMode;
		if (this.startMode != null) {
			appDb.put(Constants.DB_START_MODE, this.startMode);
		}

		this.debugPort = debugPort;
		if (this.debugPort != null) {
			appDb.put(Constants.DB_DEBUG_PORT, this.debugPort);
		}

		this.artifactsDirectory = getArtifactsFromInstallDir();

		this.appDirectory = new File(System.getProperty("user.dir"));

		this.appName = this.appDirectory.getName();

		this.globalDb = new DBMap("global", idcBase);
		
		String hostOS = System.getenv("HOST_OS");
		if(hostOS != null) {
			this.isWin = hostOS.equals("windows");
		} else {
			this.isWin = false;
		}
		
		String k8String = System.getenv("IN_K8");
		if (k8String != null) {
			this.isK8s = k8String.equals("true");
		}
		else {
			this.isK8s = false;
		}
		
		if (this.isK8s) {
			this.imageCommand = "buildah";
		}
		else {
			this.imageCommand = "docker";
		}

		// for buildah on K8, the format is Name
		// for docker on local, the format is Repository
		if (this.isK8s) {
			this.imagesFormatString = "\"{{.Name}}\"";
		}
		else {
			this.imagesFormatString = "\"{{.Repository}}\"";
		}

	}

	public DBMap getAppDb() {
		return appDb;
	}

	public String getAppName() {
		return appName;
	}

	public String getAppId() {
		return appId;
	}
	
	public String getLocalWorkspaceOrigin() {
		if (appDb.get(Constants.DB_WORKSPACE_ORIGIN) != null) {
			return appDb.get(Constants.DB_WORKSPACE_ORIGIN);
		} else {
			return "";
		}
	}

	public DBMap getGlobalDb() {
		return globalDb;
	}

	public String getContainerName() {
		//check if container/image name is being set by the idc command, if not fall back to the existing convention which is to be used by local idc cases only
		if(appDb.get(Constants.DB_CONTAINER_NAME) != null) {
			return appDb.get(Constants.DB_CONTAINER_NAME);
		} else {
			String prefix = idcConfig.getProperty(Constants.APP_PREFIX_KEY) == null ? Constants.ITERATIVE_DEV : idcConfig.getProperty(Constants.APP_PREFIX_KEY);
			return prefix + appName.toLowerCase() + Constants.IDC_TAG + appDb.getId();
		}
	}

	public String getLogDir() {
		return "\"" + this.getAppName() + "-" + this.getprojectID() + "\"";
	}
	
	public String getprojectID() {
		if(appDb.get(Constants.DB_PROJECT_ID) != null) {
			return appDb.get(Constants.DB_PROJECT_ID);
		} else {
			return "";
		}
	}

	public String getImageName() {
		//check if container/image name is being set by the idc command, if not fall back to the existing convention which isto be used by local idc cases only
		if(appDb.get(Constants.DB_CONTAINER_NAME) != null) {
			return appDb.get(Constants.DB_CONTAINER_NAME);
		} else {
			String prefix = idcConfig.getProperty(Constants.APP_PREFIX_KEY) == null ? Constants.ITERATIVE_DEV : idcConfig.getProperty(Constants.APP_PREFIX_KEY);
			return prefix + appName.toLowerCase() + Constants.IDC_TAG + appDb.getId();
		}
	}

	public File getAppDirectory() {
		return appDirectory;
	}

	public File getArtifactsDirectory() {
		return artifactsDirectory;
	}

	public Optional<String> getRootPassword() {
		return Optional.ofNullable(rootPassword);
	}

	public File getIDCBase() {
		return idcBase;
	}

	public Properties getIDCConfiguration() {
		return idcConfig;
	}

	public static File getIDCJarDir() {
		// If the IDC jar location is specified by a system property then use it
		String idcJarPath = System.getProperty("idc.jar.path");
		if (idcJarPath != null) {
			File idcArtifactsFolder = new File(idcJarPath);
			if (idcArtifactsFolder.exists())
				return idcArtifactsFolder;
		}

		String classpath = System.getProperty("java.class.path");
		String[] classpathEntries = classpath.split(File.pathSeparator);

		File idcJar = null;

		for (String str : classpathEntries) {
			if (str.endsWith("IDC.jar")) {
				idcJar = new File(str);
			}
		}

		if (idcJar == null) {
			throw new RuntimeException("IDC.jar not found in classpath");
		}
		return idcJar.getParentFile();
	}

	private Properties loadIDCConfigPropertiesFromFile() {
		Properties props = new Properties();

		File idcJarDir = IDCContext.getIDCJarDir();

		File idcConfig = new File(idcJarDir, Constants.SLASH + Constants.IDC_CONFIG_FILE);
		if (idcConfig.exists()) {
			try {
				props.load(new FileInputStream(idcConfig));
			} catch (FileNotFoundException e) {
				// The idc config file is optional
			} catch (IOException e) {
				Logger.info("Encountered an error while reading the IDC configuration file");
				e.printStackTrace();
			}
		}
		if (!props.isEmpty()) {
			Logger.info("Configuration file detected: ");
			props.entrySet().stream().forEach(e -> Logger.info(e.getKey() + " : " + e.getValue())); // print properties
		}

		return props;
	}

	private static File getArtifactsFromInstallDir() {

		File idcJarDir = getIDCJarDir();
		// Look for artifacts in (idc_jar)/../artifacts (this is the standard install scenario)
		if (idcJarDir != null && idcJarDir.getParentFile() != null) {
			File artifacts = new File(idcJarDir.getParentFile(), "artifacts");
			if (artifacts.exists() && new File(artifacts, "run_docker.sh").exists()) {
				return artifacts;
			}
		}

		// Look for artifacts in (idc_jar)/../../../docker/artifacts (this is the maven build scenario)
		File artifacts = new File(idcJarDir + Constants.SLASH + ".." + Constants.SLASH + ".." + Constants.SLASH + ".."
				+ Constants.SLASH + "docker" + Constants.SLASH + "artifacts");
		if (artifacts.exists() && new File(artifacts, "run_docker.sh").exists()) {
			Logger.info("Artifacts located in " + artifacts.getAbsolutePath());
			return artifacts;
		}

		String classpath = System.getProperty("java.class.path");
		throw new RuntimeException("Unable to locate artifacts directory, classpath was: " + classpath);
	}

	public File getAppDockerBase() {
		File DOCKER_BASE = new File(getIDCBase(), "docker");
		return new File(DOCKER_BASE, "docker-" + getAppDb().getId());
	}

	public String getLogFileName() {
		String logFileName = "mc-" + getprojectID();
		
		// Return app log name if its set in idc 
		// This is to maintain backward compatibility with older projects
		// Refer projectUtils.js and liberty-container.sh for usage
		if(appDb.get(Constants.DB_LOG_NAME) != null) {
			logFileName = appDb.get(Constants.DB_LOG_NAME);
		}
		
		return logFileName.toLowerCase();
	}

	public String getImagePushRegistry() {
		String imagePushRegistry = "";
		
		if(appDb.get(Constants.DB_IMAGE_PUSH_REGISTRY) != null) {
			imagePushRegistry = appDb.get(Constants.DB_IMAGE_PUSH_REGISTRY);
		}
		
		return imagePushRegistry;
	}

	public String getKubePodId() {
		return this.appDb.get(Constants.DB_POD_ID);
	}
	
	public boolean isK8s() {
		return this.isK8s;
	}
	
	public boolean isWin() {
		return this.isWin;
	}

	public String getStartMode() {
		if(appDb.get(Constants.DB_START_MODE) != null) {
			return appDb.get(Constants.DB_START_MODE);
		} else {
			return "run";
		}
	}

	public String getDebugPort() {
		if(appDb.get(Constants.DB_DEBUG_PORT) != null) {
			return appDb.get(Constants.DB_DEBUG_PORT);
		} else {
			return "7777";
		}
	}

	public String getImageCommand() {
		return this.imageCommand;
	}

	public String getImagesFormatString() {
		return this.imagesFormatString;
	}
}
