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

package org.eclipse.codewind.iterdev;

import java.io.IOException;

import org.eclipse.codewind.iterdev.tasks.TaskUtils;

public class KubeUtils {
    public static String[] kubectlPs(IDCContext context) throws IOException, InterruptedException {
		String[] result;

		ProcessRunner pr = TaskUtils.runCmd("kubectl get po", context, false);
		result = pr.getReceived().split("\\r?\\n");
		return result;
	}
}