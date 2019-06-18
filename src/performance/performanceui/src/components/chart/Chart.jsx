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

import React, { } from 'react'
import PropTypes from 'prop-types'
import { connect } from 'react-redux';
import C3Chart from 'react-c3js';
import ErrorBoundary from '../ErrorBoundary';
import { TranslatedText } from '../../translations';

import 'c3/c3.css';
import './Chart.css'

class Chart extends React.Component {

  constructor(props) {
    super(props)
    this.state = {
      colorPattern: { pattern: ['#5490f6', '#3cb3ad', '#851d85', '#f87ba7', '#a916ce', '#fcc120', '#20fc7f', '#20ccfc'] },
      chartName:'',
      chartKey: 1, //can be incremented to force a full refresh
      chartData: {
        columns: [],
        selection: {
          enabled: true,
          grouped: true,
          multiple: true,
          draggable: false
        },
        onclick: this.handleChartPointClick,
        types: {}
      }
    }
    this.handleChartPointClick = this.handleChartPointClick.bind(this);
    this.compileGridlines = this.compileGridlines.bind(this);
  }

  /*
  * component received new props,  update this components state appropriately 
  */
  componentWillReceiveProps(nextProps) {
    let newChartName = '';
    try {newChartName = nextProps.chartModel.data.columns[0][0]; } catch (err) {} // chart data might be empty
    if (nextProps.chartModel.data !== this.state.chartData) {
      let chartData = this.state.chartData;
      chartData.columns = nextProps.chartModel.data.columns;
      chartData.types = nextProps.chartModel.data.types;

      // redraw the entire chart if the chartname has changed (eg: changing path endpoint via the ModalModifyLoadTest)
      if (this.state.chartName !== newChartName) {
        this.setState({chartData: chartData, chartKey: (this.state.chartKey+1), chartName: newChartName })
      } else {
        this.setState({ chartData: chartData });
      }
    }
  }

  /**
   * handleChartPointClick
   * Process the mouse click when a chart node is selected
   * @param {*} d an object representing the point on the chart
   * @param {*} element the HTML node of the element
   */
  // eslint-disable-next-line class-methods-use-this
handleChartPointClick(d, element) { /* console.log('chartPointClicked', d, element); */ }

  compileGridlines() {
    return {
      x: {
        show: true
      },
      y: {
        show: true,
      }
    };
  }

  render() {
    const { colorPattern, chartKey, chartData } = this.state;
    const { chartModel } = this.props;
    const grid = this.compileGridlines();
    const tooManyColumns = (chartModel.colLimit && (chartData.columns.length > chartModel.colLimit));

    return (
      <div className='Chart'>
        <div className='chartTitle'>{chartModel.title}</div>
        <div className='chartToolbar'>
          {this.props.children}
        </div>
        <div className='chartCanvas'>
          {
            (tooManyColumns) ? <div className='chartFull'>
              <p>{TranslatedText(this.props.lang, 'page.tests.tooMany1', 'Too many entries')}</p>
              <p>{TranslatedText(this.props.lang, 'page.tests.tooMany2', 'Use the filter options')}</p>
            </div> :
            <ErrorBoundary errMessage='Unable to render this component'>
              <C3Chart key={`chart_${chartKey}`}
                subchart={{ show: true }}
                size={{ height: 400 }}
                data={chartData}
                grid={grid}
                color={colorPattern} />
            </ErrorBoundary>
          }
        </div>
      </div>
    )
  }
}

const mapStateToProps = stores => {
  return {
    lang: stores.localeReducer.lang
  }
}

Chart.propTypes = {
  chartModel: PropTypes.shape({
    chartType: PropTypes.string.isRequired,
    data: PropTypes.object.isRequired,
    title: PropTypes.string.isRequired,
    colLimit: PropTypes.number // max number of columns (lines on a chart)
  }).isRequired,
};

export default connect(mapStateToProps)(Chart)
