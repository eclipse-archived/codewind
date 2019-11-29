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
function updateHeader(data) {
  var titleAndDocs = JSON.parse(data);
  if (titleAndDocs.hasOwnProperty('title'))
    d3.select('.leftHeader')
      .text(titleAndDocs.title);
  if (titleAndDocs.hasOwnProperty('docs')) {
    d3.select('.rightHeader')
      .select('.docLink')
      .remove();
    d3.select('.rightHeader').append('a')
      .attr('class', 'docLink')
      .attr('href', titleAndDocs.docs)
      .attr('target', '_blank')
      .text('Go To Documentation');
  }
}
