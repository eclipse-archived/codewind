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
import { shallow } from 'enzyme';
import { createStore } from 'redux';
import { Provider } from 'react-redux';
import { BrowserRouter as Router } from 'react-router-dom';
import { render, fireEvent } from 'react-testing-library';

import PageManageTests from '../../pages/PageManageTests';
import reducers from '../../store/reducers/index';
import * as MetricTypes from '../data/MetricsTypes';

// Initialise component props
const componentProps = {
  projectID: '4a8ccb90-7887-11e9-b7bb-6fc798faec9b'
}

// Initialise redux stores
const store = createStore(reducers, {
  localeReducer: { lang: 'en' },
  projectMetricsReducer: { metrics: MetricTypes.types, receivedAt: Date.now(), fetched: true }
})

const wrapper = (
  <Provider store={store}>
    <Router >
      <PageManageTests {...componentProps} />
    </Router>
  </Provider>
);

describe('<PageManageTests />', () => {

  it('Shallow renders without crashing', () => {
    shallow(<PageManageTests />);
  });

  it('asserts that only 1 datatable container is rendered', () => {
    const { container } = render(wrapper);
    expect(container.querySelectorAll('.bx--data-table-container').length).toBe(1);
  });

  it('asserts that the datatable action bar is not rendered by default', () => {
    const { container } = render(wrapper);
    expect(container.querySelectorAll('.bx--batch-actions--active').length).toBe(0);
  });

  it('asserts that the datatable has a body', () => {
    const { container } = render(wrapper);
    expect(container.querySelectorAll('.bx--data-table-container > table > tbody').length).toBe(1);
  })

  it('asserts that the metrics dataset contains data', () => {
    expect(MetricTypes.types.length).toBe(4); // memory, http, cpu, gc 
  })

  it('Update props with data and assert the datatable renders all 3 rows', async () => {
    const { rerender, container } = render(wrapper);
    const wrapper_withUpdatedProps = (
      <Provider store={store}>
        <Router >
          <PageManageTests {...componentProps} projectMetrics={MetricTypes.types} />
        </Router>
      </Provider>
    );
    rerender(wrapper_withUpdatedProps);
    expect(container.querySelectorAll('.bx--data-table-container > table > tbody > tr').length).toBe(3);
  });

  it('asserts that selecting a row via its checkbox displays the datatable action bar', async () => {
    const { rerender, container } = render(wrapper);
    const wrapper_withUpdatedProps = (
      <Provider store={store}>
        <Router >
          <PageManageTests {...componentProps} projectMetrics={MetricTypes.types} />
        </Router>
      </Provider>
    );
    rerender(wrapper_withUpdatedProps);
    expect(container.querySelectorAll('.bx--data-table-container > table > tbody > tr:first-of-type > td > .bx--checkbox').length).toBe(1);
    const checkbox = container.querySelectorAll('.bx--data-table-container > table > tbody > tr:first-of-type > td > .bx--checkbox')[0];
    fireEvent.click(checkbox);
    expect(container.querySelectorAll('.bx--batch-actions--active').length).toBe(1);
  });


});


