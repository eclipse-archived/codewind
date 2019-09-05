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

import fs from 'fs-extra';
import path from 'path';
import { ProjectType, InitializeResult } from '../types/initializeTypes';

export async function detectType(projectMountDirectory: string): Promise<InitializeResult> {
  let language, projectType;
  if (await fs.pathExists(path.join(projectMountDirectory, 'pom.xml'))) {
    language = 'java';
    projectType = await determineProjectFramework(projectMountDirectory);
  } else if (await fs.pathExists(path.join(projectMountDirectory, 'package.json'))) {
    language = 'nodejs';
    projectType = ProjectType.NODEJS;
  } else if (await fs.pathExists(path.join(projectMountDirectory, 'Package.swift'))) {
    language = 'swift';
    projectType = ProjectType.SWIFT;
  } else {
    language = 'unknown';
    projectType = ProjectType.DOCKER;
  }

  // override project type if it's actually an extension project type
  const extensionProjectType = await determineExtensionProjectType(projectMountDirectory);
  if (extensionProjectType)
    projectType = extensionProjectType;
  return { language, projectType };
}

 async function determineProjectFramework(projectMountDirectory: string): Promise<ProjectType> {
  const pathToPomXml = path.join(projectMountDirectory, 'pom.xml');
  const pomXml = await fs.readFile(pathToPomXml, 'utf8');
  const pathToDockerfile = path.join(projectMountDirectory, 'Dockerfile');
  const dockerfile = await fs.readFile(pathToDockerfile, 'utf8');

  if (pomXml.includes('<groupId>org.springframework.boot</groupId>')) {
    return ProjectType.SPRING;
  }
  else if (dockerfile.includes('FROM websphere-liberty')) {
    return ProjectType.LIBERTY; 
  }
  // eg lagom
  return ProjectType.DOCKER;
}

async function determineExtensionProjectType(projectMountDirectory: string): Promise<string> {
  try {
    const cwExtensions = JSON.parse(process.env.CW_EXTENSIONS);

    if (Array.isArray(cwExtensions)) {
      for (const extension of cwExtensions) {
        const match = extension.file && await fs.pathExists(path.join(projectMountDirectory, extension.file));
        if (match)
          return extension.type;
      }
    }

    // no match
    return null;
  }
  catch (err) {
    return null;
  }
}
