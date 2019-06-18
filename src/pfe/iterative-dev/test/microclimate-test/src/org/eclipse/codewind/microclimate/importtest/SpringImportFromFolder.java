package org.eclipse.codewind.microclimate.importtest;

import static org.junit.Assert.*;

import java.io.File;
import java.net.HttpURLConnection;

import org.eclipse.codewind.microclimate.test.util.AbstractMicroclimateTest;
import org.eclipse.codewind.microclimate.test.util.HttpResponse;
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
public class SpringImportFromFolder extends AbstractMicroclimateTest {

	private static String exposedPort;
	private static String nonDefaultWorkspace = System.getProperty("microclimate.workspace");
	private static String workspace = nonDefaultWorkspace == null ? System.getProperty("user.home") + "/codewind-workspace/" : nonDefaultWorkspace.endsWith("/") ? nonDefaultWorkspace : nonDefaultWorkspace + "/";
	private static String testType = System.getProperty("testType");
	final String PROJECTS_API = MicroclimateTestUtils.getProjectsAPI();
	final String BIND_API = MicroclimateTestUtils.getBindAPI();
	public final String PORT = MicroclimateTestUtils.getPort();
	public final String PROTOCOL = MicroclimateTestUtils.getProtocol();

	private static String projectName = "springfolder";
	private static String projectPath = workspace + projectName;
	private static String projectLanguage = "java";
	private static PROJECT_TYPES projectType = PROJECT_TYPES.spring;
	private static boolean projectAutoBuild = true;

    @Rule
    public RetryRule retry = new RetryRule(MicroclimateTestUtils.retryCount);

    @Test(timeout=180000) //3 minutes timeout
	public void TestAimportFromFolder(){
		try {
			Logger.println(MicroprofileImportFromFolder.class, "TestAbindFromFolder()", ">>> MicroprofileImportFromFolder.TestAbindFromFolder");

			String urlParameters = "{\"name\": \"" + projectName + "\",\"path\": \"" + projectPath + "\",\"language\": \"" + projectLanguage + "\",\"projectType\": \"" + projectType + "\",\"autoBuild\": " + projectAutoBuild + "}";
			HttpResponse httpResponse = MicroclimateTestUtils.callAPIBodyParameters(BIND_API, urlParameters, PROTOCOL, PORT, "POST", testType);
			int httpResult = httpResponse.getResponseCode();
			Logger.println(MicroprofileImportFromFolder.class, "TestAbindFromFolder()", "HttpBody is: " + httpResponse.getResponseBody());
			Logger.println(MicroprofileImportFromFolder.class, "TestAbindFromFolder()", "HttpResult is: " + httpResult);
			assertEquals(HttpURLConnection.HTTP_ACCEPTED, httpResult);

		} catch(Exception e) {
			Logger.println(MicroprofileImportFromFolder.class, "TestAbindFromFolder()", "Exception occurred during project bind: " + e.getMessage(),e);
			fail("Exception occurred during project bind.");
		}

		return;
	}

	@Test(timeout=30000) //30 seconds timeout
	public void TestBcheckForProject() {
		try {
			Logger.println(SpringImportFromFolder.class, "TestBcheckForProject()", ">>> SpringImportFromFolder.TestBcheckForProject");
			while(true) {
				if(MicroclimateTestUtils.checkProjectExistency(projectName, testType))
					return;
				else
					Thread.sleep(3000);
			}
			}catch(Exception e) {
				Logger.println(SpringImportFromFolder.class, "TestBcheckForProject()", "Exception occurred when looking for project in projectList: " + e.getMessage(),e);
				fail("Exception occurred when looking for project in projectList");
			}
	}

	@Test(timeout=300000) //5 mins timeout
	public void TestCcheckForContainer() {
		try {
			Logger.println(SpringImportFromFolder.class, "TestCcheckForContainer()", ">>> SpringImportFromFolder.TestCcheckForContainer");
			exposedPort = MicroclimateTestUtils.getexposedPort(projectName, testType, projectType);
			assertNotNull("exposedPort for project " + projectName +" is null", exposedPort);
			}catch(Exception e) {
				Logger.println(SpringImportFromFolder.class, "TestCcheckForContainer()", "Exception occurred when looking for exposedport: " + e.getMessage(),e);
				fail("Exception occurred when looking for exposedport");
			}
			return;
	}

	@Test(timeout=180000) //3 mins timeout
	public void TestEcheckEndpoint() {
		Logger.println(SpringImportFromFolder.class, "TestEcheckEndpoint()", ">>> SpringImportFromFolder.TestEcheckEndpoint");
		assertNotNull("exposedPort for project " + projectName +" is null", exposedPort);
		String expectedString = "You are currently running a Spring server";
		String api = "/";

		try {
			while(true) {
				if(MicroclimateTestUtils.checkEndpoint(expectedString, exposedPort, api, testType))
					return;
				else
					Thread.sleep(3000);
			}
			}catch(Exception e) {
				Logger.println(SpringImportFromFolder.class, "TestEcheckEndpoint()", "Exception occurred when checking for endpoint",e);
				fail("Exception occurred when checking for endpoint");
			}
	}

	@Test(timeout=1200000) //20 mins timeout
	public void TestFupdate() {
		Logger.println(SpringImportFromFolder.class, "TestFupdate()", ">>> SpringImportFromFolder.TestFupdate");
		assertNotNull("exposedPort for project " + projectName +" is null", exposedPort);
		String expectedString = "Hello";

		MicroclimateTestUtils.updateFile(testType, projectName, "src/main/resources/public/index.html", "index.html", "Congratulations", expectedString);

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
			Logger.println(SpringImportFromFolder.class, "TestFupdate()", "Exception occurred when checking for endpoint: ",e);
			fail("Exception occurred when checking for endpoint");
		}
	}


	@Test(timeout=600000) //10 mins timeout
	public void TestGdelete() {
		Logger.println(SpringImportFromFolder.class, "TestGdelete()", ">>> SpringImportFromFolder.TestGdelete");
		String path = workspace + projectName;

		// only if this is the 1st time trying, then we run the portal project deletion
		if (MicroclimateTestUtils.retryCount == retry.getRetriesLeft()) {
			try {
				Logger.println(SpringImportFromFolder.class, "TestGdelete()", ">>> MicroprofileImportFromFolder.TestGdelete");

				String projectID = MicroclimateTestUtils.getProjectID(projectName, testType);
				String api = PROJECTS_API + projectID + "/unbind/";
				String url = MicroclimateTestUtils.getBaseURL(testType, PORT, PROTOCOL) + api;
				HttpResponse httpResponse = MicroclimateTestUtils.callAPIURLParameters(url, "POST", testType);
				int httpResult = httpResponse.getResponseCode();

				Logger.println(SpringImportFromFolder.class, "TestGdelete()", "HttpResult is: " + httpResult);
				assertEquals(HttpURLConnection.HTTP_ACCEPTED, httpResult);

			} catch(Exception e) {
				Logger.println(SpringImportFromFolder.class, "TestGdelete()", "Exception occurred during project unbind: " + e.getMessage(),e);
				fail("Exception occurred during project unbind.");
			}
		}

		if (testType.equalsIgnoreCase("local")) {
			File projectDirectory = new File(path);

			try {
				if (MicroclimateTestUtils.existContainer(projectName)) {
					fail("Project deletion failed! Project container still exists.");
				}
			} catch (Exception e) {
				Logger.println(SpringImportFromFolder.class, "TestGdelete()", "Exception occurred during check if container still exists: " + e.getMessage(),e);
				fail("Exception occurred during check if container still exists");
			}

			try {
				if (MicroclimateTestUtils.existImage(projectName)) {
					fail("Project deletion failed! Project image still exists.");
				}
			} catch (Exception e) {
				Logger.println(SpringImportFromFolder.class, "TestGdelete()", "Exception occurred during check if image still exists: " + e.getMessage(),e);
				fail("Exception occurred during check if image still exists");
			}
		} else if (testType.equalsIgnoreCase("icp")) {
			String pod = null;
			String dirName = projectName;

			try {
				pod = MicroclimateTestUtils.getFileWatcherPod();
			} catch (Exception e) {
				Logger.println(SpringImportFromFolder.class, "TestGdelete()", "Exception occurred during get pod: " + e.getMessage(),e);
				fail("Exception occurred during get pod");
			}

			try {
				Thread.sleep(5000);
				if (MicroclimateTestUtils.existPod(projectName)) {
					fail("Project deletion failed! Project pod still exists.");
				}
			} catch (Exception e) {
				Logger.println(SpringImportFromFolder.class, "TestGdelete()", "Exception occurred during check if pod still exists: " + e.getMessage(),e);
				fail("Exception occurred during check if pod still exists");
			}
		}
	}
}
