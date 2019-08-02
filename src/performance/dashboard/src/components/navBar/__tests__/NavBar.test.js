import React from 'react';
import { createStore } from 'redux';
import { Provider } from 'react-redux';
import { render, cleanup } from '@testing-library/react';
import  NavBar from '../NavBar';
import reducers from '../../../store/reducers/index';
import * as DataProjectInfo from '../../../tests/data/ProjectInfo';

// initialise component props
const componentProps = {
    projectID:  DataProjectInfo.projectInfo.projectID
}

// Initialise redux stores
const store = createStore(reducers, {
    projectInfoReducer: { config: DataProjectInfo.projectInfo, receivedAt: Date.now(), fetched: true }
});

// component to render
const wrapper = (
    <Provider store={store}>
        <NavBar {...componentProps} /> 
    </Provider>
)

// dont leak state
afterEach(cleanup);

// run test
describe('<NavBar />', () => {
    
    test('has the correct branding title',() => {
        render( wrapper )
        expect(document.querySelector('.appTitle_1').innerHTML).toBe('code');
        expect(document.querySelector('.appTitle_2').innerHTML).toBe('wind');
    });

    test('displays the correct project name',() => {
        render( wrapper )
        expect(document.querySelector('.projectName').innerHTML).toBe('SampleProjectName');
    });

});


