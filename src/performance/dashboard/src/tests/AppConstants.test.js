/*******************************************************************************
* Copyright (c) 2019 IBM Corporation and others.
* All rights reserved. This program and the accompanying materials
* are made available under the terms of the Eclipse Public License v2.0
* which accompanies this distribution, and is available at
* http://www.eclipse.org/legal/epl-v20.html
*
* Contributors:
*     IBM Corporation - initial API and implementation
******************************************************************************/

import * as AppConstants from '../AppConstants'

describe('<AppConstants />', () => {
    test('API endpoint during test is valid', () => {
       expect(AppConstants.API_SERVER).toBe("http://localhost");
    });

    test('route name for performance dashboard is "charts"', () => {
       expect(AppConstants.ROUTES_CHARTS).toBe("charts");
    });

    test('metrics ids have not changed from their defaults', () => {
       expect(AppConstants.CHART_TYPE_CPU).toBe("cpu");
       expect(AppConstants.CHART_TYPE_MEMORY).toBe("memory");
       expect(AppConstants.CHART_TYPE_HTTP).toBe("http");
       expect(AppConstants.CHART_TYPE_HITS).toBe("hits");
    });
});