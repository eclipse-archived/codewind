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
require('mocha-sinon');
const sinonChai = require('sinon-chai');
const chai = require('chai');

chai.use(sinonChai);

 /**
 * To help unit testing.
 * Use in a Mocha `describe` block to suppress logger output.
 * @param rewiredModule instantiate one via something like `const rewiredModule = rewire('path/to/module');`
 */
function suppressLogOutput(rewiredModule) {
    const log = rewiredModule.__get__('log');
    const logLevels = ['error', 'warn', 'info', 'debug', 'trace'];

    beforeEach(function() {
        logLevels.forEach(level =>
            this.sinon.stub(log, level)
        );
    });
    afterEach(function() {
        logLevels.forEach(level =>
            log[level].restore()
        );
    });
}

module.exports = {
    suppressLogOutput,
};
