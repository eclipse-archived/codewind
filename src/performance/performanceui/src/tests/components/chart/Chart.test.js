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
import { Provider } from 'react-redux';
import { render, fireEvent, getByText} from 'react-testing-library';
import { createStore } from 'redux';
import reducers from '../../../store/reducers/index';
import Chart from '../../../components/chart/Chart';
import * as ChartModels from '../../data/ChartModels';

/**
 * Setup component props
 */
const chartModels = ChartModels.chartModels;

// Initialise redux stores
const store = createStore(reducers, {
  localeReducer: { lang: 'en' }
})

const wrapper = (
  <Provider store={store}>
    <Chart chartModel = {chartModels[0]}/>
  </Provider>
);

describe('<Chart />', () => { 

  it('Shallow renders without crashing', () => {
    shallow(<Chart />);
  });

  it('asserts title matches chartModel title', () => {
    const { container } = render(wrapper);
    const title = container.querySelector('.chartTitle');
    expect(title.innerHTML).toBe(chartModels[0].title);
  });

  it('asserts chartToolbar is empty', () => {
    const { container } = render(wrapper);
    const toolbar = container.querySelector('.chartToolbar');
    expect(toolbar.innerHTML).toBe('');
  })
  
});
