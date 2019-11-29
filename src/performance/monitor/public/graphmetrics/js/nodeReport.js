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
// socket.on('nodereport', function(nodereport){
//   var newWindow = window.open();
//   newWindow.document.open();
//   // XXX(sam) perhaps the errors should be formatted differently?
//   nodereport = nodereport.error || nodereport.report;
//   newWindow.document.write('<html><head><title>NodeReport: '
//     + new Date().toUTCString()
//     + '</title></head><body><pre style="white-space: pre-wrap;">'
//     + nodereport + '</pre></body></h‌​tml>');
//   newWindow.document.close();
// });

// socket.on('heapdump', function(info){
//   var text = 'Heap snapshot generated at ' + info.location;
//   if (info.error) {
//     text = 'An error occurred: ' + info.error;
//   }
//   d3.select('.modal-body').select('.modaltext').remove();
//   d3.select('.modal-body')
//     .append('p')
//     .attr('class', 'modaltext')
//     .text(text);
//   $('#heapdumpModal').modal('show');
// });
