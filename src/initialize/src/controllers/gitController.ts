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

import git from 'simple-git/promise';
import fs from 'fs-extra';
import path from 'path';

import { replacePlaceholderNameWithProjectName } from './replaceController';

export async function importProjectFromGitRepo(repo: string, name: string, dest: string, branch?: string | undefined): Promise<void> {
  if (fs.readdirSync(dest).length > 0) {
    throw new Error('Git clone failed - directory to clone into is not empty');
  }
  const options = branch ? [ '--branch', branch ] : [];
  await git(dest).silent(true).clone(repo, dest, options);
  fs.removeSync(path.join(dest, '.git'));

  await replacePlaceholderNameWithProjectName(dest, name);
}
