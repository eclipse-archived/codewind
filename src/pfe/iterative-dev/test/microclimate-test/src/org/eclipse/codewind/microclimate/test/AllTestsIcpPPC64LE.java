package org.eclipse.codewind.microclimate.test;

import org.eclipse.codewind.microclimate.importtest.AllImportTestsPPC64LE;
import org.eclipse.codewind.microclimate.smoketest.AllSmokeTestsPPC64LE;
import org.junit.runner.RunWith;
import org.junit.runners.Suite;
import org.junit.runners.Suite.SuiteClasses;

@RunWith(Suite.class)
@SuiteClasses({AllSmokeTestsPPC64LE.class,
               AllImportTestsPPC64LE.class})
public class AllTestsIcpPPC64LE {

}
