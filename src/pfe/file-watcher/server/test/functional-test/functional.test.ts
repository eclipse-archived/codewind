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
import mocha from "mocha";
import { expect } from "chai";
import fs from "fs";
import path from "path";

import * as utils from "./lib/utils";
// set all the test environmental variables
utils.setTestEnvVariables();
import * as app_configs from "./configs/app.config";
import * as pfe_configs from "./configs/pfe.config";
import * as timoutConfigs from "./configs/timeout.config";

import GenericTestSuite from "./suites/generic/index";
import ProjectTestSuite from "./suites/project/index";

import * as genericLib from "./lib/generic";
import { ProjectCreation } from "./lib/project";
import { SocketIO } from "./lib/socket-io";

const projectTypes = app_configs.projectTypes;
const dockerProjects = app_configs.supportedDockerProjects;
const projectConfigs = app_configs.projectConfigs;

const socket = new SocketIO();
const genericSuite = new GenericTestSuite(socket);
const projectSuite = new ProjectTestSuite(socket);

describe("PFE - functional test", () => {

  before(`set logging level to ${process.env.DEFAULT_LOG_LEVEL}`, async () => {
    await genericLib.setLoggingLevel(process.env.DEFAULT_LOG_LEVEL);
  });

  before("registering socket listener", () => {
    socket.registerListener("PFE Functional Test Listener");
  });

  if (process.env.IN_K8) {
    before("set deployment registry", function (done: any): void {
      this.timeout(timoutConfigs.defaultTimeout);
      const workspace_settings_file_content = { deploymentRegistry: pfe_configs.deploymentRegistry };
      const workspace_settings_file_content_json = JSON.stringify(workspace_settings_file_content);
      const workspace_settings_file = path.join(app_configs.codewindWorkspaceDir, ".config", "settings.json");

      utils.writeToFile(workspace_settings_file, workspace_settings_file_content_json, (err) => {
        if (err) done(err);
        fs.chown(workspace_settings_file, 1001, 2004, (err) => {
          if (err) done(err);
          utils.getRegistry((err, res, body) => {
            if (err) done(err);
            expect(res);
            expect(body);
            body = JSON.parse(body);
            expect(body.statusCode).to.equal(200);
            expect(body.deploymentRegistry).to.equal(true);
            done();
          });
        });
      });
    });
  }

  runAllTests();
});

function runAllTests(): void {
  genericSuite.runTest(true);
  for (const chosenType of projectTypes) {
    if (chosenType === "docker") {
      for (const chosenDocker of dockerProjects) {
        runProjectSpecificTest(chosenType, chosenDocker);
      }
    } else {
      runProjectSpecificTest(chosenType);
    }
  }
}

function runProjectSpecificTest(projType: string, dockerType?: string): void {
  const projectType = dockerType ? dockerType : projType;
  const projData: ProjectCreation = {
    projectID: projectType + projectConfigs.appSuffix,
    projectType: projType,
    location: projectConfigs.appDirectory + projectType
  };
  projectSuite.runTest(projData, projectType);
}
