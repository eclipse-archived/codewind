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

import SocketContext from '../../utils/sockets/SocketContext';
import { fetchProjectConfig } from '../../store/actions/projectInfoActions';
import * as AppConstants from '../../AppConstants';
import { setConnectionState } from '../../store/actions/statusActions';
import logo from './logo@1x.png';
import './NavBar.scss';


class NavBar extends React.Component {
    constructor() {
        super()
        this.state = {
            projectName: ''
        }
        this.handleRefreshPage = this.handleRefreshPage.bind(this)
    }

    handleRefreshPage(){
        window.location.reload();
    }

    async componentDidMount() {

        this.props.socket.on('disconnect', (reason) => {
            console.error("Performance Dashboard has disconnected from Codewind: ", reason);
            this.props.dispatch(setConnectionState(false));
        });

        this.props.socket.on('connect', () => {
            console.log("Performance Dashboard has connected to Codewind");
            this.props.dispatch(setConnectionState(true));
        });

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

    render() {
        return (
            <div className='NavBar' role="banner">
                <span className='logo'> <img src={logo} alt="logo" aria-label="Logo" title="Logo"/> </span>
                <span className='appTitle_1'>code</span>
                <span className='appTitle_2'>wind</span>
                <span className='projectName'>{this.state.projectName}</span>
                {
                    this.props.connectionStatus.socketConnected ?
                    <span aria-label="Connected to Codewind" className='serviceState'>Connected</span> : 
                    <span aria-label="Disconnected Click to refresh" title="Click here to refresh window" onClick={ this.handleRefreshPage } className='serviceState offline'>Offline</span>
                }
            </div>
        )
    }
}


// Mapped Redux Stores
const mapStateToProps = stores => {
    return {
        projectInfo: stores.projectInfoReducer,
        connectionStatus: stores.statusReducer
    };
};

// Add UI SocketContext via props
const NavBarWithSocket = props => (
    <SocketContext.Consumer>
        {socket => <NavBar {...props} socket={socket} />}
    </SocketContext.Consumer>
)

NavBar.propTypes = {
    projectID: PropTypes.string.isRequired
}

export default connect(mapStateToProps)(NavBarWithSocket);

