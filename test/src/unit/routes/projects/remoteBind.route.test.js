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

describe('remoteBind.route.js', () => {
    suppressLogOutput(RemoteBind);
    describe('getPathsToDelete(existingPathArray, newPathArray)', () => {
        const getPathsToDelete = RemoteBind.__get__('getPathsToDelete');
        it('returns an array of files to be deleted', () => {
            const existingFileArray = ['package.json', 'package.lock'];
            const newFileArray = ['package.json'];
            const filesToDelete = getPathsToDelete(existingFileArray, newFileArray);
            filesToDelete.length.should.equal(1);
            filesToDelete.should.deep.equal(['package.lock']);
        });
        it('returns an empty array of files to be deleted as both existing files are also in the new file array', () => {
            const existingFileArray = ['package.json', 'package.lock'];
            const filesToDelete = getPathsToDelete(existingFileArray, existingFileArray);
            filesToDelete.length.should.equal(0);
            filesToDelete.should.deep.equal([]);
        });
        it('returns an empty array as no files are given', () => {
            const filesToDelete = getPathsToDelete([], []);
            filesToDelete.length.should.equal(0);
            filesToDelete.should.deep.equal([]);
        });
        it('returns an empty array as at least all the new files exist in the existingFileArray', () => {
            const existingFileArray = ['package.json'];
            const newFileArray = ['package.json', 'package.lock'];
            const filesToDelete = getPathsToDelete(existingFileArray, newFileArray);
            filesToDelete.length.should.equal(0);
            filesToDelete.should.deep.equal([]);
        });
        it('returns an empty array as at .odo should not be deleted', () => {
            const existingFileArray = ['package.json', '.odo/test'];
            const newFileArray = ['package.json', 'package.lock'];
            const filesToDelete = getPathsToDelete(existingFileArray, newFileArray);
            filesToDelete.length.should.equal(0);
            filesToDelete.should.deep.equal([]);
        });
        it('returns an empty array as at node_modules should not be deleted', () => {
            const existingFileArray = ['package.json', 'node_modules/test'];
            const newFileArray = ['package.json', 'package.lock'];
            const filesToDelete = getPathsToDelete(existingFileArray, newFileArray);
            filesToDelete.length.should.equal(0);
            filesToDelete.should.deep.equal([]);
        });
        it('returns .odo in the array deleteme/.odo should be deleted as .odo is not top level in this case', () => {
            const existingFileArray = ['package.json', 'deleteme/.odo'];
            const newFileArray = ['package.json', 'package.lock'];
            const filesToDelete = getPathsToDelete(existingFileArray, newFileArray);
            filesToDelete.length.should.equal(1);
            filesToDelete.should.deep.equal(['deleteme/.odo']);
        });
        it('returns an empty array as both existing directories are also in the new directory array', () => {
            const existingDirectoryArray = ['dir/', 'anotherdir/'];
            const filesToDelete = getPathsToDelete(existingDirectoryArray, existingDirectoryArray);
            filesToDelete.length.should.equal(0);
            filesToDelete.should.deep.equal([]);
        });
        it('returns an array of directories to be deleted', () => {
            const existingFileArray = ['dir/', 'dirthatdoesnotexist/'];
            const newFileArray = ['dir/'];
            const directoriesToDelete = getPathsToDelete(existingFileArray, newFileArray);
            directoriesToDelete.length.should.equal(1);
            directoriesToDelete.should.deep.equal(['dirthatdoesnotexist/']);
        });
    });
    describe('getTopLevelDirectories(directoryArray)', () => {
        const getTopLevelDirectories = RemoteBind.__get__('getTopLevelDirectories');
        it('returns the given directories as they are the highest level', () => {
            const directoryArray = ['nondir/', 'dir/something/'];
            const topLevelDirectories = getTopLevelDirectories(directoryArray);
            topLevelDirectories.should.deep.equal(directoryArray);
        });
        it('returns the top level directories when given a list that contains subdirectories', () => {
            const directoryArray = ['nondir/', 'dir/something/', 'dir/something/subdirectory', 'nondir/subdir/subsubdir'];
            const topLevelDirectories = getTopLevelDirectories(directoryArray);
            topLevelDirectories.should.deep.equal(['nondir/', 'dir/something/']);
        });
        it('returns the top level directories when given a list that is not in the order of directory levels', () => {
            const directoryArray = ['dir/something/subdirectory', 'nondir/subdir/subsubdir', 'dir/something/', 'nondir/'];
            const topLevelDirectories = getTopLevelDirectories(directoryArray);
            topLevelDirectories.should.deep.equal(['dir/something/', 'nondir/']);
        });
        it('returns a single top level directory when its duplicated in the list', () => {
            const directoryArray = ['nondir/', 'nondir/', 'nondir/'];
            const topLevelDirectories = getTopLevelDirectories(directoryArray);
            topLevelDirectories.should.deep.equal(['nondir/']);
        });
        it('returns both given directories where one is a prefix other the other', () => {
            const directoryArray = ['some', 'someother'];
            const topLevelDirectories = getTopLevelDirectories(directoryArray);
            topLevelDirectories.should.deep.equal(directoryArray);
        });
        it('returns both given directories where one is a prefix other the other (reverse)', () => {
            const directoryArray = ['someother', 'some'];
            const topLevelDirectories = getTopLevelDirectories(directoryArray);
            topLevelDirectories.should.deep.equal(directoryArray);
        });
        it('returns one directory when one has a trailing slash and the other doesn\'t', () => {
            const directoryArray = ['some/', 'some'];
            const topLevelDirectories = getTopLevelDirectories(directoryArray);
            topLevelDirectories.should.deep.equal(['some/']);
        });
        it('returns one directory when one has a trailing slash and the other doesn\'t (reverse)', () => {
            const directoryArray = ['some', 'some/'];
            const topLevelDirectories = getTopLevelDirectories(directoryArray);
            topLevelDirectories.should.deep.equal(['some']);
        });
    });
    describe('isSubdirectory(dir1, dir2)', () => {
        const isSubdirectory = RemoteBind.__get__('isSubdirectory');
        it('returns true as relative the file paths are equivalent (1)', async() => {
            isSubdirectory('filepath/', 'filepath').should.be.true;
        });
        it('returns true as relative the file paths are equivalent (2)', async() => {
            isSubdirectory('filepath', 'filepath/').should.be.true;
        });
        it('returns true as relative the file paths are equivalent (3)', async() => {
            isSubdirectory('filepath', 'filepath').should.be.true;
        });
        it('returns false as relative the file paths are different (1)', async() => {
            isSubdirectory('filepath', 'filepathextended').should.be.false;
        });
        it('returns false as relative the file paths are different (2)', async() => {
            isSubdirectory('filepathextended', 'filepath').should.be.false;
        });
        it('returns false as relative the file paths are different (3)', async() => {
            isSubdirectory('.filepath', 'filepath').should.be.false;
        });
        it('returns false as a relative path and an absolute path are different', async() => {
            isSubdirectory('/filepath', 'filepath').should.be.false;
        });
        it('returns true as filepath/subdirectory is a subdirectory of filepath', async() => {
            isSubdirectory('filepath/subdirectory', 'filepath').should.be.true;
        });
        it('returns false as filepath is not a subdirectory of filepath/subdirectory', async() => {
            isSubdirectory('filepath', 'filepath/subdirectory').should.be.false;
        });
    });
    describe('deletePathsInArray(directory, arrayOfFiles)', () => {
        const deletePathsInArray = RemoteBind.__get__('deletePathsInArray');
        const testFileArray = ['package.json', 'server.js', 'dir/file', 'dir/anotherfile', 'anotherdir/file'];
        beforeEach(async() => {
            await createFilesFromArray(testDirectory, testFileArray);
        });
        afterEach(() => {
            fs.removeSync(testDirectory);
        });
        it('should delete no files on disk as an empty array is given', async() => {
            assertFilesExist(testDirectory, testFileArray);
            await deletePathsInArray(testDirectory, []);
            assertFilesExist(testDirectory, testFileArray);
        });
        it('should delete all files on disk as the whole testFileArray is given but leave the directory', async() => {
            assertFilesExist(testDirectory, testFileArray);
            await deletePathsInArray(testDirectory, testFileArray);
            assertFilesDoNotExist(testDirectory, testFileArray);
        });
        it('should delete the files in the testFileArray but leave the directories in place', async() => {
            assertFilesExist(testDirectory, testFileArray);
            await deletePathsInArray(testDirectory, testFileArray);
            assertFilesDoNotExist(testDirectory, testFileArray);
            chaiDir(testDirectory).should.not.be.empty;
        });
        it('should delete the directories in an array', async() => {
            assertFilesExist(testDirectory, testFileArray);
            await deletePathsInArray(testDirectory, ['dir', 'anotherdir']);
            fs.pathExistsSync(path.join(testDirectory, 'dir')).should.be.false;
            fs.pathExistsSync(path.join(testDirectory, 'anotherdir')).should.be.false;
            fs.pathExistsSync(path.join(testDirectory, 'package.json')).should.be.true;
        });
    });
    describe('recursivelyListFilesOrDirectories(getDirectories, absolutePath, relativePath)', () => {
        const recursivelyListFilesOrDirectories = RemoteBind.__get__('recursivelyListFilesOrDirectories');
        describe('Get the directories (getDirectories = true)', () => {
            const testDirArray = ['dir', 'dir/dirinanother', 'dir/dirinanother/anotherdirinanother', 'anotherdir', 'finaldir', 'finaldir/dirwithinfinal'];
            const testFileArray = ['dir/file', 'dir/anotherfile', 'dir/dirinanother/file', 'dir/dirinanother/anotherdirinanother/file', 'anotherdir/file', 'anotherdir/anotherfile', 'finaldir/dirwithinfinal/file'];
            beforeEach(async() => {
                const promiseArray = testFileArray.map(file => {
                    return fs.ensureFile(path.join(testDirectory, file));
                });
                await Promise.all(promiseArray);
            });
            afterEach(() => {
                fs.removeSync(testDirectory);
            });
            it('should recursively list all directories in testFileArray', async() => {
                const filesInDirectory = await recursivelyListFilesOrDirectories(true, testDirectory, '');
                filesInDirectory.length.should.equal(testDirArray.length);
                filesInDirectory.should.have.members(testDirArray);
            });
            it('should recursively list all directories in directory testDirectory/dir', async() => {
                const filesInDirectory = await recursivelyListFilesOrDirectories(true, path.join(testDirectory, 'dir'), '');
                filesInDirectory.length.should.equal(2);
                filesInDirectory.should.have.members(['dirinanother', 'dirinanother/anotherdirinanother']);
            });
            it('should be rejected as directory does not exist', () => {
                return recursivelyListFilesOrDirectories(true, '', '').should.be.rejected;
            });
            it('should return an empty array as there are no subdirectories', async() => {
                const filesInDirectory = await recursivelyListFilesOrDirectories(true, path.join(testDirectory, 'anotherdir'), '');
                filesInDirectory.length.should.equal(0);
                filesInDirectory.should.have.members([]);
            });
        });
        describe('Get the files (getDirectories = false)', () => {
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
                const filesInDirectory = await recursivelyListFilesOrDirectories(false, testDirectory, '');
                filesInDirectory.length.should.equal(testFileArray.length);
                filesInDirectory.should.have.members(testFileArray);
            });
            it('should recursively list all files in directory testDirectory/anotherdir', async() => {
                const filesInDirectory = await recursivelyListFilesOrDirectories(false, path.join(testDirectory, 'anotherdir'), '');
                filesInDirectory.length.should.equal(2);
                filesInDirectory.should.have.members(['file', 'anotherfile']);
            });
            it('should recursively list all files in directory testDirectory/dir (two levels of recursion)', async() => {
                const filesInDirectory = await recursivelyListFilesOrDirectories(false, path.join(testDirectory, 'dir'), '');
                filesInDirectory.length.should.equal(3);
                filesInDirectory.should.have.members(['file', 'anotherfile', 'dirinanother/file']);
            });
            it('should be rejected as directory does not exist', () => {
                return recursivelyListFilesOrDirectories(false, '', '').should.be.rejected;
            });
            it('returns an array which equals testFileArray as all the files should be listed in the directory', async() => {
                const filesInDirectory = await recursivelyListFilesOrDirectories(false, path.join(testDirectory, 'dir/dirinanother'));
                filesInDirectory.length.should.equal(1);
                filesInDirectory.should.have.members(['file']);
            });
        });
    });
    describe('fileIsProtected(filePath)', () => {
        const fileIsProtected = RemoteBind.__get__('fileIsProtected');
        it('should return true when file is inside .odo dir', () => {
            const filePath = '.odo/test';
            const isProtected = fileIsProtected(filePath);
            isProtected.should.equal(true);
        });
        it('should return true when file is inside .odo dir', () => {
            const filePath = 'node_modules/test';
            const isProtected = fileIsProtected(filePath);
            isProtected.should.equal(true);
        });
        it('should return false when file is not inside a protected dir', () => {
            const filePath = 'src/test';
            const isProtected = fileIsProtected(filePath);
            isProtected.should.equal(false);
        });
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