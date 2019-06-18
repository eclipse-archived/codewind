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

import org.eclipse.codewind.iterdev.ProcessRunner.ConsoleStream;

/** This class may be used to selectively prevent text from the process being echo-ed back to the user. */
public interface IConsoleFilter {

	public boolean excludeConsoleText(ConsoleStream s, String text);
}
