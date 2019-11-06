/*******************************************************************************
 * Copyright 2017 IBM Corp.
 *
 * Licensed under the Apache License, Version 2.0 (the "License"); you may not
 * use this file except in compliance with the License. You may obtain a copy of
 * the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS, WITHOUT
 * WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the
 * License for the specific language governing permissions and limitations under
 * the License.
 ******************************************************************************/

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
