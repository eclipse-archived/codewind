package org.eclipse.codewind.microclimate.test;

import org.eclipse.codewind.microclimate.importtest.AllImportTests;
import org.eclipse.codewind.microclimate.smoketest.AllSmokeTests;
import org.junit.runner.RunWith;
import org.junit.runners.Suite;
import org.junit.runners.Suite.SuiteClasses;

@RunWith(Suite.class)
@SuiteClasses({AllSmokeTests.class,
			   AllImportTests.class})
public class AllTestsIcp {

}
