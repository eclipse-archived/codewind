// DEPRECATED. DO NOT RUN AS PART OF FW TEST BUCKET
package org.eclipse.codewind.microclimate.importtest;

import static org.junit.Assert.*;

import java.io.File;
import java.net.HttpURLConnection;

import org.eclipse.codewind.microclimate.test.util.Logger;
import org.eclipse.codewind.microclimate.test.util.MicroclimateTestUtils;
import org.eclipse.codewind.microclimate.test.util.RetryRule;
import org.eclipse.codewind.microclimate.test.util.MicroclimateTestUtils.PROJECT_TYPES;
import org.eclipse.codewind.microclimate.test.util.MicroclimateTestUtils.SUITE_TYPES;
import org.junit.FixMethodOrder;
import org.junit.Rule;
import org.junit.Test;
import org.junit.runners.MethodSorters;


@FixMethodOrder(MethodSorters.NAME_ASCENDING)
public class NodeJSImportFromPublicGit {
	private static String exposedPort;
	private static String projectName = "testnode" + SUITE_TYPES.importtest;
	private static String nonDefaultWorkspace = System.getProperty("microclimate.workspace");
	private static String workspace = nonDefaultWorkspace == null ? System.getProperty("user.home") + "/codewind-workspace/" : nonDefaultWorkspace.endsWith("/") ? nonDefaultWorkspace : nonDefaultWorkspace + "/";
	private static String testType = System.getProperty("testType");
	private static PROJECT_TYPES projectType = PROJECT_TYPES.nodejs;

    @Rule
    public RetryRule retry = new RetryRule(MicroclimateTestUtils.retryCount);

    @Test(timeout=180000) //3 minutes timeout
	public void TestAimportFromGit(){
		String api = "/api/v1/import";
		String urlParameters  ="{\"repo\": \"" + MicroclimateTestUtils.nodePublicRepo+"\",\"name\": \"" + projectName +"\"}";
		try {
			int HttpResult = MicroclimateTestUtils.projectCreation(urlParameters, testType);
			assertTrue(HttpResult == HttpURLConnection.HTTP_OK);
		}catch(Exception e) {
			Logger.println(NodeJSImportFromPublicGit.class, "TestAimportFromGit()", "Exception occurred during project import: " + e.getMessage(),e);
			fail("Exception occurred during project import.");
		}
		return;
	}

	@Test(timeout=30000) //30 seconds timeout
	public void TestBcheckForProject() {
		try {
			while(true) {
				if(MicroclimateTestUtils.checkProjectExistency(projectName, testType))
					return;
				else
					Thread.sleep(3000);
			}
			}catch(Exception e) {
				Logger.println(NodeJSImportFromPublicGit.class, "TestBcheckForProject()", "Exception occurred when looking for project in projectList: " + e.getMessage(),e);
				fail("Exception occurred when looking for project in projectList");
			}
	}

	@Test(timeout=300000) //5 mins timeout
	public void TestCcheckForContainer() {
		try {
			exposedPort = MicroclimateTestUtils.getexposedPort(projectName, testType, projectType);
			assertNotNull("exposedPort for project " + projectName +" is null", exposedPort);
			}catch(Exception e) {
				Logger.println(NodeJSImportFromPublicGit.class, "TestCcheckForContainer()", "Exception occurred when looking for exposedport: " + e.getMessage(),e);
				fail("Exception occurred when looking for exposedport");
			}
			return;
	}


	@Test(timeout=180000) //3 mins timeout
	public void TestDcheckEndpoint() {
		assertNotNull("exposedPort for project " + projectName +" is null", exposedPort);
		String expectedString = "Congratulations";
		String api = "/";

		try {
			while(true) {
				if(MicroclimateTestUtils.checkEndpoint(expectedString, exposedPort, api, testType))
					return;
				else
					Thread.sleep(3000);
			}
			}catch(Exception e) {
				Logger.println(NodeJSImportFromPublicGit.class, "TestDcheckEndpoint()", "Exception occurred when checking for endpoint",e);
				fail("Exception occurred when checking for endpoint");
			}
	}

	@Test(timeout=1200000) //20 mins timeout
	public void TestEupdate() {
		assertNotNull("exposedPort for project " + projectName +" is null", exposedPort);
		String expectedString = "testProject";

		MicroclimateTestUtils.updateFile(testType, projectName, "public/index.html", "index.html", "Congratulations", expectedString);

		try {
			while(true) {
				TestCcheckForContainer();
				String api = "/";
				if(MicroclimateTestUtils.checkEndpoint(expectedString, exposedPort, api, testType))
					return;
				else
					Thread.sleep(3000);
			}
		}catch(Exception e) {
			Logger.println(NodeJSImportFromPublicGit.class, "TestEupdate()", "Exception occurred when checking for endpoint",e);
			fail("Exception occurred when checking for endpoint");
		}
	}


	@Test(timeout=30000) //30 seconds timeout
	public void TestFdelete() {
		String path = workspace + projectName;

		// only if this is the 1st time trying, then we run the portal project deletion
		if (MicroclimateTestUtils.retryCount == retry.getRetriesLeft()) {
			try {
				int responseCode = MicroclimateTestUtils.projectdeletion(projectName, testType);
				assertTrue("expected response code " + HttpURLConnection.HTTP_ACCEPTED + ", found " + responseCode, responseCode == HttpURLConnection.HTTP_ACCEPTED);
			} catch (Exception e) {
				Logger.println(NodeJSImportFromPublicGit.class, "TestFdelete()", "Exception occurred during project deletion: " + e.getMessage(),e);
				fail("Exception occurred during project deletion");
			}
		}

		if (testType.equalsIgnoreCase("local")) {
			File projectDirectory = new File(path);

			if (projectDirectory.exists()) {
				fail("Project deletion failed! Project directory still exists under workspace.");
			}

			try {
				if (MicroclimateTestUtils.existContainer(projectName)) {
					fail("Project deletion failed! Project container still exists.");
				}
			} catch (Exception e) {
				Logger.println(NodeJSImportFromPublicGit.class, "TestFdelete()", "Exception occurred during check if container still exists: " + e.getMessage(),e);
				fail("Exception occurred during check if container still exists");
			}

			try {
				if (MicroclimateTestUtils.existImage(projectName)) {
					fail("Project deletion failed! Project image still exists.");
				}
			} catch (Exception e) {
				Logger.println(NodeJSImportFromPublicGit.class, "TestFdelete()", "Exception occurred during check if image still exists: " + e.getMessage(),e);
				fail("Exception occurred during check if image still exists");
			}
		} else if (testType.equalsIgnoreCase("icp")) {
			String pod = null;
			String dirName = projectName;

			try {
				pod = MicroclimateTestUtils.getFileWatcherPod();
			} catch (Exception e) {
				Logger.println(NodeJSImportFromPublicGit.class, "TestFdelete()", "Exception occurred during get pod: " + e.getMessage(),e);
				fail("Exception occurred during get pod");
			}


			try {
				if (MicroclimateTestUtils.existDirICP(pod, dirName)) {
					fail("Project deletion failed! Project directory still exists under workspace.");
				}
			} catch (Exception e) {
				Logger.println(NodeJSImportFromPublicGit.class, "TestFdelete()", "Exception occurred during check workspace: " + e.getMessage(),e);
				fail("Exception occurred during check workspace");
			}

			try {
				Thread.sleep(5000);
				if (MicroclimateTestUtils.existPod(projectName)) {
					fail("Project deletion failed! Project pod still exists.");
				}
			} catch (Exception e) {
				Logger.println(NodeJSImportFromPublicGit.class, "TestFdelete()", "Exception occurred during check if pod still exists: " + e.getMessage(),e);
				fail("Exception occurred during check if pod still exists");
			}
		}
	}
}
