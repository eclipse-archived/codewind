package org.eclipse.codewind.iterdev.tests.utils;

import java.io.BufferedReader;
import java.io.BufferedWriter;
import java.io.File;
import java.io.FileReader;
import java.io.FileWriter;
import java.io.IOException;
import java.io.InputStreamReader;
import java.net.HttpURLConnection;
import java.net.URL;
import java.net.URLConnection;
import java.util.ArrayList;

import org.apache.commons.codec.digest.DigestUtils;

import org.eclipse.codewind.iterdev.Constants;
import org.eclipse.codewind.iterdev.IDCUtils;

import static org.junit.Assert.assertNotNull;

public class IDCTestUtil {
	
	private static String IDC_TEST_FILE = "testIDC.sh";
	
	public static String getTestScriptPath(String userDir) {
		
		boolean isWindows = System.getProperty("os.name").toLowerCase().contains("windows");
		
		if(isWindows) {
			IDC_TEST_FILE = "testIDC.bat";
		}
		
		String testScriptPath = getTestScriptDir(userDir) + File.separator + IDC_TEST_FILE;
		
		return testScriptPath;
	}
	
	public static String getDockerAppDir(String userDir) {
		String temp[] = userDir.split("test/idc-test");
		String dockerAppDir = temp[0] + "docker/app";
		
		return dockerAppDir;
	}
	
	public static String getFileWatcherIDCDir(String userDir) {
		String temp[] = userDir.split("iterative-dev/test/idc-test");
		String dockerAppDir = temp[0] + "file-watcher/idc";
		
		return dockerAppDir;
	}
	
	public static String getDockerDir(String userDir) {
		String temp[] = userDir.split("test/idc-test");
		String dockerDir = temp[0] + "docker";
		
		return dockerDir;
	}
	
	public static String getTestScriptDir(String userDir) {
		String scriptsDirPath = userDir + File.separator + "scripts";
		
		return scriptsDirPath;
	}
	
	public static String getDigest(String path) {
		String digest = DigestUtils.sha1Hex(path.getBytes());
		return digest;
	}
	
	public static boolean deleteIDCConfig(String path) {
		boolean isDeleted = false;
		File artifactsDir = new File(path);
		File[] files = artifactsDir.listFiles();
		for (File file : files) {
			if(file.getName().equals("idc.config")) {
				isDeleted = file.delete();
        		}
		}
		
		return isDeleted;
	}
	
	public static void delete(String sourcePath) throws IOException {
        File source = new File(sourcePath);
        File[] files = source.listFiles();
        for (File file : files) {
        	
	        	if(file.getName().equals(".gitignore") || file.getName().equals("target") || file.getName().equals("mc-target")) {
	        		continue;
	        	}
        	
            File fileName = new File(sourcePath + File.separator + file.getName());
            if (file.isDirectory()) {
            		IDCUtils.deleteDir(fileName);
            } else {
            		fileName.delete();
            }
        }
    }
	
	public static String testAppEndPoints(String endPoint, String port) {
		URL url;
		
		String endPointURL = null;
		String urlContent = null;
		
		if(endPoint.equals("health")) {
			endPointURL = "/webapp/health";
		} else if(endPoint.equals("example")) {
			endPointURL = "/webapp/v1/example";
		}
		
		try {
				String appEndpoint = "http://localhost:" + port + endPointURL;
				url = new URL(appEndpoint);
				URLConnection connection = url.openConnection();
				BufferedReader br = new BufferedReader(new InputStreamReader(connection.getInputStream()));
	
				String s;
	
				while ((s = br.readLine()) != null) {
					urlContent = s;
				}
				br.close();
		} catch (IOException e) {
			e.printStackTrace();
		}
		
		return urlContent;
	}
	
	public static boolean pingIDCHost(String host, int timeout) {
		try {
			URL url = new URL(host);
			HttpURLConnection connection = (HttpURLConnection) url.openConnection();
			connection.setConnectTimeout(timeout);
			connection.setReadTimeout(timeout);
			int respCode = connection.getResponseCode();
			if(respCode >= 200 && respCode <=399) {
				return true;
			} else {
				return false;
			}
		} catch (IOException exception) {
			exception.printStackTrace();
			return false;
		}
	}

	public static boolean validateHelpOutput(String str) {
		
		boolean isValid = false;
		
		if(str.contains("Commands:")) {
			isValid = true;
		}
		
		for(String validCmd: Constants.VALID_COMMANDS) {
			if(str.contains(validCmd)) {
				isValid = true;
				break;
			}
		}
		
		return isValid;
	}
	
	public static void updateFile(File file, String content) {

		BufferedReader br = null;
		FileReader fr = null;

		BufferedWriter bw = null;
		FileWriter fw = null;
		
		String contentCheck = null;
		
		String filePath = file.getPath();
		String fileName = filePath.substring(filePath.lastIndexOf("/") + 1);
		
		if (fileName.equals("server.xml")) {
			contentCheck = "<featureManager>";
		} else if (fileName.equals("Dockerfile-build")) {
			contentCheck = "RUN mkdir -m 777 -p /config/resources";
		}

		boolean isPresent = true;
		ArrayList<String> lines = new ArrayList<String>();

		try {
			fr = new FileReader(file);
			br = new BufferedReader(fr);

			String str;

			while ((str = br.readLine()) != null) {
				lines.add(str);
				lines.add("\n");
				if (str.contains(contentCheck)) {
					lines.add(content);
					lines.add("\n");
				}
			}
		} catch (IOException e) {
			e.printStackTrace();
		} finally {
			try {
				if (br != null)
					br.close();
				if (fr != null)
					fr.close();
			} catch (IOException ex) {
				ex.printStackTrace();
			}
		}

		try {
			fw = new FileWriter(file);
			bw = new BufferedWriter(fw);
			for (String s : lines)
				bw.write(s);

		} catch (IOException e) {
			e.printStackTrace();
		} finally {
			try {
				bw.flush();
				bw.close();
				fw.close();
			} catch (IOException e) {
				e.printStackTrace();
			}
		}
	}
	
	
	//Copy-pasted class from Stephanie's Microclimate Test Util. 
	//Need to update pom projects so we can share classes and apis
	public static void updateFile(String path, String originalString, String replaceString) throws Exception{
		File fileNeedsUpdate = new File(path);      
		BufferedReader br = null;   
		FileWriter writer = null;      
		try{
			br = new BufferedReader(new FileReader(fileNeedsUpdate));
			String line;
			StringBuilder stringbuilder = new StringBuilder();;

			while ((line = br.readLine())!= null){
				stringbuilder.append(line + System.lineSeparator());
			}
			assertNotNull(stringbuilder);

			String Content = stringbuilder.toString();
			String newContent = Content.replaceAll(originalString, replaceString);
			writer = new FileWriter(fileNeedsUpdate);

			writer.write(newContent);
		}finally{ 
			if(br!=null)
				br.close(); 
			if(writer!=null)
				writer.close();
		}
	}
	
	public static boolean checkForMessages(File file) {

		BufferedReader br = null;
		FileReader fr = null;

		String contentCheck = null;

		String filePath = file.getPath();
		String fileName = filePath.substring(filePath.lastIndexOf("/") + 1);

		if (fileName.equals("messages.log")) {
			contentCheck = "(?s).*\\bThe server installed the following features\\b.*\\bsocialLogin-1.0\\b.*";
		} else {
			contentCheck = "fileNotPresent";
		}

		boolean isPresent = false;

		try {
			fr = new FileReader(file);
			br = new BufferedReader(fr);

			String str;

			while ((str = br.readLine()) != null) {
				if (str.matches(contentCheck)) {
					isPresent = true;
					break;
				}
			}
		} catch (IOException e) {
			e.printStackTrace();
		} finally {
			try {
				if (br != null)
					br.close();

				if (fr != null)
					fr.close();
			} catch (IOException ex) {
				ex.printStackTrace();
			}
		}

		return isPresent;
	}

}
