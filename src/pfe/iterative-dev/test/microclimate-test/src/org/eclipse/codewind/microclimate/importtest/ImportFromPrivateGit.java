// DEPRECATED. DO NOT RUN AS PART OF FW TEST BUCKET
package org.eclipse.codewind.microclimate.importtest;

import org.junit.runner.RunWith;
import org.junit.runners.Suite;
import org.junit.runners.Suite.SuiteClasses;

@RunWith(Suite.class)
@SuiteClasses({ MicroprofileImportFromPrivateGit.class,
		NodeJSImportFromPrivateGit.class,
		SpringImportFromPrivateGit.class,
		SwiftImportFromPrivateGit.class })
public class ImportFromPrivateGit {

}
