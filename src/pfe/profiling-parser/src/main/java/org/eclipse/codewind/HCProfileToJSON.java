package org.eclipse.codewind;

import java.io.BufferedWriter;
import java.io.File;
import java.io.FileNotFoundException;
import java.io.FileWriter;
import java.io.Writer;
import java.util.ArrayList;
import java.util.LinkedList;
import java.util.List;

import com.ibm.java.diagnostics.healthcenter.api.HealthCenter;
import com.ibm.java.diagnostics.healthcenter.api.HealthCenterException;
import com.ibm.java.diagnostics.healthcenter.api.factory.HealthCenterFactory;
import com.ibm.java.diagnostics.healthcenter.api.profiling.MethodProfileData;
import com.ibm.java.diagnostics.healthcenter.api.profiling.MethodProfilingNode;
import com.ibm.java.diagnostics.healthcenter.api.profiling.ProfilingData;

public class HCProfileToJSON {

    static NormalisedNode fakeRoot = new NormalisedNode("root", null, null);
    static List<NormalisedNode> nodesToDump = new LinkedList<>();

    static {
        nodesToDump.add(fakeRoot);
    }

    public static void main(String args[]) throws Exception {

        if (args.length != 2) {
            System.err.printf("Invalid number of arguments %d\n", args.length);
            System.exit(1);
        }
        // System.out.printf("Loading profiling data from %s\n", args[0]);
        File hcdFile = new File(args[0]);
        File outputFile = new File(args[1]);
        Writer out = new BufferedWriter(new FileWriter(outputFile));

        List<NormalisedNode> roots = new ArrayList<>();

        // A fake root so there is one overall root to the tree.

        try {
            HealthCenter hcAPI = HealthCenterFactory.connect(hcdFile);
            ProfilingData profilingData = hcAPI.getProfilingData();
            // MethodProfileData[] methodProfileData = profilingData.getProfilingEvents();
            List<MethodProfileData> allProfilingData = new LinkedList<>();
            for (MethodProfileData mpd: profilingData.getProfilingEvents() ) {
                allProfilingData.add(mpd);
            }

            for (MethodProfileData mpd : getRoots(allProfilingData)) {
                NormalisedNode root = new NormalisedNode(mpd.getMethodName(), fakeRoot, mpd);
                roots.add(root);
                fakeRoot.addChild(root);
            }

            // Find everything that's a child of the current top layer of our profiling tree.
            List<NormalisedNode> treeTop = roots;
            nodesToDump.addAll(treeTop);

            boolean foundParent = false;
            do {
                foundParent = false;
                List<NormalisedNode> nextLayer = new LinkedList<>();
                for (MethodProfileData mpd : allProfilingData) {
                    // Does an item belong at this depth in the tree?
                    for (NormalisedNode parent : treeTop) {
                        if (isParent(parent, mpd)) {
                            foundParent = true;
                            NormalisedNode newNode = new NormalisedNode(mpd.getMethodName(), parent, mpd);
                            nextLayer.add(newNode);
                            parent.addChild(newNode);
                            // System.out.printf("%s is a caller of %s\n", parent.signature, mpd.getMethodName());
                        }
                    }
                }
                treeTop = nextLayer;
                nodesToDump.addAll(treeTop);
                nextLayer = new LinkedList<>();
                // System.out.printf("\n-------------\n");
            } while (foundParent);

            fakeRoot.totalChildCounts();

        } catch (FileNotFoundException | HealthCenterException e) {
            e.printStackTrace();
        }

        try {
            double totalCount = 0.0;
            String separator = "";
            out.write("{\n");
            out.write("\"functions\": [\n");
            for (NormalisedNode node : nodesToDump) {
                out.write(separator);
                separator = ",\n";
                out.write(node.toJSON());
                totalCount += node.getCount();
            }
            out.write("\n],\n");
            out.write(String.format("\"total_count\": %f\n", totalCount));
            out.write("}\n");
        } catch (Exception e) {
            e.printStackTrace();
        } finally {
            out.close();
        }

        System.out.println("Done.");
        System.exit(0);
    }

    private static boolean isParent(NormalisedNode possibleParent, MethodProfileData mpd) {
        MethodProfilingNode[] callingMethods = mpd.getCallingMethods();
        if (possibleParent == fakeRoot && callingMethods.length == 0) {
            return true;
        }
        for (MethodProfilingNode caller : mpd.getCallingMethods()) {
            if (caller.getMethodName().equals(possibleParent.mpd.getMethodName())) {
                return isParent(possibleParent.parent, caller);
            }
        }
        return false;
    }

    private static boolean isParent(NormalisedNode possibleParent, MethodProfilingNode mpn) {
        MethodProfilingNode[] callingMethods = mpn.getCallingMethods();
        if (possibleParent == fakeRoot && callingMethods.length == 0) {
            return true;
        }
        for (MethodProfilingNode caller : mpn.getCallingMethods()) {
            if (caller.getMethodName().equals(possibleParent.mpd.getMethodName())) {
                return isParent(possibleParent.parent, caller);
            }
        }
        return false;
    }

    private static ArrayList<MethodProfileData> getRoots(List<MethodProfileData> methodProfileData) {
        ArrayList<MethodProfileData> roots = new ArrayList<MethodProfileData>();
        for (MethodProfileData mpd : methodProfileData) {
            if (mpd.getCallingMethods().length == 0) {
                roots.add(mpd);
            }
        }
        return roots;
    }

}