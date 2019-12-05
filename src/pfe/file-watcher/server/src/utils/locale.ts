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
"use strict";

import { promisify } from "util";
import * as path from "path";
import * as fs from "fs";
import * as logger from "./logger";
import i18next from "i18next";
import Backend from "i18next-node-fs-backend";

const readdirAsync = promisify(fs.readdir);
const readFileAsync = promisify(fs.readFile);

const localeDir = process.env.CW_LOCALES_DIR || path.join(path.sep, "file-watcher", "server", "dist", "utils", "locales", path.sep);

let fwLocale = "en";
let isNLSInitialized: Boolean = false;
let i18TransFn: i18next.TFunction;
const localeInUse = [fwLocale];

export interface ISetLocaleSuccess {
    statusCode: 200;
    locale: string;
}

export interface ISetLocaleFailure {
    statusCode: 400;
    error: { msg: string };
}

/**
 * @see [[Filewatcher.setLocale]]
 */
export async function setLocale(localeRequested: string[]): Promise<ISetLocaleSuccess | ISetLocaleFailure> {
    logger.logTrace("Setting up locale. Locale requested: " + localeRequested);

    if (!localeRequested) {
        return {  "statusCode": 400, "error": { "msg": "Bad request. Locale key not found in request body!" }};
    }

    if (Array.isArray(localeRequested) == false) {
        return { "statusCode": 400, "error": { "msg": "Bad request. locale must be an array." }};
    }

    // Handle '-' in locale requested, since FW NLS has issues parsing '-'
    // Convert them to `_`. So for example, pt-BR becomes pt_BR
    const localeRequestedLength = localeRequested.length;
    for (let i = 0; i < localeRequestedLength; i++) {
        localeRequested[i] = localeRequested[i].replace("-", "_");
    }

    const localePriority = [];

    const files = await readdirAsync(localeDir);
    for (const value of localeRequested) {
        for (const file of files) {
            if (value === file) {
                localePriority.push(value);
            }
        }
    }

    if (localePriority.length != 0) {
        fwLocale = localePriority[0];
    }

    logger.logTrace("locale has been set to: " + fwLocale);

    if (localeInUse[0] === fwLocale) {
        // No need to re-initialize FW NLS instance
        if (!isNLSInitialized) {
            try {
                i18TransFn = await initNLSInstance(getLocale());
            } catch (err) {
                logger.logError("Failed to initialize the NLS instance");
            }
        } else {
            logger.logTrace("Same locale detected, will not re-initialize NLS");
        }
    } else {
        // locale has changed since the last locale used by FW
        // initialize NLS instance with the new locale
        isNLSInitialized = false;
        localeInUse.pop();
        localeInUse.push(fwLocale);

        try {
            i18TransFn = await initNLSInstance(getLocale());
        } catch (err) {
            logger.logError("Failed to initialize the NLS instance");
        }
    }

    logger.logTrace("locale.setLocale() isNLSInitialized: " + isNLSInitialized);

    return { "statusCode": 200, "locale": fwLocale};
}

/**
 * @function
 * @description Get the locale currently set.
 *
 * @returns string
 */
export function getLocale(): string {
    return fwLocale;
}

/**
 * @function
 * @description Get the translation of a given key.
 *
 * @param key <Required | String> - The translation key.
 * @param options <Optional | i18next.TranslationOptions> - The translation options.
 *
 * @returns Promise<string>
 */
export async function getTranslation(key: string, options?: i18next.TOptions): Promise<string> {

    if (!isNLSInitialized) {

        // Don't try to initialize here anymore, leave it to fw startup or the locale API call.
        // When fw starts up, multiple projects will be trying to exec this function causing timing issues
        logger.logError("The file-watcher NLS instance had failed to initialize");
        logger.logError("Attempting to directly parse the translation file");
        return await getMessageFromFile(key);
    }

    let translatedMsg: string = i18TransFn(key, options);

    // Fail-safe. Incase if for some reason, FW cannot fetch translation after
    // i18next is initialized successfully, parse it from the English translation file
    if (translatedMsg == key) {
        logger.logTrace("File-watcher could not fetch the translation using the translation service");
        logger.logTrace("Attempting to parse the translation file");
        translatedMsg = await getMessageFromFile(key, "en");
    }

    logger.logTrace("Key translated. Returning message: " + translatedMsg);
    return translatedMsg;
}

/**
 * @function
 * @description Initialize the NLS instance.
 *
 * @param language <Required | String> - The language to initialize NLS with.
 *
 * @returns Promise<i18next.TranslationFunction>
 */
export function initNLSInstance(language: string): Promise<i18next.TFunction> {
    return new Promise((resolve, reject) => {
        i18next
        .use(Backend)
        .init({
            lng: language,
            backend: {
            loadPath: __dirname + "/locales/{{lng}}/translation.json"
            },
            fallbackLng: "en",
            saveMissing: true
        }, (err, t) => {
            if (err) {
                logger.logError("Error initializing File-watcher NLS Instance: " + err);
                isNLSInitialized = false;
                reject(err);
                return;
            }

            logger.logTrace("locale.initNLSInstance() translation test: " + t("buildscripts.buildImage"));
            logger.logTrace("locale.initNLSInstance(): " + t("filewatcherUtil.fwNLSInitSuccess"));
            logger.logTrace("locale.initNLSInstance() isInitialized: " + i18next.isInitialized);
            if (i18next.isInitialized) {
                isNLSInitialized = true;
            }
            logger.logTrace("locale.initNLSInstance() Initialized File-watcher NLS Instance to: " + i18next.language);
            i18TransFn = t;
            resolve(t);
        });
    });
}

/**
 * @function
 * @description Get the message from the file.
 *
 * @param key <Required | String> - The translation key.
 * @param backupLang <Optional | String> - The backup language for parsing the translation file.
 *
 * @returns Promise<string>
 */
export async function getMessageFromFile(key: string, backupLang?: string): Promise<string> {
    let filePath = localeDir + fwLocale + "/translation.json";
    if ( backupLang && backupLang.length != 0 ) {
        filePath = localeDir + backupLang + "/translation.json";
    }
    const jsonFile = await readFileAsync(filePath);
    const jsonObj = JSON.parse(jsonFile.toString());
    const keyArray = key.split(".");
    let message = jsonObj;
    try {
        for (const element in keyArray) {
            message = message[keyArray[element]];
            if (!message || message == "") {
                logger.logTrace("File watcher was unable to find the key in the translation file, the key will be used as the translation value: " + key);
                return key;
            }
        }
    } catch (err) {
        logger.logTrace("Error parsing the translation file, the key will be used as the translation value: " + key);
        return key;
    }

    logger.logTrace("Directly parsed the translation file, returning msg: " + message);
    return message;
}
