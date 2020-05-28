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
const proxyquire = require('proxyquire');
const chai = require('chai');
const chaiAsPromised = require('chai-as-promised');
const sinon = require('sinon');

const { testTimeout } = require('../../../../config');

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

const MOCKED_CONFIG = {
    getInCluster: () => '',
};

describe('kubernetesFunctions.js', function() {
    this.timeout(testTimeout.short);
    describe('getProjectIngress(projectID)', function() {
        it('returns the first ingress when the items array has a length of atleast one', async function() {
            const mockResponse = {
                body: {
                    items: [
                        'firstingress',
                        'secondingress',
                    ],
                },
            };
            const { getProjectIngress } = proxyquireKubernetesFunctions({
                apis: {
                    extensions: {
                        v1beta1: {
                            ns: () => ({
                                ingresses: {
                                    get: () => mockResponse,
                                },
                            }),
                        },
                    },
                },
            });
            const ingress = await getProjectIngress('projectID');
            ingress.should.equal('firstingress');
        });
        it('returns the null when the items array is empty', async function() {
            const mockResponse = {
                body: {
                    items: [],
                },
            };
            const { getProjectIngress } = proxyquireKubernetesFunctions({
                apis: {
                    extensions: {
                        v1beta1: {
                            ns: () => ({
                                ingresses: {
                                    get: () => mockResponse,
                                },
                            }),
                        },
                    },
                },
            });
            const ingress = await getProjectIngress('projectID');
            chai.expect(ingress).to.equal(null);
        });
    });
    describe('getServicePortFromProjectIngress(projectID)', function() {
        it('returns 9080 as the mockResponse returned from the kubernetes-client is valid and contains the servicePort 9080', async function() {
            const { getServicePortFromProjectIngress } = proxyquireServicePortFromIngressAndRoute(9080, null);
            const port = await getServicePortFromProjectIngress('projectID');
            port.should.equal(9080);
        });
        it('returns null as the mockResponse returned from the kubernetes-client is invalid', async function() {
            const { getServicePortFromProjectIngress } = proxyquireKubernetesFunctions({
                apis: {
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
                },
            });
            const port = await getServicePortFromProjectIngress('projectID');
            chai.expect(port).to.equal(null);
        });
        it('returns null the kubernetes-client throws an error', async function() {
            const { getServicePortFromProjectIngress } = proxyquireKubernetesFunctions({
                apis: {
                    extensions: {
                        v1beta1: {
                            ns: () => ({
                                ingresses: {
                                    get: () => { throw Error('expected error'); },
                                },
                            }),
                        },
                    },
                },
            });
            const port = await getServicePortFromProjectIngress('projectID');
            chai.expect(port).to.equal(null);
        });
    });
    describe('getProjectRoute(projectID)', function() {
        const sandbox = sinon.createSandbox();
        afterEach(() => {
            sandbox.restore();
        });
        it('returns the first route when the items array has a length of atleast one', async function() {
            const mockResponse = {
                body: {
                    items: [
                        'firstroute',
                        'secondroute',
                    ],
                },
            };
            const { getProjectRoute } = proxyquireKubernetesFunctions({
                apis: {
                    ['route.openshift.io']: {
                        v1: {
                            ns: () => ({
                                routes: {
                                    get: () => mockResponse,
                                },
                            }),
                        },
                    },
                },
            });
            const ingress = await getProjectRoute('projectID');
            ingress.should.equal('firstroute');
        });
        it('returns the null when the items array is empty', async function() {
            const mockResponse = {
                body: {
                    items: [],
                },
            };
            const { getProjectRoute } = proxyquireKubernetesFunctions({
                apis: {
                    ['route.openshift.io']: {
                        v1: {
                            ns: () => ({
                                routes: {
                                    get: () => mockResponse,
                                },
                            }),
                        },
                    },
                },
            });
            const ingress = await getProjectRoute('projectID');
            chai.expect(ingress).to.equal(null);
        });
        it('calls client.loadSpec when \'route.openshift.io\' does not exist in the apis object', async function() {
            const apis = {};
            const spiedLoadSpec = sinon.spy(() => {
                // simulate loadSpec updating the apis
                apis['route.openshift.io'] = {
                    v1: {
                        ns: () => ({
                            routes: {
                                get: () => [],
                            },
                        }),
                    },
                };
            });
            const { getProjectRoute } = proxyquireKubernetesFunctions({
                apis,
                loadSpec: spiedLoadSpec,
            });
            await getProjectRoute('projectID');
            spiedLoadSpec.should.be.calledOnce;
        });
    });
    describe('getServicePortFromProjectRoute(projectID)', function() {
        it('returns 9080 as the mockResponse returned from the kubernetes-client is valid and contains the servicePort 9080', async function() {
            const { getServicePortFromProjectRoute } = proxyquireServicePortFromIngressAndRoute(null, 9080);
            const port = await getServicePortFromProjectRoute('projectID');
            port.should.equal(9080);
        });
        it('returns null as the mockResponse returned from the kubernetes-client is invalid', async function() {
            const { getServicePortFromProjectRoute } = proxyquireKubernetesFunctions({
                apis: {
                    ['route.openshift.io']: {
                        v1: {
                            ns: () => ({
                                routes: {
                                    get: () => [{ invalidResponse: true }],
                                },
                            }),
                        },
                    },
                },
            });
            const port = await getServicePortFromProjectRoute('projectID');
            chai.expect(port).to.equal(null);
        });
        it('returns null the kubernetes-client throws an error', async function() {
            const { getServicePortFromProjectRoute } = proxyquireKubernetesFunctions({
                apis: {
                    ['route.openshift.io']: {
                        v1: {
                            ns: () => ({
                                routes: {
                                    get: () => { throw Error('expected error'); },
                                },
                            }),
                        },
                    },
                },
            });
            const port = await getServicePortFromProjectRoute('projectID');
            chai.expect(port).to.equal(null);
        });
    });
    describe('getServicePortFromProjectIngressOrRoute(projectID)', function() {
        it('returns the ingress port as it takes priority when both the ingress and route ports are returned', async function() {
            const { getServicePortFromProjectIngressOrRoute } = proxyquireServicePortFromIngressAndRoute('ingress', 'route');
            const port = await getServicePortFromProjectIngressOrRoute('projectID');
            port.should.equal('ingress');
        });
        it('returns the ingress port as route is null', async function() {
            const { getServicePortFromProjectIngressOrRoute } = proxyquireServicePortFromIngressAndRoute('ingress', null);
            const port = await getServicePortFromProjectIngressOrRoute('projectID');
            port.should.equal('ingress');
        });
        it('returns the route port as ingress is null', async function() {
            const { getServicePortFromProjectIngressOrRoute } = proxyquireServicePortFromIngressAndRoute(null, 'route');
            const port = await getServicePortFromProjectIngressOrRoute('projectID');
            port.should.equal('route');
        });
        it('returns null as both the ingress and route ports are false', async function() {
            const { getServicePortFromProjectIngressOrRoute } = proxyquireServicePortFromIngressAndRoute(false, false);
            const port = await getServicePortFromProjectIngressOrRoute('projectID');
            chai.expect(port).to.equal(null);
        });
    });
});

function proxyquireKubernetesFunctions(functionsToAdd, noCallThru = true) {
    const mockedKubernetesClient = {
        Client: class Client {
            constructor() {
                for (const key in functionsToAdd) {
                    if (functionsToAdd.hasOwnProperty(key)) {
                        this[key] = functionsToAdd[key];
                    }
                }
            }
        },
        config: MOCKED_CONFIG,
        '@noCallThru': noCallThru, // Only disable this if you really need to, it slows down the tests
    };
    const proxiedKubernetesFunctions = proxyquire('../../../../../src/pfe/portal/modules/utils/kubernetesFunctions', {
        'kubernetes-client': mockedKubernetesClient,
    });
    return proxiedKubernetesFunctions;
}

function proxyquireServicePortFromIngressAndRoute(ingressResponse, routeResponse) {
    return proxyquireKubernetesFunctions({
        apis: {
            ['route.openshift.io']: {
                v1: {
                    ns: () => ({
                        routes: {
                            get: () => ({
                                body: {
                                    items: [
                                        {
                                            spec: {
                                                port: {
                                                    targetPort: routeResponse,
                                                },
                                            },
                                        },
                                    ],
                                },
                            }),
                        },
                    }),
                },
            },
            extensions: {
                v1beta1: {
                    ns: () => ({
                        ingresses: {
                            get: () => ({
                                body: {
                                    items: [
                                        {
                                            spec: { rules: [
                                                {
                                                    http: {
                                                        paths: [
                                                            {
                                                                backend: {
                                                                    servicePort: ingressResponse,
                                                                },
                                                            },
                                                        ],
                                                    },
                                                },
                                            ] },
                                        },
                                    ],
                                },
                            }),
                        },
                    }),
                },
            },
        },
    });
}
