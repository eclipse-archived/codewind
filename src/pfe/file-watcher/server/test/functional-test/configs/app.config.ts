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
import * as path from "path";

const MC_WORKSPACE = "codewind-workspace";

export const microclimateWorkspaceDir =  process.env.CW_WORKSPACE || path.resolve(__dirname, "..", "..", "..", "..", "..", "..", "..", MC_WORKSPACE);
export const microclimateWorkspaceLogsDir =  process.env.CW_LOGS_DIR || path.join(microclimateWorkspaceDir, ".logs");
export const localesDir = process.env.CW_LOCALES_DIR || path.resolve(__dirname, "..", "..", "..", "src", "utils", "locales") + path.sep;
export const fwDataDir = process.env.CW_FWDATA_DIR || path.join(process.env.HOME, "fwdata");
export const projectDataDir = process.env.CW_PROJECTDATA_DIR || path.join(fwDataDir, "projects");

export const projectPrefix = "microclimatetest";
export const projectConfigs = {
    "appSuffix": Date.now(),
    "appDirectory": path.join(microclimateWorkspaceDir, projectPrefix)
};

export const FIXTURES = "idc-fixtures";
export const fixturesDir = path.resolve(__dirname, "..", "..", FIXTURES);

export const projectTypes = ["liberty", "nodejs", "spring", "swift", "docker"];
export const supportedDockerProjects = ["go", "python", "lagom"];
