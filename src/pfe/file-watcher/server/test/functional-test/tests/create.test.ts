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
import { ProjectCreation, createProject } from "../lib/project-creation";

 export function createTestSuite(projData: ProjectCreation): void {
    it("create project", async () => {
        const info: any = await createProject(projData);
        expect(info).to.exist;
        expect(info.statusCode).to.exist;
        expect(info.statusCode).to.equal(202);
        expect(info.operationId).to.exist;
        expect(info.logs).to.exist;
        expect(info.logs.build).to.exist;
    });
}
