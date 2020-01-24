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

const Logger = require('../utils/Logger');
const monitorService = require('./service');

const router = express.Router();
const log = new Logger(__filename);

router.get('/', (req, res) => {
    res.send(monitorService.getLatestProjectData(req.query.appOrigin));
});

router.post('/', async (req, res) => {
    const { appOrigin, projectLanguage } = req.query;
    const msg = `Start scraping ${projectLanguage} project at ${appOrigin}`
    res.send(msg);
    log.info(msg);
    monitorService.resetProjectData(appOrigin);
    await monitorService.scrapeProjectData(appOrigin, projectLanguage);
    log.info(`Finished scraping ${projectLanguage} project at ${appOrigin}`);
});

router.get('/environment', async (req, res) => {
    const { appOrigin } = req.query;
    const envData = await monitorService.getEnvData(appOrigin);
    res.send(envData);
});

router.use('/dashboard', express.static(path.join(__dirname, 'public')));

router.get('/dashboard/:projectLanguage', (req, res) => {
    const { projectLanguage } = req.params;
    res.sendFile(path.join(__dirname, 'public', `${projectLanguage}-metrics.html`));
});

module.exports = router;
