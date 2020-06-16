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
global.codewind = { RUNNING_IN_K8S: false };

const rewire = require('rewire');
const chai = require('chai');
const chaiAsPromised = require('chai-as-promised');
const fs = require('fs-extra');
const path = require('path');

const Links = rewire('../../../../../src/pfe/portal/modules/project/Links');
const { suppressLogOutput } = require('../../../../modules/log.service');
const { TEMP_TEST_DIR } = require('../../../../config');
const ProjectLinkError = require('../../../../../src/pfe/portal/modules/utils/errors/ProjectLinkError');

chai.should();
chai.use(chaiAsPromised);

const dummyLink = {
    projectID: 'dummyID',
    projectName: 'dummyName',
    projectURL: 'projectURL',
    envName: 'ENV_NAME',
};

const afterDeleteEnvFile = () => {
    afterEach(() => {
        const envFileLocation = path.join(TEMP_TEST_DIR, '.codewind-project-links.env');
        fs.removeSync(envFileLocation);
    });
};


describe('Links.js', function() {
    suppressLogOutput(Links);
    describe('Class functions', () => {
        describe('new Links(directory, args)', () => {
            it('initialises a new Links object', () => {
                const links = new Links('');
                links.should.deep.equal({ _links: [], fileName: '.codewind-project-links.env', filePath: '.codewind-project-links.env' });
            });
            it('initialises a new Links object using the links passed in through args', () => {
                const args = {
                    _links: [dummyLink],
                };
                const links = new Links('', args);
                links.should.deep.equal({ ...args, fileName: '.codewind-project-links.env', filePath: '.codewind-project-links.env' });
            });
        });
        describe('getFileName()', () => {
            it('returns the file path of the project links file', () => {
                const links = new Links(TEMP_TEST_DIR);
                links.getFileName().should.equal('.codewind-project-links.env');
            });
        });
        describe('getFilePath()', () => {
            it('returns the file path of the project links file', () => {
                const links = new Links(TEMP_TEST_DIR);
                links.getFilePath().should.equal(path.join(TEMP_TEST_DIR, '.codewind-project-links.env'));
            });
        });
        describe('envFileExists()', () => {
            it('reports the env file existing as false as it has not been created yet', async() => {
                const links = new Links(TEMP_TEST_DIR);
                const exists = await links.envFileExists();
                exists.should.equal(false);
            });
            it('returns the file path of the project links file', async() => {
                const links = new Links(TEMP_TEST_DIR);
                await links.add(dummyLink);
                links.envFileExists().should.eventually.equal(true);
            });
        });
        describe('getAll()', () => {
            it('returns the links array', () => {
                const links = new Links(TEMP_TEST_DIR);
                const linkArray = links.getAll();
                linkArray.length.should.equal(0);
            });
            it('returns a populated links array', async() => {
                const links = new Links(TEMP_TEST_DIR);
                await links.add(dummyLink);
                await links.add({ ...dummyLink, envName: 'otherEnv' });
                const linkArray = links.getAll();
                linkArray.length.should.equal(2);
            });
        });
        describe('get()', () => {
            it('returns the requested link', async() => {
                const links = new Links(TEMP_TEST_DIR);
                await links.add(dummyLink);
                const link = links.get(dummyLink.envName);
                link.should.deep.equal(dummyLink);
            });
            it('throws an error as the requested link does not exist', () => {
                const links = new Links(TEMP_TEST_DIR);
                (() => links.get('nonexistant')).should.throw(ProjectLinkError)
                    .and.have.property('code', 'NOT_FOUND');
            });
        });
        describe('getEnvPairs()', () => {
            it('returns an empty array as no links exist', () => {
                const links = new Links(TEMP_TEST_DIR);
                const linkArray = links.getEnvPairs();
                linkArray.length.should.equal(0);
            });
            it('returns the links as envirnonment variable pairs', async() => {
                const links = new Links(TEMP_TEST_DIR);
                await links.add(dummyLink);
                await links.add({ ...dummyLink, envName: 'otherEnv' });
                const envPairs = links.getEnvPairs();
                envPairs.length.should.equal(2);
                const { envName, projectURL } = dummyLink;
                envPairs.should.deep.equal([`${envName}=${projectURL}`, `otherEnv=${projectURL}`]);
            });
        });
        describe('getEnvPairObject()', () => {
            it('returns an empty object as no links exist', () => {
                const links = new Links(TEMP_TEST_DIR);
                const envObject = links.getEnvPairObject();
                Object.keys(envObject).length.should.equal(0);
            });
            it('returns the links as as an object', async() => {
                const links = new Links(TEMP_TEST_DIR);
                await links.add(dummyLink);
                await links.add({ ...dummyLink, envName: 'otherEnv' });
                const envObject = links.getEnvPairObject();
                Object.keys(envObject).length.should.equal(2);
                const { envName, projectURL } = dummyLink;
                envObject.should.deep.equal({
                    [envName]: projectURL,
                    otherEnv: projectURL,
                });
            });
        });
        describe('add(newLink)', () => {
            afterDeleteEnvFile();
            it('adds a new link to the link object and writes the env file', async() => {
                const links = new Links(TEMP_TEST_DIR);
                await links.add(dummyLink);
                links._links.length.should.equal(1);
                const fileContents = await fs.readFile(links.filePath, 'utf8');
                const { envName, projectURL } = dummyLink;
                fileContents.should.equal(`${envName}=${projectURL}\n`);
            });
            it('throws an error as the newLink object is empty', () => {
                const links = new Links(TEMP_TEST_DIR);
                return links.add({})
                    .should.be.eventually.rejectedWith(ProjectLinkError)
                    .and.eventually.have.property('code', 'INVALID_PARAMETERS');
            });
            it('throws an error as the newLink object has all the parameters but they are null', () => {
                const links = new Links(TEMP_TEST_DIR);
                return links.add({
                    projectID: null,
                    projectURL: null,
                    parentPFEURL: null,
                    envName: null,
                    type: null,
                }).should.be.eventually.rejectedWith(ProjectLinkError)
                    .and.eventually.have.property('code', 'INVALID_PARAMETERS');
            });
            it('throws an error as the newLink object already exists in the Links array', async() => {
                const links = new Links(TEMP_TEST_DIR);
                await links.add(dummyLink);
                return links.add(dummyLink)
                    .should.be.eventually.rejectedWith(ProjectLinkError)
                    .and.eventually.have.property('code', 'EXISTS');
            });
        });
        describe('update(envName, newEnvName)', () => {
            afterDeleteEnvFile();
            it('updates a link', async() => {
                const links = new Links(TEMP_TEST_DIR);
                await links.add(dummyLink);

                const { envName } = dummyLink;
                await links.update(envName, 'NEW_ENV');
                const linkArray = links.getAll();
                linkArray.should.deep.includes({ ...dummyLink, envName: 'NEW_ENV' });
            });
            it('does not error when the given fields are the same as the old ones', async() => {
                const links = new Links(TEMP_TEST_DIR);
                await links.add(dummyLink);

                const { envName } = dummyLink;
                await links.update(envName, envName);
                const linkArray = links.getAll();
                linkArray.should.deep.includes(dummyLink);
            });
            it('throws an error as the newEnvName is a blank string (no update)', async() => {
                const links = new Links(TEMP_TEST_DIR);
                await links.add(dummyLink);

                const { envName } = dummyLink;
                return links.update(envName, '')
                    .should.be.eventually.rejectedWith(ProjectLinkError)
                    .and.eventually.have.property('code', 'INVALID_PARAMETERS');
            });
            it('throws an error as the link does not exist', () => {
                const links = new Links(TEMP_TEST_DIR);
                return links.update('nonexistant', 'notnull')
                    .should.be.eventually.rejectedWith(ProjectLinkError)
                    .and.eventually.have.property('code', 'NOT_FOUND');
            });
            it('throws an error as the newEnvName is the same as an existing envName', async() => {
                const links = new Links(TEMP_TEST_DIR);
                await links.add(dummyLink);
                await links.add({ ...dummyLink, envName: 'ENV_TO_UPDATE' });

                const { envName, projectURL } = dummyLink;
                return links.update('ENV_TO_UPDATE', envName, projectURL)
                    .should.be.eventually.rejectedWith(ProjectLinkError)
                    .and.eventually.have.property('code', 'EXISTS');
            });
        });
        describe('delete(envName)', () => {
            afterDeleteEnvFile();
            it('deletes a link', async() => {
                const links = new Links(TEMP_TEST_DIR);
                await links.add(dummyLink);

                const { envName } = dummyLink;
                await links.delete(envName);
                const linkArray = links.getAll();
                linkArray.should.deep.equal([]);
            });
            it('throws an error as the link does not exist', () => {
                const links = new Links(TEMP_TEST_DIR);
                return links.delete('nonexistant')
                    .should.be.eventually.rejectedWith(ProjectLinkError)
                    .and.eventually.have.property('code', 'NOT_FOUND');
            });
        });
        describe('deleteByTargetProjectID(targetProjectID)', () => {
            afterDeleteEnvFile();
            it('does nothing as there are no links', async() => {
                // arrange
                const links = new Links(TEMP_TEST_DIR);
                links.getAll().length.should.equal(0);

                // act
                const linksRemoved = await links.deleteByTargetProjectID('projectID');

                // assert
                links.getAll().length.should.equal(0);
                linksRemoved.should.be.false;
            });
            it('does nothing as no links match the projectID', async() => {
                // arrange
                const links = new Links(TEMP_TEST_DIR);
                await links.add(dummyLink);
                await links.add({ ...dummyLink, envName: 'otherEnv' });
                links.getAll().length.should.equal(2);

                // act
                const linksRemoved = await links.deleteByTargetProjectID('projectID');

                // assert
                links.getAll().length.should.equal(2);
                linksRemoved.should.be.false;
            });
            it('removes two links as they match the projectID', async() => {
                // arrange
                const links = new Links(TEMP_TEST_DIR);
                await links.add({ ...dummyLink, projectID: 'projectID' });
                await links.add({ ...dummyLink, projectID: 'projectID', envName: 'otherEnv' });
                await links.add({ ...dummyLink, projectID: 'differentID', envName: 'invalidProjectIDEnv' });
                links.getAll().length.should.equal(3);

                // act
                const linksRemoved = await links.deleteByTargetProjectID('projectID');

                // assert
                links.getAll().length.should.equal(1);
                linksRemoved.should.be.true;
            });
        });
    });
    describe('Local functions', () => {
        describe('validateLink(newLink, links', () => {
            const validateLink = Links.__get__('validateLink');
            it('throws an error as the newLink object is missing the projectID', () => {
                const newLink = {
                    envName: 'env',
                    projectURL: 'some',
                };
                (() => validateLink(newLink, [])).should.throw(ProjectLinkError)
                    .and.have.property('code', 'INVALID_PARAMETERS');
            });
            it('throws an error as newLink envName already exists in the links array', () => {
                const links = [{ envName: 'existing' }];
                const newLink = {
                    projectID: 'id',
                    projectName: 'name',
                    envName: 'existing',
                    projectURL: 'some',
                };
                (() => validateLink(newLink, links)).should.throw(ProjectLinkError)
                    .and.have.property('code', 'EXISTS');
            });
            it('returns a validated link object', () => {
                const newLink = {
                    projectID: 'id',
                    projectName: 'name',
                    envName: 'existing',
                    projectURL: 'some',
                };
                const validatedLink = validateLink(newLink, []);
                validatedLink.should.deep.equal(newLink);
            });
        });
        describe('envNameExists(links, envName)', () => {
            const envNameExists = Links.__get__('envNameExists');
            it('returns true as the given envName exists in the links array', () => {
                const links = [{ envName: 'existing' }];
                envNameExists(links, 'existing').should.be.true;
            });
            it('returns false as the given envName does not exist in the links array', () => {
                envNameExists([], 'notexisting').should.be.false;
            });
        });
        describe('updateEnvironmentFile(filePath, links)', () => {
            const updateEnvironmentFile = Links.__get__('updateEnvironmentFile');
            const filePath = path.join(TEMP_TEST_DIR, 'updateEnvironmentFileTest');
            afterEach(() => {
                fs.removeSync(filePath);
            });
            it('writes out the environment file', async() => {
                const links = ['env1=url1', 'env2=url2'];
                await updateEnvironmentFile(filePath, links);
                const pathExists = await fs.pathExists(filePath);
                pathExists.should.be.true;
                const fileContents = await fs.readFile(filePath, 'utf8');
                fileContents.should.equal('env1=url1\nenv2=url2\n');
            });
            it('does not create an environment file if an empty env array is given', async() => {
                const links = [];
                await updateEnvironmentFile(filePath, links);
                const pathExists = await fs.pathExists(filePath);
                pathExists.should.be.false;
            });
            it('removes an environment file if an empty env array is given', async() => {
                const links = [];
                await fs.ensureFile(filePath);
                await updateEnvironmentFile(filePath, links);
                const pathExists = await fs.pathExists(filePath);
                pathExists.should.be.false;
            });
        });
    });
});
