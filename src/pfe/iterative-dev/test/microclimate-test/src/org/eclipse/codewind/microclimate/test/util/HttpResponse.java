package org.eclipse.codewind.microclimate.test.util;

import java.io.StringReader;
import java.net.HttpURLConnection;

import javax.json.Json;
import javax.json.JsonObject;
import javax.json.JsonReader;

public class HttpResponse {
	private String responseBody = null;
	private int responseCode = HttpURLConnection.HTTP_OK;
	
	public void setResponseCode(int code) {
		this.responseCode = code;
	}
	
	public int getResponseCode() {
		return this.responseCode;
	}
	
	public void setResponseBody(String body) {
		this.responseBody = body;
	}
	
	public String getResponseBody() {
		return this.responseBody;
	}
	
	public JsonObject getResponseBodyAsJsonObject() {
		if ( this.responseBody != null  ) {
			JsonReader jsonReader = Json.createReader(new StringReader(getResponseBody()));
		    JsonObject jsonObject = jsonReader.readObject();
		    jsonReader.close();
		    return jsonObject;
		}
		
		return null;
	}
		
}
