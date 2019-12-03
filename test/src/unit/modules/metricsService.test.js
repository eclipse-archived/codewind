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
const chai = require('chai');
const chaiAsPromised = require('chai-as-promised');
const deepEqualInAnyOrder = require('deep-equal-in-any-order');
const fs = require('fs-extra');
const path = require('path');
const rewire = require('rewire');
const xml2js = require('xml2js');

const { suppressLogOutput } = require('../../../modules/log.service');

const metricsService = rewire('../../../../src/pfe/portal/modules/metricsService');

chai.use(chaiAsPromised);
chai.use(deepEqualInAnyOrder);
chai.should();

const deepClone = (obj) => JSON.parse(JSON.stringify(obj));

describe('metricsService.js', () => {
    suppressLogOutput(metricsService);

    const projectDir = path.join('.', 'src', 'unit', 'modules', 'test');

    // nodejs
    const pathToPackageJson = path.join(projectDir, 'package.json');
    const pathToBackupPackageJson = path.join(projectDir, 'backupPackage.json');
    const originalPackageJson = {
        /* eslint-disable quote-props, quotes, comma-dangle */
        "name": "node",
        "version": "1.0.0",
        "description": "A generated IBM Cloud application",
        "scripts": {
            "start": "node $npm_package_config_entrypoint",
            "debug": "node --inspect=0.0.0.0:9229 $npm_package_config_entrypoint"
        },
        "dependencies": {
            "body-parser": "^1.18.3",
            "express": "^4.16.4"
        }
        /* eslint-enable quote-props, quotes, comma-dangle */
    };

    const expectedPackageJson = {
        /* eslint-disable quote-props, quotes, comma-dangle */
        "name": "node",
        "version": "1.0.0",
        "description": "A generated IBM Cloud application",
        "scripts": {
            "start": "node -r appmetrics-codewind/attach $npm_package_config_entrypoint",
            "debug": "node --inspect=0.0.0.0:9229 $npm_package_config_entrypoint"
        },
        "dependencies": {
            "body-parser": "^1.18.3",
            "express": "^4.16.4",
            "appmetrics-codewind": "^0.1.0",
        }
        /* eslint-enable quote-props, quotes, comma-dangle */
    };

    // java
    const pathToTestPomXml = path.join(projectDir, 'pom.xml');
    const pathToTestBackupPomXml = path.join(projectDir, 'backupPom.xml');
    const pathToTestResourcesDir = path.join('.', 'resources', 'metricsService');

    // liberty
    const pathToJvmOptions = path.join(projectDir, 'src', 'main', 'liberty', 'config', 'jvm.options');
    const pathToBackupJvmOptions = path.join(projectDir, 'src', 'main', 'liberty', 'config', 'backupJvm.options');
    const originalJvmOptions = 'foobar';
    const expectedJvmOptions = `${originalJvmOptions}\n-javaagent:resources/javametrics-agent.jar`;

    const pathToPomXmlsForLiberty = path.join(pathToTestResourcesDir, 'liberty', 'pom.xml');
    const pathToOriginalPomXmlForLiberty = path.join(pathToPomXmlsForLiberty, 'without collector.xml');
    const pathToExpectedPomXmlForLiberty = path.join(pathToPomXmlsForLiberty, 'with collector.xml');
    let originalPomXmlForLiberty;
    let expectedPomXmlForLiberty;

    // spring
    const pathToJavaProjectSrcFiles = path.join(projectDir, 'src', 'main', 'java');
    const pathToMainAppClassFile = path.join(pathToJavaProjectSrcFiles, 'application', 'Application.java');
    const pathToBackupMainAppClassFile = path.join(projectDir, 'codewind-backup', 'Application.java');

    const pathToTestResourcesForSpring = path.join(pathToTestResourcesDir, 'spring');

    const pathToMainAppClassFiles = path.join(pathToTestResourcesForSpring, 'Application.java');
    const pathToOriginalMainAppClassFile = path.join(pathToMainAppClassFiles, 'package1', 'without collector.java');
    const pathToExpectedMainAppClassFile = path.join(pathToMainAppClassFiles, 'package1', 'with collector.java');
    const originalMainAppClassFile = fs.readFileSync(pathToOriginalMainAppClassFile, 'utf8');
    const expectedMainAppClassFile = fs.readFileSync(pathToExpectedMainAppClassFile, 'utf8');

    const pathToPomXmlsForSpring = path.join(pathToTestResourcesForSpring, 'pom.xml');
    const pathToOriginalPomXmlForSpring = path.join(pathToPomXmlsForSpring, 'without collector.xml');
    const pathToExpectedPomXmlForSpring = path.join(pathToPomXmlsForSpring, 'with collector.xml');
    let originalPomXmlForSpring;
    let expectedPomXmlForSpring;

    before(async() => {
        originalPomXmlForLiberty = await readXml(pathToOriginalPomXmlForLiberty);
        expectedPomXmlForLiberty = await readXml(pathToExpectedPomXmlForLiberty);

        originalPomXmlForSpring = await readXml(pathToOriginalPomXmlForSpring);
        expectedPomXmlForSpring = await readXml(pathToExpectedPomXmlForSpring);

        // To debug these parsed PomXmls
        // const util = require('util');
        // console.log('expectedPomXmlForLiberty');
        // console.log(util.inspect(expectedPomXmlForLiberty, { showHidden: false, depth: null }));
    });

    describe('injectMetricsCollectorIntoProject(projectType, projectDir)', () => {
        describe(`('nodejs', <goodProjectDir>)`, () => {
            beforeEach(() => {
                fs.outputJSONSync(pathToPackageJson, originalPackageJson);
            });
            afterEach(() => {
                fs.removeSync(projectDir);
            });
            it(`injects metrics collector into the project's package.json, and saves a back up`, async() => {
                await metricsService.injectMetricsCollectorIntoProject('nodejs', projectDir);

                fs.readJSONSync(pathToPackageJson).should.deep.equal(expectedPackageJson);
                fs.readJSONSync(pathToBackupPackageJson).should.deep.equal(originalPackageJson);
            });
        });
        describe(`('liberty', <goodProjectDir>)`, () => {
            beforeEach(() => {
                fs.outputFileSync(pathToTestPomXml, fs.readFileSync(pathToOriginalPomXmlForLiberty));
                fs.outputFileSync(pathToJvmOptions, originalJvmOptions);
            });
            afterEach(() => {
                fs.removeSync(projectDir);
            });
            it(`injects metrics collector into the project's jvm.options and pom.xml, and saves backups`, async() => {
                await metricsService.injectMetricsCollectorIntoProject('liberty', projectDir);

                const outputJvmOptions = fs.readFileSync(pathToJvmOptions, 'utf8');
                outputJvmOptions.should.equal(expectedJvmOptions);
                const outputBackupJvmOptions = fs.readFileSync(pathToBackupJvmOptions, 'utf8');
                outputBackupJvmOptions.should.deep.equal(originalJvmOptions);

                const outputPomXml = await readXml(pathToTestPomXml);
                outputPomXml.should.deep.equalInAnyOrder(expectedPomXmlForLiberty);
                const outputBackupPomXml = await readXml(pathToTestBackupPomXml);
                outputBackupPomXml.should.deep.equal(originalPomXmlForLiberty);
            });
        });
        describe(`('spring', <goodProjectDir>)`, () => {
            beforeEach(() => {
                fs.outputFileSync(pathToTestPomXml, fs.readFileSync(pathToOriginalPomXmlForSpring));
                fs.outputFileSync(pathToMainAppClassFile, originalMainAppClassFile);
            });
            afterEach(() => {
                fs.removeSync(projectDir);
            });
            it(`injects metrics collector into the project's main app class file and pom.xml`, async() => {
                await metricsService.injectMetricsCollectorIntoProject('spring', projectDir);

                const outputClassFile = fs.readFileSync(pathToMainAppClassFile, 'utf8');
                outputClassFile.should.equal(expectedMainAppClassFile);
                const outputBackupClassFile = fs.readFileSync(pathToBackupMainAppClassFile, 'utf8');
                outputBackupClassFile.should.deep.equal(originalMainAppClassFile);

                const outputPomXml = await readXml(pathToTestPomXml);
                outputPomXml.should.deep.equalInAnyOrder(expectedPomXmlForSpring);
                const outputBackupPomXml = await readXml(pathToTestBackupPomXml);
                outputBackupPomXml.should.deep.equal(originalPomXmlForSpring);
            });
        });
        describe(`('unsupportedProjectType', <goodProjectDir>)`, () => {
            beforeEach(() => {
                fs.outputJSONSync(pathToPackageJson, originalPackageJson);
            });
            afterEach(() => {
                fs.removeSync(projectDir);
            });
            it(`throws a useful error`, () => {
                const funcToTest = () => metricsService.injectMetricsCollectorIntoProject('unsupportedProjectType', projectDir);
                return funcToTest().should.be.rejectedWith(`Injection of metrics collector is not supported for projects of type 'unsupportedProjectType'`);
            });
        });
    });

    describe('removeMetricsCollectorFromProject(projectType, projectDir)', () => {
        describe(`('nodejs', <goodProjectDir>)`, () => {
            beforeEach(() => {
                fs.outputJSONSync(pathToPackageJson, expectedPackageJson);
                fs.outputJSONSync(pathToBackupPackageJson, originalPackageJson);
            });
            afterEach(() => {
                fs.removeSync(projectDir);
            });
            it(`removes metrics collector from the project's package.json`, async() => {
                await metricsService.removeMetricsCollectorFromProject('nodejs', projectDir);

                fs.readJSONSync(pathToPackageJson).should.deep.equal(originalPackageJson);
                fs.existsSync(pathToBackupPackageJson).should.be.false;
            });
        });
        describe(`('liberty', <goodProjectDir>)`, () => {
            beforeEach(() => {
                fs.outputFileSync(pathToTestPomXml, fs.readFileSync(pathToExpectedPomXmlForLiberty));
                fs.outputFileSync(pathToTestBackupPomXml, fs.readFileSync(pathToOriginalPomXmlForLiberty));

                fs.outputFileSync(pathToJvmOptions, expectedJvmOptions);
                fs.outputFileSync(pathToBackupJvmOptions, originalJvmOptions);
            });
            afterEach(() => {
                fs.removeSync(projectDir);
            });
            it(`removes metrics collector from the project's jvm.options and pom.xml`, async() => {
                await metricsService.removeMetricsCollectorFromProject('liberty', projectDir);

                const outputJvmOptions = fs.readFileSync(pathToJvmOptions, 'utf8');
                outputJvmOptions.should.equal(originalJvmOptions);
                fs.existsSync(pathToBackupJvmOptions).should.be.false;

                const outputPomXml = await readXml(pathToTestPomXml);
                outputPomXml.should.deep.equal(originalPomXmlForLiberty);
                fs.existsSync(pathToTestBackupPomXml).should.be.false;
            });
        });
        describe(`('spring', <goodProjectDir>)`, () => {
            beforeEach(() => {
                fs.outputFileSync(pathToTestPomXml, fs.readFileSync(pathToExpectedPomXmlForSpring));
                fs.outputFileSync(pathToTestBackupPomXml, fs.readFileSync(pathToOriginalPomXmlForSpring));

                fs.outputFileSync(pathToMainAppClassFile, expectedMainAppClassFile);
                fs.outputFileSync(pathToBackupMainAppClassFile, originalMainAppClassFile);
            });
            afterEach(() => {
                fs.removeSync(projectDir);
            });
            it(`removes metrics collector from the project's main app class file and pom.xml`, async() => {
                await metricsService.removeMetricsCollectorFromProject('spring', projectDir);

                const outputClassFile = fs.readFileSync(pathToMainAppClassFile, 'utf8');
                outputClassFile.should.equal(originalMainAppClassFile);
                fs.existsSync(pathToBackupMainAppClassFile).should.be.false;

                const outputPomXml = await readXml(pathToTestPomXml);
                outputPomXml.should.deep.equal(originalPomXmlForSpring);
                fs.existsSync(pathToTestBackupPomXml).should.be.false;
            });
        });
        describe(`('unsupportedProjectType', <goodProjectDir>)`, () => {
            beforeEach(() => {
                fs.outputJSONSync(pathToPackageJson, expectedPackageJson);
                fs.outputJSONSync(pathToBackupPackageJson, originalPackageJson);
            });
            afterEach(() => {
                fs.removeSync(projectDir);
            });
            it(`throws a useful error`, () => {
                const funcToTest = () => metricsService.removeMetricsCollectorFromProject('unsupportedProjectType', projectDir);
                return funcToTest().should.be.rejectedWith(`Injection of metrics collector is not supported for projects of type 'unsupportedProjectType'`);
            });
        });
    });
    describe('nodejs', () => {
        describe('removeMetricsCollectorFromNodeProject(projectDir)', () => {
            before(() => {
                fs.outputJSONSync(pathToPackageJson, expectedPackageJson);
                fs.outputJSONSync(pathToBackupPackageJson, originalPackageJson);
            });
            after(() => {
                fs.removeSync(projectDir);
            });
            it(`removes metrics collector from the project's package.json`, async() => {
                const funcToTest = metricsService.__get__('removeMetricsCollectorFromNodeProject');
                await funcToTest(projectDir);

                fs.readJSONSync(pathToPackageJson).should.deep.equal(originalPackageJson);
                fs.existsSync(pathToBackupPackageJson).should.be.false;
            });
        });
        describe('injectMetricsCollectorIntoNodeProject(projectDir)', () => {
            describe('package.json does not have metrics injection code', () => {
                before(() => {
                    fs.outputJSONSync(pathToPackageJson, originalPackageJson);
                });
                after(() => {
                    fs.removeSync(projectDir);
                });
                it(`injects metrics collector into the project's package.json, and saves a back up`, async() => {
                    const funcToTest = metricsService.__get__('injectMetricsCollectorIntoNodeProject');
                    await funcToTest(projectDir);

                    fs.readJSONSync(pathToPackageJson).should.deep.equal(expectedPackageJson);
                    fs.readJSONSync(pathToBackupPackageJson).should.deep.equal(originalPackageJson);
                });
            });
            describe('package.json already has metrics injection code', () => {
                before(() => {
                    fs.outputJSONSync(pathToPackageJson, expectedPackageJson);
                });
                after(() => {
                    fs.removeSync(projectDir);
                });
                it(`does not change the project's package.json, but saves a back up`, async() => {
                    const funcToTest = metricsService.__get__('injectMetricsCollectorIntoNodeProject');
                    await funcToTest(projectDir);

                    fs.readJSONSync(pathToPackageJson).should.deep.equal(expectedPackageJson);
                    fs.readJSONSync(pathToBackupPackageJson).should.deep.equal(expectedPackageJson);
                });
            });
        });
        describe('getNewContentsOfPackageJson(originalContents)', () => {
            it(`returns an object representing a package.json injected with metrics collector`, () => {
                const funcToTest = metricsService.__get__('getNewContentsOfPackageJson');
                const output = funcToTest(originalPackageJson);
                output.should.deep.equal(expectedPackageJson);
            });
        });
        describe('getNewStartScript(originalStartScript)', () => {
            const tests = [
                {
                    input: 'node server.js',
                    expectedOutput: 'node -r appmetrics-codewind/attach server.js',
                },
                {
                    input: 'nodemon server.js',
                    expectedOutput: 'nodemon -r appmetrics-codewind/attach server.js',
                },
                {
                    input: 'node -r appmetrics-codewind/attach server.js',
                    expectedOutput: 'node -r appmetrics-codewind/attach server.js',
                },
            ];
            for (const test of tests) {
                describe(test.input, () => { // eslint-disable-line no-loop-func
                    it(`returns ${test.expectedOutput}`, () => {
                        const funcToTest = metricsService.__get__('getNewStartScript');
                        const output = funcToTest(test.input);
                        output.should.deep.equal(test.expectedOutput);
                    });
                });
            }
        });
    });

    describe('liberty', () => {
        describe('injectMetricsCollectorIntoLibertyProject(projectDir)', () => {
            beforeEach(() => {
                fs.outputFileSync(pathToTestPomXml, fs.readFileSync(pathToOriginalPomXmlForLiberty));
                fs.outputFileSync(pathToJvmOptions, originalJvmOptions);
            });
            afterEach(() => {
                fs.removeSync(projectDir);
            });
            it(`injects metrics collector into the project's jvm.options and pom.xml`, async() => {
                const funcToTest = metricsService.__get__('injectMetricsCollectorIntoLibertyProject');
                await funcToTest(projectDir);

                const outputJvmOptions = fs.readFileSync(pathToJvmOptions, 'utf8');
                outputJvmOptions.should.equal(expectedJvmOptions);

                const outputPomXml = await readXml(pathToTestPomXml);
                outputPomXml.should.deep.equalInAnyOrder(expectedPomXmlForLiberty);
            });
        });

        describe('injectMetricsCollectorIntoPomXml(pathToPomXml)', () => {
            beforeEach(() => {
                fs.outputFileSync(pathToTestPomXml, fs.readFileSync(pathToOriginalPomXmlForLiberty));
            });
            afterEach(() => {
                fs.removeSync(projectDir);
            });
            it(`injects metrics collector into the project's pom.xml`, async() => {
                const funcToTest = metricsService.__get__('injectMetricsCollectorIntoPomXml');
                await funcToTest(pathToTestPomXml);

                const outputPomXml = await readXml(pathToTestPomXml);
                outputPomXml.should.deep.equalInAnyOrder(expectedPomXmlForLiberty);
            });
        });

        describe('injectMetricsCollectorIntoJvmOptions(pathToJvmOptions)', () => {
            beforeEach(() => {
                fs.outputFileSync(pathToJvmOptions, originalJvmOptions);
            });
            afterEach(() => {
                fs.removeSync(projectDir);
            });
            it(`injects metrics collector into the project's pom.xml`, async() => {
                const funcToTest = metricsService.__get__('injectMetricsCollectorIntoJvmOptions');
                await funcToTest(pathToJvmOptions);

                const outputJvmOptions = fs.readFileSync(pathToJvmOptions, 'utf8');
                outputJvmOptions.should.equal(expectedJvmOptions);
            });
        });

        describe('getNewContentsOfJvmOptions(originalContents)', () => {
            it('returns an object representing a pom.xml injected with metrics collector', () => {
                const originalJvmOptions = 'foobar';
                const funcToTest = metricsService.__get__('getNewContentsOfJvmOptions');
                const output = funcToTest(originalJvmOptions);
                output.should.equal(expectedJvmOptions);
            });
        });

        describe('getNewContentsOfPomXml(originalContents)', () => {
            it('returns an object representing a pom.xml injected with metrics collector', () => {
                const funcToTest = metricsService.__get__('getNewContentsOfPomXml');
                const output = funcToTest(originalPomXmlForLiberty);
                output.should.deep.equalInAnyOrder(expectedPomXmlForLiberty);
            });
        });

        describe('getNewPomXmlDependencies(originalDependencies)', () => {
            const metricsCollectorDependencies = [
                {
                    groupId: [ 'org.glassfish' ],
                    artifactId: [ 'javax.json' ],
                    version: [ '1.0.4' ],
                    scope: [ 'test' ],
                },
                {
                    groupId: [ 'com.ibm.runtimetools' ],
                    artifactId: [ 'javametrics-agent' ],
                    version: [ '[1.2,2.0)' ],
                    scope: [ 'provided' ],
                },
                {
                    groupId: [ 'com.ibm.runtimetools' ],
                    artifactId: [ 'javametrics-codewind' ],
                    version: [ '[1.2,2.0)' ],
                    scope: [ 'provided' ],
                    type: [ 'war' ],
                },
                {
                    groupId: [ 'com.ibm.runtimetools' ],
                    artifactId: [ 'javametrics-rest' ],
                    version: [ '[1.2,2.0)' ],
                    scope: [ 'provided' ],
                    type: [ 'war' ],
                },
            ];
            describe(`<originalDependencies> don't include javametrics-codewind`, () => {
                it(`returns an object representing pom.xml dependencies injected with metrics collector`, () => {
                    const funcToTest = metricsService.__get__('getNewPomXmlDependencies');
                    const originalDependencies = [];
                    const output = funcToTest(originalDependencies);
                    output.should.have.deep.members([
                        ...originalDependencies,
                        ...metricsCollectorDependencies,
                    ]);
                });
            });
            describe(`<originalDependencies> already include javametrics-codewind`, () => {
                it(`returns an object representing the original pom.xml dependencies`, () => {
                    const funcToTest = metricsService.__get__('getNewPomXmlDependencies');
                    const originalDependencies = deepClone(metricsCollectorDependencies);
                    const output = funcToTest(originalDependencies);
                    output.should.have.deep.members(originalDependencies);
                });
            });
        });
        describe('getNewPomXmlBuildPlugins(originalBuildPlugins)', () => {
            const metricsCollectorExecutions = [
                {
                    execution: [
                        {
                            id: [ 'copy-javametrics-codewind' ],
                            phase: [ 'package' ],
                            goals: [ { goal: [ 'copy-dependencies' ] } ],
                            configuration: [
                                {
                                    stripVersion: [ 'true' ],
                                    outputDirectory: [
                                        '${project.build.directory}/liberty/wlp/usr/servers/defaultServer/dropins',
                                    ],
                                    includeArtifactIds: [ 'javametrics-codewind' ],
                                },
                            ],
                        },
                        {
                            id: [ 'copy-javametrics-rest' ],
                            phase: [ 'package' ],
                            goals: [ { goal: [ 'copy-dependencies' ] } ],
                            configuration: [
                                {
                                    stripVersion: [ 'true' ],
                                    outputDirectory: [
                                        '${project.build.directory}/liberty/wlp/usr/servers/defaultServer/dropins',
                                    ],
                                    includeArtifactIds: [ 'javametrics-rest' ],
                                },
                            ],
                        },
                        {
                            id: [ 'copy-javametrics-agent' ],
                            phase: [ 'package' ],
                            goals: [ { goal: [ 'copy-dependencies' ] } ],
                            configuration: [
                                {
                                    stripVersion: [ 'true' ],
                                    outputDirectory: [
                                        '${project.build.directory}/liberty/wlp/usr/servers/defaultServer/resources/',
                                    ],
                                    includeArtifactIds: [ 'javametrics-agent' ],
                                },
                            ],
                        },
                        {
                            id: [ 'copy-javametrics-asm' ],
                            phase: [ 'package' ],
                            goals: [ { goal: [ 'copy-dependencies' ] } ],
                            configuration: [
                                {
                                    outputDirectory: [
                                        '${project.build.directory}/liberty/wlp/usr/servers/defaultServer/resources/asm',
                                    ],
                                    includeGroupIds: [ 'org.ow2.asm' ],
                                    includeArtifactIds: [ 'asm,asm-commons' ],
                                },
                            ],
                        },
                    ],
                },
            ];
            const metricsCollectorBuildPlugin = {
                groupId: [ 'org.apache.maven.plugins' ],
                artifactId: [ 'maven-dependency-plugin' ],
                version: [ '3.0.1' ],
                executions: metricsCollectorExecutions,
            };
            describe(`<originalBuildPlugins> don't include our metrics collector plugin`, () => {
                it(`returns an object representing pom.xml build plugins including the metrics collector plugin`, () => {
                    const funcToTest = metricsService.__get__('getNewPomXmlBuildPlugins');
                    const originalBuildPlugins = [];
                    const output = funcToTest(originalBuildPlugins);
                    output.should.have.deep.members([
                        ...originalBuildPlugins,
                        metricsCollectorBuildPlugin,
                    ]);
                });
            });
            describe(`<originalBuildPlugins> does include our metrics collector plugin`, () => {
                it(`returns an object representing pom.xml build plugins including the metrics collector plugin`, () => {
                    const funcToTest = metricsService.__get__('getNewPomXmlBuildPlugins');
                    const originalBuildPlugins = [metricsCollectorBuildPlugin];
                    const output = funcToTest(originalBuildPlugins);
                    output.should.have.deep.members(originalBuildPlugins);
                });
            });
            describe(`<originalBuildPlugins> include a plugin with the same name as ours but without build executions`, () => {
                it(`returns an object representing pom.xml build plugins including the metrics collector plugin`, () => {
                    const funcToTest = metricsService.__get__('getNewPomXmlBuildPlugins');
                    const originalBuildPlugins = [{
                        groupId: [ 'org.apache.maven.plugins' ],
                        artifactId: [ 'maven-dependency-plugin' ],
                        version: [ '3.0.1' ],
                        // no executions
                    }];
                    const output = funcToTest(originalBuildPlugins);
                    output.should.have.deep.members([
                        ...originalBuildPlugins,
                        metricsCollectorBuildPlugin,
                    ]);
                });
            });
            describe(`<originalBuildPlugins> include a plugin with the same name as ours but without the correct build executions`, () => {
                it(`returns an object representing pom.xml build plugins including the metrics collector plugin`, () => {
                    const funcToTest = metricsService.__get__('getNewPomXmlBuildPlugins');
                    const originalBuildPlugins = [{
                        groupId: [ 'org.apache.maven.plugins' ],
                        artifactId: [ 'maven-dependency-plugin' ],
                        version: [ '3.0.1' ],
                        executions: [{ execution: [] }],
                    }];
                    const output = funcToTest(originalBuildPlugins);
                    output.should.have.deep.members([
                        ...originalBuildPlugins,
                        metricsCollectorBuildPlugin,
                    ]);
                });
            });
        });
    });
    describe('spring', () => {
        describe('injectMetricsCollectorIntoSpringProject(projectDir)', () => {
            const tests = {
                'main app class file in a dir with a name': {
                    pathToMainAppClassFile: path.join(projectDir, 'src', 'main', 'java', 'application', 'Application.java'),
                },
                'main app class file with different name': {
                    pathToMainAppClassFile: path.join(projectDir, 'src', 'main', 'java', 'application', 'Application2.java'),
                },
                'main app class file in a different dir': {
                    pathToMainAppClassFile: path.join(projectDir, 'src', 'main', 'java', 'Application.java'),
                },
            };
            for (const [testName, test] of Object.entries(tests)) {
                describe(testName, () => { // eslint-disable-line no-loop-func
                    before(() => {
                        fs.outputFileSync(pathToTestPomXml, fs.readFileSync(pathToOriginalPomXmlForSpring));
                        fs.outputFileSync(test.pathToMainAppClassFile, originalMainAppClassFile);
                    });
                    after(() => {
                        fs.removeSync(projectDir);
                    });
                    it(`injects metrics collector into the project's main app class file and pom.xml`, async() => {
                        const funcToTest = metricsService.__get__('injectMetricsCollectorIntoSpringProject');
                        await funcToTest(projectDir);

                        const outputClassFile = fs.readFileSync(test.pathToMainAppClassFile, 'utf8');
                        outputClassFile.should.equal(expectedMainAppClassFile);
                        const outputBackupClassFile = fs.readFileSync(pathToBackupMainAppClassFile, 'utf8');
                        outputBackupClassFile.should.deep.equal(originalMainAppClassFile);

                        const outputPomXml = await readXml(pathToTestPomXml);
                        outputPomXml.should.deep.equalInAnyOrder(expectedPomXmlForSpring);
                        const outputBackupPomXml = await readXml(pathToTestBackupPomXml);
                        outputBackupPomXml.should.deep.equal(originalPomXmlForSpring);
                    });
                });
            }
        });

        describe('getPathToMainAppClassFile(projectDir)', () => {
            describe('<projectDir> contains multiple files', () => {
                beforeEach(() => {
                    fs.outputFileSync(pathToMainAppClassFile, expectedMainAppClassFile);
                    fs.outputFileSync(path.join(pathToJavaProjectSrcFiles, 'second file.java'), 'dummy contents');
                });
                afterEach(() => {
                    fs.removeSync(projectDir);
                });
                it('returns the path to the main app class file', async() => {
                    const funcToTest = metricsService.__get__('getPathToMainAppClassFile');
                    const output = await funcToTest(projectDir);
                    output.should.equal(pathToMainAppClassFile);
                });
            });
        });

        describe('getNewContentsOfMainAppClassFile(originalContents)', () => {
            const tests = {
                'package application': {
                    originalMainAppClassFile,
                    expectedMainAppClassFile,
                },
                'package application2': {
                    originalMainAppClassFile: fs.readFileSync(path.join(pathToMainAppClassFiles, 'package2', 'without collector.java'), 'utf8'),
                    expectedMainAppClassFile: fs.readFileSync(path.join(pathToMainAppClassFiles, 'package2', 'with collector.java'), 'utf8'),
                },
            };
            for (const [testName, test] of Object.entries(tests)) {
                describe(testName, () => { // eslint-disable-line no-loop-func
                    it('returns an object representing an app class file injected with metrics collector', () => {
                        const funcToTest = metricsService.__get__('getNewContentsOfMainAppClassFile');
                        const output = funcToTest(test.originalMainAppClassFile);
                        output.should.deep.equalInAnyOrder(test.expectedMainAppClassFile);
                    });
                });
            }
        });

        describe('getNewContentsOfPomXmlForSpring(originalContents)', () => {
            it('returns an object representing a pom.xml injected with metrics collector', () => {
                const funcToTest = metricsService.__get__('getNewContentsOfPomXmlForSpring');
                const output = funcToTest(originalPomXmlForSpring);
                output.should.deep.equalInAnyOrder(expectedPomXmlForSpring);
            });
        });

        describe('getNewPomXmlDependenciesForSpring(originalDependencies)', () => {
            const metricsCollectorDependencies = [
                {
                    groupId: [ 'com.ibm.runtimetools' ],
                    artifactId: [ 'javametrics-spring' ],
                    version: [ '[1.1,2.0)' ],
                },
                {
                    groupId: [ 'com.ibm.runtimetools' ],
                    artifactId: [ 'javametrics-agent' ],
                    version: [ '[1.1,2.0)' ],
                },
                {
                    groupId: [ 'org.glassfish' ],
                    artifactId: [ 'javax.json' ],
                    version: [ '1.0.4' ],
                },
            ];
            describe(`<originalDependencies> don't include javametrics-spring`, () => {
                it(`returns an object representing pom.xml dependencies injected with metrics collector`, () => {
                    const funcToTest = metricsService.__get__('getNewPomXmlDependenciesForSpring');
                    const originalDependencies = [];
                    const output = funcToTest(originalDependencies);
                    output.should.have.deep.members([
                        ...originalDependencies,
                        ...metricsCollectorDependencies,
                    ]);
                });
            });
            describe(`<originalDependencies> already include javametrics-spring`, () => {
                it(`returns an object representing the original pom.xml dependencies`, () => {
                    const funcToTest = metricsService.__get__('getNewPomXmlDependenciesForSpring');
                    const originalDependencies = deepClone(metricsCollectorDependencies);
                    const output = funcToTest(originalDependencies);
                    output.should.have.deep.members(originalDependencies);
                });
            });
        });

    });
});

async function readXml(pathToXmlFile) {
    const xmlFileData = fs.readFileSync(pathToXmlFile);
    const xmlAsJson = await xml2js.parseStringPromise(xmlFileData);
    return xmlAsJson;
}
