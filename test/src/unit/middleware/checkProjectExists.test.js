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
const chai = require('chai');
const sinon = require('sinon');

chai.should();

const { checkProjectExists, getProjectFromReq } = rewire('../../../../src/pfe/portal/middleware/checkProjectExists');

const next = () => {};

describe('checkProjectExists.js', function() {
    const sandbox = sinon.createSandbox();
    describe('checkProjectExists(req, res, next)', function() {
        it('reports the status as 404 as the project does not exist (is false)', function() {
            const failsToRetrieveProject = {
                sanitizeParams: () => '',
                cw_user: {
                    projectList: {
                        retrieveProject: () => false,
                    },
                },
            };
            function codeShouldBe404(code) {
                code.should.equal(404);
                return this;
            };
            const sendShouldBe = (text) => {
                text.should.equal(`Project with ID '' does not exist on the Codewind server`);
            };
            const spiedCodeShouldBe404 = sandbox.spy(codeShouldBe404);
            const spiedNext = sandbox.spy(next);
            checkProjectExists(failsToRetrieveProject, { status: spiedCodeShouldBe404, send: sendShouldBe }, spiedNext);
            spiedCodeShouldBe404.should.be.calledOnce;
            spiedNext.should.not.be.called;
        });
        it('does nothing and calls next() as the project is found (is true)', function() {
            const successfullyRetrievesProject = {
                sanitizeParams: () => '',
                cw_user: {
                    projectList: {
                        retrieveProject: () => true,
                    },
                },
            };
            const spiedSendStatus = sandbox.spy(() => {});
            const spiedNext = sandbox.spy(next);
            checkProjectExists(successfullyRetrievesProject, { sendStatus: spiedSendStatus }, spiedNext);
            spiedSendStatus.should.not.be.called;
            spiedNext.should.be.calledOnce;
        });
    });
    describe('getProjectFromReq(req)', function() {
        it('returns project from the req object', () => {
            const spiedRetrieveProject = sandbox.spy(() => true);
            const validReq = {
                sanitizeParams: () => '',
                cw_user: {
                    projectList: {
                        retrieveProject: spiedRetrieveProject,
                    },
                },
            };
            getProjectFromReq(validReq).should.be.true;
            spiedRetrieveProject.should.be.calledOnce;
        });
    });
});

