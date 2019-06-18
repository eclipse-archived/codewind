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
import { expect } from "chai";

import * as utils from "./lib/utils";
// set all the test environmental variables
utils.setTestEnvVariables();
import * as app_configs from "./configs/app.config";
import { localeTestSuite } from "./tests/locale.test";
import { createTestSuite } from "./tests/create.test";

import { ProjectCreation } from "./lib/project-creation";

const projectTypes = app_configs.projectTypes;
const dockerProjects = app_configs.supportedDockerProjects;
const projectConfigs = app_configs.projectConfigs;

describe("Functional Test Suite", () => {
  beforeEach("check for pfe to be up", (done) => {
    utils.pingPFE((err: any, res: any) => {
      if (err) done(err);
      expect(res.statusCode).to.equal(200);
      done();
    });
  });

  before("copy fixtures to workspace", (done) => {
    utils.copyFixtures(done);
  });

  before("set up test resources", () => {
    utils.createFWDataDir();
  });

  after("clean up test resources", () => {
    utils.cleanWorkspace();
    utils.removeFWDataDir();
    // remove logs dir only for now till the delete project test has been added
    utils.cleanUpLogsDir();
  });

  describe("generic suite", () => {
    describe("setLocale", () => {
      localeTestSuite();
    });
  });

  for (const chosenType of projectTypes) {
    if (chosenType === "docker") {
      for (const chosenDocker of dockerProjects) {
        runTest(chosenType, chosenDocker);
      }
    } else {
      runTest(chosenType);
    }
  }

  function runTest(projType: string, dockerType?: string): void {
    const projectType = dockerType ? dockerType : projType;
    const projData: ProjectCreation = {
      projectID: projectType + projectConfigs.appSuffix,
      projectType: projType,
      location: projectConfigs.appDirectory + projectType
    };

    describe(projectType, () => {
      describe("project creation", () => {
        createTestSuite(projData);
      });
    });
  }
});
