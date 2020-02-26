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

describe('Extensions API test', function() {

    it('should return status 200', async function() {
        const res = await reqService.chai
            .get('/api/v1/extensions')
            .set('Cookie', ADMIN_COOKIE);
        res.status.should.equal(200, res.text); // print res.text if assertion fails
    });
});
