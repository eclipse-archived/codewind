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
const { ADMIN_COOKIE, USING_K8S, DEFAULT_USER_NAME, pathToApiSpec } = require('../../config');

const SOCKET_NAMESPACE = USING_K8S ? '/admin' : `/${DEFAULT_USER_NAME}`;
chai.use(chaiResValidator(pathToApiSpec));
chai.should();

describe('Environment API tests', function() {
    it('should return expected environment properties', async function() {
        const res = await reqService.chai
            .get('/api/v1/environment')
            .set('Cookie', ADMIN_COOKIE);

        // res.should.have.status(200).and.satisfyApiSpec;
        res.body.running_in_k8s.should.equal(USING_K8S);
        res.body.socket_namespace.should.equal(SOCKET_NAMESPACE);
        if (!USING_K8S) res.body.should.have.ownProperty('workspace_location');
    });
});
