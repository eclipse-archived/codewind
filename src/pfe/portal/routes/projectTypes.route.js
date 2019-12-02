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
      label: String(type.projectSubtypes.label),
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

async function getProjectTypes(provider, sourceId) {
  
  const projectTypes = [];

  // get projectTypes from extension provider
  if (provider && typeof provider.getProjectTypes == 'function') {
    // guard against bad providers
    try {
      const types = await provider.getProjectTypes(sourceId);
      if (Array.isArray(types))
        types.reduce(sanitizeProjectType, projectTypes);
    }
    catch (err) {
      log.error(err.message);
    }
  }

  return projectTypes;
}

function addLanguage(projectType, language) {
  if (!projectType.projectSubtypes.items.find(item => item.id == language)) {
    // label is mainly for extension project types to supply custom labels for subtypes
    // for Codewind the label for the language is just the language itself
    projectType.projectSubtypes.items.push({ id: language, label: language });
  }
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
    const templates = await user.templates.getTemplates(true);
    for (const template of templates) {
      
      const projectType = template.projectType;
      const extension = user.extensionList.getExtensionForProjectType(projectType)
      
      if (extension) {
        const sourceId = template.sourceId;
        const key = `${projectType}/${sourceId}` 
        // only need to get project types from extension once
        if (seenProjectTypes[key])
          continue;
        const types = await getProjectTypes(user.templates.providers[extension.name], sourceId);
        projectTypes.push(...types);
        seenProjectTypes[key] = true;
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
