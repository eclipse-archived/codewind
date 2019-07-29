/*******************************************************************************
 * Licensed Materials - Property of IBM
 * "Restricted Materials of IBM"
 *
 * Copyright IBM Corp. 2018, 2019 All Rights Reserved
 *
 * US Government Users Restricted Rights - Use, duplication or disclosure
 * restricted by GSA ADP Schedule Contract with IBM Corp.
 *******************************************************************************/
import Filewatcher from "../../../src/index";

const filewatcher = new Filewatcher();

interface PFEEvent {
    eventName: string;
    eventData: any;
}

export class SocketIO {
    allEvents: Array<PFEEvent>;

    constructor() {
        this.allEvents = [];
    }

    registerListener(listenerName: string): any {
        filewatcher.registerListener({
            name: listenerName,
            handleEvent: (event, eventData) => {
                const thisEvent: PFEEvent = {
                    eventName: event,
                    eventData: eventData
                };
                this.allEvents.push(thisEvent);
            }
        });
    }

    getAllEvents(): Array<PFEEvent> {
        return this.allEvents;
    }
}
