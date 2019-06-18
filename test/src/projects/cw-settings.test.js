const chai = require('chai');
const fs = require('fs-extra');

const projectService = require('../../modules/project.service');
const containerService = require('../../modules/container.service');
const SocketService = require('../../modules/socket.service');

const { WORKSPACE_DIR, testTimeout } = require('../../config');

chai.should();

// Bind/Unbind Changes - This test uses function we will no longer have.
describe.skip('CWSettings Tests', function() {
    describe('Node.js', function() {
        let socketService;
        let projectID;
        let pathToCWSettings;
        let cwSettingsObject;
        const projectName = `cwSettingsnode${Date.now()}`;

        before('Create a project', async function() {
            this.timeout(testTimeout.med);
            socketService = await SocketService.createSocket();
            projectID = await projectService.createProjectAndAwaitID({
                name : projectName,
                type : 'nodejs',
                language: 'nodejs',
            });
            pathToCWSettings = `${WORKSPACE_DIR}/${projectName}/.cw-settings`;
            await containerService.awaitFile(pathToCWSettings);
        });

        after('Clean up by deleting project', async function() {
            this.timeout(testTimeout.med);
            socketService.close();
            socketService = null;
            await projectService.deleteProject(projectID);
        });

        describe('When a user creates a project', function() {
            it('an .cw-settings file is created with the correct (default) fields', async function() {
                this.timeout(testTimeout.med);
                cwSettingsObject = JSON.parse(await containerService.readFile(pathToCWSettings, 'utf8'));
                cwSettingsObject.internalDebugPort.should.equal('');
                cwSettingsObject.contextRoot.should.equal('');
                cwSettingsObject.watchedFiles.should.be.an('object');
            });

            it.skip('the .cw-settings file should include the correct internalAppPort', async function() {
                this.timeout(testTimeout.med);
                // waits for creation event so that the internal port has been added to the API
                await socketService.checkForMsg({projectID, msgType: 'projectCreation'});
                const cwSettingsObject = await readCWSettings(pathToCWSettings);
                const projectInfo = await projectService.getProject(projectID);
                cwSettingsObject.internalAppPort.should.not.equal(projectInfo.ports.internalPort.toString());
            });
        });

        describe.skip('when a user edits the .cw-settings file', function() {
            describe('correctly', function() {
                it('modifies the internalDebugPort', async function() {
                    this.timeout(testTimeout.med);
                    const expectedSocketMsg = {
                        projectID,
                        msgType: 'projectSettingsChanged',
                        expectedProperties: { name: 'internalDebugPort', internalDebugPort : '1000', status: 'success' },
                    };
                    await editCWSettings(pathToCWSettings, { internalDebugPort : '1000' });
                    await socketService.checkForMsg(expectedSocketMsg);
                });

                it('modifies the healthCheck', async function() {
                    this.timeout(testTimeout.med);
                    const expectedSocketMsg = {
                        projectID,
                        msgType: 'projectSettingsChanged',
                        expectedProperties: { name: 'healthCheck', healthCheck : '/health', status: 'success' },
                    };
                    await editCWSettings(pathToCWSettings, { healthCheck : '/health' });
                    await socketService.checkForMsg(expectedSocketMsg);
                });

                it('modifies the contextRoot', async function() {
                    this.timeout(testTimeout.med);
                    const settingsChangedSocketMsg = {
                        projectID,
                        msgType: 'projectSettingsChanged',
                        expectedProperties: { name: 'contextRoot', contextRoot : '/test', status: 'success' },
                    };
                    await editCWSettings(pathToCWSettings, { contextRoot : '/test'});
                    await socketService.checkForMsg(settingsChangedSocketMsg);
                });
            });
        });
    });

    describe('Java', function() {
        let projectID;
        let pathToCWSettings;
        const projectName = `cwSettingsjava${Date.now()}`;

        before('Create a project', async function() {
            this.timeout(testTimeout.med);
            projectID = await projectService.createProjectAndAwaitID({
                name : projectName,
                language : 'java',
                framework: 'microprofile',
            });
            pathToCWSettings = `${WORKSPACE_DIR}/${projectName}/.cw-settings`;
            await containerService.awaitFile(pathToCWSettings);
        });

        after('Clean up by deleting project', async function() {
            this.timeout(testTimeout.med);
            await projectService.deleteProject(projectID);
        });

        describe('When a user creates a project', function() {
            it('an .cw-settings file is created with the correct (default) fields', async function() {
                this.timeout(testTimeout.med);
                const cwSettingsObject = await readCWSettings(pathToCWSettings, 'utf8');
                cwSettingsObject.internalDebugPort.should.equal('');
                cwSettingsObject.contextRoot.should.equal('');
                cwSettingsObject.watchedFiles.should.be.an('object');
                cwSettingsObject.mavenProfiles.should.be.an('array');
                cwSettingsObject.mavenProperties.should.be.an('array');
            });
        });
    });
});

async function editCWSettings(pathToCWSettings, settings) {
    const cwSettingsObject = JSON.parse(await containerService.readFile(pathToCWSettings, 'utf8'));
    Object.keys(settings).forEach((key) => {
        cwSettingsObject[key] = settings[key];
    });
    await fs.writeJson( 'tmp.json', cwSettingsObject, { spaces: '  ' });
    await containerService.copyTo('tmp.json', pathToCWSettings);
};

async function readCWSettings(pathToCWSettings) {
    return JSON.parse(await containerService.readFile(pathToCWSettings, 'utf8'));
};


