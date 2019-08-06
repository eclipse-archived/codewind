/*******************************************************************************
 * Licensed Materials - Property of IBM
 * "Restricted Materials of IBM"
 *
 * Copyright IBM Corp. 2018, 2019 All Rights Reserved
 *
 * US Government Users Restricted Rights - Use, duplication or disclosure
 * restricted by GSA ADP Schedule Contract with IBM Corp.
 *******************************************************************************/
/**
 * Log file conventions:
 * docker.build -> docker image build log file
 * docker.app -> docker app build log file
 * maven.build -> maven build log file
 * app.compile -> app compilation log file
 */
export const log_names = ["docker.build.log", "maven.build.log", "app.compile.log", "app.log", "docker.app.log"];

export const logTypes = ["build", "app"];

export const logFileMappings: any = {
    "docker": {
        [logTypes[0]]: [log_names[0]],
        [logTypes[1]]: [log_names[3]],
    }
};
