package org.eclipse.codewind.microclimate.quarantine;

import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertNotNull;
import static org.junit.Assert.assertTrue;
import static org.junit.Assert.fail;

import org.eclipse.codewind.microclimate.smoketest.MicroprofileCreationAndUpdate;
import org.eclipse.codewind.microclimate.test.util.AbstractMicroclimateTest;
import org.eclipse.codewind.microclimate.test.util.Logger;
import org.eclipse.codewind.microclimate.test.util.MicroclimateTestUtils;
import org.eclipse.codewind.microclimate.test.util.StatusTrackingUtil;
import org.eclipse.codewind.microclimate.test.util.SocketUtil.SocketEvent;
import org.junit.FixMethodOrder;
import org.junit.Test;
import org.junit.runners.MethodSorters;

@FixMethodOrder(MethodSorters.NAME_ASCENDING)
public class MicrprofileCreationAndUpdateQuarantine extends AbstractMicroclimateTest {
	
	// Handle local and ICP test cases by using this variable
	private static String testType = System.getProperty("testType");
	
	MicroprofileCreationAndUpdate smokeClass = new MicroprofileCreationAndUpdate();

	
	@Test(timeout=180000) //3 minutes timeout
	public void TestAcreate(){
		smokeClass.TestAcreate();
	}
	
	@Test(timeout=30000) //30 seconds timeout
	public void TestBcheckForProject() {
		smokeClass.TestBcheckForProject();
	}
	
	@Test(timeout=600000) //10 mins timeout
	public void TestCcheckForContainer() {
		smokeClass.TestCcheckForContainer();
	}
	
	@Test(timeout=300000) //3 mins timeout
	public void TestEcheckEndpoint() {
		smokeClass.TestEcheckEndpoint();
	}
	
	@Test(timeout=1200000) //20 mins timeout
	public void TestFupdate() {
		smokeClass.TestFupdate();
	}
	
	@Test(timeout=420000) // 7 mins timeout
	public void TestGautoBuild() {
		Logger.println(MicroprofileCreationAndUpdate.class, "TestGautoBuild()", ">>> MicroprofileCreationAndUpdate.TestGautoBuild");
		assertNotNull("exposedPort for project " + MicroprofileCreationAndUpdate.projectName +" is null", MicroprofileCreationAndUpdate.exposedPort);
		
		// Get the project ID - needed for requests
		String projectID = null;
			projectID = MicroclimateTestUtils.getProjectID(MicroprofileCreationAndUpdate.projectName, testType);
		
		try {
			// Disable auto build
			MicroclimateTestUtils.setAutoBuild(projectID, testType, false);
 			// Wait for autobuild to be disabled	
 			try {	
 				while (MicroclimateTestUtils.getEnableAutobuild(projectID, testType)) {	
 					Thread.sleep(1000);	
 				}	
 			} catch(Exception e) {	
 				Logger.println(MicroprofileCreationAndUpdate.class, "TestGautoBuild()", "Exception occurred when checking enableAutobuild",e);	
 				fail("Exception occurred when enableAutobuild");	
 			}
			// Check that build required is false
			assertFalse("Build required should be false", MicroclimateTestUtils.getBuildRequired(projectID, testType));
			
			// Update the application
			String api = "/v1/example";
			String originalString = "Hello";
			String originalText = "Hello, your application is up and running";
			String newString = "Felicitations";
			String newText = "Felicitations, your application is up and running";
			MicroclimateTestUtils.updateFile(testType, MicroprofileCreationAndUpdate.projectName, "src/main/java/application/rest/v1/Example.java", "Example.java", originalString, newString);
			
			// Wait for build required to be set
				while (!MicroclimateTestUtils.getBuildRequired(projectID, testType)) {
					sleep(1000);
				}
			
			// Check that the original string is still returned when the application is pinged (no build has been requested yet)
			MicroclimateTestUtils.pingApp(originalText, MicroprofileCreationAndUpdate.exposedPort, api, testType);
			
			Logger.log("Requesting a build after pinging app");
			
			SocketEvent[] eventsBeforeBuildRequest = StatusTrackingUtil.getSocketUtilInstance().getStatusChangedEvents(projectID);
			
			// Request a build
			MicroclimateTestUtils.requestBuild(projectID, testType);
			
			Logger.log("Starting to wait for project status changed event:");
			assertTrue("App should restart after build request", StatusTrackingUtil.detectAppRestartNew(projectID, 150, eventsBeforeBuildRequest));
			
			// Get the new exposed port
			TestCcheckForContainer();
			
			// Check that the new string is returned when the application is pinged
			MicroclimateTestUtils.pingApp(newText, MicroprofileCreationAndUpdate.exposedPort, api, testType);
		} finally {
			// Make sure auto build is enabled
			MicroclimateTestUtils.setAutoBuild(projectID, testType, true);
		}
	}
	
	@Test(timeout = 1200000) //20 mins timeout
	public void TestHmodifyDockerFile() {
		smokeClass.TestHmodifyDockerFile();
	}
	

	@Test(timeout=600000) //10 mins timeout
	public void TestIdelete() {
		smokeClass.TestIdelete();
	}

}
