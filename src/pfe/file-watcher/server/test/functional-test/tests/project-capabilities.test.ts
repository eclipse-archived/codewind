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
import * as _ from "lodash";

import { getProjectCapabilities } from "../lib/project";

import * as app_configs from "../configs/app.config";

export function projectCapabilityTestSuite(projectType: string, projectID: string): void {
    it("get project capability with undefined project id", async () => {
        const info: any = await getProjectCapabilities(undefined);
        expect(info);
        expect(info.statusCode);
        expect(info.statusCode).to.equal(400);
        expect(info.error);
        expect(info.error).to.have.ownProperty("msg");
        expect(info.error["msg"]).to.equal("Bad request - no project ID specified");
    });

    it("get project capability with defined project id", async () => {
        const info: any = await getProjectCapabilities(projectID);
        expect(info);
        expect(info.statusCode);
        expect(info.statusCode).to.equal(200);
        expect(info.capabilities);
        expect(info.capabilities).to.deep.equal(app_configs.projectCapabilities[projectType]);
    });
}
