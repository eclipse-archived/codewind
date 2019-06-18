package org.eclipse.codewind.microclimate.test.util;

import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.FileInputStream;
import java.io.InputStream;
import java.io.PrintStream;
import java.util.ArrayList;
import java.util.Collections;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.Map.Entry;

import org.eclipse.codewind.microclimate.test.util.PulseTestReportingClient.FileSentInfo;
import org.eclipse.codewind.microclimate.test.util.PulseTestReportingClient.IFileSentListener;

/** Allows tests to upload files produced during a test run, to a separate machine
 * than the test server. Allows logging to a separate test machine. */
public class PtrTestReportClient {

	private final static PtrTestReportClient instance = new PtrTestReportClient();

	PulseTestReportingClient client;

	public static final String STREAM_NAME = "microclimate";

	private PtrTestReportClient() {
		client = PulseTestReportingClient.createInstance(PtrTestReportClient.STREAM_NAME);
	}

	public static PtrTestReportClient getInstance() {
		return PtrTestReportClient.instance;
	}

	// ---------------------------

	public void log(String str) {
		if(!client.isHostSupported())  { return; }

		try {
			client.report(str+"\n");
		} catch(Throwable e) {
			// Ignore.
		}
	}


	public void text(String str) {
		if(!client.isHostSupported())  { return; }

		try {
			client.report(str);
		} catch(Throwable e) {
			// Ignore.
		}
	}


	public void sendFile(File f) {
		this.sendFile(f, f.getName(), true);

	}
	public void sendFile(File f, String filename, boolean informOnComplete) {
		if(!client.isHostSupported())  { return; }

		FileSentListener fsl = new FileSentListener(filename);

		try {
			log("\nSent file: "+filename);
			FileInputStream fis;
			fis = new FileInputStream(f);
			client.send(filename, fis, informOnComplete ? fsl : null);

		} catch (Throwable e) {
			reportException("sendFile", e);
		}
	}

	public void sendFile(String filename, InputStream fileContents, boolean informOnComplete) {
		if (!client.isHostSupported()) {
			return;
		}

		FileSentListener fsl = new FileSentListener(filename);

		try {
//			log("\nSent file: " + filename);
			client.send(filename, fileContents, informOnComplete ? fsl : null);

		} catch (Throwable e) {
			reportException("sendFile", e);
		}

	}

	public void reportException(String message, Throwable t) {
		if(!client.isHostSupported())  { return; }

		try {
			ByteArrayOutputStream baos = new ByteArrayOutputStream();
			t.printStackTrace(new PrintStream(baos));
			baos.close();
			client.report(message + '\n' + baos.toString() + "\n");
		} catch(Throwable e) {
			// Ignore
		}
	}

	public boolean isHostSupported() {
		return client.isHostSupported();
	}

	public void sendFile(String filename, InputStream stream) {
		if(!client.isHostSupported())  { return; }

		FileSentListener fsl = new FileSentListener(filename);

		client.send(filename, stream, fsl);

	}

	public void sendThreadStackTraces(String message) {
		if(!client.isHostSupported())  { return; }

		Map<Thread, StackTraceElement[]> m = Thread.getAllStackTraces();

		List<Map.Entry<Thread, StackTraceElement[]>> threadList = new ArrayList<Map.Entry<Thread, StackTraceElement[]>>();
		threadList.addAll(m.entrySet());

		Collections.sort(threadList, new Comparator<Map.Entry<Thread, StackTraceElement[]>>() {

			public int compare(Entry<Thread, StackTraceElement[]> o1, Entry<Thread, StackTraceElement[]> o2) {
				return (int)(o1.getKey().getId() - o2.getKey().getId());
			}

		});

		StringBuilder sb = new StringBuilder();

		sb.append("\n["+message+"]----------------------------------------------------------------------\n");
		for(Map.Entry<Thread, StackTraceElement[]> e : threadList) {
			Thread t = e.getKey();
			StackTraceElement[] stes = e.getValue();

			sb.append("- Thread "+t.getId()+" ["+t.getName()+"]: \n");
			for(StackTraceElement ste : stes) {
				sb.append("    "+ste+"\n");
			}
			sb.append("\n");
		}

		sb.append("\n----------------------------------------------------------------------\n");

		log(sb.toString());


	}

	public String getHostName() {
		return client.getHostname();
	}


	private class FileSentListener implements IFileSentListener {

		private final String fileName;

		public FileSentListener(String fileName) {
			this.fileName = fileName;
		}

		public void fileSentComplete(FileSentInfo info) {
			System.out.println("* Log file uploaded:  "+info.getUrl());
		}

	}
}
