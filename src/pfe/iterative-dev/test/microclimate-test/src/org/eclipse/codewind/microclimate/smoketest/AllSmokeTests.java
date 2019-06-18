package org.eclipse.codewind.microclimate.smoketest;


import org.junit.runner.RunWith;
import org.junit.runners.Suite;
import org.junit.runners.Suite.SuiteClasses;

@RunWith(Suite.class)

@SuiteClasses({
	MicroprofileCreationAndUpdate.class
	,SpringCreationAndUpdate.class 
	,NodeJSCreationAndUpdate.class
	,SwiftCreationAndUpdate.class
	,PythonCreationAndUpdate.class
})

public class AllSmokeTests {
	
}
