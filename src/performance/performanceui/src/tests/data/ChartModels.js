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

import { CHART_TYPE_CPU, CHART_TYPE_MEMORY, CHART_TYPE_HTTP, CHART_TYPE_HITS } from '../../AppConstants';

/**
 * Sample Chart Data
 */
export const chartModels = [
    {
      chartType: CHART_TYPE_HTTP,
      title: 'HTTP RESPONSE',
      data:{
        columns:["/","1.5","1.8","1.9","2.0","2.1","2.2","2.3"],
        selection:{enabled: true, grouped: true, multiple: true, draggable:true},
        types:{"/":"bar"}
      },
      colLimit: 5
    },
    {
      chartType: CHART_TYPE_HITS,
      title: 'HTTP HITS',
      data:{
        columns:["/","1.5","1.8","1.9","2.0","2.1","2.2","2.3"],
        selection:{enabled: true, grouped: true, multiple: true, draggable:true},
        types:{"/":"line"}
      },
      colLimit: 5
    },
    {
      chartType: CHART_TYPE_CPU,
      title: 'CPU',
      data:{
        columns:[
          ["systemMean","18","19","20","11","11","12","30"],
          ["systemPeak","23","23","23","21","14","15","33"],
          ["processMean","15","17","18","6","8","9","9"],
          ["processPeak","19","19","19","8","10","10","12"]
        ],
        selection:{enabled: true, grouped: true, multiple: true, draggable:true},
        types:{"systemMean":"area-spline","systemPeak":"area-spline","processMean":"area-spline","processPeak":"area-spline"}
      },
    },
    {
      chartType: CHART_TYPE_MEMORY,
      title: 'Memory',
      data:{
        columns:[
          ["usedHeapAfterGC","1","2","3","4","5","6","7"],
          ["usedNativePeak","11","21","31","41","51","61","71"]
        ],
        selection:{enabled: true, grouped: true, multiple: true, draggable:true},
        types:{"usedHeapAfterGC":"area-spline","usedNativePeak":"area-spline"}
      },
    }
  ]

