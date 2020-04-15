/*******************************************************************************
 * Copyright (c) 2020 IBM Corporation and others.
 * All rights reserved. This program and the accompanying materials
 * are made available under the terms of the Eclipse Public License v2.0
 * which accompanies this distribution, and is available at
 * http://www.eclipse.org/legal/epl-v20.html
 *
 * Contributors:
 *     IBM Corporation - initial API and implementation
 *******************************************************************************/
function checkProjectExists(req, res, next) {
  const id = req.sanitizeParams('id');
  const { cw_user: { projectList } } = req;
  const project = projectList.retrieveProject(id);
  if (!project) {
    res.status(404).send(`Project with ID '${id}' does not exist on the Codewind server`);
    return;
  }
  next();
}

function getProjectFromReq(req) {
  const id = req.sanitizeParams('id');
  const { cw_user: { projectList } } = req;
  return projectList.retrieveProject(id);
}

module.exports = {
  checkProjectExists,
  getProjectFromReq,
};
