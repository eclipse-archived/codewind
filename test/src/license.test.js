/* eslint-disable no-loop-func */
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

const allPackageJsonPaths = require('../config/index').packageJsons;
const fs = require('fs-extra');
const path = require('path');
const mlog = require('mocha-logger');
const chai = require('chai');
const performCheck = require('../modules/license.service').performCheck;

describe('check node package licenses', function() {
    this.timeout('5m');

    for (const key in allPackageJsonPaths) {
        const packageJsonPath = path.resolve(allPackageJsonPaths[key], 'package.json');
        let packageLockJson = null;
        if (fs.existsSync(path.resolve(allPackageJsonPaths[key], 'package-lock.json'))) {
            const packageLockJsonPath = path.resolve(allPackageJsonPaths[key], 'package-lock.json');
            packageLockJson = JSON.parse(fs.readFileSync(packageLockJsonPath));
        }
        const packageJson = JSON.parse(fs.readFileSync(packageJsonPath));

        describe(`${key}`, function() {
            it('perform license check', async function() {
                const results = await performCheck(packageJson, packageLockJson);
                chai.expect(results).to.not.equals(null);
                if (Object.keys(results.unclearedPackages).length === 0) {
                    mlog.success('Contains no uncleared packages.');
                } else {
                    mlog.error('WARN - Contains packages that have not yet been approved:');
                    mlog.log(JSON.stringify(results.unclearedPackages, null, 2));
                }
        
                if (Object.keys(results.problemPackages).length === 0) {
                    mlog.success('Contains no problematic packages');
                } else {
                    mlog.error('ERR - Could contain problematic packages');
                    mlog.log(JSON.stringify(results.problemPackages, null, 2)); 
                }
            });
        });
    }
});