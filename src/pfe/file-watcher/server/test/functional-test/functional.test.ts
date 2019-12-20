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
import * as projectsController from "../../src/controllers/projectsController";
import { SocketIO } from "./lib/socket-io";

const codewindTemplates = app_configs.codewindTemplates;
const projectTypes = app_configs.projectTypes;
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
    before("set image push registry", function (done: any): void {
      this.timeout(timoutConfigs.defaultTimeout);
      const workspace_settings_file_content = { registryAddress: pfe_configs.imagePushRegistryAddress, registryNamespace: pfe_configs.imagePushRegistryNamespace };
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
            expect(body.imagePushRegistry).to.equal(true);
            expect(body.address).to.equal(pfe_configs.imagePushRegistryAddress);
            expect(body.namespace).to.equal(pfe_configs.imagePushRegistryNamespace);
            done();
          });
        });
      });
    });
  }
  runAllTests();
});

function runAllTests(): void {
  genericSuite.runTest();
  for (const chosenTemplate of Object.keys(projectTypes)) {
    for (const chosenProject of projectTypes[chosenTemplate]) {
      if (process.env.TURBINE_PERFORMANCE_TEST) {
        createDataFile(chosenTemplate, chosenProject);
      }
      runProjectSpecificTest(chosenTemplate, chosenProject);
    }
  }
}

function runProjectSpecificTest(chosenTemplate: string, chosenProject: string): void {
  const projData: projectsController.ICreateProjectParams = {
    projectID: `${chosenTemplate}-${chosenProject}-${projectConfigs.appSuffix}`,
    projectType: chosenTemplate === codewindTemplates.default ? chosenProject : chosenTemplate,
    location: `${projectConfigs.appDirectory}${chosenTemplate}-${chosenProject}`,
    extension: {
      name: chosenTemplate,
      path: app_configs.extensionPaths[chosenTemplate]
    },
    language: chosenProject
  };
  projectSuite.runTest(projData, chosenTemplate, chosenProject);
}

function createDataFile(projectTemplate: string, projectLang: string): void {
  const dataJson = path.resolve(__dirname, "..", "performance-test", "data", process.env.TEST_TYPE, process.env.TURBINE_PERFORMANCE_TEST, "performance-data.json");
  if (! fs.existsSync(dataJson)) {
    fs.writeFileSync(dataJson, "{}", "utf-8");
  }
  const fileContent = JSON.parse(fs.readFileSync(dataJson, "utf-8"));
  fileContent[projectTemplate] = fileContent[projectTemplate] || {};
  fileContent[projectTemplate][projectLang] = fileContent[projectTemplate][projectLang] || {};
  const timestamp = Date.now();
  fileContent[projectTemplate][projectLang][timestamp] = {};
  fs.writeFileSync(dataJson, JSON.stringify(fileContent));
}
