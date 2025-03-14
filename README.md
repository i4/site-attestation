# Site Attestation

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
- webserver patch
- httperf patch
- Browser extension
- Browser patch

### Webserver patch

We patched `nginx` to support _site attestation_. To achieve this, we register a custom TLS extension. For further details, check out the `nginx/` sub-directory.

### httperf patch

In order to measure the performance impact of _site attestation_ on the webserver performance, we patched httperf. For details, check out the `httperf/` sub-directory.

### Browser extension

### Browser patch
