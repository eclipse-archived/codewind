package org.eclipse.codewind.microclimate.smoketest;


import org.junit.runner.RunWith;
import org.junit.runners.Suite;
import org.junit.runners.Suite.SuiteClasses;

@RunWith(Suite.class)

@SuiteClasses({ MicroprofileCreationAndUpdate.class,
	            SpringCreationAndUpdate.class, 
	            NodeJSCreationAndUpdate.class,
	            PythonCreationAndUpdate.class,
	            GoCreationAndUpdate.class})

public class AllSmokeTestsPPC64LE {
	
}
