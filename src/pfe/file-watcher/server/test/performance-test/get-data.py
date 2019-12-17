import json
import os
import pandas as pd
import numpy as np


with open(os.path.join(os.getcwd(), "data", os.environ["TEST_TYPE"], os.environ["TURBINE_PERFORMANCE_TEST"], "performance-data.json")) as json_file:
    performance_data = json.load(json_file);

applicationTypes = performance_data.keys();
performanceObject = {};

for appType in applicationTypes:
    projectLang = performance_data[appType].keys();
    for lang in projectLang:
        iterations = performance_data[appType][lang].keys();
        performanceObject["{}-{}".format(appType, lang)] = {};
        for iteration in iterations:
            performanceKeys = performance_data[appType][lang][iteration].keys();
            for performanceKey in performanceKeys:
                if (not (performanceKey in performanceObject["{}-{}".format(appType, lang)])):
                    performanceObject["{}-{}".format(appType, lang)][performanceKey] = [];
                performanceObject["{}-{}".format(appType, lang)][performanceKey].append(performance_data[appType][lang][iteration][performanceKey]);
        for performanceKey in performanceKeys:
            performanceObject["{}-{}".format(appType, lang)][performanceKey] = np.mean(performanceObject["{}-{}".format(appType, lang)][performanceKey]);

df = pd.DataFrame(data=performanceObject);
df.fillna("-", inplace=True);
data_file = os.path.join(os.getcwd(), "data", os.environ["TEST_TYPE"], os.environ["TURBINE_PERFORMANCE_TEST"], "{}-{}-performance-data.csv".format(os.environ["TEST_TYPE"], os.environ["TURBINE_PERFORMANCE_TEST"]));
print(">> Saving performance data into csv file: {}".format(data_file));
df.to_csv(data_file);
