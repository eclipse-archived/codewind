package org.eclipse.codewind.microclimate.test.util;

public class JUnitUtil {
	
	/** Equivalent to assertEquals(...) from JUnit, but will output the HTTPResponse body
	 * if it exists.*/
	public static void assertEqualsWithResponse(long expected, long actual, HttpResponse response) {
		if(expected == actual) { return; }
			
		String responseBody = "";
		if(response != null && response.getResponseBody() != null) {
			responseBody = response.getResponseBody().trim();
		}
		
		String assertMessage = "expected:<"+expected+"> but was:<"+actual+">";
		if(!responseBody.isEmpty()) {
			System.err.println("assertEqualsWithResponse: " + assertMessage);
			System.err.println("- HTTPResponse body: {"+responseBody+"}");
		}
		
		String truncatedBody = "";
		if(!responseBody.isEmpty()) {
			truncatedBody = responseBody.substring(0, Math.min(64, responseBody.length())); // at most 64
			if(truncatedBody.length() == 64) {
				truncatedBody += "...";
			}
			truncatedBody  = ", with body: {"+truncatedBody+"}";
		}
		
		throw new AssertionError(assertMessage+truncatedBody);
			
	}

}
