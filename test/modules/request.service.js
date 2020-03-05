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
const chaiHttp = require('chai-http');
const util = require('util');

const SocketService = require('./socket.service');
const { CODEWIND_URL } = require('../config');

chai.use(chaiHttp);


/**
 *
 * @param {function} request a function that makes an http request. e.g. () => reqService.chai.get('/api/v1/projects')
 * @param {number} expectedResStatus e.g. 200
 * @returns {Promise} res
 */
async function makeReq(request, expectedResStatus) {
    const res = await request(); // TODO try doing .set('Cookie') here (Test in ICP)
    if (expectedResStatus) verifyResStatus(res, expectedResStatus);
    return res;
}

/**
 *
 * @param {function} request a function that makes an http request. e.g. () => reqService.chai.get('/api/v1/projects')
 * @param {number} expectedResStatus e.g. 200
 * @param {JSON} expectedSocketMsg e.g. { projectID: 'p1', msgType: 'projectDeletion' }. (See {@link SocketService} for expected msgTypes.)
 * @returns {Promise} res (returns only after socketService receives the expectedSocketMsg)
 */
async function makeReqAndAwaitSocketMsg(request, expectedResStatus, expectedSocketMsg) {
    const socketService = await SocketService.createSocket();
    const res = await makeReq(request, expectedResStatus);

    if (res.status < 400) { // skip if http request is unsuccessful
        if (!expectedSocketMsg.projectID) expectedSocketMsg.projectID = res.body.projectID; // if we didn't know the ID beforehand, try to get it from the response
        await socketService.checkForMsg(expectedSocketMsg);
    }
    socketService.close();
    return res;
}

function verifyResStatus(res, expectedResStatus) {
    try {
        res.should.have.status(expectedResStatus);
    } catch (error) {
        if (!isEmpty(res.body)) {
            error.message += `\n(res.body: ${util.inspect(res.body)})`;
        } else if (res.text) {
            error.message += `\n(res.text: ${util.inspect(res.text)})`;
        } else {
            error.message += `\n(res: ${util.inspect(res)})`;
        }
        throw error;
    }
}

function isEmpty(obj) {
    return (Object.keys(obj).length === 0) && (obj.constructor === Object);
}

module.exports = {
    makeReq,
    makeReqAndAwaitSocketMsg,
    chai: chai.request(CODEWIND_URL),
};
