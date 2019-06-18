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

export async function run(): Promise<void> {
  let initializeResult: InitializeResult;
  let response: InitializeResultResponse;

  const projectInitializer = new ProjectInitializer(process.env.PROJ_NAME, initializeDirectory);

  try {
    if (isGitCloneRequired()) {
      initializeResult = await projectInitializer.initializeProjectFromGit(process.env.GIT_REPO, process.env.GIT_BRANCH);
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

  // This is how we communicate with Portal
  process.stdout.write(JSON.stringify(response));
}

function isGitCloneRequired(): boolean {
  return (!!process.env.GIT_REPO && !!process.env.PROJ_NAME);
}
