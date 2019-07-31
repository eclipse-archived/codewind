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

import * as genericLib from "../../../lib/generic";
import { fail } from "assert";

export default class LoggingTest {
    run(): void {
        const logLevels = ["info", "warn", "error", "trace", "debug", "invalid"];
        const invalidLevel = _.cloneDeep(logLevels).pop();

        for (const level of logLevels) {
            it(`set logging level to ${level}`, async () => {
                try {
                    await genericLib.setLoggingLevel(level);
                } catch (err) {
                    if (level === invalidLevel) {
                        expect(err);
                        expect(err.message).to.equal(`${level} is not a valid value, the following log levels are available {"error":"error","warn":"warn","info":"info","debug":"debug","trace":"trace"}`);
                    } else {
                        fail(`setting log level test failed when setting it to ${level}`);
                    }
                }
            });
        }

        this.afterAllHook();
    }

    private afterAllHook(): void {
        after("reset log level to info", async () => {
            await genericLib.setLoggingLevel("info");
        });
    }
}
