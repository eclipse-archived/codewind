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

const dummyLocalLink = {
    projectID: 'dummyID',
    projectURL: 'projectURL',
    envName: 'ENV_NAME',
    type: Links.TYPES.LOCAL,
};

const dummyRemoteLink = {
    ...dummyLocalLink,
    parentPFEURL: 'parentURL',
    type: Links.TYPES.REMOTE,
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
                links.should.deep.equal({ _links: [], filePath: '.codewind-project-links.env' });
            });
            it('initialises a new Links object using the links passed in through args', () => {
                const args = {
                    _links: [dummyRemoteLink],
                };
                const links = new Links('', args);
                links.should.deep.equal({ ...args, filePath: '.codewind-project-links.env' });
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
                await links.add(dummyRemoteLink);
                await links.add({ ...dummyRemoteLink, envName: 'otherEnv' });
                const linkArray = links.getAll();
                linkArray.length.should.equal(2);
            });
        });
        describe('get()', () => {
            it('returns the requested link', async() => {
                const links = new Links(TEMP_TEST_DIR);
                await links.add(dummyRemoteLink);
                const link = links.get(dummyRemoteLink.envName);
                link.should.deep.equal(dummyRemoteLink);
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
                await links.add(dummyRemoteLink);
                await links.add({ ...dummyRemoteLink, envName: 'otherEnv' });
                const envPairs = links.getEnvPairs();
                envPairs.length.should.equal(2);
                const { envName, projectURL } = dummyRemoteLink;
                envPairs.should.deep.equal([`${envName}=${projectURL}`, `otherEnv=${projectURL}`]);
            });
        });
        describe('add(newLink)', () => {
            afterDeleteEnvFile();
            it('adds a new link to the link object and writes the env file', async() => {
                const links = new Links(TEMP_TEST_DIR);
                links.add(dummyRemoteLink);
                links._links.length.should.equal(1);
                const fileContents = await fs.readFile(links.filePath, 'utf8');
                const { envName, projectURL } = dummyRemoteLink;
                fileContents.should.equal(`${envName}=${projectURL}`);
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
            it('throws an error as the newLink object has a type of REMOTE but does not contain a parentPFEURL', () => {
                const links = new Links(TEMP_TEST_DIR);
                return links.add({
                    ...dummyLocalLink,
                    type: Links.TYPES.REMOTE,
                })
                    .should.be.eventually.rejectedWith(ProjectLinkError)
                    .and.eventually.have.property('code', 'INVALID_PARAMETERS');
            });
            it('throws an error as the newLink object already exists in the Links array', async() => {
                const links = new Links(TEMP_TEST_DIR);
                await links.add(dummyRemoteLink);
                return links.add(dummyRemoteLink)
                    .should.be.eventually.rejectedWith(ProjectLinkError)
                    .and.eventually.have.property('code', 'EXISTS');
            });
        });
        describe('update(envName, newEnvName, newProjectURL)', () => {
            afterDeleteEnvFile();
            it('updates a link', async() => {
                const links = new Links(TEMP_TEST_DIR);
                await links.add(dummyRemoteLink);

                const { envName } = dummyRemoteLink;
                await links.update(envName, 'NEW_ENV', 'NEW_URL');
                const linkArray = links.getAll();
                linkArray.should.deep.includes({ ...dummyRemoteLink, envName: 'NEW_ENV', projectURL: 'NEW_URL' });
            });
            it('does not error when the given fields are the same as the old ones', async() => {
                const links = new Links(TEMP_TEST_DIR);
                await links.add(dummyRemoteLink);

                const { envName, projectURL } = dummyRemoteLink;
                await links.update(envName, envName, projectURL);
                const linkArray = links.getAll();
                linkArray.should.deep.includes(dummyRemoteLink);
            });
            it('throws an error as the newEnvName is a blank string (no update)', async() => {
                const links = new Links(TEMP_TEST_DIR);
                await links.add(dummyRemoteLink);

                const { envName } = dummyRemoteLink;
                return links.update(envName, '', 'NEW_URL')
                    .should.be.eventually.rejectedWith(ProjectLinkError)
                    .and.eventually.have.property('code', 'INVALID_PARAMETERS');
            });
            it('throws an error as the newProjectURL is a blank string (no update)', async() => {
                const links = new Links(TEMP_TEST_DIR);
                await links.add(dummyRemoteLink);

                const { envName } = dummyRemoteLink;

                return links.update(envName, 'notnull', null)
                    .should.be.eventually.rejectedWith(ProjectLinkError)
                    .and.eventually.have.property('code', 'INVALID_PARAMETERS');
            });
            it('throws an error as the link does not exist', () => {
                const links = new Links(TEMP_TEST_DIR);
                return links.update('nonexistant', 'notnull', 'notnull')
                    .should.be.eventually.rejectedWith(ProjectLinkError)
                    .and.eventually.have.property('code', 'NOT_FOUND');
            });
            it('throws an error as the newEnvName is the same as an existing envName', async() => {
                const links = new Links(TEMP_TEST_DIR);
                await links.add(dummyRemoteLink);
                await links.add({ ...dummyRemoteLink, envName: 'ENV_TO_UPDATE' });

                const { envName, projectURL } = dummyRemoteLink;
                return links.update('ENV_TO_UPDATE', envName, projectURL)
                    .should.be.eventually.rejectedWith(ProjectLinkError)
                    .and.eventually.have.property('code', 'EXISTS');
            });
        });
        describe('delete(envName)', () => {
            afterDeleteEnvFile();
            it('deletes a link', async() => {
                const links = new Links(TEMP_TEST_DIR);
                await links.add(dummyRemoteLink);

                const { envName } = dummyRemoteLink;
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
    });
    describe('Local functions', () => {
        describe('validateLink(newLink, links', () => {
            const validateLink = Links.__get__('validateLink');
            it('throws an error as the newLink object is missing the projectID', () => {
                const newLink = {
                    envName: 'env',
                    projectURL: 'some',
                    type: Links.TYPES.LOCAL,
                };
                (() => validateLink(newLink, [])).should.throw(ProjectLinkError)
                    .and.have.property('code', 'INVALID_PARAMETERS');
            });
            it('throws an error as a link with TYPE=REMOTE does not have a parentPFEURL', () => {
                const newLink = {
                    projectID: 'id',
                    envName: 'env',
                    projectURL: 'some',
                    type: Links.TYPES.REMOTE,
                };
                (() => validateLink(newLink, [])).should.throw(ProjectLinkError)
                    .and.have.property('code', 'INVALID_PARAMETERS');
            });
            it('throws an error as a link with TYPE=REMOTE is given a projectURL of null', () => {
                const newLink = {
                    projectID: 'id',
                    envName: 'env',
                    projectURL: null,
                    parentPFEURL: 'url',
                    type: Links.TYPES.REMOTE,
                };
                (() => validateLink(newLink, [])).should.throw(ProjectLinkError)
                    .and.have.property('code', 'INVALID_PARAMETERS');
            });
            it('throws an error as newLink envName already exists in the links array', () => {
                const links = [{ envName: 'existing' }];
                const newLink = {
                    projectID: 'id',
                    envName: 'existing',
                    projectURL: 'some',
                    type: Links.TYPES.LOCAL,
                };
                (() => validateLink(newLink, links)).should.throw(ProjectLinkError)
                    .and.have.property('code', 'EXISTS');
            });
            it('returns a validated link object', () => {
                const newLink = {
                    projectID: 'id',
                    envName: 'existing',
                    projectURL: 'some',
                    type: Links.TYPES.LOCAL,
                };
                const validatedLink = validateLink(newLink, []);
                validatedLink.should.deep.equal(newLink);
            });
            it('returns a validated link object when projectURL is null and TYPE=LOCAL', () => {
                const newLink = {
                    projectID: 'id',
                    envName: 'existing',
                    projectURL: null,
                    type: Links.TYPES.LOCAL,
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
        describe('writeEnvironmentFile(filePath, links)', () => {
            const writeEnvironmentFile = Links.__get__('writeEnvironmentFile');
            const filePath = path.join(TEMP_TEST_DIR, 'writeEnvironmentFileTest');
            afterEach(() => {
                fs.removeSync(filePath);
            });
            it('writes out the environment file', async() => {
                const links = ['env1=url1', 'env2=url2'];
                await writeEnvironmentFile(filePath, links);
                await fs.pathExists(filePath);
                const fileContents = await fs.readFile(filePath, 'utf8');
                fileContents.should.equal('env1=url1\nenv2=url2');
            });
        });
    });
});
