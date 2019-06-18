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

import java.io.BufferedInputStream;
import java.io.BufferedOutputStream;
import java.io.BufferedReader;
import java.io.BufferedWriter;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileNotFoundException;
import java.io.FileOutputStream;
import java.io.FileReader;
import java.io.FileWriter;
import java.io.IOException;
import java.io.InputStreamReader;
import java.util.ArrayList;
import java.util.List;
import org.apache.commons.codec.digest.DigestUtils;

public class IDCUtils {

	// 
	// Copy the a binary/text file (source file) to the target file.
	//
	public static void copyFile(String sourceFilename, String targetFilename) throws IOException {
		FileInputStream fin = null;
		FileOutputStream fout = null;
		BufferedInputStream bin = null;
		BufferedOutputStream bout = null;
		File fpSource = null;

		try {
			fin = new FileInputStream(sourceFilename);
			fout = new FileOutputStream(targetFilename);
			bin = new BufferedInputStream(fin);
			bout = new BufferedOutputStream(fout);

			byte byteBuff[] = new byte[1024];
			int length;
			while ((length = bin.read(byteBuff)) > 0)
				bout.write(byteBuff, 0, length);
		} catch (FileNotFoundException e1) {
			throw new IOException(sourceFilename + " does not exist!", e1);
		} finally {
			try {
				if (bin != null)
					bin.close();

				if (bout != null)
					bout.close();
			} catch (IOException e3) {
				// ignore
			}
		}
	}

	// 
	// Copy the all the files under the source directory to the target directory.
	// The directory structure is preserved.  If the destination directory
	// does not exist, it will try to create the directory.
	//
	public static void copyDir(String sourceDirectory, String targetDirectory) throws IOException {
		char separatorChar = File.separatorChar;

		File srcFp = new File(sourceDirectory);
		if (srcFp.exists() && srcFp.isDirectory()) {
			// Create the target directory if necessary.
			makeDir(targetDirectory);
			File[] srcFileLst = srcFp.listFiles();
			File curFp = null;
			for (int i = 0; i < srcFileLst.length; i++) {
				curFp = srcFileLst[i];
				if (curFp != null) {
					String curFpName = curFp.getName();
					if (curFp.isDirectory()) {
						copyDir(sourceDirectory + separatorChar + curFpName,
								targetDirectory + separatorChar + curFpName);
					} else {
						copyFile(sourceDirectory + separatorChar + curFpName,
								targetDirectory + separatorChar + curFpName);
					}
				}
			}
		} else {
			throw new IOException("The source directory " + sourceDirectory + " does not exist");
		}
	}
	
	public static boolean deleteFile(File delFile) throws IOException {

		boolean delOutput = false;

		Logger.info("Deleting " + delFile);

		if(delFile.isDirectory()) {
			delOutput = deleteDir(delFile);
		} else {
			delOutput = delFile.delete();
		}

		return delOutput;
	}

	//
	// Make the directory if the directory doesn't already exist.
	//
	public static boolean makeDir(String dirName) {
		boolean result = true;

		if (dirName != null && dirName.length() > 0) {
			try {
				File fp = new File(dirName);
				if (!fp.exists() || !fp.isDirectory()) {
					// Create the directory.
					result = fp.mkdirs();
				}
			} catch (Exception e) {
				result = false;
			}
		}

		return result;
	}

	public static boolean deleteDir(File dir) throws IOException {

		boolean delOutput = false;

		for (File child : dir.listFiles()) {
			delOutput = false;
			if (child.isDirectory()) {
				delOutput = deleteDir(child);
			} else {
				delOutput = child.delete();
			}
		}

		delOutput = dir.delete();

		return delOutput;
	}
	
	public static String getUserResponse(String promptQuestion) throws IOException {
		
		String userResponse = null;
		while(userResponse == null) {
			System.out.print("[IDC] " + promptQuestion);

			BufferedReader br = new BufferedReader(new InputStreamReader(System.in));
			
			String str = br.readLine().trim().toLowerCase();
			if(!str.equalsIgnoreCase("yes") && !str.equalsIgnoreCase("no")) { 
				Logger.info("Please type yes or no.");
			} else {
				userResponse = str;
			}
		}
		
		return userResponse;
	}
	/** Generate an SHA1 hash that corresponds to the contents of two files, in a specific order. If you specify the file array parameter in a different
	 * order, the hash will be different. */
	public static String calculateHashOfOrderedFileContents(File[] files) throws IOException {
		
		String currHash = null;
		
		for(File f : files) {
			
			FileInputStream fis = new FileInputStream(f);

			// skip files that don't exist
			if(!f.exists())
				continue;
			
			String fileHash = DigestUtils.sha1Hex(fis);
			fis.close();
			
			if(currHash == null) {
				currHash = fileHash; 
			} else {
				currHash = DigestUtils.sha1Hex(fileHash+currHash);
			}
			
		}
		
		return currHash;
		
	}

	public static void updateEnvvarsScript(File envVarsScriptFile, String HOST_OS) {

		BufferedReader br = null;
		FileReader fr = null;

		BufferedWriter bw = null;
		FileWriter fw = null;

		boolean isPresent = true;
		ArrayList<String> lines = new ArrayList<String>();

		try {
			fr = new FileReader(envVarsScriptFile);
			br = new BufferedReader(fr);

			String str;

			while ((str = br.readLine()) != null) {
				isPresent = str.contains(HOST_OS);
				lines.add(str);
				lines.add("\n");
				if (isPresent) {
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

		if (!isPresent) {
			try {
				fw = new FileWriter(envVarsScriptFile);
				bw = new BufferedWriter(fw);
				bw.write(HOST_OS);
				bw.write("\n");
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
	}

	public static List<String> splitFieldsByMultipleSpaces(String str) {

		List<String> result = new ArrayList<>();
		StringBuilder sb = new StringBuilder();

		int spacesSeen = 0;
		for (int x = 0; x < str.length(); x++) {
			char ch = str.charAt(x);

			if (ch == ' ') {

				if (sb.toString().trim().length() == 0) {
					// ignore
					spacesSeen = 0;
				} else if (spacesSeen == 1) {
					result.add(sb.toString().trim());
					sb = new StringBuilder();
					spacesSeen = 0;
				} else {
					sb.append(ch);
					spacesSeen++;
				}

			} else {
				spacesSeen = 0;
				sb.append(ch);
			}
		}

		if (sb.toString().trim().length() > 0) {
			result.add(sb.toString().trim());
		}

		return result;
	}
	
	public static boolean isValidCommmand(String cmd, String[] commandOptions) {
		// Check if a command argument is one of the possible command options
		for (String option : commandOptions) {
			if (cmd.equalsIgnoreCase(option)) {
				return true;
			}
		}
		return false;
	}

}
