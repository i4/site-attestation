import * as util from "./util";

// Parses the TCB information provided by 
// the attestation report.
export class TCBVersion {

    constructor(arrayBuffer) {
        this.arrayBuffer = arrayBuffer;
        this.view = new DataView(arrayBuffer);
    }

    // Microcode
    get ucodeSPL() {
        return this.view.getUint8(7, true);
    }

    // SNP
    get snpSPL() {
        return this.view.getUint8(6, true);
    }

    get resevered() {
        return this.view.getUint32(2, true);
    }

    // TEE
    get teeSPL() {
        return this.view.getUint8(1, true);
    }

    // BOOT_LOADER
    get blSPL() {
        return this.view.getUint8(0, true);
    }
}

// Maps the attesation report of an SEV-SNP VM
// Table 21. ATTESTATION_REPORT Structure
// of https://www.amd.com/system/files/TechDocs/56860.pdf
export class AttestationReport {

    // uint32_t version;                  /* 0h */
    // uint32_t guest_svn;                /* 4h */
    // uint64_t policy;                   /* 8h */
    // uint8_t family_id[16];             /* 10h */
    // uint8_t image_id[16];              /* 20h */
    // uint32_t vmpl;                     /* 30h */
    // uint32_t signature_algo;           /* 34h */
    // snp_tcb_version_t tcb_version;     /* 38h */
    // snp_platform_info_t platform_info; /* 40h */
    // uint32_t author_key_en : 1;        /* 48h */
    // uint32_t reserved      : 31;
    // uint32_t reserved2;                /* 4C */
    // uint8_t report_data[64];           /* 50h */
    // uint8_t measurement[48];           /* 90h */
    // uint8_t host_data[32];             /* C0h */
    // uint8_t id_key_digest[48];         /* E0h */
    // uint8_t author_key_digest[48];     /* 110h */
    // uint8_t report_id[32];             /* 140h */
    // uint8_t report_id_ma[32];          /* 160h */
    // snp_tcb_version_t reported_tcb;    /* 180h */
    // uint8_t reserved3[0x1A0-0x188];    /* 188h-19Fh */
    // uint8_t chip_id[64];               /* 1A0h */
    // uint64_t committed_tcb;            /* 1E0h */
    // uint8_t current_build;             /* 1E8h */
    // uint8_t current_minor;             /* 1E9h */
    // uint8_t current_major;             /* 1EAh */
    // uint8_t reserved4;                 /* 1EBh */
    // uint8_t committed_build;           /* 1ECh */
    // uint8_t committed_minor;           /* 1EDh */
    // uint8_t committed_major;           /* 1EEh */
    // uint8_t reserved5;                 /* 1EFh */
    // uint64_t launch_tcb;               /* 1F0h */
    // uint8_t reserved6[0x2A0-0x1F8];    /* 1F8h-29Fh */
    // uint8_t signature[0x4A0-0x2A0];    /* 2A0h-49Fh */

    constructor(arrayBuffer) {
        this.arrayBuffer = arrayBuffer;
        this.view = new DataView(arrayBuffer);
    }

    get committedTCB() {
        return new TCBVersion(this.arrayBuffer.slice(0x1e0, 0x1e0 + 8));
    }

    get reportedTCB() {
        return new TCBVersion(this.arrayBuffer.slice(0x180, 0x180 + 8));
    }

    get currentTCB() {
        return new TCBVersion(this.arrayBuffer.slice(0x38, 0x38 + 8));
    }

    // uint8_t signature[0x4A0-0x2A0]; /* 2A0h-49Fh */
    get signature() {
        var signatureCombined = new Uint8Array(96);

        var r_tmp = new Uint8Array(this.arrayBuffer.slice(672, 672 + 48));
        var s_tmp = new Uint8Array(this.arrayBuffer.slice(672 + 72, 672 + 72 + 48));
        var r = new Uint8Array(48);
        var s = new Uint8Array(48);

        for (var i = 0; i < 48; i++) {
            r[i] = r_tmp[47 - i];
            s[i] = s_tmp[47 - i];
        }

        signatureCombined.set(r, 0);
        signatureCombined.set(s, 48);

        // console.log(arrayBufferToHex(signatureCombined) + " " + signatureCombined.byteLength);

        return signatureCombined;
    }

    get getSignedData() {
        return this.arrayBuffer.slice(0, 672);
    }

    // uint32_t version;               /* 0h */
    get version() {
        return this.view.getUint32(0, true);
    }

    // uint32_t guest_svn;             /* 4h */
    get guest_svn() {
        return this.view.getUint32(4, true);
    }

    // uint32_t author_key_en : 1;     /* 48h */
    get author_key_en() {
        // TODO: endian correct? could not test, because host did not support author key
        const reserved_author_key_en = this.view.getUint32(0x48, true);
        return reserved_author_key_en & 0b1;
    }

    // uint8_t report_data[64];        /* 50h */
    get report_data() {
        return this.arrayBuffer.slice(80, 80 + 64);
    }

    // uint8_t measurement[48];        /* 90h */
    get measurement() {
        return this.arrayBuffer.slice(144, 144 + 48);
    }

    // uint8_t author_key_digest[48];  /* 110h */
    get author_key_digest() {
        return this.arrayBuffer.slice(0x110, 0x110 + 48);
    }

    // uint8_t chip_id[64];            /* 1A0h */
    get chip_id() {
        return this.arrayBuffer.slice(416, 416 + 64);
    }

    // Excerpt text of report data
    get parse_report() {
        return `
      Version: ${this.version}
      Guest SVN: ${this.guest_svn}
      Report Data: ${util.arrayBufferToHex(this.report_data)}
      Measurement: ${util.arrayBufferToHex(this.measurement)}
      Chip ID: ${util.arrayBufferToHex(this.chip_id)}
      Signature: ${util.arrayBufferToHex(this.signature)}

      Signed Data:
            ${util.arrayBufferToHex(this.getSignedData)}
    `
    }
}
