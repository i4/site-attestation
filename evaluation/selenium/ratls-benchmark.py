import time

from selenium import webdriver
from selenium.common import TimeoutException
from selenium.webdriver.firefox.service import Service
from selenium.webdriver.firefox.options import Options
from selenium.webdriver.support.wait import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.common.by import By

# global config
url = "https://i4epyc1.cs.fau.de"
url_hostname = "i4epyc1.cs.fau.de"
number_of_tests = 5
testcases = ["unknown", "raw", "known", "unknown_no_freshness", "known_no_freshness"]
condition = EC.title_is("bRAwser")
config_measurement = "e5699e0c270f3e5bfd7e2d9dc846231e99297d55d0f7c6f894469eb384b3402239b72c0c28a49e231e8a1a62314309b4"

# Set the path to your custom Firefox binary
custom_firefox_path = "/Users/luca/Dev/Firefox/obj-aarch64-apple-darwin24.0.0/dist/Nightly.app/Contents/MacOS/firefox"

# Set the custom Firefox profile to trust the mini ca
profile_path = "./profiles/evaluation-minica-profile"

# Set the custom extension path
unknown_extension_path = "./17840039dd4943e1851d-1.3.13.xpi"
known_extension_path = "./17840039dd4943e1851d-1.3.14.xpi"
unknown_no_freshness_extension_path = "./17840039dd4943e1851d-1.3.15.xpi"
known_no_freshness_extension_path = "./17840039dd4943e1851d-1.3.16.xpi"

service = Service("/opt/homebrew/bin/geckodriver", log_path="geckodriver.log")
options = Options()

options.binary_location = custom_firefox_path
# options.add_argument("--headless") # run in headless mode without UI

# Set profile to start with
# options.profile = profile_path

### HELPERS ###
def inject_config_measurement(driver):
    script = """
    browser.runtime.sendMessage({{
        type: "2",
        url: "{url_hostname}",
        config_measurement: "{config_measurement}"
    }}).then(response => {{
        console.log(response.status);
    }}).catch(error => {{
        console.error(error);
    }});
    """.format(url_hostname=url_hostname, config_measurement=config_measurement)
    driver.execute_script(script)
    time.sleep(10000)

### MEASUREMENTS ###
loading_times = {}
for testcase in testcases:
    print(f'testing: {testcase}')

    loading_times[testcase] = []
    repetition = 0
    while repetition < number_of_tests:
        driver = None
        try:
            if repetition % (number_of_tests / 10) == 0:
                print(f"repetition: {repetition} of {number_of_tests}")

            driver = webdriver.Firefox(service=service, options=get_options(testcase))
            wait = WebDriverWait(driver, timeout=5, poll_frequency=1/1000)

            if testcase == "unknown":
                driver.install_addon(unknown_extension_path, temporary=True)
                # time.sleep(2)
            elif testcase == "known":
                driver.install_addon(known_extension_path, temporary=True)
                # time.sleep(2)
            elif testcase == "unknown_no_freshness":
                driver.install_addon(unknown_no_freshness_extension_path, temporary=True)
            elif testcase == "known_no_freshness":
                driver.install_addon(known_no_freshness_extension_path, temporary=True)
            time.sleep(2)

            start_time = time.time()
            driver.get(url)

            if testcase == "unknown" or testcase == "unknown_no_freshness":
                # click the trust button
                button = wait.until(EC.element_to_be_clickable((By.ID, "trust-measurement-button")))
                button.click()

            wait.until(condition)

            end_time = time.time()
            load_time = end_time - start_time
            loading_times[testcase].append(load_time * 1000)

            repetition += 1
        except TimeoutException:
            print("Timeout exception")
            continue
        finally:
            # clean up for next run
            if driver: driver.quit()

### OUTPUT ###
for testcase in testcases:
    average_loading_time = sum(loading_times[testcase]) / len(loading_times[testcase])

    print(f'Testcase: {testcase}')
    print(f'Average loading time after {number_of_tests} tests: {average_loading_time} ms')
    print(f'Lowest: {min(loading_times[testcase])}, highest: {max(loading_times[testcase])}')
    print()

for testcase in testcases:
    print(f"Testcase: {testcase}")
    print(f"{loading_times[testcase]}")
    print()
