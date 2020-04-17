/*******************************************************************************
 * Copyright (c) 2020 IBM Corporation and others.
 * All rights reserved. This program and the accompanying materials
 * are made available under the terms of the Eclipse Public License v2.0
 * which accompanies this distribution, and is available at
 * http://www.eclipse.org/legal/epl-v20.html
 *
 * Contributors:
 *     IBM Corporation - initial API and implementation
*******************************************************************************/
const rewire = require('rewire');
const sinon = require('sinon');
const chai = require('chai');
const chaiAsPromised = require('chai-as-promised');
const { c } = require('compress-tag');

const metricsStatusChecker = rewire('../../../../../src/pfe/portal/modules/utils/metricsStatusChecker');
const { suppressLogOutput } = require('../../../../modules/log.service');

chai.use(chaiAsPromised);
chai.should();

describe('metricsStatusChecker.js', function() {
    suppressLogOutput(metricsStatusChecker);
    describe('getMetricStatusForProject(project)', function() {
        const { getMetricStatusForProject } = metricsStatusChecker;
        const mockProject = {
            projectID: 'projectID',
            language: 'java',
            host: 'host',
            ports: {
                internalPort: 'internalPort',
            },
            projectPath: () => 'projectPath',
        };
        const defaultCapabilities = {
            liveMetricsAvailable: false,
            metricsEndpoint: false,
            appmetricsEndpoint: false,
            microprofilePackageFoundInBuildFile: false,
            appmetricsPackageFoundInBuildFile: false,
        };
        it('returns the metricsStatus object for a project that is not running and has no files', async function() {
            const { capabilities, metricsDashHost } = await getMetricStatusForProject(mockProject);
            capabilities.should.deep.equal(defaultCapabilities);
            metricsDashHost.should.deep.equal({
                hosting: null,
                path: null,
            });
        });
        [
            { language: 'java', fileContents: 'javametrics\n<artifactId>microprofile</artifactId>', mpPac: true, apEndpoint: '/javametrics-dash' },
            { language: 'nodejs', fileContents: '{"dependencies":{"appmetrics-dash": "1.0.0"}}', apEndpoint: '/appmetrics-dash' },
            { language: 'javascript', fileContents: '{"dependencies":{"appmetrics-dash": "1.0.0"}}', apEndpoint: '/appmetrics-dash' },
            { language: 'swift', fileContents: 'SwiftMetrics.git', apEndpoint: '/swiftmetrics-dash' },
            { language: 'other', fileContents: 'notanappmetricspackage' },
        ].forEach(({ language, fileContents, mpPac, apEndpoint }) => {
            const microprofilePackageFoundInBuildFile = (mpPac) ? mpPac : false;
            const appmetricsPackageFoundInBuildFile = (apEndpoint) ? true : false;
            const appmetricsEndpoint = (apEndpoint) ? apEndpoint : false;
            describe(`when language === ${language}`, function() {
                it(`returns microprofilePackage as ${microprofilePackageFoundInBuildFile}, appmetricsPackage as ${appmetricsPackageFoundInBuildFile} but the endpoints as false (not running)`, async function() {
                    metricsStatusChecker.__set__('fs', {
                        pathExists: sinon.stub().returns(true),
                        readFile: sinon.stub().returns(fileContents),
                    });
                    const { capabilities, metricsDashHost } = await getMetricStatusForProject({ ...mockProject, language });
                    capabilities.should.deep.equal({
                        ...defaultCapabilities,
                        microprofilePackageFoundInBuildFile,
                        appmetricsPackageFoundInBuildFile,
                    });
                    metricsDashHost.should.deep.equal({
                        hosting: null,
                        path: null,
                    });
                });
                it(c`
                returns microprofilePackage as ${microprofilePackageFoundInBuildFile}, appmetricsPackage as ${appmetricsPackageFoundInBuildFile},
                the metricsEndpoint as '/metrics' and the appmetricsEndpoint as ${appmetricsEndpoint} (running)
                `, async function() {
                    metricsStatusChecker.__set__('fs', {
                        pathExists: sinon.stub().returns(true),
                        readFile: sinon.stub().returns(fileContents),
                    });
                    // The mocking assumes that if an appmetrics package exists for a language, the project will have it
                    const mockedGetActiveMetricsURLs = sinon.stub().returns({
                        '/metrics': true,
                        '/appmetrics-dash': (language === 'nodejs' || language === 'javascript') ? true : false,
                        '/javametrics-dash': (language === 'java') ? true : false,
                        '/swiftmetrics-dash': ((language === 'swift') ? true : false),
                        '/actuator/prometheus': true,
                    });
                    const unsetGetActiveMetrics = metricsStatusChecker.__set__('getActiveMetricsURLs', mockedGetActiveMetricsURLs);
                    const metricsEndpoint = '/metrics'; // metrics endpoint always exists for these tests
                    const populatedHostingAndPath = {
                        hosting: (language === 'java') ? 'performanceContainer' : 'project', // Java is the only language that uses the performanceDashboard
                        path: (language === 'java') ? '/performance/monitor/dashboard/java?theme=dark&projectID=projectID' : `${appmetricsEndpoint}/?theme=dark`,
                    };
                    const expectedMetricsDashHost = (!appmetricsEndpoint) ? { hosting: null, path: null } : populatedHostingAndPath;
                    const { capabilities, metricsDashHost } = await getMetricStatusForProject({ ...mockProject, language });
                    capabilities.should.deep.equal({
                        liveMetricsAvailable: true,
                        metricsEndpoint,
                        appmetricsEndpoint,
                        microprofilePackageFoundInBuildFile,
                        appmetricsPackageFoundInBuildFile,
                    });
                    metricsDashHost.should.deep.equal(expectedMetricsDashHost);
                    unsetGetActiveMetrics();
                });
            });
        });
    });
    describe('hasAppmetricsInFileSystem(projectPath, projectLanguage)', function() {
        const hasAppmetricsInFileSystem = metricsStatusChecker.__get__('hasAppmetricsInFileSystem');
        ['java', 'nodejs', 'javascript', 'swift'].forEach((language) => {
            it(`returns true as a valid projectPath and projectLanguage === ${language} and doesMetricsPackageExist returns true`, async function() {
                metricsStatusChecker.__set__('doesMetricsPackageExist', sinon.stub().returns(true));
                metricsStatusChecker.__set__('fs', { pathExists: sinon.stub().returns(true) });
                const metricsAvailable = await hasAppmetricsInFileSystem('', language);
                metricsAvailable.should.be.true;
            });
        });
        it('returns false as the projectLanguage is invalid', async function() {
            const metricsAvailable = await hasAppmetricsInFileSystem('', 'invalid');
            metricsAvailable.should.be.false;
        });
        it('returns false as the file does not exist', async function() {
            metricsStatusChecker.__set__('fs', { pathExists: sinon.stub().returns(false) });
            const metricsAvailable = await hasAppmetricsInFileSystem('', 'java');
            metricsAvailable.should.be.false;
        });
    });
    describe('doesMetricsPackageExist(pathOfFileToCheck, projectLanguage)', function() {
        const doesMetricsPackageExist = metricsStatusChecker.__get__('doesMetricsPackageExist');
        describe('projectLanguage === nodejs || javascript', function() {
            it('returns true as the package.json contains "appmetrics-dash" as a dependency and language is nodejs', async function() {
                const packageJSON = '{"dependencies":{"appmetrics-dash": "1.0.0"}}';
                metricsStatusChecker.__set__('fs', { readFile: sinon.stub().returns(packageJSON) });
                const packageExists = await doesMetricsPackageExist('', 'nodejs');
                packageExists.should.be.true;
            });
            it('returns true as the package.json contains "appmetrics-dash" as a dependency and language is javascript', async function() {
                const packageJSON = '{"dependencies":{"appmetrics-dash": "1.0.0"}}';
                metricsStatusChecker.__set__('fs', { readFile: sinon.stub().returns(packageJSON) });
                const packageExists = await doesMetricsPackageExist('', 'javascript');
                packageExists.should.be.true;
            });
            it('returns false as the package.json does not contain "appmetrics-dash" as a dependency', async function() {
                const packageJSON = '{"dependencies":{"appmetrics": "1.0.0"}}';
                metricsStatusChecker.__set__('fs', { readFile: sinon.stub().returns(packageJSON) });
                const packageExists = await doesMetricsPackageExist('', 'javascript');
                packageExists.should.be.false;
            });
            it('returns false as the package.json does not contain a dependency object', async function() {
                const packageJSON = '{"name":"test"}';
                metricsStatusChecker.__set__('fs', { readFile: sinon.stub().returns(packageJSON) });
                const packageExists = await doesMetricsPackageExist('', 'javascript');
                packageExists.should.be.false;
            });
            it('returns false as the package.json is not valid JSON', async function() {
                const packageJSON = 'invalid json';
                metricsStatusChecker.__set__('fs', { readFile: sinon.stub().returns(packageJSON) });
                const packageExists = await doesMetricsPackageExist('', 'javascript');
                packageExists.should.be.false;
            });
        });
        describe('projectLanguage === java', function() {
            it('returns true as the file contains "javametrics"', async function() {
                const fileToCheck = 'javametrics';
                metricsStatusChecker.__set__('fs', { readFile: sinon.stub().returns(fileToCheck) });
                const packageExists = await doesMetricsPackageExist('', 'java');
                packageExists.should.be.true;
            });
            it('returns false as the file does not contain "javametrics"', async function() {
                const fileToCheck = 'string';
                metricsStatusChecker.__set__('fs', { readFile: sinon.stub().returns(fileToCheck) });
                const packageExists = await doesMetricsPackageExist('', 'java');
                packageExists.should.be.false;
            });
        });
        describe('projectLanguage === swift', function() {
            it('returns true as the file contains "SwiftMetrics.git"', async function() {
                const fileToCheck = 'SwiftMetrics.git';
                metricsStatusChecker.__set__('fs', { readFile: sinon.stub().returns(fileToCheck) });
                const packageExists = await doesMetricsPackageExist('', 'swift');
                packageExists.should.be.true;
            });
            it('returns false as the file does not contain "SwiftMetrics.git"', async function() {
                const fileToCheck = 'string';
                metricsStatusChecker.__set__('fs', { readFile: sinon.stub().returns(fileToCheck) });
                const packageExists = await doesMetricsPackageExist('', 'swift');
                packageExists.should.be.false;
            });
        });
        it('returns false as the file could not be read', async function() {
            metricsStatusChecker.__set__('fs', { readFile: sinon.stub.rejects });
            const metricsPackageExists = await doesMetricsPackageExist('', '');
            metricsPackageExists.should.be.false;
        });
        it('returns false as the projectLanguage is invalid', async function() {
            metricsStatusChecker.__set__('fs', { readFile: sinon.stub().returns('') });
            const packageExists = await doesMetricsPackageExist('', 'invalidLanguage');
            packageExists.should.be.false;
        });
    });
    describe('hasMicroprofileMetricsInFileSystem(projectPath, projectLanguage)', function() {
        const hasMicroprofileMetricsInFileSystem = metricsStatusChecker.__get__('hasMicroprofileMetricsInFileSystem');
        it('returns true as the language is java and the artifact microprofile is found in the pom.xml', async function() {
            let validDependency = '<dependency>';
            validDependency += '<groupId>org.eclipse.microprofile</groupId>';
            validDependency += '<artifactId>microprofile</artifactId>';
            validDependency += '<version>2.0.1</version>';
            validDependency += '</dependency>';
            const mockedFs = {
                pathExists: sinon.stub().returns(true),
                readFile: sinon.stub().returns(validDependency),
            };
            metricsStatusChecker.__set__('fs', mockedFs);
            const hasMetrics = await hasMicroprofileMetricsInFileSystem('/dummypath', 'java');
            hasMetrics.should.be.true;
        });
        it('returns false as the language is not java', async function() {
            const hasMetrics = await hasMicroprofileMetricsInFileSystem('/dummypath', 'notjava');
            hasMetrics.should.be.false;
        });
        it('returns false as the pom.xml does not exist', async function() {
            const mockedFs = {
                pathExists: sinon.stub().returns(false),
            };
            metricsStatusChecker.__set__('fs', mockedFs);
            const hasMetrics = await hasMicroprofileMetricsInFileSystem('/dummypath', 'java');
            hasMetrics.should.be.false;
        });
        it('returns false as the pom.xml does not contain ', async function() {
            const mockedFs = {
                pathExists: sinon.stub().returns(false),
                readFile: sinon.stub().returns('invalidpom.xml'),
            };
            metricsStatusChecker.__set__('fs', mockedFs);
            const hasMetrics = await hasMicroprofileMetricsInFileSystem('/dummypath', 'java');
            hasMetrics.should.be.false;
        });
    });
    
    describe('getActiveMetricsURLs(host, port)', function() {
        const getActiveMetricsURLs = metricsStatusChecker.__get__('getActiveMetricsURLs');
        it('returns all endpoints as true as isMetricsEndpoint is stubbed to always return true', async function() {
            const spiedIsMetricsEndpoint = sinon.stub().returns(true);
            metricsStatusChecker.__set__('isMetricsEndpoint', spiedIsMetricsEndpoint);
            const activeDashboardObject = await getActiveMetricsURLs('host', 'port');
            activeDashboardObject.should.deep.equal({
                '/metrics': true,
                '/appmetrics-dash': true,
                '/javametrics-dash': true,
                '/swiftmetrics-dash': true,
                '/actuator/prometheus': true,
            });
            spiedIsMetricsEndpoint.callCount.should.equal(5);
        });
        it('throws an error as isMetricsEndpoint throws an error', function() {
            metricsStatusChecker.__set__('isMetricsEndpoint', sinon.stub.rejects);
            return getActiveMetricsURLs('host', 'port').should.eventually.be.rejected;
        });
    });
    describe('isMetricsEndpoint(host, port, path)', function() {
        const isMetricsEndpoint = metricsStatusChecker.__get__('isMetricsEndpoint');
        it('returns true as the page source contains graphmetrics as a JavaScript source', async function() {
            const mockedRes = {
                statusCode: 200,
                body: '<script type="text/javascript" src="graphmetrics/js/header.js"></script>',
            };
            metricsStatusChecker.__set__('asyncHttpRequest', () => mockedRes);

            const isEndpoint = await isMetricsEndpoint('host', 'port', 'path');
            isEndpoint.should.be.true;
        });
        it('returns true as the page source contains prometheus data', async function() {
            const mockedRes = {
                statusCode: 200,
                body: 'api_http_requests_total{method="POST", handler="/messages"} 0.5\n',
            };
            metricsStatusChecker.__set__('asyncHttpRequest', () => mockedRes);

            const isEndpoint = await isMetricsEndpoint('host', 'port', 'path');
            isEndpoint.should.be.true;
        });
        it('returns false statusCode is not 200', async function() {
            const mockedRes = {
                statusCode: 500,
                body: 'some random data',
            };
            metricsStatusChecker.__set__('asyncHttpRequest', () => mockedRes);

            const isEndpoint = await isMetricsEndpoint('host', 'port', 'path');
            isEndpoint.should.be.false;
        });
        it('returns false as the body is null', async function() {
            const mockedRes = {
                statusCode: 200,
                body: null,
            };
            metricsStatusChecker.__set__('asyncHttpRequest', () => mockedRes);

            const isEndpoint = await isMetricsEndpoint('host', 'port', 'path');
            isEndpoint.should.be.false;
        });
        it('returns false as the page source is not Appmetrics or valid Prometheus data', async function() {
            const mockedRes = {
                statusCode: 200,
                body: 'some random data',
            };
            metricsStatusChecker.__set__('asyncHttpRequest', () => mockedRes);

            const isEndpoint = await isMetricsEndpoint('host', 'port', 'path');
            isEndpoint.should.be.false;
        });
        it('returns false as asyncHttpRequest threw an error', async function() {
            const throwErr = () => { throw new Error('HTTP_ERROR'); };
            metricsStatusChecker.__set__('asyncHttpRequest', throwErr);

            const isEndpoint = await isMetricsEndpoint('host', 'port', 'path');
            isEndpoint.should.be.false;
        });
    });
    describe('isAppmetricsFormat(html)', function() {
        const isAppmetricsFormat = metricsStatusChecker.__get__('isAppmetricsFormat');
        it('returns true as graphmetrics is found', function() {
            const html = '<script src="graphmetrics/js"></script>';
            const isAppmetrics = isAppmetricsFormat(html);
            isAppmetrics.should.be.true;
        });
        it('returns false as graphmetrics is not found', function() {
            const html = '<script src="myownmodule/js"></script>';
            const isAppmetrics = isAppmetricsFormat(html);
            isAppmetrics.should.be.false;
        });
    });
    describe('isPrometheusFormat(string)', function() {
        const isPrometheusFormat = metricsStatusChecker.__get__('isPrometheusFormat');
        it('returns true as the given string is valid', function() {
            const testString = 'api_http_requests_total 0.5\n'
                            + '# A comment\n';
            const isValid = isPrometheusFormat(testString);
            isValid.should.be.true;
        });
        it('returns true and ignores the space in the {}', function() {
            const testString = 'api_http_requests_total{method="POST", handler="/messages"} 0.5\n'
                            + '# A comment\n';
            const isValid = isPrometheusFormat(testString);
            isValid.should.be.true;
        });
        it('returns true when given a comment', function() {
            const testString = '# comment \n';
            const isValid = isPrometheusFormat(testString);
            isValid.should.be.true;
        });
        it('returns false prometheus property does not have a value', function() {
            const testString = 'api_http_requests_total{method="POST", handler="/messages"}\n';
            const isValid = isPrometheusFormat(testString);
            isValid.should.be.false;
        });
        it('returns false string is invalid', function() {
            const testString = 'an invalid string\n';
            const isValid = isPrometheusFormat(testString);
            isValid.should.be.false;
        });
    });
    describe('getMetricsDashboardHostAndPath(endpoints, projectID, projectLanguage)', function() {
        const getMetricsDashboardHostAndPath = metricsStatusChecker.__get__('getMetricsDashboardHostAndPath');
        const allActiveEndpoints = {
            '/metrics': true,
            '/appmetrics-dash': true,
            '/javametrics-dash': true,
            '/swiftmetrics-dash': true,
            '/actuator/prometheus': true,
        };
        const allDisabledEndpoints = {
            '/metrics': false,
            '/appmetrics-dash': false,
            '/javametrics-dash': false,
            '/swiftmetrics-dash': false,
            '/actuator/prometheus': false,
        };
        describe('projectLanguage === java', function() {
            it('returns hosting as the performanceContainer as all endpoints will be active and /metrics is first on the priority list', async function() {
                const { hosting, path } = await getMetricsDashboardHostAndPath(allActiveEndpoints, 'projectid', 'java');
                hosting.should.equal('performanceContainer');
                path.should.equal('/performance/monitor/dashboard/java?theme=dark&projectID=projectid');
            });
            it('returns hosting as the project as /metrics is disabled but /javametrics-dash is active', async function() {
                const { hosting, path } = await getMetricsDashboardHostAndPath({ ...allDisabledEndpoints, '/javametrics-dash': true }, 'projectid', 'java');
                hosting.should.equal('project');
                path.should.equal('/javametrics-dash/?theme=dark');
            });
        });
        describe('projectLanguage === nodejs', function() {
            it('does not return /metrics even though all it is reachable as it is a nodejs project type (not java)', async function() {
                const { hosting, path } = await getMetricsDashboardHostAndPath(allActiveEndpoints, 'projectid', 'nodejs');
                hosting.should.equal('project');
                path.should.equal('/appmetrics-dash/?theme=dark');
            });
            it('returns hosting as the project as /appmetrics-dash is reachable', async function() {
                const { hosting, path } = await getMetricsDashboardHostAndPath({ ...allDisabledEndpoints , '/appmetrics-dash': true }, 'projectid', 'nodejs');
                hosting.should.equal('project');
                path.should.equal('/appmetrics-dash/?theme=dark');
            });
        });
        it('returns hosting as project when /swiftmetrics-dash is reachable regardless of project type', async function() {
            const { hosting, path } = await getMetricsDashboardHostAndPath({ ...allDisabledEndpoints , '/swiftmetrics-dash': true }, 'projectid', 'other');
            hosting.should.equal('project');
            path.should.equal('/swiftmetrics-dash/?theme=dark');
        });
        it('returns hosting as null when /metrics is the only endpoint reachable as only java is supported for /metrics', async function() {
            const hostingAndPath = await getMetricsDashboardHostAndPath({ ...allDisabledEndpoints , '/metrics': true }, 'projectid', 'other');
            hostingAndPath.should.deep.equal({ hosting: null, path: null });
        });
        it('returns hosting as null as no endpoints are active', async function() {
            const hostingAndPath = await getMetricsDashboardHostAndPath(allDisabledEndpoints, 'projectid', 'java');
            hostingAndPath.should.deep.equal({ hosting: null, path: null });
        });
    });
    describe('getDashboardPath(metricsDashHost, projectMetricEndpoint, projectID, language)', function() {
        const getDashboardPath = metricsStatusChecker.__get__('getDashboardPath');
        const params = {
            metricsDashHost: {
                proj: 'project',
                perf: 'performanceContainer',
            },
            endpoint: '/appmetrics-dash',
            projectID: 'projectID',
        };
        it('returns the projectMetricEndpoint when the metricsDashHost is project', function() {
            const path = getDashboardPath(params.metricsDashHost.proj, params.endpoint, params.projectID, '', false);
            path.should.equal(`${params.endpoint}/?theme=dark`);
        });
        it('returns the performance dashboard when the metricsDashHost is performanceContainer and the language is java', function() {
            const path = getDashboardPath(params.metricsDashHost.perf, params.endpoint, params.projectID, 'java', false);
            path.should.equal(`/performance/monitor/dashboard/java?theme=dark&projectID=${params.projectID}`);
        });
        it('returns the performance dashboard when injectMetrics is true and the language is java', function() {
            const path = getDashboardPath(params.metricsDashHost.perf, params.endpoint, params.projectID, 'java', true);
            path.should.equal(`/performance/monitor/dashboard/java?theme=dark&projectID=${params.projectID}`);
        });
        it('returns the performance dashboard when the metricsDashHost is performanceContainer and the language is nodejs', function() {
            const path = getDashboardPath(params.metricsDashHost.perf, params.endpoint, params.projectID, 'nodejs', false);
            path.should.equal(`/performance/monitor/dashboard/nodejs?theme=dark&projectID=${params.projectID}`);
        });
        it('returns the performance dashboard when injectMetrics is true and the language is nodejs', function() {
            const path = getDashboardPath(params.metricsDashHost.perf, params.endpoint, params.projectID, 'nodejs', true);
            path.should.equal(`/performance/monitor/dashboard/nodejs?theme=dark&projectID=${params.projectID}`);
        });
        it('returns null when metricsDashHost is invalid and injectMetrics is false', function() {
            const path = getDashboardPath('invalid', params.endpoint, params.projectID, 'java', false);
            chai.expect(path).to.equal(null);
        });
        it('returns null when the metricsDashHost is project but injectMetrics is true', function() {
            const path = getDashboardPath(params.metricsDashHost.proj, params.endpoint, params.projectID, '', true);
            chai.expect(path).to.equal(null);
        });
        it('returns null when the metricsDashHost is performanceContainer, the language is not nodejs or java and injectMetrics is false', function() {
            const path = getDashboardPath(params.metricsDashHost.perf, params.endpoint, params.projectID, 'notnodejsorjava', false);
            chai.expect(path).to.equal(null);
        });
    });
});
