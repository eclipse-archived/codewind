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

const fs = require('fs-extra');
const path = require('path');
const util = require('util');
const xml2js = require('xml2js');
const dir = require('node-dir');

const Logger = require('./utils/Logger');

const log = new Logger('MetricsService.js');
const deepClone = (obj) => JSON.parse(JSON.stringify(obj));

const metricsCollectorInjectionFunctions = {
  nodejs: injectMetricsCollectorIntoNodeProject,
  liberty: injectMetricsCollectorIntoLibertyProject,
  spring: injectMetricsCollectorIntoSpringProject,
}

async function injectMetricsCollectorIntoProject(projectType, projectDir) {
  if (!metricsCollectorInjectionFunctions.hasOwnProperty(projectType)) {
    throw new Error(`Injection of metrics collector is not supported for projects of type '${projectType}'`);
  }
  await metricsCollectorInjectionFunctions[projectType](projectDir);
  log.debug(`Successfully injected metrics collector into ${projectType} project`);
}

async function injectMetricsCollectorIntoNodeProject(projectDir) {
  const pathToPackageJson = path.join(projectDir, 'package.json');
  const originalContentsOfPackageJson = await fs.readJSON(pathToPackageJson);

  const newContentsOfPackageJson = getNewContentsOfPackageJson(originalContentsOfPackageJson);
  // TODO: change to trace
  log.debug(`Injecting metrics collector into project's package.json, which is now ${util.inspect(newContentsOfPackageJson)}`);

  await fs.writeJSON(pathToPackageJson, newContentsOfPackageJson, { spaces: 2 });
}

function getNewContentsOfPackageJson(originalContentsOfPackageJson) {
  const metricsCollectorScript = '-r appmetrics-prometheus/attach';

  const originalStartScript = originalContentsOfPackageJson.scripts.start;
  if (originalStartScript.includes(metricsCollectorScript)) {
    return originalContentsOfPackageJson;
  }

  const splitOriginalStartScript = originalStartScript.split(' ');
  const indexOfNodeCmd = splitOriginalStartScript.findIndex(word => ['node', 'nodemon'].includes(word));

  let newStartScript = deepClone(splitOriginalStartScript);
  newStartScript.splice(indexOfNodeCmd + 1, 0, metricsCollectorScript);
  newStartScript = newStartScript.join(' ');

  const newContentsOfPackageJson = deepClone(originalContentsOfPackageJson);

  newContentsOfPackageJson.scripts.start = newStartScript;
  // TODO: change to production repo when ready
  newContentsOfPackageJson.dependencies['appmetrics-prometheus'] = "git+https://git@github.com/rwalle61/appmetrics-prometheus.git#host-metrics-on-codewind-endpoint";
  newContentsOfPackageJson.dependencies['cors'] = "^2.8.5"; // Needed because appmetrics-prometheus depends on `cors`, and for some reason when the project runs `npm install`, it doesn't install `cors`
  return newContentsOfPackageJson;
}

async function injectMetricsCollectorIntoLibertyProject(projectDir) {
  const pathToPomXml = path.join(projectDir, 'pom.xml');
  await injectMetricsCollectorIntoPomXml(pathToPomXml);

  const pathToJvmOptions = path.join(projectDir, 'src', 'main', 'liberty', 'config', 'jvm.options');
  await injectMetricsCollectorIntoJvmOptions(pathToJvmOptions);
}

async function injectMetricsCollectorIntoSpringProject(projectDir) {
  const pathToPomXml = path.join(projectDir, 'pom.xml');
  await injectMetricsCollectorIntoPomXmlForSpring(pathToPomXml);

  const pathToApplicationJava = await getPathToApplicationJava(projectDir);
  await injectMetricsCollectorIntoApplicationJava(pathToApplicationJava);
}

const springAppAnnotation = '@SpringBootApplication';

async function getPathToApplicationJava(projectDir) {
  const pathToSrcMainJavaDir = path.join(projectDir, 'src', 'main', 'java');

  const files = await dir.promiseFiles(pathToSrcMainJavaDir);
  // console.log('files');
  // console.log(files);
  // TODO: async
  const file = files.find(file => {
    // console.log(`fs.readFileSync(file, 'utf8')`);
    // console.log(fs.readFileSync(file, 'utf8'));
    return fs.readFileSync(file, 'utf8').includes(springAppAnnotation);

  })
  // console.log('file');
  // console.log(file);

  return file;
}

async function injectMetricsCollectorIntoApplicationJava(pathToApplicationJava) {
  const originalApplicationJava = await fs.readFile(pathToApplicationJava, 'utf8');
  const newApplicationJava = getNewContentsOfApplicationJava(originalApplicationJava);
  log.debug(`Injecting metrics collector into project's Application.java, which is now ${util.inspect(newApplicationJava)}`);
  await fs.writeFile(pathToApplicationJava, newApplicationJava);
}

function getNewContentsOfApplicationJava(originalContents) {
  const splitOriginalContents = originalContents.split('\n');

  const packageString = splitOriginalContents.find(line => line.includes('package'));
  const packageName = packageString // 'package NAME'
    .split(' ')[1] // 'NAME;'
    .slice(0, -1); // 'NAME'

  const indexOfSpringBootApplication = splitOriginalContents.findIndex(line => line === springAppAnnotation);
  const metricsCollectorAnnotation = `@ComponentScan(basePackages = {"${packageName}", "com.ibm.javametrics.spring"})`;

  let newApplicationJava = deepClone(splitOriginalContents);
  newApplicationJava.splice(indexOfSpringBootApplication + 1, 0, metricsCollectorAnnotation);
  newApplicationJava = newApplicationJava.join('\n');

  return newApplicationJava;
}

async function injectMetricsCollectorIntoPomXmlForSpring(pathToPomXml) {
  const originalPomXmlFileData = await fs.readFile(pathToPomXml);
  const originalPomXml = await xml2js.parseStringPromise(originalPomXmlFileData);
  const newPomXmlInJsonFormat = getNewContentsOfPomXmlForSpring(originalPomXml);
  const xmlBuilder = new xml2js.Builder();
  const newPomXml = xmlBuilder.buildObject(newPomXmlInJsonFormat);
  log.debug(`Injecting metrics collector into project's pom.xml, which is now ${util.inspect(newPomXml)}`);
  await fs.writeFile(pathToPomXml, newPomXml);
}

function getNewContentsOfPomXmlForSpring(originalContents) {
  const newPomXml = deepClone(originalContents);
  // console.log('newPomXml');
  // console.log(util.inspect(newPomXml, { showHidden: false, depth: null }));
  const newDependencies = newPomXml.project.dependencies[0];
  newDependencies.dependency = getNewPomXmlDependenciesForSpring(newDependencies.dependency);

  return newPomXml;
}

function getNewPomXmlDependenciesForSpring(originalDependencies) {
  const metricsCollectorDependencyAlreadyExists = originalDependencies.some(dependency =>
    dependency.artifactId[0] === 'javametrics-spring'
  );
  if (metricsCollectorDependencyAlreadyExists) {
    return originalDependencies;
  }
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
  const newDependencies = originalDependencies.concat(metricsCollectorDependencies);
  return newDependencies;
}

async function injectMetricsCollectorIntoPomXml(pathToPomXml) {
  const originalPomXmlFileData = await fs.readFile(pathToPomXml);
  const originalPomXml = await xml2js.parseStringPromise(originalPomXmlFileData);
  const newPomXmlInJsonFormat = getNewContentsOfPomXml(originalPomXml);
  const xmlBuilder = new xml2js.Builder();
  const newPomXml = xmlBuilder.buildObject(newPomXmlInJsonFormat);
  log.debug(`Injecting metrics collector into project's pom.xml, which is now ${util.inspect(newPomXml)}`);
  await fs.writeFile(pathToPomXml, newPomXml);
}

async function injectMetricsCollectorIntoJvmOptions(pathToJvmOptions) {
  const originalJvmOptions = await fs.readFile(pathToJvmOptions, 'utf8');
  const newJvmOptions = getNewContentsOfJvmOptions(originalJvmOptions);
  log.debug(`Injecting metrics collector into project's jvm.options, which is now ${util.inspect(newJvmOptions)}`);
  await fs.writeFile(pathToJvmOptions, newJvmOptions);
}

function getNewContentsOfPomXml(originalContents) {
  const newPomXml = deepClone(originalContents);

  const newDependencies = newPomXml.project.dependencies[0];
  newDependencies.dependency = getNewPomXmlDependencies(newDependencies.dependency);

  const newBuildPluginExecutions = newPomXml.project.build[0].plugins[0].plugin[2].executions[0];
  newBuildPluginExecutions.execution = getNewPomXmlBuildPluginExecutions(newBuildPluginExecutions.execution);

  return newPomXml;
}

function getNewContentsOfJvmOptions(originalContents) {
  const newJvmOptions = `${originalContents}\n-javaagent:resources/javametrics-agent.jar`;
  return newJvmOptions;
}

function getNewPomXmlDependencies(originalDependencies) {
  const metricsCollectorDependencyAlreadyExists = originalDependencies.some(dependency =>
    dependency.artifactId[0] === 'javametrics-dash'
  );
  if (metricsCollectorDependencyAlreadyExists) {
    return originalDependencies;
  }
  const newDependencies = originalDependencies.concat({
    groupId: [ 'com.ibm.runtimetools' ],
    artifactId: [ 'javametrics-dash' ],
    version: [ '[1.2,2.0)' ],
    scope: [ 'provided' ],
    type: [ 'war' ],
  });
  return newDependencies;
}

function getNewPomXmlBuildPluginExecutions(originalBuildPluginExecutions) {
  const metricsCollectorBuildPluginExecutionAlreadyExists = originalBuildPluginExecutions.some(execution =>
    execution.id[0] === 'copy-javametrics-dash'
  );
  if (metricsCollectorBuildPluginExecutionAlreadyExists) {
    return originalBuildPluginExecutions;
  }
  const newBuildPluginExecutions = originalBuildPluginExecutions.concat({
    id: [ 'copy-javametrics-dash' ],
    phase: [ 'package' ],
    goals: [ { goal: [ 'copy-dependencies' ] } ],
    configuration: [
      {
        stripVersion: [ 'true' ],
        outputDirectory: [
          '${project.build.directory}/liberty/wlp/usr/servers/defaultServer/dropins',
        ],
        includeArtifactIds: [ 'javametrics-dash' ],
      },
    ],
  });
  return newBuildPluginExecutions;
}

module.exports = {
  injectMetricsCollectorIntoProject,
}
