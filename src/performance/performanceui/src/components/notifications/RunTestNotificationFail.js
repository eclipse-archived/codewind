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

// eslint-disable-next-line no-unused-vars
import React, { } from 'react';
import { ToastNotification } from 'carbon-components-react';
import Transition from 'react-transition-group/Transition';

const defaultStyle = { position: 'fixed', top: '0', right: '-320px', zIndex: '1000' };

const transitionStyles = {
    entered: {
        transform: 'translateX(-100%)',
        transition: `transform 300ms ease-in-out`
    },
    exiting: {
        transform: 'translateX(100%)',
        transition: `transform 300ms ease-in-out`
    },
    exited: {
        right: '-320px'
    }
};

const RunTestNotificationFail = ({ notification, titleMessage, notificationError }) => {
    return (
        <Transition in={notification} timeout={300} unmountOnExit>
            {(state) => (
                <div className="defaultTransitionStyle"
                    style={{ ...defaultStyle, ...transitionStyles[state] }}>
                    <ToastNotification
                        title={titleMessage}
                        kind={'error'}
                        subtitle={notificationError.message}
                        hideCloseButton
                        caption={new Date().toLocaleString()}
                    />
                </div>
            )}
        </Transition>
    );
}

export default RunTestNotificationFail;