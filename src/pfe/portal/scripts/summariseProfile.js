/*******************************************************************************
 * Copyright (c) 2020 IBM Corporation and others.
 * All rights reserved. This program and the accompanying materials
 * are made available under the terms of the Eclipse Public License v2.0
 * which accompanies this distribution, and is available at
 * http://www.eclipse.org/legal/epl-v20.html
 *
 * Contributors:
 *     IBM Corporation - initial API and implementation
 *******************************************************************************/
// This is a batch script intended to be started and run to completion.
// We can disable the linter rule for no sync functions.
/* eslint-disable no-sync */
"use strict";
const fs = require('fs-extra');

// Create total entries for each function/method (code location/call site)
// but lose the call stack information.

let functionTable = {};

let summary = {}

// Allow this file to be loaded by others
if (require.main === module) {
  main(process.argv);
}

function main(argv) {

  functionTable = {};
  summary = {
    total_count: 0,
    functions: [],
  }
  const inFile = argv[2];
  const outFile = argv[3];
  const profile = fs.readJSONSync(inFile);

  for (const fn of profile.functions) {
    const key = getFunctionKey(fn);
    let functionEntry = functionTable[key];
    if (functionEntry === undefined) {
      functionEntry = {
        self_ids: [],
        location: fn.location,
        total_self_count: 0,
        total_child_count: 0,
      }
      functionTable[key] = functionEntry;
      summary.functions.push(functionEntry);
    }
    functionEntry.self_ids.push(fn.self);
    functionEntry.total_self_count += fn.count;
    functionEntry.total_child_count += fn.child_count;

    // summary_total += fn.count;
  }

  summary.total_count = profile.totalCount;

  // console.dir(summary, {depth: 5});
  // console.log(`Summary.total_count = ${summary_total} profile.total_count = ${profile.totalCount}`);

  fs.writeJSONSync(outFile, summary, { spaces: 2 });
}

/* Generates a key we can use to lookup this function
 * that doesn't depend on it's position in the tree,
 * just the source code.
 */
function getFunctionKey(fn) {
  let fnKey = "";
  // console.dir(fn);
  for (const key of Object.keys(fn.location)) {
    fnKey += fn.location[key] + ":";
  }
  return fnKey;
}