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

import java.util.Date;

public class Logger {

	/** Whether to use reflection to print the caller of the logging methods, as part of the 
	 * outputted log statement. 
	 * Example: [IDCContext.loadIDCConfigPropertiesFromFile:262] Configuration file detected:  */
	private static final boolean printCallingMethods = false;
	
    public static boolean isVerbose = false;

	public static void printUsage() {
		System.out.println("Commands:");
		System.out.println();
		printIDCCmd(Constants.OPTION_DEV);
		printIDCCmd(Constants.OPTION_PROD);
		System.out.println();
		printIDCCmd(Constants.OPTION_BUILD);
		printIDCCmd(Constants.OPTION_BUILD + " --clean");
		printIDCCmd(Constants.OPTION_BUILD + " --prod");
		printIDCCmd(Constants.OPTION_CLEAN);
		System.out.println();
		printIDCCmd(Constants.OPTION_START);
		printIDCCmd(Constants.OPTION_TAIL);
		printIDCCmd(Constants.OPTION_STOP);
		System.out.println();
		// System.out.println("idc container-start");
		// System.out.println("idc container-stop");
		printIDCCmd(Constants.OPTION_CONTAINER_REFRESH);
		printIDCCmd(Constants.OPTION_CONTAINER_REMOVE);
		System.out.println();
		printIDCCmd(Constants.OPTION_SYSTEM_CLEANUP);
		printIDCCmd(Constants.OPTION_SHELL);
	}

	private static void printIDCCmd(String cmd){
		System.out.println("idc " + cmd);
	}

	public static void verbose(String msg) {
		if(isVerbose) {
			Date date = new Date();
			System.out.println("[VERBOSE " + date.toString() + "] " + msg);
		}
	}

	public static void info(String msg) {
		String callingMethod = printCallingMethods ? getCallingMethod(Logger.class) : "";
		System.out.println(callingMethod + msg);
	}

	public static void error(String str) {
		String callingMethod = printCallingMethods ? getCallingMethod(Logger.class) : "";
		System.err.println(callingMethod + str);
	}

	public static void error(String str, Exception e) {
		String callingMethod = printCallingMethods ? getCallingMethod(Logger.class) : "";
		System.err.println(callingMethod +  str + "\n" + e.getMessage());
		e.printStackTrace();
	}
	
	
	/** Return the name of the class and method that is calling the logging method. */
	private static String getCallingMethod(Class<?> loggerClass) {
		String loggerClassName = loggerClass.getName();
		try {
			StackTraceElement[] steList = Thread.currentThread().getStackTrace();
			
			// Locate the index of the last STE that contains loggerClass
			int lastIndexOfLoggerClass = -1;
			for(int x = 0; x < steList.length; x++) {
				StackTraceElement ste = steList[x];
				
				if(ste.getClassName() != null && ste.getClassName().equals(loggerClassName)) {
					lastIndexOfLoggerClass = x;
				}
			}

			// Return the class directly _after_ loggerClass in the stack 
			if(lastIndexOfLoggerClass != -1 && lastIndexOfLoggerClass+1 < steList.length) {
				StackTraceElement result = steList[lastIndexOfLoggerClass+1];
				
				String resultClassName = result.getClassName();
				int index = resultClassName.lastIndexOf(".");
				if(index != -1) {
					resultClassName = resultClassName.substring(index+1);
				}
				
				return "["+resultClassName+"."+result.getMethodName()+":"+result.getLineNumber()+"] ";
			}
			
		} catch(Exception e) {
			/* ignore, so that we don't break any calling methods.*/
		}
		
		return "";
	}
	
}