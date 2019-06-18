package org.eclipse.codewind.microclimate.test.util;

import static org.junit.Assert.assertTrue;
import static org.junit.Assert.fail;

import java.io.BufferedReader;
import java.io.ByteArrayInputStream;
import java.io.DataOutputStream;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileNotFoundException;
import java.io.FileReader;
import java.io.FileWriter;
import java.io.IOException;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.io.OutputStreamWriter;
import java.io.StringReader;
import java.net.HttpURLConnection;
import java.net.MalformedURLException;
import java.net.URL;
import java.nio.file.Files;
import java.nio.file.StandardOpenOption;
import java.security.SecureRandom;
import java.security.cert.X509Certificate;
import java.util.HashSet;

import javax.json.Json;
import javax.json.JsonArray;
import javax.json.JsonObject;
import javax.json.JsonReader;
import javax.json.JsonReaderFactory;
import javax.json.JsonValue;
import javax.net.ssl.HostnameVerifier;
import javax.net.ssl.HttpsURLConnection;
import javax.net.ssl.SSLContext;
import javax.net.ssl.SSLSession;
import javax.net.ssl.TrustManager;
import javax.net.ssl.X509TrustManager;

import org.apache.commons.codec.digest.DigestUtils;
import org.eclipse.codewind.microclimate.smoketest.MicroprofileCreationAndUpdate;
import org.eclipse.codewind.microclimate.test.util.SocketUtil.SocketEvent;
import org.eclipse.codewind.iterdev.ProcessRunner;

public class MicroclimateTestUtils {
	public final static String retryCountOverride = System.getProperty("retryCount");
	public final static int retryCount = retryCountOverride == null ? 2 : Integer.parseInt(retryCountOverride);
	private final static String OS = System.getProperty("os.name").toLowerCase();
	private final static String nonDefaultWorkspace = System.getProperty("microclimate.workspace");
	public final static String workspace = nonDefaultWorkspace == null ? System.getProperty("user.home") + "/codewind-workspace/" : nonDefaultWorkspace.endsWith("/") ? nonDefaultWorkspace : nonDefaultWorkspace + "/";

	private final static String portalAPIVersionOverride = System.getProperty("portalAPIVersion");
	private final static String portalAPIVersion = portalAPIVersionOverride == null ? "v2" : portalAPIVersionOverride;

	private final static String isWindows = System.getProperty("isMicroclimateRunningOnWindows");
	public final static boolean isMicroclimateRunningOnWindows = isWindows == null ? false : isWindows.equals("true");

	public final static String microprofilePublicRepo = "https://github.com/maysunfaisal/testliberty";
	public final static String springPublicRepo = "https://github.com/maysunfaisal/testspring";
	public final static String nodePublicRepo = "https://github.com/maysunfaisal/testnode";
	public final static String swiftPublicRepo = "https://github.com/maysunfaisal/testswift";

	public final static String microprofilePrivateRepo = "https://github.ibm.com/Maysun-J-Faisal/javaliberty.git";
	public final static String springPrivateRepo = "https://github.ibm.com/dev-ex/microclimate-test-spring.git";
	public final static String nodePrivateRepo = "https://github.ibm.com/dev-ex/microclimate-test-nodejs.git";
	public final static String swiftPrivateRepo = "https://github.ibm.com/Stephanie-Cao/swifttest1234.git";
	public final static String accessToken = System.getProperty("accessToken");

	// test suite types
	public enum SUITE_TYPES {apitest, importtest, smoketest};

	// project types
	public enum PROJECT_TYPES {liberty, nodejs, spring, swift, python, go};

	public final static String userDir =  System.getProperty("user.dir");
	public final static String rescourceDir = userDir + "/resources/";

	private static DataOutputStream request;
	private final static String boundary =  "*****";
	private final static String newLine = "\r\n";
	private final static String twoHyphens = "--";

	private final static String cookie = System.getProperty("cookie");

	private static final JsonReaderFactory jsonFactory = Json.createReaderFactory(null);

	private static final String PROTOCOL = "http";
	private static final String PORT = "9090";

	private static String DEFAULT_NAMESPACE = "default";

	/* API Endpoints */
	private static final String PROJECTS_API = "/api/v1/projects/";
	private static final String PROJECTS_API_V2 = "/api/v2/projects/";
	private static final String IMPORT_API = "/api/v1/import/";
	private static final String IMPORT_API_V2 = "/api/v2/import/";
	private static final String BIND_API = "/api/v1/projects/bind/";
	private static final String TYPES_API = PROJECTS_API + "types";
	private static final String ACTION_API = PROJECTS_API + "action";
	private static final String STATUS_API = PROJECTS_API + "status";
	private static final String SHUTDOWN_API = PROJECTS_API + "shutdown";
	private static final String FW_INTERNAL_LOG_API = "/internal/logs/fw";

	private static SocketUtil cachedsu = null;

	public static String getProtocol() {
		return PROTOCOL;
	}

	public static String getPort() {
		return PORT;
	}

	public static String getProjectsAPI() {
		return PROJECTS_API;
	}

	public static String getProjectsAPIV2() {
		return PROJECTS_API_V2;
	}

	public static String getImportAPI() {
		return IMPORT_API;
	}

	public static String getImportAPIV2() {
		return IMPORT_API_V2;
	}

	public static String getBindAPI() {
		return BIND_API;
	}

	public static String getTypesAPI() {
		return TYPES_API;
	}

	public static String getActionAPI() {
		return ACTION_API;
	}

	public static String getStatusAPI() {
		return STATUS_API;
	}

	public static String getShutDownAPI() {
		return SHUTDOWN_API;
	}

	public static String getFWInternalLogAPI() {
		return FW_INTERNAL_LOG_API;
	}

	public static String getSettingsAPI(String projectID) {
		return ( PROJECTS_API + projectID +  "/settings");
	}

	public static void setDefaultNS(String ns) {
		DEFAULT_NAMESPACE = ns;
	}


	public static boolean isWindows() {
		return (OS.indexOf("win") >= 0);
	}

	public static class PairedResponse {
		public HttpResponse httpResponse;
		public SocketEvent[] socketEvents;

		public PairedResponse(HttpResponse httpResponse, SocketEvent[] socketEvents) {
			this.httpResponse = httpResponse;
			this.socketEvents = socketEvents;
		}
	}

	public static int projectCreation(String urlParameters, String testType) {

		String api = getProjectsAPI();

		if (portalAPIVersion.equals("v2")) {
			api = MicroclimateTestUtils.getProjectsAPIV2();
		}

		int responseCode = httpRequest(api, urlParameters, testType);

		// Portal V1 create api returns HTTP_OK and V2 create api returns HTTP_ACCEPTED
		return responseCode;

	}

	public static int httpRequest(String api, String urlParameters, String testType) {
		Logger.println(MicroclimateTestUtils.class, "projectCreation()", "Creating Project on " + testType + "...");
		String url = getBaseURL(testType);
		if (url != null) {
			url = url + api;
		}
		trustAllCertificates();
		Logger.println(MicroclimateTestUtils.class, "projectCreation()", "Sending request to " + url);
		HttpURLConnection connection;
		try {
			connection = (HttpURLConnection) new URL(url).openConnection();
		} catch (Exception e) {
			throw new RuntimeException("Unable to connect to URL: "+url, e);
		}

		if (testType.equalsIgnoreCase("icp")) {
			//trustAllCertificates();
			connection.setRequestProperty("Cookie", cookie);
		}

		try {
			connection.setDoOutput(true);
			connection.setDoInput(true);
			connection.setRequestProperty("Content-Type", "application/json");
			connection.setRequestMethod("POST");

			OutputStreamWriter wr = new OutputStreamWriter(connection.getOutputStream());
			wr.write(urlParameters);
			wr.flush();
			wr.close();

			int HttpResult = connection.getResponseCode();
			return HttpResult;
		} catch(IOException e) {
			throw new RuntimeException("Exception on connect to URL: "+url, e);
		}
	}

	public static int importLocalProject(String filePath, String projectName, String testType) {
		Logger.println(MicroclimateTestUtils.class, "importLocalProject()",
				"Importing project " + projectName + " from " + filePath);

		String api = getImportAPI();

		if (portalAPIVersion.equals("v2")) {
			api = MicroclimateTestUtils.getImportAPIV2();
		}

		String url = null;
		trustAllCertificates();

		if (testType.equalsIgnoreCase("icp")) {
			String ipCmd = "kubectl get configmap -n services oauth-client-map -o jsonpath=\"{.data.PROXY_IP}\"";
			ProcessRunner prIp = runCommand(ipCmd);
			String ip = prIp.getReceived().trim();
			url = "https://" + "microclimate." + ip + ".nip.io" + api;
		} else if (testType.equalsIgnoreCase("local")) {
			url = "http://localhost:9090" + api;
		}

		HttpURLConnection connection = null;
		int responseCode = 0;

		Logger.println(MicroclimateTestUtils.class, "importLocalProject()", "Sending request to " + url);

		try {
			connection= (HttpURLConnection) new URL(url).openConnection();

			if (testType.equalsIgnoreCase("icp")) {
				trustAllCertificates();
				connection.setRequestProperty("Cookie", cookie);
			}

			connection.setUseCaches(false);
			connection.setDoOutput(true); // indicates POST method
			connection.setDoInput(true);
			connection.setRequestMethod("POST");
			connection.setRequestProperty("Connection", "Keep-Alive");
			connection.setRequestProperty("Cache-Control", "no-cache");
			connection.setRequestProperty("Content-Type", "multipart/form-data;boundary=" + boundary);
			request =  new DataOutputStream(connection.getOutputStream());

			//projectName
			request.writeBytes(twoHyphens + boundary + newLine);
			request.writeBytes("Content-Disposition: form-data; name=\"" + "projectName" + "\""+ newLine);
			request.writeBytes("Content-Type: text/plain; charset=UTF-8" + newLine);
			request.writeBytes(newLine);
			request.writeBytes(projectName+ newLine);
			request.flush();

			File uploadFile = new File(filePath);

			if(uploadFile.isFile()) {
				attachFile(uploadFile);
			}else {
				attachDirectory(uploadFile, filePath, projectName);
			}

			//done
			request.writeBytes(newLine);
			request.writeBytes(twoHyphens + boundary + twoHyphens + newLine);
			request.flush();
			request.close();

			responseCode = connection.getResponseCode();

			// Portal V1 import API returns HTTP_OK and V2 import API returns HTTP_ACCEPTED
			return responseCode;
		}catch (Exception e) {
			Logger.println(MicroclimateTestUtils.class, "importLocalProject()",
					"Exception occurred during project import: " + e.getMessage(),e);
			return responseCode;
		}finally {
			if(connection!=null) {
				connection.disconnect();
			}
		}
	}

	public static String sendGet(String url, String testType) {
		return sendGet(url, testType, true);
	}

	public static String sendGet(String url, String testType, boolean log){
		if (log) {
		    Logger.log("Sending get request to url: " + url);
		}

		HttpURLConnection connection = null;
		BufferedReader in = null;

		try {
			connection = (HttpURLConnection) new URL(url).openConnection();

			if (testType.equalsIgnoreCase("icp")) {
				trustAllCertificates();
				connection.setRequestProperty("Cookie", cookie);
			}

			connection.setRequestMethod("GET");
			int responseCode = connection.getResponseCode();

			if (responseCode == HttpURLConnection.HTTP_OK) {
				in = new BufferedReader(new InputStreamReader(
						connection.getInputStream()));
				String inputLine;
				StringBuffer res = new StringBuffer();

				while ((inputLine = in.readLine()) != null) {
					res.append(inputLine);
				}

				if(res!=null) {
					return(res.toString());
				}
			}
		} catch (Exception e) {
			Logger.println(MicroclimateTestUtils.class, "sendGet()", "Exception occurred: " + e.getMessage(), null);
			return null;
		} finally {
			if(connection!=null) {
				connection.disconnect();
			}
			if(in!=null) {
				try {
					in.close();
				} catch (IOException e) {
					e.printStackTrace();
				}
			}
		}

		return null;
	}

	public static String getexposedPort(String projectname, String testType, PROJECT_TYPES projectType)  {
		HashSet<String> knownContainers = new HashSet<String>();
		int counter = 0;
		while(true) {
			if(++counter % 5 == 0) { // print to logs periodically to indicate the test is still running
				Logger.println(MicroclimateTestUtils.class, "getexposedPort()", "Still waiting for the container to come up...");
			}
			sleep(3000);
			String cmd = null;

			if (testType.equalsIgnoreCase("local")) {
				cmd = "docker ps --format '{{.Image}}@#@{{.Ports}}'";
			} else if (testType.equalsIgnoreCase("icp")) {
				cmd = "kubectl get service -o go-template --template '{{range .items}}{{.metadata.name}}{{\"@#@\"}}{{range .spec.ports}}{{.nodePort}}{{\"@P@\"}}{{end}}{{\"\\n\"}}{{end}}' -n " + DEFAULT_NAMESPACE;
			}

			ProcessRunner pr = runCommand(cmd, false);

			String httpPort = null;
			String containerName = null;
			String received = pr.getReceived();

			if(received == null) {
				return null;
			}

			if (testType.equalsIgnoreCase("icp") && projectname.length() >= 23) {
				projectname = projectname.substring(0, 23);
			}

			for (String output : received.split("\\r?\\n")) {
				String contents[] = output.split("@#@");
				if(contents.length!=2) {
					continue;
				}

				containerName = contents[0];
				String ports = contents[1];

				// Some projects on ICP can expose multiple ports, just grab the first one
				if (testType.equalsIgnoreCase("icp")) {
					ports = ports.split("@P@")[0];
				}

				// Only log when we encounter new containers
				if(!knownContainers.contains(containerName)) {
					knownContainers.add(containerName);
					Logger.println(MicroclimateTestUtils.class, "getexposedPort()", "Container Image Name: " + containerName);
					Logger.println(MicroclimateTestUtils.class, "getexposedPort()", "Port: " + ports);
				}

				if(containerName != null && containerName.contains(projectname) && !containerName.endsWith("-build")) {
					Logger.println(MicroclimateTestUtils.class, "getexposedPort()","----");
					Logger.println(MicroclimateTestUtils.class, "getexposedPort()", "Container Image Name: " + containerName);
					Logger.println(MicroclimateTestUtils.class, "getexposedPort()", "----");

					if(ports != null) {
						if (testType.equalsIgnoreCase("local")) {
							httpPort = ports.substring(ports.indexOf(":") + 1, ports.indexOf("->"));

							if (projectType == PROJECT_TYPES.liberty) {
								httpPort = ports.substring(ports.indexOf("->9080") - 5, ports.indexOf("->9080"));
							} else if (projectType == PROJECT_TYPES.spring) {
								httpPort = ports.substring(ports.indexOf("->8080") - 5, ports.indexOf("->8080"));
							} else if (projectType == PROJECT_TYPES.nodejs) {
								httpPort = ports.substring(ports.indexOf("->3000") - 5, ports.indexOf("->3000"));
							} else if (projectType == PROJECT_TYPES.swift) {
								httpPort = ports.substring(ports.indexOf("->8080") - 5, ports.indexOf("->8080"));
							}  else if (projectType == PROJECT_TYPES.go) {
								httpPort = ports.substring(ports.indexOf("->8000") - 5, ports.indexOf("->8000"));
							}   else if (projectType == PROJECT_TYPES.python) {
								httpPort = ports.substring(ports.indexOf("->5000") - 5, ports.indexOf("->5000"));
							}
						} else if (testType.equalsIgnoreCase("icp")) {
							httpPort = ports;
						}

						return httpPort;
					}
				}
			}
		}
	}

	public static boolean checkProjectExistency(String projectname, String testType) {
		String url = getBaseURL(testType);
		if (url != null) {
			url = url + PROJECTS_API;
		}

		String projectList = sendGet(url, testType);

		if(projectList != null && projectList.contains(projectname))  {
			Logger.log("Found project " + projectname);
			return true;
		}
		else {
			return false;
		}
	}


	public static boolean waitForProjectStarted(String projectID, String testType, long timeoutMs) {
		// It would be better to listen for relevant socket events, but this is easier.
		String baseUrl = MicroclimateTestUtils.getBaseURL(testType, PORT, PROTOCOL);
		String statusApiUrl = baseUrl + getStatusAPI() + "?type=appState&projectID=" + projectID;
		final String appStatus = "appStatus";
		final String appStatusStarted = "started";

		boolean started = false;
		long startTime = System.currentTimeMillis();
		while (!started && startTime + timeoutMs > System.currentTimeMillis()) {
			Logger.log("Waiting for " + projectID + " to be Started");

			String status = sendGet(statusApiUrl, testType);

			if (status != null) {
				JsonObject jso = jsonFactory.createReader(new StringReader(status)).readObject();
				if (jso.containsKey(appStatus)) {
					Logger.log("Response had " + appStatus + ", was: " + jso.getString(appStatus));
					started = jso.getString(appStatus).equals(appStatusStarted);
				}
				else {
					Logger.log("Response didn't have " + appStatus + ", was: " + status);
				}
			}
			else {
				Logger.log("Status response was null");
			}


			sleep(5000);
		}
		int elapsed = (int)(System.currentTimeMillis() - startTime) / 1000;
		Logger.log(String.format("%s %s start after %ds elapsed", projectID, started ? "did" : "didn't", elapsed));
		return started;
	}

	public static boolean waitForProjectStopped(String projectID, String testType, long timeoutMs) {
		// It would be better to listen for relevant socket events, but this is easier.
		String baseUrl = MicroclimateTestUtils.getBaseURL(testType, PORT, PROTOCOL);
		String statusApiUrl = baseUrl + getStatusAPI() + "?type=appState&projectID=" + projectID;
		final String appStatus = "appStatus";
		final String appStatusStopped = "stopped";

		boolean stopped = false;
		long startTime = System.currentTimeMillis();
		while (!stopped && startTime + timeoutMs > System.currentTimeMillis()) {
			Logger.log("Waiting for " + projectID + " to be Stopped");

			String status = sendGet(statusApiUrl, testType);

			if (status != null) {
				JsonObject jso = jsonFactory.createReader(new StringReader(status)).readObject();
				if (jso.containsKey(appStatus)) {
					Logger.log("Response had " + appStatus + ", was: " + jso.getString(appStatus));
					stopped = jso.getString(appStatus).equals(appStatusStopped);
				}
				else {
					Logger.log("Response didn't have " + appStatus + ", was: " + status);
				}
			}
			else {
				Logger.log("Status response was null");
			}


			sleep(5000);
		}
		int elapsed = (int)(System.currentTimeMillis() - startTime) / 1000;
		Logger.log(String.format("%s %s stop after %ds elapsed", projectID, stopped ? "did" : "didn't", elapsed));
		return stopped;
	}

	public static boolean checkEndpoint(String expectedString, String exposedPort, String api, String testType) {
        String url = null;

		if (testType.equalsIgnoreCase("icp")) {
			String ipCmd = "kubectl get configmap -n services oauth-client-map -o jsonpath=\"{.data.PROXY_IP}\"";
			ProcessRunner prIp = runCommand(ipCmd);
			String ip = prIp.getReceived().trim();
			String newIp = "microclimate." + ip + ".nip.io";
			url = "http://" + newIp + ":" + exposedPort + api;
		} else if (testType.equalsIgnoreCase("local")) {
			url = "http://localhost:" + exposedPort + api;
		}

		String webContent = sendGet(url, testType);

		if(webContent != null && webContent.contains(expectedString)) {
			return true;
		} else {
			Logger.println(MicroclimateTestUtils.class, "checkEndpoint()", "Expected '" + expectedString + "' in result but got: " + webContent);
			return false;
		}
	}

	public static void updateDockerFile(String testType, String projectName, String file, String content) {
		String ws = null;

		if (testType.equalsIgnoreCase("local")) {
			ws = workspace;
		} else if (testType.equalsIgnoreCase("icp")) {
			ws = "/codewind-workspace/";
		}

		String path = ws + projectName + "/" + file;
		String pod = null;

		if (testType.equalsIgnoreCase("local")) {
			MicroclimateTestUtils.updateDockerFile(new File(path), content);
		} else if (testType.equalsIgnoreCase("icp")) {
			pod = MicroclimateTestUtils.getEditorPod();
			MicroclimateTestUtils.kubectlUpdateDockerFile(pod, path, content);
		}
	}

	public static void updateDockerFile(File DockerFile, String content) {
		if ( isMicroclimateRunningOnWindows ) {
			String fullPath = DockerFile.getAbsolutePath().replace("\\", "/");
			String containerPath = new String(fullPath);
			if ( containerPath.startsWith(workspace) ) {
				containerPath = containerPath.replaceFirst(workspace, "/codewind-workspace/");
				String cmd = "docker exec microclimate-file-watcher sh -c \"echo $'\\n'" + content + " >> " + containerPath + "\"";
				//Logger.println(MicroclimateTestUtils.class, "updateDockerFile()", "cmd = " + cmd);
				ProcessRunner pr = runCommand(cmd);
				//Logger.println(MicroclimateTestUtils.class, "updateDockerFile()", "cmd error code = " + pr.getErrorCode());
			}
		}
		else {
			try {
				Files.write(DockerFile.toPath(), (System.lineSeparator() + content).getBytes(), StandardOpenOption.APPEND);
			} catch (IOException e) {
				Logger.println(MicroprofileCreationAndUpdate.class, "updateDockerFile()", "Exception occurred during update docker file:" + e.getMessage(), e);
				throw new RuntimeException("Unable to write to update Docker file", e);
			}
		}
	}

	public static void kubectlUpdateDockerFile(String pod, String path, String content) {
		// String cmdSpace = "kubectl exec -it " + pod + " -- sh -c \"echo >> " + path + "\"";
		// ProcessRunner prSpace = runCommand(cmdSpace);
		String cmd = "kubectl exec -it " + pod + " -n " + DEFAULT_NAMESPACE + " -- sh -c \"echo >> " + path + ";" + "echo " + content + " >> " + path + "\"";
		ProcessRunner pr = runCommand(cmd);
	}

	public static boolean checkContainerPortExposed(String projectname, String testType) {

		try {
			int counter = 0;
			while(true) {
				if(++counter % 5 == 0) { // print to logs periodically to indicate the test is still running
					Logger.println(MicroclimateTestUtils.class, "checkContainerPortExposed()", "Still waiting for the container to come up...");
				}
				Thread.sleep(3000);
				String cmd = null;

				if (testType.equalsIgnoreCase("local")) {
					cmd = "docker ps --format '{{.Image}}@#@{{.Ports}}'";
				} else if (testType.equalsIgnoreCase("icp")) {
					cmd = "kubectl get service -o go-template --template '{{range .items}}{{.metadata.name}}{{\"@#@\"}}{{range .spec.ports}}{{.targetPort}}{{\"@P@\"}}{{end}}{{\"\\n\"}}{{end}}' -n " + DEFAULT_NAMESPACE;
				}

				ProcessRunner pr = runCommand(cmd, false);

				String containerName = null;
				String ports = null;
				String received = pr.getReceived();

				if(received == null) {
					return false;
				}

				if (testType.equalsIgnoreCase("icp") && projectname.length() >= 23) {
					projectname = projectname.substring(0, 23);
				}

				for (String output : received.split("\\r?\\n")) {
					String contents[] = output.split("@#@");
					if(contents.length!=2) {
						continue;
					}

					containerName = contents[0];
					ports = contents[1];

					if(containerName != null && containerName.contains(projectname) && !containerName.endsWith("-build")) {
						if(ports != null && ports.contains("4321")) {
							return true;
						}
					}
				}
			}
		} catch (Exception e) {
			Logger.println(MicroclimateTestUtils.class, "checkContainerPortExposed()", "Exception: " + e);
			return false;
		}
	}

	public static boolean checkContainerChange(String projectname, String testType) {
		String cmd = null;

		if (testType.equalsIgnoreCase("local")) {
			cmd = "docker ps --format '{{.Image}}@#@{{.Ports}}'";
		} else if (testType.equalsIgnoreCase("icp")) {
			cmd = "kubectl get pod -o go-template --template '{{range .items}}{{.metadata.name}}{{\"@#@\"}}{{range .spec.ports}}{{.nodePort}}{{end}}{{\"\\n\"}}{{end}}' -n " + DEFAULT_NAMESPACE;
		}

		//Logger.println(MicroclimateTestUtils.class, "checkContainerChange()", "cmd is " + cmd);
		ProcessRunner pr = runCommand(cmd);

		String containerName = null;
		String received = pr.getReceived();

		//Logger.println(MicroclimateTestUtils.class, "checkContainerChange()", "received is " + received);
		if(received == null) {
			return false;
		}

		if (testType.equalsIgnoreCase("icp") && projectname.length() >= 23) {
			projectname = projectname.substring(0, 23);
		}

		for (String output : received.split("\\r?\\n")) {

			String contents[] = output.split("@#@");

			if (testType.equalsIgnoreCase("local") && contents.length != 2) {
				continue;
			}

			containerName = contents[0];

			//Logger.println(MicroclimateTestUtils.class, "checkContainerChange()", "containerName is " + containerName);

			if(containerName!=null && containerName.contains(projectname) && !containerName.endsWith("-build")) {
				String ls_cmd = null;

				if (testType.equalsIgnoreCase("local")) {
					String dockerexec_cmd = "docker exec " + containerName;
					ls_cmd = dockerexec_cmd + " sh -c \"ls -al\"";
					if (projectname.contains("swift") || projectname.contains("nodejs") || projectname.contains("go") || projectname.contains("python")) {
						ls_cmd = dockerexec_cmd + " sh -c \"cd ..; ls -al\"";
					} else if (projectname.contains("liberty")) {
						ls_cmd = dockerexec_cmd + " sh -c \"ls -al /home/default\"";
					}
				} else if (testType.equalsIgnoreCase("icp")) {
					String kubectlexec_cmd = "kubectl exec -it " + containerName + " -n " + DEFAULT_NAMESPACE;
					ls_cmd = kubectlexec_cmd + " -- sh -c \"ls -al\"";
					if (projectname.contains("swift") || projectname.contains("nodejs") || projectname.contains("go") || projectname.contains("python")) {
						ls_cmd = kubectlexec_cmd + " -- sh -c \"cd ..; ls -al\"";
					} else if (projectname.contains("liberty")) {
						ls_cmd = kubectlexec_cmd + " -- sh -c \"ls -al /home/default\"";
					}
				}

				//Logger.println(MicroclimateTestUtils.class, "checkContainerChange()", "ls_cmd is " + ls_cmd);
				pr = runCommand(ls_cmd);
				for (String execOutput : pr.getReceived().split("\\r?\\n")) {
					//Logger.println(MicroclimateTestUtils.class, "checkContainerChange()", "execOutput is " + execOutput);
					if(execOutput.contains("test_directory")) {
						return true;
					}
				}
			}
		}
		return false;
	}

	public static int projectdeletion(String projectName, String testType) throws MalformedURLException, IOException {
		String url = null;
		String api = getProjectsAPI();
		String projectId = MicroclimateTestUtils.getProjectID(projectName, testType);

		if (testType.equalsIgnoreCase("icp")) {
			String ipCmd = "kubectl get configmap -n services oauth-client-map -o jsonpath=\"{.data.PROXY_IP}\"";
			ProcessRunner prIp = runCommand(ipCmd);
			String ip = prIp.getReceived().trim();
			url = "https://" + "microclimate." + ip + ".nip.io" + api + projectId;
		} else if (testType.equalsIgnoreCase("local")) {
			url = "http://localhost:9090" + api + projectId;
		}

		HttpURLConnection connection = (HttpURLConnection) new URL(url).openConnection();

		if (testType.equalsIgnoreCase("icp")) {
			trustAllCertificates();
			connection.setRequestProperty("Cookie", cookie);
		}

		connection.setRequestMethod("DELETE");

		int responseCode = connection.getResponseCode();

		sleep(20000); // since del is async, wait for sometime before proceeding

		return responseCode;
	 }


	public static ProcessRunner runCommand(String cmd) {
			return runCommand(cmd, true);
	}

	public static ProcessRunner runCommand(String cmd, boolean echoOutput) {
		ProcessRunner pr;
		if (isWindows()) {
			cmd = cmd.replace("/", "\\");
			pr = new ProcessRunner(new String[] { "cmd", "/c", cmd }, echoOutput);

		} else {
			pr = new ProcessRunner(new String[] { "/bin/bash", "-c", cmd }, echoOutput);
		}

		try {
			pr.startAndWaitForTermination();
		} catch(Throwable t) {
			throwAsUncheckedException(t);
		}
		return pr;
	}

	private static void throwAsUncheckedException(Throwable t) {
		if(t instanceof RuntimeException) {
			throw (RuntimeException)t;
		}
		throw new RuntimeException(t);
	}

	public static String getDigest(String path) {
			String digest = DigestUtils.sha1Hex(path.getBytes());
			return digest;
		}


	public static void attachFile(File uploadFile) throws IOException {
    String fileName = uploadFile.getName();
    	request.writeBytes(twoHyphens + boundary + newLine);
        request.writeBytes("Content-Disposition: form-data; name=\"" +
                "files" + "\";filename=\"" +
                fileName + "\"" + newLine);
        request.writeBytes(newLine);
        byte[] bytes = Files.readAllBytes(uploadFile.toPath());
        request.write(bytes);
        request.flush();
	}

	public static void attachDirectory(File uploadFile, String rootPath, String projectName) throws IOException {
		File[] listOfFiles = uploadFile.listFiles();
        for(File curFile:listOfFiles) {
        		if(curFile.isDirectory()) {
					attachDirectory(curFile, rootPath, projectName);
				} else {
        	 	String filePath = projectName + "/" + new File(rootPath).toURI().relativize(curFile.toURI()).getPath();

             request.writeBytes(twoHyphens + boundary + newLine);
             request.writeBytes("Content-Disposition: form-data; name=\"" +
                     "file[]" + "\";filename=\"" +
                     filePath + "\"" +newLine);
             request.writeBytes(newLine);
             byte[] bytes = Files.readAllBytes(curFile.toPath());
             request.write(bytes);
             request.writeBytes(newLine);
             request.flush();
        		}
        }
	}

	public static String getFileWatcherPod() {
		String cmd = "kubectl get pod -n " + DEFAULT_NAMESPACE + " | grep microclimate-ibm-microclimate-admin-filewatcher | awk '{print $1}'";
		ProcessRunner pr = runCommand(cmd);
		String received = pr.getReceived();

		if(received == null) {
			return null;
		}

		return received.trim();
	}

	public static String getEditorPod() {
		String cmd = "kubectl get pod -n " + DEFAULT_NAMESPACE + " | grep microclimate-admin-editor | awk '{print $1}'";
		ProcessRunner pr = runCommand(cmd);
		String received = pr.getReceived();

		if(received == null) {
			return null;
		}

		return received.trim();
	}

	public static void kubectlCp(String src, String dest) {
		String cmd = "kubectl cp" + " " + src + " " + dest + " -n " + DEFAULT_NAMESPACE;

		@SuppressWarnings("unused")
		ProcessRunner pr = runCommand(cmd);
	}

	public static boolean existDirICP(String pod, String dirName) {
		String cmd = "kubectl exec -it " + pod + " -n " + DEFAULT_NAMESPACE + " -- sh -c \"ls\"";
		ProcessRunner pr = runCommand(cmd);
		String received = pr.getReceived();

		if(received.contains(dirName)) {
			return true;
		} else {
			return false;
		}
	}

	@SuppressWarnings("unused")
	public static void deleteFile(String filePath) {
		if(filePath == null) { return; }
		filePath = filePath.trim();

		if(filePath.isEmpty()) { throw new RuntimeException("Invalid delete path: "+filePath);  }
		if(filePath.equals("/") || filePath.equals("~")) { throw new RuntimeException("Invalid delete path: "+filePath);  }

		String cmd = "rm -rf " + filePath;

		ProcessRunner pr = runCommand(cmd);
	}

	public static String getProjectID(String projectName, String testType) {

		String url = getBaseURL(testType);
		if (url != null) {
			url = url + PROJECTS_API;
		}

		String projectList = sendGet(url, testType);
		InputStream stream = new ByteArrayInputStream(projectList.getBytes());
		JsonReader reader = jsonFactory.createReader(stream);
		JsonArray array = reader.readArray();
		for (int i = 0; i < array.size(); i++) {
			JsonObject obj = array.getJsonObject(i);
			if ( obj.getString("name").trim().toString().equals(projectName) ) {
				return obj.getString("projectID");
			}
		}

		Logger.println(MicroclimateTestUtils.class, "getProjectID()", "Cannot find projectID for project " + projectName);
		return null;

	}

	public static String getProjectType(String projectName, String testType)  {
		String projectType = "";
		String path = "";

		if (testType.equalsIgnoreCase("local")) {
			path = workspace + ".projects/" + projectName + ".inf";
		} else if (testType.equalsIgnoreCase("icp")) {
			String pod = MicroclimateTestUtils.getFileWatcherPod();

			String src = "default/" + pod + ":/codewind-workspace/.projects";
			String dest = workspace + "/temp/.projects";

			try {
				MicroclimateTestUtils.kubectlCp(src, dest);
			} catch (Exception e) {
				Logger.println(MicroclimateTestUtils.class, "getProjectType()", "Exception occurred during kubectl cp .projects file from file watcher pod to local: " + e.getMessage(), e);
				fail("Exception occurred during kubectl cp .projects file from file watcher pod to local");
			}

			path = workspace + "/temp/.projects/" + projectName + ".inf";
		}

		File infFile = new File(path);
		String language = "";
		String framework = "";
		// Project types: microprofile, spring, nodejs, swift

		if (infFile.exists()) {
			JsonReader jsonReader;
			try {
				jsonReader = Json.createReader(new FileInputStream(path));
			} catch (FileNotFoundException e) {
				throw new RuntimeException(e);
			}
			JsonObject jsonObject = jsonReader.readObject();
			if(jsonObject.containsKey("language")) {
				language = jsonObject.get("language").toString().replaceAll("\"", "");
			}

			if (language.equals("java")) {
				if(jsonObject.containsKey("framework")) {
					framework = jsonObject.get("framework").toString().replaceAll("\"", "");
				}

				projectType = framework;
			} else {
				projectType = language;
			}
		}

		if (testType.equalsIgnoreCase("icp")) {
			String dest = workspace + "/temp/.projects";

			try {
				MicroclimateTestUtils.deleteFile(dest);
			} catch (Exception e) {
				Logger.println(MicroclimateTestUtils.class, "getProjectType()", "Exception occurred during delete local .projects file: " + e.getMessage(), e);
				fail("Exception occurred during delete local .projects file");
			}
		}

		return projectType;
	}

	public static void trustAllCertificates() {
		try {
			TrustManager[] trustAllCerts = new TrustManager[]{
				new X509TrustManager() {
					public X509Certificate[] getAcceptedIssuers() {
						X509Certificate[] myTrustedAnchors = new X509Certificate[0];
						return myTrustedAnchors;
					}

					public void checkClientTrusted(X509Certificate[] certs, String authType) {
					}

					public void checkServerTrusted(X509Certificate[] certs, String authType) {
					}
				}
			};

			SSLContext sc = SSLContext.getInstance("SSL");
			sc.init(null, trustAllCerts, new SecureRandom());
			HttpsURLConnection.setDefaultSSLSocketFactory(sc.getSocketFactory());
			HttpsURLConnection.setDefaultHostnameVerifier(new HostnameVerifier() {
				public boolean verify(String arg0, SSLSession arg1) {
					return true;
				}
			});
		} catch (Exception e) {
			Logger.println(MicroclimateTestUtils.class, "trustAllCertificates()", "Exception occurred during trust all certificates: " + e.getMessage(), e);
			throwAsUncheckedException(e);
		}
	}

	public static boolean existContainer(String projectName) {
		String cmd = "docker ps --format '{{.Image}}'";
		ProcessRunner pr = runCommand(cmd);

		String imageName = null;
		String received = pr.getReceived();

		for (String output : received.split("\\r?\\n")) {

			imageName = output.trim();

			if(imageName != null && imageName.equals(projectName) && !imageName.endsWith("-build")) {
				return true;
			}
		}

		return false;
	}

	public static boolean existImage(String projectName) {
		String cmd = "docker images --format '{{.Repository}}'";
		ProcessRunner pr = runCommand(cmd);

		String repoName = null;
		String received = pr.getReceived();

		for (String output : received.split("\\r?\\n")) {
			repoName = output.trim();

			if(repoName != null && repoName.equals(projectName)) {
				return true;
			}
		}

		return false;
	}

	public static boolean existPod(String projectName) {
		String cmd = "kubectl get pod -n " + DEFAULT_NAMESPACE + " | grep \"Running\" | awk '{print $1;}'";
		ProcessRunner pr = runCommand(cmd);

		String podName = null;
		String received = pr.getReceived();

		for (String output : received.split("\\r?\\n")) {

			podName = output.trim();

			if(podName != null && podName.equals(projectName)) {
				return true;
			}
		}

		return false;
	}

	public static String getBaseURL(String testType) {
		return getBaseURL(testType, "9090", "http");
	}

	public static String getBaseURL(String testType, String port, String protocol) {
		if ( testType.equalsIgnoreCase("icp") ) {
			String ipCmd = "kubectl get configmap -n services oauth-client-map -o jsonpath=\"{.data.PROXY_IP}\"";
			ProcessRunner prIp = MicroclimateTestUtils.runCommand(ipCmd);
			String ip = prIp.getReceived().trim();
			return "https://" + "microclimate." + ip + ".nip.io";
		}
		else if ( testType.equalsIgnoreCase("local") ) {
			return protocol + "://localhost:" + port;
		}

		Logger.println(MicroclimateTestUtils.class, "getBaseURL()", "Invalid test type: " + testType + ", base url is null.");

		return null;
	}

	public static PairedResponse callAPIBodyParametersWSocketResponse(String api, String reqParameters, String protocol, String port, String requestMethod, String testType, String[] eventsOfInterest, int timeout) throws MalformedURLException, IOException {
		SocketUtil su = SocketUtil.getInstance(eventsOfInterest); // getInstance needs to be called first because the socket connection should be connected before sending the HTTP request

		sleep(1000); // Delay the HTTP request a short time to ensure we don't miss any socket events

		HttpResponse httpResponse = callAPIBodyParameters(api, reqParameters, protocol, port, requestMethod, testType);
		Logger.println(MicroclimateTestUtils.class, "callAPIBodyParametersWSocketResponse()","HTTP Response Body: " + httpResponse.getResponseBody());
		if(api.contains("shutdown")) {
			return new PairedResponse(httpResponse, su.waitForShutdownEvent(timeout));
		}

		JsonObject responseBody = httpResponse.getResponseBodyAsJsonObject();

		String operationId = responseBody.getString("operationId");
		Logger.println(MicroclimateTestUtils.class, "callAPIBodyParametersWSocketResponse()","Operation ID: " + operationId);

		cachedsu = su;
		return new PairedResponse(httpResponse, su.waitForSocketEvents(operationId, timeout));
	}

	public static SocketEvent[] getProjectStatusChangedEvents (String projectID) {
		StatusTrackingUtil.getSocketUtilInstance().waitForStatusChangedEvents(projectID, StatusTrackingUtil.BUILD_STATUS, 120, true, StatusTrackingUtil.BUILD_STATE_SUCCESS);
		return cachedsu.getStatusChangedEvents(projectID);
	}

	public static HttpResponse callAPIBodyParameters(String api, String reqParameters, String protocol, String port, String requestMethod, String testType) throws MalformedURLException, IOException {
		HttpResponse httpResponse = new HttpResponse();
		String url = getBaseURL(testType, port, protocol) + api;

		Logger.println(MicroclimateTestUtils.class, "callAPIBodyParameters()", "Calling " + requestMethod + " api " + api + " with request parameters " + reqParameters + " on " + testType + "...");

		trustAllCertificates();

		HttpURLConnection connection = (HttpURLConnection) new URL(url).openConnection();

		if ( testType.equalsIgnoreCase("icp") ) {
			//trustAllCertificates();
			connection.setRequestProperty("Cookie", cookie);
		}

		connection.setDoOutput(true);
		connection.setDoInput(true);
		connection.setRequestProperty("Content-Type", "application/json");
		connection.setRequestMethod(requestMethod);

		OutputStreamWriter wr = new OutputStreamWriter(connection.getOutputStream());
		wr.write(reqParameters);
		wr.flush();
		wr.close();

		httpResponse.setResponseCode(connection.getResponseCode());
		httpResponse.setResponseBody(getResponseBody(connection));

		return httpResponse;
	}

	public static PairedResponse callAPIURLParametersWSocketResponse(String url, String requestMethod, String testType, String[] eventsOfInterest, int timeout) throws IOException  {
		SocketUtil su = SocketUtil.getInstance(eventsOfInterest); // getInstance needs to be called first because the socket connection should be connected before sending the HTTP request

		sleep(1000); // Delay the HTTP request a short time to ensure we don't miss any socket events

		HttpResponse httpResponse = callAPIURLParameters(url, requestMethod, testType);
		Logger.println(MicroclimateTestUtils.class, "callAPIURLParametersWSocketResponse()","HTTP Response Body: " + httpResponse.getResponseBody());

		JsonObject responseBody = httpResponse.getResponseBodyAsJsonObject();

		String operationId = responseBody.getString("operationId");
		Logger.println(MicroclimateTestUtils.class, "callAPIURLParametersWSocketResponse()","Operation ID: " + operationId);

		cachedsu = su;
		return new PairedResponse(httpResponse, su.waitForSocketEvents(operationId, timeout));
	}

	public static HttpResponse callAPIURLParameters(String url, String requestMethod, String testType) throws IOException {
		HttpResponse httpResponse = new HttpResponse();

		Logger.println(MicroclimateTestUtils.class, "callAPIURLParameters", "Calling " + requestMethod + " api url " + url + " on " + testType + "...");

		HttpURLConnection connection = (HttpURLConnection) new URL(url).openConnection();

		if ( testType.equalsIgnoreCase("icp") ) {
			MicroclimateTestUtils.trustAllCertificates();
			connection.setRequestProperty("Cookie", cookie);
		}

		connection.setRequestMethod(requestMethod);

		httpResponse.setResponseCode(connection.getResponseCode());
		httpResponse.setResponseBody(getResponseBody(connection));

		if ( connection != null ) {
			connection.disconnect();
		}

		return httpResponse;
	}

	public static String getResponseBody(HttpURLConnection connection) throws IOException {
		int responseCode = connection.getResponseCode();
		BufferedReader in = null;
		InputStream inputStream;
		String responseBody = null;

		if ( responseCode >= 200 && responseCode <= 299 ) {
			inputStream = connection.getInputStream();
		}
		else {
			inputStream = connection.getErrorStream();
		}

		if ( inputStream != null ) {
			in = new BufferedReader(new InputStreamReader(inputStream));
			String inputLine;
			StringBuffer res = new StringBuffer();
			while ( (inputLine = in.readLine()) != null ) {
				res.append(inputLine);
			}
			responseBody = res.toString();
			in.close();
		}

		return responseBody;
	}

	public static boolean jsonArrayContains(JsonArray jsonArray, String value) {
		for(JsonValue arrayVals : jsonArray){
            if ( value.equals(arrayVals.toString()) ) {
				return true;
			}
        }

		return false;
	}

	public static void updateFile(String testType, String projectName, String relPath, String file, String originalString, String replaceString) {
		String ws = workspace;

		String path = null;
		String pod = null;

		if (testType.equalsIgnoreCase("local")) {
			path = ws + projectName +"/" + relPath;
		} else if (testType.equalsIgnoreCase("icp")) {
			path = ws + projectName + "/temp/" + file;

			pod = MicroclimateTestUtils.getEditorPod();

			String src = DEFAULT_NAMESPACE + "/" + pod + ":/codewind-workspace/" + projectName + "/" + relPath;
			String dest = path;

			MicroclimateTestUtils.kubectlCp(src, dest);
		}

		try {
			MicroclimateTestUtils.updateFile(path, originalString, replaceString);
		} catch (IOException e) {
			throwAsUncheckedException(e);
		}

		sleep(3000);

		if (testType.equalsIgnoreCase("icp")) {
			String dest = DEFAULT_NAMESPACE + "/" + pod + ":/codewind-workspace/" + projectName + "/" + relPath;

			MicroclimateTestUtils.kubectlCp(path, dest);

			try {
				MicroclimateTestUtils.deleteFile(path);
			} catch (Exception e) {
				Logger.println(MicroclimateTestUtils.class, "updateFile()", "Exception occurred during delete local index.html file: " + e.getMessage(), e);
				throwAsUncheckedException(e);
			}
		}
	}

	public static void updateFile(String path, String originalString, String replaceString) throws IOException {
		File fileNeedsUpdate = new File(path);
		BufferedReader br = null;
		FileWriter writer = null;

        try{
            br = new BufferedReader(new FileReader(fileNeedsUpdate));
            String line;
            StringBuilder stringbuilder = new StringBuilder();

            while ((line = br.readLine())!= null){
            		stringbuilder.append(line + System.lineSeparator());
            }

            br.close(); // Close the file before writing to it.

            String content = stringbuilder.toString();
            String newContent = content.replace(originalString, replaceString);
            writer = new FileWriter(fileNeedsUpdate);

            writer.write(newContent);
        }finally{
        			if(br!=null) {
						br.close();
					}
        			if(writer!=null) {
						writer.close();
					}
            }

        if ( isMicroclimateRunningOnWindows ) {
			String containerPath = new String(path);
			if ( containerPath.startsWith(workspace) ) {
				containerPath = containerPath.replaceFirst(workspace, "/codewind-workspace/");
				copyLocalFileToContainer(path, containerPath, "microclimate-file-watcher");
			}
		}
	}

	public static JsonObject getProjectInfo(String projectID, String testType) {
		try {
			String baseUrl = getBaseURL(testType);
			String url = baseUrl + "/api/v1/projects";
			String result = sendGet(url, testType, false);
			if (result != null && !result.isEmpty()) {
				InputStream stream = new ByteArrayInputStream(result.getBytes());
				JsonReader reader = jsonFactory.createReader(stream);
				JsonArray array = reader.readArray();
				for (int i = 0; i < array.size(); i++) {
					JsonObject obj = array.getJsonObject(i);
					if (obj.containsKey("projectID")) {
						String id = obj.getString("projectID");
						if (projectID.equals(id)) {
							return obj;
						}
					}
				}
			}
		} catch (Exception e) {
			Logger.println(MicroclimateTestUtils.class, "getProjectInfo", "Exception getting the project information for " + projectID, e);
		}
		Logger.println(MicroclimateTestUtils.class, "getProjectInfo", "Project info not found for project: " + projectID);
		return null;
	}

	public static boolean getBuildRequired(String projectID, String testType) {
		JsonObject obj = getProjectInfo(projectID, testType);
		if (obj == null) {
			return false;
		}
		boolean buildRequired = false;
		if (obj.containsKey("buildRequired")) {
			buildRequired = obj.getBoolean("buildRequired");
		}
		return buildRequired;
	}

	public static boolean getEnableAutobuild(String projectID, String testType) {
		JsonObject obj = getProjectInfo(projectID, testType);
		if (obj == null) {
			return false;
		}
		boolean autoBuildEnabled = true;
		if (obj.containsKey("autoBuild")) {
			autoBuildEnabled = obj.getBoolean("autoBuild");
		}
		return autoBuildEnabled;
	}

	public static void setAutoBuild(String projectID, String testType, boolean value) {
		try {
			String api = getProjectsAPI() + projectID + "/build";
			String action = value ? "enableautobuild" : "disableautobuild";
			String urlParameters = "{\"action\": \"" + action + "\"}";
			int HttpResult = MicroclimateTestUtils.httpRequest(api, urlParameters, testType);
			assertTrue("Set auto build failed with result code: " + HttpResult, HttpResult == HttpURLConnection.HTTP_ACCEPTED);
		} catch(Exception e) {
			Logger.println(MicroclimateTestUtils.class, "setAutoBuild()", "Exception occurred disabling auto build: " + e.getMessage(),e);
			fail("Exception occurred disabling auto build.");
		}
	}

	public static void requestBuild(String projectID, String testType) {
		String api = getProjectsAPI() + projectID + "/build";
		String urlParameters = "{\"action\": \"build\"}";
		int HttpResult = MicroclimateTestUtils.httpRequest(api, urlParameters, testType);
		assertTrue("Request build failed with result code: " + HttpResult, HttpResult == HttpURLConnection.HTTP_ACCEPTED);
	}


	public static void pingApp(String expected, String exposedPort, String api, String testType) {
		while(true) {
			if(MicroclimateTestUtils.checkEndpoint(expected, exposedPort, api, testType)) {
				return;
			} else {
				sleep(1000);
			}
		}
	}

	public static boolean checkFileExistsInContainer(String filename, String container, String testType) {
		String cmd = null;

		if (testType.equalsIgnoreCase("local")) {
			cmd = "docker ps --format '{{.Names}}@#@{{.Ports}}'";
		}
		else if (testType.equalsIgnoreCase("icp")) {
			cmd = "kubectl get pod -o go-template --template '{{range .items}}{{.metadata.name}}{{\"@#@\"}}{{range .spec.ports}}{{.nodePort}}{{end}}{{\"\\n\"}}{{end}}' -n " + DEFAULT_NAMESPACE;
		}

		ProcessRunner pr = runCommand(cmd);

		String containerName = null;
		String received = pr.getReceived();

		if ( received == null ) {
			return false;
		}

		for (String output : received.split("\\r?\\n")) {
			String contents[] = output.split("@#@");

			if ( testType.equalsIgnoreCase("local") && contents.length != 2 ) {
				continue;
			}

			containerName = contents[0];
			//Logger.println(MicroclimateTestUtils.class, "checkFileExistsInContainer()", "containerName is " + containerName);
			if ( containerName.startsWith("'")) {
				containerName = containerName.replace("'", "");
			}

			if( containerName!=null && containerName.contains(container) && !containerName.endsWith("-build") ) {
				String check_cmd = "docker exec " + containerName;

				if (testType.equalsIgnoreCase("icp")) {
					check_cmd = "kubectl exec -it " + containerName + " -n " + DEFAULT_NAMESPACE + " --";
				}

				check_cmd = check_cmd + " sh -c \"if [ -e " + filename + " ]; then echo TRUE; fi\"";

				Logger.println(MicroclimateTestUtils.class, "checkFileExistsInContainer()", "check_cmd is: " + check_cmd);
				pr = runCommand(check_cmd);
				for (String execOutput : pr.getReceived().split("\\r?\\n")) {
					Logger.println(MicroclimateTestUtils.class, "checkFileExistsInContainer()", "execOutput is: " + execOutput);
					if( execOutput.contains("TRUE") ) {
						return true;
					}
				}
			}
		}

		return false;
	}

	public static void copyLocalFileToContainer(String localFilePathName, String containerFilePathName, String container) {
		String cmd = "docker cp " + localFilePathName + " " + container + ":" + containerFilePathName;
		//Logger.println(MicroclimateTestUtils.class, "copyLocalFileToContainer()", "cmd = " + cmd);
		ProcessRunner pr = runCommand(cmd);
		//Logger.println(MicroclimateTestUtils.class, "copyLocalFileToContainer()", "cmd error code = " + pr.getErrorCode());
	}

	/** Return only the first token of the project ID, for debugging purposes only.
	 * Result is contained in parentheses to indicate is shortened.
	 *
	 * Example: "a9d8a680-39e6-11e9-adf9-19bd6427a743" => "(a9d8a680)" */
	public static String shortProjectId(String str) {
		if(str == null) { return null; }

		int index = str.indexOf("-");
		if(index != -1) {
			return "("+str.substring(0, index)+")";
		} else {
			return str;
		}
	}

	public static void sleep(long timeInMsecs) {
		try {
			Thread.sleep(timeInMsecs);
		} catch (InterruptedException e) {
			throwAsUncheckedException(e);
		}
	}
	/**
	 * Call this method if you want a test to halt when it fails, to allow you to debug it.
	 *
	 * You can use a pattern like this:
	 * try {
	 * 		(.. .some test code ...)
	 * } catch(Throwable t) {
	 * 		t.printStackTrace();
	 * 		MicroclimateTestUtils.sleepForever();
	 * } */
	public static void sleepForever() {
		while(true) {
			System.out.println("* Sleeping forever.");
			sleep( 5 * 60 * 1000);
		}
	}

	public static String stripAnsi(String input) {
		return input.replaceAll("\\e\\[[\\d;]*[^\\d;]","");
	}

}
