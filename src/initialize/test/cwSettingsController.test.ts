import 'mocha';
import chai from 'chai';
import chaiAsPromised from 'chai-as-promised';
import sinonChai from 'sinon-chai';
import path from 'path';
import sinon from 'sinon';
import proxyquire from 'proxyquire';

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

    describe('when no settings files already exist in the project', () => {
      it('writes a blank .cw-settings file', () => {
        cwSettingsController.writeCwSettings(projectMountDirectory);

        const writeFileArgs = fsStub.writeFileSync.getCall(0).args;

        // path to write to
        writeFileArgs[0].should.equal(settingsPath);
        // content to write
        isValidCWSettings(writeFileArgs[1]).should.be.true;
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

function isValidCWSettings(text: string): boolean {
  const object = JSON.parse(text);

  return 'contextRoot' in object
      && 'internalPort' in object
      && 'healthCheck' in object
      && 'watchedFiles' in object
}
