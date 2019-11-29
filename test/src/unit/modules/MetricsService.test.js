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

const metricsService = rewire('../../../../src/pfe/portal/modules/MetricsService');

chai.use(chaiAsPromised);
chai.use(deepEqualInAnyOrder);
chai.should();

const deepClone = (obj) => JSON.parse(JSON.stringify(obj));

describe('MetricsService.js', () => {
    const projectDir = path.join('.', 'src', 'unit', 'modules');

    // nodejs
    const pathToPackageJson = path.join(projectDir, 'package.json');
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
    const pathToTestResourcesDir = path.join('.', 'resources', 'metricsService');

    // liberty
    const pathToJvmOptions = path.join(projectDir, 'src', 'main', 'liberty', 'config', 'jvm.options');
    const originalJvmOptions = 'foobar';
    const expectedJvmOptions = `${originalJvmOptions}\n-javaagent:resources/javametrics-agent.jar`;

    const pathToPomXmlsForLiberty = path.join(pathToTestResourcesDir, 'liberty', 'pom.xml');
    const pathToOriginalPomXmlForLiberty = path.join(pathToPomXmlsForLiberty, 'without collector.xml');
    const pathToExpectedPomXmlForLiberty = path.join(pathToPomXmlsForLiberty, 'with collector.xml');
    let originalPomXmlForLiberty;
    let expectedPomXmlForLiberty;

    // spring
    const pathToApplicationJava = path.join(projectDir, 'src', 'main', 'java', 'application', 'Application.java');

    const pathToTestResourcesForSpring = path.join(pathToTestResourcesDir, 'spring');

    const pathToApplicationJavas = path.join(pathToTestResourcesForSpring, 'Application.java');
    const pathToOriginalApplicationJava = path.join(pathToApplicationJavas, 'package1', 'without collector.java');
    const pathToExpectedApplicationJava = path.join(pathToApplicationJavas, 'package1', 'with collector.java');
    const originalApplicationJava = fs.readFileSync(pathToOriginalApplicationJava, 'utf8');
    const expectedApplicationJava = fs.readFileSync(pathToExpectedApplicationJava, 'utf8');

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
                fs.writeJSONSync(pathToPackageJson, originalPackageJson);
            });
            afterEach(() => {
                fs.unlinkSync(pathToPackageJson);
            });
            it(`injects metrics collector into the project's package.json`, async() => {
                await metricsService.injectMetricsCollectorIntoProject('nodejs', projectDir);

                fs.readJSONSync(pathToPackageJson).should.deep.equal(expectedPackageJson);
            });
        });
        describe(`('liberty', <goodProjectDir>)`, () => {
            beforeEach(() => {
                fs.writeFileSync(pathToTestPomXml, fs.readFileSync(pathToOriginalPomXmlForLiberty));
                fs.outputFileSync(pathToJvmOptions, originalJvmOptions);
            });
            afterEach(() => {
                fs.unlinkSync(pathToTestPomXml);
                fs.unlinkSync(pathToJvmOptions);
            });
            it(`injects metrics collector into the project's jvm.options and pom.xml`, async() => {
                await metricsService.injectMetricsCollectorIntoProject('liberty', projectDir);

                const outputPomXml = await readXml(pathToTestPomXml);
                outputPomXml.should.deep.equalInAnyOrder(expectedPomXmlForLiberty);

                const outputJvmOptions = fs.readFileSync(pathToJvmOptions, 'utf8');
                outputJvmOptions.should.equal(expectedJvmOptions);
            });
        });
        describe(`('spring', <goodProjectDir>)`, () => {
            beforeEach(() => {
                fs.writeFileSync(pathToTestPomXml, fs.readFileSync(pathToOriginalPomXmlForSpring));
                fs.outputFileSync(pathToApplicationJava, originalApplicationJava);
            });
            afterEach(() => {
                fs.unlinkSync(pathToTestPomXml);
                fs.unlinkSync(pathToApplicationJava);
            });
            it(`injects metrics collector into the project's Application.java and pom.xml`, async() => {
                await metricsService.injectMetricsCollectorIntoProject('spring', projectDir);

                const outputPomXml = await readXml(pathToTestPomXml);
                outputPomXml.should.deep.equalInAnyOrder(expectedPomXmlForSpring);

                const outputApplicationJava = fs.readFileSync(pathToApplicationJava, 'utf8');
                outputApplicationJava.should.equal(expectedApplicationJava);
            });
        });
        describe(`('unsupportedProjectType', <goodProjectDir>)`, () => {
            beforeEach(() => {
                fs.writeJSONSync(pathToPackageJson, originalPackageJson);
            });
            afterEach(() => {
                fs.unlinkSync(pathToPackageJson);
            });
            it(`throws a useful error`, () => {
                const funcToTest = () => metricsService.injectMetricsCollectorIntoProject('unsupportedProjectType', projectDir);
                return funcToTest().should.be.rejectedWith(`Injection of metrics collector is not supported for projects of type 'unsupportedProjectType'`);
            });
        });
    });
    describe('nodejs', () => {
        describe('injectMetricsCollectorIntoNodeProject(projectDir)', () => {
            describe('package.json does not have metrics injection code', () => {
                before(() => {
                    fs.writeJSONSync(pathToPackageJson, originalPackageJson);
                });
                after(() => {
                    fs.unlinkSync(pathToPackageJson);
                });
                it(`injects metrics collector into the project's package.json`, async() => {
                    const funcToTest = metricsService.__get__('injectMetricsCollectorIntoNodeProject');
                    await funcToTest(projectDir);

                    fs.readJSONSync(pathToPackageJson).should.deep.equal(expectedPackageJson);
                });
            });
            describe('package.json already has metrics injection code', () => {
                before(() => {
                    fs.writeJSONSync(pathToPackageJson, expectedPackageJson);
                });
                after(() => {
                    fs.unlinkSync(pathToPackageJson);
                });
                it(`injects metrics collector into the project's package.json`, async() => {
                    const funcToTest = metricsService.__get__('injectMetricsCollectorIntoNodeProject');
                    await funcToTest(projectDir);

                    fs.readJSONSync(pathToPackageJson).should.deep.equal(expectedPackageJson);
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
                fs.writeFileSync(pathToTestPomXml, fs.readFileSync(pathToOriginalPomXmlForLiberty));
                fs.outputFileSync(pathToJvmOptions, originalJvmOptions);
            });
            afterEach(() => {
                fs.unlinkSync(pathToTestPomXml);
                fs.unlinkSync(pathToJvmOptions);
            });
            it(`injects metrics collector into the project's jvm.options and pom.xml`, async() => {
                const funcToTest = metricsService.__get__('injectMetricsCollectorIntoLibertyProject');
                await funcToTest(projectDir);

                const outputPomXml = await readXml(pathToTestPomXml);
                outputPomXml.should.deep.equalInAnyOrder(expectedPomXmlForLiberty);

                const outputJvmOptions = fs.readFileSync(pathToJvmOptions, 'utf8');
                outputJvmOptions.should.equal(expectedJvmOptions);
            });
        });

        describe('injectMetricsCollectorIntoPomXml(pathToPomXml)', () => {
            beforeEach(() => {
                fs.writeFileSync(pathToTestPomXml, fs.readFileSync(pathToOriginalPomXmlForLiberty));
            });
            afterEach(() => {
                fs.unlinkSync(pathToTestPomXml);
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
                fs.unlinkSync(pathToJvmOptions);
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
                'Application.java in a dir with a name': {
                    pathToApplicationJava: path.join(projectDir, 'src', 'main', 'java', 'application', 'Application.java'),
                },
                'Application.java with different name': {
                    pathToApplicationJava: path.join(projectDir, 'src', 'main', 'java', 'application', 'Application2.java'),
                },
                'Application.java in a different dir': {
                    pathToApplicationJava: path.join(projectDir, 'src', 'main', 'java', 'Application.java'),
                },
            };
            for (const [testName, test] of Object.entries(tests)) {
                describe(testName, () => { // eslint-disable-line no-loop-func
                    before(() => {
                        fs.writeFileSync(pathToTestPomXml, fs.readFileSync(pathToOriginalPomXmlForSpring));
                        fs.outputFileSync(test.pathToApplicationJava, originalApplicationJava);
                    });
                    after(() => {
                        fs.unlinkSync(pathToTestPomXml);
                        fs.unlinkSync(test.pathToApplicationJava);
                    });
                    it(`injects metrics collector into the project's Application.java and pom.xml`, async() => {
                        const funcToTest = metricsService.__get__('injectMetricsCollectorIntoSpringProject');
                        await funcToTest(projectDir);

                        const outputPomXml = await readXml(pathToTestPomXml);
                        outputPomXml.should.deep.equalInAnyOrder(expectedPomXmlForSpring);

                        const outputApplicationJava = fs.readFileSync(test.pathToApplicationJava, 'utf8');
                        outputApplicationJava.should.equal(expectedApplicationJava);
                    });
                });
            }
        });


        describe('getNewContentsOfApplicationJava(originalContents)', () => {
            const tests = {
                'package application': {
                    originalApplicationJava,
                    expectedApplicationJava,
                },
                'package application2': {
                    originalApplicationJava: fs.readFileSync(path.join(pathToApplicationJavas, 'package2', 'without collector.java'), 'utf8'),
                    expectedApplicationJava: fs.readFileSync(path.join(pathToApplicationJavas, 'package2', 'with collector.java'), 'utf8'),
                },
            };
            for (const [testName, test] of Object.entries(tests)) {
                describe(testName, () => { // eslint-disable-line no-loop-func
                    it('returns an object representing an Application.java injected with metrics collector', () => {
                        const funcToTest = metricsService.__get__('getNewContentsOfApplicationJava');
                        const output = funcToTest(test.originalApplicationJava);
                        output.should.deep.equalInAnyOrder(test.expectedApplicationJava);
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
