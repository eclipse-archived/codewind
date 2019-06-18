package org.eclipse.codewind.microclimate.importtest;

import org.junit.runner.RunWith;
import org.junit.runners.Suite;
import org.junit.runners.Suite.SuiteClasses;

@RunWith(Suite.class)
@SuiteClasses({
	MicroprofileImportFromZip.class
	,SpringImportFromZip.class
	,NodeJSImportFromZip.class
	,SwiftImportFromZip.class
})
public class ImportFromZip {

}
