import json
import statistics
import os

dir = "./final-data/known"
events = []

known = []

for filename in os.listdir(dir):
    with open(os.path.join(os.getcwd(), dir, filename), 'r') as f:
        events.append(json.load(f))

for e in events:
    assert e[0]['detail']['name'] == 'webRequest' and e[0]['detail']['url'] == 'https://134.169.35.116/'
    known.append(e[0]['duration'])

print("known: " + str(statistics.fmean(known)) + " | " + str(known))
