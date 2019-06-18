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

const reqService = require('../modules/request.service');
const { ADMIN_COOKIE } = require('../config');

chai.should();

const defaultLevel = 'info';
const validLevels = ['error', 'warn', 'info', 'debug', 'trace'];

const setLoggingLevel = (level) => reqService.chai
    .put('/api/v1/logging')
    .set('Cookie', ADMIN_COOKIE)
    .send(level);

const getLoggingLevel = () => reqService.chai
    .get('/api/v1/logging')
    .set('Cookie', ADMIN_COOKIE);

describe('Logging API tests', function() {

    describe('PUT /logging', function(){
        after(`reset logging level to default ('${defaultLevel}')`, async function() {
            const res = await setLoggingLevel({ level : 'info' });
            res.should.have.status(200);
        });

        describe('with body { level : \'unknownLoggingLevel\' }', function(){
            it('returns 400 and an informative error message', async function() {
                const res = await setLoggingLevel({ level : 'unknownLoggingLevel' });
                res.should.have.status(400);
                res.text.should.include('Invalid logging level requested');
            });
        });

        describe('with body { level : \'debug\' }', function(){
            it('returns 200', async function() {
                const res = await setLoggingLevel({ level : 'debug' });
                res.should.have.status(200);
            });
        });
    });

    describe('GET /logging', function() {
        afterEach(`reset logging level to default ('${defaultLevel}')`, async function() {
            const res = await setLoggingLevel({ level : 'info' });
            res.should.have.status(200);
        });

        const expectedLoggingLevel = 'trace';
        describe(`when logging level is '${expectedLoggingLevel}'`, function(){

            before(`set logging level to '${expectedLoggingLevel}'`, async function() {
                const res = await setLoggingLevel({ level : expectedLoggingLevel });
                res.should.have.status(200);
            });

            it('returns 200 and { currentLevel, defaultLevel, allLevels }', async function() {
                const res = await getLoggingLevel();
                res.should.have.status(200);
                res.should.have.own.property('body');
                res.body.currentLevel.should.equal(expectedLoggingLevel);
                res.body.defaultLevel.should.equal(defaultLevel);
                res.body.allLevels.should.be.an('array').with.members(validLevels);
            });
        });
    });

});



