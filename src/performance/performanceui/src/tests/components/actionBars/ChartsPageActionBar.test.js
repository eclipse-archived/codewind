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

import React from 'react';
import { createStore } from 'redux';
import { Provider } from 'react-redux';
import { render } from 'react-testing-library';
import { BrowserRouter as Router } from 'react-router-dom';
import { shallow } from 'enzyme';

import { io } from '../../utils/MockSocket';
import SocketContext from '../../../utils/sockets/SocketContext';
import ChartsPageActionBar from '../../../components/actionBars/ChartsPageActionBar';
import reducers from '../../../store/reducers/index';

// Initialise redux stores
const store = createStore(reducers, {
  localeReducer: { lang: 'en' }
})

// Initialise mock socket
let socket = io.connect();

// Mock socket events
const testEvents = {
  runloadStatusChanged:[
     function(args) {
         return { projectID: args.projectID, status:  args.status };
     }
  ]
}

// populate socket with events
socket.initEvents(testEvents);

// initialise component props
const componentProps = {
  projectID: '4a8ccb90-7887-11e9-b7bb-6fc798faec9b'
}

const wrapper = (
  <Provider store={store}>
    <Router >
      <SocketContext.Provider value={socket}>
        <ChartsPageActionBar {...componentProps}/>
      </SocketContext.Provider>
    </Router>
  </Provider>
);

describe('<ChartsPageActionBar />', () => {
  
  it('Shallow renders without crashing', () => {
    shallow(<ChartsPageActionBar {...componentProps} />);
  });

  it('asserts there are just 2 action buttons', () => {
    const { container } = render(wrapper);
    expect(container.querySelectorAll('.actionButton').length).toBe(2);
  })

  it.skip('asserts there are no visible dialog boxes', () => {
    const { container } = render(wrapper);
    expect(container.querySelectorAll('div[role=dialog]').length).toBe(0);
  })
  
});
