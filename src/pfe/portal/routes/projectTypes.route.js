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

async function initSubtypes(extension, templates, language) {
  
  // simple case, not an extension project type
  if (!extension) {
    return {
      items: [ toSubtype(language) ]
    };
  }

  const subtypes = {
    prompt: '',
    items: []
  };

  // get subtypes from extension provider
  const provider = templates.providers[extension.name];
  if (provider && typeof provider.getSubtypes == 'function') {
    const temp = await provider.getSubtypes();
    subtypes.prompt = temp.prompt;
    if (Array.isArray(temp.items)) {
      for (const item of temp.items) {
        if (!item.id)
          continue;
        subtypes.items.push({
          id: item.id,
          version: item.version, 
          label: item.label || item.id,
          description: item.description
        });
      }
    }
  }

  return subtypes;
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
          projectSubtypes: await initSubtypes(extension, user.templates, template.language)
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
