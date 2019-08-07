/*******************************************************************************
* Copyright (c) 2019 IBM Corporation and others.
* All rights reserved. This program and the accompanying materials
* are made available under the terms of the Eclipse Public License v2.0
* which accompanies this distribution, and is available at
* http://www.eclipse.org/legal/epl-v20.html
*
* Contributors:
*     IBM Corporation - initial API and implementation
******************************************************************************/


/**
 * MockSocket.js 
 * 
 * Provides a test socket that can be used to simulate socket io operations without a network or server. 
 * to use:
 * 
 * 1.  Register socket events eg : 
 * 
 * let socket = io.connect();
 * socket.initEvents({
 *   runloadStatusChanged:[
 *     function(args) {
 *       return { projectID: args.projectID, status:  args.status };
 *     }
 *   ]
 * });
 * 
 * 2.  Emit an event 
 * 
 * socket.emit("runloadStatusChanged", {projectID:projectID, status:"started"});
 * 
 * 3.  Test case
 * 
 * Firing an emit follows the standard flow. A UI component would usually be listening for the 
 * event and would react accordingly on receiving it.  The test case can then proceed to validate 
 * any resulting UI changes. 
 * 
 */

let socketEvents = {}

/*
* Mock socket implementation supports 3 functions: on, emit and initEvents 
* on: watch for a socket event
* emit: send an event through the socket
* initEvents: a collection of event types which the socket can process
*/
const socket = {
    on(socketEventName, eventFunction) {
        if (socketEvents[socketEventName]) {
            return socketEvents[socketEventName].push(eventFunction);
        }
        socketEvents[socketEventName] = [eventFunction];
    },
    emit(socketEventName, ...args) {
        socketEvents[socketEventName].forEach(socketFunction => socketFunction(...args));
    },
    initEvents(newEvents) {
        socketEvents = newEvents
    }
};

// Mock Server socket
export const io = {
    connect() {
        return socket;
    }
};

export default io;