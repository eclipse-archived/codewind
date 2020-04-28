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
const proxyquire = require('proxyquire');
const chai = require('chai');
const chaiAsPromised = require('chai-as-promised');

chai.use(chaiAsPromised);
chai.should();

// These tests can be used to create new functions using the kubernetes-client package.
// They can run data against your current kube context (ensure you're logged in)
//
// Instructions:
//
// In kubernetesFunctions.js
// Change: const client = new Client({ config: config.getInCluster(), version: '1.9'});
// To: const client = new Client({ config: config.fromKubeconfig(), version: '1.9'});
//
// Uncomment the next two lines:
// const yourKubeNamespace = 'default'; // Add your kube namespace here
// process.env.KUBE_NAMESPACE = yourKubeNamespace;
//
// Finally, either comment the function mocking for the test you want to run real data against
//          or write a new test

const mockedConfig = {
    getInCluster: () => '',
};

describe('kubernetesFunctions.js', () => {
    // suppressLogOutput(kubernetesFunctions);
    describe('getServicePortFromProjectIngress(projectID)', () => {
        // const { getServicePortFromProjectIngress } = kubernetesFunctions;
        it('returns 9080 as the mockResponse returned from the kubernetes-client is valid and contains the servicePort 9080', async function() {
            const mockResponse = {
                body: {
                    items: [
                        {
                            spec: { rules: [
                                {
                                    http: {
                                        paths: [
                                            {
                                                backend: {
                                                    servicePort: 9080,
                                                },
                                            },
                                        ],
                                    },
                                },
                            ] },
                        },
                    ],
                },
            };
            const MockKubernetesClient = {
                Client: class Client {
                    constructor() {
                        this.apis = {
                            extensions: {
                                v1beta1: {
                                    ns: () => ({
                                        ingresses: {
                                            get: () => mockResponse,
                                        },
                                    }),
                                },
                            },
                        };
                    }
                },
                config: mockedConfig,
            };
            const kubernetesFunctions = proxyquire('../../../../../src/pfe/portal/modules/utils/kubernetesFunctions', {
                'kubernetes-client': MockKubernetesClient,
            });
            const port = await kubernetesFunctions.getServicePortFromProjectIngress('projectID');
            port.should.equal(9080);
        });
        it('returns null as the mockResponse returned from the kubernetes-client is invalid', async function() {
            const MockKubernetesClient = {
                Client: class Client {
                    constructor() {
                        this.apis = {
                            extensions: {
                                v1beta1: {
                                    ns: () => ({
                                        ingresses: {
                                            get: () => ({
                                                body: {
                                                    items: [{
                                                        invalidItem: true,
                                                    }],
                                                },
                                            }),
                                        },
                                    }),
                                },
                            },
                        };
                    }
                },
                config: mockedConfig,
            };
            const kubernetesFunctions = proxyquire('../../../../../src/pfe/portal/modules/utils/kubernetesFunctions', {
                'kubernetes-client': MockKubernetesClient,
            });
            const port = await kubernetesFunctions.getServicePortFromProjectIngress('projectID');
            chai.expect(port).to.equal(null);
        });
        it('throws an error when the kubernetes-client throws an error', function() {
            const MockKubernetesClient = {
                Client: class Client {
                    constructor() {
                        this.apis = {
                            extensions: {
                                v1beta1: {
                                    ns: () => ({
                                        ingresses: {
                                            get: () => { throw Error('expected error'); },
                                        },
                                    }),
                                },
                            },
                        };
                    }
                },
                config: mockedConfig,
            };
            const kubernetesFunctions = proxyquire('../../../../../src/pfe/portal/modules/utils/kubernetesFunctions', {
                'kubernetes-client': MockKubernetesClient,
            });
            return kubernetesFunctions.getServicePortFromProjectIngress('projectID').should.eventually.rejected;
        });
    });
});
