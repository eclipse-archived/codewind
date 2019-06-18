package org.eclipse.codewind.microclimate.test.util;


import java.text.SimpleDateFormat;
import java.util.Arrays;
import java.util.Date;
import java.util.List;

/**
 * Logger class for tracing server tools code
 */
public final class Logger {

	private static final SimpleDateFormat PRETTY_DATE_FORMAT = new SimpleDateFormat("MMM d h:mm:ss.SSS a");

	public static String testType = System.getProperty("testType");
	
	/**
	 * Trace a specific message. Remember to always wrap this call in an if statement and check for the corresponding
	 * enablement flag.
	 *
	 * @param level
	 *            The tracing level.
	 * @param curClass
	 *            The class being traced.
	 * @param methodName
	 *            The method being traced.
	 * @param msgStr
	 *            The trace string
	 */
	public final static void println(Class curClass, final String methodName, final String msgStr) {

		Logger.print(curClass, methodName, msgStr, null);
	}

	/**
	 * Trace a specific message and {@link Throwable}. Remember to always wrap this call in an if statement and check
	 * for the corresponding enablement flag.
	 *
	 * @param level
	 *            The tracing level.
	 * @param curClass
	 *            The class being traced.
	 * @param methodName
	 *            The method being traced.
	 * @param msgStr
	 *            The trace string
	 * @param t
	 *            The {@link Throwable} to print as part of the tracing.
	 */
	public final static void println(Class curClass, final String methodName, final String msgStr,
			final Throwable t) {

		Logger.print(curClass, methodName, msgStr, t);
	}

	/**
	 * Trace a specific message. Remember to always wrap this call in an if statement and check for the corresponding
	 * enablement flag.
	 *
	 * @param level
	 *            The tracing level.
	 * @param obj
	 *            The {@link Object} being traced.
	 * @param methodName
	 *            The method being traced.
	 * @param msgStr
	 *            The trace string
	 */
	public final static void println(final Object obj, final String methodName, final String msgStr) {

		Class<?> objClass = (obj != null) ? obj.getClass() : null;
		Logger.print(objClass, methodName, msgStr, null);
	}

	/**
	 * Trace a specific message and {@link Throwable}. Remember to always wrap this call in an if statement and check
	 * for the corresponding enablement flag.
	 *
	 * @param level
	 *            The tracing level.
	 * @param obj
	 *            The {@link Object} being traced.
	 * @param methodName
	 *            The method being traced.
	 * @param msgStr
	 *            The trace string
	 * @param t
	 *            The {@link Throwable} to print as part of the tracing.
	 */
	public final static void println(final Object obj, final String methodName,
			final String msgStr, final Throwable t) {

		Class<?> objClass = (obj != null) ? obj.getClass() : null;
		Logger.print(objClass, methodName, msgStr, t);
	}

	
	private final static void print(final Class<?> clazz, final String methodName,
			final String msgStr, final Throwable t) {

		final StringBuffer printStrBuf = new StringBuffer();
		printStrBuf.append("[");
		String type = (t != null) ? "ERROR" : "";
		if(!type.isEmpty()) {
			printStrBuf.append(type+" ");
		}
		
		printStrBuf.append(PRETTY_DATE_FORMAT.format(new Date()));
		printStrBuf.append("] "); //$NON-NLS-1$

		if (clazz != null) {
			printStrBuf.append(clazz.getSimpleName());
		}
		if (methodName != null) {
			printStrBuf.append("."); //$NON-NLS-1$
			printStrBuf.append(methodName);
			printStrBuf.append(": "); //$NON-NLS-1$
		}
		if (msgStr != null) {
			printStrBuf.append(msgStr);
		}

		// write the output to the System.out stream
		System.out.println(printStrBuf.toString());
		if (t != null) {
			System.out.print(t);
			t.printStackTrace(System.out);
		}
	}

	// If you rename any of the methods below, also update the method names to look for in writeLog
	public static void log(String msg) {
		writeLog(msg, false, null);
	}

	public static void log() {
		writeLog("", false, null);
	}

	public static void logError(String msg) {
		writeLog(msg, true, null);
	}

	public static void logError(Throwable t) {
		logError("Exception occurred:", t); //$NON-NLS-1$
	}

	public static void logError(String msg, Throwable t) {
		writeLog(msg, true, t);
	}

	/**
	 * Log the given message to stdout.
	 * The message is prepended with a timestamp, as well as the caller's class name, method name, and line number.
	 */
	private static void writeLog(String msg, boolean isError, Throwable t) {
		List<String> methodsToIgnore = Arrays.asList(new String[] { "writeLog", "log", "logError" });

		StackTraceElement[] ste = Thread.currentThread().getStackTrace();
		StackTraceElement callingMethod = null;
		for (int x = 0; x < ste.length; x++) {
			if (ste[x].getMethodName().equals("writeLog")) { //$NON-NLS-1$
				callingMethod = ste[x++];
				// Skip over logging methods, we want to print their callers.
				while (methodsToIgnore.contains(callingMethod.getMethodName())) {
					callingMethod = ste[x++];
				}
				break;
			}
		}

		String time = PRETTY_DATE_FORMAT.format(new Date());

		String callerInfo = "unknown"; //$NON-NLS-1$

		if (callingMethod != null) {
			String className = callingMethod.getClassName();
			String simpleClassName = className.substring(className.lastIndexOf('.') + 1);

			callerInfo = String.format("%s.%s():%s", //$NON-NLS-1$
					simpleClassName, callingMethod.getMethodName(), callingMethod.getLineNumber());
		}

		String type = isError ? "ERROR " : ""; 
		String fullMessage = String.format("[%s%s] %s %s:", type, time, callerInfo, msg);

		System.out.println(fullMessage);
		if (t != null) {
			t.printStackTrace(System.out);
		}
	}
	
	public static void logToFileWatcherINFOLogs(String msg) {
		logToFWLogs(msg, "info");
	}
	
	public static void logToFileWatcherERRORLogs(String msg) {
		logToFWLogs(msg, "error");
	}
	
	private static void logToFWLogs(String msg, String level) {
		String body = "{\"msg\": \"" + msg + "\", \"level\": \"" + level + "\"}";
		try {
			MicroclimateTestUtils.callAPIBodyParameters(MicroclimateTestUtils.getFWInternalLogAPI(), body, MicroclimateTestUtils.getProtocol(), MicroclimateTestUtils.getPort(), "POST", testType);
			log("Added the following message to FW logs: [" + level + "] " + msg);
		} catch (Exception e) {
			writeLog("Failed to send log message to filewatcher", true, e);
		}
	}
}
