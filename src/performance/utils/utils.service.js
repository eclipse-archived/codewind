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
const { promisify } = require('util');

const wait = promisify(setTimeout);
const repetitionInterval = 2000;

// returns a promise that resolves after all of the given promises have either resolved or rejected
// similar to https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Promise/allSettled
const allPromisesSettled = (promises) => Promise.all(
  promises.map(promise =>
    promise.catch(err => console.log(err.message))
  )
);

const repeatFunc = async (func, numRepetitionsRemaining) => {
  await func();
  numRepetitionsRemaining--;
  if (numRepetitionsRemaining > 0) {
    await wait(repetitionInterval);
    await repeatFunc(func, numRepetitionsRemaining);
    return;
  }
}

module.exports = {
  allPromisesSettled,
  repeatFunc,
};
