import 'mocha';
import chai from 'chai';
import chaiAsPromised from 'chai-as-promised';
import sinonChai from 'sinon-chai';
import path from 'path';
import sinon from 'sinon';
import proxyquire from 'proxyquire';

const {
  defaultSpringSettings,
  defaultLibertySettings,
  defaultNodeSettings,
  defaultSwiftSettings,
  defaultDockerSettings,
} = require('../../../test/utils/default-cw-settings');

chai.use(sinonChai);
chai.use(chaiAsPromised);
chai.should();

describe('cwSettingsController', () => {
  const fsStub = {
    existsSync: sinon.stub(),
    writeFileSync: sinon.stub(),
    moveSync: sinon.stub(),
  };

  const cwSettingsController = proxyquire('../src/controllers/cwSettingsController', {
    'fs-extra': fsStub,
  });

  beforeEach(() => {
    // appear that no other previous settings files exist
    fsStub.existsSync.returns(false);
  });

  afterEach(() => {
    fsStub.existsSync.reset();
    fsStub.writeFileSync.reset();
    fsStub.moveSync.reset();
  });

  describe('writeCwSettings', () => {
    const projectMountDirectory = '/test';
    const settingsPath: string = path.join(projectMountDirectory, '.cw-settings');
    const legacySettingsPath: string = path.join(projectMountDirectory, '.mc-settings');

    const checkSettingsMatch = (expectedDefaultSettings) => {
      const writeFileArgs = fsStub.writeFileSync.getCall(0).args;
      // path to write to
      writeFileArgs[0].should.equal(settingsPath);
      // content to write
      JSON.parse(writeFileArgs[1]).should.deep.equal(expectedDefaultSettings);
    };

    describe('when no settings files already exist in the project', () => {
      describe('(spring)', () => {
        it('writes correct default .cw-settings', () => {
          cwSettingsController.writeCwSettings(projectMountDirectory, 'spring');
          checkSettingsMatch(defaultSpringSettings);
        });
      });
      describe('(liberty)', () => {
        it('writes correct default .cw-settings', () => {
          cwSettingsController.writeCwSettings(projectMountDirectory, 'liberty');
          checkSettingsMatch(defaultLibertySettings);
        });
      });

      describe('(node)', () => {
        it('writes correct default .cw-settings', () => {
          cwSettingsController.writeCwSettings(projectMountDirectory, 'nodejs');
          checkSettingsMatch(defaultNodeSettings);
        });
      });
      describe('(swift)', () => {
        it('writes correct default .cw-settings', () => {
          cwSettingsController.writeCwSettings(projectMountDirectory, 'swift');
          checkSettingsMatch(defaultSwiftSettings);
        });
      });
      describe('(docker)', () => {
        it('writes correct default .cw-settings', () => {
          cwSettingsController.writeCwSettings(projectMountDirectory, 'docker');
          checkSettingsMatch(defaultDockerSettings);
        });
      });
    });

    describe('when a .cw-settings file already exists', () => {
      before(() => {
        // appear that a .cw-settings file exists
        fsStub.existsSync.withArgs(settingsPath).returns(true);
      });

      it('does not try to overwrite the file', () => {
        cwSettingsController.writeCwSettings(projectMountDirectory);

        // make sure no file changes were attempted
        fsStub.moveSync.should.not.have.been.called;
        fsStub.writeFileSync.should.not.have.been.called;
      });
    });

    describe('when an .mc-settings file already exists', () => {
      before(() => {
        // appear that a .mc-settings file exists
        fsStub.existsSync.withArgs(legacySettingsPath).returns(true);
      });

      it('renames the file to .cw-settings', () => {
        cwSettingsController.writeCwSettings(projectMountDirectory);

        // check that the .mc-settings file is renamed
        fsStub.moveSync.should.have.been.calledWithExactly(legacySettingsPath, settingsPath);

        // make sure a .cw-settings file wasn't also attempted to be written
        fsStub.writeFileSync.should.not.have.been.called;
      });
    });
  });
});
