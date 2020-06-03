/*******************************************************************************
* Copyright (c) 2020 IBM Corporation and others.
* All rights reserved. This program and the accompanying materials
* are made available under the terms of the Eclipse Public License v2.0
* which accompanies this distribution, and is available at
* http://www.eclipse.org/legal/epl-v20.html
*
* Contributors:
*     IBM Corporation - initial API and implementation
******************************************************************************/


// Sample data from the API:  /api/vi/projects/{projectID}/metrics/types
// Note: This PFE API returns the metric collection rather than the types list
export const metrics = [
  {
    type: 'cpu', metrics: [],
  },
  {
    type: 'gc', metrics: [],
  },
  {
    type: 'memory', metrics: [],
  },
  {
    type: 'http', metrics: [],
  }
];

// Sample data from the API:  /api/vi/projects/{projectID}/metrics
// This PFE API returns the type of metrics not the actual metrics
export const metricTypes = [
  {
    type: 'cpu',
    endpoint: '/metrics/cpu',
  },
  {
    type: 'gc',
    endpoint: '/metrics/gc',
  },
  {
    type: 'memory',
    endpoint: '/metrics/memory',
  },
  {
    type: 'http',
    endpoint: '/metrics/http',
  }
];
