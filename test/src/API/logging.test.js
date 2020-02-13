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
const chaiResValidator = require('chai-openapi-response-validator');

const reqService = require('../../modules/request.service');
const { 
    ADMIN_COOKIE,
    pathToApiSpec,
} = require('../../config');

chai.use(chaiResValidator(pathToApiSpec));
chai.should();

const validLevels = ['error', 'warn', 'info', 'debug', 'trace'];

const getLogLevel = () => reqService.chai
    .get('/api/v1/logging')
    .set('Cookie', ADMIN_COOKIE);

const setLogLevel = (level) => reqService.chai
    .put('/api/v1/logging')
    .set('Cookie', ADMIN_COOKIE)
    .send({ level });


describe('Logging API tests (these `it` blocks depend on each other passing)', function() {
    let originalLogLevel;

    after('reset log level to original level', async function() {
        const res = await setLogLevel(originalLogLevel);
        res.should.have.status(200);
    });

    it('returns 200 and logging info when GET /logging is called', async function() {
        const res = await getLogLevel();
        res.should.have.status(200);
        res.should.satisfyApiSpec;
        res.body.allLevels.should.have.members(validLevels);

        // save log level to reset after tests
        originalLogLevel = res.body.currentLevel;
    });

    it('returns 400 when PUT /logging is called with body { level : unknownLogLevel }', async function() {
        const res = await setLogLevel('unknownLogLevel');
        res.should.have.status(400);
        res.should.satisfyApiSpec;
        res.text.should.include('Invalid logging level requested');
    });

    it('returns 200 when PUT /logging is called with body { level : debug }', async function() {
        const res = await setLogLevel('warn');
        res.should.have.status(200);
        res.should.satisfyApiSpec;
    });

    it('returns 200 when PUT /logging is called with body { level : info }', async function() {
        const res = await setLogLevel('debug');
        res.should.have.status(200);
        res.should.satisfyApiSpec;
    });

});
