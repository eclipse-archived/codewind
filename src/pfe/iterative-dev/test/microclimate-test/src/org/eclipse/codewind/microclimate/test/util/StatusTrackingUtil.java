package org.eclipse.codewind.microclimate.test.util;

import static org.junit.Assert.assertTrue;
import static org.junit.Assert.fail;

import java.util.concurrent.TimeUnit;

import org.eclipse.codewind.microclimate.test.util.SocketUtil.SocketEvent;
import org.json.JSONObject;

public class StatusTrackingUtil {
	public static final String APP_STATUS = "appStatus";
	public static final String APP_STATUS_MSG = "appErrorStatus";
	public static final String BUILD_STATUS = "buildStatus";
	public static final String BUILD_STATUS_MSG = "detailedBuildStatus";
	
	public static final String APP_STATUS_STOPPED = "stopped";
	public static final String APP_STATUS_STARTING = "starting";
	public static final String APP_STATUS_STARTED = "started";
	public static final String APP_STATUS_STOPPING = "stopping";
	public static final String APP_STATUS_UNKNOWN = "unknown";
	
	public static final String BUILD_STATE_INPROGRESS = "inProgress";
	public static final String BUILD_STATE_SUCCESS="success";
	public static final String BUILD_STATE_UNKNOWN="unknown";
	public static final String BUILD_STATE_QUEUED="queued";
	public static final String BUILD_STATE_FAILED="failed";
	
	private static SocketUtil cachedsu = null;
	
	private static String testType = System.getProperty("testType");
	
	public static SocketUtil getSocketUtilInstance() {
		try {
			if ( cachedsu == null ) {
				final String projectChangedEvent = "projectStatusChanged";
				String[] eventsOfInterest = {projectChangedEvent};
				cachedsu = SocketUtil.getInstance(eventsOfInterest);
			}
		}
		catch (Exception e) {
			Logger.println(StatusTrackingUtil.class, "getSocketUtilInstance()", "Exception occurred during socket util instantiation: " + e.getMessage(), e);
			fail("Exception occurred during socket util instantiation.");
		}

		return cachedsu;
	}
	
	public static void startStatusTrackingListener( ) {
		cachedsu = null;
		getSocketUtilInstance();
		// Wait for a couple of seconds to ensure listener is up properly
		MicroclimateTestUtils.sleep(2000);
	}
	
	public static void clearStatusEventsRecord(String projectID) {
		getSocketUtilInstance().clearStatusChangedEvents(projectID);
	}
	
	// Check app status transitions for a given project in current record of transitions, for the create scenario
	// timeoutSeconds = max amount of time in seconds to wait to allow for a final status of 'started' to be registered before checking the record
	public static void checkAppStatusTransitionsForCreate(String projectID, long timeoutSeconds) {
		if (testType.equalsIgnoreCase("icp")) 
			return;
		
		String previousStatus = null;
		StatusTrackingUtil.getSocketUtilInstance().waitForStatusChangedEvents(projectID, StatusTrackingUtil.APP_STATUS, timeoutSeconds, true, StatusTrackingUtil.APP_STATUS_STARTED);
		SocketEvent[] se = getSocketUtilInstance().getStatusChangedEvents(projectID);
		
		// Make sure status transitions are correct 
		try { 
			for(int i = 0; i < se.length; i++) {
				JSONObject details = se[i].getDetails();
				if ( details != null && details.has(APP_STATUS) ) {
					String status = details.getString(APP_STATUS);
					String msg = details.has(APP_STATUS_MSG) ? details.getString(APP_STATUS_MSG) : null;
					if (previousStatus == null) {
						checkStatusTransition(previousStatus, status, msg, APP_STATUS_UNKNOWN, APP_STATUS_STOPPED);
					} else if (APP_STATUS_UNKNOWN.equals(previousStatus)) {
						checkStatusTransition(previousStatus, status, msg, APP_STATUS_STOPPED);
					} else if (APP_STATUS_STOPPED.equals(previousStatus)) {
						checkStatusTransition(previousStatus, status, msg, APP_STATUS_STARTING);
					} else if (APP_STATUS_STARTING.equals(previousStatus)) {
						// Since we add detailed app status to socket event for "Starting" state, so it's possible the app
						// state is still "Starting" with detailed app status after "Starting" state
						checkStatusTransition(previousStatus, status, msg, APP_STATUS_STARTING, APP_STATUS_STARTED);
					} else {
						fail("Unexpected application state transition from: " + previousStatus + " to: " + status + " with message: " + msg);
					}
					previousStatus = status;
				}
			}
		}
		catch (Exception e) {
			Logger.println(StatusTrackingUtil.class, "checkAppStatusTransitionsForCreate()", "Exception occurred during project status transition check: " + e.getMessage(), e);
			fail("Exception occurred during project status transition check.");
		}
	}
	
	// Check app status transitions for a given project in current record of transitions, for the update scenario
	// timeoutSeconds = max amount of time in seconds to wait to allow for a final status of 'started' to be registered before checking the record
	public static void checkAppStatusTransitionsForUpdate(String projectID, long timeoutSeconds) {
		if (testType.equalsIgnoreCase("icp")) 
			return;
		
		String previousStatus = null;
		StatusTrackingUtil.getSocketUtilInstance().waitForStatusChangedEvents(projectID, StatusTrackingUtil.APP_STATUS, timeoutSeconds, true, StatusTrackingUtil.APP_STATUS_STARTED);
		SocketEvent[] se = getSocketUtilInstance().getStatusChangedEvents(projectID);
		
		// Make sure status transitions are correct 
		try { 
			for(int i = 0; i < se.length; i++) {
				JSONObject details = se[i].getDetails();
				if ( details != null && details.has(APP_STATUS) ) {
					String status = details.getString(APP_STATUS);
					String msg = details.has(APP_STATUS_MSG) ? details.getString(APP_STATUS_MSG) : null;
					if (previousStatus == null) {
						checkStatusTransition(previousStatus, status, msg, APP_STATUS_STARTED, APP_STATUS_STOPPING);
					} else if (APP_STATUS_STARTED.equals(previousStatus)) {
						checkStatusTransition(previousStatus, status, msg, APP_STATUS_STOPPING);
					} else if (APP_STATUS_STOPPING.equals(previousStatus)) {
						checkStatusTransition(previousStatus, status, msg, APP_STATUS_STOPPED, APP_STATUS_STARTING);
					} else if (APP_STATUS_STOPPED.equals(previousStatus)) {
						checkStatusTransition(previousStatus, status, msg, APP_STATUS_STARTING);
					} else if (APP_STATUS_STARTING.equals(previousStatus)) {
						// Since we add detailed app status to socket event for "Starting" state, so it's possible the app
						// state is still "Starting" with detailed app status after "Starting" state
						checkStatusTransition(previousStatus, status, msg, APP_STATUS_STARTING, APP_STATUS_STARTED);
					} else {
						fail("Unexpected application state transition from: " + previousStatus + " to: " + status + " with message: " + msg);
					}
					previousStatus = status;
				}
			}
		}
		catch (Exception e) {
			Logger.println(StatusTrackingUtil.class, "checkAppStatusTransitionsForUpdate()", "Exception occurred during project status transition check: " + e.getMessage(), e);
			fail("Exception occurred during project status transition check.");
		}
	}
		
	// Check build status transitions for a given project in current record of transitions, for the create scenario
	// timeoutSeconds = max amount of time in seconds to wait to allow for a final status of 'success' to be registered before checking the record
	public static void checkBuildStatusTransitionsForCreate(String projectID, long timeoutSeconds) {
		if (testType.equalsIgnoreCase("icp")) 
			return;
		
		String previousStatus = null;
		StatusTrackingUtil.getSocketUtilInstance().waitForStatusChangedEvents(projectID, StatusTrackingUtil.BUILD_STATUS, timeoutSeconds, true, StatusTrackingUtil.BUILD_STATE_SUCCESS);
		SocketEvent[] se = getSocketUtilInstance().getStatusChangedEvents(projectID);
		
		// Make sure status transitions are correct 
		try { 
			for(int i = 0; i < se.length; i++) {
				JSONObject details = se[i].getDetails();
				if ( details != null && details.has(BUILD_STATUS) ) {
					String status = details.getString(BUILD_STATUS);
					String msg = details.has(BUILD_STATUS_MSG) ? details.getString(BUILD_STATUS_MSG) : null;
					if (previousStatus == null) {
						checkStatusTransition(previousStatus, status, msg, BUILD_STATE_UNKNOWN, BUILD_STATE_QUEUED);
					} else if (BUILD_STATE_UNKNOWN.equals(previousStatus)) {
						checkStatusTransition(previousStatus, status, msg, BUILD_STATE_QUEUED);
					} else if (BUILD_STATE_QUEUED.equals(previousStatus)) {
						checkStatusTransition(previousStatus, status, msg, BUILD_STATE_INPROGRESS);
					} else if (BUILD_STATE_INPROGRESS.equals(previousStatus)) {
						checkStatusTransition(previousStatus, status, msg, BUILD_STATE_INPROGRESS, BUILD_STATE_SUCCESS);
					} else if (BUILD_STATE_SUCCESS.equals(previousStatus)) {
						checkStatusTransition(previousStatus, status, msg, BUILD_STATE_UNKNOWN, BUILD_STATE_QUEUED, BUILD_STATE_INPROGRESS);
					} else {
						fail("Unexpected application state transition from: " + previousStatus + " to: " + status + " with message: " + msg);
					}
					previousStatus = status;
				}
			}
		}
		catch (Exception e) {
			Logger.println(StatusTrackingUtil.class, "checkBuildStatusTransitionsForCreate()", "Exception occurred during project status transition check: " + e.getMessage(), e);
			fail("Exception occurred during project status transition check.");
		}
	}
	
	// Check build status transitions for a given project in current record of transitions, for the update scenario
	// timeoutSeconds = max amount of time in seconds to wait to allow for a final status of 'success' to be registered before checking the record
	public static void checkBuildStatusTransitionsForUpdate(String projectID, long timeoutSeconds) {
		if (testType.equalsIgnoreCase("icp")) 
			return;
		
		String previousStatus = null;
		StatusTrackingUtil.getSocketUtilInstance().waitForStatusChangedEvents(projectID, StatusTrackingUtil.BUILD_STATUS, timeoutSeconds, true, StatusTrackingUtil.BUILD_STATE_SUCCESS);
		SocketEvent[] se = getSocketUtilInstance().getStatusChangedEvents(projectID);
		
		// Make sure status transitions are correct 
		try { 
			for(int i = 0; i < se.length; i++) {
				JSONObject details = se[i].getDetails();
				if ( details != null && details.has(BUILD_STATUS) ) {
					String status = details.getString(BUILD_STATUS);
					String msg = details.has(BUILD_STATUS_MSG) ? details.getString(BUILD_STATUS_MSG) : null;
					if (previousStatus == null) {
						checkStatusTransition(previousStatus, status, msg, BUILD_STATE_SUCCESS, BUILD_STATE_INPROGRESS);
					} else if (BUILD_STATE_SUCCESS.equals(previousStatus)) {
						checkStatusTransition(previousStatus, status, msg, BUILD_STATE_INPROGRESS);
					} else if (BUILD_STATE_INPROGRESS.equals(previousStatus)) {
						checkStatusTransition(previousStatus, status, msg, BUILD_STATE_INPROGRESS, BUILD_STATE_SUCCESS);
					} else {
						fail("Unexpected build state transition from: " + previousStatus + " to: " + status + " with message: " + msg);
					}
					previousStatus = status;
				}
			}
		}
		catch (Exception e) {
			Logger.println(StatusTrackingUtil.class, "checkBuildStatusTransitionsForUpdate()", "Exception occurred during project build status transition check: " + e.getMessage(), e);
			fail("Exception occurred during project build status transition check.");
		}
	}
	
	private static void checkStatusTransition(String previousStatus, String status, String msg, String... expectedStatus) {
		Logger.println(StatusTrackingUtil.class, "checkStatusTransition()", "***** previous status = " + previousStatus + ", next status = " + status + ", msg = " + msg);
		boolean match = false;
		for (String expected : expectedStatus) {
			if (expected.equals(status)) {
				match = true;
				break;
			}
		}
		
		if (!match) {
			Logger.println(StatusTrackingUtil.class, "checkStatusTransition()", "Unexpected status transition from: " + previousStatus + " to: " + status + " with message: " + msg);
		}
		assertTrue("Unexpected status transition from: " + previousStatus + " to: " + status + " with message: " + msg, match);
	}
	
	public static boolean detectAppRestart(String projectID, long timeoutSeconds) {
		// TODO: Consider replacing existing users of detectAppRestart, with detectAppRestartNew, below.
		if (testType.equalsIgnoreCase("icp")) { 
			return true;
		}
		
		if (!getSocketUtilInstance().waitForStatusChangedEvents(projectID, APP_STATUS, timeoutSeconds, true, APP_STATUS_STOPPING, APP_STATUS_STOPPED, APP_STATUS_STARTING)) {
			return false;
		}
		return getSocketUtilInstance().waitForStatusChangedEvents(projectID, APP_STATUS, timeoutSeconds, true, APP_STATUS_STARTED);
	}

	/**
	 * This method detects app restarts by looking for projectStatusChanged events in the following order:
	 * [ projectStatusChanged -> {"projectID":"(projectID)","appStatus":"stopping"} ]
	 * [ projectStatusChanged -> {"projectID":"(projectID)","appStatus":"stopped"} ]
	 * [ projectStatusChanged -> {"projectID":"(projectID)","appStatus":"starting"} ]
	 * [ projectStatusChanged -> {"projectID":"(projectID)","appStatus":"started"} ]
	 * 
	 * You must provide a `eventsBeforeBuildRequest` parameter, which is a list of the projectStatusChanged events
	 * for the project _before_ the build was triggered. This prevents the algorithm from matching on earlier events
	 * that occurred before the application restart.
	 * 
	 * This method is an improvement over the old detectAppRestart(...) method, which would fail to detect a restart 
	 * if the server started too quickly (eg if the started state was seen by waitForstatusChangeEvents(...), before 
	 * the stopping/stopped/starting events were seen.)
	 */
	public static boolean detectAppRestartNew(String projectID, long timeoutSeconds, SocketEvent[] eventsBeforeBuildRequest) {
		if (testType.equalsIgnoreCase("icp")) { 
			return true;
		}
		
		if(eventsBeforeBuildRequest == null) {
			eventsBeforeBuildRequest = new SocketEvent[] {};
		}
		
		long startTimeInNanos = System.nanoTime() + TimeUnit.NANOSECONDS.convert(timeoutSeconds, TimeUnit.SECONDS);
		
		int count = 0;
		while(System.nanoTime() < startTimeInNanos) {
			
			SocketEvent[] currEvents = getSocketUtilInstance().getStatusChangedEvents(projectID);
			
			int eventsInOrderSeen = 0;
			
			for(int x = eventsBeforeBuildRequest.length; x < currEvents.length; x++) {
				
				SocketEvent currEvent = currEvents[x];
				if(currEvent == null || currEvent.getDetails() == null) { continue; }
				
				String val = JSONUtil.getStringOrNull(currEvent.getDetails(), APP_STATUS);
				if(val == null) { continue; }
				
				if(!SocketEvent.compareSocketEventArrays(currEvents, 0, eventsBeforeBuildRequest, 0, eventsBeforeBuildRequest.length)) {
					// This method assumes that all the events in eventsBeforeBuildRequest are contained in currEvents, in the same order.
					// If this is not true this method will fail.
					fail("Invalid assumption - eventsBeforeBuildRequest did not match currEvents prefix.");
				}
				
				if(eventsInOrderSeen == 0 && val.equals(APP_STATUS_STOPPING)) {
					eventsInOrderSeen++;
				} else if(eventsInOrderSeen == 1 && val.equals(APP_STATUS_STOPPED)) {
					eventsInOrderSeen++;
				} if(eventsInOrderSeen == 2 && val.equals(APP_STATUS_STARTING)) {
					eventsInOrderSeen++;
				} if(eventsInOrderSeen == 3 && val.equals(APP_STATUS_STARTED)) {
					eventsInOrderSeen++;
				}
				
			}
			
			if(eventsInOrderSeen == 4) {
				// Return true if we saw stopping, then stopped, then starting, then started.
				return true;
			} else {
				MicroclimateTestUtils.sleep(500);
			}
			
			count++;
			if(count % 10 == 0) {  Logger.log("Waiting for app restart status changed events " + APP_STATUS + "= Stopping/Stopped/Starting/Started for projectId "+MicroclimateTestUtils.shortProjectId(projectID)+"... "); }
		}
		
		return false;
		
	}
	
}
