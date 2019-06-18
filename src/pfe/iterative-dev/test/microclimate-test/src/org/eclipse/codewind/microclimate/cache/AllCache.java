package org.eclipse.codewind.microclimate.cache;

import org.junit.runner.RunWith;
import org.junit.runners.Suite;
import org.junit.runners.Suite.SuiteClasses;

@RunWith(Suite.class)
@SuiteClasses({MicroprofileProjectCache.class,
	SpringProjectCache.class,
	NodeProjectCache.class,
	SwiftProjectCache.class,
	PythonProjectCache.class})
public class AllCache {

}
