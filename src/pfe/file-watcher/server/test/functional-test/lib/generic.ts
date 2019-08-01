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
import Filewatcher from "../../../src/index";

const filewatcher = new Filewatcher();

export async function setLocaleAPI(locale: any): Promise<any> {
    return await filewatcher.setLocale(locale);
}

export async function setLoggingLevel(level: string): Promise<void> {
    return await filewatcher.setLoggingLevel(level);
}
