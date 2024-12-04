import time

from selenium import webdriver
from selenium.webdriver.firefox.service import Service
from selenium.webdriver.firefox.options import Options
from selenium.webdriver.support.wait import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.common.by import By

# global config
url = "https://localhost"
number_of_tests = 10
testcases = ["unknown", "raw"] # "known"
condition = EC.title_is("404 Not Found")

# Set the path to your custom Firefox binary
custom_firefox_path = "/Users/luca/Dev/Firefox/obj-aarch64-apple-darwin24.0.0/dist/Nightly.app/Contents/MacOS/firefox"

# Set the custom Firefox profile to trust the mini ca
profile_path = "./profiles/evaluation-minica-profile"

# Set the custom extension path
extension_path = "/Users/luca/Dev/RATLS-WebExt/build/web-ext-artifacts/17840039dd4943e1851d-1.3.0.xpi"

service = Service("/opt/homebrew/bin/geckodriver", log_path="geckodriver.log")
options = Options()

options.binary_location = custom_firefox_path

# Set profile to start with
options.profile = profile_path

loading_times = {}

### MEASUREMENTS ###
for testcase in testcases:
    loading_times[testcase] = []
    for repetition in range(number_of_tests):
        if repetition % (number_of_tests / 10) == 0:
            print(f"repetition: {repetition} of {number_of_tests}")

        driver = webdriver.Firefox(service=service, options=options)
        wait = WebDriverWait(driver, 20)

        if testcase == "unknown":
            driver.install_addon(extension_path, temporary=True)

        start_time = time.time()
        driver.get(url)

        if testcase == "unknown":
            # click the trust button
            button = wait.until(EC.element_to_be_clickable((By.ID, "trust-measurement-button")))
            button.click()

        wait.until(condition)
        end_time = time.time()
        loading_times[testcase].append(end_time - start_time)

        # clean up for next run
        driver.quit()

### OUTPUT ###
for testcase in testcases:
    print(f"Testcase: {testcase}")
    print(f"{loading_times[testcase] * 1000}")
    print()
