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
const chaiFiles = require('chai-files');
const chaiPromise = require('chai-as-promised');

const RemoteBind = rewire('../../../../../src/pfe/portal/routes/projects/remoteBind.route');

const { suppressLogOutput } = require('../../../../modules/log.service');

chai.should();
chai.use(chaiFiles);
chai.use(chaiPromise);
const { file: chaiFile, dir: chaiDir } = chaiFiles;

const testDirectory = path.join(__dirname, 'remoteBindRouteTest');

describe.only('remoteBind.route.js', () => {
    suppressLogOutput(RemoteBind);
    describe('getFilesToDelete(existingFileArray, newFileArray)', () => {
        const getFilesToDelete = RemoteBind.__get__('getFilesToDelete');
        it('returns an array of files to be deleted', () => {
            const existingFileArray = ['package.json', 'package.lock'];
            const newFileArray = ['package.json'];
            const filesToDelete = getFilesToDelete(existingFileArray, newFileArray);
            filesToDelete.lenlsgth.should.equal(1);
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
    describe('deleteFilesInArray(directory, arrayOfFiles)', () => {
        const deleteFilesInArray = RemoteBind.__get__('deleteFilesInArray');
        const testFileArray = ['package.json', 'server.js', 'dir/file', 'dir/anotherfile', 'anotherdir/file'];
        beforeEach(async() => {
            await createFilesFromArray(testDirectory, testFileArray);
        });
        afterEach(() => {
            fs.removeSync(testDirectory);
        });
        it('should delete no files on disk as an empty array is given', async() => {
            assertFilesExist(testDirectory, testFileArray);
            await deleteFilesInArray(testDirectory, []);
            assertFilesExist(testDirectory, testFileArray);
        });
        it('should delete all files on disk as the whole testFileArray is given but leave the directory', async() => {
            assertFilesExist(testDirectory, testFileArray);
            await deleteFilesInArray(testDirectory, testFileArray);
            assertFilesDoNotExist(testDirectory, testFileArray);
        });
        it('should delete the files in the testFileArray but leave the directories in place', async() => {
            assertFilesExist(testDirectory, testFileArray);
            await deleteFilesInArray(testDirectory, testFileArray);
            assertFilesDoNotExist(testDirectory, testFileArray);
            chaiDir(testDirectory).should.not.be.empty;
        });
    });
    describe('listFilesInDirectory(absolutePath, relativePath)', () => {
        const listFilesInDirectory = RemoteBind.__get__('listFilesInDirectory');
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
            const filesInDirectory = await listFilesInDirectory(testDirectory, '');
            filesInDirectory.length.should.equal(testFileArray.length);
            filesInDirectory.should.have.members(testFileArray);
        });
        it('should recursively list all files in directory testDirectory/anotherdir', async() => {
            const filesInDirectory = await listFilesInDirectory(path.join(testDirectory, 'anotherdir'), '');
            filesInDirectory.length.should.equal(2);
            filesInDirectory.should.have.members(['file', 'anotherfile']);
        });
        it('should recursively list all files in directory testDirectory/dir (two levels of recursion)', async() => {
            const filesInDirectory = await listFilesInDirectory(path.join(testDirectory, 'dir'), '');
            filesInDirectory.length.should.equal(3);
            filesInDirectory.should.have.members(['file', 'anotherfile', 'dirinanother/file']);
        });
        it('should be rejected as directory does not exist', () => {
            return listFilesInDirectory('', '').should.be.rejected;
        });
        it('returns an array which equals testFileArray as all the files should be listed in the directory', async() => {
            const filesInDirectory = await listFilesInDirectory(path.join(testDirectory, 'dir/dirinanother'));
            filesInDirectory.length.should.equal(1);
            filesInDirectory.should.have.members(['file']);
        });
    });
    describe('fileIsProtected(filePath)', () => {
        const fileIsProtected = RemoteBind.__get__('fileIsProtected')
        it('should return true when file is inside .odo dir', () => {
            const filePath = ".odo/test";
            const isProtected = fileIsProtected(filePath);
            isProtected.should.equal(true)
        });
        it('should return true when file is inside .odo dir', () => {
            const filePath = 'node_modules/test'
            const isProtected = fileIsProtected(filePath)
            isProtected.should.equal(true)
        })
        it('should return false when file is not inside a protected dir', () => {
            const filePath = 'src/test';
            const isProtected = fileIsProtected(filePath);
            isProtected.should.equal(true);
        })
    });
});

function createFilesFromArray(directory, fileArray) {
    const promiseArray = fileArray.map(file => {
        return fs.ensureFile(path.join(directory, file));
    });
    return Promise.all(promiseArray);
}

function assertFilesExist(directory, fileArray) {
    for (let i = 0; i < fileArray.length; i++) {
        const relativePath = fileArray[i];
        const absolutePath = path.join(directory, relativePath);
        chaiFile(absolutePath).should.exist;
    }
}

function assertFilesDoNotExist(directory, fileArray) {
    for (const relativePath of fileArray) {
        const absolutePath = path.join(directory, relativePath);
        chaiFile(absolutePath).should.not.exist;
    }
}