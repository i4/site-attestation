# RATLS patched httperf

This repository contains a patch that allows httperf to request an attestation remote from a site-attestation enabled website.
To see the patch, search for `SSL_CTX_add_custom_ext` where we add `EXT_RATLS`.
This patch adds the request to `SSL_EXT_CLIENT_HELLO` and gets the report in `SSL_EXT_TLS1_3_CERTIFICATE`, which `httperf` just ignores.

# httperf

Please refer to the origininal [project](https://github.com/httperf/httperf).

httperf is a tool for measuring web server performance. It provides a flexible facility for generating various HTTP workloads and for measuring server performance.

The focus of httperf is not on implementing one particular benchmark but on providing a robust, high-performance tool that facilitates the construction of both micro- and macro-level benchmarks. The three distinguishing characteristics of httperf are its robustness, which includes the ability to generate and sustain server overload, support for the HTTP/1.1 and SSL protocols, and its extensibility to new workload generators and performance measurements.

## Building httperf

This release of httperf is using the standard GNU configuration
mechanism.  The following steps can be used to build it:

In this example, SRCDIR refers to the httperf source directory.  The
last step may have to be executed as "root".

First, some tools which are required for the build process need to be installed.

	$ sudo apt install automake libtool

Then, run the following steps in order to build. Note that some of these might have to be executed as "root", i.e., with sudo.

	$ autoconf
	$ libtoolize --force
	$ autoreconf -i
	$ automake
	$ ./configure
	$ make
