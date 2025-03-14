import json
import statistics
import os

dir = "./final-data/plain"
durations = []

for filename in os.listdir(dir):
    with open(os.path.join(os.getcwd(), dir, filename), 'r') as f:
        data = json.load(f)
        assert data[0]['detail']['name'] == 'webRequest' and data[0]['detail']['url'] == 'https://134.169.35.116/'
        durations.append(data[0]["duration"])

print("plain: " + str(statistics.fmean(durations)) + " | " + str(durations))
