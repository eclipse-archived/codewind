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

import fs from 'fs-extra';
import path from 'path';

import { projectTypesWithInternalDebugPort,
  projectTypesWithMavenSettings  } from  '../config/cwSettingsFields';

import { CWSettings } from '../types/initializeTypes';

export function writeCwSettings(projectMountDirectory: string, projectType: string): void {
  const emptyCwSettings: CWSettings = createEmptyCwSettingsObject(projectType);

  const settingsPath: string = path.join(projectMountDirectory, '.cw-settings');
  const legacySettingsPath: string = path.join(projectMountDirectory, '.mc-settings');

  // check if .mc-settings exists and rename if it does
  if (fs.existsSync(legacySettingsPath)) {
    fs.moveSync(legacySettingsPath, settingsPath);

  // write .cw-settings file if it doesn't already exist
  } else if (!fs.existsSync(settingsPath)) {
    fs.writeFileSync(settingsPath, JSON.stringify(emptyCwSettings, undefined, 2));
  }
}

export function createEmptyCwSettingsObject(projectType: string): CWSettings {
  const settings: CWSettings = {
    contextRoot: '',
    internalPort: '',
    healthCheck: '',
    ignoredPaths: [''],
  };

  if (projectTypesWithInternalDebugPort.includes(projectType)) {
    settings.internalDebugPort = '';
  }

  if (projectTypesWithMavenSettings.includes(projectType)) {
    settings.mavenProfiles = [''];
    settings.mavenProperties = [''];
  }

  return settings;
}
