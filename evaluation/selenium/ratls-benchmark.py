from selenium import webdriver
from selenium.webdriver.firefox.service import Service
from selenium.webdriver.firefox.options import Options

# Set the path to your custom Firefox binary
custom_firefox_path = "/Users/luca/Dev/Firefox/obj-aarch64-apple-darwin24.0.0/dist/Nightly.app/Contents/MacOS/firefox"

# Set the custom Firefox profile to trust the mini ca
profile_name = "evaluation"
profile_path = "./profiles/evaluation-minica-profile"

# Set the custom extension path
extension_path = "/Users/luca/Dev/RATLS-WebExt/build/web-ext-artifacts/17840039dd4943e1851d-1.3.0.xpi"

service = Service("/opt/homebrew/bin/geckodriver", log_path="geckodriver.log")
options = Options()

options.binary_location = custom_firefox_path

# Set profile to start with
options.profile = profile_path

driver = webdriver.Firefox(service=service, options=options)
driver.install_addon(extension_path, temporary=True)

driver.get("https://localhost")
