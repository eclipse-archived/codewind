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
import path from 'path';
import { ProjectType } from '../src/types/initializeTypes';

chai.use(sinonChai);
chai.use(chaiAsPromised);
chai.should();

describe('typeDetectionController', () => {
  const fsStub = {
    pathExists: sinon.stub(),
    readFile: sinon.stub(),
  };

  const typeDetectionController = proxyquire('../src/controllers/typeDetectionController', {
    'fs-extra': fsStub,
  });

  beforeEach(() => {
    // set default to false
    fsStub.pathExists.returns(false);
  });

  afterEach(() => {
    fsStub.pathExists.reset();
    fsStub.readFile.reset();
  });

  describe('detectType()', () => {
    const projectDir = '/test';

    describe('when a java project is on disk', () => {
      const pathToPomXml = path.join(projectDir, 'pom.xml');
      const pathToDockerfile = path.join(projectDir, 'Dockerfile');

      describe('(spring)', () => {
        before(() => {
          // setup stubs to make it look like spring project on disk
          fsStub.pathExists.withArgs(pathToPomXml).returns(true);
          fsStub.readFile.returns('<groupId>org.springframework.boot</groupId>');
        });

        it('returns the correct language and project type', () => {
          return typeDetectionController.detectType(projectDir)
            .should.eventually.deep.equal({
              language: 'java',
              projectType: ProjectType.SPRING,
            });
        });
      });

      describe('(liberty)', () => {
        before(() => {
          fsStub.pathExists.withArgs(pathToPomXml).returns(true);
          fsStub.pathExists.withArgs(pathToDockerfile).returns(true);
          fsStub.readFile.returns('FROM websphere-liberty');
        });

        it('returns the correct language and project type', () => {
          return typeDetectionController.detectType(projectDir)
            .should.eventually.deep.equal({
              language: 'java',
              projectType: ProjectType.LIBERTY,
            });
        });
      });

      describe('(other e.g. lagom)', () => {
        before(() => {
          fsStub.pathExists.withArgs(pathToPomXml).returns(true);
          fsStub.readFile.returns('<groupId>test</groupId>');
        });

        it('returns the correct language and project type', () => {
          return typeDetectionController.detectType(projectDir)
            .should.eventually.deep.equal({
              language: 'java',
              projectType: ProjectType.DOCKER,
            });
        });
      });
    });

    describe('when a node project is on disk', () => {
      const pathToPackageJson = path.join(projectDir, 'package.json');

      before(() => {
        fsStub.pathExists.withArgs(pathToPackageJson).returns(true);
      });

      it('returns the correct language and project type', () => {
        return typeDetectionController.detectType(projectDir)
          .should.eventually.deep.equal({
            language: 'nodejs',
            projectType: ProjectType.NODEJS,
          });
      });
    });

    describe('when a swift project is on disk', () => {
      const pathToPackageSwift = path.join(projectDir, 'Package.swift');

      before(() => {
        fsStub.pathExists.withArgs(pathToPackageSwift).returns(true);
      });

      it('returns the correct language and project type', () => {
        return typeDetectionController.detectType(projectDir)
          .should.eventually.deep.equal({
            language: 'swift',
            projectType: ProjectType.SWIFT,
          });
      });
    });

    describe('when an unknown project is on disk', () => {
      it('returns the default unknown docker type', () => {
        return typeDetectionController.detectType(projectDir)
          .should.eventually.deep.equal({
            language: 'unknown',
            projectType: ProjectType.DOCKER,
          });
      });
    });
  });
});
