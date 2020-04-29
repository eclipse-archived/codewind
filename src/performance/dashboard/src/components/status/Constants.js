/*******************************************************************************
* Copyright (c) 2020 IBM Corporation and others.
* All rights reserved. This program and the accompanying materials
* are made available under the terms of the Eclipse Public License v2.0
* which accompanies this distribution, and is available at
* http://www.eclipse.org/legal/epl-v20.html
*
* Contributors:
*     IBM Corporation - initial API and implementation
******************************************************************************/

export const STATUS_OK = 1;
export const STATUS_ERROR = -1;
export const STATUS_WARNING = 0;

export const MESSAGE_PROJECT_RUNNING = 'Your project has started and is running.';
export const MESSAGE_PROJECT_NOT_RUNNING = 'Your project is not responding. From your IDE, open project settings then build and start your project.';
export const MESSAGE_PROJECT_NOT_COMPATIBLE = 'Your project is not compatible with this feature.';
export const MESSAGE_LOADRUNNER_AVAILABLE = 'Load pressure can be applied to your project.';
export const MESSAGE_LOADRUNNER_NOT_AVAILABLE = 'Your project is not running. Load pressure can only be applied to running projects.';
export const MESSAGE_LIVEMETRICS_AVAILABLE = 'Live monitoring is available for your project';
export const MESSAGE_LIVEMETRICS_MICROPROFILE = 'Your project has all the prerequisite modules. However this feature it is not currently available because the metrics capability has been secured.';
export const MESSAGE_LIVEMETRICS_MICROPROFILE_DETAIL = 'If you wish to see live metrics, you can disable authentication by modifying the server.xml file in your project. ' +
'You can locate this file at src/main/liberty/config/server.xml. Modify server.xml and add or update: <br/><br/>&lt;mpMetrics authentication=&quot;false&quot;/&gt;' +
'<br/>'+
'<br/>for example:'+
'<br/>'+
'<div style="font-family: \'Courier New\', Courier, monospace"; font-size:0.9em; font-weight:bold>'+
'<br/>&lt;featureManager&gt;'+
'<br/>&nbsp;&nbsp;&lt;feature&gt;microProfile-2.0&lt;/feature&gt;'+
'<br/>&lt;/featureManager&gt;'+
'<br/>&lt;mpMetrics authentication=&quot;false&quot;/&gt;'+
'</div>';
export const MESSAGE_LIVEMETRICS_INJECT_REQUIRED = 'Action required: Open the project settings in your IDE and enable the Inject AppMetrics checkbox.';
export const MESSAGE_COMPARISONS_AVAILABLE = 'Your project does support load test benchmarking.';
export const MESSAGE_COMPARISONS_INJECT_REQUIRED = 'Action required: Open the project settings in your IDE and enable the Inject AppMetrics checkbox.';
export const MESSAGE_COMPARISONS_INJECT_TIMED = 'For improved accuracy, open the project settings in your IDE and enable the Inject AppMetrics checkbox.';
export const MESSAGE_COMPARISONS_NOT_RUNNING = 'Your project is not running. Running new load tests will not be available however you can view past benchmarks.';
