import json
import statistics
import sys
import os

dir = sys.argv[1]
events = []
filteredEvents = []

loadReport = []
loadVCEK = []
validate = []
total = []
known = []

for filename in os.listdir(dir):
    with open(os.path.join(os.getcwd(), dir, filename), 'r') as f:
        events.append(json.load(f))

for i, event in enumerate(events):
    dialogEvent = list(filter(lambda de: de['name'] == 'dialog', event))[0]
    filteredEvents.append(list(filter(lambda ee: ee['startTime'] >= dialogEvent['startTime'] and ee['startTime'] + ee['duration'] <= dialogEvent['startTime'] + dialogEvent['duration'], event)))
    ke = list(filter(lambda kee: kee['startTime'] >= dialogEvent['startTime'] + dialogEvent['duration'], event))
    known.append(ke[0]['duration'])
    # print(event)

for e in filteredEvents:
    total.append(e[0]['duration'])
    loadReport.append(e[1]['duration'])
    loadVCEK.append(e[3]['duration'])
    validate.append(e[0]['startTime'] + e[0]['duration'] - (e[3]['startTime'] + e[3]['duration']))
    # crl = list(filter(lambda de: de['name'] == 'https://kdsintf.amd.com/vcek/v1/Milan/crl', e))[0]
    # validate.append(e[0]['startTime'] + e[0]['duration'] - (e[3]['startTime'] + e[3]['duration']) - e[5]['duration'])
    # print(e)

print("loadReport: " + str(statistics.fmean(loadReport)) + " | " + str(loadReport))
print("loadVCEK: " + str(statistics.fmean(loadVCEK)) + " | " + str(loadVCEK))
print("validate: " + str(statistics.fmean(validate)) + " | " + str(validate))
print("total: " + str(statistics.fmean(total)) + " | " + str(total))
print("known: " + str(statistics.fmean(known)) + " | " + str(known))
