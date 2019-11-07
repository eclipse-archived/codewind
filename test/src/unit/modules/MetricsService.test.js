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
const fs = require('fs-extra');
const path = require('path');
const rewire = require('rewire');

const metricsService = rewire('../../../../src/pfe/portal/modules/MetricsService');

chai.use(chaiAsPromised);
chai.should();

describe('MetricsService.js', () => {
    const projectDir = path.join('.', 'src', 'unit');
    const pathToPackageJson = path.join(projectDir, 'package.json');
    const contentsOfOriginalPackageJson = {
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

    const contentsOfMetricsInjectedPackageJson = {
        /* eslint-disable quote-props, quotes, comma-dangle */
        "name": "node",
        "version": "1.0.0",
        "description": "A generated IBM Cloud application",
        "scripts": {
            "start": "node -r appmetrics-prometheus/attach $npm_package_config_entrypoint",
            "debug": "node --inspect=0.0.0.0:9229 $npm_package_config_entrypoint"
        },
        "dependencies": {
            "body-parser": "^1.18.3",
            "express": "^4.16.4",
            "appmetrics-prometheus": "git+https://git@github.com/CloudNativeJS/appmetrics-prometheus.git#host-metrics-on-codewind-endpoint",
            "cors": "^2.8.5"
        }
        /* eslint-enable quote-props, quotes, comma-dangle */
    };

    describe('injectMetricsCollectorIntoProject(projectLanguage, projectDir)', () => {
        beforeEach(() => {
            fs.writeJSONSync(pathToPackageJson, contentsOfOriginalPackageJson);
        });
        afterEach(() => {
            fs.unlinkSync(pathToPackageJson);
        });
        describe(`('nodejs', <goodProjectDir>)`, () => {
            it(`injects metrics collector into the project's package.json`, async() => {
                await metricsService.injectMetricsCollectorIntoProject('nodejs', projectDir);

                fs.readJSONSync(pathToPackageJson).should.deep.equal(contentsOfMetricsInjectedPackageJson);
            });
        });
        describe(`('unsupportedLanguage', <goodProjectDir>)`, () => {
            it(`throws a useful error`, () => {
                const funcToTest = () => metricsService.injectMetricsCollectorIntoProject('unsupportedLanguage', projectDir);
                return funcToTest().should.be.rejectedWith(`'unsupportedLanguage' is not a supported language`);
            });
        });
    });
    describe('injectMetricsCollectorIntoNodeProject(projectDir)', () => {
        describe('package.json does not have metrics injection code', () => {
            before(() => {
                fs.writeJSONSync(pathToPackageJson, contentsOfOriginalPackageJson);
            });
            after(() => {
                fs.unlinkSync(pathToPackageJson);
            });
            it(`injects metrics collector into the project's package.json`, async() => {
                const funcToTest = metricsService.__get__('injectMetricsCollectorIntoNodeProject');
                await funcToTest(projectDir);

                fs.readJSONSync(pathToPackageJson).should.deep.equal(contentsOfMetricsInjectedPackageJson);
            });
        });
        describe('package.json already has metrics injection code', () => {
            before(() => {
                fs.writeJSONSync(pathToPackageJson, contentsOfMetricsInjectedPackageJson);
            });
            after(() => {
                fs.unlinkSync(pathToPackageJson);
            });
            it(`injects metrics collector into the project's package.json`, async() => {
                const funcToTest = metricsService.__get__('injectMetricsCollectorIntoNodeProject');
                await funcToTest(projectDir);

                fs.readJSONSync(pathToPackageJson).should.deep.equal(contentsOfMetricsInjectedPackageJson);
            });
        });
    });
    describe('getNewContentsOfPackageJson(oldContentsOfPackageJson)', () => {
        it(`returns an object representing a package.json injected with metrics collector`, () => {
            const funcToTest = metricsService.__get__('getNewContentsOfPackageJson');
            const output = funcToTest(contentsOfOriginalPackageJson);
            output.should.deep.equal(contentsOfMetricsInjectedPackageJson);
        });
    });
});
