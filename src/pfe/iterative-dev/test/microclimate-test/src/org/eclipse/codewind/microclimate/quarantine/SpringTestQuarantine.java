package org.eclipse.codewind.microclimate.quarantine;

import static org.junit.Assert.assertTrue;
import static org.junit.Assert.fail;

import java.net.HttpURLConnection;
import java.util.Date;

import org.eclipse.codewind.microclimate.apitest.SpringProjectAPITests;
import org.eclipse.codewind.microclimate.importtest.SpringImportFromFolder;
import org.eclipse.codewind.microclimate.importtest.SpringImportFromZip;
import org.eclipse.codewind.microclimate.smoketest.SpringCreationAndUpdate;
import org.eclipse.codewind.microclimate.test.util.Logger;
import org.eclipse.codewind.microclimate.test.util.MicroclimateTestUtils;
import org.eclipse.codewind.microclimate.test.util.MicroclimateTestUtils.PROJECT_TYPES;
import org.eclipse.codewind.microclimate.test.util.MicroclimateTestUtils.SUITE_TYPES;
import org.junit.FixMethodOrder;
import org.junit.Test;
import org.junit.runners.MethodSorters;

@FixMethodOrder(MethodSorters.NAME_ASCENDING)
public class SpringTestQuarantine {
	
	// Handle local and ICP test cases by using this variable
	private static String testType = System.getProperty("testType");
	
	SpringCreationAndUpdate smokeClass = new SpringCreationAndUpdate();
	SpringImportFromZip importZipClass = new SpringImportFromZip();
	SpringImportFromFolder importFolderClass = new SpringImportFromFolder();
	SpringProjectAPITests apiClass = new SpringProjectAPITests();
	
	@Test(timeout=180000) //3 minutes timeout
	public void TestAcreate(){
		smokeClass.TestAcreate();
	}
	
	@Test(timeout=30000) //30 seconds timeout
	public void TestBcheckForProject() {
		smokeClass.TestBcheckForProject();
	}
	
	@Test(timeout=1200000) //20 mins timeout
	public void TestCcheckForContainer() {
		smokeClass.TestCcheckForContainer();
	}
	
	@Test(timeout=1200000) //20 mins timeout
	public void TestEQuarantine() {
		// Example: Execute Test Cases for Quarantine Here
		if (testType.equalsIgnoreCase("local")) {
			// Local Test Case
		} else if (testType.equals("icp")) {
			// ICP Test Case
		}
		smokeClass.TestFupdate();
	}

	@Test(timeout=120000) //2 mins timeout
	public void TestGdelete() {
		smokeClass.TestIdelete();
	}

}
