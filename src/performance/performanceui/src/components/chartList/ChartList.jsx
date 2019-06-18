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
import PropTypes from 'prop-types';
import Chart from '../chart/Chart';
import { CHART_TYPE_HTTP } from '../../AppConstants';

export default class ChartList extends React.Component {
  render() {
    return (
      <div className="ChartList">
        {
          this.props.chartModels.map(model => {
            return model.chartType === CHART_TYPE_HTTP ?
              <Fragment key={model.title}>
                <Chart chartModel={model} />
              </Fragment>
              :
              <Chart key={model.title} chartModel={model} />
          })
        }
      </div>
    )
  }
}

ChartList.propTypes = {
  chartModels: PropTypes.arrayOf(
    PropTypes.shape({
      chartType: PropTypes.string.isRequired,
      data: PropTypes.object.isRequired,
      title: PropTypes.string.isRequired,
      colLimit: PropTypes.number // max number of columns (lines on a chart)
    })).isRequired,
};

