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

describe('Project Types API tests', function() {

    it('should return expected list of project types', async function() {
        const res = await reqService.chai
            .get('/api/v1/project-types')
            .set('Cookie', ADMIN_COOKIE);

        res.should.have.status(200);
        res.should.have.ownProperty('body');
        res.body.should.be.an('array');
        res.body.should.have.members([
            'liberty',
            'nodejs',
            'spring',
            'swift',
            'docker',
            'appsodyExtension',
        ]);
    });
});
