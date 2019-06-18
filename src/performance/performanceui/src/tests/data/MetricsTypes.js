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

export const types=[
    {
      "type": "cpu",
      "metrics": [
        {
          "time": 1558094756839,
          "endTime": 1558094785256,
          "value": {
            "data": {
              "systemMean": 0.45111811111111105,
              "systemPeak": 0.582337,
              "processMean": 0.16365728888888886,
              "processPeak": 0.183869
            },
            "units": {
              "systemMean": "decimal fraction",
              "systemPeak": "decimal fraction",
              "processMean": "decimal fraction",
              "processPeak": "decimal fraction"
            }
          },
          "desc": "Made a small change to JSON loader"
        },
        {
          "time": 1558094863528,
          "endTime": 1558094889108,
          "value": {
            "data": {
              "systemMean": 0.5497524444444445,
              "systemPeak": 0.651573,
              "processMean": 0.15743233666666667,
              "processPeak": 0.185518
            },
            "units": {
              "systemMean": "decimal fraction",
              "systemPeak": "decimal fraction",
              "processMean": "decimal fraction",
              "processPeak": "decimal fraction"
            }
          }
        },
        {
          "time": 1558094921657,
          "endTime": 1558094943795,
          "value": {
            "data": {
              "systemMean": 0.45729962500000004,
              "systemPeak": 0.61951,
              "processMean": 0.150658272625,
              "processPeak": 0.188318
            },
            "units": {
              "systemMean": "decimal fraction",
              "systemPeak": "decimal fraction",
              "processMean": "decimal fraction",
              "processPeak": "decimal fraction"
            }
          }
        }
      ]
    },
    {
      "type": "gc",
      "metrics": [
        {
          "time": 1558094756839,
          "endTime": 1558094785256,
          "value": {
            "data": {
              "gcTime": 0.0004681324550863427
            },
            "units": {
              "gcTime": "decimal fraction"
            }
          },
          "desc": "Made a small change to JSON loader"
        },
        {
          "time": 1558094863528,
          "endTime": 1558094889108,
          "value": {
            "data": {
              "gcTime": 0.0005864088599059138
            },
            "units": {
              "gcTime": "decimal fraction"
            }
          }
        },
        {
          "time": 1558094921657,
          "endTime": 1558094943795,
          "value": {
            "data": {
              "gcTime": 0.0003775805967994492
            },
            "units": {
              "gcTime": "decimal fraction"
            }
          }
        
        }
      ]
    },
    {
      "type": "memory",
      "metrics": [
        {
          "time": 1558094756839,
          "endTime": 1558094785256,
          "value": {
            "data": {
              "usedHeapAfterGCPeak": 55346608,
              "usedNativePeak": 4030705664
            },
            "units": {
              "usedHeapAfterGCPeak": "bytes",
              "usedNativePeak": "bytes"
            }
          },
          "desc": "Made a small change to JSON loader"
        },
        {
          "time": 1558094863528,
          "endTime": 1558094889108,
          "value": {
            "data": {
              "usedHeapAfterGCPeak": 58296656,
              "usedNativePeak": 3952848896
            },
            "units": {
              "usedHeapAfterGCPeak": "bytes",
              "usedNativePeak": "bytes"
            }
          }
        },
        {
          "time": 1558094921657,
          "endTime": 1558094943795,
          "value": {
            "data": {
              "usedHeapAfterGCPeak": 49746896,
              "usedNativePeak": 3967791104
            },
            "units": {
              "usedHeapAfterGCPeak": "bytes",
              "usedNativePeak": "bytes"
            }
          }
        }
      ]
    },
    {
      "type": "http",
      "metrics": [
        {
          "time": 1558094756839,
          "endTime": 1558094785256,
          "value": {
            "data": [
              {
                "url": "/",
                "method": "GET",
                "hits": 1952,
                "averageResponseTime": 22.576037602459124,
                "longestResponseTime": 237.506
              },
              {
                "url": "/health",
                "method": "GET",
                "hits": 3,
                "averageResponseTime": 1.9693333333333332,
                "longestResponseTime": 4.3656
              }
            ],
            "units": {
              "averageResponseTime": "ms",
              "longestResponseTime": "ms",
              "hits": "count"
            }
          },
          "desc": "Made a small change to JSON loader"
        },
        {
          "time": 1558094863528,
          "endTime": 1558094889108,
          "value": {
            "data": [
              {
                "url": "/",
                "method": "GET",
                "hits": 1967,
                "averageResponseTime": 10.187953990849207,
                "longestResponseTime": 170.465
              },
              {
                "url": "/health",
                "method": "GET",
                "hits": 2,
                "averageResponseTime": 2.555,
                "longestResponseTime": 4.46
              }
            ],
            "units": {
              "averageResponseTime": "ms",
              "longestResponseTime": "ms",
              "hits": "count"
            }
          }
        },
        {
          "time": 1558094921657,
          "endTime": 1558094943795,
          "value": {
            "data": [
              {
                "url": "/",
                "method": "GET",
                "hits": 1952,
                "averageResponseTime": 9.028636834016362,
                "longestResponseTime": 303.7238
              },
              {
                "url": "/health",
                "method": "GET",
                "hits": 3,
                "averageResponseTime": 2.4392333333333336,
                "longestResponseTime": 3.4037
              }
            ],
            "units": {
              "averageResponseTime": "ms",
              "longestResponseTime": "ms",
              "hits": "count"
            }
          }
        }
      ]
    }
  ]
