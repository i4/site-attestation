import * as asn1js from "asn1js";
import * as pkijs from "pkijs";
import ask from "../certificates/ask.der";
import ark from "../certificates/ark.der";
import {fetchArrayBuffer, fetchAttestationReport, fetchVCEK} from "./net";
import * as util from "./util";
import {arrayBufferToHex} from "./util";
import * as storage from "./storage";

// Validate the VCEK certificate using the AMD provided keys
// and revocation list.
// returns boolean
export async function validateWithCertChain(vcek) {
    // AMD key server
    const AMD_ARK_ASK_REVOCATION = "https://kdsintf.amd.com/vcek/v1/Genoa/crl" // TODO: derive architecture from AR

    // Fetch assets of the web extension such as ask and ark
    async function loadData(resourcePath) {
        var url = browser.runtime.getURL(resourcePath);
        return (await fetch(url)).arrayBuffer();
    }

    function decodeCert(der) {
        const asn1 = asn1js.fromBER(der)
        return new pkijs.Certificate({schema: asn1.result})
    }

    const ask_cert = decodeCert(await loadData(ask));
    const ark_cert = decodeCert(await loadData(ark));

    // TODO revocation List async, not during every attestation
    const text = await fetchArrayBuffer(AMD_ARK_ASK_REVOCATION);

    const crls = [];
    const crl = pkijs.CertificateRevocationList.fromBER(text);
    crls.push(crl);

    // Create certificate's array (end-user certificate + intermediate certificates)
    const certificates = [];
    certificates.push(ask_cert);
    certificates.push(vcek);

    // Make a copy of trusted certificates array
    const trustedCerts = [];
    trustedCerts.push(ark_cert);

    // Create new X.509 certificate chain object
    const certChainVerificationEngine = new pkijs.CertificateChainValidationEngine({
        trustedCerts,
        certificates,
        crls,
    });

    return certChainVerificationEngine.verify();
}

export async function validateAttestationReport(ar, vcek) {
    async function importPubKey(rawData) {
        return await window.crypto.subtle.importKey(
            "raw",
            rawData,
            {
                name: "ECDSA",
                namedCurve: "P-384"
            },
            true,
            ["verify"]
        );
    }

    async function verifyMessage(pubKey, signature, data) {
        console.log(pubKey, signature);
        console.log(data);
        return await window.crypto.subtle.verify(
            {
                name: "ECDSA",
                namedCurve: "P-384",
                hash: {name: "SHA-384"},
            },
            pubKey,
            signature,
            data
        );
    }

    // Hack: We cannot directly ask the cert object for the public key as
    // it triggers a 'not supported' exception. Thus convert to JSON and back.
    const jsonPubKey = vcek.subjectPublicKeyInfo.subjectPublicKey.toJSON()
    const pubKey = await importPubKey(util.hex_decode(jsonPubKey.valueBlock.valueHex))
    return await verifyMessage(pubKey, ar.signature, ar.getSignedData)
}

export async function checkHost(hostInfo, hostAttestationInfo) {
    // const ssl_sha512 = hostInfo.ssl_sha512;

    console.log("checking host");

    const ar = hostAttestationInfo.attestationReport;
    const vcek = hostAttestationInfo.vcekCert;

    // 1. verify TLS connection
    // TODO check for Nonce, Public Key
    // if (/*false && */util.arrayBufferToHex(ar.report_data) !== ssl_sha512) {
    //     // TLS connection pubkey is not equal to pubkey in attestation report
    //     console.log("TLS connection invalid");
    //     return false;
    // }

    console.log("validating AR and VCEK");

    // 2. Validate that the VCEK is correctly signed by AMD root cert
    if (!await validateWithCertChain(vcek)) {
        // vcek could not be verified
        console.log("vcek invalid");
        return false;
    }

    console.log("VCEK validated");

    // 3. Validate that the attestation report is correctly signed using the VCEK
    if (!await validateAttestationReport(ar, vcek)) {
        // attestation report could not be verified using VCEK
        console.log("attestation report invalid")
        return false;
    }

    console.log("AR validated");

    return true;
}

/**
 * validates hosts attestation report and compares its measurement to measurementHex
 * @param hostInfo
 * @param measurementHex
 * @returns {Promise<AttestationReport|boolean>} the hosts attestation report on success, false on failure
 */
export async function validateMeasurement(hostInfo, measurementHex) {
    // Request attestation report from VM
    let ar;
    try {
        ar = await fetchAttestationReport(hostInfo.host, hostInfo.attestationInfo.path);
    } catch (e) {
        // no attestation report found
        console.log(e);
        return false;
    }

    if (!await checkHost(hostInfo, ar)) {
        return false;
    }

    if (measurementHex !== arrayBufferToHex(ar.measurement)) {
        console.log("current measurement differs from stored measurement");
        return false;
    }

    return ar;
}

export async function validateAuthorKey(hostInfo) {
    try {
        const ar = await fetchAttestationReport(hostInfo.host, hostInfo.attestationInfo.path);
        if (ar && ar.author_key_en &&
            await storage.containsAuthorKey(arrayBufferToHex(ar.author_key_digest)) &&
            await checkHost(hostInfo.host, ar)) {
            // host supplies a known author key
            return ar;
        }
    } catch (e) {
        console.log(e);
    }
    return null;
}
