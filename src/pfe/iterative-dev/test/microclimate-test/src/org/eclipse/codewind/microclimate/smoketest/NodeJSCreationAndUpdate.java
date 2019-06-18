package org.eclipse.codewind.microclimate.smoketest;

import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertNotNull;
import static org.junit.Assert.assertTrue;
import static org.junit.Assert.fail;

import java.io.File;
import java.net.HttpURLConnection;
import java.util.Date;

import org.eclipse.codewind.microclimate.test.util.AbstractMicroclimateTest;
import org.eclipse.codewind.microclimate.test.util.Logger;
import org.eclipse.codewind.microclimate.test.util.MicroclimateTestUtils;
import org.eclipse.codewind.microclimate.test.util.RetryRule;
import org.eclipse.codewind.microclimate.test.util.StatusTrackingUtil;
import org.eclipse.codewind.microclimate.test.util.MicroclimateTestUtils.PROJECT_TYPES;
import org.eclipse.codewind.microclimate.test.util.MicroclimateTestUtils.SUITE_TYPES;
import org.junit.FixMethodOrder;
import org.junit.Ignore;
import org.junit.Rule;
import org.junit.Test;
import org.junit.runners.MethodSorters;

@FixMethodOrder(MethodSorters.NAME_ASCENDING)
public class NodeJSCreationAndUpdate extends AbstractMicroclimateTest {

	private static String exposedPort;
	private static String projectName = "nodejs" + SUITE_TYPES.smoketest + (new Date().getTime());
	private static String nonDefaultWorkspace = System.getProperty("microclimate.workspace");
	private static String workspace = nonDefaultWorkspace == null ? System.getProperty("user.home") + "/codewind-workspace/" : nonDefaultWorkspace.endsWith("/") ? nonDefaultWorkspace : nonDefaultWorkspace + "/";
	private static String testType = System.getProperty("testType");
	private static PROJECT_TYPES projectType = PROJECT_TYPES.nodejs;

    @Rule
    public RetryRule retry = new RetryRule(MicroclimateTestUtils.retryCount);

    @Test(timeout=180000) //3 minutes timeout
	public void TestAcreate(){
    	Logger.println(NodeJSCreationAndUpdate.class, "TestAcreate()", ">>> NodeJSCreationAndUpdate.TestAcreate");
		if (testType.equalsIgnoreCase("icp") && System.getProperty("ns") != null) MicroclimateTestUtils.setDefaultNS(System.getProperty("ns"));

		String urlParameters  ="{\"name\": \"" + projectName + "\",\"language\": \"nodejs\"}";

		try {
			// Start up sockets listener for project status change events
			StatusTrackingUtil.startStatusTrackingListener();
			int HttpResult = MicroclimateTestUtils.projectCreation(urlParameters, testType);
			Logger.println(NodeJSCreationAndUpdate.class, "TestAcreate()", "HttpResult is: " + HttpResult);
			assertTrue(HttpResult == HttpURLConnection.HTTP_ACCEPTED);
		}catch(Exception e) {
			Logger.println(NodeJSCreationAndUpdate.class, "TestAcreate()", "Exception occurred during project creation: " + e.getMessage(),e);
			fail("Exception occurred during project creation.");
		}

		return;
	}

	@Test(timeout=30000) //30 seconds timeout
	public void TestBcheckForProject() {
		try {
			Logger.println(NodeJSCreationAndUpdate.class, "TestBcheckForProject()", ">>> NodeJSCreationAndUpdate.TestBcheckForProject");
			while(true) {
				if(MicroclimateTestUtils.checkProjectExistency(projectName, testType)) {
					return;
				} else {
					Thread.sleep(3000);
				}
			}
		}catch(Exception e) {
			Logger.println(NodeJSCreationAndUpdate.class, "TestBcheckForProject()", "Exception occurred when looking for project in projectList: " + e.getMessage(),e);
			fail("Exception occurred when looking for project in projectList");
		}
	}

	@Test(timeout=600000) //10 mins timeout
	public void TestCcheckForContainer() {
		try {
			Logger.println(NodeJSCreationAndUpdate.class, "TestCcheckForContainer()", ">>> NodeJSCreationAndUpdate.TestCcheckForContainer");
			exposedPort = MicroclimateTestUtils.getexposedPort(projectName, testType, projectType);
			Logger.println(NodeJSCreationAndUpdate.class, "TestCcheckForContainer()", "Exposed Port is " + exposedPort);
			assertNotNull("exposedPort for project " + projectName +" is null", exposedPort);
		}catch(Exception e) {
			Logger.println(NodeJSCreationAndUpdate.class, "TestCcheckForContainer()", "Exception occurred when looking for exposedport: " + e.getMessage(),e);
			fail("Exception occurred when looking for exposedport");
		}

		return;
	}

	@Test(timeout=180000) //3 mins timeout
	public void TestDcheckEndpoint() {
		Logger.println(NodeJSCreationAndUpdate.class, "TestDcheckEndpoint()", ">>> NodeJSCreationAndUpdate.TestDcheckEndpoint");
		assertNotNull("exposedPort for project " + projectName +" is null", exposedPort);
		String expectedString = "Congratulations";
		String api = "/";

		try {
			while(true) {
				if(MicroclimateTestUtils.checkEndpoint(expectedString, exposedPort, api, testType)) {
					String projectID = MicroclimateTestUtils.getProjectID(projectName, testType);
					// Check application & build status transitions
					StatusTrackingUtil.checkAppStatusTransitionsForCreate(projectID, 120);
					StatusTrackingUtil.checkBuildStatusTransitionsForCreate(projectID, 120);
					return;
				} else {
					Thread.sleep(3000);
				}
			}
		} catch(Exception e) {
			Logger.println(NodeJSCreationAndUpdate.class, "TestDcheckEndpoint()", "Exception occurred when checking for endpoint",e);
			fail("Exception occurred when checking for endpoint");
		}
	}

	@Test(timeout=1200000) //20 mins timeout
	public void TestEupdate() {
		Logger.println(NodeJSCreationAndUpdate.class, "TestEupdate()", ">>> NodeJSCreationAndUpdate.TestEupdate");
		assertNotNull("exposedPort for project " + projectName +" is null", exposedPort);
		String expectedString = "testProject";

		try {
			String projectID = MicroclimateTestUtils.getProjectID(projectName, testType);

			// Clear the current project status states transitions records
			StatusTrackingUtil.clearStatusEventsRecord(projectID);

			MicroclimateTestUtils.updateFile(testType, projectName, "public/index.html", "index.html", "Congratulations", expectedString);

			while(true) {
				TestCcheckForContainer();
				String api = "/";
				if(MicroclimateTestUtils.checkEndpoint(expectedString, exposedPort, api, testType)) {
					// Check application & build status transitions
					StatusTrackingUtil.checkAppStatusTransitionsForUpdate(projectID, 1);
					StatusTrackingUtil.checkBuildStatusTransitionsForUpdate(projectID, 1);
					return;
				} else {
					Thread.sleep(3000);
				}
			}
		}catch(Exception e) {
			Logger.println(NodeJSCreationAndUpdate.class, "TestEupdate()", "Exception occurred when checking for endpoint",e);
			fail("Exception occurred when checking for endpoint");
		}
	}

	@Test(timeout=1200000) // 20 mins timeout
	public void TestFautoBuild() {
		Logger.println(NodeJSCreationAndUpdate.class, "TestFautoBuild()", ">>> NodeJSCreationAndUpdate.TestFautoBuild");
		assertNotNull("exposedPort for project " + projectName +" is null", exposedPort);

		// Get the project ID - needed for requests
		String projectID = null;
		try {
		    projectID = MicroclimateTestUtils.getProjectID(projectName, testType);
		} catch (Exception e) {
			Logger.println(NodeJSCreationAndUpdate.class, "TestFautoBuild()", "Exception occurred getting the project ID: " + e.getMessage(),e);
			fail("Exception occurred getting the project ID.");
		}

		try {
			// Update server.js
			String originalString = "// Add your code here";
			String newString = "app.get('/hello', (req, res) => res.send('Hello World!'))";
			MicroclimateTestUtils.updateFile(testType, projectName, "server/server.js", "server.js", originalString, newString);

			try {
				while(true) {
					// Get the new exposed port
					TestCcheckForContainer();

					if(MicroclimateTestUtils.checkEndpoint("Hello World!", exposedPort, "/hello", testType)) {
						break;
					} else {
						Thread.sleep(3000);
					}
				}
			} catch(Exception e) {
				Logger.println(NodeJSCreationAndUpdate.class, "TestFautoBuild()", "Exception occurred when checking for endpoint",e);
				fail("Exception occurred when checking for endpoint");
			}

			MicroclimateTestUtils.pingApp("Hello World!", exposedPort, "/hello", testType);

			// Disable auto build
			MicroclimateTestUtils.setAutoBuild(projectID, testType, false);

			if ("local".equalsIgnoreCase(testType)) {
				// In local case app restarts in order to switch from nodemon to node
				assertTrue("App should restart after disabling auto build", StatusTrackingUtil.detectAppRestart(projectID, 150));
			}

			// Make sure the app is up and running again
			MicroclimateTestUtils.pingApp("Hello World!", exposedPort, "/hello", testType);

			// Check that build required is false
			assertFalse("Build required should be false", MicroclimateTestUtils.getBuildRequired(projectID, testType));

			// Update the application
			originalString = "Hello World";
			newString = "Hello from microclimate";
			MicroclimateTestUtils.updateFile(testType, projectName, "server/server.js", "server.js", originalString, newString);

			// Wait for build required to be set
			try {
				while (!MicroclimateTestUtils.getBuildRequired(projectID, testType)) {
					Thread.sleep(1000);
				}
			} catch(Exception e) {
				Logger.println(NodeJSCreationAndUpdate.class, "TestFautoBuild()", "Exception occurred when checking build required",e);
				fail("Exception occurred when checking build required");
			}

			// Check that the original string is still returned when the application is pinged (no build has been requested yet)
			MicroclimateTestUtils.pingApp("Hello World!", exposedPort, "/hello", testType);

			// Request a build
			MicroclimateTestUtils.requestBuild(projectID, testType);
			assertTrue("App should restart after build request", StatusTrackingUtil.detectAppRestart(projectID, 150));

			try {
				while(true) {
					// Get the new exposed port
					TestCcheckForContainer();

					if(MicroclimateTestUtils.checkEndpoint("Hello from microclimate!", exposedPort, "/hello", testType)) {
						break;
					} else {
						Thread.sleep(3000);
					}
				}
			} catch(Exception e) {
				Logger.println(NodeJSCreationAndUpdate.class, "TestFautoBuild()", "Exception occurred when checking for endpoint",e);
				fail("Exception occurred when checking for endpoint");
			}

	        // Check that the new string is returned when the application is pinged
			MicroclimateTestUtils.pingApp("Hello from microclimate!", exposedPort, "/hello", testType);
		} finally {
			// Make sure auto build is enabled
			MicroclimateTestUtils.setAutoBuild(projectID, testType, true);
			if ("local".equalsIgnoreCase(testType)) {
				// In local case app restarts in order to switch from node to nodemon
				assertTrue("App should restart after enabling auto build", StatusTrackingUtil.detectAppRestart(projectID, 150));
			}
		}
	}

	@Test(timeout = 1200000) //20 mins timeout
	public void TestGmodifyDockerFile() {
		Logger.println(NodeJSCreationAndUpdate.class, "TestGmodifyDockerFile()", ">>> NodeJSCreationAndUpdate.TestGmodifyDockerFile");
		assertNotNull("exposedPort for project " + projectName +" is null", exposedPort);

		String Dockerfile = "Dockerfile";
		String content = "RUN mkdir -m 777 -p /test_directory";

		try {
			String projectID = MicroclimateTestUtils.getProjectID(projectName, testType);

			// Clear the current project status states transitions records
			StatusTrackingUtil.clearStatusEventsRecord(projectID);

			MicroclimateTestUtils.updateDockerFile(testType, projectName, Dockerfile, content);

			while(true) {
				if(MicroclimateTestUtils.checkContainerChange(projectName,testType)) {
					StatusTrackingUtil.checkBuildStatusTransitionsForUpdate(projectID, 300);
					return;
				} else {
					Thread.sleep(3000);
				}
			}
		}catch(Exception e) {
			Logger.println(NodeJSCreationAndUpdate.class, "TestGmodifyDockerFile()", "Exception occurred when checking for container change: " + e.getMessage(),e);
			fail("Exception occurred when checking for container change");
		}
	}

	@Test(timeout=30000) //30 seconds timeout
	public void TestHdelete() {
		Logger.println(NodeJSCreationAndUpdate.class, "TestHdelete()", ">>> NodeJSCreationAndUpdate.TestHdelete");
		String path = workspace + projectName;

		// only if this is the 1st time trying, then we run the portal project deletion
		if (MicroclimateTestUtils.retryCount == retry.getRetriesLeft()) {
			try {
				int responseCode = MicroclimateTestUtils.projectdeletion(projectName, testType);
				assertTrue("expected response code " + HttpURLConnection.HTTP_ACCEPTED + ", found " + responseCode, responseCode == HttpURLConnection.HTTP_ACCEPTED);
			} catch (Exception e) {
				Logger.println(NodeJSCreationAndUpdate.class, "TestHdelete()", "Exception occurred during project deletion: " + e.getMessage(),e);
				fail("Exception occurred during project deletion");
			}
		}

		if (testType.equalsIgnoreCase("local")) {
			File projectDirectory = new File(path);

			try {
				if (MicroclimateTestUtils.existContainer(projectName)) {
					fail("Project deletion failed! Project container still exists.");
				}
			} catch (Exception e) {
				Logger.println(NodeJSCreationAndUpdate.class, "TestHdelete()", "Exception occurred during check if container still exists: " + e.getMessage(),e);
				fail("Exception occurred during check if container still exists");
			}

			try {
				if (MicroclimateTestUtils.existImage(projectName)) {
					fail("Project deletion failed! Project image still exists.");
				}
			} catch (Exception e) {
				Logger.println(NodeJSCreationAndUpdate.class, "TestHdelete()", "Exception occurred during check if image still exists: " + e.getMessage(),e);
				fail("Exception occurred during check if image still exists");
			}
		} else if (testType.equalsIgnoreCase("icp")) {
			String pod = null;
			String dirName = projectName;

			try {
				pod = MicroclimateTestUtils.getFileWatcherPod();
			} catch (Exception e) {
				Logger.println(NodeJSCreationAndUpdate.class, "TestHdelete()", "Exception occurred during get pod: " + e.getMessage(),e);
				fail("Exception occurred during get pod");
			}

			try {
				Thread.sleep(5000);
				if (MicroclimateTestUtils.existPod(projectName)) {
					fail("Project deletion failed! Project pod still exists.");
				}
			} catch (Exception e) {
				Logger.println(NodeJSCreationAndUpdate.class, "TestHdelete()", "Exception occurred during check if pod still exists: " + e.getMessage(),e);
				fail("Exception occurred during check if pod still exists");
			}
		}
	}
}
