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

const chai = require('chai');
const fs = require('fs-extra');
const path = require('path');
const reqService = require('../../modules/request.service');
const containerService = require('../../modules/container.service');
const { ADMIN_COOKIE, testTimeout } = require('../../config');

chai.should();

const getRegistrySecrets = () => reqService.chai
    .get('/api/v1/registrysecrets')
    .set('Cookie', ADMIN_COOKIE);

const setRegistrySecret = (dockerAddress, dockerCredentials) => reqService.chai
    .post('/api/v1/registrysecrets')
    .set('Cookie', ADMIN_COOKIE)
    .send({ address: dockerAddress, credentials: dockerCredentials });

const removeRegistrySecret = (dockerAddress) => reqService.chai
    .delete('/api/v1/registrysecrets')
    .set('Cookie', ADMIN_COOKIE)
    .send({ address: dockerAddress });

describe('Registry Secrets route tests', function() {
    const tempDir = path.join(__dirname, 'registrySecretsTemp');
    const docker_registry_file = '/root/.docker/config.json';
    const docker_registry_secret_garbage_json = {
        auths: {
            'https://index.docker.io/v1/': {
                username: 'garbage',
                password: 'garbage',
                auth: 'garbage',
            },
            garbageaddress2: {
                username: 'garbageusername',
                password: 'garbagepassword',
                auth: 'garbageauth',
            },
        },
    };
    let restoreConfig = false;

    
    before('Create a backup of the existing /root/.docker/config.json file', async function() {
        this.timeout(testTimeout.med);

         // Create a backup of existing docker registry file
        if (await containerService.fileExists(docker_registry_file)) {
            await containerService.copyFrom(docker_registry_file, path.join(tempDir, 'config_bk.json'));
            restoreConfig = true;
            await containerService.removeDir(docker_registry_file);
        }

        // Create the temp directory
        await fs.ensureDir(tempDir);
    });

    after('Restore /root/.docker/config.json file', async function() {
        this.timeout(testTimeout.med);

        // Restore the docker registry file backup
        if (restoreConfig) {
            await containerService.copyTo(path.join(tempDir, 'config_bk.json'), docker_registry_file);
        }

        // Remove the temp directory
        await fs.remove(tempDir);
    });

    describe('GET /api/v1/registrysecrets', function() {
        it('should return an empty array without any docker registry', async function() {
            this.timeout(testTimeout.med);
            
            const res = await getRegistrySecrets();
            res.status.should.equal(200, res.text); // print res.text if assertion fails
            res.body.should.be.an('array').to.have.lengthOf(0);
        });

        it('should return the right number of secrets from the registry file', async function() {
            this.timeout(testTimeout.med);

            // create a docker registry with the garbage content
            const docker_registry_secret_garbage_content = JSON.stringify(docker_registry_secret_garbage_json);
            const docker_registry_secret_garbage_file = path.join(tempDir, 'config.json');
            fs.writeFileSync(docker_registry_secret_garbage_file, docker_registry_secret_garbage_content, 'utf8');
            await containerService.copyTo(docker_registry_secret_garbage_file, docker_registry_file);

            const res = await getRegistrySecrets();
            res.status.should.equal(200, res.text); // print res.text if assertion fails
            res.body.should.be.an('array').to.have.lengthOf(2);
        });

        it('should throw an error for a bad docker registry file', async function() {
            this.timeout(testTimeout.med);

            let docker_registry_secret_bad_content = JSON.stringify(docker_registry_secret_garbage_json);
            docker_registry_secret_bad_content = docker_registry_secret_bad_content.concat('garbage');
            const docker_registry_secret_bad_file = path.join(tempDir, 'config.json');
            fs.writeFileSync(docker_registry_secret_bad_file, docker_registry_secret_bad_content, 'utf8');
            await containerService.copyTo(docker_registry_secret_bad_file, docker_registry_file);

            const res = await getRegistrySecrets();
            res.status.should.equal(500, res.text); // print res.text if assertion fails
            res.text.should.be.not.empty;
        });
    });

    describe('POST /api/v1/registrysecrets', function() {
        before('Delete /root/.docker/config.json file before doing the POST operation', async function() {
            this.timeout(testTimeout.med);
    
             // Delete the docker registry file
            if (await containerService.fileExists(docker_registry_file)) {
                await containerService.removeDir(docker_registry_file);
            }
            
        });

        after('Delete /root/.docker/config.json file after doing the POST operation', async function() {
            this.timeout(testTimeout.med);
    
             // Delete the docker registry file
            if (await containerService.fileExists(docker_registry_file)) {
                await containerService.removeDir(docker_registry_file);
            }
            
        });

        it('should successfully set the docker registry', async function() {
            this.timeout(testTimeout.med);
            
            const dockerAddress = 'docker.io';
            const dockerUsername = 'randomusername';
            const dockerPassword = 'randompassword';
            const fullyQualifiedDockerRegistryAddress = 'https://index.docker.io/v1/';
            const credentials = { username: dockerUsername, password: dockerPassword };
            const credentials_string = JSON.stringify(credentials);
            const encodedDockerCredentials = Buffer.from(credentials_string).toString('base64');

            const res = await setRegistrySecret(dockerAddress, encodedDockerCredentials);
            res.status.should.equal(201, res.text); // print res.text if assertion fails
            res.body.should.be.an('array').to.have.lengthOf(1);
            res.body[0].address.should.equal(fullyQualifiedDockerRegistryAddress);
            res.body[0].username.should.equal(dockerUsername);
        });

        it('should throw an error for the same docker registry address if already set', async function() {
            this.timeout(testTimeout.med);
            
            const dockerAddress = 'docker.io';
            const dockerUsername = 'randomusernamerandomusername';
            const dockerPassword = 'randompasswordrandompassword';
            const credentials = { username: dockerUsername, password: dockerPassword };
            const credentials_string = JSON.stringify(credentials);
            const encodedDockerCredentials = Buffer.from(credentials_string).toString('base64');

            const res = await setRegistrySecret(dockerAddress, encodedDockerCredentials);
            res.status.should.equal(400, res.text); // print res.text if assertion fails
            res.text.should.be.not.empty;
        });

        it('should throw an error for an invalid encoded credential object', async function() {
            this.timeout(testTimeout.med);
            
            // invalid encoded credential object with wrong keys
            const dockerAddress = 'docker.io.new';
            const dockerUsername = 'randomusername';
            const dockerPassword = 'randompassword';
            const credentials = { usernamegarbage: dockerUsername, passwordgarbage: dockerPassword };
            const credentials_string = JSON.stringify(credentials);
            let encodedDockerCredentials = Buffer.from(credentials_string).toString('base64');

            let res = await setRegistrySecret(dockerAddress, encodedDockerCredentials);
            res.status.should.equal(400, res.text); // print res.text if assertion fails
            res.text.should.be.not.empty;

            // invalid encoded credential object with bad JSON
            encodedDockerCredentials = 'garbage'.concat(encodedDockerCredentials);

            res = await setRegistrySecret(dockerAddress, encodedDockerCredentials);
            res.status.should.equal(400, res.text); // print res.text if assertion fails
            res.text.should.be.not.empty;
        });

        it('should throw an error for a bad docker registry file', async function() {
            this.timeout(testTimeout.med);

            let docker_registry_secret_bad_content = JSON.stringify(docker_registry_secret_garbage_json);
            docker_registry_secret_bad_content = docker_registry_secret_bad_content.concat('garbage');
            const docker_registry_secret_bad_file = path.join(tempDir, 'config.json');
            fs.writeFileSync(docker_registry_secret_bad_file, docker_registry_secret_bad_content, 'utf8');
            await containerService.copyTo(docker_registry_secret_bad_file, docker_registry_file);

            const dockerAddress = 'docker.io.new';
            const dockerUsername = 'randomusername';
            const dockerPassword = 'randompassword';
            const credentials = { username: dockerUsername, password: dockerPassword };
            const credentials_string = JSON.stringify(credentials);
            const encodedDockerCredentials = Buffer.from(credentials_string).toString('base64');

            const res = await setRegistrySecret(dockerAddress, encodedDockerCredentials);
            res.status.should.equal(500, res.text); // print res.text if assertion fails
            res.text.should.be.not.empty;
        });
    });

    describe('DELETE /api/v1/registrysecrets', function() {
        before('Delete /root/.docker/config.json file before doing the DELETE operation', async function() {
            this.timeout(testTimeout.med);
    
             // Delete the docker registry file
            if (await containerService.fileExists(docker_registry_file)) {
                await containerService.removeDir(docker_registry_file);
            }
            
        });

        after('Delete /root/.docker/config.json file after doing the DELETE operation', async function() {
            this.timeout(testTimeout.med);
    
             // Delete the docker registry file
            if (await containerService.fileExists(docker_registry_file)) {
                await containerService.removeDir(docker_registry_file);
            }
            
        });

        it('should throw an error for attempting to remove secret from a missing Docker registry', async function() {
            this.timeout(testTimeout.med);
            
            const dockerAddress = 'docker.io';

            const res = await removeRegistrySecret(dockerAddress);
            res.status.should.equal(400, res.text); // print res.text if assertion fails
            res.text.should.be.not.empty;
        });

        it('should throw an error for attempting to remove an invalid secret from a Docker registry', async function() {
            this.timeout(testTimeout.med);
            
            const dockerAddress = 'docker.io';
            const invalidDockerAddress = 'docker.io.garbage';
            const dockerUsername = 'randomusername';
            const dockerPassword = 'randompassword';
            const fullyQualifiedDockerRegistryAddress = 'https://index.docker.io/v1/';
            const credentials = { username: dockerUsername, password: dockerPassword };
            const credentials_string = JSON.stringify(credentials);
            const encodedDockerCredentials = Buffer.from(credentials_string).toString('base64');

            let res = await setRegistrySecret(dockerAddress, encodedDockerCredentials);
            res.status.should.equal(201, res.text); // print res.text if assertion fails
            res.body.should.be.an('array').to.have.lengthOf(1);
            res.body[0].address.should.equal(fullyQualifiedDockerRegistryAddress);
            res.body[0].username.should.equal(dockerUsername);

            res = await removeRegistrySecret(invalidDockerAddress);
            res.status.should.equal(400, res.text); // print res.text if assertion fails
            res.text.should.be.not.empty;
        });

        it('should throw an error for a bad docker registry file', async function() {
            this.timeout(testTimeout.med);
            
            let docker_registry_secret_bad_content = JSON.stringify(docker_registry_secret_garbage_json);
            docker_registry_secret_bad_content = docker_registry_secret_bad_content.concat('garbage');
            const docker_registry_secret_bad_file = path.join(tempDir, 'config.json');
            fs.writeFileSync(docker_registry_secret_bad_file, docker_registry_secret_bad_content, 'utf8');
            await containerService.copyTo(docker_registry_secret_bad_file, docker_registry_file);

            const dockerAddress = 'docker.io';

            const res = await removeRegistrySecret(dockerAddress);
            res.status.should.equal(500, res.text); // print res.text if assertion fails
            res.text.should.be.not.empty;
        });

        it('should successfully remove a valid registry secret', async function() {
            this.timeout(testTimeout.med);
            
            const docker_registry_secret_garbage_content = JSON.stringify(docker_registry_secret_garbage_json);
            const docker_registry_secret_garbage_file = path.join(tempDir, 'config.json');
            fs.writeFileSync(docker_registry_secret_garbage_file, docker_registry_secret_garbage_content, 'utf8');
            await containerService.copyTo(docker_registry_secret_garbage_file, docker_registry_file);

            const dockerAddress = 'docker.io';

            const res = await removeRegistrySecret(dockerAddress);
            res.status.should.equal(200, res.text); // print res.text if assertion fails
            res.body.should.be.an('array').to.have.lengthOf(1);
        });
    });
});
