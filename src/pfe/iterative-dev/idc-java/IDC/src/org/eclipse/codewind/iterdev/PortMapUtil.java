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

import java.io.IOException;
import java.net.ServerSocket;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.stream.Collectors;

public class PortMapUtil {

	public static final String HTTP_PORT = "http";
	public static final String HTTPS_PORT = "https";
	
	/** This method does not acquire the ports, it merely returns to the calling method that they are available. To reserve the ports in the 
	 * global database, call reservePortsInDatabase(...). */
	public static Optional<Map<String, Integer>> getPortsForApplication(IDCContext context) {
		
		Map<String /* app id*/, PortMapping> portMappings =  getPortMappingsFromDatabase(context.getGlobalDb());
		
		HashMap<String, Integer> result = new HashMap<String, Integer>();
		
		// 1) Does this app ip already have ports mapped?
		PortMapping pm = portMappings.get(context.getAppId());
		if(pm != null) {
			// If yes, use them.
			Integer httpsPort = pm.getMap().get(HTTPS_PORT);
			Integer httpPort = pm.getMap().get(HTTP_PORT);
			
			if(httpPort == null || httpsPort == null) { throw new IllegalStateException("Port mapping exists in the database, but ports were not found: "+ httpPort +" "+ httpsPort); }
			
			result.put(HTTPS_PORT, httpsPort);
			result.put(HTTP_PORT, httpPort);
			
			return Optional.of(result);
		}
		
		// 2) If the app has no exist ports, start from 9080 and 9443. Keep going until you find both are unused (and it's available to listen on)
		int currHttp = 9080, currHttps=9443;
		boolean matchFound = false;
		while(!matchFound && currHttp <= 65535 && currHttps <= 65536 ) {
			final int fCurrHttp = currHttp;
			final int fCurrHttps = currHttps;
			
			boolean currPortInUse = portMappings.values().stream().anyMatch( (PortMapping e) -> {
				Integer http = e.getMap().get(HTTP_PORT);
				Integer https = e.getMap().get(HTTPS_PORT);
				
//				System.out.println("port in use? "+http+"("+fCurrHttp+") "+https+"("+fCurrHttps+") of "+e.getAppId());
				
				if(http != null && http == fCurrHttp) {
					return true;
				}

				if(https != null && https == fCurrHttps) {
					return true;
				}
				
				return false;
			});
			
			System.out.println("* Found unclaimed ports, testing if available: "+currHttp+" "+currHttps);
			if(!currPortInUse && isServerPortFree(currHttp) && isServerPortFree(currHttps)) {
				matchFound = true;
				System.out.println("* Ports are available: "+currHttp+" "+currHttps);
			} else {
				System.out.println("* Ports are not available: "+currHttp+" "+currHttps);
			}
			
			if(!matchFound) {
				currHttp++;
				currHttps++;
			}
		}
		
		if(matchFound) {
			result.put(HTTPS_PORT, currHttps);
			result.put(HTTP_PORT, currHttp);

			return Optional.of(result);
			
		}
		
		return Optional.empty();
		
	}
	
	
	public static List<Integer> getAllReservedPorts(IDCContext context) {
		
		final HashMap<Integer, Boolean> portsInUse = new HashMap<>();
		
		getPortMappingsFromDatabase(context.getGlobalDb()).values().stream().forEach( (PortMapping e) -> {
			
			e.getMap().values().stream().forEach( (Integer reservedPort) -> { portsInUse.put(reservedPort, true); } );
		});
		
		return portsInUse.keySet().stream().sorted().collect(Collectors.toList());
				
		
	}
	
	public static void reservePortsInDatabase(IDCContext context, Map<String, Integer> ports) {
		
		ports.entrySet().stream().forEach( e -> {
			putPortMapping(context, e.getKey(), e.getValue());
		});
		
	}
	
	
	public static boolean isServerPortFree(int port) {
		try {
			ServerSocket s = new ServerSocket(port);
			s.close();
			return true;
		} catch (IOException ex) {
			return false;
		}
	}
	
	public static void removePortMapping(IDCContext context, String portName) {
		context.getGlobalDb().remove(generateKey(context, portName));
	}
	
	private static void putPortMapping(IDCContext context, String portName, int portValue) {
		
		if(portValue > 65535 || portValue < 0) {
			throw new IllegalArgumentException("Invalid port value: "+portValue);
		}
		
		if(!portName.equals(HTTPS_PORT) && !portName.equals(HTTP_PORT)) {
			throw new IllegalArgumentException("Invalid port name");
		}
		
//		String appId = context.getAppId();
//		String appName = context.getAppName(); 
//		
//		String key = "port-mapping-appname("+appName+")-appid("+appId+")-portname("+portName+")";
		
		String key = generateKey(context, portName);
		
		context.getGlobalDb().put(key, ""+portValue);
		
	}
	

	private static String generateKey(IDCContext context, String portName) {
		
		String appName = context.getAppName();
		appName = appName.replace("(", ""); 
		appName = appName.replace(")", ""); 
		
		return "port-mapping-appname("+appName+")-appid("+context.getAppId()+")-portname("+portName+")";
	}

	
	public static Map<String /*app id */, PortMapping> getPortMappingsFromDatabase(DBMap db) {
		
			Map<String, PortMapping> result = new HashMap<>();
		
			Map<String, String> dbValues =  db.getMap();
		
			dbValues.entrySet().stream().filter(e -> e.getKey().startsWith("port-mapping") ).forEach(e -> {
				
				String text = e.getKey();
				String appname = extractField("appname", text);
				String appid = extractField("appid", text);
				String portName = extractField("portname", text);
				
				PortMapping mp = result.get(appid);
				if(mp == null) {
					mp = new PortMapping(appid, appname);
					result.put(appid, mp);
				}
								
				mp.getMap().put(portName, Integer.parseInt(e.getValue()));
				
			});
			
//			System.out.println("current port mappings:");
//			result.entrySet().stream().forEach( e -> {
//				System.out.println(" - " +e.getKey()+" "+e.getValue().getMap());
//			});
			
			return result;
	}

	
	private static String extractField(String key, String text) {
		
		String fieldStart = "-"+key+"(";
		
		int start = text.indexOf(fieldStart);
		int end = text.indexOf(")", start);
		
		if(start == -1 || end == -1) {
			throw new IllegalArgumentException("Unable to extract field '"+key+"' from '"+text+"'");
		}
		
		return text.substring(start+fieldStart.length(), end);
		
	}
	
	public static class PortMapping {
		
		private final Map<String /* port name*/, Integer> map = new HashMap<String, Integer>();
		
		private final String appId;
		private final String appName;
		
		public PortMapping(String appId, String appName) {
			this.appId = appId;
			this.appName = appName;
		}
		
		public Map<String, Integer> getMap() {
			return map;
		}
		
		public String getAppId() {
			return appId;
		}
		
		public String getAppName() {
			return appName;
		}
		
		
	}
}
