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

package org.eclipse.codewind.iterdev.tasks;

import org.eclipse.codewind.iterdev.Constants;
import org.eclipse.codewind.iterdev.DBMap;
import org.eclipse.codewind.iterdev.IDCContext;
import org.eclipse.codewind.iterdev.Logger;

public class ContainerRefreshTask {

    public static boolean execute(IDCContext context) throws Exception {
        String curLastContainerId = context.getAppDb().get(Constants.DB_LAST_CONTAINER_ID);
        String imageCommand = context.getImageCommand();

        try {
            DBMap appDb = context.getAppDb();
            
            if (curLastContainerId != null) {
                Logger.info("* Dockerfile changed detected, refreshing container.");

                // If running in K8s, needs to delete helm release first
                if (context.isK8s()) {
                    TaskUtils.runCmd("helm delete " + appDb.get(Constants.DB_HELM_RELEASE), context, true);
                }
                else {
                        // Erase the container
                    String lastContainerId = appDb.get(Constants.DB_LAST_CONTAINER_ID);
                    if (lastContainerId != null) {
                        TaskUtils.runCmd(imageCommand + " rm -f " + lastContainerId, context, true);
                        appDb.put(Constants.DB_LAST_CONTAINER_ID, null);
                    }
                }
            }
            // Erase the container image
            TaskUtils.runCmd(imageCommand + " rmi -f " + context.getImageName(), context, true);
            appDb.put(Constants.DB_CONTAINER_BUILT, Boolean.FALSE.toString());
            appDb.put(Constants.DB_MASTER_DOCKER_FILE_HASH, null);

            Logger.info("The container has been refreshed.");
        } catch (Exception e) {
            Logger.error("The container refresh failed.", e);
            return false;
        }

        return true;
    }

}