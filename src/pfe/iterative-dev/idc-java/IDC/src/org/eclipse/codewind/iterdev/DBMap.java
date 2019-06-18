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

import java.io.BufferedReader;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileWriter;
import java.io.IOException;
import java.io.InputStreamReader;
import java.util.Collections;
import java.util.HashMap;
import java.util.Map;


/** Simple key-value store; this class is not thread safe.  */
public class DBMap {

	public static final String DBPREFIX = "db-";
	
	private final File file;
	
	private final Map<String, String> map = new HashMap<>();
	
	private final String id;
	
	public DBMap(String id, File idcBase) throws IOException {
		this.id = id;
		
		File dir = new File(idcBase, "db");
		
		file = new File(dir, DBPREFIX+id);
		
		if(file.exists()) {
			
			BufferedReader br = new BufferedReader(new InputStreamReader(new FileInputStream(file)));
			String str;
			while(null != (str = br.readLine())) {
				
				int index = str.indexOf("@#@");
				String value = str.substring(index+3).trim();
				if(value.equals("null")) { value = null; }
				
				map.put(str.substring(0, index), value);
			}
			br.close();
			
		}
	}
	
	
	public String getId() {
		return id;
	}

	public String get(String key) {
		return map.get(key);
	}
	
	public Map<String, String> getMap() {
		return Collections.unmodifiableMap(map);
	}
	
	public void remove(String key) {
		map.remove(key);
		
		try {
			writeMap();
		} catch (IOException e) {
			e.printStackTrace();
		}		
	}
	
	public void put(String key, String value) {
		map.put(key, value);
		try {
			writeMap();
		} catch (IOException e) {
			e.printStackTrace();
		}
	}
	
	private void writeMap() throws IOException {
		if(!file.getParentFile().exists())
			file.getParentFile().mkdirs();
		FileWriter fw = new FileWriter(file);
		
		for(Map.Entry<String, String> e : map.entrySet()) {
			
			// Null values should not be written to the file, rather than being written as nulls
			if(e.getValue() == null) { continue; }
			
			fw.write(e.getKey()+"@#@"+e.getValue()+"\n");
		}
		fw.close();
	}
	
}
