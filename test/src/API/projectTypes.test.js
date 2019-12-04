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
const { ADMIN_COOKIE, pathToApiSpec, testTimeout } = require('../../config');

chai.use(chaiResValidator(pathToApiSpec));
chai.should();

describe('Project Types API tests', function() {

    it('should return expected list of project types', async function() {
        this.timeout(testTimeout.med);
        const res = await reqService.chai
            .get('/api/v1/project-types')
            .set('Cookie', ADMIN_COOKIE);

        res.should.have.status(200).and.satisfyApiSpec;
        res.should.have.ownProperty('body');
        res.body.should.be.an('array');
        const projectTypes = res.body.map(typeObj => typeObj.projectType);
        projectTypes.should.include.members([
            'liberty',
            'nodejs',
            'spring',
            'swift',
            'docker',
        ]);
    });
});
