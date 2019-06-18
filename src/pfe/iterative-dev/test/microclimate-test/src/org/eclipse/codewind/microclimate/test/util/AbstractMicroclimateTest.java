package org.eclipse.codewind.microclimate.test.util;

import org.junit.After;
import org.junit.Before;
import org.junit.Rule;
import org.junit.rules.TestName;

public abstract class AbstractMicroclimateTest {

	/** Enable this to automatically upload the failing part of the FW log
	 * when a test failure occurs.*/
	public static final boolean UPLOAD_FAILED_TEST_FW_LOGS = false;
	
	@Rule public TestName testName = new TestName();
	
	private String getTestName() {
		return this.getClass().getSimpleName()+"."+testName.getMethodName();
	}
	
	@SuppressWarnings("rawtypes")
	protected static void printTestStart(Class clazz) {
		System.out.println();
		System.out.println();
		System.out.println();
		System.out.println(clazz.getName()+" -------------------------------------------------------------------------------------------------------------------------");
	}
	
	@Before
	public void before() {
		System.out.println();
		System.out.println(getTestName()+" ----------------------------------------------------------- ");
		
		if(UPLOAD_FAILED_TEST_FW_LOGS) {
			FWMonitorUtil.getInstance().addOrReplaceStaticReceivedTextListener();
		}
	}

	@After
	public void after() {
	}

	
	public void sleep(long timeInMsecs) {
		MicroclimateTestUtils.sleep(timeInMsecs);		
	}
	
	// Don't put Microclimate utility methods in here. :|

}
