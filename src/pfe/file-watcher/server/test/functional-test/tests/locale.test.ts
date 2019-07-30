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

import * as genericLib from "../lib/generic";

export function localeTestSuite(): void {
    const combinations: any = {
        "combo1": {
          "locale": undefined,
          "result": {"statusCode": 400, "error": {"msg": "Bad request. Locale key not found in request body!"}}
        },
        "combo2": {
          "locale": "some string",
          "result": { "statusCode": 400, "error": { "msg": "Bad request. locale must be an array." }}
        },
        "combo3": {
          "locale": ["en"],
          "result": { statusCode: 200, locale: "en" }
        },
    };

    for (const combo of Object.keys(combinations)) {
        it (combo + " => " + "locale: " + combinations[combo]["locale"], async () => {
          const info = await genericLib.setLocaleAPI(combinations[combo]["locale"]);
          expect(info).to.deep.equal(combinations[combo]["result"]);
        });
    }
}
