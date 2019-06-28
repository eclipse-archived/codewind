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
const chai = require('chai');
const fs = require('fs-extra');

const projectService = require('../../modules/project.service');
const { testTimeout, templateOptions } = require('../../config');

chai.should();

describe('Validate API', function() {
    const expectedCwSettingsData = {
        contextRoot: '',
        internalPort: '',
        healthCheck: '',
        watchedFiles: {
            includeFiles: [''],
            excludeFiles: [''],
        },
    };

    let workspaceLocation;

    before(async function() {
        this.timeout(testTimeout.med);
        workspaceLocation = await projectService.findWorkspaceLocation();
    });

    describe('when passed Java project', function() {
        let projectName, projectPath, expectedValidationResult;

        before(async function() {
            this.timeout(testTimeout.short);

            projectName = `javaValidateTest${Date.now()}`;
            projectPath = `${workspaceLocation}/${projectName}`;
            expectedValidationResult = {
                status: 'success',
                result: {
                    language: 'java',
                    projectType: 'liberty',
                },
                projectPath,
            };

            await projectService.cloneProject(templateOptions['liberty'].url, projectPath);
        });

        after(async function() {
            this.timeout(2 * testTimeout.med);
            await fs.remove(projectPath);
        });

        it('should return the correct project details', async function() {
            this.timeout(testTimeout.med);
            const res = await projectService.validate(projectPath);
            res.should.have.status(200);
            res.body.should.deep.equal(expectedValidationResult);
        });

        it('writes the .cw-settings file and adds the correct data', function() {
            const cwSettingsData = projectService.readCwSettings(projectPath);
            cwSettingsData.should.deep.equal(expectedCwSettingsData);
        });
    });

    describe('when passed unknown project', function() {
        let projectName, projectPath, expectedValidationResult;

        before(function() {
            projectName = `javaValidateTest${Date.now()}`;
            projectPath = `${workspaceLocation}/${projectName}`;

            expectedValidationResult = {
                status: 'success',
                result: {
                    language: 'unknown',
                    projectType: 'docker',
                },
                projectPath,
            };
        });

        it('returns the validation was a success but unknown type', async function() {
            this.timeout(testTimeout.med);
            const res = await projectService.validate(projectPath);
            res.should.have.status(200);
            res.body.should.deep.equal(expectedValidationResult);
        });

        it('writes the .cw-settings file and adds the correct data', function() {
            const cwSettingsData = projectService.readCwSettings(projectPath);
            cwSettingsData.should.deep.equal(expectedCwSettingsData);
        });
    });

    // can't find a non-bindable path!
    describe.skip('when passed non-bindable path', function() {
        const projectPath = '/invalid/path';

        const expectedValidationResult = {
            success: false,
            result: {
                error: 'Bind Error',
            },
        };

        it('returns an error', async function() {
            this.timeout(testTimeout.med);
            const res = await projectService.validate(projectPath);
            res.should.have.status(200);
            res.body.should.deep.equal(expectedValidationResult);
        });
    });

    describe('when passed invalid path', function() {
        const projectPath = ['arrays are not allowed'];

        it('returns a 400 code', async() => {
            const validationResult = await projectService.validate(projectPath);
            validationResult.should.have.status(400);
        });

        it('does NOT write .cw-settings file', function() {
            const cwSettingsExists = fs.existsSync(`${projectPath}/.cw-settings`);
            cwSettingsExists.should.be.false;
        });
    });
});
