from selenium import webdriver
from selenium.webdriver.firefox.service import Service
from selenium.webdriver.firefox.options import Options

# Set the path to your custom Firefox binary
custom_firefox_path = "/Users/luca/Dev/Firefox/obj-aarch64-apple-darwin24.0.0/dist/Nightly.app/Contents/MacOS/firefox"

# Set the custom Firefox profile to trust the mini ca
profile_path = "/Users/luca/Library/Application Support/Firefox/Profiles/4k7wb8xu.evaluation"

# Set the custom extension path
extension_path = "/Users/luca/Dev/RATLS-WebExt/build/web-ext-artifacts/17840039dd4943e1851d-1.3.0.xpi"

service = Service("/opt/homebrew/bin/geckodriver")
options = Options()

options.binary_location = custom_firefox_path
options.set_preference("profile", profile_path)

driver = webdriver.Firefox(service=service, options=options)
driver.install_addon(extension_path, temporary=True)

driver.get("https://localhost")
