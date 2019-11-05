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

// must match filewatcher's list
export enum ProjectType {
  LIBERTY = 'liberty',
  SPRING = 'spring',
  NODEJS = 'nodejs',
  SWIFT = 'swift',
  DOCKER = 'docker'
}

export enum Status {
  success = 'success',
  failed = 'failed',
}

export interface InitializeResultResponse {
  status: Status;
  result: InitializeResult;
}

export interface InitializeResult {
  language?: string;
  projectType?: string;
  error?: string;
}

export interface CWSettings {
  contextRoot: string;
  internalPort: string;
  internalDebugPort?: string;
  healthCheck: string;
  isHttps: boolean;
  ignoredPaths?: string[];
  mavenProfiles?: string[];
  mavenProperties?: string[];
}
