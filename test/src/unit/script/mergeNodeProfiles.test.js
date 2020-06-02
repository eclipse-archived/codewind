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

const sampleInputFile = path.join(__dirname, 'node-profiling.json');
const expectedOutputFile = path.join(__dirname, 'node-cw-profile.json');
const scriptPath = path.join(__dirname, '../../../../src/pfe/portal/scripts/mergeNodeProfiles.js');

chai.should();

describe('mergeNodeProfiles.js', () => {
    const outputFile  = path.join(TEMP_TEST_DIR, 'cw-profile.json');

    after(async function() {
        this.timeout(testTimeout.med);
        await fs.remove(outputFile);
    });

    it('Merge data for a Node.js profile', async function() {
        this.timeout(testTimeout.short);
        const outputFile = path.join(TEMP_TEST_DIR, 'node-merged-output.json');
        const mergeCommand = `${process.execPath} ${scriptPath} ${sampleInputFile} ${outputFile}`;
        await exec(mergeCommand);

        const actual = await fs.readJson(outputFile);
        const expected = await fs.readJson(expectedOutputFile);

        actual.should.deep.equal(expected);
    });

});
