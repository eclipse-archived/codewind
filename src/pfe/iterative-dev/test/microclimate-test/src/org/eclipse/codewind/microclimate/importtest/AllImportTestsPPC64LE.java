package org.eclipse.codewind.microclimate.importtest;

import org.junit.runner.RunWith;
import org.junit.runners.Suite;
import org.junit.runners.Suite.SuiteClasses;

@RunWith(Suite.class)
@SuiteClasses({ ImportFromZipPPC64LE.class,
	            ImportFromFolderPPC64LE.class})
public class AllImportTestsPPC64LE {

}