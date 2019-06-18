package org.eclipse.codewind.microclimate.test.util;

import java.io.IOException;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.TimeUnit;

import org.eclipse.codewind.iterdev.IListener;
import org.eclipse.codewind.iterdev.ProcessRunner;

/** Call `FWMonitorUtil.getInstance()`, then use FWMonitorUtil to monitor filewatcher logs from
 * the test case, using a `docker logs -f` process.
 * 
 * You can: 
 * - Automatically echo file watcher logs directly into the test console (helpful for debugging) (addEchoListener)
 * - Retrieve the text of the file watcher that was printed during a particular test (addOrReplaceStaticReceivedTextListener)
 * - Retrieve the recent history of text that was printed by the filewatcher (addReceivedTextListener
 * - Write your own custom file watcher text listener. (addListener)
 * 
 * Currently local FW only (could work for remove, just need to use kubectl)
 */
public class FWMonitorUtil {

	private static final FWMonitorUtil instance = new FWMonitorUtil();
	
	private final String testType;

	private final Object lock =  new Object();
	
	/** Synchronize on lock, for any variables with synch_lock in the name. */
	
	private String fwId_synch_lock = null;
	
	private EchoListener echoListener = new EchoListener();
	
	private final CentralFWListener centralListener;

	private ReceivedTextReceiver staticTextReceiver_synch_lock = null; 
	

	private FWMonitorUtil() {
		testType = System.getProperty("testType");
		centralListener = new CentralFWListener(isLocal());
		
		if(isLocal()) {
			addCentralFileWatcherListener();
		}
	}
	
	public static FWMonitorUtil getInstance() {
		return instance;
	}
	
	
	private boolean isLocal() {
		return testType.equalsIgnoreCase("local");
	}

	/** Determine the file watcher ID from docker ps */
	private String getOrWaitForFileWatcherId() {
		if(!isLocal()) { return null; }		
		
		long nextTimeToPrint = System.nanoTime() + TimeUnit.NANOSECONDS.convert(10, TimeUnit.SECONDS);
		
		synchronized(lock) {
			if(fwId_synch_lock != null) { return fwId_synch_lock; }
			
			String fwId = null;
			outer: while(true) {
				String cmd;
				
				cmd = "docker ps --format '{{.ID}}@#@{{.Names}}'";

				ProcessRunner pr = MicroclimateTestUtils.runCommand(cmd, false);

				String received = pr.getReceived();
				if(received != null && !received.trim().isEmpty()) {
					

					for (String output : received.split("\\r?\\n")) {
						if(output.contains("microclimate-file-watcher")) {
							// a47188601f47@#@microclimate-file-watcher

							fwId = output.substring(0, output.indexOf("@#@"));
						}
					}

					if(fwId != null && !fwId.trim().isEmpty()) {
						break outer;
					} else {
						fwId = null;
					}
				}
					
				MicroclimateTestUtils.sleep(1000);
				if(System.nanoTime() > nextTimeToPrint) {
					nextTimeToPrint = System.nanoTime() + TimeUnit.NANOSECONDS.convert(10, TimeUnit.SECONDS);
					System.out.println("FWMonitorUtil: Waiting to acquire file watcher ID.");
				}
			}
			
			System.out.println("FWMonitorUtil: Acquired file watcher ID: "+fwId);
			fwId_synch_lock = fwId;
			return fwId;
		}

	}
	
	/** Add a listener that only echoes FW text to the screen (unless removed,
	 * all calls after the first are ignored)  */
	public void addEchoListener() {
		centralListener.addListener(echoListener);
	}
	
	/** Remove a previously added listener. */
	public void removeEchoListener() {
		centralListener.removeListener(echoListener);
	}

	/** Add a user defined listener (remember to remove it!) */
	public void addListener(IListener listener) {
		centralListener.addListener(listener);
	}
	
	public void removeListener(IListener listener) {
		centralListener.removeListener(listener);
	}

	
	/**  
	 * See addReceivedTextListener below, but unlike that call, each call to this method will 
	 * erase any previously stored text, which allows you to (for example) only retrieve 
	 * the text that was output for a particular JUnit test.*/
	public ReceivedTextReceiver addOrReplaceStaticReceivedTextListener() {
		if(!isLocal()) { return null; }
		synchronized(lock) {
			if(staticTextReceiver_synch_lock != null) {
				removeReceivedTextListener(staticTextReceiver_synch_lock);
			}
			
			staticTextReceiver_synch_lock = addReceivedTextListener();
			
			return staticTextReceiver_synch_lock;
		}
		
	}
	
	public ReceivedTextReceiver getStaticReceivedTextReceiver() {
		if(!isLocal()) { return null; } 
		
		synchronized(lock) {
			return staticTextReceiver_synch_lock;
		}
	}
	
	public void removeStaticReceivedTextListener() {
		synchronized(lock) {
			if(staticTextReceiver_synch_lock != null) {
				removeReceivedTextListener(staticTextReceiver_synch_lock);
				staticTextReceiver_synch_lock = null;
			}
		}
	}
	
	
	/** This listener receives all text output by filewatcher, beginning at the 
	 * time at which this method is called. You can retrieve the text from the
	 * ReceivedTextReceiver object. */
	public ReceivedTextReceiver addReceivedTextListener() {
		if(!isLocal()) { return null; }
		
		ReceivedTextReceiver rtr = new ReceivedTextReceiver();
		centralListener.addListener(rtr.getListener());
		return rtr;
	}
	
	public void removeReceivedTextListener(ReceivedTextReceiver rtr) {
		centralListener.removeListener(rtr.getListener());
	}
	
	private void addCentralFileWatcherListener() {
		
		String fwId = getOrWaitForFileWatcherId();
		if(fwId == null) { return; } // icp case
		
		final ProcessRunner pr = new ProcessRunner(new String[] { "docker", "logs", "-f", fwId }, false);
		
		pr.addListener(centralListener);

		new Thread() {
			public void run() {
				try {
					pr.startAndWaitForTermination();
				} catch (IOException e) {
					e.printStackTrace();
				} catch (InterruptedException e) {
					e.printStackTrace();
				}
			};
		}.start();		

	}

	/** A single IListener (an instance of this class) is used to interact with ProcessRunner,
	 * rather than adding listeners to ProcessRunner directly. */
	private static class CentralFWListener implements IListener {
		
		private final List<IListener> listeners_synch = new ArrayList<IListener>();
		
		private final boolean isLocalTestType;
		
		public CentralFWListener(boolean isLocalTestType) {
			this.isLocalTestType = isLocalTestType;
		}
		
		public void receiveText(String text) {
			if(!isLocalTestType) { return; }
			
			synchronized(listeners_synch) {
				String sansAnsi = MicroclimateTestUtils.stripAnsi(text);
				
				for(IListener l : listeners_synch) {
					l.receiveText(sansAnsi);
				}
			}
			
		}
		
		public void addListener(IListener listener) {
			if(!isLocalTestType) { return; }
			
			synchronized (listeners_synch) {
				if(!listeners_synch.contains(listener)) {
					listeners_synch.add(listener);
				}
			}
		}
		
		public void removeListener(IListener listener) {
			if(!isLocalTestType) { return; }
			
			synchronized (listeners_synch) {
				listeners_synch.remove(listener);
			}
		}
		
	}
	
	
	
	/** Simple listen that outputs text to the console. Call addEchoListener() to 
	 * use this functionality. */
	private static class EchoListener implements IListener {

		public void receiveText(String text) {
			
			System.out.println("[fw] "+text);
			
		}
		
	}
	
	/** Contains both the IListener, and a list of all the text received by the listener.  */
	public static class ReceivedTextReceiver  {
		private final List<String> receivedText_synch = new ArrayList<String>();
		private final ReceivedTextListener listener = new ReceivedTextListener();
		
		private ReceivedTextListener getListener() {
			return listener;
		}
		
		public List<String> getText() {
			synchronized(receivedText_synch) {
				// Return a clone of the text array, as it currently exists.
				List<String> result = new ArrayList<String>(receivedText_synch);
				return result;
			}
		}
		
		/** Compress the received text to a single string */
		public String getTextAsString() {
			List<String> text = getText();
			StringBuilder sb = new StringBuilder();
			for(String str : text) {
				sb.append(str+"\n");
			}
			return sb.toString();
		}

		
		/** Receive FW output and pass it to parent*/
		private class ReceivedTextListener implements IListener {

			public void receiveText(String text) {
				synchronized(receivedText_synch) {
					receivedText_synch.add(text);
				}
			}
			
		}
	}
 
}
