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
import { SocketIO } from "../../lib/socket-io";
import * as projectsController from "../../../../src/controllers/projectsController";

import CreateTest from "./tests/create";
import DeleteTest from "./tests/delete";
import ProjectTest from "./tests/project";
import ShutdownTest from "./tests/shutdown";

/**
 * @class
 * @description The project specific test suite for PFE Turbine Module.
 *
 */
export default class ProjectTestSuite {

    suite: string;
    socket: SocketIO;

    createTest: CreateTest;
    deleteTest: DeleteTest;
    projectTest: ProjectTest;
    shutdownTest: ShutdownTest;

    /**
     * @constructor
     * @description The constructor of the project specific test suite.
     *
     */
    constructor(socket: SocketIO) {
        this.suite = "Project Specific Suite";
        this.socket = socket;

        this.createTest = new CreateTest("create test");
        this.deleteTest = new DeleteTest("delete test");
        this.projectTest = new ProjectTest("project test");
        this.shutdownTest = new ShutdownTest("shutdown test");
    }

    /**
     * @function
     * @description The run test function that triggers all project specific test classes.
     *
     */
    runTest(projectData: projectsController.ICreateProjectParams, projectTemplate: string, projectLang: string, runOnly?: boolean): void {
        (runOnly ? describe.only : describe)(`${this.suite}: ${projectTemplate}-${projectLang}`, () => {
            this.createTest.run(this.socket, projectData, projectTemplate, projectLang);
            this.projectTest.run(this.socket, projectData, projectTemplate, projectLang);
            this.deleteTest.run(this.socket, projectData, projectTemplate, projectLang);
            this.shutdownTest.run(this.socket, projectData, projectTemplate, projectLang);
        });
    }
}
