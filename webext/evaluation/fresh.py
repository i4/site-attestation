import json
import statistics
import os

dir = "./final-data/fresh"
events = []
filteredEvents = []

loadReport = []
loadVCEK = []
validate = []
total = []

for filename in os.listdir(dir):
    with open(os.path.join(os.getcwd(), dir, filename), 'r') as f:
        events.append(json.load(f))

for i, event in enumerate(events):
    dialogEvent = list(filter(lambda e: e['name'] == 'dialog', event))[0]
    filteredEvents.append(list(filter(lambda e: (e['startTime'] >= dialogEvent['startTime']) and ((e['startTime'] + e['duration']) <= (dialogEvent['startTime'] + dialogEvent['duration'])), event)))
    # print(filteredEvents[i])

for e in filteredEvents:
    assert e[0]['name'] == 'dialog'
    total.append(e[0]['duration'])
    assert e[1]['detail']['name'] == 'webRequest' and e[1]['detail']['url'] == 'https://134.169.35.116/guest_report.bin'
    loadReport.append(e[1]['duration'])
    assert e[3]['detail']['name'] == 'webRequest' and e[3]['detail']['url'] == 'https://kdsintf.amd.com/vcek/v1/Milan/6186b39de2289d9986bfc728f91754f1d5bb92df4d0c0e56edee2e2a4086fced842401bd99b0da85328bf25193466727c75fa28fcf4f1ce79e03e35cec8ce5dc?blSPL=02&teeSPL=00&snpSPL=06&ucodeSPL=115'
    loadVCEK.append(e[3]['duration'])
    validate.append(e[0]['startTime'] + e[0]['duration'] - (e[3]['startTime'] + e[3]['duration']))

print("loadReport: " + str(statistics.fmean(loadReport)) + " | " + str(loadReport))
print("loadVCEK: " + str(statistics.fmean(loadVCEK)) + " | " + str(loadVCEK))
print("validate: " + str(statistics.fmean(validate)) + " | " + str(validate))
print("total: " + str(statistics.fmean(total)) + " | " + str(total))
