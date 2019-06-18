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

export const pfe = {
    "PROTOCOL": process.env.PFE_PROTOCOL || "http",
    "HOST": process.env.PFE_HOST || "localhost",
    "PORT": process.env.PFE_PORT || "9090",
};

const apis = ["/api/v1/"];

export const pfeAPIs = {
    "projects": apis + "projects"
};
