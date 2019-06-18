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

package org.eclipse.codewind.iterdev.tasks;

import org.eclipse.codewind.iterdev.Constants;
import org.eclipse.codewind.iterdev.IDCContext;
import org.eclipse.codewind.iterdev.Logger;

public class SwitchModeTask {

    public static boolean execute(IDCContext context, Constants.MODE mode) {
        
        context.getAppDb().put(Constants.MODE_KEY, mode.name());
		
		Logger.info("* Switched to " + mode.label + " mode.");
        return true;
    }

}