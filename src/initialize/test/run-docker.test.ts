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
import rewire from 'rewire';
import sinon from 'sinon';

import * as ProjectInitializer from '../src/classes/ProjectInitializer';
import { InitializeResult, InitializeResultResponse, Status } from '../src/types/initializeTypes';

chai.should();

const runDocker = rewire('../src/run-docker');
const run = runDocker.__get__('run');
const runProcess = runDocker.__get__('process');

chai.use(chaiAsPromised);
chai.should();

describe('run-docker', function() {
  before(() => {
    // needs to exist for the functions to work
    process.env.PROJ_NAME = 'projectName';
  });

  describe('success cases', () => {
    let projectInitializerStub;

    const gitProjectInformation: InitializeResult = {
      language: 'git',
      projectType: 'test',
    };

    const existingProjectInformation: InitializeResult = {
      language: 'existing',
      projectType: 'example',
    };

    beforeEach(() => {
      projectInitializerStub = sinon.stub(ProjectInitializer, 'default').returns({
        initializeProjectFromGit: () => gitProjectInformation,
        initializeExistingProject: () => existingProjectInformation,
      });
    });

    afterEach(() => {
      projectInitializerStub.restore();
    });

    describe('from a git template', () => {

      before(() => {
        // this needs to have a value to go down the git route
        process.env.GIT_REPO = 'test';
      });

      after(() => {
        process.env.GIT_REPO = '';
      });

      it('returns success status and project information', async() => {
        const initializeResultResponse = await callRunAndGetConsoleOut();

        initializeResultResponse.status.should.equal(Status.success);
        initializeResultResponse.result.should.deep.equal(gitProjectInformation);
      });
    });

    describe('from an existing project', () => {
      it('returns success status and project information', async() => {
        const initializeResultResponse = await callRunAndGetConsoleOut();

        initializeResultResponse.status.should.equal(Status.success);
        initializeResultResponse.result.should.deep.equal(existingProjectInformation);
      });
    });
  });

  describe('fail cases', () => {
    let projectInitializerStub;

    const gitErrorMessage = 'FROM GIT';
    const existingErrorMessage = 'FROM EXISTING';

    before(() => {
      projectInitializerStub = sinon.stub(ProjectInitializer, 'default').returns({
        initializeProjectFromGit: () => { throw new Error(gitErrorMessage); },
        initializeExistingProject: () => { throw new Error(existingErrorMessage); },
      });
    });

    after(() => {
      projectInitializerStub.restore();
    });

    describe('from a git template', () => {
      before(() => {
        // this needs to have a value to go down the git route
        process.env.GIT_REPO = 'test';
      });

      after(() => {
        process.env.GIT_REPO = '';
      });

      it('returns fail status and correct error message', async() => {
        const initializeResultResponse = await callRunAndGetConsoleOut();

        initializeResultResponse.status.should.equal(Status.failed);
        initializeResultResponse.result.should.equal(gitErrorMessage);
      });
    });

    describe('returns fail status and correct error message', () => {
      it('returns success status and project information', async() => {
        const initializeResultResponse = await callRunAndGetConsoleOut();

        initializeResultResponse.status.should.equal(Status.failed);
        initializeResultResponse.result.should.equal(existingErrorMessage);
      });
    });
  });
});


async function callRunAndGetConsoleOut(): Promise<InitializeResultResponse> {
  const stub = sinon.stub(runProcess.stdout, 'write');
  await run();
  const result = stub.getCall(0).args[0];
  stub.restore();
  return JSON.parse(result);
}
