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
const deepEqualInAnyOrder = require('deep-equal-in-any-order');

const sharedFunctions = rewire('../../../../../src/pfe/portal/modules/utils/sharedFunctions');

const { suppressLogOutput } = require('../../../../modules/log.service');

chai.use(chaiAsPromised);
chai.use(deepEqualInAnyOrder);
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
    describe('convertFromWindowsDriveLetter(absolutePath)', () => {
        it('returns a converted linux path from a windows path', () => {
            const filePath = 'C:\\folder\\anotherfolder\\javaproject';
            const convertedPath = sharedFunctions.convertFromWindowsDriveLetter(filePath);
            convertedPath.should.equal('/c/folder/anotherfolder/javaproject');
        });
        it('returns the original linux path', () => {
            const filePath = '/some/random/path';
            const convertedPath = sharedFunctions.convertFromWindowsDriveLetter(filePath);
            convertedPath.should.equal(filePath);
        });
    });
    describe('isWindowsAbsolutePath(absolutePath)', () => {
        it('returns true as filePath is windows', () => {
            const filePath = 'C:\\folder\\anotherfolder\\javaproject';
            const isWindowsPath = sharedFunctions.isWindowsAbsolutePath(filePath);
            isWindowsPath.should.be.true;
        });
        it('returns false as filePath is linux', () => {
            const filePath = '/some/random/path';
            const isWindowsPath = sharedFunctions.isWindowsAbsolutePath(filePath);
            isWindowsPath.should.be.false;
        });
        it('returns false as filePath is not absolute', () => {
            const filePath = '..\\Publications\\TravelBrochure.pdf';
            const isWindowsPath = sharedFunctions.isWindowsAbsolutePath(filePath);
            isWindowsPath.should.be.false;
        });
    });
    describe('recursivelyListFilesOrDirectories', function() {
        const { recursivelyListFilesOrDirectories } = sharedFunctions;
        const testDir = path.join(testDirectory, 'recursivelyListFilesOrDirectories');
        describe('when getDirectories is true', function() {
            beforeEach(function() {
                fs.ensureDirSync(testDir);
            });
            afterEach(function() {
                fs.removeSync(testDir);
            });
            it('returns an empty array when only files and no directories exist', async function() {
                await createFilesFromArray(testDir, ['file1', 'file2', 'file3']);
                const dirs = await recursivelyListFilesOrDirectories(true, testDir);
                dirs.length.should.equal(0);
            });
            it('returns an empty array the given directory is empty', async function() {
                const dirs = await recursivelyListFilesOrDirectories(true, testDir);
                dirs.length.should.equal(0);
            });
            it('returns an array with 4 elements when the given directory has 2 subdirectories and they have 1 subdirectory each', async function() {
                await createDirectoriesFromArray(testDir, ['dir1/subdir1', 'dir2/subdir2']);
                const dirs = await recursivelyListFilesOrDirectories(true, testDir);
                dirs.length.should.equal(4);
                dirs.should.deep.equal([
                    'dir1',
                    'dir1/subdir1',
                    'dir2',
                    'dir2/subdir2',
                ]);
            });
        });
        describe('when getDirectories is false', function() {
            beforeEach(function() {
                fs.ensureDirSync(testDir);
            });
            afterEach(function() {
                fs.removeSync(testDir);
            });
            it('returns an empty array when only directories and no files exist', async function() {
                await createDirectoriesFromArray(testDir, ['dir1/subdir1', 'dir2/subdir2']);
                const files = await recursivelyListFilesOrDirectories(false, testDir);
                files.length.should.equal(0);
            });
            it('returns an empty array the given directory is empty', async function() {
                const files = await recursivelyListFilesOrDirectories(false, testDir);
                files.length.should.equal(0);
            });
            it('returns an array of files when files exist in the top level directory and also in subdirectories', async function() {
                const relativeFilePaths = ['file1', 'dir1/file2', 'dir1/dir2/file3'];
                await createFilesFromArray(testDir, relativeFilePaths);
                const files = await recursivelyListFilesOrDirectories(false, testDir);
                files.length.should.equal(3);
                files.should.deep.equalInAnyOrder(relativeFilePaths);
            });
        });
    });
    describe('findFile(fileName, directory)', function() {
        const { findFile } = sharedFunctions;
        const testDir = path.join(testDirectory, 'findFile');
        beforeEach(function() {
            fs.ensureDirSync(testDir);
        });
        afterEach(function() {
            fs.removeSync(testDir);
        });
        it('returns absolute file path when found', async function() {
            const relativeFilePaths = ['file1', 'dir1/file2', 'dir1/dir2/fileToFind'];
            await createFilesFromArray(testDir, relativeFilePaths);
            const file = await findFile('fileToFind', testDir);
            file.should.equal(path.join(testDir, 'dir1/dir2/fileToFind'));
        });
        it('returns null when not found', async function() {
            const relativeFilePaths = ['file1', 'dir1/file2'];
            await createFilesFromArray(testDir, relativeFilePaths);
            const file = await findFile('fileToFind', testDir);
            chai.expect(file).to.equal(null);
        });
    });
});

const createFilesFromArray = (parentDir, fileArray) => {
    return Promise.all(fileArray.map(file => fs.ensureFile(path.join(parentDir, file))));
};

const createDirectoriesFromArray = (parentDir, dirArray) => {
    return Promise.all(dirArray.map(file => fs.ensureDir(path.join(parentDir, file))));
};
