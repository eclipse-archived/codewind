package org.eclipse.codewind.microclimate.importtest;

import org.junit.runner.RunWith;
import org.junit.runners.Suite;
import org.junit.runners.Suite.SuiteClasses;

@RunWith(Suite.class)
@SuiteClasses({ MicroprofileImportFromPublicGit.class, NodeJSImportFromPublicGit.class, SpringImportFromPublicGit.class,
		SwiftImportFromPublicGit.class })
public class ImportFromPublicGit {

}
