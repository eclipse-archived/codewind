/*******************************************************************************
* Copyright (c) 2020 IBM Corporation and others.
* All rights reserved. This program and the accompanying materials
* are made available under the terms of the Eclipse Public License v2.0
* which accompanies this distribution, and is available at
* http://www.eclipse.org/legal/epl-v20.html
*
* Contributors:
*     IBM Corporation - initial API and implementation
*******************************************************************************/

const ActionTypes = require('../actions/types');

export default function reducer(
  state =   [],
  action,
) {
  switch (action.type) {
    case ActionTypes.ADD_NOTIFICATION: {
      return [action.payload,  ...state];
    }
    case ActionTypes.REMOVE_NOTIFICATION: {
      return state.filter(notification => notification.id !== action.payload);
    }
    default: {
      return state;
    }
  }
}