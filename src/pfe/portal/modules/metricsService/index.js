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
const promiseAny = require('promise.any');

const Logger = require('../utils/Logger');
const nodeMetricsService = require('./node');

const log = new Logger(__filename);
const deepClone = (obj) => JSON.parse(JSON.stringify(obj));

const metricsCollectorInjectionFunctions = {
  nodejs: nodeMetricsService.injectMetricsCollectorIntoNodeProject,
  liberty: injectMetricsCollectorIntoLibertyProject,
  spring: injectMetricsCollectorIntoSpringProject,
}

const metricsCollectorRemovalFunctions = {
  nodejs: nodeMetricsService.removeMetricsCollectorFromNodeProject,
  liberty: removeMetricsCollectorFromLibertyProject,
  spring: removeMetricsCollectorFromSpringProject,
}

async function injectMetricsCollectorIntoProject(projectType, projectDir) {
  if (!metricsCollectorInjectionFunctions.hasOwnProperty(projectType)) {
    throw new Error(`Injection of metrics collector is not supported for projects of type '${projectType}'`);
  }
  await metricsCollectorInjectionFunctions[projectType](projectDir);
  log.debug(`Successfully injected metrics collector into ${projectType} project`);
}

async function removeMetricsCollectorFromProject(projectType, projectDir) {
  if (!metricsCollectorRemovalFunctions.hasOwnProperty(projectType)) {
    throw new Error(`Injection of metrics collector is not supported for projects of type '${projectType}'`);
  }
  await metricsCollectorRemovalFunctions[projectType](projectDir);
  log.debug(`Successfully removed metrics collector from ${projectType} project`);
}

const getPathToPomXml = (projectDir) => path.join(projectDir, 'pom.xml');
const getPathToBackupPomXml = (projectDir) => path.join(projectDir, 'backupPom.xml');

const getPathToJvmOptions = (projectDir) => path.join(projectDir, 'src', 'main', 'liberty', 'config', 'jvm.options');
const getPathToBackupJvmOptions = (projectDir) => path.join(projectDir, 'src', 'main', 'liberty', 'config', 'backupJvm.options');

async function removeMetricsCollectorFromLibertyProject(projectDir) {
  await removeMetricsCollectorFromPomXml(projectDir);
  await removeMetricsCollectorFromJvmOptions(projectDir);
}

async function removeMetricsCollectorFromPomXml(projectDir) {
  const pathToBackupPomXml = getPathToBackupPomXml(projectDir);
  const backupPomXml = await fs.readFile(pathToBackupPomXml);

  const pathToPomXml = getPathToPomXml(projectDir);
  await fs.writeFile(pathToPomXml, backupPomXml);
  log.debug(`Restored project's pom.xml to ${util.inspect(backupPomXml)}`);
  await fs.remove(pathToBackupPomXml);
}

async function removeMetricsCollectorFromJvmOptions(projectDir) {
  const pathToBackupJvmOptions = getPathToBackupJvmOptions(projectDir);
  const backupJvmOptions = await fs.readFile(pathToBackupJvmOptions);

  const pathToJvmOptions = getPathToJvmOptions(projectDir);
  await fs.writeFile(pathToJvmOptions, backupJvmOptions);
  log.debug(`Restored project's jvm.options to ${util.inspect(backupJvmOptions)}`);
  await fs.remove(pathToBackupJvmOptions);
}

async function removeMetricsCollectorFromSpringProject(projectDir) {
  await removeMetricsCollectorFromPomXml(projectDir);
  await removeMetricsCollectorFromMainAppClassFile(projectDir);
}

const getPathToBackupMainAppClassFile = (projectDir) => path.join(projectDir, 'codewind-backup', 'Application.java');

async function removeMetricsCollectorFromMainAppClassFile(projectDir) {
  const pathToMainAppClassFile = await getPathToMainAppClassFile(projectDir);
  const pathToBackupClassFile = getPathToBackupMainAppClassFile(projectDir);
  const backupClassFile = await fs.readFile(pathToBackupClassFile);
  await fs.writeFile(pathToMainAppClassFile, backupClassFile);
  log.debug(`Restored project's main app class file to ${util.inspect(backupClassFile)}`);
  await fs.remove(pathToBackupClassFile);
}

async function backUpFile(pathToOriginal, pathToBackup) {
  const originalFileData = await fs.readFile(pathToOriginal);
  await fs.outputFile(pathToBackup, originalFileData);
}

async function injectMetricsCollectorIntoLibertyProject(projectDir) {
  const pathToBackupPomXml = getPathToBackupPomXml(projectDir);
  const pathToBackupJvmOptions = getPathToBackupJvmOptions(projectDir);
  if ((await fs.exists(pathToBackupPomXml)) || (await fs.exists(pathToBackupJvmOptions))) {
    throw new Error('project files already backed up (i.e. we have already injected metrics collector)');
  }

  const pathToPomXml = getPathToPomXml(projectDir);
  await backUpFile(pathToPomXml, pathToBackupPomXml);
  await injectMetricsCollectorIntoPomXml(pathToPomXml);

  const pathToJvmOptions = getPathToJvmOptions(projectDir);
  await backUpFile(pathToJvmOptions, pathToBackupJvmOptions);
  await injectMetricsCollectorIntoJvmOptions(pathToJvmOptions);
}

async function injectMetricsCollectorIntoSpringProject(projectDir) {
  const pathToBackupPomXml = getPathToBackupPomXml(projectDir);
  const pathToBackupMainAppClassFile = getPathToBackupMainAppClassFile(projectDir);
  if ((await fs.exists(pathToBackupPomXml)) || (await fs.exists(pathToBackupMainAppClassFile))) {
    throw new Error('project files already backed up (i.e. we have already injected metrics collector)');
  }

  const pathToPomXml = getPathToPomXml(projectDir);
  await backUpFile(pathToPomXml, pathToBackupPomXml);
  await injectMetricsCollectorIntoPomXmlForSpring(pathToPomXml);

  const pathToMainAppClassFile = await getPathToMainAppClassFile(projectDir);
  await backUpFile(pathToMainAppClassFile, pathToBackupMainAppClassFile);
  await injectMetricsCollectorIntoMainAppClassFile(pathToMainAppClassFile);
}

const springAppAnnotation = '@SpringBootApplication';

/**
 * @returns element as soon as an element in `array` satisfies `asyncCallback`,
 * Or rejects if no elements in `array` satisfy `asyncCallback`
 */
const findAsync = (array, asyncCallback) => promiseAny(
  array.map(element => asyncCallback(element))
)

async function getPathToMainAppClassFile(projectDir) {
  const pathToProjectSrcFiles = path.join(projectDir, 'src', 'main', 'java');

  const srcFiles = await dir.promiseFiles(pathToProjectSrcFiles);

  const mainAppClassFile = await findAsync(
    srcFiles,
    async(file) => {
      const fileData = await fs.readFile(file, 'utf8');
      const fileIsMainAppClassFile = fileData.includes(springAppAnnotation);
      if (fileIsMainAppClassFile) {
        return file;
      }
      throw new Error();
    },
  );
  return mainAppClassFile;
}

async function injectMetricsCollectorIntoMainAppClassFile(pathToClassFile) {
  const originalClassFile = await fs.readFile(pathToClassFile, 'utf8');
  const newClassFile = getNewContentsOfMainAppClassFile(originalClassFile);
  log.debug(`Injecting metrics collector into project's main app class file, which is now:\n${newClassFile}`);
  await fs.writeFile(pathToClassFile, newClassFile);
}

function getNewContentsOfMainAppClassFile(originalContents) {
  const splitOriginalContents = originalContents.split('\n');
  const componentScanLineIndex = splitOriginalContents.findIndex(line => {
    return (line.indexOf('@ComponentScan(basePackages = {') != -1)
  });
  const metricsCollectorPresent = splitOriginalContents.some(line => {
    return (line.indexOf('@ComponentScan(basePackages = {') != -1) && (line.indexOf('com.ibm.javametrics.codewind.spring') != -1)
  });

  if (metricsCollectorPresent) {
    return originalContents;
  }
  // metrics collector not present, so...
  let newApplicationJava = deepClone(splitOriginalContents);
  if (componentScanLineIndex != -1) {
    // alter what's already in there
    newApplicationJava[componentScanLineIndex] = newApplicationJava[componentScanLineIndex].replace('{', '{"com.ibm.javametrics.codewind.spring", ');
  } else {
    // construct a new ComponentScan line
    const packageString = splitOriginalContents.find(line => line.includes('package'));
    const packageName = packageString // 'package NAME;'
      .split(' ')[1] // 'NAME;'
      .slice(0, -1); // 'NAME'
    const metricsCollectorAnnotation = `@ComponentScan(basePackages = {"com.ibm.javametrics.codewind.spring", "${packageName}"})`;
    const indexOfSpringBootApplication = splitOriginalContents.findIndex(line => line === springAppAnnotation);
    newApplicationJava.splice(indexOfSpringBootApplication + 1, 0, metricsCollectorAnnotation);
  }
  newApplicationJava = newApplicationJava.join('\n');
  return newApplicationJava;
}

async function injectMetricsCollectorIntoPomXmlForSpring(pathToPomXml) {
  const originalPomXmlFileData = await fs.readFile(pathToPomXml);
  const originalPomXml = await xml2js.parseStringPromise(originalPomXmlFileData);
  const newPomXmlInJsonFormat = getNewContentsOfPomXmlForSpring(originalPomXml);
  const xmlBuilder = new xml2js.Builder();
  const newPomXml = xmlBuilder.buildObject(newPomXmlInJsonFormat);
  log.debug(`Injecting metrics collector into project's pom.xml, which is now:\n${newPomXml}`);
  await fs.writeFile(pathToPomXml, newPomXml);
}

function getNewContentsOfPomXmlForSpring(originalContents) {
  const newPomXml = deepClone(originalContents);
  const newDependencies = newPomXml.project.dependencies[0];
  newDependencies.dependency = getNewPomXmlDependenciesForSpring(newDependencies.dependency);

  return newPomXml;
}

function getNewPomXmlDependenciesForSpring(originalDependencies) {
  let codewindDepNeeded, agentDepNeeded, jsonDepNeeded;
  codewindDepNeeded = agentDepNeeded = jsonDepNeeded = true;
  originalDependencies.forEach(dependency => {
    switch(dependency.artifactId[0]) {
    case 'javametrics-codewind-spring':
      codewindDepNeeded = false;
      break;
    case 'javametrics-agent':
      agentDepNeeded = false;
      break;
    case 'javax.json':
      jsonDepNeeded = false;
      break;
    default:
      break;
    }
  });
  let newDependencies = [];
  if (codewindDepNeeded) {
    newDependencies.push(
      {
        groupId: [ 'com.ibm.runtimetools' ],
        artifactId: [ 'javametrics-codewind-spring' ],
        version: [ '[1.1,2.0)' ],
      }
    );
  }
  if (agentDepNeeded) {
    newDependencies.push(
      {
        groupId: [ 'com.ibm.runtimetools' ],
        artifactId: [ 'javametrics-agent' ],
        version: [ '[1.1,2.0)' ],
      }
    );
  }
  if (jsonDepNeeded) {
    newDependencies.push(
      {
        groupId: [ 'org.glassfish' ],
        artifactId: [ 'javax.json' ],
        version: [ '1.0.4' ],
      }
    );
  }
  const mergedDependencies = originalDependencies.concat(newDependencies);
  return mergedDependencies;
}

async function injectMetricsCollectorIntoPomXml(pathToPomXml) {
  const originalPomXmlFileData = await fs.readFile(pathToPomXml);
  const originalPomXml = await xml2js.parseStringPromise(originalPomXmlFileData);
  const newPomXmlInJsonFormat = getNewContentsOfPomXml(originalPomXml);
  const xmlBuilder = new xml2js.Builder();
  const newPomXml = xmlBuilder.buildObject(newPomXmlInJsonFormat);
  log.trace(`Injecting metrics collector into project's pom.xml, which is now ${util.inspect(newPomXml)}`);
  await fs.writeFile(pathToPomXml, newPomXml);
}

async function injectMetricsCollectorIntoJvmOptions(pathToJvmOptions) {
  const originalJvmOptions = await fs.readFile(pathToJvmOptions, 'utf8');
  const newJvmOptions = getNewContentsOfJvmOptions(originalJvmOptions);
  log.trace(`Injecting metrics collector into project's jvm.options, which is now ${util.inspect(newJvmOptions)}`);
  await fs.writeFile(pathToJvmOptions, newJvmOptions);
}

function getNewContentsOfPomXml(originalContents) {
  const newPomXml = deepClone(originalContents);

  const newDependencies = newPomXml.project.dependencies[0];
  newDependencies.dependency = getNewPomXmlDependencies(newDependencies.dependency);

  const newBuildPlugins = newPomXml.project.build[0].plugins[0];
  newBuildPlugins.plugin = getNewPomXmlBuildPlugins(newBuildPlugins.plugin);

  return newPomXml;
}

function getNewContentsOfJvmOptions(originalContents) {
  const injectionString = '-javaagent:resources/javametrics-agent.jar'
  if (originalContents.includes(injectionString)) {
    return originalContents;
  } 
  const newJvmOptions = `${originalContents}\n${injectionString}`;
  return newJvmOptions;
}

function getNewPomXmlDependencies(originalDependencies) {
  let codewindDepNeeded, agentDepNeeded, restDepNeeded, jsonDepNeeded;
  codewindDepNeeded = agentDepNeeded = restDepNeeded = jsonDepNeeded = true;
  originalDependencies.forEach(dependency => {
    switch(dependency.artifactId[0]) {
    case 'javametrics-codewind':
      codewindDepNeeded = false;
      break;
    case 'javametrics-agent':
      agentDepNeeded = false;
      break;
    case 'javametrics-rest':
      restDepNeeded = false;
      break;
    case 'javax.json':
      jsonDepNeeded = false;
      break;
    default:
      break;
    }
  });
  let newDependencies = [];
  if (codewindDepNeeded) {
    newDependencies.push(
      {
        groupId: [ 'com.ibm.runtimetools' ],
        artifactId: [ 'javametrics-codewind' ],
        version: [ '[1.2,2.0)' ],
        scope: [ 'provided' ],
        type: [ 'war' ],
      }
    );
  }
  if (agentDepNeeded) {
    newDependencies.push(
      {
        groupId: [ 'com.ibm.runtimetools' ],
        artifactId: [ 'javametrics-agent' ],
        version: [ '[1.2,2.0)' ],
        scope: [ 'provided' ],
      }
    );
  }
  if (restDepNeeded) {
    newDependencies.push(
      {
        groupId: [ 'com.ibm.runtimetools' ],
        artifactId: [ 'javametrics-rest' ],
        version: [ '[1.2,2.0)' ],
        scope: [ 'provided' ],
        type: [ 'war' ],
      }
    );
  }
  if (jsonDepNeeded) {
    newDependencies.push(
      {
        groupId: [ 'org.glassfish' ],
        artifactId: [ 'javax.json' ],
        version: [ '1.0.4' ],
        scope: [ 'test' ],
      }
    );
  }
  const mergedDependencies = originalDependencies.concat(newDependencies);
  return mergedDependencies;
}

function getNewPomXmlBuildPlugins(originalBuildPlugins) {
  let codewindExeNeeded, agentExeNeeded, restExeNeeded, asmExeNeeded, mavenDepPluginNeeded;
  codewindExeNeeded = agentExeNeeded = restExeNeeded = asmExeNeeded = mavenDepPluginNeeded = true;
  const mavenDepPluginIndex = originalBuildPlugins.findIndex(plugin => {
    return (plugin.artifactId[0] === 'maven-dependency-plugin');
  });
  if (mavenDepPluginIndex != -1) {
    // maven-dependency-plugin exists; check for individual executions
    mavenDepPluginNeeded = false;
    let mavenDepPlugin = originalBuildPlugins[mavenDepPluginIndex];
    if (mavenDepPlugin.executions) {
      mavenDepPlugin.executions[0].execution.forEach(execution => {
        switch(execution.id[0]) {
        case 'copy-javametrics-codewind':
          codewindExeNeeded = false;
          break;
        case 'copy-javametrics-rest':
          restExeNeeded = false;
          break;
        case 'copy-javametrics-agent':
          agentExeNeeded = false;
          break;
        case 'copy-javametrics-asm':
          asmExeNeeded = false;
          break;
        default:
          break;
        }
      });
    }
  }
  let newExecutionArray = [];
  if (codewindExeNeeded) {
    newExecutionArray.push(
      {
        id: [ 'copy-javametrics-codewind' ],
        phase: [ 'package' ],
        goals: [ { goal: [ 'copy-dependencies' ] } ],
        configuration: [
          {
            stripVersion: [ 'true' ],
            outputDirectory: [ '${project.build.directory}/liberty/wlp/usr/servers/defaultServer/dropins' ],
            includeArtifactIds: [ 'javametrics-codewind' ]
          }
        ]
      }
    );
  }
  if (restExeNeeded) {
    newExecutionArray.push(
      {
        id: [ 'copy-javametrics-rest' ],
        phase: [ 'package' ],
        goals: [ { goal: [ 'copy-dependencies' ] } ],
        configuration: [
          {
            stripVersion: [ 'true' ],
            outputDirectory: [ '${project.build.directory}/liberty/wlp/usr/servers/defaultServer/dropins' ],
            includeArtifactIds: [ 'javametrics-rest' ]
          }
        ]
      }
    );
  }
  if (agentExeNeeded) {
    newExecutionArray.push(
      {
        id: [ 'copy-javametrics-agent' ],
        phase: [ 'package' ],
        goals: [ { goal: [ 'copy-dependencies' ] } ],
        configuration: [
          {
            stripVersion: [ 'true' ],
            outputDirectory: [ '${project.build.directory}/liberty/wlp/usr/servers/defaultServer/resources/' ],
            includeArtifactIds: [ 'javametrics-agent' ]
          }
        ]
      }
    );
  }
  if (asmExeNeeded) {
    newExecutionArray.push(
      {
        id: [ 'copy-javametrics-asm' ],
        phase: [ 'package' ],
        goals: [ { goal: [ 'copy-dependencies' ] } ],
        configuration: [
          {
            outputDirectory: [ '${project.build.directory}/liberty/wlp/usr/servers/defaultServer/resources/asm' ],
            includeGroupIds: [ 'org.ow2.asm' ],
            includeArtifactIds: [ 'asm,asm-commons' ]
          }
        ]
      }
    );
  }

  if (mavenDepPluginNeeded) {
    const metricsCollectorBuildPlugin = {
      groupId: [ 'org.apache.maven.plugins' ],
      artifactId: [ 'maven-dependency-plugin' ],
      version: [ '3.0.1' ],
      executions: [
        {
          execution: newExecutionArray,
        }
      ]
    };
    const newBuildPlugins = originalBuildPlugins.concat(metricsCollectorBuildPlugin);
    return newBuildPlugins;
  }

  // insert new executions into existing plugin
  let metricsCollectorBuildPlugin = deepClone(originalBuildPlugins[mavenDepPluginIndex]);
  if (metricsCollectorBuildPlugin.executions) {
    metricsCollectorBuildPlugin.executions[0].execution = metricsCollectorBuildPlugin.executions[0].execution.concat(newExecutionArray);
  } else {
    metricsCollectorBuildPlugin.executions = [ { execution: newExecutionArray } ];
  }
  let newBuildPlugins = deepClone(originalBuildPlugins);
  // replace original maven-dependency plugin with new one containing the new executions
  newBuildPlugins.splice(mavenDepPluginIndex, 1, metricsCollectorBuildPlugin);
  return newBuildPlugins;
}

module.exports = {
  injectMetricsCollectorIntoProject,
  removeMetricsCollectorFromProject,
}
