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

const Logger = require('../modules/utils/Logger');

const router = express.Router();
const log = new Logger(__filename);

function toSubtype(language) {
  return {
    id: language,
    label: language
  };
}

function addLanguage(projectType, language) {
  if (!projectType.projectSubtypes.items.find(item => item.id == language))
    projectType.projectSubtypes.items.push(toSubtype(language));
}

async function initSubtypes(extension, language) {
  
  if (extension) {
    // todo
  }
  
  return {
    prompt: 'Select the language that best fits your project',
    items: [ toSubtype(language) ]
  };
}

/**
 * API function to returns a list of supported project types
 * @return JSON array with the list of supported project types
 */
router.get('/api/v1/project-types', async (req, res) => {
  const user = req.cw_user;
  const projectTypes = {};
  try {
    const templates = await user.templates.getEnabledTemplates();
    for (const template of templates) {
      
      const projectType = template.projectType;
      const extension = user.extensionList.getExtensionForProjectType(projectType)
      
      // seen this type before
      if (projectTypes[projectType]) {
        if (!extension)
          addLanguage(projectTypes[projectType], template.language);
      }
      // initialize a new entry
      else {
        projectTypes[projectType] = {
          projectType: projectType,
          projectSubtypes: await initSubtypes(extension, template.language)
        };
      }
    }

    res.status(200).send(Object.values(projectTypes));
  } catch (err) {
    log.error(err);
    res.status(500).send(err);
  }
});

module.exports = router;
