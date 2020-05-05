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

import React, { } from 'react'
import PropTypes from 'prop-types'
import { connect } from 'react-redux';
import { Button } from 'carbon-components-react';
import IconNotification from '@carbon/icons-react/es/notification/20';
import IconNotificationFill from '@carbon/icons-react/es/notification--filled/20';
import { fetchProjectConfig } from '../../store/actions/projectInfoActions';
import { showCapabilitiesPanel } from '../../store/actions/navbarActions';
import logo from './logo@1x.png';
import './NavBar.scss';


class NavBar extends React.Component {
    constructor() {
        super()
        this.state = {
            projectName: ''
        }
        this.toggleCapabilityPanel = this.toggleCapabilityPanel.bind(this);
    }

    async componentDidMount() {
        try {
            await this.props.dispatch(fetchProjectConfig(this.props.projectID));
        } catch (err) {
            this.setState({ projectName: '' });
        }
        this.setState({ projectName: this.props.projectInfo.config.name });
    }

    componentWillReceiveProps(nextProps) {
        if (this.state.projectName !== this.props.projectInfo.config.name) {
            this.setState({ projectName: this.props.projectInfo.config.name });
        }
    }

    toggleCapabilityPanel() {
        this.props.dispatch(showCapabilitiesPanel(!this.props.navbarActions.displayCapabilitiesPanel))
    }

    render() {
        return (
            <div className='NavBar' role="banner">
                <div className="title">
                    <span className='logo'> <img src={logo} alt="logo" aria-label="Logo" title="Logo"/> </span>
                    <span className='appTitle_1'>code</span>
                    <span className='appTitle_2'>wind</span>
                    <span className='projectName'>{this.state.projectName}</span>
                </div>
                <div className="utilities">
                    <Button size="small" kind="ghost" style={{float:"right"}}renderIcon={this.props.navbarActions.displayCapabilitiesPanel ? IconNotificationFill : IconNotification} onClick={() => this.toggleCapabilityPanel()}/>
                </div>
            </div>
        )
    }
}


// Mapped Redux Stores
const mapStateToProps = stores => {
    return {
        projectInfo: stores.projectInfoReducer,
        navbarActions: stores.navbarActionsReducer,
    };
};

NavBar.propTypes = {
    projectID: PropTypes.string.isRequired
}

export default connect(mapStateToProps)(NavBar);

