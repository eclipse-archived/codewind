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
global.codewind = { RUNNING_IN_K8S: false };
const fs = require('fs-extra');
const path = require('path');
const rewire = require('rewire');
const chai = require('chai');
const chaiAsPromised = require('chai-as-promised');

const sharedFunctions = rewire('../../../../../src/pfe/portal/modules/utils/sharedFunctions');

const { suppressLogOutput } = require('../../../../modules/log.service');

chai.use(chaiAsPromised);
chai.should();

const testDirectory = path.join(__dirname, 'sharedFunctionsTest');

describe('sharedFunctions.js', () => {
    suppressLogOutput(sharedFunctions);
    describe('forceRemove(path)', () => {
        beforeEach(() => {
            fs.ensureDirSync(testDirectory);
        });
        after(() => {
            fs.removeSync(testDirectory);
        });
        it('deletes a file', async() => {
            const testFile = path.join(testDirectory, 'testFile');
            await fs.ensureFile(testFile);
            await sharedFunctions.forceRemove(testFile);
            return fs.pathExists(testFile).should.eventually.be.false;
        });
        it('deletes a file which has a space in its name', async() => {
            const testFile = path.join(testDirectory, 'test File');
            await fs.ensureFile(testFile);
            await sharedFunctions.forceRemove(testFile);
            return fs.pathExists(testFile).should.eventually.be.false;
        });
        it('deletes an empty folder', async() => {
            const testFile = path.join(testDirectory, 'testDir');
            await fs.ensureDir(testFile);
            await sharedFunctions.forceRemove(testFile);
            return fs.pathExists(testFile).should.eventually.be.false;
        });
        it('deletes an empty folder which has a space in its name', async() => {
            const testFile = path.join(testDirectory, 'test Dir');
            await fs.ensureDir(testFile);
            await sharedFunctions.forceRemove(testFile);
            return fs.pathExists(testFile).should.eventually.be.false;
        });
        it('deletes a folder which has contents', async() => {
            const testFile = path.join(testDirectory, 'testDir/something/file');
            await fs.ensureDir(testFile);
            await sharedFunctions.forceRemove(testFile);
            return fs.pathExists(testFile).should.eventually.be.false;
        });
    });
});