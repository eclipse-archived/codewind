package org.eclipse.codewind.microclimate.apitest;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertNotNull;
import static org.junit.Assert.assertTrue;
import static org.junit.Assert.fail;
import static org.junit.Assume.assumeTrue;

import java.io.File;
import java.net.HttpURLConnection;
import java.util.Date;

import org.eclipse.codewind.microclimate.smoketest.MicroprofileCreationAndUpdate;
import org.eclipse.codewind.microclimate.test.util.AbstractMicroclimateTest;
import org.eclipse.codewind.microclimate.test.util.HttpResponse;
import org.eclipse.codewind.microclimate.test.util.Logger;
import org.eclipse.codewind.microclimate.test.util.MicroclimateTestUtils;
import org.eclipse.codewind.microclimate.test.util.RetryRule;
import org.eclipse.codewind.microclimate.test.util.MicroclimateTestUtils.PROJECT_TYPES;
import org.eclipse.codewind.microclimate.test.util.MicroclimateTestUtils.SUITE_TYPES;
import org.eclipse.codewind.microclimate.test.util.SocketUtil.SocketEvent;
import org.json.JSONArray;
import org.json.JSONObject;
import javax.json.JsonArray;
import javax.json.JsonObject;

import org.junit.Before;
import org.junit.FixMethodOrder;
import org.junit.Rule;
import org.junit.Test;
import org.junit.runners.MethodSorters;

import org.eclipse.codewind.iterdev.ProcessRunner;

@FixMethodOrder(MethodSorters.NAME_ASCENDING)
public class ShutdownAPITestsPPC64LE extends AbstractMicroclimateTest {
	
	private static String exposedPort;
	private static String projectNameLiberty = "liberty" + SUITE_TYPES.apitest + (new Date().getTime());
	private static String projectNameSpring= "spring" + SUITE_TYPES.apitest + (new Date().getTime());
	private static String projectNameNode = "node" + SUITE_TYPES.apitest + (new Date().getTime());
	private static String testType = System.getProperty("testType");
	
	final String PORT = MicroclimateTestUtils.getPort();
	final String PROTOCOL = MicroclimateTestUtils.getProtocol();
	
	final String PROJECTS_API = MicroclimateTestUtils.getProjectsAPI();
	final String SHUTDOWN_API = MicroclimateTestUtils.getShutDownAPI();
	
    @Rule
    public RetryRule retry = new RetryRule(MicroclimateTestUtils.retryCount);
    
	@Before
	public void checkTestType() {
		assumeTrue("-DtestType parameter must be set", "local".equalsIgnoreCase(testType));
	}
	
	@Test(timeout=60000) //60 seconds timeout
	public void TestA001createLiberty() {
		String urlParameters  ="{\"name\": \"" + projectNameLiberty + "\",\"language\": \"java\",\"framework\": \"microprofile\"}";
		
		try {
			int httpResult = MicroclimateTestUtils.projectCreation(urlParameters, testType);
			Logger.println(ShutdownAPITestsPPC64LE.class, "TestA001createLiberty()", "HttpResult is: " + httpResult);
			assertEquals(HttpURLConnection.HTTP_ACCEPTED, httpResult);
		}
		catch( Exception e ) {
			Logger.println(ShutdownAPITestsPPC64LE.class, "TestA001createLiberty()", "Exception occurred during project creation: " + e.getMessage(),e);
			fail("Exception occurred during project creation.");
		}
		
		return;
	}
	
	@Test(timeout=60000) //60 seconds timeout
	public void TestA002createSpring() {
		String urlParameters  ="{\"name\": \"" + projectNameSpring + "\",\"language\": \"java\",\"framework\": \"spring\"}";
		
		try {
			int httpResult = MicroclimateTestUtils.projectCreation(urlParameters, testType);
			Logger.println(ShutdownAPITestsPPC64LE.class, "TestA002createSpring()", "HttpResult is: " + httpResult);
			assertEquals(HttpURLConnection.HTTP_ACCEPTED, httpResult);
		}
		catch( Exception e ) {
			Logger.println(ShutdownAPITestsPPC64LE.class, "TestA002createSpring()", "Exception occurred during project creation: " + e.getMessage(),e);
			fail("Exception occurred during project creation.");
		}
		
		return;
	}
	
	@Test(timeout=60000) //60 seconds timeout
	public void TestA003createNode() {
		String urlParameters  ="{\"name\": \"" + projectNameNode + "\",\"language\": \"nodejs\"}";
		
		try {
			int httpResult = MicroclimateTestUtils.projectCreation(urlParameters, testType);
			Logger.println(ShutdownAPITestsPPC64LE.class, "TestA003createNode()", "HttpResult is: " + httpResult);
			assertEquals(HttpURLConnection.HTTP_ACCEPTED, httpResult);
		}
		catch( Exception e ) {
			Logger.println(ShutdownAPITestsPPC64LE.class, "TestA003createNode()", "Exception occurred during project creation: " + e.getMessage(),e);
			fail("Exception occurred during project creation.");
		}
		
		return;
	}
	
	@Test(timeout=30000) //30 seconds timeout
	public void TestB001checkForLibertyProject() {
		try {
			while ( true ) {
				if (MicroclimateTestUtils.checkProjectExistency(projectNameLiberty, testType))
					return;
				else
					Thread.sleep(3000);
			}
		}
		catch( Exception e ) {
			Logger.println(ShutdownAPITestsPPC64LE.class, "TestB001checkForLibertyProject()", "Exception occurred when looking for project in projectList: " + e.getMessage(),e);
			fail("Exception occurred when looking for project in projectList");
		}	
	}
	
	@Test(timeout=30000) //30 seconds timeout
	public void TestB002checkForSpringProject() {
		try {
			while ( true ) {
				if (MicroclimateTestUtils.checkProjectExistency(projectNameSpring, testType))
					return;
				else
					Thread.sleep(3000);
			}
		}
		catch( Exception e ) {
			Logger.println(ShutdownAPITestsPPC64LE.class, "TestB002checkForSpringProject()", "Exception occurred when looking for project in projectList: " + e.getMessage(),e);
			fail("Exception occurred when looking for project in projectList");
		}	
	}
	
	@Test(timeout=30000) //30 seconds timeout
	public void TestB003checkForNodeProject() {
		try {
			while ( true ) {
				if (MicroclimateTestUtils.checkProjectExistency(projectNameNode, testType))
					return;
				else
					Thread.sleep(3000);
			}
		}
		catch( Exception e ) {
			Logger.println(ShutdownAPITestsPPC64LE.class, "TestB003checkForNodeProject()", "Exception occurred when looking for project in projectList: " + e.getMessage(),e);
			fail("Exception occurred when looking for project in projectList");
		}	
	}
	
	@Test(timeout=300000) //5 mins timeout
	public void TestC001checkForLibertyContainer() {
		try {
			exposedPort = MicroclimateTestUtils.getexposedPort(projectNameLiberty, testType, PROJECT_TYPES.liberty);
			Logger.println(ShutdownAPITestsPPC64LE.class, "TestC001checkForLibertyContainer()", "Exposed Port is " + exposedPort);
			assertNotNull("exposedPort for project " + projectNameLiberty +" is null", exposedPort);
		}
		catch( Exception e ) {
			Logger.println(ShutdownAPITestsPPC64LE.class, "TestC001checkForLibertyContainer()", "Exception occurred when looking for exposedport: " + e.getMessage(),e);
			fail("Exception occurred when looking for exposedport");
		}
		
		return;
	}
	
	@Test(timeout=300000) //5 mins timeout
	public void TestC002checkForSpringContainer() {
		try {
			exposedPort = MicroclimateTestUtils.getexposedPort(projectNameSpring, testType, PROJECT_TYPES.spring);
			Logger.println(ShutdownAPITestsPPC64LE.class, "TestC002checkForSpringContainer()", "Exposed Port is " + exposedPort);
			assertNotNull("exposedPort for project " + projectNameSpring +" is null", exposedPort);
		}
		catch( Exception e ) {
			Logger.println(ShutdownAPITestsPPC64LE.class, "TestC002checkForSpringContainer()", "Exception occurred when looking for exposedport: " + e.getMessage(),e);
			fail("Exception occurred when looking for exposedport");
		}
		
		return;
	}
	
	
	@Test(timeout=300000) //5 mins timeout
	public void TestC003checkForNodeContainer() {
		try {
			exposedPort = MicroclimateTestUtils.getexposedPort(projectNameNode, testType, PROJECT_TYPES.nodejs);
			Logger.println(ShutdownAPITestsPPC64LE.class, "TestC003checkForNodeContainer()", "Exposed Port is " + exposedPort);
			assertNotNull("exposedPort for project " + projectNameNode +" is null", exposedPort);
		}
		catch( Exception e ) {
			Logger.println(ShutdownAPITestsPPC64LE.class, "TestC003checkForNodeContainer()", "Exception occurred when looking for exposedport: " + e.getMessage(),e);
			fail("Exception occurred when looking for exposedport");
		}
		
		return;
	}
	
	@Test(timeout=180000) //3 mins timeout
	public void TestDshutdown() {
		final String projectValidatedEvent = "filewatcherShutdown";
		try {
			
			Logger.println(ShutdownAPITestsPPC64LE.class, "TestDshutdown()", "Testing projects shutdown ");
			String[] eventsOfInterest = {projectValidatedEvent};
			MicroclimateTestUtils.PairedResponse pairedResponse = MicroclimateTestUtils.callAPIBodyParametersWSocketResponse(SHUTDOWN_API, "", PROTOCOL, PORT, "POST", testType, eventsOfInterest, 30);
			int httpResult = pairedResponse.httpResponse.getResponseCode();
			assertTrue(httpResult == HttpURLConnection.HTTP_ACCEPTED);
			
			assertEquals("Expecting only 1 socket event", 1, pairedResponse.socketEvents.length);
			SocketEvent se = pairedResponse.socketEvents[0];
			Logger.println(ShutdownAPITestsPPC64LE.class, "TestDshutdown()", "Socket msg     : " + se.getMsg());
			assertEquals("Unexpected socket event received", projectValidatedEvent, se.getMsg());
			Logger.println(ShutdownAPITestsPPC64LE.class, "TestDshutdown()", "Socket event details : " + se.getDetails().toString());
			String status = se.getDetails().getString("status");
			
			assertNotNull(status);
			assertEquals("Expect shutdown status to be success", status, "success");
			
			if (testType.equalsIgnoreCase("local")) {
				//check for container
				assertFalse("Liberty container should be removed", MicroclimateTestUtils.existContainer(projectNameLiberty));
				assertFalse("Spring container should be removed", MicroclimateTestUtils.existContainer(projectNameSpring));
				assertFalse("Node container should be removed", MicroclimateTestUtils.existContainer(projectNameNode));
				
				//check for images
				assertFalse("Liberty image should be removed", MicroclimateTestUtils.existImage(projectNameLiberty));
				assertFalse("Spring image should be removed", MicroclimateTestUtils.existImage(projectNameSpring));
				assertFalse("Node image should be removed", MicroclimateTestUtils.existImage(projectNameNode));
			
				//projects should not be removed from workspace
				File LibertyprojectDirectory = new File(MicroclimateTestUtils.workspace + projectNameLiberty);
				File SpringprojectDirectory = new File(MicroclimateTestUtils.workspace + projectNameSpring);
				File NodeprojectDirectory = new File(MicroclimateTestUtils.workspace + projectNameNode);
				assertTrue("Liberty project in workspace should not be removed", LibertyprojectDirectory.exists());
				assertTrue("Spring project in workspace should not be removed", SpringprojectDirectory.exists());
				assertTrue("Node project in workspace should not be removed", NodeprojectDirectory.exists());
				
			} else if (testType.equalsIgnoreCase("icp")) {
				String pod = null;
				try {
					pod = MicroclimateTestUtils.getFileWatcherPod();
				} catch (Exception e) {
					Logger.println(ShutdownAPITestsPPC64LE.class, "TestDshutdown()", "Exception occurred during get pod: " + e.getMessage(),e);
					fail("Exception occurred during get pod");
				}
						
				try {
					assertTrue("Liberty project in workspace should not be removed", MicroclimateTestUtils.existDirICP(pod, projectNameLiberty));
					assertTrue("Spring project in workspace should not be removed", MicroclimateTestUtils.existDirICP(pod, projectNameSpring));
					assertTrue("Node project in workspace should not be removed", MicroclimateTestUtils.existDirICP(pod, projectNameNode));
				} catch (Exception e) {
					Logger.println(ShutdownAPITestsPPC64LE.class, "TestIdelete()", "Exception occurred during check workspace: " + e.getMessage(),e);
					fail("Exception occurred during check workspace");
				}
				
				try {
					Thread.sleep(5000);
					assertFalse("Liberty pod should be removed", MicroclimateTestUtils.existPod(projectNameLiberty));
					assertFalse("Spring pod should be removed", MicroclimateTestUtils.existPod(projectNameSpring));
					assertFalse("Node pod should be removed", MicroclimateTestUtils.existPod(projectNameNode));
				} catch (Exception e) {
					Logger.println(ShutdownAPITestsPPC64LE.class, "TestIdelete()", "Exception occurred during check if pod still exists: " + e.getMessage(),e);
					fail("Exception occurred during check if pod still exists");
				}
			}
			
			
			
		}catch( Exception e ) {
			Logger.println(ShutdownAPITestsPPC64LE.class, "TestDshutdown()", "Exception occurred during projects shutdown: " + e.getMessage(),e);
			fail("Exception occurred during projects shutdown");
		}
	}
}
