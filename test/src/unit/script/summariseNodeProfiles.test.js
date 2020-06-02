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
const chai = require('chai');
const fs = require('fs-extra');
const path = require('path');
const { promisify } = require('util');
const exec = promisify(require('child_process').exec);

const { testTimeout, TEMP_TEST_DIR } = require('../../../config');

const sampleInputFiles = {
    'Node.js': {
        input: path.join(__dirname, 'node-cw-profile.json'),
        expected: path.join(__dirname, 'node-cw-profile-summary.json'),
    },
};
const scriptPath = path.join(__dirname, '../../../../src/pfe/portal/scripts/summariseProfile.js');

chai.should();

describe('summariseProfile.js', () => {
    
    after(async function() {
        this.timeout(testTimeout.med);
        for (const language in sampleInputFiles) {
            const outputFile = path.join(TEMP_TEST_DIR, `${language}-summary-output.json`);
            await fs.remove(outputFile);
        }
    });

    for (const language in sampleInputFiles) {
        const sampleInputFile = sampleInputFiles[language].input;
        const expectedOutputFile = sampleInputFiles[language].expected;
        it(`Summarise data for a ${language} profile`, async function() { // eslint-disable-line no-loop-func
            this.timeout(testTimeout.short);
            const outputFile = path.join(TEMP_TEST_DIR, `${language}-summary-output.json`);
            const mergeCommand = `${process.execPath} ${scriptPath} ${sampleInputFile} ${outputFile}`;
            await exec(mergeCommand);

            const actual = await fs.readJson(outputFile);
            const expected = await fs.readJson(expectedOutputFile);

            actual.should.deep.equal(expected);
        });
    }
});
