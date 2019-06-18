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

export const appName = "codewind";

export const localeList = [
    { id: 'en', label: 'English' },
    { id: 'fr', label: 'French' },
    { id: 'de', label: 'German' }
];

export const MAX_DESC_LENGTH = 80;

export const ROUTES_CHARTS = 'charts';
export const ROUTES_MANAGE = 'manage';

export const CHART_TYPE_CPU = 'cpu';
export const CHART_TYPE_MEMORY = 'memory';
export const CHART_TYPE_HTTP = 'http';
export const CHART_TYPE_HITS = 'hits';

export const MICROCLIMATE_SERVER_API = 'http://localhost:9090';

export const TESTRUN_MAX_REQUEST_PER_SEC = 3600;  
export const TESTRUN_MAX_CONCURRENT = 100;
export const TESTRUN_MAX_DURATION = 500;

export const TESTRUN_DEFAULT_REQUEST_PER_SEC = 5000;
export const TESTRUN_DEFAULT_CONCURRENT = 10;
export const TESTRUN_DEFAULT_DURATION = 120;

export const LOADRUN_CONTENT_TYPES = [
   {id: 'json',        text: 'application/json'}
 ];

 export const LOADRUN_METHODS = [
    {id: 'GET', text: 'GET'},
    {id: 'POST', text: 'POST'}
]
