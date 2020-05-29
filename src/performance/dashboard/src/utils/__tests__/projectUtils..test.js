/*******************************************************************************
* Copyright (c) 2020 IBM Corporation and others.
* All rights reserved. This program and the accompanying materials
* are made available under the terms of the Eclipse Public License v2.0
* which accompanies this distribution, and is available at
* http://www.eclipse.org/legal/epl-v20.html
*
* Contributors:
*     IBM Corporation - initial API and implementation
/*******************************************************************************/

import * as ProjectIDChecker from '../projectUtils';


// constants 
const testProjectID = '4a8ccb90-7887-11e9-b7bb-6fc798faec9b';



// run test
describe('Validate project ID from browser address field/>', () => {

  it('outputs an error message to the console and returns null if filtering failed', () => {
    let errorOutput = '';
    console.error = (e) => { errorOutput = e; }
    delete global.window.location;
    const projectID = ProjectIDChecker.projectID();
    expect(projectID).toBe(null);
    expect(errorOutput).toBe('ERROR: ProjectUtils: ');
  });

  it('returns null when the project ID is invalid', () => {
    delete global.window.location;
    global.window = Object.create(window);
    global.window.location = {
      port: '9090',
      protocol: 'http:',
      hostname: '127.0.0.1',
      search: `project=${testProjectID}BADBADBAD`,
    };
    const projectID = ProjectIDChecker.projectID();
    expect(projectID).toBe(null);
  });

  it('returns the valid projectID when one is supplied', () => {
    delete global.window.location;
    global.window = Object.create(window);
    global.window.location = {
      port: '9090',
      protocol: 'http:',
      hostname: '127.0.0.1',
      search: `project=${testProjectID}`,
    };
    const projectID = ProjectIDChecker.projectID();
    expect(projectID).toBe(testProjectID);
  });



});
