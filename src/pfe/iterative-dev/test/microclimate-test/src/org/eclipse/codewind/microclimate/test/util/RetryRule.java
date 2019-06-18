package org.eclipse.codewind.microclimate.test.util;

import java.io.ByteArrayInputStream;

import org.eclipse.codewind.microclimate.test.util.FWMonitorUtil.ReceivedTextReceiver;
import org.junit.rules.TestRule;
import org.junit.runner.Description;
import org.junit.runners.model.Statement;

public class RetryRule implements TestRule {
    private int retryCount;
    private int retryLeft;

	public RetryRule(int retryCount) {
        this.retryCount = retryCount;
        this.retryLeft = retryCount;
    }
    
    public Statement apply(Statement base, Description description) {
        return statement(base, description);
    }
    
    public int getRetriesLeft() {
		return this.retryLeft;
    }

    private Statement statement(final Statement base, final Description description) {
	    return new Statement() {
	      @Override public void evaluate() throws Throwable {
              Throwable caughtThrowable = null;

              for (int i = 0; i < retryCount+1; i++) {
                  try {
                      base.evaluate();
                      return;
                  } catch (Throwable t) {
                	  // Print the failing exception before retrying. 
                      caughtThrowable = t;
                      System.err.println(description.getDisplayName() + ": run " + (i+1) + " failed:");
                      t.printStackTrace();
                      System.err.println();
                      System.err.println();
                  }
                  System.out.println(description.getDisplayName() + ": retries left = " + retryLeft);
                  retryLeft = retryLeft - 1;

                  if(AbstractMicroclimateTest.UPLOAD_FAILED_TEST_FW_LOGS) {
                	  ReceivedTextReceiver rtr = FWMonitorUtil.getInstance().getStaticReceivedTextReceiver();
                	  if(rtr != null) {
                		  String text = rtr.getTextAsString();
                		  if(text != null && !text.trim().isEmpty()) {
                       		  PtrTestReportClient.getInstance().sendFile("fw-log-"+description.getDisplayName()+"-"+i+".txt", 
                    				  new ByteArrayInputStream(rtr.getTextAsString().getBytes()), true);
                		  }
                	  }
                  }
              }
              System.err.println(description.getDisplayName() + ": test failed after " + (retryCount+1) + " failures");
              throw caughtThrowable;
	      }
	    };
	  }
	}
