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
const path = require('path');
const { execSync } = require('child_process');

// Obtain the host and port Codewind is running on locally if not specifed
// via the env var.
let CONTAINER_HOST_INFO = {};
if (!process.env.CODEWIND_URL) {
    try {
        const CONTAINER_HOST_STDOUT = execSync(`docker inspect --format='{{json (index (index .NetworkSettings.Ports "9090/tcp") 0)}}' codewind-pfe`);
        CONTAINER_HOST_INFO = JSON.parse(CONTAINER_HOST_STDOUT);
    } catch (error) {
        // So that unit tests can run even if codewind-pfe is not started
        // console.log(error);
    }
}

const CODEWIND_URL = process.env.CODEWIND_URL || `http://${CONTAINER_HOST_INFO.HostIp}:${CONTAINER_HOST_INFO.HostPort}`;
const CODEWIND_HOST = process.env.INGRESS_DOMAIN || 'localhost';
const DEFAULT_USER_NAME = 'default';
const ADMIN_COOKIE = process.env.ADMIN_COOKIE || 'connect.sid=dummy';
const USING_K8S = !!process.env.ADMIN_COOKIE;
const USER_PATH = USING_K8S ? 'admin' : DEFAULT_USER_NAME;
const WORKSPACE_DIR = USING_K8S ? `/codewind-workspace/${USER_PATH}` : '/codewind-workspace';
const CODEWIND_SOCKET_URL = `${CODEWIND_URL}/${USER_PATH}`;
const IBM_GITHUB_AUTH = process.env.GIT_EXPORT_AUTH || '';

const K8S_NAME_SPACE = process.env.KUBE_NAMESPACE || 'default';

const containerDir = '/home/cwuser/codewind-test-projects/';
const dir = '/tmp/codewind-test-projects/';

const METRIC_TYPES = ['cpu', 'memory', 'gc', 'http']; // Data types are hardcoded in the Project.js
const MOCK_LOADTEST_DIR = path.resolve(__dirname, '../resources/load-test-data');

const travisTimeout = 10 * 60 * 1000;
const testTimeout = {
    short: 20 * 1000,
    med: 120 * 1000,
    maxTravis: travisTimeout - 2000,
};

const pathToApiSpec = path.resolve(__dirname, '../../docs/openapi.yml');

const templateOptions = {
    nodejs: {
        name: 'nodeExpressTemplate',
        url: 'https://github.com/codewind-resources/nodeExpressTemplate',
        language: 'nodejs',
        metricsAvailable: true,
    },
    liberty: {
        name: 'javaMicroProfileTemplate',
        url: 'https://github.com/codewind-resources/javaMicroProfileTemplate',
        language: 'java',
        metricsAvailable: true,
    },
    spring: {
        name: 'springJavaTemplate',
        url: 'https://github.com/codewind-resources/springJavaTemplate',
        language: 'java',
        metricsAvailable: true,
    },
    docker: {
        name: 'pythonTemplate',
        url: 'https://github.com/codewind-resources/pythonTemplate',
        language: 'unknown',
    },
    swift: {
        name: 'swiftTemplate',
        url: 'https://github.com/codewind-resources/swiftTemplate',
        language: 'swift',
        metricsAvailable: true,
    },
    go: {
        name: 'goTemplate',
        url: 'https://github.com/codewind-resources/goTemplate',
        language: 'go',
        metricsAvailable: false,
    },
    lagom: {
        name: 'javaLagomTemplate',
        url: 'https://github.com/codewind-resources/lagomJavaTemplate',
        language: 'java',
    },
    openliberty: {
        name: 'openLibertyTenplate',
        url: 'https://github.com/codewind-resources/openLibertyTemplate',
        language: 'java',
    },
};



const packageJsons = {
    'performance-server': path.resolve(__dirname, '../../src/performance'),
    'performance-loadrunner': path.resolve(__dirname, '../../src/performance/loadrunner'),
    'performance-dashboard': path.resolve(__dirname, '../../src/performance/dashboard'),
    'file-watcher': path.resolve(__dirname, '../../src/pfe/file-watcher/server'),
    'codewind-portal': path.resolve(__dirname, '../../src/pfe/portal'),
};


module.exports = {
    CODEWIND_URL,
    CODEWIND_HOST,
    DEFAULT_USER_NAME,
    ADMIN_COOKIE,
    USER_PATH,
    IBM_GITHUB_AUTH,
    USING_K8S,
    K8S_NAME_SPACE,
    WORKSPACE_DIR,
    CODEWIND_SOCKET_URL,
    containerDir,
    dir,
    testTimeout,
    METRIC_TYPES,
    MOCK_LOADTEST_DIR,
    pathToApiSpec,
    templateOptions,
    packageJsons,
};
