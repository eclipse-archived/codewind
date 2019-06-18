/*******************************************************************************
 * Copyright (c) 2019 IBM Corporation and others.
 * All rights reserved. This program and the accompanying materials
 * are made available under the terms of the Eclipse Public License v2.0
 * which accompanies this distribution, and is available at
 * http://www.eclipse.org/legal/epl-v20.html
 *
 * Contributors:
 *     IBM Corporation - initial API and implementation
 *******************************************************************************/

package org.eclipse.codewind.iterdev;

import java.io.IOException;
import java.net.HttpURLConnection;
import java.net.URL;

import javax.net.ssl.HostnameVerifier;
import javax.net.ssl.HttpsURLConnection;
import javax.net.ssl.SSLContext;
import javax.net.ssl.SSLSession;
import javax.net.ssl.TrustManager;
import javax.net.ssl.X509TrustManager;
import java.security.SecureRandom;
import java.security.cert.X509Certificate;

public class StatusTracker extends Object {

    private IDCContext context;
    private ProcessRunner processRunner;
    private static String PORTAL_HTTPS = System.getenv().get("PORTAL_HTTPS");
    private static String PORTAL_PROTOCOL = "true".equals(PORTAL_HTTPS) ? "https" : "http";
    private static String PORTAL_PORT = "true".equals(PORTAL_HTTPS) ? "9191" : "9090";

    public StatusTracker(IDCContext context, ProcessRunner processRunner) {
        this.context = context;
        this.processRunner = processRunner;
    }

    public void start() throws IOException, InterruptedException {
       IListener listener = new StatusListener();
       processRunner.addListener(listener);
       processRunner.startAndWaitForTermination();
    }

    private class StatusListener implements IListener {
        public void receiveText(String sr) { 
            if (sr.contains("CWWKZ0001I") || sr.contains("CWWKZ0003I") || sr.contains("CWWKZ0062I")) {
                // CWWKZ0001I: Application {0} started in {1} seconds.
                // CWWKZ0003I: The application {0} updated in {1} seconds.
                // CWWKZ0062I: The {0} application has been updated, but not restarted.
                // The application status will be updated to started in FW projectStatusController.pingApplication()
            } else if (sr.contains("CWWKZ0018I")) {
                // CWWKZ0018I: Starting application {0}.
                updateProjectState(context, "app", "starting", null, null);
            } else if (sr.contains("CWWKT0017I")) {
                // CWWKT0017I: Web application removed (default_host): {0}
                updateProjectState(context, "app", "stopping", null, null);
            } else if (sr.contains("CWWKZ0009I")) {
                // CWWKZ0009I: The application {0} has stopped successfully.
                updateProjectState(context, "app", "stopped", null, null);
            } else if (sr.contains("CWWKZ0002E") || sr.contains("CWWKZ0005E") || sr.contains("CWWKZ0012I") || sr.contains("CWWKZ0004E") || sr.contains("CWWKZ0020I") || sr.contains("CWWKZ0014W")) {
                // CWWKZ0002E: An exception occurred while starting the application {0}. The exception message was: {1}
                // CWWKZ0005E: The application {0} cannot start because the server is not configured to handle applications of type {1}.
                // CWWKZ0012I: The application {0} was not started.
                // CWWKZ0004E: An exception occurred while starting the application {0}. The exception message was: {1}
                // CWWKZ0020I: Application {0} not updated.
                // CWWKZ0014W: The application {0} could not be started as it could not be found at location {1}.
                updateProjectState(context, "app", "stopped", "projectStatusController.appStatusContainerStopped", null);
            } else if (sr.contains("CWWKZ0010E")) {
                // CWWKZ0010E: An exception occurred while stopping the application {0}. The exception message was: {1}
                updateProjectState(context, "app", "unknown", "projectStatusController.appErrorWhenStopping", null);
            }
        }
    }
    
    public static void updateProjectState(IDCContext context, String stateType, String state, String msg, String imageLastBuild) {
        HttpURLConnection conn = null;
        if (stateType == "build") {
            Logger.info("Updating build state for project " + context.getAppName() + "(" + context.getprojectID() + ") to: " + state);
            try {
                URL url = new URL(PORTAL_PROTOCOL + "://localhost:" + PORTAL_PORT + "/internal/api/v1/projects/updateStatus");
                String json;
                if (msg == null || msg.isEmpty()) {
                    json = "{\"projectID\": \"" + context.getprojectID() + "\", \"buildStatus\": \"" + state + "\" , \"type\": \"buildState\"}";
                } else if (imageLastBuild == null || imageLastBuild.isEmpty()){
                    json = "{\"projectID\": \"" + context.getprojectID() + "\", \"buildStatus\": \"" + state + "\", \"detailedBuildStatus\": \"" + msg + "\",  \"type\": \"buildState\"}";
                } else{
                    json = "{\"projectID\": \"" + context.getprojectID() + "\", \"buildStatus\": \"" + state + "\", \"detailedBuildStatus\": \"" + msg + "\", \"appImageLastBuild\": \"" + imageLastBuild + "\",  \"type\": \"buildState\"}";
                }
                byte[] bytes = json.getBytes();

                trustAllCertificates();
    
                conn = (HttpURLConnection) url.openConnection();
                conn.setRequestMethod("POST");
                conn.setDoOutput(true);
                conn.setFixedLengthStreamingMode(bytes.length);
                conn.setRequestProperty("Content-Type", "application/json");
                conn.connect();
                conn.getOutputStream().write(bytes);
                int code = conn.getResponseCode();
                if (code != HttpURLConnection.HTTP_OK) {
                    Logger.error("Update build state request failed for project: " + context.getAppName() + "(" + context.getprojectID() + "), with code: " + code + ", and message: " + conn.getResponseMessage());
                }
            } catch (Exception e) {
                Logger.error("Update build state request failed for project: " + context.getAppName() + "(" + context.getprojectID() + ")",  e);
            } finally {
                if (conn != null) {
                    conn.disconnect();
                }
            }
        }
        else {
            Logger.info("Updating app state for project " + context.getAppName() + "(" + context.getprojectID() + ") to: " + state);
            try {
                URL url = new URL(PORTAL_PROTOCOL + "://localhost:" + PORTAL_PORT + "/internal/api/v1/projects/updateStatus");
        
                String json;
                if (msg == null || msg.isEmpty()) {
                    json = "{\"projectID\": \"" + context.getprojectID() + "\", \"status\": \"" + state + "\", \"type\": \"appState\"}";
                } else {
                    json = "{\"projectID\": \"" + context.getprojectID() + "\", \"status\": \"" + state + "\", \"error\": \"" + msg + "\", \"type\": \"appState\"}";
                }
                byte[] bytes = json.getBytes();

                trustAllCertificates();
    
                conn = (HttpURLConnection) url.openConnection();
                conn.setRequestMethod("POST");
                conn.setDoOutput(true);
                conn.setFixedLengthStreamingMode(bytes.length);
                conn.setRequestProperty("Content-Type", "application/json");
                conn.connect();
                conn.getOutputStream().write(bytes);
                int code = conn.getResponseCode();
                if (code != HttpURLConnection.HTTP_OK) {
                    Logger.error("Update app state request failed for project: " + context.getAppName() + "(" + context.getprojectID() + "), with code: " + code + ", and message: " + conn.getResponseMessage());
                }
            } catch (Exception e) {
                Logger.error("Update app state request failed for project: " + context.getAppName() + "(" + context.getprojectID() + ")",  e);
            } finally {
                if (conn != null) {
                    conn.disconnect();
                }
            }
        }
    }

    public static void newLogFileAvailable(IDCContext context, String logType) {
        HttpURLConnection conn = null;
        String apiEndPoint = "/logs/";
        String urlString = PORTAL_PROTOCOL + "://localhost:" + PORTAL_PORT + "/internal/api/v1/projects/" + context.getprojectID() + apiEndPoint;

         if (logType == "build" || logType == "app") {
            urlString = urlString + logType;
            try {
                URL url = new URL(urlString);

                 trustAllCertificates();

                 conn = (HttpURLConnection) url.openConnection();
                conn.setRequestMethod("GET");

                 int responseCode = conn.getResponseCode();
                if (responseCode != HttpURLConnection.HTTP_OK) {
                    Logger.error("Update app state request failed for project: " + context.getAppName() + "(" + context.getprojectID() + "), with code: " + responseCode + ", and message: " + conn.getResponseMessage());
                }
            } catch (Exception e) {
                Logger.error("New log file available request failed for project: " + context.getAppName() + "(" + context.getprojectID() + ")",  e);
            } finally {
                if (conn != null) {
                    conn.disconnect();
                }
            }
        }
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
            Logger.error("Fail to trust self-signed certificate for updating build/app status", e);
        }
    }
}
