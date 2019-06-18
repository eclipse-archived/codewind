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
import * as logHelper from "../../../../server/src/projects/logHelper";

/**
 * Expected list of build log names
 */
export const expectedBuildLogNames = ["docker.build", "docker.app", "maven.build", "app.compile"];

/**
 * Expected list of app log names
 */
export const expectedAppLogNames = ["app", "messages", "console"];

/**
 * Expected log extension
 */
export const logExtension = ".log";

/**
 * @function
 * @description Get all build log names
 * @returns Array<string>
 */
export function getBuildLogNames(): Array<string> {
    return Object.values(logHelper.buildLogs);
}

/**
 * @function
 * @description Get all app log names
 * @returns Array<string>
 */
export function getAppLogNames(): Array<string> {
    return Object.values(logHelper.appLogs);
}

/**
 * @function
 * @description Get the log extension
 * @returns string
 */
export function getlogExtension(): string {
    return logHelper.logExtension;
}
