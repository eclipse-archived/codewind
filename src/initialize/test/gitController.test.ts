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

import 'mocha';
import chai from 'chai';
import chaiAsPromised from 'chai-as-promised';
import sinonChai from 'sinon-chai';
import fs from 'fs-extra';
import sinon from 'sinon';
import proxyquire from 'proxyquire';

import * as replaceController from '../src/controllers/replaceController';

chai.use(sinonChai);
chai.use(chaiAsPromised);
chai.should();

describe('gitController', function() {
  describe('importProjectFromGitRepo()', () => {
    let gitStub: sinon.SinonStub;
    let replaceStub:  sinon.SinonStub;
    let fsStub:  sinon.SinonStub;
    let gitController;

    before(() => {
      gitStub = sinon.stub();

      gitController = proxyquire('../src/controllers/gitController', {
        'simple-git/promise': function() {
          return {
            silent: function() { return this },
            clone: gitStub,
          }
        }
      });

      // don't want these to be called
      replaceStub = sinon.stub(replaceController, 'replacePlaceholderNameWithProjectName');
      fsStub = sinon.stub(fs, 'removeSync');
    });

    after(() => {
      replaceStub.restore();
      fsStub.restore();
    });

    beforeEach(() => {
      gitStub.resetHistory();
    });

    describe('when the directory to clone into is empty', () => {
      before(() => {
        // fake empty directory
        fsStub = sinon.stub(fs, 'readdirSync').returns([]);
      });

      after(() => {
        fsStub.restore();
      });

      describe('when a branch is specified', () => {
        const branchName = 'testBranch';

        it('adds the branch argument to the git clone function', async() => {
          await gitController.importProjectFromGitRepo('test', 'projName', '/', branchName);

          gitStub.should.have.been.calledOnceWith('test', '/', ['--branch', branchName]);
        });
      });

      describe('when a branch is NOT specified', () => {
        it('does not add the branch argument', async() => {
          await gitController.importProjectFromGitRepo('test', 'projName', '/');

          gitStub.should.have.been.calledOnceWithExactly('test', '/', []);
        });
      });
    });

    describe('when the directory to clone into is NOT empty', () => {
      let fsStub: sinon.SinonStub;

      before(() => {
        // fake a non-empty directory
        fsStub = sinon.stub(fs, 'readdirSync').returns(['test']);
      });

      after(() => {
        fsStub.restore();
      });

      it('Throws an error and gives message that directory should be empty', async() => {
        await gitController.importProjectFromGitRepo('test', 'projName', '/').should.eventually.be.rejectedWith(/.*directory to clone into is not empty/);
      });
    });
  });
});
