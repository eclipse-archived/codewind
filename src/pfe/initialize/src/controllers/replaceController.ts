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
import replaceInFile from 'replace-in-file';

export async function replacePlaceholderNameWithProjectName(projectDir: string, projectName: string): Promise<void> {
  const options = {
    files: path.join(projectDir, '**'),
    from: /\[PROJ_NAME_PLACEHOLDER\]/g,
    to: sanitizeName(projectName),
    glob: {
      dot: true
    }
  };

  const modifiedFiles = await replaceInFile(options);
  await replaceFilenameInFiles(projectDir, '[PROJ_NAME_PLACEHOLDER]', projectName);
}

async function replaceFilenameInFiles(currentPath: string, stringToReplace: string, newName: string): Promise<void> {
  const entries = await fs.readdir(currentPath);
  await Promise.all(
    entries.map(async (entry) => {
      const pathToEntry = `${currentPath}/${entry}`;
      const entryIsADir = (await fs.lstat(pathToEntry)).isDirectory();
      if (entryIsADir) {
        await replaceFilenameInFiles(pathToEntry, stringToReplace, newName);
      }
      if (entry === stringToReplace) {
        await fs.rename(`${currentPath}/${entry}`, `${currentPath}/${newName}`);
      }
    }),
  );
}

function sanitizeName(name: string){
  const newName = name.replace(/[^a-zA-Z0-9._-]/g, "");
  if (newName.length === 0){
    return 'PROJ_NAME_PLACEHOLDER'
  }
  return newName;
}