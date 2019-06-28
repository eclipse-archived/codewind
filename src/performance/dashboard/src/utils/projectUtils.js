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

let projectID = function () {
    try {
        // eslint-disable-next-line no-undef
        let urlParams = new URLSearchParams(window.location.search);
        let projectID = urlParams.get('project');
        const checkFormat = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(projectID);
        if (checkFormat) {
            return projectID;
        }
    } catch (err) {
        console.error('ERROR: ProjectUtils: ', err);
    }
    return null;
};

exports.projectID = projectID;