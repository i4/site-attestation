# Site Attestation
This is the code repository for the paper **Site Attestation: Browser-based Remote Attestation**, which was presented at the [18th EuroSec workshop](https://eurosec-workshop.github.io/) co-located with the EuroSys'25 conference.

DOI: https://doi.org/10.1145/3722041.3723095

## Abstract
When a website is accessed, a connection is made using HTTPS to ensure that it ends with the website owner and that subsequent data traffic is secured.
However, no further assurances can be given to a user.
It is therefore a matter of trust that the site is secure and treats the information exchanged faithfully.
This puts users at risk of interacting with insecure or even fraudulent systems.
With the availability of confidential computing, which makes execution contexts secure from external access and remotely attestable, this situation can be fundamentally improved.

In this paper, we propose browser-based _site attestation_ that allows users to validate advanced security properties when accessing a website secured by confidential computing.

This includes data handling policies such as the data provided being processed only during the visit and not stored or forwarded.
Or informs the user that the accessed site has been audited by a security company and that the audited state is still intact.

This is achieved by integrating remote attestation capabilities directly into a commodity browser and enforcing user-managed attestation rules.

## About this repository

published @Eurosec'25, contains:
- [webserver patch](nginx)
- [httperf patch](httperf)
- [Browser extension](webext)
- [Browser patch](firefox)

### Webserver patch

We patched `nginx` to support _site attestation_. To achieve this, we register a custom TLS extension. For further details, check out the [`nginx/`](nginx) sub-directory.

### httperf patch

In order to measure the performance impact of _site attestation_ on the webserver performance, we patched httperf. For details, check out the [`httperf/`](httperf) sub-directory.

### Browser extension
The application logic of _site attestation_ is implemented in the form of a WebExtension for the Firefox browser, which build upon our proposed _TLSExt_ API.
For more details, check out the [`webext/`](webext) sub-directory.

### Browser patch
As a basis for the browser extension, we patched the firefox browser to include our proposed _TLSExt_ API, which enables web extensions to send and handle custom TLS 1.3 handhsake extensions. For details, check out the [`firefox/`](firefox) sub-directory.
