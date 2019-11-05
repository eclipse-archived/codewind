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
import request from 'request';
import { URL } from 'url';

import { replacePlaceholderNameWithProjectName } from './replaceController';
import { exec } from 'child_process';

export async function importProjectFromGitRepo(repo: string, name: string, dest: string, branch?: string | undefined): Promise<void> {
  if (fs.readdirSync(dest).length > 0) {
    throw new Error('Git clone failed - directory to clone into is not empty');
  }

  const tmpName = `/tmp/${branch}_${Date.now()}`;
  const zipFileName = `${tmpName}.zip`;

  try {
    // The github API (api.github.com) defines the get archive call here:
    // https://developer.github.com/v3/repos/contents/#get-archive-link
    // It looks like: /repos/:owner/:repo/:archive_format/:ref
    const repoUrl = new URL(repo);
    const repoName = path.basename(repoUrl.pathname);
    const ownerName = path.basename(path.dirname(repoUrl.pathname));
    const zipUrl = `https://api.github.com/repos/${ownerName}/${repoName}/zipball/${branch}`;

    // Get the zip file, this will follow a redirect sent by the API.
    await asyncHttpDownload(zipUrl, fs.createWriteStream(zipFileName));
    // Unzip the file we downloaded.
    await unzipFile(zipFileName, tmpName);
    // The actual files are under a top level dir in the zip of the format:
    // <ownerName>-<repoName>-<commitId>
    await moveFiles(`${tmpName}/${ownerName}-${repoName}-*/*`, dest);
    try {
      await moveFiles(`${tmpName}/${ownerName}-${repoName}-*/.[!.]*`, dest);
    } catch (err) {
      // Will fail if there are no files begining with . to copy.
    }

  } catch (error) {
    throw new Error('Git clone failed - ensure the repository URL is correct');
  } finally {
    // Clean up even if we have failures.
    await fs.unlink(zipFileName);
    await removeDir(`${tmpName}`);
  }

  await replacePlaceholderNameWithProjectName(dest, name);
}

function asyncHttpDownload(url: string, destination: fs.WriteStream): Promise<void> {
  return new Promise((resolve, reject) => {
    const options = {
      url,
      headers: {
        'User-Agent': 'request'
      }
    };
    const stream = request.get(options)
      .on('error', function (err: any): void {
        return reject(err);
      })
      .pipe(destination);
    stream.on('finish', function (): void {
      return resolve();
    });
  });
}

function unzipFile(fileName: string, destination: string): Promise<void> {
  const cmd = `unzip ${fileName} -d ${destination}`;
  return execAsync(cmd);
}

function moveFiles(source: string, destination: string): Promise<void> {
  const cmd = `mv ${source} ${destination}`;
  return execAsync(cmd);
}

function removeDir(directory: string): Promise<void> {
  const cmd = `rm -rf ${directory}`;
  return execAsync(cmd);
}

function execAsync(cmd: string): Promise<void> {
  let outStr = '';
  let errStr = '';
  return new Promise<void>((resolve, reject) => {
    const child = exec(cmd);

    child.on('error', (err) => { return reject(err); });
    child.stdout.on('data', (chunk) => { outStr += chunk.toString(); });
    child.stderr.on('data', (chunk) => { errStr += chunk.toString(); });

    child.on('close', (code: number | null) => {
      if (code == undefined) {
        // this happens in SIGTERM case, not sure what else may cause it
        reject(`Command ${cmd} did not exit normally`);
      } else if (code !== 0) {
        // console.error(`Error running command ${cmd}`, errStr);
        outStr = outStr || '<no std output>';
        errStr = errStr || '<no error output>';
        // console.error('Stdout:', outStr);
        // console.error('Stderr:', errStr);
        reject(errStr);
      } else {
        // console.log(`Successfully ran command: ${cmd}`);
        resolve();
      }
    });
  });
}