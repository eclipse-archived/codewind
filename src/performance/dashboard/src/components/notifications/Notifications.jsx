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

import React, { Component } from 'react'
import { connect } from 'react-redux';
import { ToastNotification } from 'carbon-components-react';

import { removeNotification } from '../../store/actions/notificationsActions'
import './Notifications.scss';

class Notifications extends Component {

  constructor(props) {
    super(props);
  }

  componentDidUpdate() {
    console.log(this.props.notifications)
  }

  handleRemoveNotification(id) {
    this.props.dispatch(removeNotification(id));
  }

  render() {
    return (
      <div className="Notifications">
        {
          this.props.notifications.map(notification => {
            return (
              <ToastNotification
                caption={notification.caption}
                hideCloseButton={false}
                iconDescription="remove notification"
                kind={notification.kind}
                notificationType="toast"
                onCloseButtonClick={() => this.handleRemoveNotification(notification.id)}
                role="alert"
                statusIconDescription="status"
                style={{
                  marginBottom: '.5rem',
                  minWidth: '30rem'
                }}
                subtitle={notification.subtitle}
                timeout={notification.timeout * 1000}
                title={notification.title}
              />
            )
          })
        }
      </div>
    )
  }
}

// Mapped Redux Stores
const mapStateToProps = stores => {
  return {
    notifications: stores.notificationsReducer,
  }
};

export default connect(mapStateToProps)(Notifications);