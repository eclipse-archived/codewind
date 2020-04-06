/*******************************************************************************
* Copyright (c) 2019 IBM Corporation and others.
* All rights reserved. This program and the accompanying materials
* are made available under the terms of the Eclipse Public License v2.0
* which accompanies this distribution, and is available at
* http://www.eclipse.org/legal/epl-v20.html
*
* Contributors:
*     IBM Corporation - initial API and implementation
******************************************************************************/

import React, { Fragment } from 'react'
import PropTypes from 'prop-types'
import { connect } from 'react-redux';

import { fetchProjectMetricTypes } from '../store/actions/projectMetricTypesActions';
import { fetchProjectMetrics, reloadMetricsData } from '../store/actions/projectMetricsActions';
import { fetchProjectLoadConfig } from '../store/actions/loadRunnerConfigActions';
import { fetchProjectConfig } from '../store/actions/projectInfoActions';
import { SocketEvents } from '../utils/sockets/SocketEvents';
import { CHART_TYPE_CPU, CHART_TYPE_MEMORY } from '../AppConstants';
import ActionRunLoad from '../components/actions/ActionRunLoad';
import ActionModifyLoadTests from '../components/actions/ActionModifyLoadTests';
import Chart from '../components/chart/Chart';
import ChartCounterSelector from '../components/chartCounterSelector/ChartCounterSelector';
import ErrorBoundary from '../components/utils/ErrorBoundary';
import ResultsCard from '../components/resultsCard/ResultsCard';
import ResultsCard_Blank from '../components/resultsCard/ResultsCard_Blank';
import RunTestHistory from '../components/runTestHistory/RunTestHistory';
import SocketContext from '../utils/sockets/SocketContext';
import StatusPanel from '../components/status/StatusPanel';
import * as MetricsUtils from '../modules/MetricsUtils';

import './PagePerformance.scss';

class PagePerformance extends React.Component {

    constructor() {
        super();
        this.state = {
            projectMetricsLastUpdated: 0,
            chartData: {
                CPU: {},
                MEMORY: {},
                HTTP: {},
                HTTPHits: {}
            }
        }
        this.reloadMetrics = this.reloadMetrics.bind(this);
    }

    bindSocketHandlers() {
        const uiSocket = this.props.socket;
        let thisComponent = this;
        uiSocket.on(SocketEvents.RUNLOAD_STATUS_CHANGED, data => {
            if (data.status === 'idle' && data.projectID === this.props.projectID) {
                thisComponent.reloadMetrics(this.props.projectID);
            }
        });
    }

    async componentDidMount() {
        // Check if page was called with a projectID.  If note, the render() will display further instructions.
        if (!this.props.projectID) { return; }
        this.bindSocketHandlers();

        // read the project configuration
        await this.props.dispatch(fetchProjectConfig(this.props.projectID));

        // read the load runner configuration
        await this.props.dispatch(fetchProjectLoadConfig(this.props.projectID));

        // Determine which metrics are available for this project
        await this.props.dispatch(fetchProjectMetricTypes(this.props.projectMetricTypes, this.props.projectID));

        const projectMetricTypes = this.props.projectMetricTypes;
        if (projectMetricTypes && projectMetricTypes.error) {
            alert(projectMetricTypes.error.message + ' reason: ' + projectMetricTypes.error.err);
            return;
        }

        // Get the metrics for the project
        await this.props.dispatch(fetchProjectMetrics(this.props.projectMetrics, this.props.projectID, projectMetricTypes.types));
        const projectMetrics = this.props.projectMetrics;

        if (projectMetrics && projectMetrics.error) {
            alert(projectMetrics.error.message + ' reason: ' + projectMetrics.error.err);
        }

    }

    componentWillReceiveProps(nextProps) {
        if (this.state.projectMetricsLastUpdated !== nextProps.projectMetrics.receivedAt) {
            const projectMetrics = nextProps.projectMetrics;

            // show only this URL path on charts (per the project load-test/config.json)
            const absolutePath = MetricsUtils.getEndpoint(nextProps.loadRunnerConfig.config.path);

            // As soon as we have updated results from the metrics API,  build a UI custom fit data model for display
            let listModel = [];
            if (projectMetrics.fetched && projectMetrics.metrics.length > 1) {
                listModel = MetricsUtils.sortMetrics(projectMetrics.metrics, absolutePath);
            }

            const snapshot_1 = listModel[listModel.length - 1];
            const snapshot_2 = listModel[listModel.length - 2];
            const snapshot_3 = listModel[listModel.length - 3];

            // parse the memory metrics for the chart API
            let memoryData = MetricsUtils.buildChartData(projectMetrics, listModel, CHART_TYPE_MEMORY, (1 / 1024 / 1024));

            // parse the cpu metrics for the chart API
            let cpuData = MetricsUtils.buildChartData(projectMetrics, listModel, CHART_TYPE_CPU, 100);

            // parse the http metrics (ResponseTime) for the chart API
            let params = {
                projectMetrics: projectMetrics,
                filteredData: listModel,
                scaleFactor: 1,
                decimals: 2,
                urlFilter: absolutePath
            }

            params.counterName = "averageResponseTime";
            let httpResponseData = MetricsUtils.buildChartDataHTTP(params);

            params.counterName = "hits";
            params.decimals = 0;
            let httpHitsData = MetricsUtils.buildChartDataHTTP(params);

            // Update State
            this.setState({
                snapshot_1: snapshot_1,
                snapshot_2: snapshot_2,
                snapshot_3: snapshot_3,
                projectMetricsLastUpdated: nextProps.projectMetrics.receivedAt,
                chartData: {
                    CPU: cpuData,
                    MEMORY: memoryData,
                    HTTP: httpResponseData,
                    HTTPHits: httpHitsData
                }
            });
        }
    }

    reloadMetrics(projectID) {
        this.props.dispatch(reloadMetricsData(projectID, this.props.projectMetricTypes.types));
    }

    render() {
        const { snapshot_1, snapshot_2, snapshot_3 } = this.state;
        const absolutePath = MetricsUtils.getEndpoint(this.props.loadRunnerConfig.config.path) ? MetricsUtils.getEndpoint(this.props.loadRunnerConfig.config.path) : '';
        const httpMethod = this.props.loadRunnerConfig.config.method;
        const projectLanguage = (this.props.projectInfo.config.language) ? this.props.projectInfo.config.language : '';
        const showTip = !(this.state.chartData && this.state.chartData.CPU && this.state.chartData.CPU.columns && this.state.chartData.CPU.columns.length > 0);
        return (
            <Fragment>
                <div className='pageTitle' role="main" aria-label='main page'>
                    <div className='pageTitle-content'>
                        <div className='main-title'>
                            <div className='main-text' title='main page'>Performance</div>
                            <div className='actions-main'>
                                <ActionRunLoad small={true} kind="ghost" projectID={this.props.projectID} />
                            </div>
                            <div className='actions-utils'>
                                <ActionModifyLoadTests projectID={this.props.projectID} />
                            </div>
                        </div>
                    </div>
                </div>
                <StatusPanel projectID={this.props.projectID} />
                <div className='results-row' role="complementary" aria-label="Result Summaries">
                    <div className='results-cards'>
                        <div className='results-card_1'>
                            <ErrorBoundary>
                                {
                                    snapshot_2 ?
                                        <ResultsCard title='Previous test' snapshot={snapshot_2} snapshotPrevious={snapshot_3} projectID={this.props.projectID} absolutePath={absolutePath} projectLanguage={projectLanguage} />
                                        :
                                        <ResultsCard_Blank title='Previous test' />
                                }
                            </ErrorBoundary>
                        </div>
                        <div className='results-card_2'>
                            <ErrorBoundary>
                                {
                                    snapshot_1 ?
                                        <ResultsCard title='Latest test' snapshot={snapshot_1} snapshotPrevious={snapshot_2} projectID={this.props.projectID} absolutePath={absolutePath} projectLanguage={projectLanguage} />
                                        :
                                        <ResultsCard_Blank title='Latest test' />
                                }
                            </ErrorBoundary>
                        </div>
                    </div>
                </div>
                <div className="chart-container" role="complementary" aria-label="Chart">
                    <div className="chart-row">
                        <div className="chart-component">
                            <ErrorBoundary>
                                {projectLanguage && absolutePath ?
                                    <Chart chartData={this.state.chartData} httpMethod={httpMethod} projectLanguage={projectLanguage} absolutePath={absolutePath} />
                                    :
                                    <Fragment />
                                }
                            </ErrorBoundary>
                        </div>
                        <div className="chart-selection">
                            <ErrorBoundary>
                                <ChartCounterSelector chartData={this.state.chartData} testPath={absolutePath} showTip={showTip} />
                            </ErrorBoundary>
                        </div>
                    </div>
                </div>
                <div className="testhistory-container" role="complementary" aria-label="Chart History">
                    <div className="testhistory-row">
                        <div className="testhistory-component">
                            <ErrorBoundary>
                                <RunTestHistory projectID={this.props.projectID} absolutePath={absolutePath} projectLanguage={projectLanguage} handleRunLoadTest={this.handleRunLoadTest} />
                            </ErrorBoundary>
                        </div>
                    </div>
                    <div className="footer-container"></div>
                </div>
        </Fragment>
        )
    }
}

// Add UI SocketContext via props
const PagePerformanceWithSocket = props => (
    <SocketContext.Consumer>
        {socket => <PagePerformance {...props} socket={socket} />}
    </SocketContext.Consumer>
)

// Mapped Redux Stores
const mapStateToProps = stores => {
    return {
        projectInfo: stores.projectInfoReducer,
        projectMetricTypes: stores.projectMetricTypesReducer,
        projectMetrics: stores.projectMetricsReducer,
        lang: stores.localeReducer.lang,
        loadRunnerConfig: stores.loadRunnerConfigReducer
    }
};

PagePerformance.propTypes = {
    projectID: PropTypes.string.isRequired
}

export default connect(mapStateToProps)(PagePerformanceWithSocket);
