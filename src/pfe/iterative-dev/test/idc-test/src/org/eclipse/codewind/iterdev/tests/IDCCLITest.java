package org.eclipse.codewind.iterdev.tests;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertNotNull;
import static org.junit.Assert.assertTrue;

import java.io.File;
import java.io.IOException;

import org.junit.After;
import org.junit.Before;
import org.junit.Test;

import org.eclipse.codewind.iterdev.IDCUtils;
import org.eclipse.codewind.iterdev.ProcessRunner;
import org.eclipse.codewind.iterdev.tests.utils.ExecCommand;
import org.eclipse.codewind.iterdev.tests.utils.IDCTestUtil;

public class IDCCLITest {
	
	String userDir = System.getProperty("user.dir"); 
	String homeDir = System.getProperty("user.home");
	String tempPath = userDir + File.separator + "temp";
	String appFromPath = userDir + File.separator + "app";
	String appToPath = tempPath +  File.separator + "app";
	String idcTestLogFile = null;

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
		idcTestLogFile = idcTestLogDir.toString() + File.separator + "IDCCLITest.log";
		if(new File(idcTestLogFile).exists()) {
			new File(idcTestLogFile).delete();
		}
		System.out.println("The log file is located at: " +  idcTestLogFile);
	}

	

	@After
	public void tearDown() throws Exception {
		System.out.println(">>Enter tearDown");
		
		IDCTestUtil.delete(tempPath);
	}

	@Test
	public void helpCommand() throws IOException, InterruptedException {
		System.out.println(">>Enter helpCommand");
		
		ProcessRunner pr;
		String scriptPath = IDCTestUtil.getTestScriptPath(userDir);
		
		//Run idc help
		String help_cmd = scriptPath + " help " + appToPath + " " + idcTestLogFile + " yes";
		System.out.println("help_cmd: " + help_cmd);
		pr = ExecCommand.runCommand(help_cmd);
		boolean isValidated = false;
		for (String str : pr.getReceived().split("\\n")) {
			System.out.println("str: " + str);
			if(IDCTestUtil.validateHelpOutput(str)) {
				isValidated = true;
			}
		}
		assertTrue("The idc help command did not output any comments.", isValidated);
	}
	
	@Test
	public void appIDCommand() throws IOException, InterruptedException {
		System.out.println(">>Enter appIDCommand");
		
		ProcessRunner pr;
		String scriptPath = IDCTestUtil.getTestScriptPath(userDir);
		
		//Run idc appid
		String appid_cmd = scriptPath + " appID " + appToPath + " " + idcTestLogFile + " yes";
		System.out.println("appid_cmd: " + appid_cmd);
		pr = ExecCommand.runCommand(appid_cmd);
		boolean isOutput = false;
		String expectedAppID = IDCTestUtil.getDigest(appToPath);
		String actualAppID = null;
 		for (String str : pr.getReceived().split("\\n")) {
			System.out.println("str: " + str);
			String s[] = str.split("] ");
			actualAppID = s[1];
		}
 		assertNotNull("Actual App ID is null.", actualAppID);
 		assertEquals("Actual App ID and Expected ID are not the same.", expectedAppID, actualAppID);
	}
}
