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

import ProjectInitializer from './classes/ProjectInitializer';
import { Status, InitializeResult, InitializeResultResponse } from './types/initializeTypes';

const initializeDirectory = '/initialize';

// Run as a script if executed as `node main.js`
if (require.main === module) {
  // Because main is async it can swallow exceptions (like syntax errors in
  // required files unless we handle them.
  main().catch(err => console.dir(err));
}

async function main(): Promise<void> {
  const projectDirectory = process.env.PROJ_DIR || initializeDirectory;
  const projectName = process.env.PROJ_NAME;
  const gitRepository = process.env.GIT_REPO;
  const gitBranch =  process.env.GIT_BRANCH;

  let response = await initialiseProject(projectName, projectDirectory, gitRepository, gitBranch)
  // This is how we communicate with Portal
  process.stdout.write(JSON.stringify(response));
}

export async function initialiseProject(projectName: string, projectDirectory: string, gitRepository?: string, gitBranch?: string) {
  let initializeResult: InitializeResult;
  let response: InitializeResultResponse;

  // Set the umask for file creation.
  const oldUmask = process.umask(0o002);

  const projectInitializer = new ProjectInitializer(projectName, projectDirectory);

  try {
    if (isGitCloneRequired(projectName, gitRepository)) {
      initializeResult = await projectInitializer.initializeProjectFromGit(gitRepository, gitBranch);
    } else {
      initializeResult = await projectInitializer.initializeExistingProject();
    }

    response = {
      status: Status.success,
      result: initializeResult,
    };
  } catch (error) {
    response = {
      status: Status.failed,
      result:  error.message,
    };
  }

  // Reset the umask.
  process.umask(oldUmask);

  return response;

}

function isGitCloneRequired(projectName: string, gitRepository?: string): boolean {
  return (!!gitRepository && !!projectName);
}
