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

import { fetchProjectConfig } from '../../store/actions/projectInfoActions';
import * as AppConstants from '../../AppConstants';
import logo from './logo@1x.png';
import './NavBar.scss';


class NavBar extends React.Component {
    constructor() {
        super()
        this.state = {
            projectName: ''
        }
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

    render() {
        return (
            <div className='NavBar'>
                <span className='logo'> <img src={logo}/> </span>
                <span className='appTitle_1'>code</span>
                <span className='appTitle_2'>wind</span>
                <span className='projectName'>{this.state.projectName}</span>
            </div>
        )
    }
}


// Mapped Redux Stores
const mapStateToProps = stores => {
    return {
        projectInfo: stores.projectInfoReducer
    };
};

NavBar.propTypes = {
    projectID: PropTypes.string.isRequired
}

export default connect(mapStateToProps)(NavBar);

