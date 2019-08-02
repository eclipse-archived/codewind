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
const { ADMIN_COOKIE, USING_K8S, DEFAULT_USER_NAME } = require('../config');

const SOCKET_NAMESPACE = USING_K8S ? '/admin' : `/${DEFAULT_USER_NAME}`;

chai.should();

describe('Environment API tests', function() {

    it('should return expected environment properties', async function() {
        const res = await reqService.chai
            .get('/api/v1/environment')
            .set('Cookie', ADMIN_COOKIE);

        res.should.have.status(200);
        res.should.have.ownProperty('body');
        res.body.should.have.ownProperty('running_on_k8s', USING_K8S);
        res.body.should.have.ownProperty('user_string');
        res.body.should.have.ownProperty('socket_namespace', SOCKET_NAMESPACE);
        res.body.should.have.ownProperty('codewind_version');
        res.body.should.have.ownProperty('tekton_dashboard_url');
        res.body.should.have.ownProperty('os_platform');
        if (!USING_K8S) res.body.should.have.ownProperty('workspace_location');
    });
});
