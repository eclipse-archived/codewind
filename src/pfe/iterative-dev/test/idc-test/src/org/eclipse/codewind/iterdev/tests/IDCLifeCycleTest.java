package org.eclipse.codewind.iterdev.tests;

import static org.junit.Assert.*;

import java.io.File;
import java.io.IOException;

import org.junit.After;
import org.junit.Before;
import org.junit.Test;

import org.eclipse.codewind.iterdev.ProcessRunner;
import org.eclipse.codewind.iterdev.tests.utils.ExecCommand;
import org.eclipse.codewind.iterdev.tests.utils.IDCTestUtil;
import org.eclipse.codewind.iterdev.IDCUtils;

public class IDCLifeCycleTest {
	
	//WARNING: Run this test by opening Eclipse from the CLI as it does NOT
	//pick up the entire env var PATH and docker commands may fail.
	
	String userDir = System.getProperty("user.dir"); 
	String homeDir = System.getProperty("user.home");
	String tempPath = userDir + File.separator + "temp";
	String appFromPath = userDir + File.separator + "app"; //This is the path to the src for the microprofile app
	String appToPath = tempPath +  File.separator + "app"; //This is the path to iterative/docker/app
	String idcTestLogFile = null;
	String containerName = null;

	@Before
	public void setUp() throws Exception {
		System.out.println(">>Enter setUp");
		
		IDCUtils.copyDir(appFromPath, appToPath);
		IDCUtils.copyDir(IDCTestUtil.getFileWatcherIDCDir(userDir), tempPath);
		
		//Since idc standalone does not require idc.config in artifacts dir, which microclimate repo has but iterative-dev repo didnt
		IDCTestUtil.deleteIDCConfig(tempPath + File.separator + "artifacts");
		
		//Give permissions to mc-target for messages.log, because insufficient perms to read the log
		String chmod_cmd = "sudo chmod -R 755 " + tempPath;
		ProcessRunner pr = ExecCommand.runCommand(chmod_cmd);
		
		File idcTestLogDir = new File(userDir + File.separator + "logs");
		idcTestLogDir.mkdir();
		idcTestLogFile = idcTestLogDir.toString() + File.separator + "IDCLifeCycleTest.log";
		if(new File(idcTestLogFile).exists()) {
			new File(idcTestLogFile).delete();
		}
		System.out.println("The log file is located at: " +  idcTestLogFile);
	}

	@After
	public void tearDown() throws Exception {
		System.out.println(">>Enter tearDown");
		
		//Run idc exit
		//Implement test logic once idc exit is implemented

		//Execute docker stop, docker rm and docker image rm -f
		String dockerstop_cmd = "docker stop " + containerName;
		ExecCommand.runCommand(dockerstop_cmd);
		String dockerrm_cmd = "docker rm " + containerName;
		ExecCommand.runCommand(dockerrm_cmd);
		String dockerimagerm_cmd = "docker image rm -f " + containerName;
		ExecCommand.runCommand(dockerimagerm_cmd);
		
		IDCTestUtil.delete(tempPath);
	}

	@Test
	public void executeIDCCommand() throws Exception {
		System.out.println(">>Enter executeIDCCommand");
		
		String scriptPath = IDCTestUtil.getTestScriptPath(userDir);
		
		//Run idc dev
		//String[] dev_cmd = {scriptPath, "dev", getDockerAppDir(userDir)};
		String dev_cmd = scriptPath + " dev " + appToPath + " " + idcTestLogFile;
		System.out.println("dev_cmd: " + dev_cmd);
		ExecCommand.runCommand(dev_cmd);
		
		//Run idc build
		String build_cmd = scriptPath + " build " + appToPath + " " + idcTestLogFile;
		System.out.println("build_cmd: " + build_cmd);
		ExecCommand.runCommand(build_cmd);
		
		//Check docker ps. Get Image Name and Port, separated by @#@
		String dockerps_cmd = "docker ps --format '{{.Image}}@#@{{.Ports}}'";
		ProcessRunner pr = ExecCommand.runCommand(dockerps_cmd);
		
		boolean isContainerBuilt = false;
		String httpPort = null;
		
		for (String dockerPsOutput : pr.getReceived().split("\\r?\\n")) {
			
			String dockerPsContents[] = dockerPsOutput.split("@#@");
			containerName = dockerPsContents[0];
			String ports = dockerPsContents[1];
			
			System.out.println("----");
			System.out.println("Container Image Name: " + containerName);
			System.out.println("----");
			
			if(containerName.contains(IDCTestUtil.getDigest(appToPath))) {
				isContainerBuilt = true;
				httpPort = ports.substring(ports.indexOf(":") + 1, ports.indexOf("->"));
				break;
			}
		}
		assertTrue("The container build failed.", isContainerBuilt);
		assertNotNull("The HTTP Port from docker ps is null", httpPort);
		
		//Run idc start
		String start_cmd = scriptPath + " start " + appToPath + " " + idcTestLogFile;
		System.out.println("start_cmd: " + start_cmd);
		ExecCommand.runCommand(start_cmd);
		
		//int port = Integer.parseInt(httpPort);
		
		//Ping IDC host to ensure Liberty has started
		boolean isReachable = IDCTestUtil.pingIDCHost("http://localhost:" + httpPort, 1000);
		assertTrue("Liberty Server failed to start. Server unreachable.", isReachable);
		
		//Check for .idc metadata
		File idcBase = new File(homeDir + File.separator + ".idc");
		assertTrue("The .idc dir does not exist!", idcBase.exists());
		
		File dbArtifacts = new File(idcBase.toString() + File.separator + "db" + File.separator + "db-" + IDCTestUtil.getDigest(appToPath));
		assertTrue("The .idc db artifact does not exist!", dbArtifacts.exists());
		
		File dockerDb = new File(idcBase.toString() + File.separator + "docker" + File.separator + "docker-" + IDCTestUtil.getDigest(appToPath));
		assertTrue("The .idc docker dir does not exist!", dockerDb.exists());
		
		File dockerDbDockerfile = new File(dockerDb.toString() + File.separator + "Dockerfile");
		assertTrue("The .idc docker artifact Dockerfile does not exist!", dockerDbDockerfile.exists());
		
		File dockerDbartifacts = new File(dockerDb.toString() + File.separator + "artifacts" + File.separator + "build_server.sh");
		assertTrue("The .idc docker artifact content does not exist!", dockerDbartifacts.exists());
		
		//Test the Health and Example Endpoint
		String urlContents = null;
		urlContents = IDCTestUtil.testAppEndPoints("health", httpPort);
		assertNotNull("Could not get to the Health Endpoint", urlContents);
		assertTrue("Application Health Endpoint does not contain status:UP", urlContents.contains("\"status\":\"UP\""));
		urlContents = IDCTestUtil.testAppEndPoints("example", httpPort);
		assertNotNull("Could not get to the Example Endpoint", urlContents);
		assertTrue("Application Health Endpoint does not contain Congratulations message", urlContents.contains("Congratulations, your application is up and running"));
		
		
		//Enter breakpoint in this line and debug here as the test tearDown
		//cleans the iterative-dev/docker/app dir before exiting. So. if you
		//want to check the app in the browser, debug until the breakpoint here.
		System.out.println("Enter breakpoint here to check app in the browser");
		
		String dockerexec_cmd = "docker exec " + containerName;
		
		//Update Class
		String classPath = appToPath + "/src/main/java/application/rest/v1/Example.java";
		String expectedString = "Hello, your application is up and running";
		String originalString = "Congratulations";
		String replaceString = "Hello";
		
		IDCTestUtil.updateFile(classPath, originalString, replaceString);
		Thread.sleep(2000);
		
		//Run idc build manually since this is standalone idc
		build_cmd = scriptPath + " build " + appToPath + " " + idcTestLogFile;
		System.out.println("Updated the class file, building idc...");
		System.out.println("build_cmd: " + build_cmd);
		ExecCommand.runCommand(build_cmd);
		
		//Give 2 secs for the mvn build to complete, before checking the end point
		Thread.sleep(2000);
		urlContents = IDCTestUtil.testAppEndPoints("example", httpPort);
		assertNotNull("Could not get to the Example Endpoint", urlContents);
		assertTrue("Application Health Endpoint does not contain the updated message", urlContents.contains(expectedString));
		
		//Update Server Config
		String serverConfigPath = appToPath + "/src/main/liberty/config/server.xml";
		IDCTestUtil.updateFile(new File(serverConfigPath), "      <feature>socialLogin-1.0</feature>");
		Thread.sleep(2000);
		
		//Run idc build manually since this is standalone idc
		build_cmd = scriptPath + " build " + appToPath + " " + idcTestLogFile;
		System.out.println("Updated the server config file, building idc...");
		System.out.println("build_cmd: " + build_cmd);
		ExecCommand.runCommand(build_cmd);
		
		//Give 2 secs for the mvn build to complete, before checking the logs to confirm if new feature has been picked up
		Thread.sleep(2000);
		String serverLogPath = appToPath + "/mc-target/liberty/wlp/usr/servers/defaultServer/logs/";
		//Give permissions to mc-target for messages.log, because insufficient perms to read the log
		String chmod_cmd = "sudo chmod -R 777 " + appToPath + "/mc-target";
		pr = ExecCommand.runCommand(chmod_cmd);
		boolean isPresent = IDCTestUtil.checkForMessages(new File(serverLogPath + "messages.log"));
		assertTrue("New feature not found in the server logs.", isPresent);
		
		//Update Dockerfile
		String dockerfileConfigPath = appToPath + "/Dockerfile-build";
		IDCTestUtil.updateFile(new File(dockerfileConfigPath), "RUN mkdir -m 777 -p /test/directory");
		Thread.sleep(2000);
		
		//Run idc build manually since this is standalone idc
		build_cmd = scriptPath + " build " + appToPath + " " + idcTestLogFile;
		System.out.println("Updated the dockerfile, building idc...");
		System.out.println("build_cmd: " + build_cmd);
		ExecCommand.runCommand(build_cmd);
		
		//Give 2 secs for the mvn build to complete, before checking the container to see if the changes has been picked
		Thread.sleep(2000);
		String ls_cmd = dockerexec_cmd + " sh -c \"ls -al /test/directory\"";
		boolean isDirCreated = false;
		boolean isPermSet = false;
		boolean isDockerfileEditSuccess = false;
		pr = ExecCommand.runCommand(ls_cmd);
		for (String dockerExecOutput : pr.getReceived().split("\\r?\\n")) {
			
			if(!dockerExecOutput.contains("No such file or directory")) {
				isDirCreated = true;
			} else {
				isDirCreated = false;
			}
			
			if(isDirCreated && dockerExecOutput.contains("drwxrwxrwx")) {
				isPermSet = true;
			}
			
			if (isDirCreated && isPermSet) {
				isDockerfileEditSuccess = true;
			}
		}
		assertTrue("The Dockerfile edit has not been successful. isDirCreated: " + isDirCreated + ", is PermSet: " + isPermSet, isDockerfileEditSuccess);
		
		//Run idc stop
		String stop_cmd = scriptPath + " stop " + appToPath + " " + idcTestLogFile;
		System.out.println("stop_cmd: " + stop_cmd);
		ExecCommand.runCommand(stop_cmd);
		
		//Ping IDC host to ensure Liberty has stopped
		isReachable = IDCTestUtil.pingIDCHost("http://localhost:" + httpPort, 1000);
		assertFalse("Liberty Server failed to stop. Server reachable.", isReachable);
	}

}
