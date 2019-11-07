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
export const log_names = ["docker.build.log", "maven.build.log", "app.compile.log", "app.log", "docker.app.log", "messages.log", "console.log"];

export const logTypes = ["build", "app"];
const logOrigins = ["container", "workspace"];

export const logFileMappings: any = {
    "docker": {
        [logTypes[0]]: [{
            "origin": logOrigins[1],
            "files": [log_names[0]]
        }],
        [logTypes[1]]: [{
            "origin": logOrigins[1],
            "files": [log_names[3]]
        }]
    },
    "liberty": {
        [logTypes[0]]: [{
            "origin": logOrigins[0],
            "files": [log_names[1]]
        }, {
            "origin": logOrigins[1],
            "files": [log_names[0]]
        }],
        [logTypes[1]]: [{
            "origin": logOrigins[1],
            "files": [log_names[3]]
        }, {
            "origin": logOrigins[0],
            "files": [log_names[6], log_names[5]]
        }]
    },
    "nodejs": {
        [logTypes[0]]: [{
            "origin": logOrigins[1],
            "files": [log_names[0]]
        }],
        [logTypes[1]]: [{
            "origin": logOrigins[1],
            "files": [log_names[3]]
        }]
    },
    "spring": {
        [logTypes[0]]: [{
            "origin": logOrigins[0],
            "files": [log_names[1]]
        }, {
            "origin": logOrigins[1],
            "files": [log_names[0]]
        }],
        [logTypes[1]]: [{
            "origin": logOrigins[1],
            "files": [log_names[3]]
        }]
    },
    "swift": {
        [logTypes[0]]: [{
            "origin": logOrigins[1],
            "files": process.env.IN_K8 ? [log_names[2], log_names[4]] : [log_names[4], log_names[2], log_names[0]]
        }],
        [logTypes[1]]: [{
            "origin": logOrigins[1],
            "files": [log_names[3]]
        }]
    },
};
