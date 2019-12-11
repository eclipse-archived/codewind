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

if (process.argv.length < 3) {
    printUsage();
}

const option = process.argv[2];

if (option.includes("help") || option == "-h") {
    printUsage();
} else if (option == "encode") {
    if (process.argv.length != 5) {
        printUsage();
    }
    encodeCredentials(process.argv[3], process.argv[4]);
} else if (option == "decode") {
    if (process.argv.length != 4) {
        printUsage();
    }
    decodeCredentials(process.argv[3]);
}

function printUsage() {
    console.log("Turbine Test Utils.js Usage:");
    console.log("   encode <username> <password> - returns the base64 encoded string of { username: \"<username>\", password: \"<password>\" }");
    console.log("   decode <base64 encoded credentials> - returns the base64 decoded string of <base64 encoded credentials>");
    console.log("   -h,--help");
    process.exit(1);
}

function encodeCredentials(username, password) {
    const credentials = { username: username, password: password };
    const credentialsJSON = JSON.stringify(credentials);
    const encodedCredentials = Buffer.from(credentialsJSON).toString("base64");
    console.log(encodedCredentials);
}

function decodeCredentials(encodedString) {
    const decodedCredentials = Buffer.from(encodedString, "base64").toString();
    console.log(decodedCredentials);
}
