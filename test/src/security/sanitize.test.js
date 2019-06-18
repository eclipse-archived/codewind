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
const { ADMIN_COOKIE, testTimeout } = require('../../config');

chai.should();

describe('XSS Attack Tests', function() {
    describe('Logging API', function() {
        const setLoggingLevel = (level) => reqService.chai
            .put('/api/v1/logging')
            .set('Cookie', ADMIN_COOKIE)
            .send({ level });
            
        const makeExampleXSSAttack = () => setLoggingLevel('de<script>alert(`hello`);</script>bug');

        it('should succeed (with status 200) when sanitising input', async function() {
            this.timeout(testTimeout.short);
            const res = await makeExampleXSSAttack();
            res.should.have.status(200);
        });
    });        
});