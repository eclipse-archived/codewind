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
"use strict";

//------------------------------------------------------------------------------
// Requirements
//------------------------------------------------------------------------------

let rule = require("../../../lib/rules/sanitise-body-parameters"),

  RuleTester = require("eslint").RuleTester;

//------------------------------------------------------------------------------
// Tests
//------------------------------------------------------------------------------

let ruleTester = new RuleTester();
ruleTester.run("santise-body-parameters", rule, {

  // Valid code, should pass linter tests.
  valid: [
    {
      code: "name = req.sanitiseBody('name');",
    },
  ],

  // Invalid code, should be detected by linter.
  invalid: [
    {
      code: "name = req.body.name;",
      errors: [{
        message: "Unsanitised access to request field 'req.body.name'",
        type: "MemberExpression"
      }],
    },
    {
      code: "value = req.body['value'];",
      errors: [{
        message: "Unsanitised access to request field 'req.body.value'",
        type: "MemberExpression"
      }],
    },
    {
      code: "if (req.body.name) { console.log('Foo'); }",
      errors: [{
        message: "Unsanitised access to request field 'req.body.name'",
        type: "MemberExpression"
      }]
    },
    {
      code: "id = req.params.id;",
      errors: [{
        message: "Unsanitised access to request field 'req.params.id'",
        type: "MemberExpression"
      }],
    },
    {
      code: "project = user.projectList.retrieveProject(req.params.id);",
      errors: [{
        message: "Unsanitised access to request field 'req.params.id'",
        type: "MemberExpression"
      }],
    }
  ]
});
