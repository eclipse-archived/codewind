package org.eclipse.codewind.microclimate.quarantine;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertNotNull;
import static org.junit.Assert.assertTrue;
import static org.junit.Assert.fail;

import java.net.HttpURLConnection;
import java.util.ArrayList;
import java.util.Date;
import java.util.List;

import javax.json.JsonArray;
import javax.json.JsonObject;
import javax.json.JsonValue;

import org.eclipse.codewind.microclimate.apitest.MicroprofileProjectAPITests;
import org.eclipse.codewind.microclimate.importtest.MicroprofileImportFromFolder;
import org.eclipse.codewind.microclimate.importtest.MicroprofileImportFromZip;
import org.eclipse.codewind.microclimate.smoketest.MicroprofileCreationAndUpdate;
import org.eclipse.codewind.microclimate.test.util.AbstractMicroclimateTest;
import org.eclipse.codewind.microclimate.test.util.HttpResponse;
import org.eclipse.codewind.microclimate.test.util.Logger;
import org.eclipse.codewind.microclimate.test.util.MicroclimateTestUtils;
import org.eclipse.codewind.microclimate.test.util.StatusTrackingUtil;
import org.eclipse.codewind.microclimate.test.util.MicroclimateTestUtils.PROJECT_TYPES;
import org.eclipse.codewind.microclimate.test.util.MicroclimateTestUtils.SUITE_TYPES;
import org.eclipse.codewind.microclimate.test.util.SocketUtil.SocketEvent;
import org.json.JSONArray;
import org.json.JSONObject;
import org.junit.After;
import org.junit.FixMethodOrder;
import org.junit.Test;
import org.junit.runners.MethodSorters;

import org.eclipse.codewind.iterdev.ProcessRunner;

@FixMethodOrder(MethodSorters.NAME_ASCENDING)
public class MicroprofileAPITestQuarantine extends AbstractMicroclimateTest {
	private static String testType = System.getProperty("testType");
	private static PROJECT_TYPES projectType = PROJECT_TYPES.liberty;

	public final String PORT = MicroclimateTestUtils.getPort();
	public final String PROTOCOL = MicroclimateTestUtils.getProtocol();

	final String PROJECTS_API = MicroclimateTestUtils.getProjectsAPI();
	final String TYPES_API = MicroclimateTestUtils.getTypesAPI();
	final String STATUS_API = MicroclimateTestUtils.getStatusAPI();
	final String ACTION_API = MicroclimateTestUtils.getActionAPI();

	private static String lastbuild;
	
	MicroprofileProjectAPITests apiClass = new MicroprofileProjectAPITests();
	public static String exposedPort = MicroprofileProjectAPITests.exposedPort;
	public static String projectName = MicroprofileProjectAPITests.projectName;
	
	 @After
	    public void checkINotify() {
	    	ProcessRunner pr = MicroclimateTestUtils.runCommand("ps -ef | grep inotify", false);
	    	int count = 0;
	    	
	    	List<String> matches = new ArrayList<String>();
	    	for(String str : pr.getReceived().split("\\r?\\n")) {
	    	
	    		if(str.contains(apiClass.projectName)) {
	    			matches.add(str);
	    			count++;
	    		}
	    	}
	    	
	    	if(count > 1) {
	    		System.err.println("InotifyCount: "+count);
	    		for(String s : matches) {
	    			System.err.println(" - "+s);
	    		}
	    		if(count >= 2) {
	    			MicroclimateTestUtils.sleepForever();
	    		}
	    	}
	    }

}
