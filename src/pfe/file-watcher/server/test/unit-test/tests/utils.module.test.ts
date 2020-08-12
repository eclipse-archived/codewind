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
import { expect } from "chai";
import * as path from "path";
import * as fs from "fs";

import * as utils from "../../../../server/src/utils/utils";
import * as projectsController from "../../../../server/src/controllers/projectsController";
import { existsAsync, mkdirAsync } from "../../functional-test/lib/utils";

export function utilsTestModule(): void {
    const testWD = __dirname;
    describe("combinational testing of asyncFileExists function", () => {
        const testFile = "1234";
        const testDir = "abcd";
        const folderpath = path.join(testWD, testDir);
        const filePath = path.resolve(folderpath, testFile);
        before("create a test directory with some files", async () => {
            if (!(await existsAsync(folderpath))) {
                await mkdirAsync(folderpath);
            }
            expect(fs.statSync(folderpath)).to.exist;
            fs.writeFileSync(filePath, "some data");
            expect(fs.statSync(filePath)).to.exist;
        });

        after("remove the test directory", async () => {
            await projectsController.deleteFolder(folderpath);
            try {
                fs.statSync(folderpath);
            } catch (err) {
                expect(err.code).to.equal("ENOENT");
            }
        });

        const combinations: any = {
            "combo1": {
                "file": "non-existFile",
                "result": false
            },
            "combo2": {
                "file": undefined,
                "result": false
            },
            "combo3": {
                "file": filePath,
                "result": true
            },
            "combo4": {
                "file": folderpath,
                "result": true
            },
        };

        for (const combo of Object.keys(combinations)) {
            const file = combinations[combo]["file"];
            const expectedResult = combinations[combo]["result"];

            it(combo + " => file: " + file , async() => {
                const actualResult = await utils.asyncFileExists(file);
                expect(actualResult).to.equal(expectedResult);
            });
        }
    });


    describe("combinational testing of asyncIsDirectory function", () => {
        const testFile = "1234";
        const testDir = "abcd";
        const folderpath = path.join(testWD, testDir);
        const filePath = path.resolve(folderpath, testFile);
        before("create a test directory with some files", async () => {
            if (!(await existsAsync(folderpath))) {
                await mkdirAsync(folderpath);
            }
            expect(fs.statSync(folderpath)).to.exist;
            fs.writeFileSync(filePath, "some data");
            expect(fs.statSync(filePath)).to.exist;
        });

        after("remove the test directory", async () => {
            await projectsController.deleteFolder(folderpath);
            try {
                fs.statSync(folderpath);
            } catch (err) {
                expect(err.code).to.equal("ENOENT");
            }
        });

        const combinations: any = {
            "combo1": {
                "file": undefined,
                "result": false
            },
            "combo2": {
                "file": filePath,
                "result": false
            },
            "combo3": {
                "file": folderpath,
                "result": true
            },
        };

        for (const combo of Object.keys(combinations)) {
            const file = combinations[combo]["file"];
            const expectedResult = combinations[combo]["result"];

            it(combo + " => file: " + file , async() => {
                const actualResult = await utils.asyncIsDirectory(file);
                expect(actualResult).to.equal(expectedResult);
            });
        }
    });

    describe("combinational testing of asyncReadDir function", () => {
        const testFile1 = "1234";
        const testFile2 = "5678";
        const testDir = "abcd";
        const folderpath = path.join(testWD, testDir);
        const filePath1 = path.resolve(folderpath, testFile1);
        const filePath2 = path.resolve(folderpath, testFile2);
        before("create a test directory with some files", async () => {
            if (!(await existsAsync(folderpath))) {
                await mkdirAsync(folderpath);
            }
            expect(fs.statSync(folderpath)).to.exist;
            fs.writeFileSync(filePath1, "some data");
            expect(fs.statSync(filePath1)).to.exist;
            fs.writeFileSync(filePath2, "some data");
            expect(fs.statSync(filePath2)).to.exist;
        });

        after("remove the test directory", async () => {
            await projectsController.deleteFolder(folderpath);
            try {
                fs.statSync(folderpath);
            } catch (err) {
                expect(err.code).to.equal("ENOENT");
            }
        });

        const combinations: any = {
            "combo1": {
                "file": undefined,
                "result": undefined
            },
            "combo2": {
                "file": "non-existDir",
                "result": undefined
            },
            "combo3": {
                "file": folderpath,
                "result": ["1234", "5678"]
            },
        };

        for (const combo of Object.keys(combinations)) {
            const file = combinations[combo]["file"];
            const expectedResult = combinations[combo]["result"];

            it(combo + " => file: " + file , async() => {
                const actualResult = await utils.asyncReadDir(file);
                expect(actualResult).to.deep.equal(expectedResult);
            });
        }
    });


    describe("combinational testing of asyncCopyDir function", () => {
        const testParentDir = "abcd";
        const testChildDir = "efgh";
        const parentfolderpath = path.join(testWD, testParentDir);
        const childfolderpath = path.join(parentfolderpath, testChildDir);

        before("create test directories", async () => {
            if (!(await existsAsync(parentfolderpath))) {
                await mkdirAsync(parentfolderpath);
            }
            expect(fs.statSync(parentfolderpath)).to.exist;

            if (!(await existsAsync(childfolderpath))) {
                await mkdirAsync(childfolderpath);
            }
            expect(fs.statSync(childfolderpath)).to.exist;
        });

        after("remove the test directories", async () => {
            await projectsController.deleteFolder(parentfolderpath);
            try {
                fs.statSync(parentfolderpath);
            } catch (err) {
                expect(err.code).to.equal("ENOENT");
            }
            const copiedFolder = path.join(testWD, testChildDir);
            await projectsController.deleteFolder(copiedFolder);
            try {
                fs.statSync(copiedFolder);
            } catch (err) {
                expect(err.code).to.equal("ENOENT");
            }
        });

        const combinations: any = {
            "combo1": {
                "src": undefined,
                "destination": undefined,
                "result": false
            },
            "combo2": {
                "src": "non-existDir",
                "destination": undefined,
                "result": false
            },
            "combo3": {
                "src": parentfolderpath,
                "destination": testWD,
                "result": true
            },
        };

        for (const combo of Object.keys(combinations)) {
            const src = combinations[combo]["src"];
            const destination = combinations[combo]["destination"];
            const expectedResult = combinations[combo]["result"];

            it(combo + " => src: " + src + ", destination: " + destination, async() => {
                const actualResult = await utils.asyncCopyDir(src, destination);
                expect(actualResult).to.equal(expectedResult);
                if ( actualResult === true ) {
                    const copiedPath = path.join(destination, testChildDir);
                    const pathExist = await utils.asyncFileExists(copiedPath);
                    expect(pathExist).to.equal(true);
                }
            });
        }
    });

    describe("combinational testing of asyncCopyFile function", () => {
        const testParentDir = "abcd";
        const testChildDir = "efgh";
        const testFile = "1234";
        const parentfolderpath = path.join(testWD, testParentDir);
        const childfolderpath = path.join(parentfolderpath, testChildDir);
        const filePath = path.resolve(parentfolderpath, testFile);
        const destFilePath = path.resolve(childfolderpath, testFile);

        before("create test directories with some files", async () => {
            if (!(await existsAsync(parentfolderpath))) {
                await mkdirAsync(parentfolderpath);
            }
            expect(fs.statSync(parentfolderpath)).to.exist;
            fs.writeFileSync(filePath, "some data");
            expect(fs.statSync(filePath)).to.exist;
            if (!(await existsAsync(childfolderpath))) {
                await mkdirAsync(childfolderpath);
            }
            expect(fs.statSync(childfolderpath)).to.exist;
        });

        after("remove the test directory", async () => {
            await projectsController.deleteFolder(parentfolderpath);
            try {
                fs.statSync(parentfolderpath);
            } catch (err) {
                expect(err.code).to.equal("ENOENT");
            }
        });

        const combinations: any = {
            "combo1": {
                "file": undefined,
                "destination": undefined,
                "result": false
            },
            "combo2": {
                "file": "non-existFile",
                "destination": undefined,
                "result": false
            },
            "combo3": {
                "file": filePath,
                "destination": destFilePath,
                "result": true
            },
        };

        for (const combo of Object.keys(combinations)) {
            const file = combinations[combo]["file"];
            const destination = combinations[combo]["destination"];
            const expectedResult = combinations[combo]["result"];

            it(combo + " => file: " + file  + ", destination: " + destination , async() => {
                const actualResult = await utils.asyncCopyFile(file, destination);
                expect(actualResult).to.equal(expectedResult);
                if ( actualResult === true ) {
                    const pathExist = await utils.asyncFileExists(destFilePath);
                    expect(pathExist).to.equal(true);
                }
            });
        }
    });


    describe("combinational testing of asyncReadJSONFile function", () => {
        const testFile = "1234";
        const invalidJsonFile = "5678";
        const filePath = path.resolve(testWD, testFile);
        const invalidJsonFilePath = path.resolve(testWD, invalidJsonFile);

        before("create test file", async () => {
            fs.writeFileSync(filePath, '{ "test": "data" }');
            expect(fs.statSync(filePath)).to.exist;
            fs.writeFileSync(invalidJsonFile, '{ "test": "data"');
            expect(fs.statSync(invalidJsonFilePath)).to.exist;
        });

        after("remove the test file", async () => {
            fs.unlinkSync(filePath);
            fs.unlinkSync(invalidJsonFilePath);
            try {
                fs.statSync(filePath);
                fs.statSync(invalidJsonFilePath);
            } catch (err) {
                expect(err.code).to.equal("ENOENT");
            }
        });

        const combinations: any = {
            "combo1": {
                "file": undefined,
                "result": undefined
            },
            "combo2": {
                "file": "non-existFile",
                "result": undefined
            },
            "combo3": {
                "file": filePath,
                "result": "data"
            },
            "combo4": {
                "file": invalidJsonFilePath,
                "result": undefined
            },
        };
        for (const combo of Object.keys(combinations)) {
            const file = combinations[combo]["file"];
            const expectedResult = combinations[combo]["result"];
            it(combo + " => file: " + file , async() => {
                const actualResult = await utils.asyncReadJSONFile(file);
                expect(actualResult.test).to.equal(expectedResult);
            });
        }
    });

    describe("getProjectNameFromPath", () => {
        const tests = [
            {
                title: "should return 'projectName' when it's the directory after 'codewind-workspace'",
                path: '/codewind-workspace/projectName',
                want: 'projectName',
            },
            {
                title: "should return 'projectName' when the path is normalized",
                path: path.resolve('/codewind-workspace/projectName'),
                want: 'projectName',
            },
            {
                title: "should return 'projectName' when subdirectories are given",
                path: path.resolve('/codewind-workspace/projectName/templates/default'),
                want: 'projectName',
            },
            {
                title: "returns 'finalDir' as 'codewind-workspace' isn't in the path",
                path: path.resolve('/projectName/templates/default/finalDir'),
                want: 'finalDir',
            },
        ];
        tests.forEach(({ title, path, want }) => {
            it(`should return '${want}' when the input is '${path}'`, () => {
                const got = utils.getProjectNameFromPath(path);
                expect(got).to.equal(want);
            });
        });
    });

}
