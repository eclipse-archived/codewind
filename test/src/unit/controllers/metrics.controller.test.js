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
const { mockReq, mockRes } = require('sinon-express-mock');

const metricsController = rewire('../../../../src/pfe/portal/controllers/metrics.controller');
const { suppressLogOutput } = require('../../../modules/log.service');

chai.should();

describe('metrics.controller.js', () => {
    suppressLogOutput(metricsController);
    describe('inject(req, res)', () => {
        it('returns 404 if the specified project does not exist', async() => {
            const request = {
                sanitizeParams: () => 'nonexistentProjectId',
                sanitizeBody: () => 'foo',
                cw_user: {
                    projectList: {
                        retrieveProject: () => {},
                    },
                },
            };
            const req = mockReq(request);
            const res = mockRes();

            await metricsController.inject(req, res);

            res.status.should.be.calledOnceWith(404);
            res.send.should.be.calledOnceWith('Unable to find project nonexistentProjectId');
        });
        it('returns 500 if our server errors while parsing the request', async() => {
            const request = {};
            const req = mockReq(request);
            const res = mockRes();

            await metricsController.inject(req, res);

            res.status.should.be.calledOnceWith(500);
            res.send.args[0][0].should.equal('req.sanitizeParams is not a function');
        });
        it('returns 500 and does not update the project.inf if our server errors while inserting metrics collector into project', async() => {
            const request = {
                sanitizeParams: () => 'goodProjectID',
                sanitizeBody: () => true,
                cw_user: {
                    projectList: {
                        retrieveProject: () => ({
                            workspace: 'test',
                            directory: 'projectDir',
                            projectType: 'unsupportedProjectType',
                        }),
                        updateProject: () => { throw new Error('we should not update the project.inf'); },
                    },
                },
            };
            const req = mockReq(request);
            const res = mockRes();

            await metricsController.inject(req, res);

            res.status.should.be.calledOnceWith(500);
            res.send.args[0][0].should.equal('Injection of metrics collector is not supported for projects of type \'unsupportedProjectType\'');
        });
        it('returns 500 and does not update the project.inf if our server errors while removing metrics collector from project', async() => {
            const request = {
                sanitizeParams: () => 'goodProjectID',
                sanitizeBody: () => false,
                cw_user: {
                    projectList: {
                        retrieveProject: () => ({
                            workspace: 'test',
                            directory: 'projectDir',
                            projectType: 'unsupportedProjectType',
                        }),
                        updateProject: () => { throw new Error('we should not update the project.inf'); },
                    },
                },
            };
            const req = mockReq(request);
            const res = mockRes();

            await metricsController.inject(req, res);

            res.status.should.be.calledOnceWith(500);
            res.send.args[0][0].should.equal('Injection of metrics collector is not supported for projects of type \'unsupportedProjectType\'');
        });
        it('returns 202 and injects metrics collector into project build container if we provide a good request', async() => {
            const request = {
                sanitizeParams: () => 'goodProjectID',
                sanitizeBody: () => true,
                cw_user: {
                    projectList: {
                        retrieveProject: () => ({
                            workspace: 'test',
                            directory: 'projectDir',
                            projectType: 'nodejs',
                        }),
                        updateProject: () => {},
                    },
                },
            };
            const req = mockReq(request);
            const res = mockRes();
            const mockedFunctions = {
                metricsService: {
                    injectMetricsCollectorIntoProject: () => {},
                    removeMetricsCollectorFromProject: () => {},
                },
                syncProjectFilesIntoBuildContainer: () => {},
            };

            await metricsController.__with__(mockedFunctions)(
                () => metricsController.inject(req, res)
            );

            res.sendStatus.should.be.calledOnceWith(202);
            res.status.should.not.be.calledWith(500);
        });
    });
});
