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

function sanitizeProjectType(array, type) {

  // doesn't even have the expected fields, no-op return
  if (!type.projectType || !type.projectSubtypes || !Array.isArray(type.projectSubtypes.items))
    return array;

  const sanitized = {
    projectType: String(type.projectType),
    projectSubtypes: {
      prompt: String(type.projectSubtypes.prompt),
      items: []
    }
  };

  for (const item of type.projectSubtypes.items) {
    if (!item.id)
      continue;
    sanitized.projectSubtypes.items.push({
      id: String(item.id),
      version: String(item.version),
      label: String(item.label || item.id),
      description: String(item.description)
    });
  }

  if (sanitized.projectSubtypes.items.length > 0)
    array.push(sanitized);

  return array
}

async function getProjectTypes(provider) {
  
  const projectTypes = [];

  // get projectTypes from extension provider
  if (provider && typeof provider.getProjectTypes == 'function') {
    const types = await provider.getProjectTypes();
    if (Array.isArray(types))
      types.reduce(sanitizeProjectType, projectTypes);
  }

  return projectTypes;
}

function addLanguage(projectType, language) {
  if (!projectType.projectSubtypes.items.find(item => item.id == language))
    projectType.projectSubtypes.items.push({ id: language, label: language });
}

/**
 * API function to returns a list of supported project types
 * @return JSON array with the list of supported project types
 */
router.get('/api/v1/project-types', async (req, res) => {
  const user = req.cw_user;
  const projectTypes = [];
  const seenProjectTypes = {};
  try {
    const templates = await user.templates.getEnabledTemplates();
    for (const template of templates) {
      
      const projectType = template.projectType;
      const extension = user.extensionList.getExtensionForProjectType(projectType)
      
      if (extension) {
        // only need to get project types from extension once
        if (seenProjectTypes[projectType])
          continue;
        const types = await getProjectTypes(user.templates.providers[extension.name]);
        projectTypes.push(...types);
        seenProjectTypes[projectType] = true;
      }
      else {
        // initialize a new entry
        if (!seenProjectTypes[projectType]) {
          const type = {
            projectType: projectType,
            projectSubtypes: {
              items: []
            }
          };
          projectTypes.push(type);
          seenProjectTypes[projectType] = type;
        }
        
        addLanguage(seenProjectTypes[projectType], template.language);
      }
    }

    res.status(200).send(projectTypes);
  } catch (err) {
    log.error(err);
    res.status(500).send(err);
  }
});

module.exports = router;
