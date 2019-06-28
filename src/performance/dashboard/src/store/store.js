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

import { createStore, applyMiddleware } from 'redux';
import reducer from './reducers';
import { createLogger } from 'redux-logger';
import thunkMiddleware from 'redux-thunk';

let middleware = [thunkMiddleware];

if (process.env.NODE_ENV !== 'production') {
    const loggerMiddleware = createLogger();
    middleware = [...middleware, loggerMiddleware];
}

export default createStore(reducer, applyMiddleware(...middleware));


