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

import { CAPABILITIES_PANEL } from '../actions/types';

export default function reducer(
  state = {
    displayCapabilitiesPanel: true,
  },
  action
) {
  switch (action.type) {
    case CAPABILITIES_PANEL: {
      return { ...state, displayCapabilitiesPanel: action.revealPanel };
    }
    default: { }
  }
  return state;
}