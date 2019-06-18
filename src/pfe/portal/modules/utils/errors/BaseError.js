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

/**
*   Base class for Microclimate errors which all errors should extend. See below for examples of extending
*   This class shouldn't be instantiated.
*/

module.exports = class BaseError extends Error {
  constructor(code, message){
    super(message);
    
    // Assign fields so information is accessible through the error object
    this.name = this.constructor.name;
    this.code = code;

    // Create info object to work around not being able to retrieve message
    this.info = {
      name: this.name,
      code,
      message: message.replace('\n', ' ')
    }
    
    //Removes the error class line from the stack trace
    Error.captureStackTrace(this, this.constructor);
  }
} 


/*
*   Any class extending this base class will need to contain the following:
*   - Error class extending the BaseError class
*   - A set of exported error codes   
*   - An implementation of the constructMessage function
*/


/* --- ERROR CLASS ---
*   The class sample below can be copied and should only require the name to be replaced. 
*   - The 'code' param expects the user to pass in an error code (e.g. MyError.NOT_FOUND)
*   - The 'message' param is an optional message the user can add to be appended to the end of the predefined error message
*   - Additional data can be passed in to be included in error messages if necessary 
*   (e.g. ProjectListError takes in an 'identifier' to be used in error messages)
*/

// const BaseError = require('./BaseError')
// module.exports = class MyError extends BaseError {
//   constructor(code, message){
//     if (!code){
//       code = `[Unknown error code]`
//     }
// 
//     super(code, constructMessage(code, message));
//   }
// }



/* --- ERROR CODES ---
*   All types of errors related to the error class should be defined as exported variables.
*/

// module.exports.NOT_FOUND = "NOT_FOUND";
// module.exports.ALREADY_EXISTS = "ALREADY_EXISTS";
// module.exports.MALFORMED = "MALFORMED";



/* --- CONSTRUCT MESSAGE ---
*   The constructMessage function should implement predefined messages for all error codes defined  
*/

// function constructMessage(code, message) {
//   let output = "";
//   switch(code) {
//     case "MY_ERROR_CODE":
//       output = `${code}: <message content>`;
//       break;
//     case 'MY_ERROR_CODE_2':
//       output = `${code}: <message content>`;
//       break;
//     case 'MY_ERROR_CODE_3':
//       output = `${code}: <message content>`;
//       break;
//
//     ...
//
//     default:
//       output = `${code}: <message content>`;
//   }
// 
//   // Append message to output if provided
//   return message ? `${output}\n${message}` : output;
// }
