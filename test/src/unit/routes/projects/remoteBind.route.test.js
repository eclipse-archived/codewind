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
const assert = require('assert');
const path = require('path');
const rewire = require('rewire');
const chai = require('chai');
const chaiFiles = require('chai-files');
const chaiPromise = require('chai-as-promised');

const RemoteBind = rewire('../../../../../src/pfe/portal/routes/projects/remoteBind.route');

const { suppressLogOutput } = require('../../../../modules/log.service');

chai.should();
chai.use(chaiFiles);
chai.use(chaiPromise);
const { expect } = chai;
const { file: chaiFile, dir: chaiDir } = chaiFiles;

const testDirectory = path.join(__dirname, 'remoteBindRouteTest');

describe('remoteBind.route.test.js', () => {
    suppressLogOutput(RemoteBind);
    describe('getFilesToDelete(existingFileArray, newFileArray)', () => {
        const getFilesToDelete = RemoteBind.__get__('getFilesToDelete');
        it('returns an array of files to be deleted', () => {
            const existingFileArray = ['package.json', 'package.lock'];
            const newFileArray = ['package.json'];
            const filesToDelete = getFilesToDelete(existingFileArray, newFileArray);
            filesToDelete.length.should.equal(1);
            filesToDelete.should.deep.equal(['package.lock']);
        });
        it('returns an empty array of files to be deleted as both existing files are also in the new file array', () => {
            const existingFileArray = ['package.json', 'package.lock'];
            const filesToDelete = getFilesToDelete(existingFileArray, existingFileArray);
            filesToDelete.length.should.equal(0);
            filesToDelete.should.deep.equal([]);
        });
        it('returns an empty array as no files are given', () => {
            const filesToDelete = getFilesToDelete([], []);
            filesToDelete.length.should.equal(0);
            filesToDelete.should.deep.equal([]);
        });
        it('returns an empty array as atleast all the new files exist in the existingFileArray', () => {
            const existingFileArray = ['package.json'];
            const newFileArray = ['package.json', 'package.lock'];
            const filesToDelete = getFilesToDelete(existingFileArray, newFileArray);
            filesToDelete.length.should.equal(0);
            filesToDelete.should.deep.equal([]);
        });
    });
    describe('deleteFilesInArray(arrayOfFiles)', () => {
        const deleteFilesInArray = RemoteBind.__get__('deleteFilesInArray');
        const testFileArray = ['package.json', 'server.js', 'dir/file', 'dir/anotherfile', 'anotherdir/file'];
        beforeEach(async() => {
            const promiseArray = testFileArray.map(file => {
                return fs.ensureFile(path.join(testDirectory, file));
            });
            await Promise.all(promiseArray);
        });
        afterEach(() => {
            fs.removeSync(testDirectory);
        });
        it('should delete no files on disk as an empty array is given', () => {
            assertFilesExist(testDirectory, testFileArray);
            deleteFilesInArray(testDirectory, []);
            assertFilesExist(testDirectory, testFileArray);
        });
        it('should delete all files on disk as the whole testFileArray is given but leave the directory', async() => {
            assertFilesExist(testDirectory, testFileArray);
            await deleteFilesInArray(testDirectory, testFileArray);
            assertFilesDoNotExist(testDirectory, testFileArray);
        });
    });
    describe('listFiles(absolutePath, relativePath)', () => {
        const listFiles = RemoteBind.__get__('listFiles');
        const testFileArray = ['dir/file', 'dir/anotherfile', 'dir/dirinanother/file', 'anotherdir/file', 'anotherdir/anotherfile'];
        beforeEach(async() => {
            const promiseArray = testFileArray.map(file => {
                return fs.ensureFile(path.join(testDirectory, file));
            });
            await Promise.all(promiseArray);
        });
        afterEach(() => {
            fs.removeSync(testDirectory);
        });
        it('should recursively list all files in testFileArray', async() => {
            const filesInDirectory = await listFiles(testDirectory, '');
            filesInDirectory.length.should.equal(testFileArray.length);
            filesInDirectory.should.have.members(testFileArray);
        });
        it('should recursively list all files in directory testDirectory/anotherdir', async() => {
            const filesInDirectory = await listFiles(path.join(testDirectory, 'anotherdir'), '');
            filesInDirectory.length.should.equal(2);
            filesInDirectory.should.have.members(['file', 'anotherfile']);
        });
        it('should recursively list all files in directory testDirectory/dir (two levels of recursion)', async() => {
            const filesInDirectory = await listFiles(path.join(testDirectory, 'dir'), '');
            filesInDirectory.length.should.equal(3);
            filesInDirectory.should.have.members(['file', 'anotherfile', 'dirinanother/file']);
        });
        it('should be rejected as directory does not exist', () => {
            return listFiles('', '').should.be.rejected;
        });
    });
    describe('listFilesInDirectory(absolutePathToDirectory)', () => {
        const listFilesInDirectory = RemoteBind.__get__('listFilesInDirectory');
        before(() => {
            fs.ensureFileSync(path.join(testDirectory, 'file'));
        });
        after(() => {
            fs.removeSync(testDirectory);
        });
        it('returns an array which equals testFileArray as all the files should be listed in the directory', async() => {
            const filesInDirectory = await listFilesInDirectory(testDirectory);
            filesInDirectory.length.should.equal(1);
            filesInDirectory.should.have.members(['file']);
        });
        it('should be rejected as directory does not exist', () => {
            return listFilesInDirectory('').should.be.rejected;
        });
    });
});

// // Function to check if an array of files exist
// // Throws an assertion error if a file does not exist
// function checkFilesExistInDirectory(directory, fileArray) {
//     const arrayOfFilesThatDoNotExist = [];
//     for (let i = 0; i < fileArray.length; i++) {
//         const relativePath = fileArray[i];
//         const absolutePath = path.join(directory, relativePath);
//         if (!fs.pathExistsSync(absolutePath)) {
//             arrayOfFilesThatDoNotExist.push(relativePath);
//         }
//     }
//     if (arrayOfFilesThatDoNotExist.length > 0) {
//         assert.fail(`expected files [${arrayOfFilesThatDoNotExist.join(', ')}] to exist in directory ${directory}`);
//         return false;
//     }
//     return true;
// }

function assertFilesExist(directory, fileArray) {
    for (let i = 0; i < fileArray.length; i++) {
        const relativePath = fileArray[i];
        const absolutePath = path.join(directory, relativePath);
        chaiFile(absolutePath).should.exist;
    }
}

function assertFilesDoNotExist(directory, fileArray) {
    for (let i = 0; i < fileArray.length; i++) {
        const relativePath = fileArray[i];
        const absolutePath = path.join(directory, relativePath);
        chaiFile(absolutePath).should.not.exist;
    }
}