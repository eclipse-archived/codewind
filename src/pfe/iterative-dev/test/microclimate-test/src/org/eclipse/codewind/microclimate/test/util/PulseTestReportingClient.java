package org.eclipse.codewind.microclimate.test.util;

import java.io.BufferedReader;
import java.io.ByteArrayInputStream;
import java.io.File;
import java.io.FileOutputStream;
import java.io.FileWriter;
import java.io.IOException;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.io.OutputStream;
import java.net.Socket;
import java.net.UnknownHostException;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.LinkedList;
import java.util.List;
import java.util.Queue;
import java.util.UUID;

/** Lightweight test info reporting, sends data to reporting server, ports 26120 and 26121 */
public class PulseTestReportingClient {

	// ------ Factory Methods ------------------------

	public static PulseTestReportingClient createInstance(String stream) {
		return PulseTestReportingClient.createInstance(stream, null);
	}

	public static PulseTestReportingClient createInstance(String stream, String logName) {
		return new PulseTestReportingClient(stream, logName);
	}

	// ------------------------------------------

	/** Privacy: Ensure that this reporting client only runs on hosts that request it */
	private final String[] SUPPORTED_HOSTS = new String[] { "vl-jgw-desktop"};


	/** Server config */
	private static final String[] REPORT_HOSTS = new String[] { "wdt-test-reporting.rtp.raleigh.ibm.com" };
	private static final int PORT = 26120;

	private static final String LOG_LOCAL_WRITE_DIR = System.getProperty("log_local_write_dir");

	// ---------------------------------

	private boolean _hostSupported = false;
	private boolean _didConnectionFail = false; // When we tried to connect to jgw-pulse, did it fail?
	private boolean _uuidOutput = false; // Have we output our UUID yet

	private String _hostname = null;
	private String _uuid = null;

	private boolean _debug = false;

	private Queue<String> _messages = new LinkedList<String>();

	private Socket _activeSocket = null;

	private PTRCShutdownHook _shutdownHook;

	private final String _logName;
	private final String _streamName;

	private final ThreadWrapper _innerThread;


	private PulseTestReportingClient(String streamName, String logName) {
		_innerThread = new ThreadWrapper();

		_streamName = streamName;
		_logName = logName; // optional

		try {
			_hostname = java.net.InetAddress.getLocalHost().getHostName();

			_hostSupported = true; 

			// Only report when running on supported hosts
			for(String str : SUPPORTED_HOSTS) {
				if(_hostname.toLowerCase().contains(str.toLowerCase())) {
					_hostSupported = true;
					break;
				}
			}

			if(!_hostSupported) {
				return;
			}

			_uuid = UUID.randomUUID().toString();

			_innerThread.start();

			// Add our shutdown handler, which ensures that the message queue has sent all its messages on shutdown.
			_shutdownHook = new PTRCShutdownHook(this);
			Runtime.getRuntime().addShutdownHook(_shutdownHook);

		} catch (UnknownHostException e) {
			if(_debug) { e.printStackTrace(); }
		} catch(Exception e) {
			if(_debug) { e.printStackTrace(); }
		}

	}


	private void run() {
		if(!_hostSupported) { return; }

		try {

			List<String> msgList = new ArrayList<String>();
			while(true) {

				synchronized(_messages) {
					if(_messages.size() > 0) {
						msgList.addAll(_messages);
						_messages.clear();
					} else {
						_messages.wait(100);
					}

				}

				if(msgList.size() > 0) {
					StringBuilder sb = new StringBuilder();
					for(String str : msgList) {
						sb.append(str);
					}
					writeMessage(sb.toString());
					msgList.clear();
				}
			}
		} catch(Exception e) {
			if(_debug) { e.printStackTrace(); }
		}

	}

	private boolean isLocalWrite() {
		if(PulseTestReportingClient.LOG_LOCAL_WRITE_DIR == null || PulseTestReportingClient.LOG_LOCAL_WRITE_DIR.trim().length() == 0) {
			return false;
		}

		return true;
	}

	/** Listener is optional. */
	public void send(String filename, byte[] byteArr, IFileSentListener listener) {
		if(!_hostSupported) { return; }

		try {
			ByteArrayInputStream bais = new ByteArrayInputStream(byteArr);
			this.send(filename, bais, listener);
		} catch (Exception e) {
			if(_debug) { e.printStackTrace(); }
		}

	}

	/** Listener is optional. */
	public void send(final String filename, final InputStream is, final IFileSentListener listener) {
		if(!_hostSupported) { return; }

		Thread t = new Thread() {
			@Override
			@SuppressWarnings("synthetic-access")
			public void run() {
				if(isLocalWrite()) {
					innerLocalWrite(filename, is, listener);
				} else {
					innerSend(filename, is, listener);
				}
			}
		};
		t.start();
	}

	private void innerLocalWrite(String filename, InputStream fileInputStream, IFileSentListener listener) {
		if(!_hostSupported) { return; }
		if(!isLocalWrite()) { return; }

		String fileExt = "";
		if(filename.contains(".")) {
			int dotIndex = filename.lastIndexOf(".");
			fileExt = filename.substring(dotIndex);
			filename = filename.substring(0, dotIndex);

		}

		File outputFile = new File(PulseTestReportingClient.LOG_LOCAL_WRITE_DIR, filename+"-time["+System.currentTimeMillis()+"]"+fileExt);
		outputFile.getParentFile().mkdirs();

		String url = outputFile.getPath();
		FileOutputStream os = null;
		try {
			os = new FileOutputStream(outputFile);

			byte[] barr = new byte[256 * 1024];
			int c;
			while(-1 != (c = fileInputStream.read(barr))) {
				os.write(barr, 0, c);
			}
			os.flush();

		} catch(Exception e) {
			if(_debug) { e.printStackTrace(); }
			try { os.close(); } catch(Exception e1) { /* ignore*/ }
		}

		if(url != null && listener != null) {
			listener.fileSentComplete(new FileSentInfo(url));
		}

	}

	@SuppressWarnings("synthetic-access")
	private void innerSend(String filename, InputStream fileInputStream, IFileSentListener listener) {
		if(!_hostSupported) { return; }

		byte[] header = new byte[4096];
		Arrays.fill(header, (byte)0);

		String logNameSubText = _logName != null ? 	"-logname["+_logName+"]" 	: "";

		String str = "pulse-test-info-hostname["+_hostname+"]-time["+System.currentTimeMillis()+"]-uuid["+_uuid+"]-filename["+filename+"]-stream["+_streamName+"]"+logNameSubText+"-version[1]\n";
		byte[] strBytes = str.getBytes();

		// This really shouldn't happen, but we throw an exception if the header string is too long
		if(strBytes.length > header.length+ 16) { throw new RuntimeException("Initial header of file transfer is too large."); }

		System.arraycopy(strBytes, 0, header, 0, strBytes.length);

		String url = null;
		OutputStream os = null;
		try {
			Socket s = acquireSocket(PulseTestReportingClient.PORT+1);

			os = s.getOutputStream();
			os.write(header);

			byte[] barr = new byte[256 * 1024];
			int c;
			while(-1 != (c = fileInputStream.read(barr))) {
				os.write(barr, 0, c);
			}
			os.flush();

			try {

				BufferedReader br = new BufferedReader(new InputStreamReader(s.getInputStream()));
				url = br.readLine();

			} catch(Exception e) {
				// Ignore
			}

			os.close();

			s.close();

		} catch(Exception e) {
			if(_debug) { e.printStackTrace(); }
			try { os.close(); } catch(Exception e1) { /* ignore*/ }
		}

		if(url != null && listener != null) {

			listener.fileSentComplete(new FileSentInfo(url));

		}


	}
	public void reportLine(String str) {
		report(str+"\n");
	}


	public void report(String str) {
		if(!_hostSupported) { return; }

		synchronized(_messages) {
			_messages.add(str);
			_messages.notify();
		}
	}

	public boolean isHostSupported() {
		return _hostSupported;
	}


	/** Attempt to acquire a socket from a list of possible PTR hosts */
	private Socket acquireSocket(int port) throws IOException {

		IOException ex = null;
		Socket result = null;

		for(String host : PulseTestReportingClient.REPORT_HOSTS) {
			try {
				result = new Socket(host, port);
				ex = null;
			} catch (IOException e) {
				result = null;
				ex = e;
			}

			if(result != null) {
				break;
			}
		}

		// Attempting to connect to the hosts failed, so throw the last exception
		if(ex != null) {
			throw ex;
		}

		return result;


		//		_activeSocket = new Socket(HOST, PORT);

	}

	private void localFileWriteMessage(String msg) throws IOException {
		if(!_hostSupported) { return; }

		if(!isLocalWrite()) { return; }

		String logNameSubText = _logName != null ? 	"-logname["+_logName+"]" 	: "";

		String str = "pulse-test-info-hostname["+_hostname+"]-time["+System.currentTimeMillis()+"]"+logNameSubText+".txt";

		File outFile = new File(PulseTestReportingClient.LOG_LOCAL_WRITE_DIR, str);

		synchronized(PulseTestReportingClient.LOG_LOCAL_WRITE_DIR) {
			outFile.getParentFile().mkdirs();

			FileWriter fw = new FileWriter(outFile, true);
			fw.write(msg+"\n");
			fw.close();
		}

	}

	private void writeMessage(String msg) {
		if(!_hostSupported) { return; }

		try {

			if(isLocalWrite()) {
				try {
					localFileWriteMessage(msg);
				} catch(Throwable t) {
					// Ignore
					if(_debug) {
						t.printStackTrace();
					}
				}
				return;
			}

			if(_activeSocket == null) {

				if(!_didConnectionFail) {

					try {

						_activeSocket = acquireSocket(PulseTestReportingClient.PORT); //new Socket(HOST, PORT);

						String logNameSubText = _logName != null ? 	"-logname["+_logName+"]" 	: "";

						String str = "pulse-test-info-hostname["+_hostname+"]-time["+System.currentTimeMillis()+"]-uuid["+_uuid+"]-stream["+_streamName+"]"+logNameSubText+"-version[1]\n";
						_activeSocket.getOutputStream().write(str.getBytes());

					} catch(IOException e) {
						if(_debug) { e.printStackTrace(); }
						_didConnectionFail = true;
						throw e;
					}
				} else {
					return;
				}
			}


			if(!_uuidOutput) {
				_uuidOutput = true;
				System.out.println("* Test Info Client UUID is "+_uuid+ " ["+_hostname+"]");
			}

			OutputStream os = _activeSocket.getOutputStream();

			os.write(msg.getBytes());
			os.flush();

		} catch (UnknownHostException e) {
			if(_debug) { e.printStackTrace(); }
		} catch (IOException e) {
			if(_debug) { e.printStackTrace(); }
		} catch(Exception e) {
			if(_debug) { e.printStackTrace(); }
		}

	}

	protected boolean hasUnsentMessages() {
		synchronized (_messages) {
			return _messages.size() > 0;
		}
	}


	public static interface IFileSentListener {

		public void fileSentComplete(FileSentInfo info);
	}

	public static class FileSentInfo {
		final String _url;

		private FileSentInfo(String url) {
			_url = url;
		}

		public String getUrl() {
			return _url;
		}
	}

	public String getHostname() {
		return _hostname;
	}




	/** A simple wrapper around thread that runs our run(...) method above; this means
	 * we don't have to extend the Thread class above. */
	private class ThreadWrapper extends Thread {

		public ThreadWrapper() {
			super(PulseTestReportingClient.class.getName());
			setDaemon(true);
		}

		@Override
		public void run() {
			PulseTestReportingClient.this.run();
		}

	}


	private static class PTRCShutdownHook extends Thread {
		PulseTestReportingClient _parent;

		public PTRCShutdownHook(PulseTestReportingClient parent) {
			_parent = parent;
		}

		@Override
		public void run() {
			long startTime = System.currentTimeMillis();
			try {
				// Block JVM shutdown until the client has fully flushed it message buffer, OR 10 seconds have passed.
				while(_parent.hasUnsentMessages() && System.currentTimeMillis()- startTime <= 10 * 1000) {
					Thread.sleep(2000);
				}
				System.out.flush();
			} catch (InterruptedException e) {
				/* ignore */
			}

		}
	}
}

