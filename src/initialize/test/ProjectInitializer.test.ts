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
import sinon from 'sinon';
import proxyquire from 'proxyquire';

chai.use(sinonChai);
chai.use(chaiAsPromised);
chai.should();


describe('ProjectInitializer', () => {
  let projectInitializer;

  const importFromGitStub = sinon.stub();
  const detectTypeStub = sinon.stub();
  const writeCwSettingsStub = sinon.stub();

  let ProjectInitializer;

  before(() => {
    ProjectInitializer = proxyquire('../src/classes/ProjectInitializer', {
      '../controllers/gitController': { importProjectFromGitRepo: importFromGitStub },
      '../controllers/typeDetectionController': { detectType: detectTypeStub },
      '../controllers/cwSettingsController': { writeCwSettings: writeCwSettingsStub },
      // '../controllers/cwSettingsController': { writeCwSettings: () => console.log('TEST') },
    }).default; // required when the class is the default export

    projectInitializer = new ProjectInitializer('projectName', '/initialize');
  });

  afterEach(() => {
    importFromGitStub.reset();
    detectTypeStub.reset();
    writeCwSettingsStub.reset();
  });

  describe('initializeExistingProject()', () => {
    it('initializes the existing project', async () => {
      await projectInitializer.initializeExistingProject();

      importFromGitStub.should.not.have.been.called;
      writeCwSettingsStub.should.have.been.calledOnce;
      detectTypeStub.should.have.been.calledOnce;
    });
  });

  describe('initializeProjectFromGit()', () => {
    it('initializes the project from git', async () => {
      await projectInitializer.initializeProjectFromGit();

      importFromGitStub.should.have.been.calledOnce;
      writeCwSettingsStub.should.have.been.calledOnce;
      detectTypeStub.should.have.been.calledOnce;
    });
  });

});
