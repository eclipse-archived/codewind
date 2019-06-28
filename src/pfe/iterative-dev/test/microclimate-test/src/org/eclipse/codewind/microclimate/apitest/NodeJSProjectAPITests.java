package org.eclipse.codewind.microclimate.apitest;

import static org.eclipse.codewind.microclimate.test.util.JUnitUtil.assertEqualsWithResponse;
import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertNotNull;
import static org.junit.Assert.assertTrue;
import static org.junit.Assert.fail;
import static org.junit.Assume.assumeTrue;

import java.io.IOException;
import java.net.HttpURLConnection;
import java.net.MalformedURLException;
import java.util.Date;

import javax.json.JsonArray;
import javax.json.JsonObject;

import org.eclipse.codewind.microclimate.test.util.AbstractMicroclimateTest;
import org.eclipse.codewind.microclimate.test.util.HttpResponse;
import org.eclipse.codewind.microclimate.test.util.Logger;
import org.eclipse.codewind.microclimate.test.util.MicroclimateTestUtils;
import org.eclipse.codewind.microclimate.test.util.RetryRule;
import org.eclipse.codewind.microclimate.test.util.MicroclimateTestUtils.PROJECT_TYPES;
import org.eclipse.codewind.microclimate.test.util.MicroclimateTestUtils.SUITE_TYPES;
import org.eclipse.codewind.microclimate.test.util.SocketUtil.SocketEvent;
import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;
import org.junit.Before;
import org.junit.FixMethodOrder;
import org.junit.Rule;
import org.junit.Test;
import org.junit.runners.MethodSorters;

@FixMethodOrder(MethodSorters.NAME_ASCENDING)
public class NodeJSProjectAPITests extends AbstractMicroclimateTest {

	public static String exposedPort;
	public static String projectName = "nodejs" + SUITE_TYPES.apitest + (new Date().getTime());
	public static String testType = System.getProperty("testType");
	public static PROJECT_TYPES projectType = PROJECT_TYPES.nodejs;

	public final String PORT = MicroclimateTestUtils.getPort();
	public final String PROTOCOL = MicroclimateTestUtils.getProtocol();

	public static final String PROJECTS_API = MicroclimateTestUtils.getProjectsAPI();
	public static final String TYPES_API = MicroclimateTestUtils.getTypesAPI();
	public static final String STATUS_API = MicroclimateTestUtils.getStatusAPI();
	public static final String ACTION_API = MicroclimateTestUtils.getActionAPI();

	public static String lastbuild;

    @Rule
    public RetryRule retry = new RetryRule(MicroclimateTestUtils.retryCount);

	@Before
	public void checkTestType() {
		assumeTrue("-DtestType parameter must be set", "local".equalsIgnoreCase(testType));
	}

	@Test(timeout=120000) //120 seconds timeout
	public void TestA001create() {

		String urlParameters  ="{\"name\": \"" + projectName + "\",\"language\": \"nodejs\"}";

		int httpResult = MicroclimateTestUtils.projectCreation(urlParameters, testType);
		Logger.println(NodeJSProjectAPITests.class, "TestA001create()", "HttpResult is: " + httpResult);
		assertEquals(HttpURLConnection.HTTP_ACCEPTED, httpResult);
	}

	@Test(timeout=60000) //30 seconds timeout
	public void TestA002checkForProject() throws InterruptedException {
		while ( true ) {
			if (MicroclimateTestUtils.checkProjectExistency(projectName, testType)) {
				return;
			} else {
				Thread.sleep(3000);
			}
		}
	}

	@Test(timeout=300000) //5 mins timeout
	public void TestA003checkForContainer() {
		exposedPort = MicroclimateTestUtils.getexposedPort(projectName, testType, projectType);
		Logger.println(NodeJSProjectAPITests.class, "TestA003checkForContainer()", "Exposed Port is " + exposedPort);
		assertNotNull("exposedPort for project " + projectName +" is null", exposedPort);
	}

	@Test(timeout=300000) //5 mins timeout
	public void TestA005checkEndpoint() throws InterruptedException {
		assertNotNull("exposedPort for project " + projectName +" is null", exposedPort);
		String expectedString = "Congratulations";
		String api = "/";

		while (true) {
			if (MicroclimateTestUtils.checkEndpoint(expectedString, exposedPort, api, testType))
				return;
			else
				Thread.sleep(3000);
		}
	}

	@Test(timeout=180000) //3 minutes timeout
	public void TestB001buildAndRun() throws JSONException, MalformedURLException, IOException {
		final String projectCreationEvent = "projectCreation";

		String projectID = MicroclimateTestUtils.getProjectID(projectName, testType);
		String urlParameters = "{\"projectID\": \"" + projectID + "\",\"projectType\": \"nodejs\",\"location\": \"/codewind-workspace/" + projectName + "\"}";
		String[] eventsOfInterest = {projectCreationEvent};
		MicroclimateTestUtils.PairedResponse pairedResponse = MicroclimateTestUtils.callAPIBodyParametersWSocketResponse(PROJECTS_API, urlParameters, PROTOCOL, PORT, "POST", testType, eventsOfInterest, 180);
		int httpResult = pairedResponse.httpResponse.getResponseCode();

		Logger.println(NodeJSProjectAPITests.class, "TestB001buildAndRun()", "HttpResult is: " + httpResult);

		assertEqualsWithResponse(HttpURLConnection.HTTP_ACCEPTED, httpResult, pairedResponse.httpResponse);

		JsonObject responseBody = pairedResponse.httpResponse.getResponseBodyAsJsonObject();
		assertNotNull(responseBody.getString("operationId"));

		assertEquals("Expecting only 1 socket event", 1, pairedResponse.socketEvents.length);
		SocketEvent se = pairedResponse.socketEvents[0];
		Logger.println(NodeJSProjectAPITests.class, "TestB001buildAndRun()", "Socket msg: " + se.getMsg());
		assertEquals("Unexpected socket event received", projectCreationEvent, se.getMsg());
		Logger.println(NodeJSProjectAPITests.class, "TestB001buildAndRun()", "Socket event details: " + se.getDetails().toString());

		JSONObject socketResponseBody = se.getDetails();
		assertNotNull(socketResponseBody);
		assertNotNull(socketResponseBody.getString("operationId"));
		assertNotNull(socketResponseBody.getString("projectID"));
		assertEquals(projectID, socketResponseBody.getString("projectID"));
		assertNotNull(socketResponseBody.getString("host"));
		assertNotNull(socketResponseBody.getJSONObject("ports"));
		assertNotNull(socketResponseBody.getJSONObject("ports").getString("exposedPort"));
		assertNotNull(socketResponseBody.getJSONObject("ports").getString("internalPort"));
		assertEquals("success", socketResponseBody.getString("status"));
		assertNotNull(socketResponseBody.getJSONObject("logs"));
	}

	@Test(timeout=180000) //3 minutes timeout
	public void TestB002buildAndRunStartModeRun() throws MalformedURLException, IOException, JSONException {
		final String projectCreationEvent = "projectCreation";

		String projectID = MicroclimateTestUtils.getProjectID(projectName, testType);
		String urlParameters = "{\"projectID\": \"" + projectID + "\",\"projectType\": \"nodejs\",\"location\": \"/codewind-workspace/" + projectName + "\",\"startMode\": \"run\"}";
		String[] eventsOfInterest = {projectCreationEvent};
		MicroclimateTestUtils.PairedResponse pairedResponse = MicroclimateTestUtils.callAPIBodyParametersWSocketResponse(PROJECTS_API, urlParameters, PROTOCOL, PORT, "POST", testType, eventsOfInterest, 150);
		int httpResult = pairedResponse.httpResponse.getResponseCode();

		Logger.println(NodeJSProjectAPITests.class, "TestB002buildAndRunStartModeRun()", "HttpResult is: " + httpResult);

		assertEqualsWithResponse(HttpURLConnection.HTTP_ACCEPTED, httpResult, pairedResponse.httpResponse);

		JsonObject responseBody = pairedResponse.httpResponse.getResponseBodyAsJsonObject();
		assertNotNull(responseBody.getString("operationId"));

		assertEquals("Expecting only 1 socket event", 1, pairedResponse.socketEvents.length);
		SocketEvent se = pairedResponse.socketEvents[0];
		Logger.println(NodeJSProjectAPITests.class, "TestB002buildAndRunStartModeRun()", "Socket msg: " + se.getMsg());
		assertEquals("Unexpected socket event received", projectCreationEvent, se.getMsg());
		Logger.println(NodeJSProjectAPITests.class, "TestB002buildAndRunStartModeRun()", "Socket event details: " + se.getDetails().toString());

		JSONObject socketResponseBody = se.getDetails();
		assertNotNull(socketResponseBody);
		assertNotNull(socketResponseBody.getString("operationId"));
		assertNotNull(socketResponseBody.getString("projectID"));
		assertEquals(projectID, socketResponseBody.getString("projectID"));
		assertNotNull(socketResponseBody.getString("host"));
		assertNotNull(socketResponseBody.getJSONObject("ports"));
		assertNotNull(socketResponseBody.getJSONObject("ports").getString("exposedPort"));
		assertNotNull(socketResponseBody.getJSONObject("ports").getString("internalPort"));
		assertTrue(!socketResponseBody.getJSONObject("ports").has("exposedDebugPort"));
		assertTrue(!socketResponseBody.getJSONObject("ports").has("internalDebugPort"));
		assertEquals("success", socketResponseBody.getString("status"));
		assertNotNull(socketResponseBody.getJSONObject("logs"));
	}

	@Test(timeout=30000) //30 seconds timeout
	public void TestC001getProjectTypes() throws IOException {
		String api = TYPES_API + "?location=/codewind-workspace/" + projectName;
		String url = MicroclimateTestUtils.getBaseURL(testType, PORT, PROTOCOL) + api;

		HttpResponse httpResponse = MicroclimateTestUtils.callAPIURLParameters(url, "GET", testType);
		int httpResult = httpResponse.getResponseCode();

		Logger.println(NodeJSProjectAPITests.class, "TestC001getProjectTypes()", "HttpResult is: " + httpResult);
		assertEqualsWithResponse(HttpURLConnection.HTTP_OK, httpResult, httpResponse);

		JsonObject jsonObject = httpResponse.getResponseBodyAsJsonObject();
		assertEquals("nodejs", jsonObject.getJsonArray("types").getString(0));
	}

	@Test(timeout=30000) //30 seconds timeout
	public void TestD001getProjectLogs() throws IOException {
		String projectID = MicroclimateTestUtils.getProjectID(projectName, testType);
		String api = PROJECTS_API + projectID + "/logs";
		String url = MicroclimateTestUtils.getBaseURL(testType, PORT, PROTOCOL) + api;

		HttpResponse httpResponse = MicroclimateTestUtils.callAPIURLParameters(url, "GET", testType);
		int httpResult = httpResponse.getResponseCode();

		Logger.println(NodeJSProjectAPITests.class, "TestD001getProjectLogs()", "HttpResult is: " + httpResult);
		assertEqualsWithResponse(HttpURLConnection.HTTP_OK, httpResult, httpResponse);

	    JsonObject jsonObject = httpResponse.getResponseBodyAsJsonObject();
	    assertNotNull(jsonObject);
	}

	@Test(timeout=30000) //30 seconds timeout
	public void TestF001actionDisableAutobuild() throws MalformedURLException, IOException {
		String projectID = MicroclimateTestUtils.getProjectID(projectName, testType);
		String urlParameters = "{\"action\": \"disableautobuild\",\"projectID\": \"" + projectID + "\"}";
		HttpResponse httpResponse = MicroclimateTestUtils.callAPIBodyParameters(ACTION_API, urlParameters, PROTOCOL, PORT, "POST", testType);
		int httpResult = httpResponse.getResponseCode();

		Logger.println(NodeJSProjectAPITests.class, "TestF001actionDisableAutobuild()", "HttpResult is: " + httpResult);
		assertEqualsWithResponse(HttpURLConnection.HTTP_OK, httpResult, httpResponse);

		JsonObject responseBody = httpResponse.getResponseBodyAsJsonObject();
		assertEquals("success", responseBody.getString("status"));
	}

	@Test(timeout=30000) //30 seconds timeout
	public void TestF002actionEnableAutobuild() throws MalformedURLException, IOException {
		String projectID = MicroclimateTestUtils.getProjectID(projectName, testType);
		String urlParameters = "{\"action\": \"enableautobuild\",\"projectID\": \"" + projectID + "\"}";
		HttpResponse httpResponse = MicroclimateTestUtils.callAPIBodyParameters(ACTION_API, urlParameters, PROTOCOL, PORT, "POST", testType);
		int httpResult = httpResponse.getResponseCode();

		Logger.println(NodeJSProjectAPITests.class, "TestF002actionEnableAutobuild()", "HttpResult is: " + httpResult);
		assertEqualsWithResponse(HttpURLConnection.HTTP_ACCEPTED, httpResult, httpResponse);

		JsonObject responseBody = httpResponse.getResponseBodyAsJsonObject();
		assertEquals("success", responseBody.getString("status"));
	}

	@Test(timeout=180000) //3 minutes timeout
	public void TestG001actionBuild() throws MalformedURLException, IOException, JSONException {
		final String projectChangedEvent = "projectChanged";
		final String projectStatusChangedEvent = "projectStatusChanged";

		String projectID = MicroclimateTestUtils.getProjectID(projectName, testType);
		String urlParameters = "{\"action\": \"build\",\"projectType\": \"nodejs\", \"projectID\": \"" + projectID + "\"}";
		String[] eventsOfInterest = {projectChangedEvent,projectStatusChangedEvent};
		MicroclimateTestUtils.PairedResponse pairedResponse = MicroclimateTestUtils.callAPIBodyParametersWSocketResponse(ACTION_API, urlParameters, PROTOCOL, PORT, "POST", testType, eventsOfInterest, 180);
		int httpResult = pairedResponse.httpResponse.getResponseCode();

		Logger.println(NodeJSProjectAPITests.class, "TestG001actionBuild()", "HttpResult is: " + httpResult);
		assertEqualsWithResponse(HttpURLConnection.HTTP_ACCEPTED, httpResult, pairedResponse.httpResponse);

		JsonObject responseBody = pairedResponse.httpResponse.getResponseBodyAsJsonObject();
		assertNotNull(responseBody.getString("operationId"));

		assertEquals("Expecting only 1 socket event", 1, pairedResponse.socketEvents.length);
		SocketEvent se = pairedResponse.socketEvents[0];
		Logger.println(NodeJSProjectAPITests.class, "TestG001actionBuild()", "Socket msg: " + se.getMsg());
		assertEquals("Unexpected socket event received", projectChangedEvent, se.getMsg());
		Logger.println(NodeJSProjectAPITests.class, "TestG001actionBuild()", "Socket event details: " + se.getDetails().toString());

		JSONObject socketResponseBody = se.getDetails();
		assertNotNull(socketResponseBody);
		assertEquals(projectID, socketResponseBody.getString("projectID"));
		assertEquals("success", socketResponseBody.getString("status"));
	}

	@Test(timeout=60000) //1 min timeout
	public void TestG002checkLastbuildTimestamp() throws JSONException {
		String projectID = MicroclimateTestUtils.getProjectID(projectName, testType);
		SocketEvent[] statusChangedEvent = MicroclimateTestUtils.getProjectStatusChangedEvents(projectID);
		for(SocketEvent event : statusChangedEvent) {
			JSONObject socketResponseBody = event.getDetails();
			assertNotNull(socketResponseBody);
			assertEquals(projectID, socketResponseBody.getString("projectID"));
			if(socketResponseBody.has("buildStatus") && (socketResponseBody.getString("buildStatus").equals("success") || socketResponseBody.getString("buildStatus").equals("failed"))) {
				assertNotNull(socketResponseBody.getString("lastbuild"));
				lastbuild = socketResponseBody.getString("lastbuild");
				Logger.println(NodeJSProjectAPITests.class, "TestG002checkLastbuildTimestamp()", "lastbuild timestamp is: " + lastbuild);
				break;
			}
		}
	}

	@Test(timeout=60000) //60 seconds timeout
	public void TestG003actionBuildInvalidProjectType() throws MalformedURLException, IOException {
		String urlParameters = "{\"action\": \"build\",\"projectType\": \"liberty\", \"projectID\": \"" + projectName + "\"}";
		HttpResponse httpResponse = MicroclimateTestUtils.callAPIBodyParameters(ACTION_API, urlParameters, PROTOCOL, PORT, "POST", testType);
		int httpResult = httpResponse.getResponseCode();

		Logger.println(NodeJSProjectAPITests.class, "TestG003actionBuildInvalidProjectType()", "HttpResult is: " + httpResult);
		assertEqualsWithResponse(HttpURLConnection.HTTP_INTERNAL_ERROR, httpResult, httpResponse);
	}

	@Test(timeout=30000) //30 seconds timeout
	public void TestH001getProjectStatusApp() throws IOException {
		String projectID = MicroclimateTestUtils.getProjectID(projectName, testType);
		String api = STATUS_API + "?type=appState&projectID=" + projectID;
		String url = MicroclimateTestUtils.getBaseURL(testType, PORT, PROTOCOL) + api;

		HttpResponse httpResponse = MicroclimateTestUtils.callAPIURLParameters(url, "GET", testType);
		int httpResult = httpResponse.getResponseCode();

		Logger.println(NodeJSProjectAPITests.class, "TestH001getProjectStatusApp()", "HttpResult is: " + httpResult);
		assertEqualsWithResponse(HttpURLConnection.HTTP_OK, httpResult, httpResponse);

	    JsonObject jsonObject = httpResponse.getResponseBodyAsJsonObject();
	    String appStatus = jsonObject.getString("appStatus");
	    assertNotNull(appStatus);
	    assertTrue(appStatus.equals("starting") || appStatus.equals("started") || appStatus.equals("stopping")
	    								|| appStatus.equals("stopped") || appStatus.equals("unknown"));
	    // note: complete app status testing is done in the smoke tests
	}

	@Test(timeout=30000) //30 seconds timeout
	public void TestH002getProjectStatusBuild() throws IOException {
		String projectID = MicroclimateTestUtils.getProjectID(NodeJSProjectAPITests.projectName, testType);
		String api = NodeJSProjectAPITests.STATUS_API + "?type=buildState&projectID=" + projectID;
		String url = MicroclimateTestUtils.getBaseURL(testType, PORT, PROTOCOL) + api;

		HttpResponse httpResponse = MicroclimateTestUtils.callAPIURLParameters(url, "GET", testType);
		int httpResult = httpResponse.getResponseCode();

		Logger.println(NodeJSProjectAPITests.class, "TestH002getProjectStatusBuild()", "HttpResult is: " + httpResult);
		assertEqualsWithResponse(HttpURLConnection.HTTP_OK, httpResult, httpResponse);

	    JsonObject jsonObject = httpResponse.getResponseBodyAsJsonObject();
	    String buildStatus = jsonObject.getString("buildStatus");
	    assertNotNull(buildStatus);
	    assertTrue(buildStatus.equals("queued") || buildStatus.equals("inProgress") || buildStatus.equals("success") || buildStatus.equals("failed") || buildStatus.equals("unknown"));
	    assertFalse(jsonObject.getJsonObject("buildRequired").getBoolean("state"));
	    if (!buildStatus.equals("queued"))
	    		assertNotNull(jsonObject.getString("detailedBuildStatus"));
	    if (buildStatus.equals("success") || buildStatus.equals("failed"))
	    		assertEquals(lastbuild, jsonObject.getJsonNumber("lastbuild").toString());
	    // note: complete build status testing is done in the smoke tests
	}

	@Test(timeout=30000) //30 seconds timeout
	public void TestI001getProjectCapabilities() throws IOException {
		String projectID = MicroclimateTestUtils.getProjectID(projectName, testType);
		String api = PROJECTS_API + projectID + "/capabilities";
		String url = MicroclimateTestUtils.getBaseURL(testType, PORT, PROTOCOL) + api;

		HttpResponse httpResponse = MicroclimateTestUtils.callAPIURLParameters(url, "GET", testType);
		int httpResult = httpResponse.getResponseCode();

		Logger.println(NodeJSProjectAPITests.class, "TestI001getProjectCapabilities()", "HttpResult is: " + httpResult);
		assertEqualsWithResponse(HttpURLConnection.HTTP_OK, httpResult, httpResponse);

		JsonObject capabilities = httpResponse.getResponseBodyAsJsonObject().getJsonObject("capabilities");
		assertNotNull(capabilities);

		JsonArray startModes = capabilities.getJsonArray("startModes");
		assertNotNull(startModes);
		assertTrue(MicroclimateTestUtils.jsonArrayContains(startModes, "\"run\""));
		assertFalse(MicroclimateTestUtils.jsonArrayContains(startModes, "\"debug\""));
		assertTrue(MicroclimateTestUtils.jsonArrayContains(startModes, "\"debugNoInit\""));

		JsonArray controlCommands = capabilities.getJsonArray("controlCommands");
		assertNotNull(controlCommands);
		assertTrue(MicroclimateTestUtils.jsonArrayContains(controlCommands, "\"restart\""));
	}

	/*
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
	*/

	@Test(timeout=30000) //30 seconds timeout
	public void TestK005checkProjectSettingsInvalidProjectID() throws MalformedURLException, IOException {
		String projectID = "invalidProjectID";
		String SettingsAPI = MicroclimateTestUtils.getSettingsAPI(projectID);
		String urlParameters = "{\"settings\": {\"internalDebugPort\" : \"7888\"}}";
		HttpResponse httpResponse = MicroclimateTestUtils.callAPIBodyParameters(SettingsAPI, urlParameters, PROTOCOL, PORT, "POST", testType);
		int httpResult = httpResponse.getResponseCode();

		Logger.println(NodeJSProjectAPITests.class, "TestK005checkProjectSettingsInvalidProjectID()", "HttpResult is: " + httpResult);
		assertEqualsWithResponse(HttpURLConnection.HTTP_NOT_FOUND, httpResult, httpResponse);

		JsonObject responseBody = httpResponse.getResponseBodyAsJsonObject();
		assertEquals("failed", responseBody.getString("status"));
	}

	@Test(timeout=30000) //30 seconds timeout
	public void TestK006checkProjectSettingsNoSettings() throws MalformedURLException, IOException {
		String projectID = MicroclimateTestUtils.getProjectID(projectName, testType);
		String SettingsAPI = MicroclimateTestUtils.getSettingsAPI(projectID);
		String urlParameters = "{\"testParam\": [{\"name\": \"debugPort\",\"value\": \"7888\"}]}";
		HttpResponse httpResponse = MicroclimateTestUtils.callAPIBodyParameters(SettingsAPI, urlParameters, PROTOCOL, PORT, "POST", testType);
		int httpResult = httpResponse.getResponseCode();

		Logger.println(NodeJSProjectAPITests.class, "TestK006checkProjectSettingsNoSettings()", "HttpResult is: " + httpResult);
		assertEqualsWithResponse(HttpURLConnection.HTTP_BAD_REQUEST, httpResult, httpResponse);

	}

	@Test(timeout = 180000) // 3 mins timeout
	public void TestK007changeDebugPortRunMode() throws MalformedURLException, IOException, JSONException {
		//directly return, since icp does not support debugMode.
		if(testType == "icp") {
			return;
		}
		final String projectSettingsChangedEvent = "projectSettingsChanged";
		String[] eventsOfInterest = {projectSettingsChangedEvent};
		String projectID = MicroclimateTestUtils.getProjectID(projectName, testType);
		String SettingsAPI = MicroclimateTestUtils.getSettingsAPI(projectID);
		String urlParameters = "{\"settings\": {\"internalDebugPort\" : \"7888\"}}";
		MicroclimateTestUtils.PairedResponse pairedResponse = MicroclimateTestUtils.callAPIBodyParametersWSocketResponse(SettingsAPI, urlParameters, PROTOCOL, PORT, "POST", testType, eventsOfInterest, 150);
		int httpResult = pairedResponse.httpResponse.getResponseCode();
		Logger.println(NodeJSProjectAPITests.class, "TestK008changeDebugPortRunMode()", "HttpResult is: " + httpResult);
		assertEqualsWithResponse(HttpURLConnection.HTTP_ACCEPTED, httpResult, pairedResponse.httpResponse);

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
		assertNotNull(socketResponseBody.getString("name"));
		assertEquals("internalDebugPort", socketResponseBody.getString("name"));
		assertEquals("success", socketResponseBody.getString("status"));
		// should get stuck in Starting state now

	}

	@Test(timeout=600000) //10 mins timeout
	public void TestK008changeDebugModeandCheckDebugPort() throws MalformedURLException, IOException, JSONException {
		//directly return, since icp does not support debugMode.
		if(testType == "icp") {
			return;
		}
		final String projectRestartResultEvent = "projectRestartResult";
		String[] eventsOfInterest = {projectRestartResultEvent};
		String projectID = MicroclimateTestUtils.getProjectID(projectName, testType);
		String urlParameters = "{\"action\": \"restart\", \"projectID\": \"" + projectID + "\",\"startMode\": \"debugNoInit\"}";
		MicroclimateTestUtils.PairedResponse pairedResponse = MicroclimateTestUtils.callAPIBodyParametersWSocketResponse(ACTION_API, urlParameters, PROTOCOL, PORT, "POST", testType, eventsOfInterest, 540);
		int httpResult = pairedResponse.httpResponse.getResponseCode();
		Logger.println(NodeJSProjectAPITests.class, "TestK009changeDebugModeandCheckDebugPort()", "HttpResult is: " + httpResult);
		assertEqualsWithResponse(HttpURLConnection.HTTP_ACCEPTED, httpResult, pairedResponse.httpResponse);

		JsonObject responseBody = pairedResponse.httpResponse.getResponseBodyAsJsonObject();
		assertNotNull(responseBody.getString("operationId"));

		assertEquals("Expecting only 1 socket event", 1, pairedResponse.socketEvents.length);
		SocketEvent se = pairedResponse.socketEvents[0];
		Logger.log("Socket msg: " + se.getMsg());
		assertEquals("Unexpected socket event received", projectRestartResultEvent, se.getMsg());
		Logger.log("Socket event details: " + se.getDetails().toString());

		JSONObject socketResponseBody = se.getDetails();
		assertNotNull(socketResponseBody);
		assertNotNull(socketResponseBody.getString("operationId"));
		assertNotNull(socketResponseBody.getString("projectID"));
		assertEquals(projectID, socketResponseBody.getString("projectID"));
		assertNotNull(socketResponseBody.getJSONObject("ports"));
		assertNotNull(socketResponseBody.getJSONObject("ports").getString("exposedPort"));
		assertNotNull(socketResponseBody.getJSONObject("ports").getString("internalPort"));
		assertNotNull(socketResponseBody.getJSONObject("ports").getString("exposedDebugPort"));
		assertNotNull(socketResponseBody.getJSONObject("ports").getString("internalDebugPort"));
		assertEquals("success", socketResponseBody.getString("status"));
		assertEquals("7888", socketResponseBody.getJSONObject("ports").getString("internalDebugPort"));
		// should get stuck in Starting state now

	}

	@Test(timeout = 180000) // 3 mins timeout
	public void TestK009changeApplicationPortNotExposedPort() throws MalformedURLException, IOException, JSONException {
		final String projectSettingsChangedEvent = "projectSettingsChanged";
		String[] eventsOfInterest = { projectSettingsChangedEvent };
		String projectID = MicroclimateTestUtils.getProjectID(projectName, testType);
		String SettingsAPI = MicroclimateTestUtils.getSettingsAPI(projectID);
		String urlParameters = "{\"settings\": {\"internalPort\" : \"4321\"}}";

		MicroclimateTestUtils.PairedResponse pairedResponse = MicroclimateTestUtils
				.callAPIBodyParametersWSocketResponse(SettingsAPI, urlParameters, PROTOCOL, PORT, "POST", testType,
						eventsOfInterest, 300);
		int httpResult = pairedResponse.httpResponse.getResponseCode();
		Logger.println(NodeJSProjectAPITests.class, "TestK010changeApplicationPortNotExposedPort()",
				"HttpResult is: " + httpResult);
		assertEqualsWithResponse(HttpURLConnection.HTTP_ACCEPTED, httpResult, pairedResponse.httpResponse);

		JsonObject responseBody = pairedResponse.httpResponse.getResponseBodyAsJsonObject();
		Logger.println(NodeJSProjectAPITests.class, "TestK010changeApplicationPortNotExposedPort()",
				"OperationId is: " + responseBody.getString("operationId"));
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

	}

	// Perform the change Application Port in the end before delete, because the app will not be in started state
	@Test(timeout = 1200000) // 20 mins timeout
	public void TestK010changeApplicationPortExposedPort() throws JSONException, InterruptedException, MalformedURLException, IOException {
		assertNotNull("exposedPort for project " + projectName +" is null", exposedPort);
		String Dockerfile = "Dockerfile";
		String content = "EXPOSE 4321";

		final String projectSettingsChangedEvent = "projectSettingsChanged";
		String[] eventsOfInterest = { projectSettingsChangedEvent };
		String projectID = MicroclimateTestUtils.getProjectID(projectName, testType);
		String SettingsAPI = MicroclimateTestUtils.getSettingsAPI(projectID);
		String urlParameters = "{\"settings\": {\"internalPort\" : \"4321\"}}";

		// Expose the port and confirm the exposed port
		MicroclimateTestUtils.updateDockerFile(testType, projectName, Dockerfile, content);

		while(true) {
			if(MicroclimateTestUtils.checkContainerPortExposed(projectName, testType)) {
				break;
			} else {
				Thread.sleep(3000);
			}
		}

		// change the port
		MicroclimateTestUtils.PairedResponse pairedResponse = MicroclimateTestUtils
				.callAPIBodyParametersWSocketResponse(SettingsAPI, urlParameters, PROTOCOL, PORT, "POST", testType,
						eventsOfInterest, 300);
		int httpResult = pairedResponse.httpResponse.getResponseCode();
		Logger.println(NodeJSProjectAPITests.class, "TestK011changeApplicationPortExposedPort()",
				"HttpResult is: " + httpResult);
		assertEqualsWithResponse(HttpURLConnection.HTTP_ACCEPTED, httpResult, pairedResponse.httpResponse);

		JsonObject responseBody = pairedResponse.httpResponse.getResponseBodyAsJsonObject();
		Logger.println(NodeJSProjectAPITests.class, "TestK011changeApplicationPortExposedPort()",
				"OperationId is: " + responseBody.getString("operationId"));
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
		assertEquals("success", socketResponseBody.getString("status"));
		assertEquals("4321", socketResponseBody.getJSONObject("ports").getString("internalPort"));
		Logger.log("New Exposed Port: " + socketResponseBody.getJSONObject("ports").getString("internalPort"));

		// Logger.log("New Exposed Port: " + socketResponseBody.getString("ports"));
		// assertEquals(true, socketResponseBody.getString("ports").contains("\"internalPort\":\"4321\""));

	}


	// ==================================================
	// NOTE: perform any tests that modify/delete project artifacts
	// right before project delete as that could impact other tests
	// ==================================================

	@Test(timeout=30000) //30 seconds timeout
	public void TestY001actionValidate() throws MalformedURLException, IOException, JSONException {
		final String projectValidatedEvent = "projectValidated";

		String projectID = MicroclimateTestUtils.getProjectID(projectName, testType);
		String urlParameters = "{\"action\": \"validate\",\"projectID\": \"" + projectID + "\",\"projectType\": \"nodejs\",\"location\": \"/codewind-workspace/" + projectName + "\"}";
		Logger.println(NodeJSProjectAPITests.class, "TestI001actionValidate()", "Validation test with URL parameters: " + urlParameters);
		String[] eventsOfInterest = {projectValidatedEvent};
		MicroclimateTestUtils.PairedResponse pairedResponse = MicroclimateTestUtils.callAPIBodyParametersWSocketResponse(ACTION_API, urlParameters, PROTOCOL, PORT, "POST", testType, eventsOfInterest, 5);
		int httpResult = pairedResponse.httpResponse.getResponseCode();
		assertEquals("Expecting only 1 socket event", 1, pairedResponse.socketEvents.length);
		SocketEvent se = pairedResponse.socketEvents[0];
		System.out.println("Socket msg     : " + se.getMsg());
		assertEquals("Unexpected socket event received", projectValidatedEvent, se.getMsg());
		System.out.println("Socket event details : " + se.getDetails().toString());
		JSONArray results = se.getDetails().getJSONArray("results");

		assertNotNull(results);

		// Expecting validation to fail
		assertEquals("Expected 0 results", 0, results.length());
		assertEquals("success", se.getDetails().getString("status"));

		Logger.println(NodeJSProjectAPITests.class, "TestY001actionValidate()", "HttpResult is: " + httpResult);
		assertEqualsWithResponse(HttpURLConnection.HTTP_ACCEPTED, httpResult, pairedResponse.httpResponse);

	}

	@Test(timeout=30000) //30 seconds timeout
	public void TestY002actionValidateMissingPackageJSON() throws Exception {
		MicroclimateTestUtils.deleteFile(MicroclimateTestUtils.workspace + projectName + "/package.json");
		final String projectValidatedEvent = "projectValidated";
		String projectID = MicroclimateTestUtils.getProjectID(projectName, testType);
		String urlParameters = "{\"action\": \"validate\",\"projectID\": \"" + projectID + "\",\"projectType\": \"nodejs\",\"location\": \"/codewind-workspace/" + projectName + "\"}";
		Logger.println(NodeJSProjectAPITests.class, "TestY002actionValidateMissingPackageJSON()", "Validation test with URL parameters: " + urlParameters);
		String[] eventsOfInterest = {projectValidatedEvent};
		MicroclimateTestUtils.PairedResponse pairedResponse = MicroclimateTestUtils.callAPIBodyParametersWSocketResponse(ACTION_API, urlParameters, PROTOCOL, PORT, "POST", testType, eventsOfInterest, 5);
		int httpResult = pairedResponse.httpResponse.getResponseCode();
		assertEquals("Expecting only 1 socket event", 1, pairedResponse.socketEvents.length);
		SocketEvent se = pairedResponse.socketEvents[0];
		System.out.println("Socket msg: " + se.getMsg());
		assertEquals("Unexpected socket event received", projectValidatedEvent, se.getMsg());
		System.out.println("Socket event details : " + se.getDetails().toString());
		JSONArray results = se.getDetails().getJSONArray("results");

		assertNotNull(results);

		// Expecting validation to fail
		assertEquals("Expected 1 results", 1, results.length());
		JSONObject resultsObj = results.getJSONObject(0);
		assertEquals("error", resultsObj.getString("severity"));
		assertEquals("package.json", resultsObj.getString("filename"));
		assertEquals(projectName + "/package.json", resultsObj.getString("filepath"));
		assertEquals("missing", resultsObj.getString("type"));
		assertEquals("Missing required file", resultsObj.getString("label"));
		assertEquals("package.json is required but was not found.", resultsObj.getString("details"));

		Logger.println(NodeJSProjectAPITests.class, "TestY002actionValidateMissingPackageJSON()", "HttpResult is: " + httpResult);
		assertEqualsWithResponse(HttpURLConnection.HTTP_ACCEPTED, httpResult, pairedResponse.httpResponse);
	}

	@Test(timeout=300000) //5 mins timeout
	public void TestZ002projectDelete() throws IOException, JSONException {
		final String projectDeletionEvent = "projectDeletion";

		String projectID = MicroclimateTestUtils.getProjectID(projectName, testType);
		String api = PROJECTS_API + projectID;
		String url = MicroclimateTestUtils.getBaseURL(testType, PORT, PROTOCOL) + api;

		String[] eventsOfInterest = {projectDeletionEvent};
		MicroclimateTestUtils.PairedResponse pairedResponse = MicroclimateTestUtils.callAPIURLParametersWSocketResponse(url, "DELETE", testType, eventsOfInterest, 300);
		int httpResult = pairedResponse.httpResponse.getResponseCode();

		Logger.println(NodeJSProjectAPITests.class, "TestZ002projectDelete()", "HttpResult is: " + httpResult);
		assertEqualsWithResponse(HttpURLConnection.HTTP_ACCEPTED, httpResult, pairedResponse.httpResponse);

		assertEquals("Expecting only 1 socket event", 1, pairedResponse.socketEvents.length);
		SocketEvent se = pairedResponse.socketEvents[0];
		Logger.println(NodeJSProjectAPITests.class, "TestZ002projectDelete()", "Socket msg: " + se.getMsg());
		assertEquals("Unexpected socket event received", projectDeletionEvent, se.getMsg());
		Logger.println(NodeJSProjectAPITests.class, "TestZ002projectDelete()", "Socket event details: " + se.getDetails().toString());

		JSONObject socketResponseBody = se.getDetails();
		assertNotNull(socketResponseBody);
		assertNotNull(socketResponseBody.getString("operationId"));
		assertEquals(projectID, socketResponseBody.getString("projectID"));
		assertEquals("success", socketResponseBody.getString("status"));


	}
}
