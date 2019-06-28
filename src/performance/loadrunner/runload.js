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
const loadtest = require('loadtest');

if(process.argv.length <= 2) {
    console.log("Options needed, got " + JSON.stringify(process.argv))
    process.exit(1);
}
try {
    let options = JSON.parse(process.argv[2])
    // do some validation?
    loadtest.loadTest(options, function(error, result) {
        if (error) {
            console.error('Load test return an error: %s', error);
            process.exit(1);
        }
        console.log(result);
    });
} catch (err) {
    console.error(err);
    process.exit(1);
}