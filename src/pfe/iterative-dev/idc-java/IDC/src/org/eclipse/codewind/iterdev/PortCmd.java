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
import java.io.IOException;
import java.io.InputStreamReader;
import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

import org.eclipse.codewind.iterdev.PortMapUtil.PortMapping;
import org.eclipse.codewind.iterdev.tasks.ContainerRunTask;
import org.eclipse.codewind.iterdev.tasks.TaskUtils;

public class PortCmd {

	public static void handleCommand(IDCContext context, String[] args) throws Exception {
		
		Map<String, PortMapping> map = PortMapUtil.getPortMappingsFromDatabase(context.getGlobalDb());
		if(args.length == 1) {
			Logger.error("Missing argument.");
			return;
		} else if(args[1].trim().equalsIgnoreCase("--list")) {
			
			printMappings(map);
			return;
			
		} else if(args[1].trim().equalsIgnoreCase("--remap")) {
			Map<String, Integer> newPorts = new HashMap<>();
			
			printMappings(map);
			
			String userResponse = null;
			while(userResponse == null) {
				System.out.print("Warning: Remapping a port requires destroying and recreating the container, do you wish to continue? (yes/no): ");

				BufferedReader br = new BufferedReader(new InputStreamReader(System.in));
				
				String str = br.readLine().trim().toLowerCase();
				if(!str.equals("yes") && !str.equals("no")) { 
					System.out.println("Please type yes or no.");
					System.out.println();
				} else {
					userResponse = str;
				}
			}
			
			if(userResponse.equalsIgnoreCase("no")) {
				return;
			}
			
			int currHttpPort = map.get(context.getAppId()).getMap().get(PortMapUtil.HTTP_PORT);
			int currHttpsPort = map.get(context.getAppId()).getMap().get(PortMapUtil.HTTPS_PORT);
			
			int userHttpPort = readValidPort(context, "Enter a new HTTP port (currently "+currHttpPort+"), or 0 to autoselect a free port: ");
			int userHttpsPort;
			
			if(userHttpPort == 0) {
				userHttpsPort = 0;
			} else {
				userHttpsPort= readValidPort(context, "Enter a new HTTPS port (currently "+currHttpsPort+"), or 0 to autoselect a free port: ");	
			}
			
			// Both values must be 0
			if( (userHttpPort == 0 && userHttpsPort != 0) && (userHttpsPort == 0  && userHttpPort != 0)  ) {
				Logger.error("Both HTTP and HTTPS port must be auto-selected together. You should specify 0 for both ports.");
				return;
			}
			
			if(userHttpPort == 0) {
				newPorts = PortMapUtil.getPortsForApplication(context).orElseThrow( () -> new IllegalStateException("Unable to acquire free application ports") );
			} else {
				newPorts.put(PortMapUtil.HTTP_PORT, userHttpPort);
				newPorts.put(PortMapUtil.HTTPS_PORT, userHttpsPort);
			}

			System.out.println("* Stopping container "+context.getContainerName());
			
			// stop the old container id
			ProcessRunner pr = TaskUtils.runCmd("docker stop "+context.getContainerName(), context, true);
			if(0 != pr.getErrorCode().orElseThrow( () -> new IllegalStateException()) ) {
				Logger.error("Unable to stop container.");
				return;
			}

			System.out.println("* Removing container "+context.getContainerName());
			
			// delete the old container id
			pr = TaskUtils.runCmd("docker rm  "+context.getContainerName(), context, true);
			if(0 != pr.getErrorCode().orElseThrow( () -> new IllegalStateException()) ) {
				Logger.error("Unable to stop container.");
				return;
			}
			
			System.out.println("* Reserving ports "+userHttpPort+" and "+userHttpsPort);
			
			// Remove old ports from DB
			PortMapUtil.removePortMapping(context, PortMapUtil.HTTP_PORT);
			PortMapUtil.removePortMapping(context, PortMapUtil.HTTPS_PORT);
			PortMapUtil.reservePortsInDatabase(context, newPorts);
			
			
			System.out.println("* Run a new container "+context.getContainerName());
			
			// Call run again

			ContainerRunTask.execute(context);
			
			return;
			
		} else {
			
			Logger.error("Invalid port command");
			return;
			
		}
		
		
	}
	
	private static Integer readValidPort(IDCContext context, String message) throws IOException {
		BufferedReader br = new BufferedReader(new InputStreamReader(System.in));
		
		List<Integer> reservedPorts = PortMapUtil.getAllReservedPorts(context);
		
		Integer result = null;
		while(result == null) {
			System.out.print(message);

			String str = br.readLine().trim().toLowerCase();
			
			int portVal = -1;
			try {
				portVal = Integer.parseInt(str);
			} catch(NumberFormatException nfe) {
			}
			
			if(portVal == 0) {
				result = 0;
				
			} else if(portVal >= 1 && portVal <= 65535) {
				
				if(reservedPorts.contains(portVal)) {
					Logger.error("Port is already reserved: "+portVal);
					
				} else if(!PortMapUtil.isServerPortFree(portVal)) {
					Logger.error("Port is already in use on the system: "+portVal );
				} else {
					result = portVal;
				}
			} else {
				Logger.error("Invalid port: "+portVal);
			}
			
		}
		
		return result;
		
	}
	
	private static void printMappings(Map<String, PortMapping> map) {
		
		System.out.println("Current port mappings for all applications:");
		System.out.println();
		map.values().stream().sorted( new Comparator<PortMapping>() {

			@Override
			public int compare(PortMapping o1, PortMapping o2) {
				int x = o1.getMap().getOrDefault(PortMapUtil.HTTP_PORT, -1);
				int y = o2.getMap().getOrDefault(PortMapUtil.HTTP_PORT, -1);
				return x  - y;
			}
		}).forEach( e -> {
			System.out.println( e.getAppName()+" -> HTTP: "+e.getMap().get(PortMapUtil.HTTP_PORT)+"  HTTPS: "+e.getMap().get(PortMapUtil.HTTPS_PORT));
		});
		System.out.println();
		
		
	}
}
