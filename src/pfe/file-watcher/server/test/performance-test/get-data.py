import json
import os
import pandas as pd

with open(os.path.join(os.getcwd(), "average-performance-data.json")) as json_file:
    data = json.load(json_file)

df = pd.DataFrame(data=data)
df.fillna("-", inplace=True)
print(">> Saving performance data into csv file");
df.to_csv("0.6.1-performance-data.csv")
