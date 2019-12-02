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

import LocaleTest from "./tests/locale";
import LoggingTest from "./tests/logging";
import ProjectTest from "./tests/project";
import WorkspaceTest from "./tests/workspace";

/**
 * @class
 * @description The generic test suite for PFE Turbine Module.
 *
 */
export default class GenericTestSuite {
    suite: string;
    socket: SocketIO;

    localeTest: LocaleTest;
    loggingTest: LoggingTest;
    projectTest: ProjectTest;
    workspaceTest: WorkspaceTest;

    /**
     * @constructor
     * @description The constructor of the generic test suite.
     *
     */
    constructor(socket: SocketIO) {
        this.suite = "Generic Suite";
        this.socket = socket;

        this.localeTest = new LocaleTest("locale test");
        this.loggingTest = new LoggingTest("logging test");
        this.projectTest = new ProjectTest("project test");
        this.workspaceTest = new WorkspaceTest("workspace test");
    }

    /**
     * @function
     * @description The run test function that triggers all generic test classes.
     *
     */
    runTest(runOnly?: boolean): void {
        (runOnly ? describe.only : describe)(this.suite, () => {
            // this.localeTest.run();
            // this.loggingTest.run();
            // this.projectTest.run();
            this.workspaceTest.run(this.socket);
        });
    }
}
