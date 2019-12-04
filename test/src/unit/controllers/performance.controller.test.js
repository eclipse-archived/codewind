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

const performanceController = rewire('../../../../src/pfe/portal/controllers/performance.controller');

chai.should();

describe('performance.controller.js', function() {
    describe('getReqToPerfContainer(req, performance_host, performance_port)', function() {
        it(`returns a request object that can be made against the perf container`, function() {
            const req = {
                originalUrl: '/performance/monitor?projectID=15aa93c0-f722-11e9-b99b-6fce084c82cc',
                query: {
                    projectID: 'someProjectID',
                },
                cw_user: {
                    projectList: {
                        retrieveProject: () => ({
                            host: '123.45.67.89',
                            ports: {
                                internalPort: 1234,
                            },
                            language: 'nodejs',
                        }),
                    },
                },
            };
            const performance_host = 'codewind-performance';
            const performance_port = ':9095';

            const funcToTest = performanceController.__get__('getOptionsForReqToPerfContainer');
            const output = funcToTest(
                req,
                performance_host,
                performance_port,
            );

            output.should.deep.equal({
                url: 'http://codewind-performance:9095/performance/monitor?projectID=15aa93c0-f722-11e9-b99b-6fce084c82cc',
                qs: {
                    appOrigin: 'http://123.45.67.89:1234',
                    projectLanguage: 'nodejs',
                },
            });
        });
    });
});
