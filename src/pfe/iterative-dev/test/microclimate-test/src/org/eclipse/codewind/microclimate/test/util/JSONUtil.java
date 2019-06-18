package org.eclipse.codewind.microclimate.test.util;

import org.json.JSONException;
import org.json.JSONObject;

/** Utility methods to extract fields from JSON Objects, without
 * needing to catch JSONException.  */
public class JSONUtil {

	public static String getStringOrNull(JSONObject jsonObj, String field) {
		return getStringOrDefault(jsonObj, field, null);
	}

	/** Return a default value if the field was not found. */
	public static String getStringOrDefault(JSONObject jsonObj, String field, String default_) {
		try {
			return jsonObj.getString(field);
		} catch (JSONException e) {
			return default_;
		}
		
	}
}
