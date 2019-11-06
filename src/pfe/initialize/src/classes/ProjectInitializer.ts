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

import http from 'http';

import { detectType } from '../controllers/typeDetectionController';
import { writeCwSettings } from '../controllers/cwSettingsController';
import { importProjectFromGitRepo } from '../controllers/gitController';
import { InitializeResult } from 'initializeTypes';
import { importProjectFromTar } from '../controllers/tarController';

export default class ProjectInitializer {
  projectName: string;
  projectMountDirectory: string;

  constructor(projectName: string, projectMountDirectory: string) {
    this.projectName = projectName;
    this.projectMountDirectory = projectMountDirectory;
  }

  async initializeExistingProject(): Promise<InitializeResult> {
    const initializeResult = await detectType(this.projectMountDirectory);
    writeCwSettings(this.projectMountDirectory, initializeResult.projectType);
    return initializeResult;
  }

  async initializeProjectFromGit(
    gitRepo: string,
    gitBranch?: string
  ): Promise<InitializeResult> {
    await importProjectFromGitRepo(
      gitRepo,
      this.projectName,
      this.projectMountDirectory,
      gitBranch
    );
    return this.initializeExistingProject();
  }

  async initializeProjectFromTar(
    tarFile: string
    ): Promise<InitializeResult> {
      await importProjectFromTar(tarFile,
        this.projectName,
        this.projectMountDirectory
        );
    return this.initializeExistingProject();
  }

  copyFiles() {
    this.traverseFileSystem(this.projectMountDirectory);
  }

  traverseFileSystem = async(currentPath: any) => {
    const files = fs.readdirSync(currentPath);
    for (const i in files) {
      const currentFile = `${currentPath}/${files[i]}`;
      const stats = fs.statSync(currentFile);
      if (stats.isFile()) {
        asyncHttpRequest(this.createOptions(), this.createBody(fs.readFileSync(currentFile, 'utf-8'), files[i]));
      } else if (stats.isDirectory()) {
        this.traverseFileSystem(currentFile);
      }
    }
  };

  createBody = (fileContent: any, fileName: any) => {
    return JSON.stringify({
      fileName,
      fileContent,
    });
  };

  createOptions = () => {
    return {
      host: 'docker.for.mac.localhost',
      port: '9092',
      path: '/api/v1/projects/2/fileCatcher',
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json'
        // 'Content-Length': body.length,
      }
    };
  };
}

function asyncHttpRequest(options: any, body: any, secure = false) {
  return new Promise(function(resolve, reject) {
    // const protocol = secure ? https : http;
    const req = http.request(options, res => {});
    if (body) {
      req.write(body);
    }
    req.on('error', (err: any) => {
      console.dir(err);
    });
    req.end();
  });
}
