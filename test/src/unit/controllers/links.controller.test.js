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
const chai = require('chai');
const rewire = require('rewire');
const { mockReq, mockRes } = require('sinon-express-mock');

const linksController = rewire('../../../../src/pfe/portal/controllers/links.controller');

chai.should();

describe('links.controller.js', () => {
    describe('customRouter(req)', () => {
        const customRouter = linksController.__get__('customRouter');
        const mockedProject = {
            host: 'host',
            ports: {
                internalPort: 'internalPort',
            },
        };
        it('returns an object containing the protocol, host and port of the project to redirect the request to', () => {
            const request = {
                sanitizeParams: () => '',
                protocol: 'http',
                cw_user: {
                    projectList: {
                        retrieveProject: () => mockedProject,
                    },
                },
            };
            const mockedRequest = mockReq(request);
            const { protocol, host, port } = customRouter(mockedRequest);
            protocol.should.equal('http:');
            host.should.equal(mockedProject.host);
            port.should.equal(mockedProject.ports.internalPort);
        });
    });
    describe('pathRewrite(path, req)', () => {
        const pathRewrite = linksController.__get__('pathRewrite');
        const getFullProxyEndpoint = linksController.__get__('getFullProxyEndpoint');
        it('removes the proxy endpoint from the request path', () => {
            const projectID = 'mockedID';
            const path = `${getFullProxyEndpoint(projectID)}/endpoint`;
            const request = {
                sanitizeParams: () => projectID,
            };
            const mockedRequest = mockReq(request);
            const pathWithoutProxyEndpoint = pathRewrite(path, mockedRequest);
            pathWithoutProxyEndpoint.should.equal('/endpoint');
        });
    });
    describe('createProxyURL(targetProjectID)', () => {
        it('removes the proxy endpoint from the request path', () => {
            const projectID = 'mockedID';
            process.env.HOSTNAME = 'codewind-pfe';
            const proxyURL = linksController.createProxyURL(projectID);
            proxyURL.toString().should.equal(`http://codewind-pfe:9090/links/proxy/${projectID}`);
        });
    });
});
