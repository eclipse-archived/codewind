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
import { expect } from "chai";

import * as genericLib from "../../../lib/generic";
import { logMsg } from "../../../lib/utils";

export default class LocaleTest {
  testName: string;

  constructor(testName: string) {
      this.testName = testName;
  }

  run(runOnly?: boolean): void {
    (runOnly ? describe.only : describe)(this.testName, () => {
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
        it(combo + " => " + "locale: " + combinations[combo]["locale"], async () => {
          logMsg(this.testName, "it", `Beginning locale test for ${combo}`);

          const info = await genericLib.setLocale(combinations[combo]["locale"]);
          logMsg(this.testName, "info", `Recieved locale information: ${JSON.stringify(info)}`);
          expect(info).to.deep.equal(combinations[combo]["result"]);

          logMsg(this.testName, "it", `Ending locale test for ${combo}`);
        });
      }
    });
  }
}
