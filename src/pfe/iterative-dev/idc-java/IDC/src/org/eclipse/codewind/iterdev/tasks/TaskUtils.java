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

import java.io.IOException;

import org.eclipse.codewind.iterdev.IConsoleFilter;
import org.eclipse.codewind.iterdev.IDCContext;
import org.eclipse.codewind.iterdev.ProcessRunner;

public class TaskUtils {

	/**
	 * Run a given command using ProcessBuilder
	 * @param cmd Full command to run (including params)
	 * @param context The context which contains the root password (if required for sudo), or null if not required
	 * @param showOutput Whether or not to echo process output to the screen
	 * @return Maybe used to retrieve process error code or output 
	 * @throws IOException
	 * @throws InterruptedException
	 */
	public static ProcessRunner runCmd(String cmd, IDCContext context, boolean showOutput) throws IOException, InterruptedException {
		return runCmd(cmd, context, null, showOutput);
	}

	public static ProcessRunner runCmd(String cmd, IDCContext context, IConsoleFilter filter, boolean showOutput)
			throws IOException, InterruptedException {

		ProcessRunner pr = createRunnerForCmd(cmd, context.getRootPassword().orElse(null), showOutput);
		if(filter != null)
			pr.addConsoleFilter(filter);
		pr.startAndWaitForTermination();

		return pr;
	}

	public static ProcessRunner createRunnerForCmd(String cmd, IDCContext context, boolean showOutput)
			throws IOException, InterruptedException {
		return createRunnerForCmd(cmd, context.getRootPassword().orElse(null), showOutput);
	}

	private static ProcessRunner createRunnerForCmd(String cmd, String rootPassword, boolean showOutput)
			throws IOException, InterruptedException {

		ProcessRunner pr;
		boolean isWindows = System.getProperty("os.name").toLowerCase().contains("windows");

		if (isWindows) {
			pr = new ProcessRunner(new String[] { "cmd", "/c", cmd }, showOutput);

		} else {

			// Unixes

			if (rootPassword == null) {
				pr = new ProcessRunner(new String[] { "/bin/bash", "-c", cmd }, showOutput);
			} else {
				pr = new ProcessRunner(new String[] { "/bin/bash", "-c", "echo " + rootPassword + " | sudo -S " + cmd },
						showOutput);
			}
		}

		return pr;
	}

}