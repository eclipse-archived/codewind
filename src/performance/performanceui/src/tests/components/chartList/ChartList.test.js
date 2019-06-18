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
import { createStore } from 'redux';
import { render } from 'react-testing-library';
import reducers from '../../../store/reducers/index';
import ChartList from '../../../components/chartList/ChartList';
import * as ChartModels from '../../data/ChartModels';

/**
 * Setup component props
 */
const componentProps = {
  chartModels: ChartModels.chartModels
}

// Initialise redux stores
const store = createStore(reducers, {
  localeReducer: { lang: 'en' }
})

const wrapper = (
  <Provider store={store}>
    <ChartList {...componentProps}/>
  </Provider>
);

describe('<ChartList />', () => { 

  it('Shallow renders without crashing', () => {
    shallow(<ChartList {...componentProps} />);
  });

  it('asserts exactly 4 chart components are rendered', () => {
    const { container } = render(wrapper);
    expect(container.querySelectorAll('.Chart').length).toBe(4);
  });

});
