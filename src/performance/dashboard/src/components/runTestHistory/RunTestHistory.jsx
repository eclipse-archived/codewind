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

import React, { Component, Fragment } from 'react'
import PropTypes from 'prop-types';
import { DataTable, OverflowMenu, OverflowMenuItem } from 'carbon-components-react';
import { connect } from 'react-redux';
import IconDelete from '@carbon/icons-react/es/delete/16';
import { formatDateToString } from '../../utils/dateTime';

import { postDeleteTests, reloadMetricsData } from '../../store/actions/projectMetricsActions';
import DescriptionEditor from '../resultsCard/DescriptionEditor';
import MetricsUtils from '../../modules/MetricsUtils';
import './RunTestHistory.scss';

const {
    TableContainer,
    Table,
    TableHead,
    TableRow,
    TableBody,
    TableCell,
    TableHeader,
    TableSelectAll,
    TableSelectRow,
    TableToolbar,
    TableToolbarContent,
    TableToolbarSearch,
    TableBatchActions,
    TableBatchAction
} = DataTable;

// We would have a headers array like the following
const tableHeaders = [
    { key: 'time', header: 'Timestamp' },
    { key: 'desc', header: 'Description' },
    { key: 'stat_cpu', header: 'CPU' },
    { key: 'stat_memory', header: 'Memory' },
    { key: 'stat_response', header: 'Response' },
    { key: 'stat_hits', header: 'Hits' }
];

class RunTestHistory extends Component {

    constructor() {
        super();
        this.state = {
            testHistory: [],  // full collection of tests
            selectedRows: [], // selected table rows
            filteredRows: []  // search results for display in the table 
        }
        this.filterRows = this.filterRows.bind(this);
        this.handleDeleteRow = this.handleDeleteRow.bind(this);
        this.handleOverflowKeyDown = this.handleOverflowKeyDown.bind(this);
        this.handleBatchDeleteBtn = this.handleBatchDeleteBtn.bind(this);
    }
    // Build overflow menu
    getOverflowMenu(rowId) {
        return (
            <OverflowMenu floatingMenu flipped>
                <OverflowMenuItem primaryFocus onKeyDown={ () => this.handleOverflowKeyDown(key, rowId) } onClick={() => this.handleDeleteRow(rowId)} itemText='Delete' />
            </OverflowMenu>
        );
    }

    handleOverflowKeyDown(key, row) {
        if (key.keycode === 13) {
            this.handleDeleteRow(row) 
        }
    }

    /**
     * Request row deletion
     */
    async handleDeleteRow(rowID) {
        this.setState({ deleteInProgress: true });
        const result = await postDeleteTests(this.props.projectID, rowID);
        if (result.status && result.status === 200) {
            await this.props.dispatch(reloadMetricsData(this.props.projectID, this.props.projectMetricTypes.types));
        } else {
            alert(`Unable to delete test: ${result.message}`);
        }
        await this.setState({ deleteInProgress: false });
    }

    /* Deletes each test in turn, then reloads the table data */
    async handleBatchDeleteBtn(selectedRows) {

        this.setState({ deleteInProgress: true });
        try {
            let deleteCandidates = selectedRows.map(testEntry => {
                return testEntry.id;
            });
            for (let i = 0; i < deleteCandidates.length; i++) {
                await this.handleDeleteRow(deleteCandidates[i]);
            }
        } catch (err) {
            alert("Delete failed:  " + err);
        }

        await this.setState({ deleteInProgress: false });
        this.refs.tableTestHistory.handleOnCancel(); // deselect all rows & hide batch action bar
        this.props.dispatch(reloadMetricsData(this.props.projectID, this.props.projectMetricTypes.types));
    }

    componentWillReceiveProps(nextprops) {
        let listModel = [];
        if (nextprops.projectMetrics && nextprops.projectMetrics.fetched) {
            listModel = MetricsUtils.sortMetrics(nextprops.projectMetrics.metrics, this.props.absolutePath);
            this.setState({ testHistory: listModel, filteredRows: listModel })
        }
    }

    getCellValue(row, cell) {
        const searchURL = this.props.absolutePath;
        const appCounterNames = MetricsUtils.getLanguageCounters(this.props.projectLanguage);

        const dataRows = this.state.testHistory;
        const id = row.id;
        const snapshot = dataRows.find(element => {
            return element.id === id;
        })
        const http = snapshot.http.value.value.data;
        const urlMetrics = http.find(list => {
            let uri = MetricsUtils.getPathFromURL(list.url);
            return MetricsUtils.getEndpoint(uri) === searchURL;
        })

        switch (cell.info.header) {
            case 'time':
                const dt = new Date(cell.value);
                return (dt).toLocaleString();
            case 'desc':
                return cell.value;
            case 'stat_cpu': {
                const cpu = snapshot.cpu;
                return `${parseFloat(cpu.value.value.data[appCounterNames.CPU_PROCESS_MEAN] * 100).toFixed(1)} %`;
            }
            case 'stat_memory':
                const memory = snapshot.memory;
                return `${parseFloat(memory.value.value.data[appCounterNames.MEM_PROCESS_PEAK] / 1024 / 1024).toFixed(1)} MB`;
            case 'stat_response':
                return (urlMetrics && urlMetrics[appCounterNames.HTTP_AVERAGE_RESPONSE]) ? `${urlMetrics[appCounterNames.HTTP_AVERAGE_RESPONSE].toFixed(1).toLocaleString()} ms` : '';
            case 'stat_hits':
                return (urlMetrics && urlMetrics[appCounterNames.HTTP_HITS]) ? `${urlMetrics[appCounterNames.HTTP_HITS].toLocaleString()}` : '';
            default:
                return '';
        }
    }

    /**
    * search All rows in the dataset and populate the paginatedRows list with hits
    */
    filterRows(e) {

        let filteredRows = [];
        let searchString = e.target.value;

        // No search required - reset the table
        if (!searchString) {
            this.setState({ filteredRows: this.state.testHistory });
            return;
        }

        searchString = searchString.toLowerCase();
        filteredRows = this.state.testHistory.filter(entry => {
            const dt = new Date(entry.time);
            let t = (dt).toLocaleString();
            if (entry.desc) {
                return (entry.desc.toLowerCase()).includes(searchString) || t.includes(searchString);
            }
            return t.includes(searchString);
        });

        this.setState({ filteredRows: filteredRows });
    }

    render() {
        const filteredRows = this.state.filteredRows;

        return (
            <div className='RunTestHistory'>

                <DataTable
                    ref="tableTestHistory"
                    isSortable={true}
                    rows={filteredRows}
                    headers={tableHeaders}
                    render={({ rows, headers, getHeaderProps, getBatchActionProps, getSelectionProps, selectedRows }) => (
                        <TableContainer title='Test history'>
                            <TableToolbar>
                                <TableBatchActions {...getBatchActionProps()}>
                                    <TableBatchAction renderIcon={IconDelete} aria-label='Delete' iconDescription='Delete' onClick={() => this.handleBatchDeleteBtn(selectedRows)}>
                                        Delete
                                    </TableBatchAction>
                                </TableBatchActions>
                                <TableToolbarContent>
                                    <TableToolbarSearch small={true} kind='' aria-label='Search and filter' onChange={this.filterRows} />
                                </TableToolbarContent>
                            </TableToolbar>
                            <Table>
                                <TableHead>
                                    <TableRow>
                                        <TableSelectAll {...getSelectionProps()} />
                                        {headers.map(header => (
                                            <TableHeader {...getHeaderProps({ header })}>
                                                {header.header}
                                            </TableHeader>
                                        ))}
                                        <TableHeader />
                                    </TableRow>
                                </TableHead>
                                <TableBody>
                                    {rows.map(row => (
                                        <TableRow key={row.id}>
                                            <TableSelectRow {...getSelectionProps({ row })} />
                                            {row.cells.map(cell => (
                                                <TableCell key={cell.id}>
                                                    {
                                                        cell.info.header === 'desc' ?
                                                            <DescriptionEditor projectID={this.props.projectID} text={cell.value} snapshotTime={parseInt(row.id)} alwaysShowEditIcon={false} />
                                                            :
                                                            <Fragment>{this.getCellValue(row, cell)}</Fragment>
                                                    }
                                                </TableCell>
                                            ))}
                                            <TableCell>{this.getOverflowMenu(row.id)}</TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </TableContainer>
                    )}
                />
            </div>
        )
    }
}

// Mapped Redux Stores
const mapStateToProps = stores => {
    return {
        projectMetricTypes: stores.projectMetricTypesReducer,
        projectMetrics: stores.projectMetricsReducer,
        lang: stores.localeReducer.lang
    };
};

RunTestHistory.propTypes = {
    projectID: PropTypes.string.isRequired,
    absolutePath: PropTypes.string.isRequired,
    projectLanguage: PropTypes.string.isRequired
}

export default connect(mapStateToProps)(RunTestHistory);
