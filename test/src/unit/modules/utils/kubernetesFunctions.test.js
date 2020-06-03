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
    describe('getPortFromProjectIngressOrRoute(projectID)', function() {
        const sandbox = sinon.createSandbox();
        afterEach(() => {
            sandbox.restore();
        });
        describe('when both the ingress and route return one item in their response body (exactly 1 ingress or route found)', function() {
            it('returns the ingress port as it takes priority when both the ingress and route ports are returned', async function() {
                const { getPortFromProjectIngressOrRoute } = proxyquirePortFromIngressAndRoute('ingress', 'route');
                const port = await getPortFromProjectIngressOrRoute('projectID');
                port.should.equal('ingress');
            });
            it('returns the ingress port as route is null', async function() {
                const { getPortFromProjectIngressOrRoute } = proxyquirePortFromIngressAndRoute('ingress', null);
                const port = await getPortFromProjectIngressOrRoute('projectID');
                port.should.equal('ingress');
            });
            it('returns the route port as ingress is null', async function() {
                const { getPortFromProjectIngressOrRoute } = proxyquirePortFromIngressAndRoute(null, 'route');
                const port = await getPortFromProjectIngressOrRoute('projectID');
                port.should.equal('route');
            });
            it('returns null as both the ingress and route ports are false', async function() {
                const { getPortFromProjectIngressOrRoute } = proxyquirePortFromIngressAndRoute(false, false);
                const port = await getPortFromProjectIngressOrRoute('projectID');
                chai.expect(port).to.equal(null);
            });
        });
        describe('when the ingress or route return an invalid response body (ingress or route not found)', function() {
            it('returns null as both the ingress and route request returns 0 items in the response body', async function() {
                const { getPortFromProjectIngressOrRoute } = proxyquireBodyItemsFromIngressAndRoute([], []);
                const port = await getPortFromProjectIngressOrRoute('projectID');
                chai.expect(port).to.equal(null);
            });
            it('returns null as both the ingress and route request return an invalid response', async function() {
                const invalidResponse = { invalidResponse: true };
                const { getPortFromProjectIngressOrRoute } = proxyquireBodyItemsFromIngressAndRoute(invalidResponse, invalidResponse);
                const port = await getPortFromProjectIngressOrRoute('projectID');
                chai.expect(port).to.equal(null);
            });
            it('returns null as both the ingress and route request throw an error when performing the get request', async function() {
                const throwErr = () => { throw new Error(); };
                const { getPortFromProjectIngressOrRoute } = proxyquireGetIngressAndRoute(throwErr, throwErr);
                const port = await getPortFromProjectIngressOrRoute('projectID');
                chai.expect(port).to.equal(null);
            });
        });
        describe('when the ingress or route return multiple items in the response body', function() {
            it('returns the first item\'s port when only ingress returns valid items', async function() {
                const ingressItems = [
                    createIngressItem(1000),
                    createIngressItem(2000),
                ];
                const { getPortFromProjectIngressOrRoute } = proxyquireBodyItemsFromIngressAndRoute(ingressItems, []);
                const port = await getPortFromProjectIngressOrRoute('projectID');
                port.should.equal(1000);
            });
            it('returns the first item\'s port when only routes returns valid items', async function() {
                const routeItems = [
                    createRouteItem(1000),
                    createRouteItem(2000),
                ];
                const { getPortFromProjectIngressOrRoute } = proxyquireBodyItemsFromIngressAndRoute([], routeItems);
                const port = await getPortFromProjectIngressOrRoute('projectID');
                port.should.equal(1000);
            });
            it('returns the first item\'s port from the ingress when both ingress and routes returns valid items (ingress takes precedence)', async function() {
                const ingressItems = [
                    createIngressItem(1000),
                    createIngressItem(2000),
                ];
                const routeItems = [
                    createRouteItem(3000),
                    createRouteItem(4000),
                ];
                const { getPortFromProjectIngressOrRoute } = proxyquireBodyItemsFromIngressAndRoute(ingressItems, routeItems);
                const port = await getPortFromProjectIngressOrRoute('projectID');
                port.should.equal(1000);
            });
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
            const { getPortFromProjectIngressOrRoute } = proxyquireKubernetesFunctions({
                apis,
                loadSpec: spiedLoadSpec,
            });
            await getPortFromProjectIngressOrRoute('projectID');
            spiedLoadSpec.should.be.calledOnce;
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

function proxyquireGetIngressAndRoute(ingressGetFunc, routesResFunc) {
    return proxyquireKubernetesFunctions({
        apis: {
            ['route.openshift.io']: {
                v1: {
                    ns: () => ({
                        routes: {
                            get: routesResFunc,
                        },
                    }),
                },
            },
            extensions: {
                v1beta1: {
                    ns: () => ({
                        ingresses: {
                            get: ingressGetFunc,
                        },
                    }),
                },
            },
        },
    });
}

function proxyquireBodyItemsFromIngressAndRoute(ingressItems, routesItems) {
    return proxyquireGetIngressAndRoute(() => ({
        body: {
            items: ingressItems,
        },
    }), () => ({
        body: {
            items: routesItems,
        },
    }));
}

function proxyquirePortFromIngressAndRoute(ingressPort, routePort) {
    const ingressItem = createIngressItem(ingressPort);
    const routeItem = createRouteItem(routePort);
    return proxyquireBodyItemsFromIngressAndRoute([ingressItem], [routeItem]);
}

function createIngressItem(servicePort) {
    return {
        spec: { rules: [
            {
                http: {
                    paths: [
                        {
                            backend: {
                                servicePort,
                            },
                        },
                    ],
                },
            },
        ] },
    };
}

function createRouteItem(targetPort) {
    return {
        spec: {
            port: {
                targetPort,
            },
        },
    };
}
