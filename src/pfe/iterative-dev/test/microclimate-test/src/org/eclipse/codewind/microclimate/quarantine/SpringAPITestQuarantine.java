package org.eclipse.codewind.microclimate.quarantine;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertNotNull;
import static org.junit.Assert.assertTrue;
import static org.junit.Assert.fail;
import static org.junit.Assume.assumeTrue;

import java.net.HttpURLConnection;
import java.util.Date;

import javax.json.JsonArray;
import javax.json.JsonObject;

import org.eclipse.codewind.microclimate.apitest.SpringProjectAPITests;
import org.eclipse.codewind.microclimate.test.util.AbstractMicroclimateTest;
import org.eclipse.codewind.microclimate.test.util.HttpResponse;
import org.eclipse.codewind.microclimate.test.util.Logger;
import org.eclipse.codewind.microclimate.test.util.MicroclimateTestUtils;
import org.eclipse.codewind.microclimate.test.util.RetryRule;
import org.eclipse.codewind.microclimate.test.util.MicroclimateTestUtils.PROJECT_TYPES;
import org.eclipse.codewind.microclimate.test.util.MicroclimateTestUtils.SUITE_TYPES;
import org.eclipse.codewind.microclimate.test.util.SocketUtil.SocketEvent;
import org.json.JSONArray;
import org.json.JSONObject;

import org.junit.Before;
import org.junit.FixMethodOrder;
import org.junit.Rule;
import org.junit.Test;
import org.junit.runners.MethodSorters;

@FixMethodOrder(MethodSorters.NAME_ASCENDING)
public class SpringAPITestQuarantine {
	private static String testType = System.getProperty("testType");
	private static PROJECT_TYPES projectType = PROJECT_TYPES.spring;
	
	final String PORT = MicroclimateTestUtils.getPort();
	final String PROTOCOL = MicroclimateTestUtils.getProtocol();
	
	final String PROJECTS_API = MicroclimateTestUtils.getProjectsAPI();
	final String TYPES_API = MicroclimateTestUtils.getTypesAPI();
	final String STATUS_API = MicroclimateTestUtils.getStatusAPI();
	final String ACTION_API = MicroclimateTestUtils.getActionAPI();
	
	private static String lastbuild;
	
	SpringProjectAPITests apiClass = new SpringProjectAPITests();
	private static String exposedPort = SpringProjectAPITests.exposedPort;
	private static String projectName = SpringProjectAPITests.projectName;
	
	@Test(timeout=60000) //60 seconds timeout
	public void TestA001create() {
		apiClass.TestA001create();
	}
	
	@Test(timeout=30000) //30 seconds timeout
	public void TestA002checkForProject() {
		apiClass.TestA002checkForProject();
	}
	
	@Test(timeout=300000) //5 mins timeout
	public void TestA003checkForContainer() {
		apiClass.TestA003checkForContainer();
	}
	
	@Test(timeout=180000) //3 mins timeout
	public void TestA005checkEndpoint() {
		apiClass.TestA005checkEndpoint();
	}
	
	@Test(timeout=300000) //5 mins timeout
	public void TestK001changeContextRoot() {
		try {
			final String projectSettingsChangedEvent = "projectSettingsChanged";
			String[] eventsOfInterest = {projectSettingsChangedEvent};
			String projectID = MicroclimateTestUtils.getProjectID(projectName, testType);
			String SettingsAPI = MicroclimateTestUtils.getSettingsAPI(projectID);
			String urlParameters = "{\"settings\": [{\"name\": \"contextRoot\",\"value\": \"contextspring\"}]}";
			MicroclimateTestUtils.PairedResponse pairedResponse = MicroclimateTestUtils.callAPIBodyParametersWSocketResponse(SettingsAPI, urlParameters, PROTOCOL, PORT, "POST", testType, eventsOfInterest, 300);
			int httpResult = pairedResponse.httpResponse.getResponseCode();
			Logger.println(SpringProjectAPITests.class, "TestK001changeContextRoot()", "HttpResult is: " + httpResult);
			assertEquals(HttpURLConnection.HTTP_ACCEPTED, httpResult);
			
			JsonObject responseBody = pairedResponse.httpResponse.getResponseBodyAsJsonObject();
			assertNotNull(responseBody.getString("operationId"));
			
			assertEquals("Expecting only 1 socket event", 1, pairedResponse.socketEvents.length);
			SocketEvent se = pairedResponse.socketEvents[0];
			Logger.log("Socket msg: " + se.getMsg());
			assertEquals("Unexpected socket event received", projectSettingsChangedEvent, se.getMsg());
			Logger.log("Socket event details: " + se.getDetails().toString());
			
			JSONObject socketResponseBody = se.getDetails();
			assertNotNull(socketResponseBody);
			assertNotNull(socketResponseBody.getString("operationId"));
			assertNotNull(socketResponseBody.getString("projectID"));
			assertEquals(projectID, socketResponseBody.getString("projectID"));
			assertEquals("contextRoot", socketResponseBody.getString("name"));
			assertEquals("/contextspring", socketResponseBody.getString("contextRoot"));
			assertEquals("success", socketResponseBody.getString("status"));
			
			// Wait for the stop project to finish
			long timeout = 60000;
			boolean isStop = MicroclimateTestUtils.waitForProjectStopped(projectID, testType, timeout);
			assertTrue("Project " + projectName + " did not stop within " + timeout + "ms", isStop);

			urlParameters = "{\"settings\": [{\"name\": \"contextRoot\",\"value\": \"/\"}]}";
			pairedResponse = MicroclimateTestUtils.callAPIBodyParametersWSocketResponse(SettingsAPI, urlParameters, PROTOCOL, PORT, "POST", testType, eventsOfInterest, 300);
			httpResult = pairedResponse.httpResponse.getResponseCode();
			Logger.println(SpringProjectAPITests.class, "TestK001changeContextRoot()", "HttpResult is: " + httpResult);
			assertEquals(HttpURLConnection.HTTP_ACCEPTED, httpResult);
			
			// Wait for the start project to finish
			boolean isStart = MicroclimateTestUtils.waitForProjectStarted(projectID, testType, timeout);
			assertTrue("Project " + projectName + " did not start within " + timeout + "ms", isStart);

			exposedPort = MicroclimateTestUtils.getexposedPort(projectName, testType, projectType);
			assertNotNull("exposedPort for project " + projectName +" is null", exposedPort);
			String expectedString = "You are currently running a Spring server";
			String api = "/";

			try {
				while( true ) {
					if ( MicroclimateTestUtils.checkEndpoint(expectedString, exposedPort, api, testType) ) {
						return;
					} else {
						Thread.sleep(3000);
					}
				}
			}
			catch( Exception e ) {
				Logger.println(SpringProjectAPITests.class, "TestK001changeContextRoot()", "Exception occurred when checking for endpoint after setting context root",e);
				fail("Exception occurred when checking for endpoint after setting context root");
			}
		}
		catch( Exception e ) {
			Logger.println(SpringProjectAPITests.class, "TestK001changeContextRoot()", "Exception occurred when setting context root: " + e.getMessage(),e);
			fail("Exception occurred when setting context root");
		}
	}

	@Test(timeout=30000) //30 seconds timeout
	public void TestK002changeContextRootInvalidContextRoot() {
		try {
			final String projectSettingsChangedEvent = "projectSettingsChanged";
			String[] eventsOfInterest = {projectSettingsChangedEvent};
			String projectID = MicroclimateTestUtils.getProjectID(projectName, testType);
			String SettingsAPI = MicroclimateTestUtils.getSettingsAPI(projectID);
			String urlParameters = "{\"settings\": [{\"name\": \"contextRoot\",\"value\": \"<strong>hello</strong><script>alert(/xss/);</script>end\"}]}";
			MicroclimateTestUtils.PairedResponse pairedResponse = MicroclimateTestUtils.callAPIBodyParametersWSocketResponse(SettingsAPI, urlParameters, PROTOCOL, PORT, "POST", testType, eventsOfInterest, 300);
			int httpResult = pairedResponse.httpResponse.getResponseCode();
			Logger.println(SpringProjectAPITests.class, "TestK002changeContextRootInvalidContextRoot()", "HttpResult is: " + httpResult);
			assertEquals(HttpURLConnection.HTTP_ACCEPTED, httpResult);

			JsonObject responseBody = pairedResponse.httpResponse.getResponseBodyAsJsonObject();
			assertNotNull(responseBody.getString("operationId"));
			
			assertEquals("Expecting only 1 socket event", 1, pairedResponse.socketEvents.length);
			SocketEvent se = pairedResponse.socketEvents[0];
			Logger.log("Socket msg: " + se.getMsg());
			assertEquals("Unexpected socket event received", projectSettingsChangedEvent, se.getMsg());
			Logger.log("Socket event details: " + se.getDetails().toString());
			
			JSONObject socketResponseBody = se.getDetails();
			assertNotNull(socketResponseBody);
			assertNotNull(socketResponseBody.getString("operationId"));
			assertNotNull(socketResponseBody.getString("projectID"));
			assertEquals(projectID, socketResponseBody.getString("projectID"));
			assertEquals("failed", socketResponseBody.getString("status"));
			assertEquals("BAD_REQUEST: The context root is not valid", socketResponseBody.getString("error"));
		}
		catch( Exception e ) {
			Logger.println(SpringProjectAPITests.class, "TestK002changeContextRootInvalidContextRoot()", "Exception occurred when setting invlid context root: " + e.getMessage(),e);
			fail("Exception occurred when setting invlid context root");
		}
	}
	
	@Test(timeout=300000) //5 mins timeout
	public void TestK003changeHealthCheck() {
		try {
			final String projectSettingsChangedEvent = "projectSettingsChanged";
			String[] eventsOfInterest = {projectSettingsChangedEvent};
			String projectID = MicroclimateTestUtils.getProjectID(projectName, testType);
			String SettingsAPI = MicroclimateTestUtils.getSettingsAPI(projectID);
			String urlParameters = "{\"settings\": [{\"name\": \"healthCheck\",\"value\": \"healthspring\"}]}";
			MicroclimateTestUtils.PairedResponse pairedResponse = MicroclimateTestUtils.callAPIBodyParametersWSocketResponse(SettingsAPI, urlParameters, PROTOCOL, PORT, "POST", testType, eventsOfInterest, 300);
			int httpResult = pairedResponse.httpResponse.getResponseCode();
			Logger.println(SpringProjectAPITests.class, "TestK003changeHealthCheck()", "HttpResult is: " + httpResult);
			assertEquals(HttpURLConnection.HTTP_ACCEPTED, httpResult);
			
			JsonObject responseBody = pairedResponse.httpResponse.getResponseBodyAsJsonObject();
			assertNotNull(responseBody.getString("operationId"));
			
			assertEquals("Expecting only 1 socket event", 1, pairedResponse.socketEvents.length);
			SocketEvent se = pairedResponse.socketEvents[0];
			Logger.log("Socket msg: " + se.getMsg());
			assertEquals("Unexpected socket event received", projectSettingsChangedEvent, se.getMsg());
			Logger.log("Socket event details: " + se.getDetails().toString());
			
			JSONObject socketResponseBody = se.getDetails();
			assertNotNull(socketResponseBody);
			assertNotNull(socketResponseBody.getString("operationId"));
			assertNotNull(socketResponseBody.getString("projectID"));
			assertEquals(projectID, socketResponseBody.getString("projectID"));
			assertEquals("healthCheck", socketResponseBody.getString("name"));
			assertEquals("/healthspring", socketResponseBody.getString("healthCheck"));
			assertEquals("success", socketResponseBody.getString("status"));

			// Wait for the stop project to finish
			long timeout = 60000;
			boolean isStop = MicroclimateTestUtils.waitForProjectStopped(projectID, testType, timeout);
			assertTrue("Project " + projectName + " did not stop within " + timeout + "ms", isStop);

			urlParameters = "{\"settings\": [{\"name\": \"healthCheck\",\"value\": \"/\"}]}";
			pairedResponse = MicroclimateTestUtils.callAPIBodyParametersWSocketResponse(SettingsAPI, urlParameters, PROTOCOL, PORT, "POST", testType, eventsOfInterest, 300);
			httpResult = pairedResponse.httpResponse.getResponseCode();
			Logger.println(SpringProjectAPITests.class, "TestK003changeHealthCheck()", "HttpResult is: " + httpResult);
			assertEquals(HttpURLConnection.HTTP_ACCEPTED, httpResult);

			// Wait for the start project to finish
			boolean isStart = MicroclimateTestUtils.waitForProjectStarted(projectID, testType, timeout);
			assertTrue("Project " + projectName + " did not start within " + timeout + "ms", isStart);

			exposedPort = MicroclimateTestUtils.getexposedPort(projectName, testType, projectType);
			assertNotNull("exposedPort for project " + projectName +" is null", exposedPort);
			String expectedString = "You are currently running a Spring server";
			String api = "/";

			try {
				while( true ) {
					if ( MicroclimateTestUtils.checkEndpoint(expectedString, exposedPort, api, testType) ) {
						return;
					} else {
						Thread.sleep(3000);
					}
				}
			}
			catch( Exception e ) {
				Logger.println(SpringProjectAPITests.class, "TestK003changeHealthCheck()", "Exception occurred when checking for endpoint after setting context root",e);
				fail("Exception occurred when checking for endpoint after setting context root");
			}
		}
		catch( Exception e ) {
			Logger.println(SpringProjectAPITests.class, "TestK003changeHealthCheck()", "Exception occurred when setting context root: " + e.getMessage(),e);
			fail("Exception occurred when setting context root");
		}
	}

	@Test(timeout=30000) //30 seconds timeout
	public void TestK004changeHealthCheckInvalidHealthCheck() {
		try {
			final String projectSettingsChangedEvent = "projectSettingsChanged";
			String[] eventsOfInterest = {projectSettingsChangedEvent};
			String projectID = MicroclimateTestUtils.getProjectID(projectName, testType);
			String SettingsAPI = MicroclimateTestUtils.getSettingsAPI(projectID);
			String urlParameters = "{\"settings\": [{\"name\": \"healthCheck\",\"value\": \"<strong>hello</strong><script>alert(/xss/);</script>end\"}]}";
			MicroclimateTestUtils.PairedResponse pairedResponse = MicroclimateTestUtils.callAPIBodyParametersWSocketResponse(SettingsAPI, urlParameters, PROTOCOL, PORT, "POST", testType, eventsOfInterest, 300);
			int httpResult = pairedResponse.httpResponse.getResponseCode();
			Logger.println(SpringProjectAPITests.class, "TestK004changeHealthCheckInvalidHealthCheck()", "HttpResult is: " + httpResult);
			assertEquals(HttpURLConnection.HTTP_ACCEPTED, httpResult);

			JsonObject responseBody = pairedResponse.httpResponse.getResponseBodyAsJsonObject();
			assertNotNull(responseBody.getString("operationId"));
			
			assertEquals("Expecting only 1 socket event", 1, pairedResponse.socketEvents.length);
			SocketEvent se = pairedResponse.socketEvents[0];
			Logger.log("Socket msg: " + se.getMsg());
			assertEquals("Unexpected socket event received", projectSettingsChangedEvent, se.getMsg());
			Logger.log("Socket event details: " + se.getDetails().toString());
			
			JSONObject socketResponseBody = se.getDetails();
			assertNotNull(socketResponseBody);
			assertNotNull(socketResponseBody.getString("operationId"));
			assertNotNull(socketResponseBody.getString("projectID"));
			assertEquals(projectID, socketResponseBody.getString("projectID"));
			assertEquals("failed", socketResponseBody.getString("status"));
			assertEquals("BAD_REQUEST: The health check is not valid", socketResponseBody.getString("error"));
		}
		catch( Exception e ) {
			Logger.println(SpringProjectAPITests.class, "TestK004changeHealthCheckInvalidHealthCheck()", "Exception occurred when setting invlid context root: " + e.getMessage(),e);
			fail("Exception occurred when setting invlid context root");
		}
	}
}