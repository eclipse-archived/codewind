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
global.codewind = { RUNNING_IN_K8S: false };
const rewire = require('rewire');
const chai = require('chai');
const chaiAsPromised = require('chai-as-promised');

const Links = rewire('../../../../../src/pfe/portal/routes/projects/links.route');
const ProjectLinkError = require('../../../../../src/pfe/portal/modules/utils/errors/ProjectLinkError');
const { suppressLogOutput } = require('../../../../modules/log.service');

chai.use(chaiAsPromised);
chai.should();

describe('links.route.js', () => {
    suppressLogOutput(Links);
    describe('handleHttpError(err, res)', () => {
        const handleHttpError = Links.__get__('handleHttpError');
        const errorCodes = [
            { errCode: ProjectLinkError.CODES.INVALID_PARAMETERS, httpCode: 400 },
            { errCode: ProjectLinkError.CODES.NOT_FOUND, httpCode: 404 },
            { errCode: ProjectLinkError.CODES.EXISTS, httpCode: 409 },
            { errCode: ProjectLinkError.CODES.CONFIG_MAP_NOT_FOUND, httpCode: 404 },
            { errCode: ProjectLinkError.CODES.SERVICE_NOT_FOUND, httpCode: 404 },
            { errCode: ProjectLinkError.CODES.DEPLOYMENT_NOT_FOUND, httpCode: 404 },
            { errCode: 'UNKNOWN_ERROR', httpCode: 500 },
        ];
        errorCodes.forEach(({ errCode, httpCode }) => {
            it(`reports a status of ${httpCode} as the err.code is ${errCode} when res.headersSent is false`, () => {
                function status(code) {
                    code.should.equal(httpCode);
                    return this;
                };
                function send(err) {
                    err.code.should.equal(errCode);
                };
                handleHttpError({ code: errCode }, { status, send });
            });
        });
    });
});
