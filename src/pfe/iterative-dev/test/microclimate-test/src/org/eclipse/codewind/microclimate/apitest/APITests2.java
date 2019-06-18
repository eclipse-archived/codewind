package org.eclipse.codewind.microclimate.apitest;

import org.junit.runner.RunWith;
import org.junit.runners.Suite;
import org.junit.runners.Suite.SuiteClasses;

@RunWith(Suite.class)

@SuiteClasses({
	SpringProjectAPITests.class
	,SwiftProjectAPITests.class
	,ShutdownAPITests.class
})

public class APITests2 {
	/**
	 * The APITests bucket is split up because they are run as part of Pull Request builds.
	 * They are run concurrently to reduce build time.
	 */
}
