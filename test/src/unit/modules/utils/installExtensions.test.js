/*******************************************************************************
 * Copyright (c) 2020 IBM Corporation and others.
 * All rights reserved. This program and the accompanying materials
 * are made available under the terms of the Eclipse Public License v2.0
 * which accompanies this distribution, and is available at
 * http://www.eclipse.org/legal/epl-v20.html
 *
 * Contributors:
 *     IBM Corporation - initial API and implementation
*******************************************************************************/
const fs = require('fs-extra');
const path = require('path');
const rewire = require('rewire');
const chai = require('chai');
const chaiAsPromised = require('chai-as-promised');
const { execSync } = require('child_process');

const installExtensions = rewire('../../../../../src/pfe/portal/modules/utils/installExtensions');
const { installBuiltInExtensions, SUFFIX_OLD } = installExtensions;

const { suppressLogOutput } = require('../../../../modules/log.service');
const { 
    createCodewindYamlFile,
    deleteCodewindYamlFile,
} = require('../../../../modules/extension.service');

chai.use(chaiAsPromised);
chai.should();

const testDirectory = path.join(__dirname, 'installExtensionsTest');

describe.only('installBuiltInExtensions.js', () => {
    suppressLogOutput(installExtensions);
    before(() => {
        fs.ensureDirSync(testDirectory);
    });
    after(function() {
        this.timeout(5000);
        execSync(`rm -rf ${testDirectory}`);
    });
    describe('Ensure functions and variables are exported (fails almost silently when running PFE)', () => {
        it('Ensures the installBuiltInExtensions function is exported', () => {
            installBuiltInExtensions.should.be.a('function');
        });
        it('Ensures the SUFFIX_OLD variable is exported', () => {
            SUFFIX_OLD.should.be.a('string').and.equal('__old');
        });
    });
    describe('installBuiltInExtensions(targetDir, extensionsDir = defaultExtensionsDir)', () => {
        const extensionDir = path.join(testDirectory, 'extensions');
        const targetDir = path.join(testDirectory, 'target');
        beforeEach(() => {
            fs.ensureDirSync(extensionDir);
            fs.ensureDirSync(targetDir);
        });
        afterEach(() => {
            execSync(`rm -rf ${extensionDir}`);
            execSync(`rm -rf ${targetDir}`);
        });
        it('Fails as the default directory does not exist', async() => {
            await installBuiltInExtensions(targetDir).should.be.eventually.rejected;
        });
        it('Ignores an empty extension directory as no extensions exist', async() => {
            const filesInExtDir = await fs.readdir(extensionDir);
            filesInExtDir.length.should.equal(0);
            await installBuiltInExtensions(targetDir, extensionDir).should.be.eventually.fulfilled;
            const filesInTarDir = await fs.readdir(targetDir);
            filesInTarDir.length.should.equal(0);
        });
        describe('Successfully installs a number of extensions', () => {
            const numberOfExtensionsToCreate = 5;
            before(function() {
                skipIfOnJenkins(this);
                for (let i = 0; i < numberOfExtensionsToCreate; i++) {
                    const extensionName = `extension-${i}-${i}.0.0`;
                    const zipFileName = `${extensionName}.zip`;
                    // Create extension zip file
                    const filePath = path.join(extensionDir, extensionName);
                    const zipFilePath = path.join(extensionDir, zipFileName);
                    fs.ensureFileSync(filePath);
                    execSync(`zip -j ${zipFilePath} ${filePath}`);
                    fs.existsSync(zipFilePath).should.be.true;
                    fs.remove(filePath);
                }
            });
            it(`Installs ${numberOfExtensionsToCreate} extensions`, async function() {
                skipIfOnJenkins(this);
                await installBuiltInExtensions(targetDir, extensionDir).should.be.eventually.fulfilled;
                const filesInTarDir = await fs.readdir(targetDir);
                filesInTarDir.length.should.equal(numberOfExtensionsToCreate);
            });
        });
        describe('Fails to install a number of extensions as they are no zip files', () => {
            const numberOfExtensionsToCreate = 5;
            before(function() {
                for (let i = 0; i < numberOfExtensionsToCreate; i++) {
                    const extensionName = `extension-${i}-${i}.0.0`;
                    // Create extension zip file
                    const filePath = path.join(extensionDir, extensionName);
                    fs.ensureFileSync(filePath);
                }
            });
            it(`Fails to install ${numberOfExtensionsToCreate} extensions`, async function() {
                await installBuiltInExtensions(targetDir, extensionDir).should.be.eventually.fulfilled;
                const filesInTarDir = await fs.readdir(targetDir);
                filesInTarDir.length.should.equal(0);
            });
        });
    });
    describe('installBuiltInExtension(file, targetDir, extensionsDir)', () => {
        const installBuiltInExtension = installExtensions.__get__('installBuiltInExtension');
        const extensionDir = path.join(testDirectory, 'extensions');
        const targetDir = path.join(testDirectory, 'target');
        beforeEach(() => {
            fs.ensureDirSync(extensionDir);
            fs.ensureDirSync(targetDir);
        });
        afterEach(() => {
            execSync(`rm -rf ${extensionDir}`);
            execSync(`rm -rf ${targetDir}`);
        });
        it('Function returns as the given file is a directory', async() => {
            const filePath = path.join(extensionDir, 'dir');
            await fs.ensureDir(filePath);
            const file = await fs.stat(filePath);
            await installBuiltInExtension(file, targetDir, extensionDir).should.eventually.be.fulfilled;
            assertExtensionIsNotInstalled(targetDir);
        });
        it('Function returns as the filename does not fit the filename regex', async() => {
            const filePath = path.join(extensionDir, 'file');
            await fs.ensureFile(filePath);
            const file = await fs.stat(filePath);
            await installBuiltInExtension(file, targetDir, extensionDir).should.eventually.be.fulfilled;
            assertExtensionIsNotInstalled(targetDir);
        });
        it('Function returns as the file cannot be unzipped', async() => {
            const filePath = path.join(extensionDir, 'extension-9.9.9.zip');
            await fs.ensureFile(filePath);
            const file = await fs.stat(filePath);
            file.name = 'extension-9.9.9.zip';
            await installBuiltInExtension(file, targetDir, extensionDir).should.eventually.be.fulfilled;
            assertExtensionIsNotInstalled(targetDir);
        });
        it('Function returns as the odo file is given and process.env.ON_OPENSHIFT is not set to true', async() => {
            const filePath = path.join(extensionDir, 'codewind-odo-extension-9.9.9.zip');
            await fs.ensureFile(filePath);
            const file = await fs.stat(filePath);
            file.name = 'codewind-odo-extension-9.9.9.zip';
            await installBuiltInExtension(file, targetDir, extensionDir).should.eventually.be.fulfilled;
            assertExtensionIsNotInstalled(targetDir);
        });
        describe('Valid extension', () => {
            const fileName = 'valid-extension';
            const zipFileName = 'valid-extension-1.0.0.zip';
            const zipFilePath = path.join(extensionDir, zipFileName);
            before(function() {
                skipIfOnJenkins(this);
                // Create extension zip file
                const filePath = path.join(extensionDir, fileName);
                fs.ensureFileSync(filePath);
                execSync(`zip -j ${zipFilePath} ${filePath}`);
                fs.existsSync(zipFilePath).should.be.true;
                fs.remove(filePath);
            });
            it('Successfully unzips an extension and moves it to the extension directory', async function() {
                skipIfOnJenkins(this);
                const file = await fs.stat(zipFilePath);
                file.name = zipFileName;
                await installBuiltInExtension(file, targetDir, extensionDir).should.eventually.be.fulfilled;
                const filesInTargetDir = await fs.readdir(targetDir);
                filesInTargetDir.length.should.equal(1);
                filesInTargetDir[0].should.equal(fileName);
                // zip should not have been deleted
                fs.existsSync(zipFilePath).should.be.true;
            });
        });
        describe('Valid extension but a lower version than the existing extension', () => {
            const fileName = 'valid-extension';
            const zipFileName = 'valid-extension-1.0.0.zip';
            const zipFilePath = path.join(extensionDir, zipFileName);
            before(function() {
                skipIfOnJenkins(this);
                // Create existing extension (directory with codewind.yaml)
                createCodewindYamlFile(path.join(targetDir, fileName), { version: '2.0.0' });
                
                // Create extension zip file
                const filePath = path.join(extensionDir, fileName);
                fs.ensureFileSync(filePath);
                execSync(`zip -j ${zipFilePath} ${filePath}`);
                fs.existsSync(zipFilePath).should.be.true;
                fs.remove(filePath);
            });
            it('Does not unzip the extension as the existing extension has a higher version number than the new one', async function() {
                skipIfOnJenkins(this);
                const file = await fs.stat(zipFilePath);
                file.name = zipFileName;
                await installBuiltInExtension(file, targetDir, extensionDir).should.eventually.be.fulfilled;
                // Check that directory has not been replaced with new file
                const filesInTargetDir = await fs.readdir(targetDir, { withFileTypes: true });
                filesInTargetDir.length.should.equal(1);
                filesInTargetDir[0].name.should.equal(fileName);
                filesInTargetDir[0].isDirectory().should.be.true;
                // zip should not have been deleted
                fs.existsSync(zipFilePath).should.be.true;
            });
        });
    });
    describe('getVersion(target)', () => {
        const getVersion = installExtensions.__get__('getVersion');
        afterEach(() => {
            deleteCodewindYamlFile(testDirectory);
        });
        it('Correctly gets the version from a codewind.yaml', async() => {
            createCodewindYamlFile(testDirectory, { version: '1.2.3' });
            const version = await getVersion(testDirectory);
            version.should.equal('1.2.3');
        });
        it('Correctly gets the version from a codewind.yaml that contains more than a single digit', async() => {
            createCodewindYamlFile(testDirectory, { version: '11.222.3333' });
            const version = await getVersion(testDirectory);
            version.should.equal('11.222.3333');
        });
        it('Fails to get version from a codewind.yaml file as it is too short', async() => {
            createCodewindYamlFile(testDirectory, { version: '1.2' });
            const version = await getVersion(testDirectory);
            version.should.equal('0.0.0');
        });
        it('Fails to get version from a codewind.yaml file as it is too long', async() => {
            createCodewindYamlFile(testDirectory, { version: '1.2.3.4' });
            const version = await getVersion(testDirectory);
            version.should.equal('0.0.0');
        });
        it('Fails to get version from a codewind.yaml file as it is in an incorrect format', async() => {
            createCodewindYamlFile(testDirectory, { version: 'latest' });
            const version = await getVersion(testDirectory);
            version.should.equal('0.0.0');
        });
        it('Fails to get version when a codewind.yaml does not exist in the given directory', async() => {
            fs.existsSync(path.join(testDirectory, 'codewind.yaml')).should.be.false;
            const version = await getVersion(testDirectory);
            version.should.equal('0.0.0');
        });
    });
    describe('isNewer(version, existingVersion)', () => {
        const isNewer = installExtensions.__get__('isNewer');
        it('Returns true as version is newer than existing version (different major version)', async() => {
            const result = await isNewer('1.2.3', '0.0.0');
            result.should.be.true;
        });
        it('Returns true as version is newer than existing version (same major version, different minor version)', async() => {
            const result = await isNewer('1.2.3', '1.1.0');
            result.should.be.true;
        });
        it('Returns true as version is newer than existing version (same major and minor version, different fix version)', async() => {
            const result = await isNewer('1.2.3', '1.2.1');
            result.should.be.true;
        });
        it('Returns true as the missing digit is ignored', async() => {
            const result = await isNewer('1.2.1', '1.1');
            result.should.be.true;
        });
        it('Returns false as major version is older than existing version (different major version)', async() => {
            const result = await isNewer('1.2.3', '10.0.0');
            result.should.be.false;
        });
        it('Returns false as minor version is older than existing version (same major version, different minor version)', async() => {
            const result = await isNewer('1.2.3', '1.5.0');
            result.should.be.false;
        });
        it('Returns false as fix version is older than existing version (same major and minor version, different fix version)', async() => {
            const result = await isNewer('1.2.3', '1.2.10');
            result.should.be.false;
        });
        it('Returns false as versions are exactly the same', async() => {
            const result = await isNewer('1.2.3', '1.2.3');
            result.should.be.false;
        });
        it('Returns false as the first 3 digits are the same and ignores the rest', async() => {
            let result = await isNewer('1.2.3', '1.2.3.4');
            result.should.be.false;
            result = await isNewer('1.2.3.4', '1.2.3');
            result.should.be.false;
        });
        it('Returns false as the first 2 digits are the same and one version is missing a digit (NaN)', async() => {
            let result = await isNewer('1.1.1', '1.1');
            result.should.be.false;
            result = await isNewer('1.1', '1.1.1');
            result.should.be.false;
        });
    });
    describe('prepForUnzip(target, version)', () => {
        const prepForUnzip = installExtensions.__get__('prepForUnzip');
        const prepForUnzipDir = path.join(testDirectory, 'prepForUnzip');
        const prepForUnzipDirWithSuffix = prepForUnzipDir + SUFFIX_OLD;
        beforeEach(() => {
            createCodewindYamlFile(prepForUnzipDir, { version: '1.0.0' });
        });
        afterEach(() => {
            execSync(`rm -rf ${prepForUnzipDir}`);
            execSync(`rm -rf ${prepForUnzipDirWithSuffix}`);
        });
        it('Should detect the current codewind.yaml is older and rename the directory to "directoryName+SUFFIX_OLD"', async() => {
            const installShouldProceed = await prepForUnzip(prepForUnzipDir, '2.0.0');
            installShouldProceed.should.be.true;

            fs.pathExistsSync(prepForUnzipDir).should.be.false;
            fs.pathExistsSync(prepForUnzipDirWithSuffix).should.be.true;
        });
        it('Should detect the current codewind.yaml is newer, return false and do nothing with the existing directory', async() => {
            const installShouldProceed = await prepForUnzip(prepForUnzipDir, '0.0.0');
            installShouldProceed.should.be.false;

            fs.pathExistsSync(prepForUnzipDir).should.be.true;
            fs.pathExistsSync(prepForUnzipDirWithSuffix).should.be.false;
        });
        it('Should detect the current codewind.yaml is the same version as the new one, return false and do nothing with the existing directory', async() => {
            const installShouldProceed = await prepForUnzip(prepForUnzipDir, '1.0.0');
            installShouldProceed.should.be.false;

            fs.pathExistsSync(prepForUnzipDir).should.be.true;
            fs.pathExistsSync(prepForUnzipDirWithSuffix).should.be.false;
        });
        it('Should remove a directory which already exists with the SUFFIX_OLD variable and replace it', async() => {
            // Use getVersion to verify that the correct folder exists with SUFFIX_OLD
            const getVersion = installExtensions.__get__('getVersion');

            createCodewindYamlFile(prepForUnzipDirWithSuffix, { version: '0.0.0' });
            fs.pathExistsSync(prepForUnzipDir).should.be.true;
            fs.pathExistsSync(prepForUnzipDirWithSuffix).should.be.true;

            const installShouldProceed = await prepForUnzip(prepForUnzipDir, '2.0.0');
            installShouldProceed.should.be.true;

            fs.pathExistsSync(prepForUnzipDir).should.be.false;
            fs.pathExistsSync(prepForUnzipDirWithSuffix).should.be.true;

            const version = await getVersion(prepForUnzipDirWithSuffix);
            version.should.equal('1.0.0');
        });
    });
});

const assertExtensionIsNotInstalled = targetDir => {
    // targetDir should be empty if an extension has not been installed
    const files = fs.readdirSync(targetDir);
    files.length.should.equal(0);
};

const skipIfOnJenkins = thisContext => {
    if ('JENKINS_HOME' in process.env) {
        console.log(`On Jenkins: Skipping block in ${thisContext.test.fullTitle()} as it contains zip/unzip functions`);
        thisContext.skip();
    }
};
