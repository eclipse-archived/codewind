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

let formatToISODate = function (epochTime) {
    let dt = new Date(epochTime);
    let month = dt.getMonth() + 1;
    return (dt.getFullYear()) + "-" + ('0' + month).slice(-2) + "-" + ('0' + dt.getDate()).slice(-2);
};

let formatToISOTime = function (epochTime) {
    let dt = new Date(epochTime);
    return ('0' + dt.getHours()).slice(-2) + ":" + ('0' + dt.getMinutes()).slice(-2) + ":" + ('0' + dt.getSeconds()).slice(-2);
};

/***
* Given an epoch time value of 1553610830484 this function will return 
* a date time string in the format yyyymmddHHMMss eg  '20190326143350'
*/

let formatDateToString = function (epochTime) {
    let dt = new Date(epochTime);
    let year = dt.getUTCFullYear();
    let month = ('0' + (dt.getUTCMonth() + 1)).slice(-2);
    let day = ('0' + dt.getUTCDate()).slice(-2);
    let hour = ('0' + dt.getUTCHours()).slice(-2);
    let min = ('0' + dt.getUTCMinutes()).slice(-2);
    let sec = ('0' + dt.getUTCSeconds()).slice(-2);
    return `${year}${month}${day}${hour}${min}${sec}`;
};

exports.formatToISODate = formatToISODate;
exports.formatToISOTime = formatToISOTime;
exports.formatDateToString = formatDateToString;