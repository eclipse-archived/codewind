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

import { CAPABILITIES_PANEL } from './types';

export const revealCapabilitiesPanel = showPanel => ({
  type: CAPABILITIES_PANEL,
  revealPanel: showPanel,
});

// change state of the capabilities panel
export const showCapabilitiesPanel = showPanel => (dispatch) => {
  dispatch(revealCapabilitiesPanel(showPanel));
}