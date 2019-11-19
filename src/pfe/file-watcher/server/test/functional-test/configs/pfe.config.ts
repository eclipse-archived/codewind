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

export const deploymentRegistry = process.env.DEPLOYMENT_REGISTRY || "docker-registry.default.svc:5000/eclipse-che";

const apiv1 = "/api/v1/";

export const pfeAPIs = {
    "projects": apiv1 + "projects",
    "registry": apiv1 + "registry"
};
