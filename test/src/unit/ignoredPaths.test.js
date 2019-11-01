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
const { projectTypeToIgnoredPaths } = require('../../../src/pfe/portal/modules/utils/ignoredPaths');

const chai = require('chai');
chai.should();

describe.only('ignoredPaths.js', () => {
    it('returns array for docker projectType', () => {
        const ignoredPaths = projectTypeToIgnoredPaths['docker'];
        ignoredPaths.should.be.an('array');
    });
    it('returns array for swift projectType', () => {
        const ignoredPaths = projectTypeToIgnoredPaths['swift'];
        ignoredPaths.should.be.an('array');
    });
    it('returns array for nodejs projectType', () => {
        const ignoredPaths = projectTypeToIgnoredPaths['swift'];
        ignoredPaths.should.be.an('array');
    });
    it('returns array for liberty projectType', () => {
        const ignoredPaths = projectTypeToIgnoredPaths['liberty'];
        ignoredPaths.should.be.an('array');
    });
    it('returns array for spring projectType', () => {
        const ignoredPaths = projectTypeToIgnoredPaths['spring'];
        ignoredPaths.should.be.an('array');
    });
});
