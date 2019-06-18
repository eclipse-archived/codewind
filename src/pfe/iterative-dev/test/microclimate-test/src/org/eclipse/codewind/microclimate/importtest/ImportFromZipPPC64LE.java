package org.eclipse.codewind.microclimate.importtest;

import org.junit.runner.RunWith;
import org.junit.runners.Suite;
import org.junit.runners.Suite.SuiteClasses;

@RunWith(Suite.class)
@SuiteClasses({ MicroprofileImportFromZip.class,
	            SpringImportFromZip.class,
	            NodeJSImportFromZip.class})
public class ImportFromZipPPC64LE {

}
