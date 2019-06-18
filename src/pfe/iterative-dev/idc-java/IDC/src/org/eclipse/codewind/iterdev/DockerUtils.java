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

import java.io.BufferedReader;
import java.io.BufferedWriter;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileNotFoundException;
import java.io.FileWriter;
import java.io.IOException;
import java.io.InputStreamReader;
import java.util.ArrayList;
import java.util.LinkedList;
import java.util.List;

import org.eclipse.codewind.iterdev.tasks.TaskUtils;

public class DockerUtils {

    public static boolean checkForContainerImage(IDCContext context) throws InterruptedException, IOException {
		boolean isPresent = false;

		ProcessRunner pr = TaskUtils.runCmd("docker images --format \"{{.Repository}}\"", context, false);

		Thread.sleep(1000);
		for (String str : pr.getReceived().split("\\r?\\n")) {
			if (str != null && str.equals(context.getImageName())) {
				isPresent = true;
				Logger.info("----");
				Logger.info("Container Image already present: " + str);
				Logger.info("Skipping image build. ");
				Logger.info("----");

				context.getAppDb().put(Constants.DB_CONTAINER_BUILT, Boolean.TRUE.toString());
			}
		}

		return isPresent;
    }

	public static List<List<String>> dockerPs(IDCContext context) throws IOException, InterruptedException {
		List<List<String>> result = new ArrayList<>();

		ProcessRunner pr = TaskUtils.runCmd("docker ps --no-trunc -q", context, false);

		for (String str : pr.getReceived().split("\\r?\\n")) {

			if (str.startsWith("CONTAINER ID")) {
				continue;
			}

			result.add(IDCUtils.splitFieldsByMultipleSpaces(str));
		}

		return result;
	}

	// 	
	// Checks a given Dockerfile for COPY commands and tries to resolve them for an application's source and build output	
	//	
	public static void handleDockerfileCopyCommands(File applicationDir, File containerBuildContextDir) throws IOException {	
		File mergedDockerfile = new File(containerBuildContextDir, "Dockerfile-idc");
		InputStreamReader fin = null;
		BufferedReader bin = null;
		try {	
			fin = new InputStreamReader(new FileInputStream(mergedDockerfile));
			bin = new BufferedReader(fin);
	
			String str = bin.readLine();
			if (str == null)
				return;
			
			do {
				/*	
				 * Example Dockerfile commands:	
				 * COPY /target/liberty/wlp/usr/servers/defaultServer /config/	
				 * COPY /src/main/liberty/config/jvmbx.options /config/jvm.options	
				 */	
				String line = str.trim();
				if (line.toLowerCase().startsWith("copy")) {
					String commandParams = line.substring(5).trim();	
					String[] params = commandParams.split(" ");
						
					/* 	
					 * Docker copy command format: COPY [--chown=<user>:<group>] <src>... <dest>	
					 * We only need to ensure the src locations exist in the container build context location so that the copy method will not fail.	
					 */	
					for (int i=0; i< params.length -1; i++) {
						// Each 'param' corresponds to a src location
						String param = params[i].startsWith("/") ? params[i].substring(1) : params[i];
							
						/* 	
						 * target:	
						 * If the COPY command's src location is from the app's target then just create the directory structure because the	
						 * development container will run the build that will populate the locations with the expected files.	
						 *	
						 * src:	
						 * If the command's src location is from the app's src then copy the file/directory to the container build context location.	
					 	 */ 	
						if (param.startsWith("target")) {
								
							// Handle application build output folders	
							File f = new File(containerBuildContextDir, param);
							f.mkdirs();
								
						} else if (param.startsWith("src")) {
								
							// Handle application source files/folders	
							File appFile = new File(applicationDir, param);
							if (!appFile.exists())
								continue;	
								
							if (appFile.isFile()) {
								// file	
								File buildFile = new File(containerBuildContextDir, param);
								Logger.info("Copying file from " + appFile.getAbsolutePath() + " to " + buildFile.getAbsolutePath());
								buildFile.getParentFile().mkdirs();
								IDCUtils.copyFile(appFile.getAbsolutePath(), buildFile.getAbsolutePath());
	
							} else if (appFile.isDirectory()) {
								// folder
								File buildFolder = new File(containerBuildContextDir, param);
								buildFolder.mkdirs();
								IDCUtils.copyDir(appFile.getAbsolutePath(), buildFolder.getAbsolutePath());
							}
						}
					}
				}
			} while ((str = bin.readLine()) != null);
	
		} catch (FileNotFoundException e1) {
			throw new IOException(mergedDockerfile + " does not exist");
		} catch (IOException e2) {
			throw new IOException("Error reading/writing file: " + mergedDockerfile, e2);
		} finally {
			try {
				if (bin != null)
					bin.close();
			} catch (IOException e3) {
				// ignore	
			}
		}
		return;
	}

	/** Look at the master docker files the users has in their app dir (if those master docker files exist), and 
	 * return an SHA1 hash of their contents (or null if any master files are not found) */
	public static String calculateHashOfAppDirMasterDockerFiles(IDCContext context) throws IOException {
		String hash = null;

		List<File> userAppDockerFiles = new LinkedList<File>();
		for (String dockerfile : DockerfileMapping.getDockerfileComposition(context)) {
			userAppDockerFiles.add(new File(context.getAppDirectory(), dockerfile));
		}

		hash = IDCUtils
				.calculateHashOfOrderedFileContents(userAppDockerFiles.toArray(new File[userAppDockerFiles.size()]));
		return hash;
	}

	public static boolean generateDockerfile(File dockerFileDestDir, IDCContext context) {

		List<String> dockerfiles = DockerfileMapping.getDockerfileComposition(context);
		String[] pathsToMerge = new String[dockerfiles.size() + 1];
		for (int i = 0; i < dockerfiles.size(); i++) {
			pathsToMerge[i] = context.getAppDirectory().getPath() + Constants.SLASH + dockerfiles.get(i);
		}
		pathsToMerge[dockerfiles.size()] = context.getArtifactsDirectory().getPath() + Constants.SLASH
				+ Constants.MASTER_DOCKERFILES_DIRNAME + Constants.SLASH + Constants.DOCKERFILE_SETUP;

		List<File> files = new ArrayList<>();
		for (String str : pathsToMerge) {
			File f = new File(str);
			if (!f.exists()) {
				Logger.error("One of the required docker files does not exist. " + f.getPath());
				return false;
			}
			files.add(f);
		}

		File mergedDockerfile = new File(dockerFileDestDir, "Dockerfile-idc");
		mergeFiles(files, mergedDockerfile);
		if (mergedDockerfile.exists()) {
			Logger.info("Generated Dockerfile for development: " + mergedDockerfile.getAbsolutePath());
		} else {
			Logger.error("Fail to generate Dockerfile for development" + mergedDockerfile.getAbsolutePath());
		}
			
		return mergedDockerfile.exists();
	}

	public static boolean handleDockerImageBuildSetup(File applicationDir, File mergedDockerfileDir) throws IOException {	
		try {	
			handleDockerfileCopyCommands(applicationDir, mergedDockerfileDir);	
		} catch(Exception e) {	
			Logger.error("Could not set up Dockerfile build context", e);	
		}	
		return true;	
	}

	private static void mergeFiles(List<File> files, File mergedFile) {

		FileWriter fWriter = null;
		BufferedWriter fBufWriter = null;
		try {
			fWriter = new FileWriter(mergedFile, false);
			fBufWriter = new BufferedWriter(fWriter);
		} catch (IOException e1) {
			e1.printStackTrace();
		}

		for (File curFile : files) {
			Logger.info("merging: " + curFile.getName());
			FileInputStream fis;
			try {
				fis = new FileInputStream(curFile);
				BufferedReader in = new BufferedReader(new InputStreamReader(fis));

				String curLine;
				while ((curLine = in.readLine()) != null) {
					fBufWriter.write(curLine);
					fBufWriter.newLine();
				}

				in.close();
			} catch (IOException e) {
				e.printStackTrace();
			}
		}

		try {
			fBufWriter.close();
		} catch (IOException e) {
			e.printStackTrace();
		}
	}

}