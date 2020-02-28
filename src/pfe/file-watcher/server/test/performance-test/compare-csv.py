#!/bin/bash
#*******************************************************************************
# Copyright (c) 2020 IBM Corporation and others.
# All rights reserved. This program and the accompanying materials
# are made available under the terms of the Eclipse Public License v2.0
# which accompanies this distribution, and is available at
# http://www.eclipse.org/legal/epl-v20.html
#
# Contributors:
#     IBM Corporation - initial API and implementation
#*******************************************************************************

from __future__ import division
import sys
import os
import pandas as pd

CSV_EXTENSION=".csv"

if (len(sys.argv) >= 3):
    baselineFile=sys.argv[1];
    toBeComparedFile=sys.argv[2];
else:
    print("Usage: python compare-csv.py <baseline_file> <comparable_file> <error_threshold> <network_threshold>");
    sys.exit(1);

if (not (os.path.exists(baselineFile) and os.path.exists(toBeComparedFile))):
    print("File path passed does not exist. Please try again with a correct csv file path.");
    sys.exit(1);
elif (not (CSV_EXTENSION in baselineFile and CSV_EXTENSION in toBeComparedFile)):
    print("File path passed is not a csv file. Please try again with a correct csv file path.");
    sys.exit(1);
else:
    baselineDf = pd.read_csv(baselineFile, index_col=0);
    toBeComparedDf = pd.read_csv(toBeComparedFile, index_col=0)

# threshold value in terms of % of error acceptable
try:
    error_threshold=abs(int(sys.argv[3]));
except IndexError:
    error_threshold=5

# threshold value in terms of % of network error acceptable
try:
    network_threshold=abs(int(sys.argv[4]));
except IndexError:
    network_threshold=50

network_builds = ["create", "modify-Dockerfile"];

# compare the two csv shapes
def csv_shapes_matches(firstDf, secondDf):
    return firstDf.shape == secondDf.shape

# compare the two csv columns and rows
def csv_rows_columns_matches(firstDf, secondDf):
    return (list(firstDf.index.values) == list(secondDf.index.values)) and (list(firstDf.columns) == list(secondDf.columns))

if (not csv_shapes_matches(baselineDf, toBeComparedDf)):
    print("The two csv files have different shapes (row x column)");
    sys.exit(1);
elif (not csv_rows_columns_matches(baselineDf, toBeComparedDf)):
    print("The two csv files have different rows or columns");
    sys.exit(1);
else:
    columNames = list(baselineDf.columns);
    rowNames = list(baselineDf.index.values);

    improvedCases = []
    deterioratedCases = []

    for columnName in columNames:
        projectType = columnName.split("-")[0];
        projectLanguage = columnName.split("-")[-1];
        print("> Generating report for {} {} project:\n".format(projectType, projectLanguage));

        counter=0;
        goodCounter=0;
        badCounter=0;

        for rowName in rowNames:
            baselineValue = baselineDf.loc[rowName, columnName];
            comparableValue = toBeComparedDf.loc[rowName, columnName]
            if (not (baselineValue == "-" or comparableValue == "-")):
                baselineValue = float(baselineValue);
                comparableValue = float(comparableValue);
                difference = round((baselineValue-comparableValue)/(baselineValue) * 100, 2);
                if (rowName in network_builds):
                    threshold_to_compare = network_threshold;
                else:
                    threshold_to_compare = error_threshold;
                if (difference >= 0 and difference >= threshold_to_compare):
                    counter = counter + 1;
                    goodCounter = goodCounter + 1;
                    improvedCases.append("{} {} {} by {}% [{}s -> {}s]".format(projectType, projectLanguage, rowName, difference, baselineValue, comparableValue));
                    print(">> Improvement in run of {} by {}% [{}s -> {}s]".format(rowName, difference, baselineValue, comparableValue));
                elif (difference < 0 and abs(difference) >= threshold_to_compare):
                    counter = counter + 1;
                    badCounter = badCounter + 1;
                    deterioratedCases.append("{} {} {} by {}% [{}s -> {}s]".format(projectType, projectLanguage, rowName, abs(difference), baselineValue, comparableValue));
                    print(">> Deteriorated in run of {} by {}% [{}s -> {}s]".format(rowName, abs(difference), baselineValue, comparableValue));

        if (counter == 0):
            print(">> Found no discrepancy between the two runs.");

        reportCardStr = " Report Card: {} {} ".format(projectType, projectLanguage);
        print("\n" + "*" * 10 + reportCardStr + "*" * 10 + "\n");

        print(">> Found {} improved cases".format(goodCounter));
        print(">> Found {} deteriorated cases".format(badCounter));

        if ((goodCounter+badCounter) > 0):
            improvedRate = goodCounter / (goodCounter+badCounter);
            print(">> Improvement rate: {}%".format(round(improvedRate, 2) * 100));

            deterioratedRate = badCounter / (goodCounter+badCounter);
            print(">> Deterioration rate: {}%".format(round(deterioratedRate, 2) * 100));

        print("\n" + "*" * 10 + "*" * len(reportCardStr) + "*" * 10 + "\n");

    overallReportCard = " Overall Report Card "
    print("\n" + "*" * 10 + overallReportCard + "*" * 10 + "\n");
    print("> Improved cases:\n");
    print("\n".join(improvedCases));
    print("\n");
    print("> Deteriorated cases:\n");
    print("\n".join(deterioratedCases));
    print("\n" + "*" * 10 + "*" * len(overallReportCard) + "*" * 10 + "\n");
