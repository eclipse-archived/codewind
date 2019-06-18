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

const reqService = require('../../modules/request.service');
const { ADMIN_COOKIE, USING_K8S } = require('../../config');

chai.use(chaiAsPromised);
chai.should();

const endpoints = {
    api: {
        projects: '/api/v1/projects',
    },
    socketIO: '/socket.io/?transport=polling',
};

const whitelistedURL = 'localhost:9090';
const nonWhitelistedURL = 'naughtywebsite.com';

/**
 * Checks that the CORS vulnerabilities are safeguarded against both on our socket.io
 * endpoint which is outside of the API and on an API route.
 *
 * Tests the whitelist and also that the host must match the origin.
 *
 * For more information see https://github.com/OWASP/CheatSheetSeries/blob/master/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.md
 */
describe('CORS Security Vulnerability', () => {

    // in ICP a 404 is returned by ICP before our code is even hit.
    const expectedRejectCode = USING_K8S ? 404 : 403;

    it('rejects requests from non-whitelisted URLs', () => {
        const socketIOResponse = reqService.chai
            .get(endpoints.socketIO)
            .set('origin', nonWhitelistedURL)
            .set('host', nonWhitelistedURL)
            .set('Cookie', ADMIN_COOKIE);

        const apiResponse = reqService.chai
            .post(endpoints.api.projects)
            .set('origin', nonWhitelistedURL)
            .set('host', nonWhitelistedURL)
            .set('Cookie', ADMIN_COOKIE);

        return Promise.all([
            socketIOResponse.should.eventually.have.status(expectedRejectCode),
            apiResponse.should.eventually.have.status(expectedRejectCode),
        ]);
    });

    it('rejects requests where origin and host do not match', () => {
        const socketIOResponse = reqService.chai
            .get(endpoints.socketIO)
            .set('origin', whitelistedURL)
            .set('host', nonWhitelistedURL)
            .set('Cookie', ADMIN_COOKIE);

        const apiResponse = reqService.chai
            .post(endpoints.api.projects)
            .set('origin', whitelistedURL)
            .set('host', nonWhitelistedURL)
            .set('Cookie', ADMIN_COOKIE);

        return Promise.all([
            socketIOResponse.should.eventually.have.status(expectedRejectCode),
            apiResponse.should.eventually.have.status(expectedRejectCode),
        ]);
    });
});
