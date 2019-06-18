/*******************************************************************************
Licensed Materials - Property of IBM
"Restricted Materials of IBM"
Copyright IBM Corp. 2019 All Rights Reserved
US Government Users Restricted Rights - Use, duplication or disclosure
restricted by GSA ADP Schedule Contract with IBM Corp.
*******************************************************************************/

import { configure } from 'enzyme';
import Adapter from 'enzyme-adapter-react-16';

configure({ adapter: new Adapter() }); 

global.SVGPathElement = function () { }  // c3Charts svg missing
