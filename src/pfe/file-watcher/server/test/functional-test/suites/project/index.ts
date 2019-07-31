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
import { SocketIO } from "../../lib/socket-io";
import { ProjectCreation } from "../../lib/project";

import CreateTest from "./tests/create";
import DeleteTest from "./tests/delete";
import ProjectTest from "./tests/project";

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

    /**
     * @constructor
     * @description The constructor of the project specific test suite.
     *
     */
    constructor(socket: SocketIO) {
        this.suite = "Project Specific Suite";
        this.socket = socket;

        this.createTest = new CreateTest();
        this.deleteTest = new DeleteTest();
        this.projectTest = new ProjectTest();
    }

    /**
     * @function
     * @description The run test function that triggers all project specific test classes.
     *
     */
    runTest(projectData: ProjectCreation): void {
        describe(this.suite, () => {
            describe("creation", async () => {
                this.createTest.run(this.socket, projectData);
            });

            describe("project", async () => {
                this.projectTest.run(projectData);
            });

            describe("deletion", async () => {
                this.deleteTest.run(this.socket, projectData.projectID);
            });
        });
    }
}
