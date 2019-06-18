package org.eclipse.codewind.microclimate.quarantine;


import org.junit.runner.RunWith;
import org.junit.runners.Suite;
import org.junit.runners.Suite.SuiteClasses;

@RunWith(Suite.class)

@SuiteClasses({
	MicroprofileAPITestQuarantine.class,
	NodeAPITestQuarantine.class,
	SpringAPITestQuarantine.class,
	SwiftAPITestQuarantine.class,
	MicrprofileCreationAndUpdateQuarantine.class
})

public class AllQuarantineTests {
	
}
