package org.eclipse.codewind.microclimate.apitest;

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
import javax.json.JsonValue;

import org.eclipse.codewind.microclimate.smoketest.MicroprofileCreationAndUpdate;
import org.eclipse.codewind.microclimate.test.util.AbstractMicroclimateTest;
import org.eclipse.codewind.microclimate.test.util.HttpResponse;
import org.eclipse.codewind.microclimate.test.util.Logger;
import org.eclipse.codewind.microclimate.test.util.MicroclimateTestUtils;
import org.eclipse.codewind.microclimate.test.util.RetryRule;
import org.eclipse.codewind.microclimate.test.util.SocketUtil;
import org.eclipse.codewind.microclimate.test.util.StatusTrackingUtil;
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
public class MicroprofileProjectAPITests extends AbstractMicroclimateTest {

	public static String exposedPort;
	public static String projectName = "liberty" + SUITE_TYPES.apitest + (new Date().getTime());
	private static String testType = System.getProperty("testType");
	private static PROJECT_TYPES projectType = PROJECT_TYPES.liberty;

	public final String PORT = MicroclimateTestUtils.getPort();
	public final String PROTOCOL = MicroclimateTestUtils.getProtocol();

	final String PROJECTS_API = MicroclimateTestUtils.getProjectsAPI();
	final String TYPES_API = MicroclimateTestUtils.getTypesAPI();
	final String STATUS_API = MicroclimateTestUtils.getStatusAPI();
	final String ACTION_API = MicroclimateTestUtils.getActionAPI();

	private static String lastbuild;

    @Rule
    public RetryRule retry = new RetryRule(MicroclimateTestUtils.retryCount);

	@Before
	public void checkTestType() {
		assumeTrue("-DtestType parameter must be set", "local".equalsIgnoreCase(testType));
	}

	@Test(timeout=60000) //60 seconds timeout
	public void TestA001create() {
		String urlParameters  ="{\"name\": \"" + projectName + "\",\"language\": \"java\",\"framework\": \"microprofile\"}";

		try {
			int httpResult = MicroclimateTestUtils.projectCreation(urlParameters, testType);
			Logger.println(MicroprofileProjectAPITests.class, "TestA001create()", "HttpResult is: " + httpResult);
			assertEquals(HttpURLConnection.HTTP_ACCEPTED, httpResult);
		}
		catch( Exception e ) {
			Logger.println(MicroprofileProjectAPITests.class, "TestA001create()", "Exception occurred during project creation: " + e.getMessage(),e);
			fail("Exception occurred during project creation.");
		}

		return;
	}

	@Test(timeout=30000) //30 seconds timeout
	public void TestA002checkForProject() {
		try {
			while ( true ) {
				if (MicroclimateTestUtils.checkProjectExistency(projectName, testType)) {
					return;
				} else {
					Thread.sleep(3000);
				}
			}
		}
		catch( Exception e ) {
			Logger.println(MicroprofileProjectAPITests.class, "TestA002checkForProject()", "Exception occurred when looking for project in projectList: " + e.getMessage(),e);
			fail("Exception occurred when looking for project in projectList");
		}
	}

	@Test(timeout=300000) //5 mins timeout
	public void TestA003checkForContainer() {
		try {
			exposedPort = MicroclimateTestUtils.getexposedPort(projectName, testType, projectType);
			Logger.println(MicroprofileProjectAPITests.class, "TestA003checkForContainer()", "Exposed Port is " + exposedPort);
			assertNotNull("exposedPort for project " + projectName +" is null", exposedPort);
		}
		catch( Exception e ) {
			Logger.println(MicroprofileProjectAPITests.class, "TestA003checkForContainer()", "Exception occurred when looking for exposedport: " + e.getMessage(),e);
			fail("Exception occurred when looking for exposedport");
		}

		return;
	}

	@Test(timeout=180000) //3 mins timeout
	public void TestA005checkEndpoint() {
		assertNotNull("exposedPort for project " + projectName +" is null", exposedPort);
		String expectedString = "Congratulations, your application is up and running";
		String api = "/v1/example";

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
			Logger.println(MicroprofileProjectAPITests.class, "TestA005checkEndpoint()", "Exception occurred when checking for endpoint",e);
			fail("Exception occurred when checking for endpoint");
		}
	}


	@Test(timeout=30000) //30 seconds timeout
	public void TestA009reconfigWatchedFilesNowatchedFilesORIgnoredFiles() {
		try {
			final String projectSettingsChangedEvent = "projectSettingsChanged";
			String[] eventsOfInterest = {projectSettingsChangedEvent};
			String projectID = MicroclimateTestUtils.getProjectID(projectName, testType);
			String SettingsAPI = MicroclimateTestUtils.getSettingsAPI(projectID);
			String urlParameters = "{\"settings\": {\"watchedFiles\" : { \"dummyValue\": \"/codewind-workspace/" + projectName + "/chart\" }}}";
			MicroclimateTestUtils.PairedResponse pairedResponse = MicroclimateTestUtils.callAPIBodyParametersWSocketResponse(SettingsAPI, urlParameters, PROTOCOL, PORT, "POST", testType, eventsOfInterest, 20);
			int httpResult = pairedResponse.httpResponse.getResponseCode();
			Logger.println(MicroprofileProjectAPITests.class, "TestA009reconfigWatchedFilesNowatchedFilesORIgnoredFiles()", "HttpResult is: " + httpResult);
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
			assertNotNull(socketResponseBody.getString("name"));
			assertEquals("watchedFiles", socketResponseBody.getString("name"));
			assertEquals("failed", socketResponseBody.getString("status"));
		}
		catch( Exception e ) {
			Logger.println(MicroprofileProjectAPITests.class, "TestA009reconfigWatchedFilesNowatchedFilesORIgnoredFiles()", "Exception occurred during action reconfigWatchedFiles: " + e.getMessage(),e);
			fail("Exception occurred during setting reconfigWatchedFiles");
		}
	}

	@Test(timeout=30000) //30 seconds timeout
	public void TestA010reconfigWatchedFilesInvalidignoredFiles() {
		try {
			final String projectSettingsChangedEvent = "projectSettingsChanged";
			String[] eventsOfInterest = {projectSettingsChangedEvent};
			String projectID = MicroclimateTestUtils.getProjectID(projectName, testType);
			String SettingsAPI = MicroclimateTestUtils.getSettingsAPI(projectID);
			String urlParameters = "{\"settings\": {\"watchedFiles\" : { \"excludeFiles\": \"/codewind-workspace/" + projectName + "/chart\" }}}";
			MicroclimateTestUtils.PairedResponse pairedResponse = MicroclimateTestUtils.callAPIBodyParametersWSocketResponse(SettingsAPI, urlParameters, PROTOCOL, PORT, "POST", testType, eventsOfInterest, 20);
			int httpResult = pairedResponse.httpResponse.getResponseCode();
			Logger.println(MicroprofileProjectAPITests.class, "TestA010reconfigWatchedFilesInvalidignoredFiles()", "HttpResult is: " + httpResult);
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
			assertNotNull(socketResponseBody.getString("name"));
			assertEquals("watchedFiles", socketResponseBody.getString("name"));
			assertEquals("failed", socketResponseBody.getString("status"));
		}
		catch( Exception e ) {
			Logger.println(MicroprofileProjectAPITests.class, "TestA010reconfigWatchedFilesInvalidignoredFiles()", "Exception occurred during action reconfigWatchedFiles: " + e.getMessage(),e);
			fail("Exception occurred during setting reconfigWatchedFiles");
		}
	}

	@Test(timeout=30000) //30 seconds timeout
	public void TestA011reconfigWatchedFiles() {
		try {
			final String projectSettingsChangedEvent = "projectSettingsChanged";
			String[] eventsOfInterest = {projectSettingsChangedEvent};
			String projectID = MicroclimateTestUtils.getProjectID(projectName, testType);
			String SettingsAPI = MicroclimateTestUtils.getSettingsAPI(projectID);
			String urlParameters = "{\"settings\": {\"watchedFiles\" : { \"includeFiles\": [\"/codewind-workspace/" + projectName + "/\"], \"excludeFiles\": [\"/codewind-workspace/" + projectName + "/mc-target\", \"/codewind-workspace/" + projectName + "/target\", \"/codewind-workspace/" + projectName + "/src\"] }}}";
			MicroclimateTestUtils.PairedResponse pairedResponse = MicroclimateTestUtils.callAPIBodyParametersWSocketResponse(SettingsAPI, urlParameters, PROTOCOL, PORT, "POST", testType, eventsOfInterest, 20);
			int httpResult = pairedResponse.httpResponse.getResponseCode();
			Logger.println(MicroprofileProjectAPITests.class, "TestA011reconfigWatchedFiles()", "HttpResult is: " + httpResult);
			assertEquals(HttpURLConnection.HTTP_ACCEPTED, httpResult);

			assertEquals("Expecting 0 socket event", 0, pairedResponse.socketEvents.length);
		}
		catch( Exception e ) {
			Logger.println(MicroprofileProjectAPITests.class, "TestA011reconfigWatchedFiles()", "Exception occurred during action reconfigWatchedFiles: " + e.getMessage(),e);
			fail("Exception occurred during setting reconfigWatchedFiles");
		}

	}
	//@Ignore // Disable this test until failure investigated and fixed (Issue #570)
	@Test(timeout=180000) //3 mins timeout
	public void TestA012newIgnoredFiles() {
		try {
			String projectID = MicroclimateTestUtils.getProjectID(projectName, testType);
			StatusTrackingUtil.startStatusTrackingListener();
			StatusTrackingUtil.clearStatusEventsRecord(projectID);

			MicroclimateTestUtils.updateFile(testType, projectName, "src/main/java/application/rest/v1/Example.java", "Example.java", "Congratulations", "Hello");
			StatusTrackingUtil.getSocketUtilInstance().waitForSocketEvents("dummyOperationID", 120);
			SocketEvent[] Socketresponse = StatusTrackingUtil.getSocketUtilInstance().getStatusChangedEvents(projectID);
			assertEquals(0, Socketresponse.length);

		} catch(Exception e) {
			Logger.println(MicroprofileCreationAndUpdate.class, "TestA012newIgnoredFiles()", "Exception occurred when checking for container change: " + e.getMessage(),e);
			fail("Exception occurred when checking for container change");
		}

	}

	@Test(timeout=420000) //6 mins timeout
	public void TestA013newWatchedFiles() {
		try {
			String projectID = MicroclimateTestUtils.getProjectID(projectName, testType);
			String Dockerfile = "README.md";
			String content = "RUN mkdir -m 777 -p /home/default/test_directory";
			StatusTrackingUtil.clearStatusEventsRecord(projectID);
			MicroclimateTestUtils.updateDockerFile(testType, projectName, Dockerfile, content);
			StatusTrackingUtil.checkBuildStatusTransitionsForUpdate(projectID, 300);
			// Wait for the start project to finish
			long timeout = 60000;
			boolean isStart = MicroclimateTestUtils.waitForProjectStarted(projectID, testType, timeout);
			assertTrue("Project " + projectName + " did not start within " + timeout + "ms", isStart);

		} catch(Exception e) {
			Logger.println(MicroprofileCreationAndUpdate.class, "TestA013newWatchedFiles()", "Exception occurred when checking for container change: " + e.getMessage(),e);
			fail("Exception occurred when checking for container change");
		}

	}

	@Test(timeout=60000) //60 seconds timeout
	public void TestA014actionRestartNoStartMode() throws Exception {

		String projectID = MicroclimateTestUtils.getProjectID(projectName, testType);
		String urlParameters = "{\"action\": \"restart\", \"projectID\": \"" + projectID + "\"}";
		HttpResponse httpResponse = MicroclimateTestUtils.callAPIBodyParameters(ACTION_API, urlParameters, PROTOCOL, PORT, "POST", testType);
		int httpResult = httpResponse.getResponseCode();

		Logger.println(MicroprofileProjectAPITests.class, "TestA014actionRestartNoStartMode()", "HttpResult is: " + httpResult);
		assertEquals(HttpURLConnection.HTTP_BAD_REQUEST, httpResult);
	}

	@Test(timeout=60000) //60 seconds timeout
	public void TestA015actionRestartNoProjectID() throws Exception {

		String urlParameters = "{\"action\": \"restart\", \"startMode\": \"run\"}";
		HttpResponse httpResponse = MicroclimateTestUtils.callAPIBodyParameters(ACTION_API, urlParameters, PROTOCOL, PORT, "POST", testType);
		int httpResult = httpResponse.getResponseCode();

		Logger.println(MicroprofileProjectAPITests.class, "TestA015actionRestartNoProjectID()", "HttpResult is: " + httpResult);
		assertEquals(HttpURLConnection.HTTP_BAD_REQUEST, httpResult);
	}

	@Test(timeout=60000) //60 seconds timeout
	public void TestA016actionRestartInvalidProjectID() throws Exception {

		String urlParameters = "{\"action\": \"restart\", \"projectID\": \"" + projectName + "\", startMode: \"run\"}";
		HttpResponse httpResponse = MicroclimateTestUtils.callAPIBodyParameters(ACTION_API, urlParameters, PROTOCOL, PORT, "POST", testType);
		int httpResult = httpResponse.getResponseCode();

		Logger.println(MicroprofileProjectAPITests.class, "TestA016actionRestartInvalidProjectID()", "HttpResult is: " + httpResult);
		assertEquals(HttpURLConnection.HTTP_BAD_REQUEST, httpResult);
	}

	// Run the action restart debug test first as it leaves the app in "starting" state
	// Use the following test TestA018actionRestartRun() to restart the app in run mode
	// Note: Just a regular build won't fix the app to go into start mode so we need to restart using run mode
	@Test(timeout=180000) //3 minutes timeout
	public void TestA017actionRestartDebug() throws Exception {
		final String projectRestartResultEvent = "projectRestartResult";

		String projectID = MicroclimateTestUtils.getProjectID(projectName, testType);
		String urlParameters = "{\"action\": \"restart\", \"projectID\": \"" + projectID + "\", \"startMode\": \"debug\"}";
		String[] eventsOfInterest = {projectRestartResultEvent};
		MicroclimateTestUtils.PairedResponse pairedResponse = MicroclimateTestUtils.callAPIBodyParametersWSocketResponse(ACTION_API, urlParameters, PROTOCOL, PORT, "POST", testType, eventsOfInterest, 150);
		int httpResult = pairedResponse.httpResponse.getResponseCode();

		Logger.log("HttpResult is: " + httpResult);
		assertEquals(HttpURLConnection.HTTP_ACCEPTED, httpResult);

		JsonObject responseBody = pairedResponse.httpResponse.getResponseBodyAsJsonObject();
		assertNotNull(responseBody.getString("operationId"));

		assertEquals("Expecting only 1 socket event", 1, pairedResponse.socketEvents.length);
		SocketEvent se = pairedResponse.socketEvents[0];
		Logger.log("Socket msg: " + se.getMsg());
		assertEquals("Unexpected socket event received", projectRestartResultEvent, se.getMsg());
		Logger.log("Socket event details: " + se.getDetails().toString());

		JSONObject socketResponseBody = se.getDetails();
		assertNotNull(socketResponseBody);
		assertEquals(projectID, socketResponseBody.getString("projectID"));
		assertEquals("success", socketResponseBody.getString("status"));
		JSONObject ports = socketResponseBody.getJSONObject("ports");
		assertNotNull(ports);
		assertNotNull(ports.getString("exposedPort"));
		assertNotNull(ports.getString("internalPort"));
		assertNotNull(ports.getString("exposedDebugPort"));
		assertNotNull(ports.getString("internalDebugPort"));
		// the app will get stuck Starting now, but invoking a build will override this.
	}

	// NOTE: do testing of project restart with startmode of run *after* the restart with startmode of debug
	// This will restart the application into start mode
	@Test(timeout=180000) //3 minutes timeout
	public void TestA018actionRestartRun() throws Exception {
		final String projectRestartResultEvent = "projectRestartResult";

		String projectID = MicroclimateTestUtils.getProjectID(projectName, testType);
		String urlParameters = "{\"action\": \"restart\", \"projectID\": \"" + projectID + "\", \"startMode\": \"run\"}";
		String[] eventsOfInterest = {projectRestartResultEvent};
		MicroclimateTestUtils.PairedResponse pairedResponse = MicroclimateTestUtils.callAPIBodyParametersWSocketResponse(ACTION_API, urlParameters, PROTOCOL, PORT, "POST", testType, eventsOfInterest, 150);
		int httpResult = pairedResponse.httpResponse.getResponseCode();

		Logger.log("HttpResult is: " + httpResult);
		assertEquals(HttpURLConnection.HTTP_ACCEPTED, httpResult);

		JsonObject responseBody = pairedResponse.httpResponse.getResponseBodyAsJsonObject();
		assertNotNull(responseBody.getString("operationId"));

		assertEquals("Expecting only 1 socket event", 1, pairedResponse.socketEvents.length);
		SocketEvent se = pairedResponse.socketEvents[0];
		Logger.log("Socket msg: " + se.getMsg());
		assertEquals("Unexpected socket event received", projectRestartResultEvent, se.getMsg());
		Logger.log("Socket event details: " + se.getDetails().toString());

		JSONObject socketResponseBody = se.getDetails();
		assertNotNull(socketResponseBody);
		assertEquals(projectID, socketResponseBody.getString("projectID"));
		assertEquals("success", socketResponseBody.getString("status"));
		JSONObject ports = socketResponseBody.getJSONObject("ports");
		assertNotNull(ports);
		assertNotNull(ports.getString("exposedPort"));
		assertNotNull(ports.getString("internalPort"));
		assertTrue(!ports.has("exposedDebugPort"));
		assertTrue(!ports.has("internalDebugPort"));

		// Wait for the restart to finish
		long timeout = 60000;
		boolean isUp = MicroclimateTestUtils.waitForProjectStarted(projectID, testType, timeout);
		assertTrue("Project " + projectName + " did not restart within " + timeout + "ms", isUp);
	}

	@Test(timeout=420000) //7 minutes timeout
	public void TestB001buildAndRun() {
		final String projectCreationEvent = "projectCreation";

		try {
			String projectID = MicroclimateTestUtils.getProjectID(projectName, testType);
			String urlParameters = "{\"projectID\": \"" + projectID + "\",\"projectType\": \"liberty\",\"location\": \"/codewind-workspace/" + projectName + "\"}";
			String[] eventsOfInterest = {projectCreationEvent};
			MicroclimateTestUtils.PairedResponse pairedResponse = MicroclimateTestUtils.callAPIBodyParametersWSocketResponse(PROJECTS_API, urlParameters, PROTOCOL, PORT, "POST", testType, eventsOfInterest, 300);
			int httpResult = pairedResponse.httpResponse.getResponseCode();

			Logger.println(MicroprofileProjectAPITests.class, "TestB001buildAndRun()", "HttpResult is: " + httpResult);

			assertEquals(HttpURLConnection.HTTP_ACCEPTED, httpResult);

			JsonObject responseBody = pairedResponse.httpResponse.getResponseBodyAsJsonObject();
			assertNotNull(responseBody.getString("operationId"));
			assertNotNull(responseBody.getJsonObject("logs").getJsonObject("build").getString("file"));

			assertEquals("Expecting only 1 socket event", 1, pairedResponse.socketEvents.length);
			SocketEvent se = pairedResponse.socketEvents[0];
			Logger.println(MicroprofileProjectAPITests.class, "TestB001buildAndRun()", "Socket msg: " + se.getMsg());
			assertEquals("Unexpected socket event received", projectCreationEvent, se.getMsg());
			Logger.println(MicroprofileProjectAPITests.class, "TestB001buildAndRun()", "Socket event details: " + se.getDetails().toString());

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
			// Wait for the start project to finish
			long timeout = 90000;
			boolean isStart = MicroclimateTestUtils.waitForProjectStarted(projectID, testType, timeout);
			assertTrue("Project " + projectName + " did not start within " + timeout + "ms", isStart);
		}
		catch( Exception e ) {
			Logger.println(MicroprofileProjectAPITests.class, "TestB001buildAndRun()", "Exception occurred during project build & run: " + e.getMessage(),e);
			fail("Exception occurred during project build & run");
		}

		return;
	}

	@Test(timeout=60000) //60 seconds timeout
	public void TestB003buildAndRunInvalidProjectTypeNewProject() {
		// building and running a NEW project with an invalid type
		try {
			String urlParameters = "{\"projectID\": \"abcd" + "\",\"projectType\": \"libertyxxx\",\"location\": \"/codewind-workspace/" + projectName + "\"}";
			HttpResponse httpResponse = MicroclimateTestUtils.callAPIBodyParameters(PROJECTS_API, urlParameters, PROTOCOL, PORT, "POST", testType);
			int httpResult = httpResponse.getResponseCode();
			Logger.println(MicroprofileProjectAPITests.class, "TestB003buildAndRunInvalidProjectTypeNewProject()", "HttpResult is: " + httpResult);
			assertEquals(HttpURLConnection.HTTP_BAD_REQUEST, httpResult);
		}
		catch( Exception e ) {
			Logger.println(MicroprofileProjectAPITests.class, "TestB003buildAndRunInvalidProjectTypeNewProject()", "Exception occurred during project build & run: " + e.getMessage(),e);
			fail("Exception occurred during project build & run");
		}

		return;
	}

	@Test(timeout=60000) //60 seconds timeout
	public void TestB004buildAndRunInvalidLocationNewProject() {
		// building and running a NEW project with an invalid location
		try {
			String urlParameters  ="{\"projectID\": \"abcd" + "\",\"projectType\": \"liberty\",\"location\": \"/xxx/yyy\"}";
			HttpResponse httpResponse = MicroclimateTestUtils.callAPIBodyParameters(PROJECTS_API, urlParameters, PROTOCOL, PORT, "POST", testType);
			int httpResult = httpResponse.getResponseCode();
			Logger.println(MicroprofileProjectAPITests.class, "TestB004buildAndRunInvalidLocationNewProject()", "HttpResult is: " + httpResult);
			assertEquals(HttpURLConnection.HTTP_NOT_FOUND, httpResult);
		}
		catch( Exception e ) {
			Logger.println(MicroprofileProjectAPITests.class, "TestB004buildAndRunInvalidLocationNewProject()", "Exception occurred during project build & run: " + e.getMessage(),e);
			fail("Exception occurred during project build & run");
		}

		return;
	}

	@Test(timeout=60000) //60 seconds timeout
	public void TestB005buildAndRunDifferentProjectTypeExistingProject() {
		// building and running a EXISTING project with a different project type
		try {
			String projectID = MicroclimateTestUtils.getProjectID(projectName, testType);
			String urlParameters = "{\"projectID\": \"" + projectID + "\",\"projectType\": \"spring\",\"location\": \"/codewind-workspace/" + projectName + "\"}";
			HttpResponse httpResponse = MicroclimateTestUtils.callAPIBodyParameters(PROJECTS_API, urlParameters, PROTOCOL, PORT, "POST", testType);
			int httpResult = httpResponse.getResponseCode();
			Logger.println(MicroprofileProjectAPITests.class, "TestB005buildAndRunDifferentProjectTypeExistingProject()", "HttpResult is: " + httpResult);
			assertEquals(HttpURLConnection.HTTP_BAD_REQUEST, httpResult);
		}
		catch( Exception e ) {
			Logger.println(MicroprofileProjectAPITests.class, "TestB005buildAndRunDifferentProjectTypeExistingProject()", "Exception occurred during project build & run: " + e.getMessage(),e);
			fail("Exception occurred during project build & run");
		}

		return;
	}

	@Test(timeout=60000) //60 seconds timeout
	public void TestB006buildAndRunDifferentLocationExistingProject() {
		// building and running a EXISTING project with a different location
		try {
			String projectID = MicroclimateTestUtils.getProjectID(projectName, testType);
			String urlParameters  = "{\"projectID\": \"" + projectID + "\",\"projectType\": \"liberty\",\"location\": \"/codewind-workspace/" + "\"}";
			HttpResponse httpResponse = MicroclimateTestUtils.callAPIBodyParameters(PROJECTS_API, urlParameters, PROTOCOL, PORT, "POST", testType);
			int httpResult = httpResponse.getResponseCode();
			Logger.println(MicroprofileProjectAPITests.class, "TestB006buildAndRunDifferentLocationExistingProject()", "HttpResult is: " + httpResult);
			assertEquals(HttpURLConnection.HTTP_BAD_REQUEST, httpResult);
		}
		catch( Exception e ) {
			Logger.println(MicroprofileProjectAPITests.class, "TestB006buildAndRunDifferentLocationExistingProject()", "Exception occurred during project build & run: " + e.getMessage(),e);
			fail("Exception occurred during project build & run");
		}

		return;
	}

	@Test(timeout=60000) //60 seconds timeout
	public void TestB007buildAndRunInvalidStartMode() throws Exception {

		String projectID = MicroclimateTestUtils.getProjectID(projectName, testType);
		String urlParameters = "{\"projectID\": \"" + projectID + "\",\"projectType\": \"liberty\",\"location\": \"/codewind-workspace/" + projectName + "\",\"startMode\": \"xxx\"}";

		HttpResponse httpResponse = MicroclimateTestUtils.callAPIBodyParameters(PROJECTS_API, urlParameters, PROTOCOL, PORT, "POST", testType);
		int httpResult = httpResponse.getResponseCode();

		Logger.log("HttpResult is: " + httpResult);
		assertEquals(HttpURLConnection.HTTP_BAD_REQUEST, httpResult);
	}

	@Test(timeout=420000) //7 minutes timeout
	public void TestB008buildAndRunStartModeRun() throws Exception {
		final String projectCreationEvent = "projectCreation";

		String projectID = MicroclimateTestUtils.getProjectID(projectName, testType);
		String urlParameters = "{\"projectID\": \"" + projectID + "\",\"projectType\": \"liberty\",\"location\": \"/codewind-workspace/" + projectName + "\",\"startMode\": \"run\"}";
		String[] eventsOfInterest = {projectCreationEvent};
		MicroclimateTestUtils.PairedResponse pairedResponse = MicroclimateTestUtils.callAPIBodyParametersWSocketResponse(PROJECTS_API, urlParameters, PROTOCOL, PORT, "POST", testType, eventsOfInterest, 300);
		int httpResult = pairedResponse.httpResponse.getResponseCode();

		Logger.log("HttpResult is: " + httpResult);

		assertEquals(HttpURLConnection.HTTP_ACCEPTED, httpResult);

		JsonObject responseBody = pairedResponse.httpResponse.getResponseBodyAsJsonObject();
		assertNotNull(responseBody.getString("operationId"));
		assertNotNull(responseBody.getJsonObject("logs").getJsonObject("build").getString("file"));

		assertEquals("Expecting only 1 socket event", 1, pairedResponse.socketEvents.length);
		SocketEvent se = pairedResponse.socketEvents[0];
		Logger.log("Socket msg: " + se.getMsg());
		assertEquals("Unexpected socket event received", projectCreationEvent, se.getMsg());
		Logger.log("Socket event details: " + se.getDetails().toString());

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

		// Wait for the restart to finish
		long timeout = 90000;
		boolean isUp = MicroclimateTestUtils.waitForProjectStarted(projectID, testType, timeout);
		assertTrue("Project " + projectName + " did not restart within " + timeout + "ms", isUp);
	}

	@Test(timeout=420000) //7 minutes timeout
	public void TestB009buildAndRunStartModeDebug() throws Exception {
		final String projectCreationEvent = "projectCreation";

		String projectID = MicroclimateTestUtils.getProjectID(projectName, testType);
		String urlParameters = "{\"projectID\": \"" + projectID + "\",\"projectType\": \"liberty\",\"location\": \"/codewind-workspace/" + projectName + "\",\"startMode\": \"debug\"}";
		String[] eventsOfInterest = {projectCreationEvent};
		MicroclimateTestUtils.PairedResponse pairedResponse = MicroclimateTestUtils.callAPIBodyParametersWSocketResponse(PROJECTS_API, urlParameters, PROTOCOL, PORT, "POST", testType, eventsOfInterest, 300);
		int httpResult = pairedResponse.httpResponse.getResponseCode();

		Logger.log("HttpResult is: " + httpResult);

		assertEquals(HttpURLConnection.HTTP_ACCEPTED, httpResult);

		JsonObject responseBody = pairedResponse.httpResponse.getResponseBodyAsJsonObject();
		assertNotNull(responseBody.getString("operationId"));
		assertNotNull(responseBody.getJsonObject("logs").getJsonObject("build").getString("file"));

		assertEquals("Expecting only 1 socket event", 1, pairedResponse.socketEvents.length);
		SocketEvent se = pairedResponse.socketEvents[0];
		Logger.log("Socket msg: " + se.getMsg());
		assertEquals("Unexpected socket event received", projectCreationEvent, se.getMsg());
		Logger.log("Socket event details: " + se.getDetails().toString());

		JSONObject socketResponseBody = se.getDetails();
		assertNotNull(socketResponseBody);
		assertNotNull(socketResponseBody.getString("operationId"));
		assertNotNull(socketResponseBody.getString("projectID"));
		assertEquals(projectID, socketResponseBody.getString("projectID"));
		assertNotNull(socketResponseBody.getString("host"));
		assertNotNull(socketResponseBody.getJSONObject("ports"));
		assertNotNull(socketResponseBody.getJSONObject("ports").getString("exposedPort"));
		assertNotNull(socketResponseBody.getJSONObject("ports").getString("internalPort"));
		assertNotNull(socketResponseBody.getJSONObject("ports").getString("exposedDebugPort"));
		assertNotNull(socketResponseBody.getJSONObject("ports").getString("internalDebugPort"));
		assertEquals("success", socketResponseBody.getString("status"));
		assertNotNull(socketResponseBody.getJSONObject("logs"));
		// should get stuck in Starting state now
	}

	@Test(timeout=30000) //30 seconds timeout
	public void TestC001getProjectTypes() {
		try {
			String api = TYPES_API + "?location=/codewind-workspace/" + projectName;
			String url = MicroclimateTestUtils.getBaseURL(testType, PORT, PROTOCOL) + api;

			HttpResponse httpResponse = MicroclimateTestUtils.callAPIURLParameters(url, "GET", testType);
			int httpResult = httpResponse.getResponseCode();

			Logger.println(MicroprofileProjectAPITests.class, "TestC001getProjectTypes()", "HttpResult is: " + httpResult);
			assertEquals(HttpURLConnection.HTTP_OK, httpResult);

			JsonObject jsonObject = httpResponse.getResponseBodyAsJsonObject();
			assertEquals("liberty", jsonObject.getJsonArray("types").getString(0));
		}
		catch( Exception e ) {
			Logger.println(MicroprofileProjectAPITests.class, "TestC001getProjectTypes()", "Exception occurred during get project types: " + e.getMessage(),e);
			fail("Exception occurred during project get types");
		}
	}

	@Test(timeout=30000) //30 seconds timeout
	public void TestC002getProjectTypesInvalidLocation() {
		try {
			String api = TYPES_API + "?location=/codewind-workspacexxx/" + projectName;
			String url = MicroclimateTestUtils.getBaseURL(testType, PORT, PROTOCOL) + api;

			HttpResponse httpResponse = MicroclimateTestUtils.callAPIURLParameters(url, "GET", testType);
			int httpResult = httpResponse.getResponseCode();

			Logger.println(MicroprofileProjectAPITests.class, "TestC002getProjectTypesInvalidLocation()", "HttpResult is: " + httpResult);
			assertEquals(HttpURLConnection.HTTP_NOT_FOUND, httpResult);
		}
		catch( Exception e ) {
			Logger.println(MicroprofileProjectAPITests.class, "TestC002getProjectTypesInvalidLocation()", "Exception occurred during get project types: " + e.getMessage(),e);
			fail("Exception occurred during project get types");
		}
	}

	@Test(timeout=30000) //30 seconds timeout
	public void TestC003getProjectTypesAll() {
		try {
			String url = MicroclimateTestUtils.getBaseURL(testType, PORT, PROTOCOL) + TYPES_API;

			HttpResponse httpResponse = MicroclimateTestUtils.callAPIURLParameters(url, "GET", testType);
			int httpResult = httpResponse.getResponseCode();

			Logger.println(MicroprofileProjectAPITests.class, "TestC003getProjectTypesAll()", "HttpResult is: " + httpResult);
			assertEquals(HttpURLConnection.HTTP_OK, httpResult);

			JsonObject jsonObject = httpResponse.getResponseBodyAsJsonObject();
			JsonArray projectTypes = jsonObject.getJsonArray("types");
			assertTrue(MicroclimateTestUtils.jsonArrayContains(projectTypes, "\"liberty\""));
			assertTrue(MicroclimateTestUtils.jsonArrayContains(projectTypes, "\"spring\""));
			assertTrue(MicroclimateTestUtils.jsonArrayContains(projectTypes, "\"swift\""));
			assertTrue(MicroclimateTestUtils.jsonArrayContains(projectTypes, "\"nodejs\""));
		}
		catch( Exception e ) {
			Logger.println(MicroprofileProjectAPITests.class, "TestC003getProjectTypesAll()", "Exception occurred during get project types: " + e.getMessage(),e);
			fail("Exception occurred during project get types");
		}
	}

	@Test(timeout=30000) //30 seconds timeout
	public void TestD001getProjectLogs() {
		try {
			String projectID = MicroclimateTestUtils.getProjectID(projectName, testType);
			String api = PROJECTS_API + projectID + "/logs";
			String url = MicroclimateTestUtils.getBaseURL(testType, PORT, PROTOCOL) + api;

			HttpResponse httpResponse = MicroclimateTestUtils.callAPIURLParameters(url, "GET", testType);
			int httpResult = httpResponse.getResponseCode();

			Logger.println(MicroprofileProjectAPITests.class, "TestD001getProjectLogs()", "HttpResult is: " + httpResult);
			assertEquals(HttpURLConnection.HTTP_OK, httpResult);

		    JsonObject jsonObject = httpResponse.getResponseBodyAsJsonObject();

		    JsonObject build = jsonObject.getJsonObject("build");
		    assertNotNull(build);
		    String buildOrigin = build.getString("origin");
		    assertNotNull(buildOrigin);
		    assertTrue(buildOrigin.equals("workspace") || buildOrigin.equals("container"));
		    JsonArray buildFiles = build.getJsonArray("files");
		    assertNotNull(buildFiles);
		    for(JsonValue arrayVals : buildFiles){
		    	String filename = arrayVals.toString();
		    	assertTrue(MicroclimateTestUtils.checkFileExistsInContainer(filename, buildOrigin.equals("workspace") ? "codewind-pfe" : projectName, testType));
	        }

		    JsonObject app = jsonObject.getJsonObject("app");
		    assertNotNull(app);
		    String appOrigin = app.getString("origin");
		    assertNotNull(appOrigin);
		    assertTrue(appOrigin.equals("workspace") || appOrigin.equals("container"));
		    JsonArray appFiles = app.getJsonArray("files");
		    assertNotNull(appFiles);
		    for(JsonValue arrayVals : appFiles){
		    	String filename = arrayVals.toString();
		    	assertTrue(MicroclimateTestUtils.checkFileExistsInContainer(filename, appOrigin.equals("workspace") ? "codewind-pfe" : projectName, testType));
	        }

		    /* SAMPLE RESPONSE:
		    {
			    "logs": {
			        "build": {
			            "origin": "workspace",
			            "files": [
			                "/codewind-workspace/.logs/lib-c2281250-36b4-11e9-a069-19717268a986/maven.build.log",
			                "/codewind-workspace/.logs/lib-c2281250-36b4-11e9-a069-19717268a986/docker.build.log"
			            ]
			        },
			        "app": {
			            "origin": "workspace",
			            "dir": "/codewind-workspace/microprofileapp1/mc-target/liberty/wlp/usr/servers/defaultServer/logs/ffdc",
			            "files": [
			                "/codewind-workspace/microprofileapp1/mc-target/liberty/wlp/usr/servers/defaultServer/logs/messages.log",
			                "/codewind-workspace/microprofileapp1/mc-target/liberty/wlp/usr/servers/defaultServer/logs/console.log"
			            ]
			        }
			    }
			}
		    */
		}
		catch( Exception e ) {
			Logger.println(MicroprofileProjectAPITests.class, "TestD001getProjectLogs()", "Exception occurred during get project logs: " + e.getMessage(),e);
			fail("Exception occurred during project get logs");
		}
	}

	@Test(timeout=30000) //30 seconds timeout
	public void TestD002getProjectLogsInvalidProject() {
		try {
			String api = PROJECTS_API + projectName + "/logs";
			String url = MicroclimateTestUtils.getBaseURL(testType, PORT, PROTOCOL) + api;

			HttpResponse httpResponse = MicroclimateTestUtils.callAPIURLParameters(url, "GET", testType);
			int httpResult = httpResponse.getResponseCode();

			Logger.println(MicroprofileProjectAPITests.class, "TestD002getProjectLogsInvalidProject()", "HttpResult is: " + httpResult);
			assertEquals(HttpURLConnection.HTTP_NOT_FOUND, httpResult);
		}
		catch( Exception e ) {
			Logger.println(MicroprofileProjectAPITests.class, "TestD002getProjectLogsInvalidProject()", "Exception occurred during get project logs: " + e.getMessage(),e);
			fail("Exception occurred during project get logs");
		}
	}

	@Test(timeout=30000) //30 seconds timeout
	public void TestE001actionInvalid() {
		try {
			String projectID = MicroclimateTestUtils.getProjectID(projectName, testType);
			String urlParameters = "{\"action\": \"xxx\", \"projectID\": \"" + projectID + "\",\"projectType\": \"liberty\",\"location\": \"/codewind-workspace/" + projectName + "\"}";
			HttpResponse httpResponse = MicroclimateTestUtils.callAPIBodyParameters(ACTION_API, urlParameters, PROTOCOL, PORT, "POST", testType);
			int httpResult = httpResponse.getResponseCode();
			Logger.println(MicroprofileProjectAPITests.class, "TestE001actionInvalid()", "HttpResult is: " + httpResult);
			assertEquals(HttpURLConnection.HTTP_BAD_REQUEST, httpResult);
		}
		catch( Exception e ) {
			Logger.println(MicroprofileProjectAPITests.class, "TestE001actionInvalid()", "Exception occurred during project action: " + e.getMessage(),e);
			fail("Exception occurred during project build & run");
		}

		return;
	}

	@Test(timeout=30000) //30 seconds timeout
	public void TestE002actionValidate() {
		final String projectValidatedEvent = "projectValidated";

		try {
			String projectID = MicroclimateTestUtils.getProjectID(projectName, testType);
			String urlParameters = "{\"action\": \"validate\",\"projectID\": \"" + projectID + "\",\"projectType\": \"liberty\",\"location\": \"/codewind-workspace/" + projectName + "\"}";
			Logger.println(MicroprofileProjectAPITests.class, "TestE002actionValidate()", "Validation test with URL parameters: " + urlParameters);
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

			Logger.println(MicroprofileProjectAPITests.class, "TestE002actionValidate()", "HttpResult is: " + httpResult);
			assertEquals(HttpURLConnection.HTTP_ACCEPTED, httpResult);
		}
		catch( Exception e ) {
			Logger.println(MicroprofileProjectAPITests.class, "TestE002actionValidate()", "Exception occurred during project action: " + e.getMessage(),e);
			fail("Exception occurred during project action");
		}

		return;
	}


	@Test(timeout=30000) //30 seconds timeout
	public void TestE003actionValidateInvalidLocation() {
		try {
			String projectID = MicroclimateTestUtils.getProjectID(projectName, testType);
			String urlParameters = "{\"action\": \"validate\",\"projectID\": \"" + projectID + "\",\"projectType\": \"liberty\",\"location\": \"/codewind-workspacexxx/" + projectName + "\"}";
			HttpResponse httpResponse = MicroclimateTestUtils.callAPIBodyParameters(ACTION_API, urlParameters, PROTOCOL, PORT, "POST", testType);
			int httpResult = httpResponse.getResponseCode();
			Logger.println(MicroprofileProjectAPITests.class, "TestE003actionValidateInvalidLocation()", "HttpResult is: " + httpResult);
			assertEquals(HttpURLConnection.HTTP_NOT_FOUND, httpResult);
		}
		catch( Exception e ) {
			Logger.println(MicroprofileProjectAPITests.class, "TestE003actionValidateInvalidLocation()", "Exception occurred during project action: " + e.getMessage(),e);
			fail("Exception occurred during project action");
		}

		return;
	}

	@Test(timeout=30000) //30 seconds timeout
	public void TestE004actionValidateInvalidProjectType() {
		try {
			String projectID = MicroclimateTestUtils.getProjectID(projectName, testType);
			String urlParameters = "{\"action\": \"validate\",\"projectID\": \"" + projectID + "\",\"projectType\": \"libertyxxx\",\"location\": \"/codewind-workspace/" + projectName + "\"}";
			HttpResponse httpResponse = MicroclimateTestUtils.callAPIBodyParameters(ACTION_API, urlParameters, PROTOCOL, PORT, "POST", testType);
			int httpResult = httpResponse.getResponseCode();
			Logger.println(MicroprofileProjectAPITests.class, "TestE004actionValidateInvalidProjectType()", "HttpResult is: " + httpResult);
			assertEquals(HttpURLConnection.HTTP_BAD_REQUEST, httpResult);
		}
		catch( Exception e ) {
			Logger.println(MicroprofileProjectAPITests.class, "TestE004actionValidateInvalidProjectType()", "Exception occurred during project action: " + e.getMessage(),e);
			fail("Exception occurred during project action");
		}

		return;
	}

	@Test(timeout=30000) //30 seconds timeout
	public void TestE005actionValidateDifferentProjectTypeSpring() {
		final String projectValidatedEvent = "projectValidated";
		try {
			String projectID = MicroclimateTestUtils.getProjectID(projectName, testType);
			String urlParameters = "{\"action\": \"validate\",\"projectID\": \"" + projectID + "\",\"projectType\": \"spring\",\"location\": \"/codewind-workspace/" + projectName + "\"}";
			Logger.println(MicroprofileProjectAPITests.class, "TestE006actionValidateDifferentProjectTypeSpring()", "Validation test with URL parameters: " + urlParameters);
			String[] eventsOfInterest = {projectValidatedEvent};
			MicroclimateTestUtils.PairedResponse pairedResponse = MicroclimateTestUtils.callAPIBodyParametersWSocketResponse(ACTION_API, urlParameters, PROTOCOL, PORT, "POST", testType, eventsOfInterest, 5);
			int httpResult = pairedResponse.httpResponse.getResponseCode();

			assertEquals("Expecting only 1 socket event", 1, pairedResponse.socketEvents.length);
			SocketEvent se = pairedResponse.socketEvents[0];
			Logger.println(MicroprofileProjectAPITests.class, "TestE005actionValidateDifferentProjectTypeSpring()", "Socket msg     : " + se.getMsg());
			assertEquals("Unexpected socket event received", projectValidatedEvent, se.getMsg());
			Logger.println(MicroprofileProjectAPITests.class, "TestE005actionValidateDifferentProjectTypeSpring()", "Socket event details : " + se.getDetails().toString());
			JSONArray results = se.getDetails().getJSONArray("results");
			assertNotNull(results);

			// Expecting validation to fail
			assertEquals("Expected 2 results", 2, results.length());
			JSONObject resultsObj = results.getJSONObject(0);
			assertEquals("error", resultsObj.getString("severity"));
			assertEquals("pom.xml", resultsObj.getString("filename"));
			assertEquals(projectName + "/pom.xml", resultsObj.getString("filepath"));
			assertEquals("invalid", resultsObj.getString("type"));
			assertEquals("Invalid packaging for Spring project", resultsObj.getString("label"));
			assertEquals("This project's pom.xml specifies an invalid packaging for its output. Only Spring projects with jar packaging are supported for this project type.", resultsObj.getString("details"));

			resultsObj = results.getJSONObject(1);
			assertEquals("error", resultsObj.getString("severity"));
			assertEquals("pom.xml", resultsObj.getString("filename"));
			assertEquals(projectName + "/pom.xml", resultsObj.getString("filepath"));
			assertEquals("invalid", resultsObj.getString("type"));
			assertEquals("Spring Boot dependency not found", resultsObj.getString("label"));
			assertEquals("This project is identified as a Spring project but the pom.xml does not have the required configuration for Spring projects. See the Importing Projects documentation for more information.", resultsObj.getString("details"));

			Logger.println(MicroprofileProjectAPITests.class, "TestE005actionValidateDifferentProjectTypeSpring()", "HttpResult is: " + httpResult);
			assertEquals(HttpURLConnection.HTTP_ACCEPTED, httpResult);
		}
		catch( Exception e ) {
			Logger.println(MicroprofileProjectAPITests.class, "TestE005actionValidateDifferentProjectTypeSpring()", "Exception occurred during project action: " + e.getMessage(),e);
			fail("Exception occurred during project action");
		}
		return;
	}

	@Test(timeout=30000) //30 seconds timeout
	public void TestE006actionValidateDifferentProjectTypeNodeJS() {
		final String projectValidatedEvent = "projectValidated";
		try {
			String projectID = MicroclimateTestUtils.getProjectID(projectName, testType);
			String urlParameters = "{\"action\": \"validate\",\"projectID\": \"" + projectID + "\",\"projectType\": \"nodejs\",\"location\": \"/codewind-workspace/" + projectName + "\"}";
			Logger.println(MicroprofileProjectAPITests.class, "TestE007actionValidateDifferentProjectTypeNodeJS()", "Validation test with URL parameters: " + urlParameters);
			String[] eventsOfInterest = {projectValidatedEvent};
			MicroclimateTestUtils.PairedResponse pairedResponse = MicroclimateTestUtils.callAPIBodyParametersWSocketResponse(ACTION_API, urlParameters, PROTOCOL, PORT, "POST", testType, eventsOfInterest, 5);
			int httpResult = pairedResponse.httpResponse.getResponseCode();
			assertEquals("Expecting only 1 socket event", 1, pairedResponse.socketEvents.length);
			SocketEvent se = pairedResponse.socketEvents[0];
			Logger.println(MicroprofileProjectAPITests.class, "TestE006actionValidateDifferentProjectTypeNodeJS()", "Socket msg     : " + se.getMsg());
			assertEquals("Unexpected socket event received", projectValidatedEvent, se.getMsg());
			Logger.println(MicroprofileProjectAPITests.class, "TestE006actionValidateDifferentProjectTypeNodeJS()", "Socket event details : " + se.getDetails().toString());
			JSONArray results = se.getDetails().getJSONArray("results");
			assertNotNull(results);

			// Expecting validation to fail
			assertEquals("Expected 1 result", 1, results.length());
			JSONObject resultsObj = results.getJSONObject(0);
			assertEquals("error", resultsObj.getString("severity"));
			assertEquals("package.json", resultsObj.getString("filename"));
			assertEquals(projectName + "/package.json", resultsObj.getString("filepath"));
			assertEquals("missing", resultsObj.getString("type"));
			assertEquals("Missing required file", resultsObj.getString("label"));
			assertEquals("package.json is required but was not found.", resultsObj.getString("details"));

			Logger.println(MicroprofileProjectAPITests.class, "TestE006actionValidateDifferentProjectTypeNodeJS()", "HttpResult is: " + httpResult);
			assertEquals(HttpURLConnection.HTTP_ACCEPTED, httpResult);
		}
		catch( Exception e ) {
			Logger.println(MicroprofileProjectAPITests.class, "TestE006actionValidateDifferentProjectTypeNodeJS()", "Exception occurred during project action: " + e.getMessage(),e);
			fail("Exception occurred during project action");
		}

		return;
	}

	@Test(timeout=30000) //30 seconds timeout
	public void TestE007actionValidateDifferentProjectTypeSwift() {
		final String projectValidatedEvent = "projectValidated";
		try {
			String projectID = MicroclimateTestUtils.getProjectID(projectName, testType);
			String urlParameters = "{\"action\": \"validate\",\"projectID\": \"" + projectID + "\",\"projectType\": \"swift\",\"location\": \"/codewind-workspace/" + projectName + "\"}";
			Logger.println(MicroprofileProjectAPITests.class, "TestE008actionValidateDifferentProjectTypeSwift()", "Validation test with URL parameters: " + urlParameters);
			String[] eventsOfInterest = {projectValidatedEvent};
			MicroclimateTestUtils.PairedResponse pairedResponse = MicroclimateTestUtils.callAPIBodyParametersWSocketResponse(ACTION_API, urlParameters, PROTOCOL, PORT, "POST", testType, eventsOfInterest, 5);
			int httpResult = pairedResponse.httpResponse.getResponseCode();
			assertEquals("Expecting only 1 socket event", 1, pairedResponse.socketEvents.length);
			SocketEvent se = pairedResponse.socketEvents[0];
			Logger.println(MicroprofileProjectAPITests.class, "TestE007actionValidateDifferentProjectTypeSwift()", "Socket msg     : " + se.getMsg());
			assertEquals("Unexpected socket event received", projectValidatedEvent, se.getMsg());
			Logger.println(MicroprofileProjectAPITests.class, "TestE007actionValidateDifferentProjectTypeSwift()", "Socket event details : " + se.getDetails().toString());
			JSONArray results = se.getDetails().getJSONArray("results");
			assertNotNull(results);

			// Expecting validation to fail
			assertEquals("Expected 1 result", 1, results.length());
			JSONObject resultsObj = results.getJSONObject(0);
			assertEquals("error", resultsObj.getString("severity"));
			assertEquals("Package.swift", resultsObj.getString("filename"));
			assertEquals(projectName + "/Package.swift", resultsObj.getString("filepath"));
			assertEquals("missing", resultsObj.getString("type"));
			assertEquals("Missing required file", resultsObj.getString("label"));
			assertEquals("Package.swift is required but was not found.", resultsObj.getString("details"));

			Logger.println(MicroprofileProjectAPITests.class, "TestE007actionValidateDifferentProjectTypeSwift()", "HttpResult is: " + httpResult);
			assertEquals(HttpURLConnection.HTTP_ACCEPTED, httpResult);
		}
		catch( Exception e ) {
			Logger.println(MicroprofileProjectAPITests.class, "TestE007actionValidateDifferentProjectTypeSwift()", "Exception occurred during project action: " + e.getMessage(),e);
			fail("Exception occurred during project action");
		}

		return;
	}

	@Test(timeout=30000) //30 seconds timeout
	public void TestF001actionDisableAutobuild() {
		try {
			String projectID = MicroclimateTestUtils.getProjectID(projectName, testType);
			String urlParameters = "{\"action\": \"disableautobuild\",\"projectID\": \"" + projectID + "\"}";
			HttpResponse httpResponse = MicroclimateTestUtils.callAPIBodyParameters(ACTION_API, urlParameters, PROTOCOL, PORT, "POST", testType);
			int httpResult = httpResponse.getResponseCode();

			Logger.println(MicroprofileProjectAPITests.class, "TestF001actionDisableAutobuild()", "HttpResult is: " + httpResult);
			assertEquals(HttpURLConnection.HTTP_OK, httpResult);

			JsonObject responseBody = httpResponse.getResponseBodyAsJsonObject();
			assertEquals("success", responseBody.getString("status"));
		}
		catch( Exception e ) {
			Logger.println(MicroprofileProjectAPITests.class, "TestF001actionDisableAutobuild()", "Exception occurred during project action: " + e.getMessage(),e);
			fail("Exception occurred during project action");
		}

		return;
	}

	@Test(timeout=30000) //30 seconds timeout
	public void TestF002actionEnableAutobuild() {
		try {
			String projectID = MicroclimateTestUtils.getProjectID(projectName, testType);
			String urlParameters = "{\"action\": \"enableautobuild\",\"projectID\": \"" + projectID + "\"}";
			HttpResponse httpResponse = MicroclimateTestUtils.callAPIBodyParameters(ACTION_API, urlParameters, PROTOCOL, PORT, "POST", testType);
			int httpResult = httpResponse.getResponseCode();

			Logger.println(MicroprofileProjectAPITests.class, "TestF002actionEnableAutobuild()", "HttpResult is: " + httpResult);
			assertEquals(HttpURLConnection.HTTP_ACCEPTED, httpResult);

			JsonObject responseBody = httpResponse.getResponseBodyAsJsonObject();
			assertEquals("success", responseBody.getString("status"));
		}
		catch( Exception e ) {
			Logger.println(MicroprofileProjectAPITests.class, "TestF001actionEnableAutobuild()", "Exception occurred during project action: " + e.getMessage(),e);
			fail("Exception occurred during project action");
		}

		return;
	}

	@Test(timeout=30000) //30 seconds timeout
	public void TestF003actionDisableAutobuildInvalidProjectID() {
		try {
			String urlParameters = "{\"action\": \"disableautobuild\",\"projectID\": \"" + projectName + "\"}";
			HttpResponse httpResponse = MicroclimateTestUtils.callAPIBodyParameters(ACTION_API, urlParameters, PROTOCOL, PORT, "POST", testType);
			int httpResult = httpResponse.getResponseCode();

			Logger.println(MicroprofileProjectAPITests.class, "TestF003actionDisableAutobuildInvalidProjectID()", "HttpResult is: " + httpResult);
			assertEquals(HttpURLConnection.HTTP_INTERNAL_ERROR, httpResult);

			JsonObject responseBody = httpResponse.getResponseBodyAsJsonObject();
			assertEquals("failed", responseBody.getString("status"));
		}
		catch( Exception e ) {
			Logger.println(MicroprofileProjectAPITests.class, "TestF003actionDisableAutobuildInvalidProjectID()", "Exception occurred during project action: " + e.getMessage(),e);
			fail("Exception occurred during project action");
		}

		return;
	}

	@Test(timeout=30000) //30 seconds timeout
	public void TestF004actionEnableAutobuildInvalidProjectID() {
		try {
			String urlParameters = "{\"action\": \"enableautobuild\",\"projectID\": \"" + projectName + "\"}";
			HttpResponse httpResponse = MicroclimateTestUtils.callAPIBodyParameters(ACTION_API, urlParameters, PROTOCOL, PORT, "POST", testType);
			int httpResult = httpResponse.getResponseCode();

			Logger.println(MicroprofileProjectAPITests.class, "TestF004actionEnableAutobuildInvalidProjectID()", "HttpResult is: " + httpResult);
			assertEquals(HttpURLConnection.HTTP_INTERNAL_ERROR, httpResult);

			JsonObject responseBody = httpResponse.getResponseBodyAsJsonObject();
			assertEquals("failed", responseBody.getString("status"));
		}
		catch( Exception e ) {
			Logger.println(MicroprofileProjectAPITests.class, "TestF004actionEnableAutobuildInvalidProjectID()", "Exception occurred during project action: " + e.getMessage(),e);
			fail("Exception occurred during project action");
		}

		return;
	}

	@Test(timeout=420000) //7 minutes timeout
	public void TestG001actionBuild() {
		final String projectChangedEvent = "projectChanged";
		final String projectStatusChangedEvent = "projectStatusChanged";

		try {
			String projectID = MicroclimateTestUtils.getProjectID(projectName, testType);
			String urlParameters = "{\"action\": \"build\",\"projectType\": \"liberty\", \"projectID\": \"" + projectID + "\"}";
			String[] eventsOfInterest = {projectChangedEvent,projectStatusChangedEvent};
			MicroclimateTestUtils.PairedResponse pairedResponse = MicroclimateTestUtils.callAPIBodyParametersWSocketResponse(ACTION_API, urlParameters, PROTOCOL, PORT, "POST", testType, eventsOfInterest, 300);
			int httpResult = pairedResponse.httpResponse.getResponseCode();

			Logger.println(MicroprofileProjectAPITests.class, "TestG001actionBuild()", "HttpResult is: " + httpResult);
			assertEquals(HttpURLConnection.HTTP_ACCEPTED, httpResult);

			JsonObject responseBody = pairedResponse.httpResponse.getResponseBodyAsJsonObject();
			assertNotNull(responseBody.getString("operationId"));

			assertEquals("Expecting only 1 socket event", 1, pairedResponse.socketEvents.length);
			SocketEvent se = pairedResponse.socketEvents[0];
			Logger.println(MicroprofileProjectAPITests.class, "TestG001actionBuild()", "Socket msg: " + se.getMsg());
			assertEquals("Unexpected socket event received", projectChangedEvent, se.getMsg());
			Logger.println(MicroprofileProjectAPITests.class, "TestG001actionBuild()", "Socket event details: " + se.getDetails().toString());

			JSONObject socketResponseBody = se.getDetails();
			assertNotNull(socketResponseBody);
			assertEquals(projectID, socketResponseBody.getString("projectID"));
			assertEquals("success", socketResponseBody.getString("status"));

		}
		catch( Exception e ) {
			Logger.println(MicroprofileProjectAPITests.class, "TestG001actionBuild()", "Exception occurred during project action: " + e.getMessage(),e);
			fail("Exception occurred during project action");
		}

		return;
	}


	@Test(timeout=60000) //1 min timeout
	public void TestG002checkLastbuildTimestamp() {
		try {
			Thread.sleep(3000); // pause for a short time
			String projectID = MicroclimateTestUtils.getProjectID(projectName, testType);
			SocketEvent[] statusChangedEvent = MicroclimateTestUtils.getProjectStatusChangedEvents(projectID);
			for(SocketEvent event : statusChangedEvent) {
				JSONObject socketResponseBody = event.getDetails();
				assertNotNull(socketResponseBody);
				assertEquals(projectID, socketResponseBody.getString("projectID"));
				if(socketResponseBody.has("buildStatus") && (socketResponseBody.getString("buildStatus").equals("success") || socketResponseBody.getString("buildStatus").equals("failed"))) {
					assertNotNull(socketResponseBody.getString("lastbuild"));
					if (lastbuild == null)
						lastbuild = socketResponseBody.getString("lastbuild");
					else if(Long.parseLong(socketResponseBody.getString("lastbuild")) >  Long.parseLong(lastbuild))
						lastbuild = socketResponseBody.getString("lastbuild");
					Logger.println(MicroprofileProjectAPITests.class, "TestG002checkLastbuildTimestamp()", "lastbuild timestamp is: " + lastbuild);
				}
			}
		}
		catch( Exception e ) {
			Logger.println(MicroprofileProjectAPITests.class, "TestG002checkLastbuildTimestamp()", "Exception occurred when checking for lastbuild timestamp: " + e.getMessage(),e);
			fail("Exception occurred when checking for lastbuild timestamp");
		}
	}

	@Test(timeout=60000) //60 seconds timeout
	public void TestG004actionBuildInvalidProjectID() {
		try {
			String urlParameters = "{\"action\": \"build\",\"projectType\": \"liberty\", \"projectID\": \"" + projectName + "\"}";
			HttpResponse httpResponse = MicroclimateTestUtils.callAPIBodyParameters(ACTION_API, urlParameters, PROTOCOL, PORT, "POST", testType);
			int httpResult = httpResponse.getResponseCode();

			Logger.println(MicroprofileProjectAPITests.class, "TestG004actionBuildInvalidProjectID()", "HttpResult is: " + httpResult);
			assertEquals(HttpURLConnection.HTTP_INTERNAL_ERROR, httpResult);
		}
		catch( Exception e ) {
			Logger.println(MicroprofileProjectAPITests.class, "TestG004actionBuildInvalidProjectID()", "Exception occurred during project action: " + e.getMessage(),e);
			fail("Exception occurred during project action");
		}

		return;
	}

	@Test(timeout=60000) //60 seconds timeout
	public void TestG005actionBuildInvalidProjectType() {
		try {
			String urlParameters = "{\"action\": \"build\",\"projectType\": \"nodejs\", \"projectID\": \"" + projectName + "\"}";
			HttpResponse httpResponse = MicroclimateTestUtils.callAPIBodyParameters(ACTION_API, urlParameters, PROTOCOL, PORT, "POST", testType);
			int httpResult = httpResponse.getResponseCode();

			Logger.println(MicroprofileProjectAPITests.class, "TestG005actionBuildInvalidProjectType()", "HttpResult is: " + httpResult);
			assertEquals(HttpURLConnection.HTTP_INTERNAL_ERROR, httpResult);
		}
		catch( Exception e ) {
			Logger.println(MicroprofileProjectAPITests.class, "TestG005actionBuildInvalidProjectType()", "Exception occurred during project action: " + e.getMessage(),e);
			fail("Exception occurred during project action");
		}

		return;
	}

	@Test(timeout=30000) //30 seconds timeout
	public void TestH001getProjectStatusApp() {
		try {
			String projectID = MicroclimateTestUtils.getProjectID(projectName, testType);
			String api = STATUS_API + "?type=appState&projectID=" + projectID;
			String url = MicroclimateTestUtils.getBaseURL(testType, PORT, PROTOCOL) + api;

			HttpResponse httpResponse = MicroclimateTestUtils.callAPIURLParameters(url, "GET", testType);
			int httpResult = httpResponse.getResponseCode();

			Logger.println(MicroprofileProjectAPITests.class, "TestH001getProjectStatusApp()", "HttpResult is: " + httpResult);
			assertEquals(HttpURLConnection.HTTP_OK, httpResult);

		    JsonObject jsonObject = httpResponse.getResponseBodyAsJsonObject();
		    String appStatus = jsonObject.getString("appStatus");
		    assertNotNull(appStatus);
		    assertTrue(appStatus.equals("starting") || appStatus.equals("started") || appStatus.equals("stopping")
		    								|| appStatus.equals("stopped") || appStatus.equals("unknown"));
		    // note: complete app status testing is done in the smoke tests
		}
		catch( Exception e ) {
			Logger.println(MicroprofileProjectAPITests.class, "TestH001getProjectStatusApp()", "Exception occurred during get project status: " + e.getMessage(),e);
			fail("Exception occurred during project get logs");
		}
	}

	@Test(timeout=30000) //30 seconds timeout
	public void TestH002getProjectStatusBuild() {
		try {
			String projectID = MicroclimateTestUtils.getProjectID(projectName, testType);
			String api = STATUS_API + "?type=buildState&projectID=" + projectID;
			String url = MicroclimateTestUtils.getBaseURL(testType, PORT, PROTOCOL) + api;

			HttpResponse httpResponse = MicroclimateTestUtils.callAPIURLParameters(url, "GET", testType);
			int httpResult = httpResponse.getResponseCode();

			Logger.println(MicroprofileProjectAPITests.class, "TestH002getProjectStatusBuild()", "HttpResult is: " + httpResult);
			assertEquals(HttpURLConnection.HTTP_OK, httpResult);

		    JsonObject jsonObject = httpResponse.getResponseBodyAsJsonObject();
		    String buildStatus = jsonObject.getString("buildStatus");
		    assertNotNull(buildStatus);
		    assertTrue(buildStatus.equals("inProgress") || buildStatus.equals("success") || buildStatus.equals("failed") || buildStatus.equals("unknown"));
		    assertFalse(jsonObject.getJsonObject("buildRequired").getBoolean("state"));
		    assertNotNull(jsonObject.getString("detailedBuildStatus"));
		    if (buildStatus.equals("success") || buildStatus.equals("failed"))
			 {
				assertEquals(lastbuild, jsonObject.getJsonNumber("lastbuild").toString());
				// note: complete build status testing is done in the smoke tests
			}
		}
		catch( Exception e ) {
			Logger.println(MicroprofileProjectAPITests.class, "TestH002getProjectStatusBuild()", "Exception occurred during get project status: " + e.getMessage(),e);
			fail("Exception occurred during get project status");
		}
	}

	@Test(timeout=30000) //30 seconds timeout
	public void TestH003getProjectStatusInvalidRequest() {
		try {
			String url = MicroclimateTestUtils.getBaseURL(testType, PORT, PROTOCOL) + STATUS_API;

			HttpResponse httpResponse = MicroclimateTestUtils.callAPIURLParameters(url, "GET", testType);
			int httpResult = httpResponse.getResponseCode();

			Logger.println(MicroprofileProjectAPITests.class, "TestH003getProjectStatusInvalidRequest()", "HttpResult is: " + httpResult);
			assertEquals(HttpURLConnection.HTTP_BAD_REQUEST, httpResult);
		}
		catch( Exception e ) {
			Logger.println(MicroprofileProjectAPITests.class, "TestH003getProjectStatusInvalidRequest()", "Exception occurred during get project status: " + e.getMessage(),e);
			fail("Exception occurred during project get logs");
		}
	}

	@Test(timeout=30000) //30 seconds timeout
	public void TestH004getProjectStatusInvalidProjectID() {
		try {
			String api = STATUS_API + "?type=buildState&projectID=" + projectName;
			String url = MicroclimateTestUtils.getBaseURL(testType, PORT, PROTOCOL) + api;

			HttpResponse httpResponse = MicroclimateTestUtils.callAPIURLParameters(url, "GET", testType);
			int httpResult = httpResponse.getResponseCode();

			Logger.println(MicroprofileProjectAPITests.class, "TestH004getProjectStatusInvalidProjectID()", "HttpResult is: " + httpResult);
			assertEquals(HttpURLConnection.HTTP_NOT_FOUND, httpResult);
		}
		catch( Exception e ) {
			Logger.println(MicroprofileProjectAPITests.class, "TestH004getProjectStatusInvalidProjectID()", "Exception occurred during get project status: " + e.getMessage(),e);
			fail("Exception occurred during project get logs");
		}
	}

	@Test(timeout=30000) //30 seconds timeout
	public void TestJ001getProjectCapabilities() {
		try {
			String projectID = MicroclimateTestUtils.getProjectID(projectName, testType);
			String api = PROJECTS_API + projectID + "/capabilities";
			String url = MicroclimateTestUtils.getBaseURL(testType, PORT, PROTOCOL) + api;

			HttpResponse httpResponse = MicroclimateTestUtils.callAPIURLParameters(url, "GET", testType);
			int httpResult = httpResponse.getResponseCode();

			Logger.println(MicroprofileProjectAPITests.class, "TestJ001getProjectCapabilities()", "HttpResult is: " + httpResult);
			assertEquals(HttpURLConnection.HTTP_OK, httpResult);

			JsonObject capabilities = httpResponse.getResponseBodyAsJsonObject().getJsonObject("capabilities");
			assertNotNull(capabilities);
			JsonArray startModes = capabilities.getJsonArray("startModes");
			assertNotNull(startModes);
			assertTrue(MicroclimateTestUtils.jsonArrayContains(startModes, "\"run\""));
			assertTrue(MicroclimateTestUtils.jsonArrayContains(startModes, "\"debug\""));
			JsonArray controlCommands = capabilities.getJsonArray("controlCommands");
			assertNotNull(controlCommands);
			assertTrue(MicroclimateTestUtils.jsonArrayContains(controlCommands, "\"restart\""));
		}
		catch( Exception e ) {
			Logger.println(MicroprofileProjectAPITests.class, "TestJ001getProjectCapabilities()", "Exception occurred during get project types: " + e.getMessage(),e);
			fail("Exception occurred during project get types");
		}
	}


	@Test(timeout=30000) //30 seconds timeout
	public void TestJ002getProjectCapabilitiesInvalidProjectID() {
		try {
			String api = PROJECTS_API + projectName + "/capabilities";
			String url = MicroclimateTestUtils.getBaseURL(testType, PORT, PROTOCOL) + api;

			HttpResponse httpResponse = MicroclimateTestUtils.callAPIURLParameters(url, "GET", testType);
			int httpResult = httpResponse.getResponseCode();

			Logger.println(MicroprofileProjectAPITests.class, "TestJ002getProjectCapabilitiesInvalidProjectID()", "HttpResult is: " + httpResult);
			assertEquals(HttpURLConnection.HTTP_NOT_FOUND, httpResult);
		}
		catch( Exception e ) {
			Logger.println(MicroprofileProjectAPITests.class, "TestJ002getProjectCapabilitiesInvalidProjectID()", "Exception occurred during get project types: " + e.getMessage(),e);
			fail("Exception occurred during project get types");
		}
	}

	/*
	@Test(timeout=300000) //5 mins timeout
	public void TestK001changeContextRoot() {
		try {
			final String projectSettingsChangedEvent = "projectSettingsChanged";
			String[] eventsOfInterest = {projectSettingsChangedEvent};
			String projectID = MicroclimateTestUtils.getProjectID(projectName, testType);
			String SettingsAPI = MicroclimateTestUtils.getSettingsAPI(projectID);
			String urlParameters = "{\"settings\": [{\"name\": \"contextRoot\",\"value\": \"contextliberty\"}]}";
			MicroclimateTestUtils.PairedResponse pairedResponse = MicroclimateTestUtils.callAPIBodyParametersWSocketResponse(SettingsAPI, urlParameters, PROTOCOL, PORT, "POST", testType, eventsOfInterest, 300);
			int httpResult = pairedResponse.httpResponse.getResponseCode();
			Logger.println(MicroprofileProjectAPITests.class, "TestK001changeContextRoot()", "HttpResult is: " + httpResult);
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
			assertEquals("/contextliberty", socketResponseBody.getString("contextRoot"));
			assertEquals("success", socketResponseBody.getString("status"));

			// Wait for the stop project to finish
			long timeout = 60000;
			boolean isStop = MicroclimateTestUtils.waitForProjectStopped(projectID, testType, timeout);
			assertTrue("Project " + projectName + " did not stop within " + timeout + "ms", isStop);

			urlParameters = "{\"settings\": [{\"name\": \"contextRoot\",\"value\": \"/\"}]}";
			pairedResponse = MicroclimateTestUtils.callAPIBodyParametersWSocketResponse(SettingsAPI, urlParameters, PROTOCOL, PORT, "POST", testType, eventsOfInterest, 300);
			httpResult = pairedResponse.httpResponse.getResponseCode();
			Logger.println(MicroprofileProjectAPITests.class, "TestK001changeContextRoot()", "HttpResult is: " + httpResult);
			assertEquals(HttpURLConnection.HTTP_ACCEPTED, httpResult);

			// Wait for the start project to finish
			boolean isStart = MicroclimateTestUtils.waitForProjectStarted(projectID, testType, timeout);
			assertTrue("Project " + projectName + " did not start within " + timeout + "ms", isStart);

			exposedPort = MicroclimateTestUtils.getexposedPort(projectName, testType, projectType);
			assertNotNull("exposedPort for project " + projectName +" is null", exposedPort);
			String expectedString = "Hello, your application is up and running";
			String api = "/v1/example";

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
				Logger.println(MicroprofileProjectAPITests.class, "TestK001changeContextRoot()", "Exception occurred when checking for endpoint after setting context root",e);
				fail("Exception occurred when checking for endpoint after setting context root");
			}
		}
		catch( Exception e ) {
			Logger.println(MicroprofileProjectAPITests.class, "TestK001changeContextRoot()", "Exception occurred when setting context root: " + e.getMessage(),e);
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
			Logger.println(MicroprofileProjectAPITests.class, "TestK002changeContextRootInvalidContextRoot()", "HttpResult is: " + httpResult);
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
			Logger.println(MicroprofileProjectAPITests.class, "TestK002changeContextRootInvalidContextRoot()", "Exception occurred when setting invlid context root: " + e.getMessage(),e);
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
			String urlParameters = "{\"settings\": [{\"name\": \"healthCheck\",\"value\": \"healthliberty\"}]}";
			MicroclimateTestUtils.PairedResponse pairedResponse = MicroclimateTestUtils.callAPIBodyParametersWSocketResponse(SettingsAPI, urlParameters, PROTOCOL, PORT, "POST", testType, eventsOfInterest, 300);
			int httpResult = pairedResponse.httpResponse.getResponseCode();
			Logger.println(MicroprofileProjectAPITests.class, "TestK003changeHealthCheck()", "HttpResult is: " + httpResult);
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
			assertEquals("/healthliberty", socketResponseBody.getString("healthCheck"));
			assertEquals("success", socketResponseBody.getString("status"));

			// Wait for the stop project to finish
			long timeout = 60000;
			boolean isStop = MicroclimateTestUtils.waitForProjectStopped(projectID, testType, timeout);
			assertTrue("Project " + projectName + " did not stop within " + timeout + "ms", isStop);

			urlParameters = "{\"settings\": [{\"name\": \"healthCheck\",\"value\": \"/\"}]}";
			pairedResponse = MicroclimateTestUtils.callAPIBodyParametersWSocketResponse(SettingsAPI, urlParameters, PROTOCOL, PORT, "POST", testType, eventsOfInterest, 300);
			httpResult = pairedResponse.httpResponse.getResponseCode();
			Logger.println(MicroprofileProjectAPITests.class, "TestK003changeHealthCheck()", "HttpResult is: " + httpResult);
			assertEquals(HttpURLConnection.HTTP_ACCEPTED, httpResult);

			// Wait for the start project to finish
			boolean isStart = MicroclimateTestUtils.waitForProjectStarted(projectID, testType, timeout);
			assertTrue("Project " + projectName + " did not start within " + timeout + "ms", isStart);

			exposedPort = MicroclimateTestUtils.getexposedPort(projectName, testType, projectType);
			assertNotNull("exposedPort for project " + projectName +" is null", exposedPort);
			String expectedString = "Hello, your application is up and running";
			String api = "/v1/example";

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
				Logger.println(MicroprofileProjectAPITests.class, "TestK003changeHealthCheck()", "Exception occurred when checking for endpoint after setting context root",e);
				fail("Exception occurred when checking for endpoint after setting context root");
			}
		}
		catch( Exception e ) {
			Logger.println(MicroprofileProjectAPITests.class, "TestK003changeHealthCheck()", "Exception occurred when setting context root: " + e.getMessage(),e);
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
			Logger.println(MicroprofileProjectAPITests.class, "TestK004changeHealthCheckInvalidHealthCheck()", "HttpResult is: " + httpResult);
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
			Logger.println(MicroprofileProjectAPITests.class, "TestK004changeHealthCheckInvalidHealthCheck()", "Exception occurred when setting invlid context root: " + e.getMessage(),e);
			fail("Exception occurred when setting invlid context root");
		}
	}
	*/

	@Test(timeout=30000) //30 seconds timeout
	public void TestK005checkProjectSettingsInvalidProjectID() {
		try {
			String projectID = "invalidProjectID";
			String SettingsAPI = MicroclimateTestUtils.getSettingsAPI(projectID);
			String urlParameters = "{\"settings\": {\"internalDebugPort\" : \"7888\"}}";
			HttpResponse httpResponse = MicroclimateTestUtils.callAPIBodyParameters(SettingsAPI, urlParameters, PROTOCOL, PORT, "POST", testType);
			int httpResult = httpResponse.getResponseCode();

			Logger.println(MicroprofileProjectAPITests.class, "TestK005checkProjectSettingsInvalidProjectID()", "HttpResult is: " + httpResult);
			assertEquals(HttpURLConnection.HTTP_NOT_FOUND, httpResult);

			JsonObject responseBody = httpResponse.getResponseBodyAsJsonObject();
			assertEquals("failed", responseBody.getString("status"));
		}
		catch( Exception e ) {
			Logger.println(MicroprofileProjectAPITests.class, "TestK005checkProjectSettingsInvalidProjectID()", "Exception occurred when setting debug port: " + e.getMessage(),e);
			fail("Exception occurred when setting debug port");
		}
	}

	@Test(timeout=30000) //30 seconds timeout
	public void TestK006checkProjectSettingsNoSettings() {
		try {
			String projectID = MicroclimateTestUtils.getProjectID(projectName, testType);
			String SettingsAPI = MicroclimateTestUtils.getSettingsAPI(projectID);
			String urlParameters = "{\"testParam\": {\"debugPort\" : \"7888\"}}";
			HttpResponse httpResponse = MicroclimateTestUtils.callAPIBodyParameters(SettingsAPI, urlParameters, PROTOCOL, PORT, "POST", testType);
			int httpResult = httpResponse.getResponseCode();

			Logger.println(MicroprofileProjectAPITests.class, "TestK006checkProjectSettingsNoSettings()", "HttpResult is: " + httpResult);
			assertEquals(HttpURLConnection.HTTP_BAD_REQUEST, httpResult);

		}
		catch( Exception e ) {
			Logger.println(MicroprofileProjectAPITests.class, "TestK006checkProjectSettingsNoSettings()", "Exception occurred when setting debug port: " + e.getMessage(),e);
			fail("Exception occurred when setting debug port");
		}
	}

	@Test(timeout=600000) //10 mins timeout
	public void TestK007changeDebugPortDebugMode() {
		//directly return, since icp does not support debugMode.
		if(testType == "icp") {
			return;
		}
		try {
			final String projectSettingsChangedEvent = "projectSettingsChanged";
			String[] eventsOfInterest = {projectSettingsChangedEvent};
			String projectID = MicroclimateTestUtils.getProjectID(projectName, testType);
			String SettingsAPI = MicroclimateTestUtils.getSettingsAPI(projectID);
			String urlParameters = "{\"settings\": {\"internalDebugPort\" : \"7888\"}}";
			MicroclimateTestUtils.PairedResponse pairedResponse = MicroclimateTestUtils.callAPIBodyParametersWSocketResponse(SettingsAPI, urlParameters, PROTOCOL, PORT, "POST", testType, eventsOfInterest, 540);
			int httpResult = pairedResponse.httpResponse.getResponseCode();
			Logger.println(MicroprofileProjectAPITests.class, "TestK008changeDebugPortDebugMode()", "HttpResult is: " + httpResult);
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
			assertNotNull(socketResponseBody.getJSONObject("ports"));
			assertNotNull(socketResponseBody.getJSONObject("ports").getString("exposedPort"));
			assertNotNull(socketResponseBody.getJSONObject("ports").getString("internalPort"));
			assertNotNull(socketResponseBody.getJSONObject("ports").getString("exposedDebugPort"));
			assertNotNull(socketResponseBody.getJSONObject("ports").getString("internalDebugPort"));
			assertEquals("success", socketResponseBody.getString("status"));
			assertEquals("7888", socketResponseBody.getJSONObject("ports").getString("internalDebugPort"));
			// should get stuck in Starting state now

		}
		catch( Exception e ) {
			Logger.println(MicroprofileProjectAPITests.class, "TestK008changeDebugPortDebugMode()", "Exception occurred when setting debug port: " + e.getMessage(),e);
			fail("Exception occurred when setting debug port");
		}
	}

	@Test(timeout = 180000) // 3 mins timeout
	public void TestK008changeApplicationPortNotExposedPort() {
		try {
			final String projectSettingsChangedEvent = "projectSettingsChanged";
			String[] eventsOfInterest = { projectSettingsChangedEvent };
			String projectID = MicroclimateTestUtils.getProjectID(projectName, testType);
			String SettingsAPI = MicroclimateTestUtils.getSettingsAPI(projectID);
			String urlParameters = "{\"settings\": {\"internalAppPort\" : \"4321\"}}";

			MicroclimateTestUtils.PairedResponse pairedResponse = MicroclimateTestUtils
					.callAPIBodyParametersWSocketResponse(SettingsAPI, urlParameters, PROTOCOL, PORT, "POST", testType,
							eventsOfInterest, 300);
			int httpResult = pairedResponse.httpResponse.getResponseCode();
			Logger.println(MicroprofileProjectAPITests.class, "TestK009changeApplicationPortNotExposedPort()",
					"HttpResult is: " + httpResult);
			assertEquals(HttpURLConnection.HTTP_ACCEPTED, httpResult);

			JsonObject responseBody = pairedResponse.httpResponse.getResponseBodyAsJsonObject();
			Logger.println(MicroprofileProjectAPITests.class, "TestK009changeApplicationPortNotExposedPort()",
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

		} catch (Exception e) {
			Logger.println(MicroprofileProjectAPITests.class, "TestK009changeApplicationPortNotExposedPort()",
					"Exception occurred when setting application port: " + e.getMessage(), e);
			fail("Exception occurred when setting application port");
		}
	}

	// Perform the change Application Port in the end before delete, because the app will not be in started state
	@Test(timeout = 1200000) // 20 mins timeout
	public void TestK009changeApplicationPortExposedPort() {
		assertNotNull("exposedPort for project " + projectName +" is null", exposedPort);
		String Dockerfile = "Dockerfile";
		String content = "EXPOSE 4321";

		try {
			final String projectSettingsChangedEvent = "projectSettingsChanged";
			String[] eventsOfInterest = { projectSettingsChangedEvent };
			String projectID = MicroclimateTestUtils.getProjectID(projectName, testType);
			String SettingsAPI = MicroclimateTestUtils.getSettingsAPI(projectID);
			String urlParameters = "{\"settings\": {\"internalAppPort\" : \"4321\"}}";

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
			Logger.println(MicroprofileProjectAPITests.class, "TestK010changeApplicationPortExposedPort()",
					"HttpResult is: " + httpResult);
			assertEquals(HttpURLConnection.HTTP_ACCEPTED, httpResult);

			JsonObject responseBody = pairedResponse.httpResponse.getResponseBodyAsJsonObject();
			Logger.println(MicroprofileProjectAPITests.class, "TestK010changeApplicationPortExposedPort()",
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

		} catch (Exception e) {
			Logger.println(MicroprofileProjectAPITests.class, "TestK010changeApplicationPortExposedPort()",
					"Exception occurred when setting application port: " + e.getMessage(), e);
			fail("Exception occurred when setting application port");
		}

	}

	// ==================================================
	// NOTE: perform any tests that modify/delete project artifacts
	// right before project delete as that could impact other tests
	// ==================================================

	@Test(timeout=30000) //30 seconds timeout
	public void TestY001actionValidateIncorrectPOM() throws Exception {
		MicroclimateTestUtils.updateFile(MicroclimateTestUtils.workspace + projectName + "/pom.xml", "net.wasdev.wlp.maven.parent", "INVALID.PARENT.GROUP");
		MicroclimateTestUtils.updateFile(MicroclimateTestUtils.workspace + projectName + "/pom.xml", "liberty-maven-app-parent", "INVALID.PARENT.ARTIFACT_ID");
		MicroclimateTestUtils.updateFile(MicroclimateTestUtils.workspace + projectName + "/pom.xml", "<value>microclimate</value>", "<value>INVALID.PROFILE</value>");

		final String projectValidatedEvent = "projectValidated";
		try {
			String projectID = MicroclimateTestUtils.getProjectID(projectName, testType);
			String urlParameters = "{\"action\": \"validate\",\"projectID\": \"" + projectID + "\",\"projectType\": \"liberty\",\"location\": \"/codewind-workspace/" + projectName + "\"}";
			Logger.println(MicroprofileProjectAPITests.class, "TestY001actionValidateIncorrectPOM()", "Validation test with URL parameters: " + urlParameters);
			String[] eventsOfInterest = {projectValidatedEvent};
			MicroclimateTestUtils.PairedResponse pairedResponse = MicroclimateTestUtils.callAPIBodyParametersWSocketResponse(ACTION_API, urlParameters, PROTOCOL, PORT, "POST", testType, eventsOfInterest, 5);
			int httpResult = pairedResponse.httpResponse.getResponseCode();
			assertEquals("Expecting only 1 socket event", 1, pairedResponse.socketEvents.length);
			SocketEvent se = pairedResponse.socketEvents[0];
			Logger.println(MicroprofileProjectAPITests.class, "TestY001actionValidateIncorrectPOM()", "Socket msg     : " + se.getMsg());
			assertEquals("Unexpected socket event received", projectValidatedEvent, se.getMsg());
			Logger.println(MicroprofileProjectAPITests.class, "TestY001actionValidateIncorrectPOM()", "Socket event details : " + se.getDetails().toString());
			JSONArray results = se.getDetails().getJSONArray("results");

			assertNotNull(results);

			// Expecting validation to fail
			assertEquals(3, results.length());

			// Validate parent Group ID
			JSONObject resultsObj = results.getJSONObject(0);
			assertEquals("error", resultsObj.getString("severity"));
			assertEquals("pom.xml", resultsObj.getString("filename"));
			assertEquals(projectName + "/pom.xml", resultsObj.getString("filepath"));
			assertEquals("invalid", resultsObj.getString("type"));
			assertEquals("Missing Liberty parent POM groupId", resultsObj.getString("label"));
			assertEquals("A Liberty parent POM declaration is required. The parent groupId should be <groupId>net.wasdev.wlp.maven.parent</groupId>", resultsObj.getString("details"));

			// Validate parent Artifact ID
			resultsObj = results.getJSONObject(1);
			assertEquals("error", resultsObj.getString("severity"));
			assertEquals("pom.xml", resultsObj.getString("filename"));
			assertEquals(projectName + "/pom.xml", resultsObj.getString("filepath"));
			assertEquals("invalid", resultsObj.getString("type"));
			assertEquals("Missing Liberty parent POM artifactId", resultsObj.getString("label"));
			assertEquals("A Liberty parent POM declaration is required. The parent artifactId should be <artifactId>liberty-maven-app-parent</artifactId>", resultsObj.getString("details"));

			// Validate missing microclimate profile
			resultsObj = results.getJSONObject(2);
			assertEquals("error", resultsObj.getString("severity"));
			assertEquals("pom.xml", resultsObj.getString("filename"));
			assertEquals(projectName + "/pom.xml", resultsObj.getString("filepath"));
			assertEquals("invalid", resultsObj.getString("type"));
			assertEquals("Missing profile activation", resultsObj.getString("label"));
			assertEquals("Missing a profile activation property libertyEnv=microclimate. See the project import documentation for more details.", resultsObj.getString("details"));

			Logger.println(MicroprofileProjectAPITests.class, "TestY001actionValidateIncorrectPOM()", "HttpResult is: " + httpResult);
			assertEquals(HttpURLConnection.HTTP_ACCEPTED, httpResult);
		}
		catch( Exception e ) {
			Logger.println(MicroprofileProjectAPITests.class, "TestY001actionValidateIncorrectPOM()", "Exception occurred during project action: " + e.getMessage(),e);
			fail("Exception occurred during project action");
		}

		return;
	}

	@Test(timeout=30000) //30 seconds timeout
	public void TestY002actionValidateMissingPOM() throws Exception {
		MicroclimateTestUtils.deleteFile(MicroclimateTestUtils.workspace + projectName + "/pom.xml");
		final String projectValidatedEvent = "projectValidated";
		try {
			String projectID = MicroclimateTestUtils.getProjectID(projectName, testType);
			String urlParameters = "{\"action\": \"validate\",\"projectID\": \"" + projectID + "\",\"projectType\": \"liberty\",\"location\": \"/codewind-workspace/" + projectName + "\"}";
			Logger.println(MicroprofileProjectAPITests.class, "TestY002actionValidateMissingPOM()", "Validation test with URL parameters: " + urlParameters);
			String[] eventsOfInterest = {projectValidatedEvent};
			MicroclimateTestUtils.PairedResponse pairedResponse = MicroclimateTestUtils.callAPIBodyParametersWSocketResponse(ACTION_API, urlParameters, PROTOCOL, PORT, "POST", testType, eventsOfInterest, 5);
			int httpResult = pairedResponse.httpResponse.getResponseCode();
			assertEquals("Expecting only 1 socket event", 1, pairedResponse.socketEvents.length);
			SocketEvent se = pairedResponse.socketEvents[0];
			Logger.println(MicroprofileProjectAPITests.class, "TestY002actionValidateMissingPOM()", "Socket msg     : " + se.getMsg());
			assertEquals("Unexpected socket event received", projectValidatedEvent, se.getMsg());
			Logger.println(MicroprofileProjectAPITests.class, "TestY002actionValidateMissingPOM()", "Socket event details : " + se.getDetails().toString());
			JSONArray results = se.getDetails().getJSONArray("results");

			assertNotNull(results);

			// Expecting validation to fail
			assertEquals("Expected 1 result", 1, results.length());
			JSONObject resultsObj = results.getJSONObject(0);
			assertEquals("error", resultsObj.getString("severity"));
			assertEquals("pom.xml", resultsObj.getString("filename"));
			assertEquals(projectName + "/pom.xml", resultsObj.getString("filepath"));
			assertEquals("missing", resultsObj.getString("type"));
			assertEquals("Missing required file", resultsObj.getString("label"));
			assertEquals("pom.xml is required but was not found.", resultsObj.getString("details"));

			Logger.println(MicroprofileProjectAPITests.class, "TestY002actionValidateMissingPOM()", "HttpResult is: " + httpResult);
			assertEquals(HttpURLConnection.HTTP_ACCEPTED, httpResult);
		}
		catch( Exception e ) {
			Logger.println(MicroprofileProjectAPITests.class, "TestY002actionValidateMissingPOM()", "Exception occurred during project action: " + e.getMessage(),e);
			fail("Exception occurred during project action");
		}

		return;
	}

	@Test(timeout=30000) //30 seconds timeout
	public void TestZ001projectDeleteInvalidProjectID() {
		try {
			String api = PROJECTS_API + projectName;
			String url = MicroclimateTestUtils.getBaseURL(testType, PORT, PROTOCOL) + api;

			HttpResponse httpResponse = MicroclimateTestUtils.callAPIURLParameters(url, "DELETE", testType);
			int httpResult = httpResponse.getResponseCode();

			Logger.println(MicroprofileProjectAPITests.class, "TestZ001projectDeleteInvalidProjectID()", "HttpResult is: " + httpResult);
			assertTrue(httpResult == HttpURLConnection.HTTP_NOT_FOUND);
		}
		catch( Exception e ) {
			Logger.println(MicroprofileProjectAPITests.class, "TestZ001projectDeleteInvalidProjectID()", "Exception occurred during project delete: " + e.getMessage(),e);
			fail("Exception occurred during project delete");
		}
	}

	@Test(timeout=300000) //5 mins timeout
	public void TestZ002projectDelete() {
		final String projectDeletionEvent = "projectDeletion";

		try {
			String projectID = MicroclimateTestUtils.getProjectID(projectName, testType);
			String api = PROJECTS_API + projectID;
			String url = MicroclimateTestUtils.getBaseURL(testType, PORT, PROTOCOL) + api;

			String[] eventsOfInterest = {projectDeletionEvent};
			MicroclimateTestUtils.PairedResponse pairedResponse = MicroclimateTestUtils.callAPIURLParametersWSocketResponse(url, "DELETE", testType, eventsOfInterest, 300);
			int httpResult = pairedResponse.httpResponse.getResponseCode();

			Logger.println(MicroprofileProjectAPITests.class, "TestZ002projectDelete()", "HttpResult is: " + httpResult);
			assertEquals(HttpURLConnection.HTTP_ACCEPTED, httpResult);

			assertEquals("Expecting only 1 socket event", 1, pairedResponse.socketEvents.length);
			SocketEvent se = pairedResponse.socketEvents[0];
			Logger.println(MicroprofileProjectAPITests.class, "TestZ002projectDelete()", "Socket msg: " + se.getMsg());
			assertEquals("Unexpected socket event received", projectDeletionEvent, se.getMsg());
			Logger.println(MicroprofileProjectAPITests.class, "TestZ002projectDelete()", "Socket event details: " + se.getDetails().toString());

			JSONObject socketResponseBody = se.getDetails();
			assertNotNull(socketResponseBody);
			assertNotNull(socketResponseBody.getString("operationId"));
			assertEquals(projectID, socketResponseBody.getString("projectID"));
			assertEquals("success", socketResponseBody.getString("status"));
		}
		catch( Exception e ) {
			Logger.println(MicroprofileProjectAPITests.class, "TestZ002projectDelete()", "Exception occurred during project delete: " + e.getMessage(),e);
			fail("Exception occurred during project delete");
		}
	}
}
