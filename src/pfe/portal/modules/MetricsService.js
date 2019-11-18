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

const Logger = require('./utils/Logger');

const log = new Logger('MetricsService.js');
const deepClone = (obj) => JSON.parse(JSON.stringify(obj));

const metricsCollectorInjectionFunctions = {
  nodejs: injectMetricsCollectorIntoNodeProject,
  liberty: injectMetricsCollectorIntoLibertyProject,
}

async function injectMetricsCollectorIntoProject(projectLanguage, projectDir) {
  if (!metricsCollectorInjectionFunctions.hasOwnProperty(projectLanguage)) {
    throw new Error(`'${projectLanguage}' is not a supported language`);
  }
  await metricsCollectorInjectionFunctions[projectLanguage](projectDir);
  log.debug(`Successfully injected metrics collector into ${projectLanguage} project`);
}

async function injectMetricsCollectorIntoNodeProject(projectDir) {
  const pathToPackageJson = path.join(projectDir, 'package.json');
  const originalContentsOfPackageJson = await fs.readJSON(pathToPackageJson);

  const newContentsOfPackageJson = getNewContentsOfPackageJson(originalContentsOfPackageJson);
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
