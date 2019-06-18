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

import * as utils from "../functional-test/lib/utils";
import * as module_configs from "./configs/module.configs";
// set all the test environmental variables
utils.setTestEnvVariables();

describe("PFE - unit test", () => {
    for (const module of module_configs.moduleLists) {
        describe(module.moduleName + " module", () => {
            module.moduleFunc();
        });
    }
});
