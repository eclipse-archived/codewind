package org.eclipse.codewind.microclimate.smoketest;

import static org.junit.Assert.*;

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
import org.eclipse.codewind.microclimate.test.util.SocketUtil.SocketEvent;
import org.junit.FixMethodOrder;
import org.junit.Rule;
import org.junit.Test;
import org.junit.runners.MethodSorters;

@FixMethodOrder(MethodSorters.NAME_ASCENDING)
public class MicroprofileCreationAndUpdate extends AbstractMicroclimateTest {
	public static String exposedPort;
	public static String projectName = "liberty" + SUITE_TYPES.smoketest + (new Date().getTime());
	private static String nonDefaultWorkspace = System.getProperty("microclimate.workspace");
	private static String workspace = nonDefaultWorkspace == null ? System.getProperty("user.home") + "/codewind-workspace/" : nonDefaultWorkspace.endsWith("/") ? nonDefaultWorkspace : nonDefaultWorkspace + "/";
	private static String testType = System.getProperty("testType");
	private static PROJECT_TYPES projectType = PROJECT_TYPES.liberty;

    @Rule
    public RetryRule retry = new RetryRule(MicroclimateTestUtils.retryCount);

    @Test(timeout=180000) //3 minutes timeout
	public void TestAcreate(){
    	Logger.println(MicroprofileCreationAndUpdate.class, "TestAcreate()", ">>> MicroprofileCreationAndUpdate.TestAcreate");
		if (testType.equalsIgnoreCase("icp") && System.getProperty("ns") != null) MicroclimateTestUtils.setDefaultNS(System.getProperty("ns"));

		String urlParameters  ="{\"name\": \"" + projectName + "\",\"language\": \"java\",\"framework\": \"microprofile\"}";

		// Start up sockets listener for project status change events
		StatusTrackingUtil.startStatusTrackingListener();
		int HttpResult = MicroclimateTestUtils.projectCreation(urlParameters, testType);
		Logger.println(MicroprofileCreationAndUpdate.class, "TestAcreate()", "HttpResult is: " + HttpResult);
		assertTrue(HttpResult == HttpURLConnection.HTTP_ACCEPTED);

		return;
	}

	@Test(timeout=30000) //30 seconds timeout
	public void TestBcheckForProject() {
		Logger.println(MicroprofileCreationAndUpdate.class, "TestBcheckForProject()", ">>> MicroprofileCreationAndUpdate.TestBcheckForProject");
		while(true) {
			if(MicroclimateTestUtils.checkProjectExistency(projectName, testType)) {
				return;
			} else {
				sleep(3000);
			}
		}
	}

	@Test(timeout=600000) //10 mins timeout
	public void TestCcheckForContainer() {
		Logger.println(MicroprofileCreationAndUpdate.class, "TestCcheckForContainer()", ">>> MicroprofileCreationAndUpdate.TestCcheckForContainer");
		exposedPort = MicroclimateTestUtils.getexposedPort(projectName, testType, projectType);
		Logger.println(MicroprofileCreationAndUpdate.class, "TestCcheckForContainer()", "Exposed Port is " + exposedPort);
		assertNotNull("exposedPort for project " + projectName +" is null", exposedPort);

		return;
	}

	@Test(timeout=300000) //3 mins timeout
	public void TestEcheckEndpoint() {
		Logger.println(MicroprofileCreationAndUpdate.class, "TestEcheckEndpoint()", ">>> MicroprofileCreationAndUpdate.TestEcheckEndpoint");
		assertNotNull("exposedPort for project " + projectName +" is null", exposedPort);
		String expectedString = "Congratulations, your application is up and running";
		String api = "/v1/example";

		while(true) {
		Logger.log();
			if(MicroclimateTestUtils.checkEndpoint(expectedString, exposedPort, api, testType)) {
				String projectID = MicroclimateTestUtils.getProjectID(projectName, testType);
				// Check application & build status transitions
				StatusTrackingUtil.checkAppStatusTransitionsForCreate(projectID, 120);
				StatusTrackingUtil.checkBuildStatusTransitionsForCreate(projectID, 120);
				return;
			} else {
				sleep(3000);
			}
		}
	}

	@Test(timeout=1200000) //20 mins timeout
	public void TestFupdate() {
		Logger.println(MicroprofileCreationAndUpdate.class, "TestFupdate()", ">>> MicroprofileCreationAndUpdate.TestFupdate");
		assertNotNull("exposedPort for project " + projectName +" is null", exposedPort);
		String expectedString = "Hello, your application is up and running";


		String projectID = MicroclimateTestUtils.getProjectID(projectName, testType);

		// Clear the current project status states transitions records
		StatusTrackingUtil.clearStatusEventsRecord(projectID);

		MicroclimateTestUtils.updateFile(testType, projectName, "src/main/java/application/rest/v1/Example.java", "Example.java", "Congratulations", "Hello");
		String api = "/v1/example";
		//Disable the app status check for microprofile update
		//since there is a known issue with the liberty-maven plugin that would cause a double update
		MicroclimateTestUtils.pingApp(expectedString, exposedPort, api, testType);
//		while(true) {
//
//			if(MicroclimateTestUtils.checkEndpoint(expectedString, exposedPort, api, testType)) {
//				// Check application & build status transitions (previously when using polling, only final state was checked)
//				StatusTrackingUtil.checkAppStatusTransitionsForUpdate(projectID, 120);
//				StatusTrackingUtil.checkBuildStatusTransitionsForUpdate(projectID, 120);
//				return;
//			} else {
//				Thread.sleep(3000);
//			}
//		}
	}

//	@Test(timeout=420000) // 5 mins timeout
//	public void TestGautoBuild() {
//		Logger.println(MicroprofileCreationAndUpdate.class, "TestGautoBuild()", ">>> MicroprofileCreationAndUpdate.TestGautoBuild");
//		assertNotNull("exposedPort for project " + projectName +" is null", exposedPort);
//
//		// Get the project ID - needed for requests
//		String projectID = null;
//			projectID = MicroclimateTestUtils.getProjectID(projectName, testType);
//
//		try {
//			// Disable auto build
//			MicroclimateTestUtils.setAutoBuild(projectID, testType, false);
// 			// Wait for autobuild to be disabled
// 			try {
// 				while (MicroclimateTestUtils.getEnableAutobuild(projectID, testType)) {
// 					Thread.sleep(1000);
// 				}
// 			} catch(Exception e) {
// 				Logger.println(MicroprofileCreationAndUpdate.class, "TestGautoBuild()", "Exception occurred when checking enableAutobuild",e);
// 				fail("Exception occurred when enableAutobuild");
// 			}
//			// Check that build required is false
//			assertFalse("Build required should be false", MicroclimateTestUtils.getBuildRequired(projectID, testType));
//
//			// Update the application
//			String api = "/v1/example";
//			String originalString = "Hello";
//			String originalText = "Hello, your application is up and running";
//			String newString = "Felicitations";
//			String newText = "Felicitations, your application is up and running";
//			MicroclimateTestUtils.updateFile(testType, projectName, "src/main/java/application/rest/v1/Example.java", "Example.java", originalString, newString);
//
//			// Wait for build required to be set
//				while (!MicroclimateTestUtils.getBuildRequired(projectID, testType)) {
//					sleep(1000);
//				}
//
//			// Check that the original string is still returned when the application is pinged (no build has been requested yet)
//			MicroclimateTestUtils.pingApp(originalText, exposedPort, api, testType);
//
//			Logger.log("Requesting a build after pinging app");
//
//			SocketEvent[] eventsBeforeBuildRequest = StatusTrackingUtil.getSocketUtilInstance().getStatusChangedEvents(projectID);
//
//			// Request a build
//			MicroclimateTestUtils.requestBuild(projectID, testType);
//
//			Logger.log("Starting to wait for project status changed event:");
//			assertTrue("App should restart after build request", StatusTrackingUtil.detectAppRestartNew(projectID, 150, eventsBeforeBuildRequest));
//
//			// Get the new exposed port
//			TestCcheckForContainer();
//
//			// Check that the new string is returned when the application is pinged
//			MicroclimateTestUtils.pingApp(newText, exposedPort, api, testType);
//		} finally {
//			// Make sure auto build is enabled
//			MicroclimateTestUtils.setAutoBuild(projectID, testType, true);
//		}
//	}

	@Test(timeout = 1200000) //20 mins timeout
	public void TestHmodifyDockerFile() {
		Logger.println(MicroprofileCreationAndUpdate.class, "TestHmodifyDockerFile()", ">>> MicroprofileCreationAndUpdate.TestHmodifyDockerFile");
		assertNotNull("exposedPort for project " + projectName +" is null", exposedPort);

		String Dockerfile = "Dockerfile";
		String content = "RUN mkdir -m 777 -p /home/default/test_directory";

		String projectID = MicroclimateTestUtils.getProjectID(projectName, testType);

		// Clear the current project status states transitions records
		StatusTrackingUtil.clearStatusEventsRecord(projectID);

		MicroclimateTestUtils.updateDockerFile(testType, projectName, Dockerfile, content);

		while(true) {
			if(MicroclimateTestUtils.checkContainerChange(projectName, testType)) {
				StatusTrackingUtil.checkBuildStatusTransitionsForUpdate(projectID, 300);
				return;
			} else {
				sleep(3000);
			}
		}
	}

	@Test(timeout=600000) //10 mins timeout
	public void TestIdelete() {
		Logger.println(MicroprofileCreationAndUpdate.class, "TestIdelete()", ">>> MicroprofileCreationAndUpdate.TestIdelete");
		String path =workspace + projectName;

		// only if this is the 1st time trying, then we run the portal project deletion
		if (MicroclimateTestUtils.retryCount == retry.getRetriesLeft()) {
			try {
				int responseCode = MicroclimateTestUtils.projectdeletion(projectName, testType);
				assertTrue("expected response code " + HttpURLConnection.HTTP_ACCEPTED + ", found " + responseCode, responseCode == HttpURLConnection.HTTP_ACCEPTED);
			} catch (Exception e) {
				Logger.println(MicroprofileCreationAndUpdate.class, "TestIdelete()", "Exception occurred during project deletion: " + e.getMessage(),e);
				fail("Exception occurred during project deletion");
			}
		}

		if (testType.equalsIgnoreCase("local")) {
			File projectDirectory = new File(path);

				if (MicroclimateTestUtils.existContainer(projectName)) {
					fail("Project deletion failed! Project container still exists.");
				}

				if (MicroclimateTestUtils.existImage(projectName)) {
					fail("Project deletion failed! Project image still exists.");
				}
		} else if (testType.equalsIgnoreCase("icp")) {
			String pod = MicroclimateTestUtils.getFileWatcherPod();
			String dirName = projectName;

			sleep(5000);
			if (MicroclimateTestUtils.existPod(projectName)) {
				fail("Project deletion failed! Project pod still exists.");
			}
		}
	}
}
