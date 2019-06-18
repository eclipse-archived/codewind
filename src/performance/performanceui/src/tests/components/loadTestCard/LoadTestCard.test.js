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
import { render, fireEvent } from 'react-testing-library';
import { BrowserRouter as Router } from 'react-router-dom';
import { shallow } from 'enzyme';

import LoadTestCard from '../../../components/LoadTestCard/LoadTestCard';
import reducers from '../../../store/reducers/index';

const store = createStore(reducers, {
  localeReducer: { lang: 'en' }
})

const componentProps = {
  plotpoint:0,
  urlFilter:"/",
  snapshot:{
    time: 1553610830484,   /* 2019-03-26 14:33:50 */
    desc: 'A string of plain text',
    cpu: {value: {value: {data: {processMean:0.06090}}}},
    http: {value: {value: {data: [ { "url": "/", "averageResponseTime": 2.2815333671914795} ]}}},
    memory: {value: {value: {data: {usedNativePeak:3007881216}}}}
  }
}

const wrapper = (
  <Provider store={store}>
    <Router >
      <LoadTestCard {...componentProps} />
    </Router>
  </Provider>
);

describe('<LoadTestCard />', () => { 

  it('Shallow renders without crashing', () => {
    shallow(<LoadTestCard {...componentProps} />);
  });


  it('asserts a valid card date and time', () => {
    const { container } = render(wrapper);
    expect(container.querySelectorAll('.testDate').length).toBe(1);
    expect(container.querySelectorAll('.testTime').length).toBe(1);
    const dateLabel = container.querySelector('.testDate');
    const timeLabel = container.querySelector('.testTime');
    expect(dateLabel.innerHTML).toBe('2019-03-26');
    expect(timeLabel.innerHTML).toBe('14:33:50');
  })


  it('assert card is rendered in a collapsed state', () => {
    const { container } = render(wrapper);
    expect(container.querySelectorAll('.LoadTestCard.expanded').length).toBe(0);
  });


  it('assert clicking the expand icon expands the card', () => {
    const { container } = render(wrapper);
    expect(container.querySelectorAll('.toolbar').length).toBe(1);
    const toolbar = container.querySelector('.toolbar');
    expect(toolbar.querySelectorAll('svg[aria-label="Expand/Collapse"]').length).toBe(1);
    const expanderButton = toolbar.querySelector('svg[aria-label="Expand/Collapse"]');
    expect(container.querySelectorAll('.LoadTestCard.expanded').length).toBe(0);
    fireEvent.click(expanderButton);  // expand
    expect(container.querySelectorAll('.LoadTestCard.expanded').length).toBe(1);
    fireEvent.click(expanderButton);  // collapse
    expect(container.querySelectorAll('.LoadTestCard.expanded').length).toBe(0);
  });


  it('assert summary counters are populated in the detail section of the card', () => {
    const { container } = render(wrapper);
    expect(container.querySelectorAll('.detailsTable').length).toBe(1);
    const detailsTable = container.querySelector('.detailsTable');
    const cells = detailsTable.querySelectorAll('tr:last-child>td');
    expect(cells[0].innerHTML).toBe("6 ");
    expect(cells[1].innerHTML).toBe("2.28 ");
    expect(cells[2].innerHTML).toBe("3.0 ");
  });

  
  it('assert load test description gets rendered', () => {
    const { container } = render(wrapper);
    expect(container.querySelectorAll('.testDescription').length).toBe(1);
    const description = container.querySelector('.testDescription');
    expect(description.childNodes[0].textContent).toBe('A string of plain text');
  });


  it('assert delete load-test trash-can icon displays a confirmation dialog box ', () => {
    const { container } = render(wrapper);
    const toolbar = container.querySelector('.toolbar');
    expect(toolbar.querySelectorAll('svg[aria-label="Delete load test"]').length).toBe(1);
    const deleteButton = toolbar.querySelector('svg[aria-label="Delete load test"]');
    expect(container.querySelectorAll('.ModalDeleteTests').length).toBe(0);
    fireEvent.click(deleteButton);  
    expect(container.querySelectorAll('.ModalDeleteTests').length).toBe(1);
    // close dialog box via the X icon in the top right corner
    const modal = container.querySelector('.ModalDeleteTests');
    const modalButton = modal.querySelector('button.bx--modal-close');
    fireEvent.click(modalButton); 
    expect(container.querySelectorAll('.ModalDeleteTests').length).toBe(0);
  });


  it('assert a delete operation can be cancelled', () => {
    const { container } = render(wrapper);
    const toolbar = container.querySelector('.toolbar');
    const deleteButton = toolbar.querySelector('svg[aria-label="Delete load test"]');
    fireEvent.click(deleteButton);  
    expect(container.querySelectorAll('.ModalDeleteTests').length).toBe(1);
    const modal = container.querySelector('.ModalDeleteTests');
    const modalButton = modal.querySelector('button.bx--modal-close');
    fireEvent.click(modalButton); 
    expect(container.querySelectorAll('.ModalDeleteTests').length).toBe(0);
  });
});
