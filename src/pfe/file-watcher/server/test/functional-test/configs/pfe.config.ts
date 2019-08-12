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

const pfe = {
    "PROTOCOL": process.env.PFE_PROTOCOL || process.env.IN_K8 ? "https" : "http",
    "HOST": process.env.PFE_HOST || "localhost",
    "PORT": process.env.PFE_PORT || process.env.IN_K8 ? "9191" : "9090",
};

export const baseURL = pfe.PROTOCOL + "://" + pfe.HOST + ":" + pfe.PORT;

const apis = ["/api/v1/"];

export const deploymentRegistry = process.env.IN_K8_REGISTRY || "sakibh"; // need to change the default registry to the fallback of the che registry installed for test

export const pfeAPIs = {
    "projects": apis + "projects",
    "registry": apis + "registry"
};
