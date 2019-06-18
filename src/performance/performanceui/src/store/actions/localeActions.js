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

import { LOCALE_SET } from './types';

export const localeSet = lang => ({
    type: LOCALE_SET,
    lang: lang
});

// save locale information to store and browser localstorage
export const setLocale = lang => (dispatch) => {
    localStorage.lang = lang;
    dispatch(localeSet(lang));
}