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

import React from 'react';
import MetricsUtils from '../../modules/MetricsUtils';
import './TestCardTooltips.scss';

/**
 * Build the tooltop dialog
 * @param {*} snapshot 
 * @param {*} title 
 * @param {*} multiplier 
 * @param {*} precision 
 * @param {*} units 
 */
// eslint-disable-next-line class-methods-use-this
const buildToolTipContentHTTP = (snapshot, url) => {
    return (
        <div className='TestCardTooltip'>
            <div className='tooltipTitle'>Average Response Time</div>
            <div className='tooltipTable'>
                <div className="tooltipRow header">
                    <div className="columnL">Path</div>
                    <div className="columnC">Hits</div>
                    <div className="columnR">ms</div>
                </div>
                {
                    snapshot.map(urls => {
                        let counterValue = (urls.averageResponseTime).toFixed(2);
                        // return just the URL that matches path in config.json
                        if (MetricsUtils.getPathFromURL(urls.url) === url ) {
                            return (
                                <div key={`key_${urls.url}`} className="tooltipRow">
                                    <div className="columnL">{urls.url}</div>
                                    <div className="columnC">{urls.hits}</div>
                                    <div className="columnR">{counterValue}ms</div>
                                </div>
                            )
                        } 
                        return "";
                    })
                }
            </div>
        </div>
    )
}

export default buildToolTipContentHTTP;