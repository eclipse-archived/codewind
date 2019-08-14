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
import java.util.LinkedList;
import java.util.List;

public class DockerfileMapping {
	List<String> sourceFiles = new LinkedList<String>();

	/** Mapping from the name of the master docker files into what we store in the user app directory f*/
	private static final DockerfileMapping masterDockerfileMapping[] = new DockerfileMapping[2];

	/*
		Create mapping in order of precedence. Files will be processed in order.
		Eg. If Dockerfile-dev exists it will supersede Dockerfile.
	*/
	static {
		// Dockerfile-dev & Dockerfile-lang & Dockerfile
		masterDockerfileMapping[0] = new DockerfileMapping()
				// Priority: Dockerfile-dev > Dockerfile-lang > Dockerfile
				// Eg. If Dockerfile-dev exists, process Dockerfile-dev instead of Dockerfile
				.addAppFile("Dockerfile", "Dockerfile-lang", "Dockerfile-dev");

		// Dockerfile-build & Dockerfile-dev-build
		masterDockerfileMapping[1] = new DockerfileMapping()
				// Priority: Dockerfile-build > Dockerfile-dev-build
				// Eg. If Dockerfile-build exists, process Dockerfile-build instead of Dockerfile-dev-build
				.addAppFile("Dockerfile-dev-build", "Dockerfile-build");
	}

	private DockerfileMapping addAppFile(String... sourceFiles) {
		for(String sourceFile: sourceFiles)
			this.sourceFiles.add(sourceFile);
		return this;
	}

	public List<String> getSourceFiles() {
		return sourceFiles;
	}

	public static List<String> getDockerfileComposition(IDCContext context) {
		List<String> dockerfileComposition = new LinkedList<String>();
		int missingDockerfileCounter = 0;

		for (DockerfileMapping mapping : masterDockerfileMapping) {
			// Select the highest priority Dockerfile at each level
			// Eg. If Dockerfile-dev exists then use it for the final Dockerfile for the development image Dockerfile
			String selectedDockerfile = null;
			for (String df : mapping.getSourceFiles()) {
				File targetFile = new File(context.getAppDirectory(), df);
				if (targetFile.exists()) {
					selectedDockerfile = df;
				}
			}

			if (selectedDockerfile != null) {
				dockerfileComposition.add(selectedDockerfile);
				Logger.info("Selected Dockerfile from Dockerfile list " + mapping.getSourceFiles() + " is: " + selectedDockerfile);
			} else {
				// If no file was selected at the level then show a message about Dockerfile list.
				// At least one Dockerfile of the Dockerfile list should be exist.
				Logger.error("Unable to create Dockerfile for development because required at least one Dockerfile from Dockerfile list "
						+ mapping.getSourceFiles());
				missingDockerfileCounter++;
			}
		}

		if (missingDockerfileCounter > 0) {
			// send the exit code of the build
			Logger.info("Exiting out of docker file composition with exit code 1");
            System.exit(8);
		}
		
		return dockerfileComposition;
	}
}