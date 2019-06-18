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

import { detectType } from '../controllers/typeDetectionController';
import { writeCwSettings } from '../controllers/cwSettingsController';
import { importProjectFromGitRepo } from '../controllers/gitController';
import { InitializeResult } from 'initializeTypes';

export default class ProjectInitializer {
  projectName: string;
  projectMountDirectory: string;

  constructor(projectName: string, projectMountDirectory: string) {
    this.projectName = projectName;
    this.projectMountDirectory = projectMountDirectory;
  }

  async initializeExistingProject(): Promise<InitializeResult> {
    const projectType = await detectType(this.projectMountDirectory);

    writeCwSettings(this.projectMountDirectory);

    return projectType;
  }

  async initializeProjectFromGit(gitRepo: string, gitBranch?: string): Promise<InitializeResult> {
    await importProjectFromGitRepo(gitRepo, this.projectName, this.projectMountDirectory, gitBranch);

    return this.initializeExistingProject();
  }
}

