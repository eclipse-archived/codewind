package org.eclipse.codewind.microclimate.smoketest;

import static org.junit.Assert.*;

import java.io.File;
import java.net.HttpURLConnection;
import java.util.Date;

import org.eclipse.codewind.microclimate.test.util.Logger;
import org.eclipse.codewind.microclimate.test.util.MicroclimateTestUtils;
import org.eclipse.codewind.microclimate.test.util.RetryRule;
import org.eclipse.codewind.microclimate.test.util.StatusTrackingUtil;
import org.eclipse.codewind.microclimate.test.util.MicroclimateTestUtils.PROJECT_TYPES;
import org.eclipse.codewind.microclimate.test.util.MicroclimateTestUtils.SUITE_TYPES;
import org.junit.FixMethodOrder;
import org.junit.Rule;
import org.junit.runners.MethodSorters;
import org.junit.Test;

@FixMethodOrder(MethodSorters.NAME_ASCENDING)
public class GoCreationAndUpdate {
	private static String exposedPort;
	private static String projectName = "go" + SUITE_TYPES.smoketest + (new Date().getTime());
	private static String nonDefaultWorkspace = System.getProperty("microclimate.workspace");
	private static String workspace = nonDefaultWorkspace == null ? System.getProperty("user.home") + "/codewind-workspace/" : nonDefaultWorkspace.endsWith("/") ? nonDefaultWorkspace : nonDefaultWorkspace + "/";
	private static String testType = System.getProperty("testType");
	private static PROJECT_TYPES projectType = PROJECT_TYPES.go;

    @Rule
    public RetryRule retry = new RetryRule(MicroclimateTestUtils.retryCount);

    @Test(timeout=180000) //3 minutes timeout
	public void TestAcreate(){
    	Logger.println(GoCreationAndUpdate.class, "TestAcreate()", ">>> GoCreationAndUpdate.TestAcreate");
		if (testType.equalsIgnoreCase("icp") && System.getProperty("ns") != null) MicroclimateTestUtils.setDefaultNS(System.getProperty("ns"));

		String urlParameters  ="{\"name\": \"" + projectName + "\",\"extension\": \"templateGoExample\",\"language\": \"go\"}";

		try {
			// Start up sockets listener for project status change events
			StatusTrackingUtil.startStatusTrackingListener();
			int HttpResult = MicroclimateTestUtils.projectCreation(urlParameters, testType);
			Logger.println(GoCreationAndUpdate.class, "TestAcreate()", "HttpResult is: " + HttpResult);
			assertTrue(HttpResult == HttpURLConnection.HTTP_ACCEPTED);
		}catch(Exception e) {
			Logger.println(GoCreationAndUpdate.class, "TestAcreate()", "Exception occurred during project creation: " + e.getMessage(),e);
			fail("Exception occurred during project creation.");
		}

		return;
	}

	@Test(timeout=30000) //30 seconds timeout
	public void TestBcheckForProject() {
		try {
			Logger.println(GoCreationAndUpdate.class, "TestBcheckForProject()", ">>> GoCreationAndUpdate.TestBcheckForProject");
			while(true) {
				if(MicroclimateTestUtils.checkProjectExistency(projectName, testType)) {
					return;
				} else {
					Thread.sleep(3000);
				}
			}
		}catch(Exception e) {
			Logger.println(GoCreationAndUpdate.class, "TestBcheckForProject()", "Exception occurred when looking for project in projectList: " + e.getMessage(),e);
			fail("Exception occurred when looking for project in projectList");
		}
	}

	@Test(timeout=600000) //10 mins timeout
	public void TestCcheckForContainer() {
		try {
			Logger.println(GoCreationAndUpdate.class, "TestCcheckForContainer()", ">>> GoCreationAndUpdate.TestCcheckForContainer");
			exposedPort = MicroclimateTestUtils.getexposedPort(projectName, testType, projectType);
			Logger.println(GoCreationAndUpdate.class, "TestCcheckForContainer()", "Exposed Port is " + exposedPort);
			assertNotNull("exposedPort for project " + projectName +" is null", exposedPort);
		}catch(Exception e) {
			Logger.println(GoCreationAndUpdate.class, "TestCcheckForContainer()", "Exception occurred when looking for exposedport: " + e.getMessage(),e);
			fail("Exception occurred when looking for exposedport");
		}

		return;
	}

	@Test(timeout=300000) //3 mins timeout
	public void TestEcheckEndpoint() {
		Logger.println(GoCreationAndUpdate.class, "TestEcheckEndpoint()", ">>> GoCreationAndUpdate.TestEcheckEndpoint");
		assertNotNull("exposedPort for project " + projectName +" is null", exposedPort);
		String expectedString = "Hello from your Go sample application running in Microclimate!";
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
		}catch(Exception e) {
			Logger.println(GoCreationAndUpdate.class, "TestEcheckEndpoint()", "Exception occurred when checking for endpoint",e);
			fail("Exception occurred when checking for endpoint");
		}
	}

	@Test(timeout=1200000) //20 mins timeout
	public void TestFupdate() {
		Logger.println(GoCreationAndUpdate.class, "TestFupdate()", ">>> GoCreationAndUpdate.TestFupdate");
		assertNotNull("exposedPort for project " + projectName +" is null", exposedPort);
		String expectedString = "Congratulations from your Go sample application running in Microclimate!";

		try {
			String projectID = MicroclimateTestUtils.getProjectID(projectName, testType);

			// Clear the current project status states transitions records
			StatusTrackingUtil.clearStatusEventsRecord(projectID);

			MicroclimateTestUtils.updateFile(testType, projectName, "main.go", "main.go", "Hello", "Congratulations");

			//pause for 3 second and wait for container recreate
			Thread.sleep(3000);

			while(true) {
				// Get the new exposed port
				TestCcheckForContainer();

				String api = "/";
				if(MicroclimateTestUtils.checkEndpoint(expectedString, exposedPort, api, testType)) {
					// Check application & build status transitions (previously when using polling, only final state was checked)
					return;
				} else {
					Thread.sleep(3000);
				}
			}
		}catch(Exception e) {
			Logger.println(GoCreationAndUpdate.class, "TestFupdate()", "Exception occurred when checking for endpoint",e);
			fail("Exception occurred when checking for endpoint");
		}
	}

	@Test(timeout=420000) // 5 mins timeout
	public void TestGautoBuild() {
		Logger.println(GoCreationAndUpdate.class, "TestGautoBuild()", ">>> GoCreationAndUpdate.TestGautoBuild");
		assertNotNull("exposedPort for project " + projectName +" is null", exposedPort);

		// Get the project ID - needed for requests
		String projectID = null;
		try {
			projectID = MicroclimateTestUtils.getProjectID(projectName, testType);
		} catch (Exception e) {
			Logger.println(GoCreationAndUpdate.class, "TestGautoBuild()", "Exception occurred getting the project ID: " + e.getMessage(),e);
			fail("Exception occurred getting the project ID.");
		}

		try {
			// Disable auto build
			MicroclimateTestUtils.setAutoBuild(projectID, testType, false);

			// Check that build required is false
			assertFalse("Build required should be false", MicroclimateTestUtils.getBuildRequired(projectID, testType));

			// Update the application
			String api = "/";
			String originalString = "Congratulations";
			String originalText = "Congratulations from your Go sample application running in Microclimate!";
			String newString = "Felicitations";
			String newText = "Felicitations from your Go sample application running in Microclimate!";
			MicroclimateTestUtils.updateFile(testType, projectName, "main.go", "main.go", originalString, newString);

			// Wait for build required to be set
			try {
				while (!MicroclimateTestUtils.getBuildRequired(projectID, testType)) {
					Thread.sleep(1000);
				}
			} catch(Exception e) {
				Logger.println(GoCreationAndUpdate.class, "TestGautoBuild()", "Exception occurred when checking build required",e);
				fail("Exception occurred when checking build required");
			}

			// Check that the original string is still returned when the application is pinged (no build has been requested yet)
			MicroclimateTestUtils.pingApp(originalText, exposedPort, api, testType);

			// Request a build
			MicroclimateTestUtils.requestBuild(projectID, testType);
			assertTrue("App should restart after build request", StatusTrackingUtil.detectAppRestart(projectID, 150));

			// Get the new exposed port
			TestCcheckForContainer();

			// Check that the new string is returned when the application is pinged
			MicroclimateTestUtils.pingApp(newText, exposedPort, api, testType);
		} finally {
			// Make sure auto build is enabled
			MicroclimateTestUtils.setAutoBuild(projectID, testType, true);
		}
	}

	@Test(timeout = 1200000) //20 mins timeout
	public void TestHmodifyDockerFile() {
		Logger.println(GoCreationAndUpdate.class, "TestHmodifyDockerFile()", ">>> GoCreationAndUpdate.TestHmodifyDockerFile");
		assertNotNull("exposedPort for project " + projectName +" is null", exposedPort);

		String Dockerfile = "Dockerfile";
		String content = "RUN mkdir -m 777 -p /test_directory";

		try {
			String projectID = MicroclimateTestUtils.getProjectID(projectName, testType);

			// Clear the current project status states transitions records
			StatusTrackingUtil.clearStatusEventsRecord(projectID);

			MicroclimateTestUtils.updateDockerFile(testType, projectName, Dockerfile, content);
			//pause for 3 second and wait for container recreate
			Thread.sleep(3000);

			// Get the new exposed port
			TestCcheckForContainer();

			while(true) {
				if(MicroclimateTestUtils.checkContainerChange(projectName, testType)) {
					return;
				} else {
					Thread.sleep(3000);
				}
			}
		} catch(Exception e) {
			Logger.println(GoCreationAndUpdate.class, "TestHmodifyDockerFile()", "Exception occurred when checking for container change: " + e.getMessage(),e);
			fail("Exception occurred when checking for container change");
		}
	}

	@Test(timeout=180000) //3 mins timeout
	public void TestIdelete() {
		Logger.println(GoCreationAndUpdate.class, "TestIdelete()", ">>> GoCreationAndUpdate.TestIdelete");
		String path =workspace + projectName;

		// only if this is the 1st time trying, then we run the portal project deletion
		if (MicroclimateTestUtils.retryCount == retry.getRetriesLeft()) {
			try {
				int responseCode = MicroclimateTestUtils.projectdeletion(projectName, testType);
				assertTrue("expected response code " + HttpURLConnection.HTTP_ACCEPTED + ", found " + responseCode, responseCode == HttpURLConnection.HTTP_ACCEPTED);
			} catch (Exception e) {
				Logger.println(GoCreationAndUpdate.class, "TestIdelete()", "Exception occurred during project deletion: " + e.getMessage(),e);
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
				Logger.println(GoCreationAndUpdate.class, "TestIdelete()", "Exception occurred during check if container still exists: " + e.getMessage(),e);
				fail("Exception occurred during check if container still exists");
			}

			try {
				if (MicroclimateTestUtils.existImage(projectName)) {
					fail("Project deletion failed! Project image still exists.");
				}
			} catch (Exception e) {
				Logger.println(GoCreationAndUpdate.class, "TestIdelete()", "Exception occurred during check if image still exists: " + e.getMessage(),e);
				fail("Exception occurred during check if image still exists");
			}
		} else if (testType.equalsIgnoreCase("icp")) {
			String pod = null;
			String dirName = projectName;

			try {
				pod = MicroclimateTestUtils.getFileWatcherPod();
			} catch (Exception e) {
				Logger.println(GoCreationAndUpdate.class, "TestIdelete()", "Exception occurred during get pod: " + e.getMessage(),e);
				fail("Exception occurred during get pod");
			}

			try {
				Thread.sleep(5000);
				if (MicroclimateTestUtils.existPod(projectName)) {
					fail("Project deletion failed! Project pod still exists.");
				}
			} catch (Exception e) {
				Logger.println(GoCreationAndUpdate.class, "TestIdelete()", "Exception occurred during check if pod still exists: " + e.getMessage(),e);
				fail("Exception occurred during check if pod still exists");
			}
		}
	}
}
