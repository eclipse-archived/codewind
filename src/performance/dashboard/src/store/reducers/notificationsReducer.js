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
  state = [],
  action,
) {
  switch (action.type) {
    case ActionTypes.ADD_NOTIFICATION: {
      const lastNotification = state[0];
      const newNotification = action.payload;
      // Avoid spamming the collection by checking its different to the entry before it in the stack.
      if (state.length > 0 &&
        lastNotification.kind === newNotification.kind &&
        lastNotification.title === newNotification.title &&
        lastNotification.subtitle === newNotification.subtitle &&
        lastNotification.caption === newNotification.caption
      ) {
        return state;
      }
      return [action.payload, ...state];
    }
    case ActionTypes.REMOVE_NOTIFICATION: {
      return state.filter(notification => notification.id !== action.payload);
    }
    default: {
      return state;
    }
  }
}