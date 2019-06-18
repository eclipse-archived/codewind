package org.eclipse.codewind.microclimate.quarantine;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertNotNull;
import static org.junit.Assert.assertTrue;
import static org.junit.Assert.fail;

import java.io.IOException;
import java.net.HttpURLConnection;
import java.net.MalformedURLException;
import java.util.Date;

import javax.json.JsonObject;

import org.eclipse.codewind.microclimate.apitest.NodeJSProjectAPITests;
import org.eclipse.codewind.microclimate.test.util.HttpResponse;
import org.eclipse.codewind.microclimate.test.util.Logger;
import org.eclipse.codewind.microclimate.test.util.MicroclimateTestUtils;
import org.eclipse.codewind.microclimate.test.util.MicroclimateTestUtils.PROJECT_TYPES;
import org.eclipse.codewind.microclimate.test.util.MicroclimateTestUtils.SUITE_TYPES;
import org.eclipse.codewind.microclimate.test.util.SocketUtil.SocketEvent;
import org.json.JSONException;
import org.json.JSONObject;
import org.junit.FixMethodOrder;
import org.junit.Test;
import org.junit.runners.MethodSorters;

@FixMethodOrder(MethodSorters.NAME_ASCENDING)
public class NodeAPITestQuarantine {
	public static String testType = System.getProperty("testType");
	public static PROJECT_TYPES projectType = PROJECT_TYPES.nodejs;
	
	public final String PORT = MicroclimateTestUtils.getPort();
	public final String PROTOCOL = MicroclimateTestUtils.getProtocol();
	
	public static final String PROJECTS_API = MicroclimateTestUtils.getProjectsAPI();
	public static final String TYPES_API = MicroclimateTestUtils.getTypesAPI();
	public static final String STATUS_API = MicroclimateTestUtils.getStatusAPI();
	public static final String ACTION_API = MicroclimateTestUtils.getActionAPI();
	
	public static String lastbuild;
	
	NodeJSProjectAPITests apiClass = new NodeJSProjectAPITests();
	public static String exposedPort = NodeJSProjectAPITests.exposedPort;
	public static String projectName = NodeJSProjectAPITests.projectName;
	
	@Test(timeout=60000) //60 seconds timeout
	public void TestA001create() {
		apiClass.TestA001create();
	}
	
	@Test(timeout=30000) //30 seconds timeout
	public void TestA002checkForProject() throws InterruptedException {
		apiClass.TestA002checkForProject();
	}
	
	@Test(timeout=300000) //5 mins timeout
	public void TestA003checkForContainer() {
		apiClass.TestA003checkForContainer();
	}
		
	@Test(timeout=300000) //5 mins timeout
	public void TestA005checkEndpoint() throws InterruptedException {
		apiClass.TestA005checkEndpoint();
	}
	
	@Test(timeout=180000) //3 minutes timeout
	public void TestB001buildAndRun() throws MalformedURLException, JSONException, IOException {
		apiClass.TestB001buildAndRun();
	}
	
	@Test(timeout=180000) //3 minutes timeout
	public void TestB002buildAndRunStartModeRun() throws MalformedURLException, IOException, JSONException {
		apiClass.TestB002buildAndRunStartModeRun();
	}
	
	@Test(timeout=30000) //30 seconds timeout
	public void TestC001getProjectTypes() throws IOException {
		apiClass.TestC001getProjectTypes();
	}
	
	@Test(timeout=30000) //30 seconds timeout
	public void TestD001getProjectLogs() throws IOException {
		apiClass.TestD001getProjectLogs();
	}
	
	@Test(timeout=30000) //30 seconds timeout
	public void TestF001actionDisableAutobuild() throws MalformedURLException, IOException {
		apiClass.TestF001actionDisableAutobuild();
	}
	
	@Test(timeout=30000) //30 seconds timeout
	public void TestF002actionEnableAutobuild() throws MalformedURLException, IOException {
		apiClass.TestF002actionEnableAutobuild();
	}
	
	@Test(timeout=180000) //3 minutes timeout
	public void TestG001actionBuild() throws MalformedURLException, IOException, JSONException {
		apiClass.TestG001actionBuild();
	}
	
	@Test(timeout=60000) //1 min timeout
	public void TestG002checkLastbuildTimestamp() throws JSONException {
		apiClass.TestG002checkLastbuildTimestamp();
	}
	
	@Test(timeout=60000) //60 seconds timeout
	public void TestG003actionBuildInvalidProjectType() throws MalformedURLException, IOException {
		apiClass.TestG003actionBuildInvalidProjectType();
	}
	
	@Test(timeout=30000) //30 seconds timeout
	public void TestH001getProjectStatusApp() throws IOException {
		apiClass.TestH001getProjectStatusApp();
	}
	
	@Test(timeout=30000) //30 seconds timeout
	public void TestH002getProjectStatusBuild() throws IOException {
		apiClass.TestH002getProjectStatusBuild();
	}
	
	@Test(timeout=30000) //30 seconds timeout
	public void TestI001getProjectCapabilities() throws IOException {
		apiClass.TestI001getProjectCapabilities();
	}
	
	@Test(timeout=300000) //5 mins timeout
	public void TestK001changeContextRoot() {
		try {
			final String projectSettingsChangedEvent = "projectSettingsChanged";
			String[] eventsOfInterest = {projectSettingsChangedEvent};
			String projectID = MicroclimateTestUtils.getProjectID(projectName, testType);
			String SettingsAPI = MicroclimateTestUtils.getSettingsAPI(projectID);
			String urlParameters = "{\"settings\": [{\"name\": \"contextRoot\",\"value\": \"contextnode\"}]}";
			MicroclimateTestUtils.PairedResponse pairedResponse = MicroclimateTestUtils.callAPIBodyParametersWSocketResponse(SettingsAPI, urlParameters, PROTOCOL, PORT, "POST", testType, eventsOfInterest, 300);
			int httpResult = pairedResponse.httpResponse.getResponseCode();
			Logger.println(NodeJSProjectAPITests.class, "TestK001changeContextRoot()", "HttpResult is: " + httpResult);
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
			assertEquals("/contextnode", socketResponseBody.getString("contextRoot"));
			assertEquals("success", socketResponseBody.getString("status"));

			urlParameters = "{\"settings\": [{\"name\": \"contextRoot\",\"value\": \"/\"}]}";
			pairedResponse = MicroclimateTestUtils.callAPIBodyParametersWSocketResponse(SettingsAPI, urlParameters, PROTOCOL, PORT, "POST", testType, eventsOfInterest, 300);
			httpResult = pairedResponse.httpResponse.getResponseCode();
			Logger.println(NodeJSProjectAPITests.class, "TestK001changeContextRoot()", "HttpResult is: " + httpResult);
			assertEquals(HttpURLConnection.HTTP_ACCEPTED, httpResult);
			
			// Wait for the start project to finish
			long timeout = 60000;
			boolean isStart = MicroclimateTestUtils.waitForProjectStarted(projectID, testType, timeout);
			assertTrue("Project " + projectName + " did not start within " + timeout + "ms", isStart);

			exposedPort = MicroclimateTestUtils.getexposedPort(projectName, testType, projectType);
			assertNotNull("exposedPort for project " + projectName +" is null", exposedPort);
			String expectedString = "Congratulations";
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
				Logger.println(NodeJSProjectAPITests.class, "TestK001changeContextRoot()", "Exception occurred when checking for endpoint after setting context root",e);
				fail("Exception occurred when checking for endpoint after setting context root");
			}
		}
		catch( Exception e ) {
			Logger.println(NodeJSProjectAPITests.class, "TestK001changeContextRoot()", "Exception occurred when setting context root: " + e.getMessage(),e);
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
			Logger.println(NodeJSProjectAPITests.class, "TestK002changeContextRootInvalidContextRoot()", "HttpResult is: " + httpResult);
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
			Logger.println(NodeJSProjectAPITests.class, "TestK002changeContextRootInvalidContextRoot()", "Exception occurred when setting invlid context root: " + e.getMessage(),e);
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
			String urlParameters = "{\"settings\": [{\"name\": \"healthCheck\",\"value\": \"healthnode\"}]}";
			MicroclimateTestUtils.PairedResponse pairedResponse = MicroclimateTestUtils.callAPIBodyParametersWSocketResponse(SettingsAPI, urlParameters, PROTOCOL, PORT, "POST", testType, eventsOfInterest, 300);
			int httpResult = pairedResponse.httpResponse.getResponseCode();
			Logger.println(NodeJSProjectAPITests.class, "TestK003changeHealthCheck()", "HttpResult is: " + httpResult);
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
			assertEquals("/healthnode", socketResponseBody.getString("healthCheck"));
			assertEquals("success", socketResponseBody.getString("status"));

			urlParameters = "{\"settings\": [{\"name\": \"healthCheck\",\"value\": \"/\"}]}";
			pairedResponse = MicroclimateTestUtils.callAPIBodyParametersWSocketResponse(SettingsAPI, urlParameters, PROTOCOL, PORT, "POST", testType, eventsOfInterest, 300);
			httpResult = pairedResponse.httpResponse.getResponseCode();
			Logger.println(NodeJSProjectAPITests.class, "TestK003changeHealthCheck()", "HttpResult is: " + httpResult);
			assertEquals(HttpURLConnection.HTTP_ACCEPTED, httpResult);

			// Wait for the start project to finish
			long timeout = 60000;
			boolean isStart = MicroclimateTestUtils.waitForProjectStarted(projectID, testType, timeout);
			assertTrue("Project " + projectName + " did not start within " + timeout + "ms", isStart);

			exposedPort = MicroclimateTestUtils.getexposedPort(projectName, testType, projectType);
			assertNotNull("exposedPort for project " + projectName +" is null", exposedPort);
			String expectedString = "Congratulations";
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
				Logger.println(NodeJSProjectAPITests.class, "TestK003changeHealthCheck()", "Exception occurred when checking for endpoint after setting context root",e);
				fail("Exception occurred when checking for endpoint after setting context root");
			}
		}
		catch( Exception e ) {
			Logger.println(NodeJSProjectAPITests.class, "TestK003changeHealthCheck()", "Exception occurred when setting context root: " + e.getMessage(),e);
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
			Logger.println(NodeJSProjectAPITests.class, "TestK004changeHealthCheckInvalidHealthCheck()", "HttpResult is: " + httpResult);
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
			Logger.println(NodeJSProjectAPITests.class, "TestK004changeHealthCheckInvalidHealthCheck()", "Exception occurred when setting invlid context root: " + e.getMessage(),e);
			fail("Exception occurred when setting invlid context root");
		}
	}
	
	@Test(timeout=30000) //30 seconds timeout
	public void TestY001actionValidate() throws MalformedURLException, IOException, JSONException {
		apiClass.TestY001actionValidate();
	}
	
	@Test(timeout=30000) //30 seconds timeout
	public void TestY002actionValidateMissingPackageJSON() throws Exception {
		apiClass.TestY002actionValidateMissingPackageJSON();
	}
	
	@Test(timeout=300000) //5 mins timeout
	public void TestZ002projectDelete() throws IOException, JSONException {
		apiClass.TestZ002projectDelete();
	}
	
	

}
