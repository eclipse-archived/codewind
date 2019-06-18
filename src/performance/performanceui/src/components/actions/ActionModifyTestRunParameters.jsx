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

import React, { Fragment } from 'react'
import { connect } from 'react-redux';
import { Button } from 'carbon-components-react';
import { TranslatedText } from '../../translations';
import ModalModifyLoadTests from '../modalDlgs/ModalModifyLoadTests';
import Edit from '@carbon/icons-react/lib/edit/16';

class ActionModifyTestRunParameters extends React.Component {

    constructor(props) {
        super(props);
        this.state = {
            showModal: false
        }
        this.handleShowModal = this.handleShowModal.bind(this);
        this.handleCloseModal = this.handleCloseModal.bind(this);
    }

    handleShowModal() {
        this.setState({ showModal: true });
    }

    handleCloseModal() {
        this.setState({ showModal: false });
    }

    render() {
        return (
            <Fragment>
                <ModalModifyLoadTests open={this.state.showModal} closeModalWindow={this.handleCloseModal} />
                <Button renderIcon={Edit} data-testid="modifyConfig" onClick={() => this.handleShowModal()}>{TranslatedText(this.props.lang, "page.link.modifyParams", 'Modify Parameters')}</Button>
            </Fragment>
        )
    }
}

const mapStateToProps = stores => {
    return {
        lang: stores.localeReducer.lang,
    };
};

export default connect(mapStateToProps)(ActionModifyTestRunParameters);
