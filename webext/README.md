# ravm 

Web extension for firefox to perform remote attestation of a trusted execution secure virtual machine. 

## Build

Simply `npm run build` or better `npm run watch` 

### Prerequisites

Tested with: 
* npm 8.13.0
* Node.js  v17.4.0

For Development 
* http-server (https://www.npmjs.com/package/http-server)
* web-ext (https://github.com/mozilla/web-ext)
* html-webpack-plugin (npm install --save-dev html-webpack-plugin)

## Develop

To start the local development instance:

## Web server (https://transparent-vm.net:8080)
* Enable local resolve to transparent-vm.ne (e.g., by adding to /etc/hosts `127.0.0.1 transparent-vm.net`) 
* Please note the private key for https certificate is not included in the repository 
* Run `http-server -C cert.pem  -K key.pem -S` in `demo-site`

## Interactive development 

1. > `npm run watch` (Let webpack observe changes in the src folder.)
2. > `npm run http` (Start demo web sever; pls be aware private key is not included.)
3. > `npm run browser` (Start browser with jconsole; pls check configuration steps listed below.)

## Configure the firefox instance

Add the certificate for the server as an exception 
* Preferences -> Privacy & Security -> Certificates -> View Certificates
* In the Certificate Manager select Servers and use Add Exception... to add https://transparent-vm.net:8080 

Enable permissions of the ravm web-extension
* Preferences -> Extensions & Themes -> Extensions 
* Select check-vm -> Permissions and enable `Access your data for all websites` 

## Test functionality 
If the setup has been finished point the browser instance to https://transparent-vm.net:8080 . This will be noticed by the web extension and via the `Browser Console` for now the following outputs should be visible:

1. Attestation report has been validated by the AMD keyserver.
2. Expected state: cce...
3. Comnunication terminates inside the secured VM: 3786de2c15...

## External Contributions 
* External contributions are welcome and require to agree to the CLA (https://github.com/dfinity/cla). 
