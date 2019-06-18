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

import React, { Fragment } from 'react';
import PropTypes from 'prop-types';
import { connect } from 'react-redux';
import LoadTestCard from '../loadTestCard/LoadTestCard';
import MetricsUtils from '../../modules/MetricsUtils';
import svg_IBMBee from '../../theme/IBM-Bee.svg';
import { TranslatedText } from '../../translations';

import "./LoadTestList.scss"

class LoadTestList extends React.Component {

    render() {

        const urlFilter = MetricsUtils.getEndpoint(this.props.loadRunnerConfig.config.path);
        let listModel = [];
        // As soon as we have updated results from the metrics API,  build a UI custom fit data model for display
        if (this.props.projectMetrics.fetched && this.props.projectMetrics.metrics.length > 1) {
            listModel = MetricsUtils.sortMetrics(this.props.projectMetrics.metrics, urlFilter);
        }

        return (
            <div className='LoadTestList'>
                {listModel.map(timedTest => {
                    return <LoadTestCard urlFilter={urlFilter} key={timedTest.time} snapshot={timedTest} plotpoint={timedTest.plotNumber} />
                })}

                {
                    listModel.length === 0 ?
                        <div className="noData">
                            <div>
                                {TranslatedText(this.props.lang, "page.tests.nodata", 'No test data to display - run a test now')}
                            </div>
                            <img alt="bee" src={svg_IBMBee} />
                        </div>
                        : <Fragment />
                }
            </div>
        )
    }
}


LoadTestList.propTypes = {
    chartModels: PropTypes.arrayOf(
        PropTypes.shape({
            chartType: PropTypes.string.isRequired,
            data: PropTypes.object.isRequired,
            title: PropTypes.string.isRequired,
            colLimit: PropTypes.number // max number of columns (lines on a chart)
        })).isRequired,
};

// Mapped Redux Stores
const mapStateToProps = stores => {
    return {
        projectMetricTypes: stores.projectMetricTypesReducer,
        projectMetrics: stores.projectMetricsReducer,
        lang: stores.localeReducer.lang,
        loadRunnerConfig: stores.loadRunnerConfigReducer
    };
};

export default connect(mapStateToProps)(LoadTestList);