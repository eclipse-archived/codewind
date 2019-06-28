const fs = require('fs-extra');
const path = require('path');
const util = require('util');

const { ADMIN_COOKIE, testTimeout, WORKSPACE_DIR, templateOptions } = require('../../config');
const projectService = require('../../modules/project.service');
const containerService = require('../../modules/container.service');
const reqService = require('../../modules/request.service');

const writeFile = util.promisify(fs.writeFile);

describe('Metrics Status Tests', function() {
    let workspace_location;

    before(async function() {
        this.timeout(testTimeout.med);
        workspace_location = await projectService.findWorkspaceLocation();
    });

    describe('Invalid Projects', function() {
        let projectID, projectPath;
        const projectName = `metricscheckerfailurecase${Date.now()}`;

        before(async function() {
            this.timeout(testTimeout.med);
            projectPath = `${workspace_location}/${projectName}`;
            await projectService.cloneProject(templateOptions['nodejs'].url, projectPath);
            projectID = await bindProject(projectName, 'nodejs', projectPath);
        });

        after(async function() {
            this.timeout(2 * testTimeout.med);
            await projectService.unbindProject(projectID);
            await fs.remove(projectPath);
        });

        it('should return 400 if there is no build-file to check', async function() {
            this.timeout(testTimeout.med);
            await removeBuildFile(projectName);
            const res = await getMetricsAvailability(projectID);
            res.should.have.status(400);
        });

        it('should return 404 if project does not exist', async function() {
            this.timeout(testTimeout.short);
            const res = await getMetricsAvailability('invalidId');
            res.should.have.status(404);
        });
    });

    describe('Swift Metrics Status Tests', function() {
        this.timeout(testTimeout.med);
        testWhenMetricsAvailable('swift');
    });

    describe('Java Spring Metrics Status Tests', function() {
        this.timeout(testTimeout.med);
        testWhenMetricsAvailable('spring');
    });

    describe('Java Liberty Metrics Status Tests', function() {
        this.timeout(testTimeout.med);
        testWhenMetricsAvailable('liberty');
    });

    describe('Node.js Metrics Status Tests', function() {
        this.timeout(testTimeout.maxTravis);
        testWhenMetricsAvailable('nodejs');
        testWhenMetricsNotAvailable('nodejs');
    });

    function testWhenMetricsAvailable(projectType) {
        const projectName = `${projectType}metricsstatustruecheck{Date.now()}`;
        let projectPath, projectID;

        describe(`Check if metrics are available for a ${projectType} project`, function() {
            before(async function() {
                this.timeout(testTimeout.med);
                projectPath = `${workspace_location}/${projectName}`;
                await projectService.cloneProject(templateOptions[projectType].url, projectPath);
                projectID = await bindProject(projectName, projectType, projectPath);
            });

            after(async function() {
                this.timeout(2 * testTimeout.med);
                await projectService.unbindProject(projectID);
                await fs.remove(projectPath);
            });

            it(`should return { metricsAvailable: ${templateOptions[projectType].metricsAvailable} } after the project has been created`, async function() {
                this.timeout(testTimeout.med);
                const res = await getMetricsAvailability(projectID);
                res.should.have.status(200);
                res.body.metricsAvailable.should.equal(templateOptions[projectType].metricsAvailable);
            });

            it(`should have added { metricsAvailable: ${templateOptions[projectType].metricsAvailable} } to the project object`, async function() {
                this.timeout(testTimeout.short);
                const projectObj = await projectService.getProject(projectID);
                projectObj.metricsAvailable.should.equal(templateOptions[projectType].metricsAvailable);
            });
        });
    };

    function testWhenMetricsNotAvailable(projectLanguage) {
        describe(`Removing the build-file metrics field for a ${projectLanguage} project`, function() {
            const projectName = `${projectLanguage}metricsstatusfalsechecker${Date.now()}`;
            let projectID, projectPath;

            before(async function() {
                this.timeout(testTimeout.med);
                projectPath = `${workspace_location}/${projectName}`;
                await projectService.cloneProject(templateOptions[projectLanguage].url, projectPath);
                projectID = await bindProject(projectName, projectLanguage, projectPath);
                await removeMetricsFieldFromPackageJson(projectName);
            });

            after(async function() {
                this.timeout(2 * testTimeout.med);
                await projectService.unbindProject(projectID);
                await fs.remove(projectPath);
            });

            it('should return { metricsAvailable: false } when "appmetrics-dash" has been removed from the package.json', async function() {
                this.timeout(testTimeout.med);
                const res = await getMetricsAvailability(projectID);
                res.body.metricsAvailable.should.equal(false);
                res.should.have.status(200);
            });

            it('should now have { metricsAvailable: false } in the project object', async function() {
                this.timeout(testTimeout.short);
                const projectObj = await projectService.getProject(projectID);
                projectObj.metricsAvailable.should.equal(false);
            });
        });

        describe(`Removing the dependencies block from package json field for a ${projectLanguage} project`, function() {
            const projectName = `${projectLanguage}metricsstatuswithoutdependencies${Date.now()}`;
            let projectID, projectPath;

            before(async function() {
                this.timeout(testTimeout.med);
                projectPath = `${workspace_location}/${projectName}`;
                await projectService.cloneProject(templateOptions[projectLanguage].url, projectPath);
                projectID = await bindProject(projectName, projectLanguage, projectPath);
                await removeDependenciesFromPackageJson(projectName);
            });

            after(async function() {
                this.timeout(2 * testTimeout.med);
                await projectService.unbindProject(projectID);
                await fs.remove(projectPath);
            });

            it('should return { metricsAvailable: false } when dependencies block has been removed from the package.json', async function() {
                this.timeout(testTimeout.med);
                const res = await getMetricsAvailability(projectID);
                res.body.metricsAvailable.should.equal(false);
                res.should.have.status(200);
            });

            it('should now have { metricsAvailable: false } in the project object', async function() {
                this.timeout(testTimeout.short);
                const projectObj = await projectService.getProject(projectID);
                projectObj.metricsAvailable.should.equal(false);
            });
        });

        describe(`Badly formed JSON in package json for a ${projectLanguage} project`, function() {
            const projectName = `${projectLanguage}metricsstatusbadbuildfile${Date.now()}`;
            let projectID, projectPath;

            before(async function() {
                this.timeout(testTimeout.med);
                projectPath = `${workspace_location}/${projectName}`;
                await projectService.cloneProject(templateOptions[projectLanguage].url, projectPath);
                projectID = await bindProject(projectName, projectLanguage, projectPath);
                await writeBadlyFormedPackageJson(projectName);
            });

            after(async function() {
                this.timeout(2 * testTimeout.med);
                await projectService.unbindProject(projectID);
                await fs.remove(projectPath);
            });

            it('should return { metricsAvailable: false } when dependencies block has been removed from the package.json', async function() {
                this.timeout(testTimeout.med);
                const res = await getMetricsAvailability(projectID);
                res.body.metricsAvailable.should.equal(false);
                res.should.have.status(200);
            });

            it('should now have { metricsAvailable: false } in the project object', async function() {
                this.timeout(testTimeout.short);
                const projectObj = await projectService.getProject(projectID);
                projectObj.metricsAvailable.should.equal(false);
            });
        });
    }
});

async function getMetricsAvailability(projectID) {
    const res = await reqService.chai.get(`/api/v1/projects/${projectID}/metrics/status`)
        .set('cookie', ADMIN_COOKIE);
    return res;
}

// The { metricsAvailable: false } case is tested for node.js only, hence this is specific to package.json.
// In the future, this could be expanded to modify other types of build-file.
async function removeMetricsFieldFromPackageJson(projectName) {
    const pathToPackageJson = path.join(WORKSPACE_DIR, projectName, 'package.json');
    const packageJsonObject = JSON.parse(await containerService.readFile(pathToPackageJson, 'utf8'));
    await removeBuildFile(projectName);
    delete packageJsonObject.dependencies['appmetrics-dash'];
    await writeNewPackageJSON(pathToPackageJson, packageJsonObject);
}

async function removeDependenciesFromPackageJson(projectName) {
    const pathToPackageJson = path.join(WORKSPACE_DIR, projectName, 'package.json');
    const packageJsonObject = JSON.parse(await containerService.readFile(pathToPackageJson, 'utf8'));
    await removeBuildFile(projectName);
    delete packageJsonObject.dependencies;
    await writeNewPackageJSON(pathToPackageJson, packageJsonObject);
}

async function writeBadlyFormedPackageJson(projectName) {
    const pathToPackageJson = path.join(WORKSPACE_DIR, projectName, 'package.json');
    await removeBuildFile(projectName);
    await writeNewPackageJSON(pathToPackageJson, '{badly formed json,}');
}

async function writeNewPackageJSON(path, packageJsonObject) {
    const newPackageJsonString = JSON.stringify(packageJsonObject, null, 2);
    await writeFile('tmp.json', newPackageJsonString);
    await containerService.copyTo('tmp.json', path);
}

async function removeBuildFile(projectName) {
    await containerService.unlink(path.join(WORKSPACE_DIR, projectName, 'package.json'));
}

async function bindProject(projectName, projectType, projectPath) {
    const options = {
        name: projectName,
        path: projectPath,
        language: templateOptions[projectType].language,
        projectType,
        autoBuild: false,
    };
    const res = await projectService.bindProject(options);
    return res.body.projectID;
}

