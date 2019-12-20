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

export const imagePushRegistryAddress = process.env.IMAGE_PUSH_REGISTRY_ADDRESS || "docker-registry.default.svc:5000";
export const imagePushRegistryNamespace = process.env.IMAGE_PUSH_REGISTRY_NAMESPACE || "eclipse-che";

export const cheNamespace = process.env.NAMESPACE || "eclipse-che";

const apiv1 = "/api/v1/";

export const pfeAPIs = {
    "projects": apiv1 + "projects",
    "imagepushregistry": apiv1 + "imagepushregistry"
};
