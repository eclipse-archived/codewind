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

const reqService = require('../../modules/request.service');
const { ADMIN_COOKIE } = require('../../config');

chai.should();

const getIgnoredPaths = (projectType) =>
    reqService.chai
        .get(`/api/v1/ignoredPaths?projectType=${projectType}`)
        .set('Cookie', ADMIN_COOKIE)

describe('ignoredPaths API test', function() {
    describe('Swift', () => {
        it('returns 200 and an array containing a correct example ignored path', async() => {
            const res = await getIgnoredPaths('swift');
            res.should.have.status(200);
            res.body.should.be.an('array');
            res.body.should.include('.swift-version');
        });
    });
    describe('Liberty', () => {
        it('returns 200 and an array containing correct example ignored path', async() => {
            const res = await getIgnoredPaths('liberty');
            res.should.have.status(200);
            res.body.should.be.an('array');
            res.body.should.include('/libertyrepocache.zip');
        });
    });
    describe('Spring', () => {
        it('returns 200 and an array containing correct example ignored path', async() => {
            const res = await getIgnoredPaths('spring');
            res.should.have.status(200);
            res.body.should.be.an('array');
            res.body.should.include('/localm2cache.zip');
        });
    });
    describe('Node.js', () => {
        it('returns 200 and an array containing correct example ignored path', async() => {
            const res = await getIgnoredPaths('node');
            res.should.have.status(200);
            res.body.should.be.an('array');
            res.body.should.include('*/node_modules*');
        });
    });
    describe('Docker', () => {
        it('returns 200 and an array containing correct example ignored path', async() => {
            const res = await getIgnoredPaths('docker');
            res.should.have.status(200);
            res.body.should.be.an('array');
            res.body.should.include('*/.DS_Store');
        });
    });
    describe('Unknown Type', () => {
        it('returns 200 and an array of default docker ignoredPaths', async() => {
            const res = await getIgnoredPaths('unknown');
            res.should.have.status(200);
            res.body.should.be.an('array');
            res.body.should.include('*/.DS_Store');
        });
    });
});

