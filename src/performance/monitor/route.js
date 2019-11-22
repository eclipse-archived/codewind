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
const express = require('express');
const path = require('path');

const monitorService = require('./service');

const router = express.Router();

router.get('/', (req, res) => {
    console.log('[GET /performance/monitor]');
    res.send(monitorService.getLatestProjectData(req.query.appOrigin));
});

router.post('/', async (req, res) => {
    console.log('[POST /performance/monitor]');
    const { appOrigin, projectLanguage } = req.query;
    res.send(`Polling ${appOrigin}`);
    monitorService.resetProjectData(appOrigin);
    await monitorService.scrapeProjectData(appOrigin, projectLanguage);
    console.log(`Finished scraping ${projectLanguage} project at ${appOrigin}`);
});

router.get('/environment', async (req, res) => {
    console.log('[GET /performance/monitor/environment]');
    const { appOrigin } = req.query;
    const envData = await monitorService.getEnvData(appOrigin);
    res.send(envData);
});

router.use('/dashboard', express.static(path.join(__dirname, 'public')));

router.get('/dashboard/:projectLanguage', (req, res) => {
    console.log('[GET /performance/codewind-metrics/dashboard]');
    const { projectLanguage } = req.params;
    res.sendFile(path.join(__dirname, 'public', `${projectLanguage}-metrics.html`));
});

module.exports = router;
