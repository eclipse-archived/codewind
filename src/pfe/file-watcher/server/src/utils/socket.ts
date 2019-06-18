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
"use strict";

import * as logger from "./logger";

export interface FWEventHandler {
    name: string;
    handleEvent: (event: string, data: any) => void;
}

const registeredListeners: Array<FWEventHandler> = [];

/**
 * @function
 * @description Emit a listener event.
 *
 * @param event <Required | String> - The event to be emitted.
 * @param data <Required | Any> - The data to be emitted.
 *
 * @returns void
 *
 */
export function emitOnListener (event: string, data: any): void {
    const projectID = data.projectID;
    logger.logFileWatcherInfo("Emitting event over listener \n message: " + event + "\n data: " + JSON.stringify(data, undefined, 2), projectID);
    registeredListeners.map( x => x.handleEvent(event, data));
}


/**
 * @see [[Filewatcher.registerListener]]
 */
export function registerListener(listener: FWEventHandler): void {
    logger.logFileWatcherInfo("Registered listener: " + listener.name);
    registeredListeners.push(listener);
}