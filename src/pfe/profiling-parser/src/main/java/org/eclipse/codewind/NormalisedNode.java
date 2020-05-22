package org.eclipse.codewind;

import java.text.Format;
import java.util.LinkedList;
import java.util.List;

import com.ibm.java.diagnostics.healthcenter.api.profiling.MethodProfileData;
import com.ibm.java.diagnostics.healthcenter.api.profiling.MethodProfilingNode;

public class NormalisedNode {

    static long lastId = 1;

    // Fields to include in JSON
    public final String signature;
    private long selfId;
    private long depth;
    private double count;
    private double childCount;

    // Fields for use internally to make building the JSON simple.
    public final NormalisedNode parent;
    public final MethodProfileData mpd;

    private List<NormalisedNode> children;

    public NormalisedNode(String signature, NormalisedNode parent, MethodProfileData mpd) {
        this.signature = signature;
        this.parent = parent;
        this.mpd = mpd;
        this.depth = parent != null ? parent.depth + 1 : 0;
        this.selfId = lastId++;
        this.children = new LinkedList<NormalisedNode>();
        try {
            this.count = calculateCount();
        } catch (Exception e) {
            e.printStackTrace();
        }
    }

    public String toJSON() throws Exception {
        String jsonTemplate =
          "{\n"
        + "\"self\": %d,\n"
        + "\"parent\": %d,\n"
        + "\"location\": {\n"
        + "\t\"signature\": \"%s\"\n"
        + "},\n"
        + "\"count\": %f,\n"
        + "\"child_count\": %f\n"
        + "}";

        long parentId = this.parent != null ? this.parent.selfId : 0;
        return String.format(jsonTemplate, this.selfId, parentId, this.signature, this.count, this.childCount);
    }

    public double getCount() {
        return this.count;
    }

    // We need to get the total count of samples for this position in the tree.
    // That means taking the total samples for this method and only returning the
    // fraction that came from this nodes parent.
    private double calculateCount() throws Exception {
        if ( this.parent == null) {
            // This should only happen for the root node.
            return 0;
        }
        long totalCount = mpd.getMethodSampleCount();
        if (mpd.getCallingMethods().length == 0 && totalCount == 0) {
            // Only return 0 if totalCount is 0 as well.
            // (Not sure what the case where calling method count is 0 and
            // there are tick counts > 0 means, it doesn't seem to happen.)
            return 0;
        }
        MethodProfilingNode parentpn = null;
        // System.err.printf("Calling method count: %d\n", mpd.getCallingMethods().length);
        // System.err.printf("Sample count: %d\n", totalCount);
        for( MethodProfilingNode mpn: mpd.getCallingMethods()) {
            if( mpn.getMethodName() == this.parent.signature ) {
                // System.err.printf("Parent for %s is %s\n", this.signature, this.parent.signature);
                parentpn = mpn;
                break;
            }
        }
        if ( parentpn == null) {
            throw new Exception("Parent node with matching signature not found.");
        }
        // The weighting of the calling methods is a percentage.
        double callCount = (((double)totalCount) * parentpn.getWeight())/100.0;
        // System.err.printf("Call count is %d * %f = %f\n", totalCount, parentpn.getWeight(), callCount);
        return callCount;
    }

	public void addChild(NormalisedNode childNode) {
        this.children.add(childNode);
	}

    // This should only be called once, on the root node.
    public double totalChildCounts() throws Exception {
        // if( this.parent != null) {
        //     throw new Exception("Do not call totalChildCounts on anything but a root node.");
        // }
        double total = 0.0;
        for (NormalisedNode child: this.children) {
          total += child.totalChildCounts();
          total += child.count;
        }
        this.childCount = total;
        return this.childCount;
      }

}