package org.eclipse.codewind.microclimate.test.util;

import static org.junit.Assert.assertNotNull;

import java.net.URISyntaxException;
import java.security.KeyManagementException;
import java.security.NoSuchAlgorithmException;
import java.security.cert.CertificateException;
import java.security.cert.X509Certificate;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.TimeUnit;

import javax.net.ssl.HostnameVerifier;
import javax.net.ssl.SSLContext;
import javax.net.ssl.SSLSession;
import javax.net.ssl.TrustManager;
import javax.net.ssl.X509TrustManager;

import org.json.JSONException;
import org.json.JSONObject;

import io.socket.client.IO;
import io.socket.client.Socket;
import io.socket.emitter.Emitter;
import okhttp3.OkHttpClient;

public class SocketUtil {

	public static final String SOCKET_URL = "https://localhost:9091";

	private static SocketUtil instance;
	private Socket socket;

	public static class SocketEvent {
		private final String msg;
		private final JSONObject details;
		
		SocketEvent(String msg, JSONObject details) {
			this.msg = msg;
			this.details = details;
		}

		public String getMsg() {
			return msg;
		}

		public JSONObject getDetails() {
			return details;
		}
		
		@Override
		public String toString() {
			return "[ "+msg+" -> "+( details != null ? details.toString() : "null") +" ]";
		}
		
		/** Compare the contents of two arrays, beginning at the specified offsets, and comparing for `length` elements. */
		public static boolean compareSocketEventArrays(SocketEvent[] one, int offset1, SocketEvent[] two, int offset2, int length) {
			if(one == null) { one = new SocketEvent[0]; }
			if(two == null) { two = new SocketEvent[0]; }
			
			if(length == 0) { return true; }
			
			if(one.length - offset1 < length) { return false; }
			if(two.length - offset2 < length) { return false; }
						
			for(int x = 0; x < length; x++) {
				// Compare using toString() string comparison
				if(!one[x+offset1].toString().equals(two[x+offset2].toString()) ) {
					return false;
				}
			}
			
			return true;
		}

	}
		

	// Synchronized on 'lock' object when accessing these:
	private final ConcurrentHashMap<String, List<SocketEvent>> eventMap = new ConcurrentHashMap<String, List<SocketEvent>>();
	private final ConcurrentHashMap<String, List<SocketEvent>> projectStatusEvents = new ConcurrentHashMap<String, List<SocketEvent>>();
	private SocketEvent shutdownEvent = null;

	private final Object lock = new Object();
	// /\ /\ /\
	
	public static SocketUtil getInstance(String[] events) {
	
		if(instance == null) {
			try {
				instance = new SocketUtil();
			} catch (KeyManagementException e) {
				throw new RuntimeException("Invalid socket connection", e);
			} catch (NoSuchAlgorithmException e) {
				throw new RuntimeException("Invalid socket connection", e);
			} catch (URISyntaxException e) {
				throw new RuntimeException("Invalid socket connection", e);
			}
		}

		if(!instance.socket.connected()) {
			instance.socket.connect();
		}
		instance.socket.off(); // Remove any old listeners
		Logger.println(SocketUtil.class, "getInstance()", "Listeners before: " + instance.socket.listeners(events[0]));
		instance.registerEvents(events);
		Logger.println(SocketUtil.class, "getInstance()", "Listeners after: " + instance.socket.listeners(events[0]));
		Logger.println(SocketUtil.class, "getInstance()", "Socket connected!");

		return instance;
	}

	private SocketUtil() throws NoSuchAlgorithmException, KeyManagementException, URISyntaxException {
		HostnameVerifier myHostnameVerifier = new HostnameVerifier() {
		    public boolean verify(String hostname, SSLSession session) {
		        return true;
		    }
		};

		X509TrustManager myX509TrustManager = new X509TrustManager() {
		    public java.security.cert.X509Certificate[] getAcceptedIssuers() {
		        return new java.security.cert.X509Certificate[] {};
		    }

		    public void checkClientTrusted(X509Certificate[] chain,
		                                   String authType) throws CertificateException {
		    }

		    public void checkServerTrusted(X509Certificate[] chain,
		                                   String authType) throws CertificateException {
		    }
		};

		TrustManager[] trustAllCerts= new TrustManager[] { myX509TrustManager };

		SSLContext mySSLContext = SSLContext.getInstance("TLS");
		mySSLContext.init(null, trustAllCerts, null);

		OkHttpClient okHttpClient = new OkHttpClient.Builder()
				  .hostnameVerifier(myHostnameVerifier)
				  .sslSocketFactory(mySSLContext.getSocketFactory(), myX509TrustManager)
				  .build();

		IO.Options opts = new IO.Options();
		opts.callFactory = okHttpClient;
		opts.webSocketFactory = okHttpClient;
		// singleton, should only ever have a single socket connection for all tests
		socket = IO.socket(SOCKET_URL, opts);
	}

	private void registerEvents(String... events) {
		for (final String event: events) {
			Logger.println(SocketUtil.class, "registerEvents()", "Registering socket listener for event: " + event);
			socket.on(event, new Emitter.Listener() {
				public void call(Object... args) {
					
					JSONObject jsonObj = (JSONObject) args[0];
					synchronized(lock) {
						try {
							addEventToMapList(jsonObj);
						} catch (JSONException e) {
							e.printStackTrace();
							Logger.println(SocketUtil.class, "registerEvents()", "Exception occurred: " + e.getMessage(), e);
							throw new RuntimeException(e);
						}
					}
				}

				private void addEventToMapList(JSONObject jsonObj) throws JSONException {
					//shutdown API does not have an operationId
					if(event.equals("filewatcherShutdown")) {
						shutdownEvent = new SocketEvent(event, jsonObj);
						
					} else if (event.equals("projectStatusChanged")) {
						String receivedProjectID = jsonObj.getString("projectID");
						
						assertNotNull("projectID should never be null! All statuschanged Socket responses should be tied to an projectID! This is likely a bug.", receivedProjectID);
						
						List<SocketEvent> eventList = projectStatusEvents.get(receivedProjectID);
						if(eventList == null) {
							eventList = new ArrayList<SocketEvent>();
							projectStatusEvents.put(receivedProjectID, eventList);
						}
						eventList.add(new SocketEvent(event, jsonObj));
						Logger.println(SocketUtil.class, "registerEvents()", "event: "+event+"  Socket details: " + jsonObj.toString());
						
					} else {
						String receivedOpId = jsonObj.has("operationId") ? jsonObj.getString("operationId") : jsonObj.getString("operationID");
						assertNotNull("operationId should never be null! All Socket responses should be tied to an operationId! This is likely a bug.", receivedOpId);
						
						List<SocketEvent> eventList = eventMap.get(receivedOpId);
						if(eventList == null) {
							eventList = new ArrayList<SocketEvent>();
							eventMap.put(receivedOpId, eventList);							
						}
						
						eventList.add(new SocketEvent(event, jsonObj));
						Logger.println(SocketUtil.class, "registerEvents()", "event: "+event+"  Socket details: " + jsonObj.toString());
						
					}
				}


			});
		}
	}

	public SocketEvent[] getStatusChangedEvents (String projectID) {
		synchronized(lock) {
			if(projectStatusEvents == null || !projectStatusEvents.containsKey(projectID)) {
				return new SocketEvent[0];
			}
	
			return projectStatusEvents.get(projectID).toArray(new SocketEvent[projectStatusEvents.get(projectID).size()]);
		}
	}
	
	public void clearStatusChangedEvents (String projectID) {
		try {
			synchronized(lock) {
				if(projectStatusEvents != null && projectStatusEvents.containsKey(projectID)) {
					projectStatusEvents.remove(projectID);
				}
			}
			Thread.sleep(2000); // Delay for a short time to ensure we don't miss any socket events
		} catch (Exception e) {
			Logger.println(SocketUtil.class, "clearStatusChangedEvents()", "Exception occurred : " + e.getMessage());
			
		}
	}
	
	// Wait for event(s) for a given event type based on a time out
	// statusType: event type (i.e. appStatus, buildStatus, etc)
	// expectedStatus: one or more events to wait for (i.e. starting, started, inProgress, success, etc)
	// if shouldBeFinalStatus == true, only check the last status in current status record
	// if shouldBeFinalStatus == false, check for first occurance of expected state working backwards from latest to oldest in current status record
	public boolean waitForStatusChangedEvents(String projectID, String statusType, long timeoutSeconds, boolean shouldBeFinalStatus, String... expectedStatus) {
		long expireTimeInNanos = System.nanoTime() + TimeUnit.NANOSECONDS.convert(timeoutSeconds, TimeUnit.SECONDS);
		boolean eventFound = false;
		
		List<String> statusList = Arrays.asList(expectedStatus);
		String statusListFull = "";
		for (int i = 0; i < statusList.size(); i++) {
			statusListFull = statusListFull + statusList.get(i) + ",";
		}
		
		outerloop:
		while (System.nanoTime() < expireTimeInNanos) {
			Logger.println(SocketUtil.class, "waitForStatusChangedEvent()", "Waiting for project status changed event " + statusType + "=" + statusListFull + " for projectId "+MicroclimateTestUtils.shortProjectId(projectID)+"... ");
			SocketEvent[] se = getStatusChangedEvents(projectID);
			innerloop:
			if ( se != null && se.length >=1 ) {
				for (int i = se.length-1; i >= 0; i--) {
					if (se[i].getDetails() == null) { continue; }

					String sv = JSONUtil.getStringOrNull(se[i].getDetails(), statusType);
					if(sv != null) {
						if (statusList.contains(sv)) {
							eventFound = true;
							break outerloop;
						}
						if (shouldBeFinalStatus) {
							break innerloop;
						}
					}
					
				}
			}
			MicroclimateTestUtils.sleep(500);
		}
		
		if ( !eventFound) {
			Logger.println(SocketUtil.class, "waitForStatusChangedEvent()", "Timed out waiting for project status changed event " + statusType + "=" + statusListFull + ", for projectId "+MicroclimateTestUtils.shortProjectId(projectID)+"! ");
		} 

		return eventFound;
	}
	
	public SocketEvent[] waitForSocketEvents(String operationId, long timeoutSeconds) {
				
		long startTimeInNanos = System.nanoTime();
		long expireTimeInNanos = startTimeInNanos + TimeUnit.NANOSECONDS.convert(timeoutSeconds, TimeUnit.SECONDS);
		
		int i = 0;
		
		while(System.nanoTime() < expireTimeInNanos) {
			
			synchronized(lock) {
				if(eventMap.containsKey(operationId)) {
					break;
				}
			}

			if (i % 10 == 0) {
				Logger.log("Waiting for socket response, " + TimeUnit.MILLISECONDS.convert(System.nanoTime()-startTimeInNanos, TimeUnit.NANOSECONDS) + "ms elapsed");
			}
			i++;
			MicroclimateTestUtils.sleep(500);

		}
		
		synchronized(lock) {
			if (!eventMap.containsKey(operationId)) {
				Logger.println(SocketUtil.class, "waitForSocketEvents()", "Timed out waiting for socket response!!");
				return new SocketEvent[0];
			} else {
				Logger.println(SocketUtil.class, "waitForSocketEvents()", "It took approximately " + TimeUnit.SECONDS.convert(System.nanoTime()-startTimeInNanos, TimeUnit.NANOSECONDS) 
						+ " seconds to get all socket events");
			}
			return eventMap.get(operationId).toArray(new SocketEvent[eventMap.get(operationId).size()]);
		}
	}


	public SocketEvent[] waitForShutdownEvent(long timeoutSeconds) {
		long startTimeInNanos = System.nanoTime();
		long expireTimeInNanos = startTimeInNanos + TimeUnit.NANOSECONDS.convert(timeoutSeconds, TimeUnit.SECONDS);

		while(System.nanoTime() < expireTimeInNanos) {
			Logger.println(SocketUtil.class, "waitForShutdownEvent()", "Waiting for socket response...");
			synchronized(lock) {
				if(shutdownEvent != null) {
					break;
				}
			}
			MicroclimateTestUtils.sleep(500);
		}
		synchronized(lock) {
			if (shutdownEvent == null || !shutdownEvent.msg.equals("filewatcherShutdown")) {
				Logger.println(SocketUtil.class, "waitForShutdownEvent()", "Timed out waiting for socket response!!");
				return new SocketEvent[0];
			} else {
				Logger.println(SocketUtil.class, "waitForShutdownEvent()", "It took approximately " 
					+ TimeUnit.SECONDS.convert(System.nanoTime()-startTimeInNanos, TimeUnit.NANOSECONDS) + " seconds to get shutdown event");
			}
	
			SocketEvent[] retVal = {shutdownEvent};
			return retVal;
		}
	}

}
