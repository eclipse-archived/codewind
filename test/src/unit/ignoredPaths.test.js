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
const rewire = require('rewire');
const ignoredPaths = rewire('../../../src/pfe/portal/modules/utils/ignoredPaths');
const { projectTypeToIgnoredPaths } = ignoredPaths;

const chai = require('chai');
chai.should();

describe('ignoredPaths.js', () => {
    it('checks that all projectTypes return the default values', () => {
        const defaultIgnoredPaths = ignoredPaths.__get__('defaultIgnoredPaths');
        ['docker', 'swift', 'nodejs', 'liberty', 'spring'].forEach(type => {
            const ignoredPaths = projectTypeToIgnoredPaths[type];
            ignoredPaths.should.be.an('array');
            ignoredPaths.should.include.members(defaultIgnoredPaths);
        });
    });
    it('returns array for docker projectType', () => {
        const ignoredPaths = projectTypeToIgnoredPaths['docker'];
        ignoredPaths.should.be.an('array');
        ignoredPaths.should.include('.DS_Store');
    });
    it('returns array for swift projectType', () => {
        const ignoredPaths = projectTypeToIgnoredPaths['swift'];
        ignoredPaths.should.be.an('array');
        ignoredPaths.should.include('.swift-version');
    });
    it('returns array for nodejs projectType', () => {
        const ignoredPaths = projectTypeToIgnoredPaths['nodejs'];
        ignoredPaths.should.be.an('array');
        ignoredPaths.should.include('*node_modules*');
    });
    it('returns array for liberty projectType', () => {
        const ignoredPaths = projectTypeToIgnoredPaths['liberty'];
        ignoredPaths.should.be.an('array');
        ignoredPaths.should.include('libertyrepocache.zip');
    });
    it('returns array for spring projectType', () => {
        const ignoredPaths = projectTypeToIgnoredPaths['spring'];
        ignoredPaths.should.be.an('array');
        ignoredPaths.should.include('localm2cache.zip');
    });
});
