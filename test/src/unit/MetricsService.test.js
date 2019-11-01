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
const rewire = require('rewire');

const metricsService = rewire('../../../src/pfe/portal/modules/MetricsService');

chai.should();

describe('MetricsService.js', function() {
    describe('getNewContentsOfPackageJson(oldContentsOfPackageJson)', function() {
        it(`returns an object representing a package.json injected with metrics collector`, function() {
            const oldContentsOfPackageJson = {
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
            };

            const funcToTest = metricsService.__get__('getNewContentsOfPackageJson');
            const output = funcToTest(oldContentsOfPackageJson);
            output.should.deep.equal({
                "name": "node",
                "version": "1.0.0",
                "description": "A generated IBM Cloud application",
                "scripts": {
                    "start": "node -r codewind-node-metrics/attach $npm_package_config_entrypoint",
                    "debug": "node --inspect=0.0.0.0:9229 $npm_package_config_entrypoint"
                },
                "dependencies": {
                    "body-parser": "^1.18.3",
                    "express": "^4.16.4",
                    "codewind-node-metrics": "git+https://git@github.com/rwalle61/codewind-node-metrics.git"
                }
            });
        });
    });
});
