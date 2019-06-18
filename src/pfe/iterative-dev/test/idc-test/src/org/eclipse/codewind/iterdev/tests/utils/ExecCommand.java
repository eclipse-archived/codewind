package org.eclipse.codewind.iterdev.tests.utils;

import java.io.IOException;
import org.eclipse.codewind.iterdev.ProcessRunner;

public class ExecCommand {
	
	static ProcessRunner pr;
	
	static String rootPassword = "";
	
	public static ProcessRunner runCommand(String cmd) throws IOException, InterruptedException {
		boolean isWindows = System.getProperty("os.name").toLowerCase().contains("windows");
		
		if (isWindows) {
			cmd = cmd.replace("/", "\\");
			pr = new ProcessRunner(new String[] { "cmd", "/c", cmd }, true);

		} else {
			pr = new ProcessRunner(new String[] { "/bin/bash", "-c", cmd }, true);
		}
		
		pr.startAndWaitForTermination();
		
		return pr;
	}
}
