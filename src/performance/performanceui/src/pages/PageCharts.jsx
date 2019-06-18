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
import ChartsPageActionBar from '../components/actionBars/ChartsPageActionBar';
import RunTestNotificationOK from '../components/notifications//RunTestNotificationOK';
import RunTestNotificationFail from '../components/notifications/RunTestNotificationFail';
import LoadTestList from '../components/loadTestList/LoadTestList';
import ChartList from '../components/chartList/ChartList';
import { connect } from 'react-redux';
import { SocketEvents } from '../utils/sockets/SocketEvents';
import SocketContext from '../utils/sockets/SocketContext';
import ProjectIDChecker from '../utils/projectUtils';
import { TranslatedText } from '../translations';
import { fetchProjectMetricTypes } from '../store/actions/projectMetricTypesActions';
import { fetchProjectMetrics, reloadMetricsData } from '../store/actions/projectMetricsActions';
import { fetchProjectLoadConfig } from '../store/actions/loadRunnerConfigActions';
import * as AppConstants from '../AppConstants';
import * as MetricsParsers from '../modules/MetricsUtils';
import { CHART_TYPE_CPU, CHART_TYPE_MEMORY, CHART_TYPE_HTTP, CHART_TYPE_HITS } from '../AppConstants'

import ModalRunTest from '../components/modalDlgs/ModalRunTest';

import './PageCharts.scss';

class PageCharts extends React.Component {

    constructor(props) {
        super(props);
        this.state = {
            showNotificationRunTestOK: false,
            showNotificationRunTestFail: false,
            projectMetricsLastUpdated: 0,
            showModalRunTest: false,
            chartDataHTTPHits: {
                columns: []
            },

            chartDataHTTP: {
                columns: []
            },
            chartDataCPU: {
                columns: []
            },
            chartDataMemory: {
                columns: []
            },
        }

        this.handleRunTestDlgStart = this.handleRunTestDlgStart.bind(this);
        this.handleRunTestDlgClose = this.handleRunTestDlgClose.bind(this);
        this.reloadMetrics = this.reloadMetrics.bind(this);
    }

    bindSocketHandlers() {
        const uiSocket = this.props.socket;
        const projectID = ProjectIDChecker.projectID();
        let thisComponent = this;
        uiSocket.on(SocketEvents.RUNLOAD_STATUS_CHANGED, data =>  { 
           if (data.status === 'idle' && data.projectID === projectID) {
                thisComponent.reloadMetrics(projectID);
            }
        });
    }

    reloadMetrics(projectID) { 
        this.props.dispatch(reloadMetricsData(projectID, this.props.projectMetricTypes.types));
    }

    async componentWillMount() {
        await this.props.dispatch(fetchProjectLoadConfig(ProjectIDChecker.projectID()));
    }

    /**
    * Ask API to start a new test
    */
    handleRunTestDlgStart(descriptionText) {
        let t = this;
        this.requestRunLoad(descriptionText).then(function (result) {
            t.setState({ showModalRunTest: false });
            if (result.status === 202) {
                t.showStartTestNotificationOK();
            } else {
                t.showStartTestNotificationFail();
            }
        }).catch(function (err) {
            alert(err);
        });
    }

    /**
     * Close the RunTest dialog box
     */
    handleRunTestDlgClose() {
        this.setState({ showModalRunTest: false });
    }


    showStartTestNotificationOK() {
        this.setState(
            { showNotificationRunTestOK: true },
            () => setTimeout(() => this.setState({ showNotificationRunTestOK: false }), 5000)
        );
    }

    showStartTestNotificationFail() {
        this.setState(
            { showNotificationRunTestFail: true },
            () => setTimeout(() => this.setState({ showNotificationRunTestFail: false }), 5000)
        );
    }

    /**
     * Send a post to the metric/runload api to start a new load test. 
     * An optional description parameter can be provided.
     * @param {string} desc 
     */
    // eslint-disable-next-line class-methods-use-this
    async requestRunLoad(desc) {
        let descriptionPayload = JSON.stringify({ description: desc });
        const response = await fetch(`$${AppConstants.MICROCLIMATE_SERVER_API}/api/v1/projects/${ProjectIDChecker.projectID()}/runload`,
            {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: descriptionPayload
            });
        const reply = await response;
        return reply;
    }


    async componentDidMount() {
        // Check if page was called with a projectID.  If note, the render() will display further instructions.
        const projectID = ProjectIDChecker.projectID();
        if (!projectID) { return; }

       this.bindSocketHandlers();

        // Determine which metrics are available for the project
        await this.props.dispatch(fetchProjectMetricTypes(this.props.projectMetricTypes, projectID));

        const projectMetricTypes = this.props.projectMetricTypes;
        if (projectMetricTypes && projectMetricTypes.error) {
            alert(projectMetricTypes.error.message + ' reason: ' + projectMetricTypes.error.err);
            return;
        }

        // Get the metrics for the project
        await this.props.dispatch(fetchProjectMetrics(this.props.projectMetrics, projectID, projectMetricTypes.types));
        const projectMetrics = this.props.projectMetrics;

        if (projectMetrics && projectMetrics.error) {
            alert(projectMetrics.error.message + ' reason: ' + projectMetrics.error.err);
        }
    }


    componentWillReceiveProps(nextProps) {
        
        if (this.state.projectMetricsLastUpdated !== nextProps.projectMetrics.receivedAt) {

            const projectMetrics = nextProps.projectMetrics;

            // parse the memory metrics for the chart API
            let memoryData = MetricsParsers.buildChartData(projectMetrics, CHART_TYPE_MEMORY, (1 / 1024 / 1024), 'area-spline');

            // parse the cpu metrics for the chart API
            let cpuData = MetricsParsers.buildChartData(projectMetrics, CHART_TYPE_CPU, 100, 'area-spline');

             // show only this URL path on charts (per the project load-test/config.json)
            const urlFilter =  MetricsParsers.getEndpoint(nextProps.loadRunnerConfig.config.path);

            // parse the http metrics (ResponseTime) for the chart API
            let params = {
                projectMetrics: projectMetrics,
                scaleFactor: 1, 
                counterName: 'averageResponseTime',
                chartType: 'bar',
                urlFilter: urlFilter
            }

            let httpResponseTimes = MetricsParsers.buildChartDataHTTP(params);

            // parse the http metrics (Hits) for the chart API
            params.chartName = CHART_TYPE_HITS;
            params.chartType = 'line';
            params.counterName = "hits";
            let httpHits = MetricsParsers.buildChartDataHTTP(params);

            this.setState({
                projectMetricsLastUpdated: nextProps.projectMetrics.receivedAt,
                chartDataCPU: cpuData,
                chartDataMemory: memoryData,
                chartDataHTTP: httpResponseTimes,
                chartDataHTTPHits: httpHits
            })
        }
    }

    render() {
        const { chartDataCPU, chartDataMemory, chartDataHTTP, chartDataHTTPHits } = this.state;
        const { showNotificationRunTestOK, showNotificationRunTestFail } = this.state;
        const projectID = ProjectIDChecker.projectID();
       
        const chartModels = [
            { chartType: CHART_TYPE_HTTP, data: chartDataHTTP, title: "Response time (ms)", colLimit: 5 },
            { chartType: CHART_TYPE_HITS, data: chartDataHTTPHits, title: "Hits", colLimit: 5 },
            { chartType: CHART_TYPE_CPU, data: chartDataCPU, title: "CPU %" },
            { chartType: CHART_TYPE_MEMORY, data: chartDataMemory, title: "Memory (MB)" }];

        return (
            <div className="PageCharts">
                <RunTestNotificationFail notification={showNotificationRunTestFail} />
                <RunTestNotificationOK notification={showNotificationRunTestOK} />
                {
                    this.state.showModalRunTest ?
                        <ModalRunTest
                            handleRunTestDlgClose={this.handleRunTestDlgClose}
                            handleRunTestDlgStart={this.handleRunTestDlgStart}
                        /> : <Fragment />
                }


                <div className="titleRow">
                    <div className="pageTitle">
                        {TranslatedText(this.props.lang, "page.tests.title", 'Regression Testing')}
                    </div>
                    <div className="actionBar">
                        <ChartsPageActionBar projectID={projectID} />
                    </div>
                </div>

                <div className="layoutTable">
                    <div className="layoutTableBody">
                        <div className="layoutTableRowSection">
                            <div className="layoutTableCell_L">
                                <div className="sectionTitle">{TranslatedText(this.props.lang, "page.tests.charttitle", 'Charts')}</div>
                            </div>
                            <div className="layoutTableCell_R">
                                <div className="sectionTitle">{TranslatedText(this.props.lang, "page.tests.detailtitle", 'Details')}</div>
                            </div>
                        </div>
                        <div className="layoutTableRow">
                            <div className="layoutTableCell_L">
                                <div className="scrollable">
                                    <ChartList chartModels={chartModels} />
                                </div>
                            </div>
                            <div className="layoutTableCell_R">
                                <div className="scrollable">
                                    <LoadTestList chartModels={chartModels} />
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        )
    }
}

// Add UI SocketContext via props
const PageChartsWithSocket = props => (
    <SocketContext.Consumer>
      {socket => <PageCharts {...props} socket={socket} />}
    </SocketContext.Consumer>
  )
  
// Mapped Redux Stores
const mapStateToProps = stores => {
    return {
        projectMetricTypes: stores.projectMetricTypesReducer,
        projectMetrics: stores.projectMetricsReducer,
        lang: stores.localeReducer.lang,
        loadRunnerConfig: stores.loadRunnerConfigReducer
    };
};


export default connect(mapStateToProps)(PageChartsWithSocket);
