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

import { logHelperTestModule } from "../tests/logHelper.module.test";
import { utilsTestModule } from "../tests/utils.module.test";
import { localeTestModule } from "../tests/locale.module.test";
import { workspaceSettingsTestModule } from "../tests/workspaceSettings.module.test";
import { projectSettingsTestModule } from "../tests/projectSettings.module.test";
import * as mocha from "mocha";

interface ModuleExtension {
    moduleName: string;
    moduleFunc: () => void;
}

const logHelperModule: ModuleExtension = {
    moduleName: "logHelper",
    moduleFunc: logHelperTestModule
};

const utilsModule: ModuleExtension = {
    moduleName: "utils",
    moduleFunc: utilsTestModule
};

const localeModule: ModuleExtension = {
    moduleName: "locale",
    moduleFunc: localeTestModule
};

const projectSettingsModule: ModuleExtension = {
    moduleName: "projectSettings",
    moduleFunc: projectSettingsTestModule
};

export const moduleLists: Array<ModuleExtension> = [logHelperModule, 
                                                    utilsModule, 
                                                    localeModule,
                                                    workspaceSettingsModule,
                                                    projectSettingsModule];
