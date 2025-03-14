from selenium import webdriver
import time
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC

# Pfad zur Firefox-Erweiterung (.xpi-Datei)

# The extension in its production ready form
erweiterung_unknown = './17840039dd4943e1851d-1.1.2.xpi'

# The extension manipulated to already trust the visited website
erweiterung_known = './17840039dd4943e1851d-1.1.4.xpi'

# firefox_profile_path = '../../firefox-profile'
firefox_profile_path = './firefox-profile'
# URL der zu testenden Webseite
url = 'https://transparent-vm.net'
# waiting condition to detect the main site
waiting_condition = EC.presence_of_element_located((By.ID, 'test123'))

testcases = ["unknown", "known", "raw"]

# options = Options()
options = webdriver.FirefoxOptions()

# Definiere Optionen, um den Cache zu deaktivieren
# Nicht mehr nötig, da Browser für jeden Test neu gestartet wird
# options.set_preference("browser.cache.disk.enable", False)
# options.set_preference("browser.cache.memory.enable", False)
# options.set_preference("browser.cache.offline.enable", False)
# options.set_preference("network.http.use-cache", False)

options.add_argument("--headless")

# options.set_preference("profile", firefox_profile_path)
options.profile = firefox_profile_path
# options.add_argument("-profile firefox_profile_path")

# Anzahl der Wiederholungen
anzahl_wiederholungen = 10

# Liste zur Speicherung der Ladezeiten
ladezeiten = {}

# Starte den Testschleife
for testcase in testcases:
    ladezeiten[testcase] = []
    print(f'testing: {testcase}')
    for wiederholung in range(anzahl_wiederholungen):
        if wiederholung % (anzahl_wiederholungen / 10) == 0:
            print(f'Wiederholung {wiederholung} von {anzahl_wiederholungen}')

        driver = webdriver.Firefox(options=options)

        # Lade die Erweiterung
        if testcase == "unknown":
            driver.install_addon(erweiterung_unknown)
        elif testcase == "known":
            driver.install_addon(erweiterung_known)

        # be sure the browser was already open before starting the measurement
        # driver.get("https://example.com")
        # TODO Schlafen sinnvoll?

        # Navigiere zur Webseite
        startzeit = time.time()  # Startzeit messen
        driver.get(url)
        # if testcase == "unknown":
        WebDriverWait(driver, timeout=10, poll_frequency=1/1000).until(waiting_condition)
        endzeit = time.time()  # Endzeit messen

        ladezeit = (endzeit - startzeit) * 1000  # Ladezeit berechnen
        ladezeiten[testcase].append(ladezeit)

        # Lösche Cookies und Local Storage
        driver.quit()

        # Nicht mehr nötig, da Browser neu gestartet wird
        # driver.delete_all_cookies()
        # driver.execute_script('window.localStorage.clear();')

for testcase in testcases:
    # Berechne Durchschnittliche Ladezeit
    durchschnittliche_ladezeit = sum(ladezeiten[testcase]) / len(ladezeiten[testcase])

    # Gib die Ergebnisse aus
    print(f'Testcase: {testcase}')
    print(f'Durchschnittliche Ladezeit nach {anzahl_wiederholungen} Versuchen: {durchschnittliche_ladezeit} ms')
    print(f'Lowest: {min(ladezeiten[testcase])}, highest: {max(ladezeiten[testcase])}')
    # print(str(ladezeiten[testcase]))
    print()

for testcase in testcases:
    print(f'Testcase: {testcase}')
    print(str(ladezeiten[testcase]))
    print()
