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

// Map to provide fast lookups for existing functions.
let functionsMap = {};

// We use 0 for the magical parent node.
let currentFunctionId = 1;

// Initialise a new, empty profile and merge everything into this.
let newProfile = {};

// Allow this file to be loaded by others
if (require.main === module) {
  main(process.argv);
}

function main(argv) {

  // Reset globals so this can be run more than once.
  functionsMap = {}
  currentFunctionId = 1;
  newProfile = {
    totalCount: 0,
    "functions": [
      {
        self: 0,
        location: {
          file: "(root)",
        },
        depth: 0,
        children: [],
        count: 0,
      }
    ]
  };

  const inFile = argv[2];
  const outFile = argv[3];
  const perfData = fs.readJSONSync(inFile);

  // TODO - Go through the output in detail and check all the parent/child relationships
  // are correct.

  // Don't think I can quite do this with JSONPath.
  for (const profile of perfData) {
    const existingIdToNewId = [0];
    for (const fn of profile.functions) {
      const parentId = existingIdToNewId[fn.parent];
      newProfile.totalCount += fn.count;
      if (parentId === undefined) {
        console.error(`Found function with a parent we haven't seen yet: ${parentId}. Failing.`);
        process.exit(1);
      }
      const profiledFunction = findOrCreateFn(fn, parentId);
      existingIdToNewId[fn.self] = profiledFunction.self;
    }
  }

  // Start at the root node and total up all the child call counts.
  totalChildCounts(newProfile.functions[0]);

  fs.writeJSONSync(outFile, newProfile, { spaces: 2 });
}

/* Generates a key we can use to lookup this function
 * without doing a linear search of all the functions
 * in newProfile.functions.
 */
function getFunctionKey(fn, parentId) {
  // Parent must be the parent from the *merged* profile tree.
  return `${fn.file}:${fn.name || "-"}:${fn.line}:parent=${parentId}`
}

function findOrCreateFn(fn, parentId) {
  const fnKey = getFunctionKey(fn, parentId)
  let foundFunction = functionsMap[fnKey];
  if (foundFunction === undefined) {
    const depth = newProfile.functions[parentId].depth + 1;
    const newFunction = {
      self: currentFunctionId++,
      parent: parentId,
      location: {
        file: fn.file,
        name: fn.name,
        line: fn.line,
      },
      count: 0,
      depth: depth,
      children: [],
    }
    newProfile.functions[newFunction.self] = newFunction;
    newProfile.functions[parentId].children.push(newFunction.self);
    functionsMap[fnKey] = newFunction;
    foundFunction = newFunction;
  }
  foundFunction.count += fn.count;
  // console.dir(foundFunction.children)
  return functionsMap[fnKey];
}

function totalChildCounts(fn) {
  let total = 0;
  for (const childId of fn.children) {
    const child = newProfile.functions[childId];
    total += totalChildCounts(child);
    total += child.count;
  }
  fn.child_count = total;
  return fn.child_count;
}