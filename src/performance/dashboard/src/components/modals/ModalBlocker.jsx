/*******************************************************************************
* Copyright (c) 2020 IBM Corporation and others.
* All rights reserved. This program and the accompanying materials
* are made available under the terms of the Eclipse Public License v2.0
* which accompanies this distribution, and is available at
* http://www.eclipse.org/legal/epl-v20.html
*
* Contributors:
*     IBM Corporation - initial API and implementation
*******************************************************************************/

import React, { Component, Fragment } from 'react'
import { Button } from 'carbon-components-react'
import IconRefresh from '@carbon/icons-react/es/restart/16';
import { Modal } from 'carbon-components-react';

import './ModalBlocker.scss'

export default class ModalBlocker extends Component {

    constructor(props) {
        super(props);
        this.handleRefreshPage = this.handleRefreshPage.bind(this)
    }

    handleRefreshPage() {
        window.location.reload();
    }

    render() {

        if (!this.props.active)
            return (<Fragment />)

        return (
            <div>
                <Modal id="CodewindDisconnected"
                    modalAriaLabel="Codewind disconnected"
                    open={true}
                    danger={true}
                    passiveModal={true}
                    shouldsubmitonenter="false"
                    modalLabel=""
                    modalHeading="Dashboard Offline"
                    primaryButtonText="Refresh"
                    selectorPrimaryFocus="[data-modal-primary-focus]"
                    secondaryButtonText=""
                    iconDescription="Refresh window">
                    <p>Performance dashboard has lost connection to Codewind</p>
                    <p>You can try reconnecting by refreshing the page</p>
                    <br />
                    <Button size="default" onClick={() => this.handleRefreshPage()} kind="danger" icon={IconRefresh} iconDescription="Refresh page">Refresh Page</Button>
                </Modal>
            </div>
        )
    }
}