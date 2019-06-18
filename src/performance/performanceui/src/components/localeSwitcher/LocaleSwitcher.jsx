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

import React, { Component } from 'react'
import { Dropdown } from 'carbon-components-react';
import { connect } from 'react-redux';
import { setLocale } from '../../store/actions/localeActions';
import * as AppConstants from '../../AppConstants';

import './LocaleSwitcher.scss';

class LocaleSwitcher extends Component {

  constructor() {
    super();
    this.setLang = this.setLang.bind(this);
  }

  setLang(e) {
    this.props.dispatch(setLocale(e.selectedItem.id));
  }

  // eslint-disable-next-line class-methods-use-this
  getLangName() {
    let selectedLang = AppConstants.localeList.find(entry => {
      return entry.id === localStorage.lang
    });
    return selectedLang.label;
  }

  render() {
    return (
      <div className="LocaleSwitcher">
        <Dropdown
          id="localeDropdown"
          type="inline"
          label={this.getLangName()}
          ariaLabel="Locale"
          light
          invalid={false}
          invalidText=""
          items={AppConstants.localeList}
          itemToString={item => (item ? item.label : '')}
          onChange={e => this.setLang(e)}
        />
      </div>
    )
  }
}

const mapStateToProps = stores => {
  return {
    lang: stores.localeReducer.lang,
  };
};

export default connect(mapStateToProps)(LocaleSwitcher);