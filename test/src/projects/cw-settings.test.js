const chai = require('chai');
const path = require('path');

const projectService = require('../../modules/project.service');
const containerService = require('../../modules/container.service');
const SocketService = require('../../modules/socket.service');

const { WORKSPACE_DIR, testTimeout } = require('../../config');
const { defaultNodeSettings, defaultLibertySettings } = require('../../utils/default-cw-settings');

chai.should();

describe('CWSettings Tests', function() {
    describe('Node.js', function() {
        const projectName = `cwSettingsNode${Date.now()}`;
        let socketService;
        let projectID;
        let pathToCWSettings;

        before('Create a project', async function() {
            this.timeout(testTimeout.med);
            socketService = await SocketService.createSocket();
            projectID = await projectService.cloneAndBindProject(projectName, 'nodejs');
            
            pathToCWSettings = path.join(WORKSPACE_DIR, projectName, '.cw-settings');
            await containerService.awaitFile(pathToCWSettings);
        });

        after('Clean up by deleting project', async function() {
            this.timeout(testTimeout.med);
            socketService.close();
            socketService = null;
            await projectService.unbindProject(projectID);
            await projectService.deleteProjectDir(projectName);
        });

        describe('When a user creates a project', function() {
            it('an .cw-settings file is created with the correct (default) fields', async function() {
                this.timeout(testTimeout.med);
                const cwSettingsObject = await containerService.readJson(pathToCWSettings);
                cwSettingsObject.should.deep.equal(defaultNodeSettings);
            });
        });
    });

    describe('Java', function() {
        let projectID;
        let pathToCWSettings;
        const projectName = `cwSettingsJava${Date.now()}`;

        before('Create a project', async function() {
            this.timeout(testTimeout.med);
            projectID = await projectService.cloneAndBindProject(projectName, 'liberty');
            
            pathToCWSettings = path.join(WORKSPACE_DIR, projectName, '.cw-settings');
            await containerService.awaitFile(pathToCWSettings);
        });

        after('Clean up by deleting project', async function() {
            this.timeout(testTimeout.med);
            await projectService.unbindProject(projectID);
            await projectService.deleteProjectDir(projectName);
        });

        describe('When a user creates a project', function() {
            it('an .cw-settings file is created with the correct (default) fields', async function() {
                this.timeout(testTimeout.med);
                const cwSettingsObject = await containerService.readJson(pathToCWSettings);
                cwSettingsObject.should.deep.equal(defaultLibertySettings);
            });
        });
    });
});