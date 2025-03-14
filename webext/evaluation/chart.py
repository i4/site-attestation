#!/usr/bin/env python3

import sys
import json
import matplotlib
import matplotlib.pyplot as plt
from matplotlib.ticker import MultipleLocator

# dir = sys.argv[1]
# filterHost = None
# # url for filtering given?
# try:
#     filterHost = sys.argv[2]
# except IndexError:
#     filterHost = None

# filter for a specific host url, such that other urls like the request for the favicon are filtered out
# filterHost = 'https://134.169.35.116/'
filterHost = None
dir = './final-data/known/0'
removeKnownEvent = False
exportToLatex = False

if exportToLatex:
    matplotlib.use("pgf")
    matplotlib.rcParams.update({
        "pgf.texsystem": "pdflatex",
        'font.family': 'serif',
        'text.usetex': True,
        'pgf.rcfonts': False,
    })

jsonFile = open(dir)

data = []
if filterHost:
    data = list(filter(lambda e: e['detail']['url'] == filterHost, json.load(jsonFile)))
else:
    data = json.load(jsonFile)

# filter out favicon
faviconEvent = list(filter(lambda e: e['detail']['url'].endswith('favicon.ico'), data))[0]
data = list(filter(lambda e: e['startTime'] < faviconEvent['startTime'], data))
if removeKnownEvent:
    dialogEvent = list(filter(lambda e: e['name'] == 'dialog', data))[0]
    data = list(filter(lambda e: ((e['startTime'] + e['duration']) <= (dialogEvent['startTime'] + dialogEvent['duration'])), data))

colors = ['red', 'green', 'blue', 'yellow', 'orange', 'pink', 'lightgreen', 'lightblue', 'black', 'grey']
urls = set(event['detail']['url'] for event in data)
url_colors = {url: colors[i % len(colors)] for (i, url) in enumerate(urls)}

# normalize millis
start_time = data[0]['startTime']
for event in data:
    event['startTime'] -= start_time

height = len(data) * 0.5 + .15
fig, ax = plt.subplots(figsize=(height * 4, height)) # * 2 for fresh, * 4 for known

for i, event in enumerate(data):
    color = url_colors.get(event['detail']['url'], 'grey')
    ax.barh(i + 0.25, event['duration'], left=event['startTime'], height=0.5, align='center', color=color)
    label = event['detail']['url'] if event['detail']['name'] == 'webRequest' else event['detail']['name'].replace(':', ' ')
    label = 'https://kdsintf.amd.com/vcek/v1/Milan/...' if label == 'https://kdsintf.amd.com/vcek/v1/Milan/6186b39de2289d9986bfc728f91754f1d5bb92df4d0c0e56edee2e2a4086fced842401bd99b0da85328bf25193466727c75fa28fcf4f1ce79e03e35cec8ce5dc?blSPL=02&teeSPL=00&snpSPL=06&ucodeSPL=115' else label
    ax.text(event['startTime'], i, label, ha='left', va='top')

ax.set_xlabel('Time in ms')
ax.set_ylabel('Event')
ax.set_yticklabels([])
ax.xaxis.set_major_locator(MultipleLocator(25)) # 25 for known, 100 for fresh
ax.grid(True)
ax.margins(y=.15)

plt.tight_layout()
if exportToLatex:
    plt.savefig('plot.pgf')
else:
    plt.show()
