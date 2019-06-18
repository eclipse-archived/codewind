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
const BuildToolTipContent = (snapshot, title, multiplier, precision, units) => {
    let counterNames = Object.getOwnPropertyNames(snapshot);
    return (
        <div className='TestCardTooltip'>
            <div className='tooltipTitle'>{title}</div>
            <div className='tooltipTable'>
                {
                    counterNames.map(counter => {
                        let counterValue = (snapshot[counter] * multiplier).toFixed(precision);
                        return (
                            <div key={counter} className="tooltipRow">
                                <div className="columnL">{counter}:</div>
                                <div className="columnR">{counterValue}{units}</div>
                            </div>
                        )
                    })
                }
            </div>
        </div>
    )
}

export default BuildToolTipContent;
