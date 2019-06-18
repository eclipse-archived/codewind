package org.eclipse.codewind.microclimate.importtest;

import static org.junit.Assert.*;

import java.io.File;
import java.net.HttpURLConnection;

import org.eclipse.codewind.microclimate.test.util.AbstractMicroclimateTest;
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
public class MicroprofileImportFromZip extends AbstractMicroclimateTest {

	private static String exposedPort;
	private static String projectName = "microprofilezip" + SUITE_TYPES.importtest;
	private static String nonDefaultWorkspace = System.getProperty("microclimate.workspace");
	private static String workspace = nonDefaultWorkspace == null ? System.getProperty("user.home") + "/codewind-workspace/" : nonDefaultWorkspace.endsWith("/") ? nonDefaultWorkspace : nonDefaultWorkspace + "/";
	private static String testType = System.getProperty("testType");
	private static PROJECT_TYPES projectType = PROJECT_TYPES.liberty;

    @Rule
    public RetryRule retry = new RetryRule(MicroclimateTestUtils.retryCount);

    @Test(timeout=180000) //3 minutes timeout
	public void TestAimport(){
		try {
		Logger.println(MicroprofileImportFromZip.class, "TestAimport()", ">>> MicroprofileImportFromZip.TestAimport");
		String filePath = MicroclimateTestUtils.rescourceDir + "microprofilezip.zip";
		int HttpResult = MicroclimateTestUtils.importLocalProject(filePath, projectName, testType);
		Logger.println(MicroprofileImportFromZip.class, "TestAimport()", "HttpResult is: " + HttpResult);
		assertTrue(HttpResult == HttpURLConnection.HTTP_ACCEPTED);
		}catch(Exception e) {
			Logger.println(MicroprofileImportFromZip.class, "TestAimport()", "Exception occurred during project import: " + e.getMessage(),e);
			fail("Exception occurred during project import.");
		}
		return;
	}

	@Test(timeout=30000) //30 seconds timeout
	public void TestBcheckForProject() {
		try {
			Logger.println(MicroprofileImportFromZip.class, "TestBcheckForProject()", ">>> MicroprofileImportFromZip.TestBcheckForProject");
			while(true) {
				if(MicroclimateTestUtils.checkProjectExistency(projectName, testType))
					return;
				else
					Thread.sleep(3000);
			}
			}catch(Exception e) {
				Logger.println(MicroprofileImportFromZip.class, "TestBcheckForProject()", "Exception occurred when looking for project in projectList: " + e.getMessage(),e);
				fail("Exception occurred when looking for project in projectList");
			}
	}

	@Test(timeout=1200000) //20 mins timeout
	public void TestCcheckForContainer() {
		try {
			Logger.println(MicroprofileImportFromZip.class, "TestCcheckForContainer()", ">>> MicroprofileImportFromZip.TestCcheckForContainer");
			exposedPort = MicroclimateTestUtils.getexposedPort(projectName, testType, projectType);
			assertNotNull("exposedPort for project " + projectName +" is null", exposedPort);
			}catch(Exception e) {
				Logger.println(MicroprofileImportFromZip.class, "TestCcheckForContainer()", "Exception occurred when looking for exposedport: " + e.getMessage(),e);
				fail("Exception occurred when looking for exposedport");
			}
			return;
	}

	@Test(timeout=180000) //3 mins timeout
	public void TestEcheckEndpoint() {
		Logger.println(MicroprofileImportFromZip.class, "TestEcheckEndpoint()", ">>> MicroprofileImportFromZip.TestEcheckEndpoint");
		assertNotNull("exposedPort for project " + projectName +" is null", exposedPort);
		String expectedString = "Congratulations, your application is up and running";
		String api = "/v1/example";

		try {
			while(true) {
				if(MicroclimateTestUtils.checkEndpoint(expectedString, exposedPort, api, testType))
					return;
				else
					Thread.sleep(3000);
			}
			}catch(Exception e) {
				Logger.println(MicroprofileImportFromZip.class, "TestEcheckEndpoint()", "Exception occurred when checking for endpoint",e);
				fail("Exception occurred when checking for endpoint");
			}
	}

	@Test(timeout=1200000) //20 mins timeout
	public void TestFupdate() {
		Logger.println(MicroprofileImportFromZip.class, "TestFupdate()", ">>> MicroprofileImportFromZip.TestFupdate");
		assertNotNull("exposedPort for project " + projectName +" is null", exposedPort);
		String expectedString = "Hello, your application is up and running";

		MicroclimateTestUtils.updateFile(testType, projectName, "src/main/java/application/rest/v1/Example.java", "Example.java", "Congratulations", "Hello");

		try {
			while(true) {
				String api = "/v1/example";
				if(MicroclimateTestUtils.checkEndpoint(expectedString, exposedPort, api, testType))
					return;
				else
					Thread.sleep(3000);
			}
		}catch(Exception e) {
			Logger.println(MicroprofileImportFromZip.class, "TestFupdate()", "Exception occurred when checking for endpoint",e);
			fail("Exception occurred when checking for endpoint");
		}
	}

	@Test(timeout=600000) //10 mins timeout
	public void TestGdelete() {
		Logger.println(MicroprofileImportFromZip.class, "TestGdelete()", ">>> MicroprofileImportFromZip.TestGdelete");
		String path =workspace + projectName;

		// only if this is the 1st time trying, then we run the portal project deletion
		if (MicroclimateTestUtils.retryCount == retry.getRetriesLeft()) {
			try {
				int responseCode = MicroclimateTestUtils.projectdeletion(projectName, testType);
				assertTrue("expected response code " + HttpURLConnection.HTTP_ACCEPTED + ", found " + responseCode, responseCode == HttpURLConnection.HTTP_ACCEPTED);
			} catch (Exception e) {
				Logger.println(MicroprofileImportFromZip.class, "TestGdelete()", "Exception occurred during project deletion: " + e.getMessage(),e);
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
				Logger.println(MicroprofileImportFromZip.class, "TestGdelete()", "Exception occurred during check if container still exists: " + e.getMessage(),e);
				fail("Exception occurred during check if container still exists");
			}

			try {
				if (MicroclimateTestUtils.existImage(projectName)) {
					fail("Project deletion failed! Project image still exists.");
				}
			} catch (Exception e) {
				Logger.println(MicroprofileImportFromZip.class, "TestGdelete()", "Exception occurred during check if image still exists: " + e.getMessage(),e);
				fail("Exception occurred during check if image still exists");
			}
		} else if (testType.equalsIgnoreCase("icp")) {
			String pod = null;
			String dirName = projectName;

			try {
				pod = MicroclimateTestUtils.getFileWatcherPod();
			} catch (Exception e) {
				Logger.println(MicroprofileImportFromZip.class, "TestGdelete()", "Exception occurred during get pod: " + e.getMessage(),e);
				fail("Exception occurred during get pod");
			}

			try {
				Thread.sleep(5000);
				if (MicroclimateTestUtils.existPod(projectName)) {
					fail("Project deletion failed! Project pod still exists.");
				}
			} catch (Exception e) {
				Logger.println(MicroprofileImportFromZip.class, "TestGdelete()", "Exception occurred during check if pod still exists: " + e.getMessage(),e);
				fail("Exception occurred during check if pod still exists");
			}
		}
	}
}
