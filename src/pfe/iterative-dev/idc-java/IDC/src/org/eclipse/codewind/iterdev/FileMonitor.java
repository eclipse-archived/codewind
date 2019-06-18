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
package org.eclipse.codewind.iterdev;

import java.io.File;
import java.io.FilenameFilter;
import java.io.IOException;

public class FileMonitor {

	private static String DELTA_CONFIG_UPDATE = "/src/main/liberty/config";
	private static String DELTA_POM_UPDATE = "pom.xml";

	public static String CONFIGUPDATE_HASH = "CONFIGUPDATE_HASH";
	public static String POMCHANGE_HASH = "POMCHANGE_HASH";
	
	/**
	 * Get the new configuration file update hash.
	 * @return the new configuration file update hash if a new config update happens. If no config update, return null.
	 **/
	public static String getNewConfigUpdateHash(DBMap appDb, String appPath) {
		if (appDb == null || appPath == null) {
			return null;
		}
		
		String configUpdateHash = appDb.get(CONFIGUPDATE_HASH);

		File configDir = new File(appPath + File.separator + DELTA_CONFIG_UPDATE);
		File[] fileLst = configDir.listFiles(new FilenameFilter() {
			@Override
			public boolean accept(File dir, String name) {
				return name.endsWith(".xml");
			}
		});

		try {
			String curConfigUpdateHash = IDCUtils.calculateHashOfOrderedFileContents(fileLst);
			// If no existing hash is available, a config update is required to force appDb contains last config update change info.
			return (configUpdateHash != null && configUpdateHash.equals(curConfigUpdateHash)) ? null : curConfigUpdateHash;
		} catch (IOException e) {
			Logger.error("Failed to check config update file changes.");
		}
		return null;
	}

	/**
	 * Get the new pom file update hash.
	 * @return the new pom file update hash if a new pom update happens. If no pom update, return null.
	 **/
	public static String getNewPomUpdateHash(DBMap appDb, String appPath) {
		if (appDb == null || appPath == null) {
			return null;
		}
		
		String pomUpdateHashInDbCache = appDb.get(POMCHANGE_HASH);
		File pomFile = new File(appPath + File.separator + DELTA_POM_UPDATE);
		try {
			String curConfigUpdateHash = IDCUtils.calculateHashOfOrderedFileContents(new File[] { pomFile });
			// If no existing hash is available, a fresh build is required to force appDb contains last pom change info.
			return (pomUpdateHashInDbCache != null && pomUpdateHashInDbCache.equals(curConfigUpdateHash)) ? null : curConfigUpdateHash;
		} catch (IOException e) {
			Logger.error("Failed to check pom file changes.");
		}
		return null;
	}

	
}
