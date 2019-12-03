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
  log.trace(`Injecting metrics collector into project's package.json, which is now ${util.inspect(newContentsOfPackageJson)}`);

  await fs.writeJSON(pathToPackageJson, newContentsOfPackageJson, { spaces: 2 });
}

function getNewContentsOfPackageJson(originalContentsOfPackageJson) {
  const newContentsOfPackageJson = deepClone(originalContentsOfPackageJson);

  newContentsOfPackageJson.scripts.start = getNewStartScript(originalContentsOfPackageJson.scripts.start);
  newContentsOfPackageJson.dependencies['appmetrics-codewind'] = '^0.1.0';
  return newContentsOfPackageJson;
}

function getNewStartScript(originalStartScript) {
  const metricsCollectorScript = '-r appmetrics-codewind/attach';

  if (originalStartScript.includes(metricsCollectorScript)) {
    return originalStartScript;
  }

  const splitOriginalStartScript = originalStartScript.split(' ');
  const indexOfNodeCmd = splitOriginalStartScript.findIndex(word => ['node', 'nodemon'].includes(word));

  let newStartScript = deepClone(splitOriginalStartScript);
  newStartScript.splice(indexOfNodeCmd + 1, 0, metricsCollectorScript);
  newStartScript = newStartScript.join(' ');

  return newStartScript;
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

// Resolves as soon as an element in `array` satisfies `asyncCallback`,
// Or rejects if no elements in `array` satisfy `asyncCallback`
const findAsync = (array, asyncCallback) => promiseAny(
  array.map(element => asyncCallback(element))
)

async function getPathToApplicationJava(projectDir) {
  const pathToSrcMainJavaDir = path.join(projectDir, 'src', 'main', 'java');

  const applicationJavaFiles = await dir.promiseFiles(pathToSrcMainJavaDir);

  const applicationJavaFile = await findAsync(
    applicationJavaFiles,
    async(file) => {
      const fileData = await fs.readFile(file, 'utf8');
      const fileIsApplicationJavaFile = fileData.includes(springAppAnnotation);
      if (fileIsApplicationJavaFile) {
        return file;
      }
      throw new Error();
    },
  );
  return applicationJavaFile;
}

async function injectMetricsCollectorIntoApplicationJava(pathToApplicationJava) {
  const originalApplicationJava = await fs.readFile(pathToApplicationJava, 'utf8');
  const newApplicationJava = getNewContentsOfApplicationJava(originalApplicationJava);
  log.trace(`Injecting metrics collector into project's Application.java, which is now:\n${newApplicationJava}`);
  await fs.writeFile(pathToApplicationJava, newApplicationJava);
}

function getNewContentsOfApplicationJava(originalContents) {
  const splitOriginalContents = originalContents.split('\n');
  const componentScanPresent = splitOriginalContents.findIndex(line => {
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
  if (componentScanPresent != -1) {
    // alter what's already in there
    newApplicationJava[componentScanPresent] = newApplicationJava[componentScanPresent].replace('{', '{"com.ibm.javametrics.codewind.spring", ');
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
  log.trace(`Injecting metrics collector into project's pom.xml, which is now:\n${newPomXml}`);
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
            outputDirectory: [
              '${project.build.directory}/liberty/wlp/usr/servers/defaultServer/dropins'
            ],
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
            outputDirectory: [
              '${project.build.directory}/liberty/wlp/usr/servers/defaultServer/dropins'
            ],
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
            outputDirectory: [
              '${project.build.directory}/liberty/wlp/usr/servers/defaultServer/resources/'
            ],
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
            outputDirectory: [
              '${project.build.directory}/liberty/wlp/usr/servers/defaultServer/resources/asm'
            ],
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
  
  
  let metricsCollectorBuildPlugin = originalBuildPlugins[mavenDepPluginIndex];
  if (metricsCollectorBuildPlugin.executions) {
    metricsCollectorBuildPlugin.executions[0].execution = metricsCollectorBuildPlugin.executions[0].execution.concat(newExecutionArray);
  } else {
    metricsCollectorBuildPlugin.executions = [ { execution: newExecutionArray } ];
  }
  let newBuildPlugins = originalBuildPlugins;
  newBuildPlugins.splice(mavenDepPluginIndex, 1, metricsCollectorBuildPlugin);
  return newBuildPlugins;
}

module.exports = {
  injectMetricsCollectorIntoProject,
}
