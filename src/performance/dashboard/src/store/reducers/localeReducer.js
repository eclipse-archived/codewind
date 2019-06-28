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

import { LOCALE_SET } from '../actions/types';

export default function reducer(
    state = {
        lang: 'en'
    },
    action
) {
    switch (action.type) {
        case LOCALE_SET: {
            return { ...state, lang: action.lang }
        }
        default: { }
    }
    return state;
}