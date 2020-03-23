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

import { SET_CONNECTED_STATUS } from '../actions/types';

export default function reducer(
  state = {
    socketConnected: false,
  },
  action,
) {
  switch (action.type) {
    case SET_CONNECTED_STATUS: {
      return { ...state, socketConnected: action.socketConnected }
    }
    default: { }
  }
  return state;
}
