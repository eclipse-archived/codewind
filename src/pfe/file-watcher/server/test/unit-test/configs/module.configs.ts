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
import { projectStatusControllerTestModule } from "../tests/projectStatusController.test";
import { projectsControllerTestModule } from "../tests/projectsController.module.test";
import { actionsTestModule } from "../tests/actions.module.test";
import { projectExtensionsTestModule } from "../tests/projectExtensions.module.test";
import { projectUtilTestModule } from "../tests/projectUtil.module.test";
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

const workspaceSettingsModule: ModuleExtension = {
    moduleName: "workspaceSettings",
    moduleFunc: workspaceSettingsTestModule
};

const projectSettingsModule: ModuleExtension = {
    moduleName: "projectSettings",
    moduleFunc: projectSettingsTestModule
};

const projectStatusControllerModule: ModuleExtension = {
    moduleName: "projectStatusController",
    moduleFunc: projectStatusControllerTestModule
};

const projectControllerModule: ModuleExtension = {
    moduleName: "projectsController",
    moduleFunc: projectsControllerTestModule
};

const actionsModule: ModuleExtension = {
    moduleName: "actions",
    moduleFunc: actionsTestModule
};

const projectExtensionsModule: ModuleExtension = {
    moduleName: "projectExtensions",
    moduleFunc: projectExtensionsTestModule
};

const projectUtilModule: ModuleExtension = {
    moduleName: "projectUtil",
    moduleFunc: projectUtilTestModule
};

export const moduleLists: Array<ModuleExtension> = [logHelperModule,
                                                    utilsModule,
                                                    localeModule,
                                                    workspaceSettingsModule,
                                                    projectSettingsModule,
                                                    projectStatusControllerModule,
                                                    projectControllerModule,
                                                    actionsModule,
                                                    projectExtensionsModule,
                                                    projectUtilModule];
