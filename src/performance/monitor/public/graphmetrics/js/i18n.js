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

// This script chooses a locale.properties and parses into an object containing each key-value string.
// These strings replace the hard-coded strings in each of the 10 charts + flamegraph.
// var userLocale;
// if (navigator.browserLanguage) {
//   userLocale = navigator.browserLanguage;
// } else if (navigator.language) {
//   userLocale = navigator.language;
// }

function populateLocalizedStrings() {
  var file = new XMLHttpRequest();
  var pathToFile = '';

// hardcode this file for now until we have translated files
  pathToFile = 'graphmetrics/locales/en.properties';

  // if (userLocale === 'en') {
  //   pathToFile = 'graphmetrics/locales/allTitles.properties';
  // } else {
  //   pathToFile = 'graphmetrics/locales/FILENAME_' + userLocale + '.properties';
  // }


  file.open('GET', pathToFile, false);
  file.overrideMimeType('text/plain; charset=utf-8');
  file.send();
  if (file.readyState === 4 && file.status === 200) {
    let lines = (file.responseText).split('\n');
    lines.pop();
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].charAt(0) !== '#') {
        let keyVal = lines[i]
                        .replace('\r', '')
                        .split('=');
        // Define the object field (key = [0] val = [1])
        localizedStrings[keyVal[0]] = keyVal[1];
      }
    }
  }
}

function formatTemplate(str, substitutions) {
  let result = str;
  for (let key in substitutions) {
    result = result.replace('{' + key + '}', substitutions[key]);
  }
  return result;
}
