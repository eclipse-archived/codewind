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
import { ROUTES_CHARTS } from '../AppConstants'
import { Link } from 'react-router-dom';
import { connect } from 'react-redux';
import { DataTable, Pagination } from 'carbon-components-react';
import Delete from '@carbon/icons-react/lib/delete/16';
import { fetchProjectMetricTypes } from '../store/actions/projectMetricTypesActions';
import { fetchProjectMetrics, postDeleteTest, reloadMetricsData } from '../store/actions/projectMetricsActions';
import MetricsUtils from '../modules/MetricsUtils';

import { TranslatedText } from '../translations';
import { formatToISODate, formatToISOTime } from '../utils/dateTime';
import {formatDateToString} from '../utils/dateTime';
import ModalDeleteTest from '../components/modalDlgs/ModalDeleteTest';
import ProjectIDChecker from '../utils/projectUtils';


import './PageManageTests.scss';
const {
    TableContainer,
    Table,
    TableBatchAction,
    TableBatchActions,
    TableToolbarSearch,
    TableToolbar,
    TableToolbarContent,
    TableHead,
    TableRow,
    TableBody,
    TableCell,
    TableHeader,
    TableSelectAll,
    TableSelectRow,
} = DataTable;

const headers = [
    {
        key: 'plotNumber',
        header: 'Test',
    },
    {
        key: 'time',
        header: 'Time',
    },
    {
        key: 'desc',
        header: 'Description',
    }
];

class PageManageTests extends React.Component {

    constructor(props) {
        super(props);
        this.state = {
            projectMetricsLastUpdated: 0,
            loadTestList: [],
            selectedRows: [],
            paginatedRows: [],
            deleteInProgress: false,
            pagination: { totalHits: 0, page: 1, pageSize: 10 },
        }

        this.handleDeleteBtn = this.handleDeleteBtn.bind(this);
        this.executeDeleteTests = this.executeDeleteTests.bind(this);
        this.handleCloseDeleteModal = this.handleCloseDeleteModal.bind(this);
        this.handlePaginationChange = this.handlePaginationChange.bind(this);
        this.formatTableCell = this.formatTableCell.bind(this);
        this.filterRows = this.filterRows.bind(this);
    }

    async componentDidMount() {
        
        let projectID = ProjectIDChecker.projectID();
        if (!projectID) { return; }

        // Get the list of available project metric types
        await this.props.dispatch(fetchProjectMetricTypes(this.props.projectMetricTypes, projectID));
        if (this.props.projectMetricTypes && this.props.projectMetricTypes.error) {
            alert(this.props.projectMetricTypes.error.message + ' reason: ' + this.props.projectMetricTypes.error.err);
            return;
        }

        // Get the actual metrics
        await this.props.dispatch(fetchProjectMetrics(this.props.projectMetrics, projectID, this.props.projectMetricTypes.types));

        if (this.props.projectMetrics && this.props.projectMetrics.error) {
            alert(this.props.projectMetrics.error.message + ' reason: ' + this.props.projectMetrics.error.err);
            return;
        }

        let listModel = [];
        // As soon as we have updated results from the metrics API,  build a UI custom fit data model for display
        if (this.props.projectMetrics.fetched) {
            listModel = MetricsUtils.sortMetrics(this.props.projectMetrics.metrics, '/');
            this.setState({ loadTestList: listModel, paginatedRows: listModel.slice(0, 10), pagination: { totalHits: listModel.length, page: 1, pageSize: 10 } })
        }
    }

    componentWillReceiveProps(nextProps) {
        if (this.state.projectMetricsLastUpdated !== nextProps.projectMetrics.receivedAt) {
            let listModel = [];
            if (this.props.projectMetrics.fetched) {
                listModel = MetricsUtils.sortMetrics(nextProps.projectMetrics.metrics, '/');
                this.setState({  projectMetricsLastUpdated: nextProps.projectMetrics.receivedAt, loadTestList: listModel, paginatedRows: listModel.slice(0, 10), pagination: { totalHits: listModel.length, page: 1, pageSize: 10 } })
            }
        }
    }

    handleDeleteBtn(rows) {
        this.setState({ showModalDelete: true, selectedRows: rows });
    }

    handleCloseDeleteModal() {
        this.setState({ showModalDelete: false })
    }


    /* Deletes each test in turn, then reloads the table data */
    async executeDeleteTests() {
        const projectID = ProjectIDChecker.projectID();
        
        this.setState({ deleteInProgress: true });
        try {
            let deleteCandidates = this.state.selectedRows.map(testEntry => {
                return formatDateToString(parseInt(testEntry.id));
            });
            for (let i = 0; i< deleteCandidates.length;i++) {
                await postDeleteTest(projectID, deleteCandidates[i]);            
            }
        } catch (err) {
            alert ("Delete failed:  " + err);
        }

        await this.setState({ deleteInProgress: false, showModalDelete: false });
        this.refs.tableTestRun.handleOnCancel(); // deselect all rows & hide batch action bar
        this.props.dispatch(reloadMetricsData(projectID, this.props.projectMetricTypes.types));
    }

    handlePaginationChange(pagination) {
        let p = this.state.pagination;
        p.page = pagination.page;
        p.pageSize = pagination.pageSize;
        let rows = this.state.loadTestList;
        let start = (p.page - 1) * p.pageSize;
        let end = start + p.pageSize;
        rows = rows.slice(start, end);
        this.setState({ pagination: p, paginatedRows: rows });
    }

    // eslint-disable-next-line class-methods-use-this
    formatTableCell(id, value) {
        let key = id.split(':')[1];
        let cellValue = value;
        if (key === 'time') {
            cellValue = `${formatToISODate(cellValue)} @ ${formatToISOTime(cellValue)}`;
        }
        return cellValue;
    }

    /**
    * search All rows in the dataset and populate the paginatedRows list with hits
    */
    filterRows(e) {

        let filteredRows = [];
        let searchString = e.target.value;

        let pagination = this.state.pagination;
        pagination.page = 1;
        pagination.totalHits = this.state.loadTestList.length;

        // No search required - reset the table
        if (!searchString) {
            this.setState({ paginatedRows: this.state.loadTestList.slice(0, pagination.pageSize), pagination: pagination });
            return;
        }
        searchString = searchString.toLowerCase();
        filteredRows = this.state.loadTestList.filter(entry => {
            let t = `${formatToISODate(entry.time)} @ ${formatToISOTime(entry.time)}`;
            if (entry.desc) {
                return (entry.desc.toLowerCase()).includes(searchString) || t.includes(searchString);
            }
            return t.includes(searchString);
        });

        pagination.totalHits = filteredRows.length;
        this.setState({ paginatedRows: filteredRows.slice(0, pagination.pageSize), pagination: pagination });
    }

    render() {
        let projectID = ProjectIDChecker.projectID();
        if( !projectID) {
            projectID = this.props.projectID
        }

        
        return (
            <div className="PageManageTests">
                <div className="pageTitle">
                    {TranslatedText(this.props.lang, "page.manage.title", 'Manage test results')}
                </div>
                <div className="linkBar">
                    <span className="link"><Link to={`${ROUTES_CHARTS}?project=${projectID}`}>{TranslatedText(this.props.lang, "page.link.regressionTesting", 'Regression Testing')}</Link></span>
                    <span className="linkSeparator"> / </span>
                    <span className="">{TranslatedText(this.props.lang, "page.manage.title", 'Manage test results')}</span>
                </div>
                <DataTable
                    rows={this.state.paginatedRows}
                    headers={headers}
                    ref="tableTestRun"
                    render={({ rows, headers, getHeaderProps, getSelectionProps, getBatchActionProps, selectedRows }) => (
                        <TableContainer title="" >
                            <TableToolbar>
                                <TableToolbarContent>
                                    <TableToolbarSearch onChange={this.filterRows} />
                                    <TableBatchActions {...getBatchActionProps()}>
                                        <TableBatchAction data-testid="actionDelete" renderIcon={Delete} iconDescription="Delete" onClick={() => this.handleDeleteBtn(selectedRows)}>
                                            Delete Test
                                        </TableBatchAction>
                                    </TableBatchActions>
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
                                    </TableRow>
                                </TableHead>
                                <TableBody>
                                    {rows.map(row => (
                                        <TableRow key={row.id}>
                                            <TableSelectRow {...getSelectionProps({ row })} />
                                            {row.cells.map(cell => (
                                                <TableCell key={cell.id}>
                                                    {this.formatTableCell(cell.id, cell.value)}
                                                </TableCell>
                                            ))}
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>

                            {this.state.pagination.totalHits === 0 ? (
                                <Fragment />
                            ) : (
                                    <Pagination
                                        className="paginationBar"
                                        pageSizes={[10, 30, 50, 100]}
                                        totalItems={this.state.pagination.totalHits}
                                        onChange={this.handlePaginationChange}
                                        pageSize={this.state.pagination.pageSize}
                                        page={this.state.pagination.page}
                                    />
                                )}
                        </TableContainer>
                    )}
                />

                {this.state.showModalDelete ? <ModalDeleteTest
                    deleteInProgress={this.state.deleteInProgress}
                    handleCloseDeleteModal={this.handleCloseDeleteModal}
                    executeDeleteTests={this.executeDeleteTests}
                    selectedRowCount={this.state.selectedRows.length}
                /> : <Fragment />}
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

export default connect(mapStateToProps)(PageManageTests);
