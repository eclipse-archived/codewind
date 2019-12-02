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

import ms from "ms";

export const defaultTimeout = ms("5m");
export const defaultInterval = ms("5s");

export const createTestTimeout = ms("20m");
export const deleteTestTimeout = ms("1m");
export const testImagePushRegistryTimeout = ms("60s");
