import {AttesationReport} from "./attestation";
import {isEmpty} from "lodash";

/**
 * structure of the storage:
 * key------------------|-value-------------------------------|-comment-----------------------------
 * <url>                | data about the host behind the url  | the url has to be a qualified url
 *                      |                                     | like https://example.com
 * author_keys          | an array of author keys             | -
 * measurement_repos    | an array of url pointing to         | -
 *                      | measurement repos                   |
 */

const AUTHOR_KEYS = "author_keys";
const MEASUREMENT_REPOS = "measurement_repos";

async function getObject(request){
    const item = await browser.storage.local.get(request);
    if (isEmpty(item))
        return {};
    else
        return item[request];
}

async function getArray(request){
    const item = await browser.storage.local.get(request);
    if (isEmpty(item))
        return [];
    else
        return item[request];
}

async function setObjectProperties(key, object) {
    const old = await getObject(key);
    return browser.storage.local.set({
        [key]: {...old, ...object} // the latter overwrites the former
    });
}

async function getObjectProperty(key, propertyName) {
    const hosts = await browser.storage.local.get(key);
    return Object.keys(hosts).length !== 0 && hosts[key][propertyName];
}

async function removeObjectProperty(key, propertyName) {
    let host = await getObject(key);
    delete host[propertyName];
    return browser.storage.local.set({[key]: host});
}

async function arrayAdd(key, value) {
    const old = await getArray(key);
    if (!old.includes(value)) {
        return browser.storage.local.set({
            [key] : [...old, value] // the latter overwrites the former
        });
    }
}

async function arrayRemove(key, value) {
    const old = await getArray(key);
    const index = old.indexOf(value);
    if (index > -1)
        old.splice(index, 1);
    return browser.storage.local.set({[key] : old});
}

async function arrayContains(key, value) {
    const old = await getArray(key);
    return old.includes(value);
}

export function newTrusted(host, trustedSince, lastTrusted, type, ar_arrayBuffer, ssl_sha512) {
    return setTrusted(host, {
        trustedSince : trustedSince,
        lastTrusted : lastTrusted,
        type : type,
        ar_arrayBuffer : ar_arrayBuffer,
        ssl_sha512 : ssl_sha512,
        trusted : true,
    })
}

export async function setTrusted(host, infoObj) {
    return setObjectProperties(host, infoObj);
}

export async function isTrusted(host) {
    return getObjectProperty(host, "trusted");
}

export async function getTrusted() {
    const hosts = await getHost();
    return Object.fromEntries(Object.entries(hosts).filter(([, val]) => val.trusted));
}

/**
 * returns all stored information about one host or about all hosts if host is left blank
 * @param host
 * @returns {*|Promise<{}|*>}
 */
export function getHost(host) {
    if (host) {
        return getObject(host)
    } else {
        return browser.storage.local.get()
    }
}

export function removeHost(host) {
    return browser.storage.local.remove(host)
}

export async function setUntrusted(host, untrusted) {
    return setObjectProperties(host, {blocked: untrusted});
}

export async function isUntrusted(host) {
    return getObjectProperty(host, "blocked");
}

export async function isKnownHost(host) {
    return await isTrusted(host) || await isUntrusted(host) || await isIgnored(host);
}

export async function setReportURL(host, url) {
    return setObjectProperties(host, {reportURL: url});
}

// TODO rewrite with better performance?
export async function isReportURL(url) {
    let hosts = await browser.storage.local.get(null);
    return Object.values(hosts).map(h => h.reportURL).includes(url);
}

export async function setIgnore(host, ignore) {
    return setObjectProperties(host, {ignore: ignore});
}

export async function isIgnored(host) {
    return getObjectProperty(host, "ignore");
}

export async function setUnsupported(host, unsupported) {
    return setObjectProperties(host, {unsupported: unsupported});
}

export async function isUnsupported(host) {
    return getObjectProperty(host, "unsupported");
}

export async function setSSLKey(host, ssl_sha512) {
    return setObjectProperties(host, {ssl_sha512: ssl_sha512});
}

export async function getSSLKey(host) {
    return getObjectProperty(host, "ssl_sha512");
}

export async function getAttestationReport(host) {
    const ar_arrayBuffer = getObjectProperty(host, "ar_arrayBuffer");
    return new AttesationReport(ar_arrayBuffer);
}

export async function setMeasurementRepo(host, url) {
    await addMeasurementRepo(url);
    return setObjectProperties(host, {trusted_measurement_repo: url});
}

/**
 * returns the measurement repo belonging to the host or all repos if no host is supplied
 * @param host
 * @returns {Promise<[]|*>}
 */
export async function getMeasurementRepo(host) {
    if (host)
        return getObjectProperty(host, "trusted_measurement_repo");
    else
        return getArray(MEASUREMENT_REPOS);
}

export async function containsMeasurementRepo(measurementRepo) {
    return arrayContains(MEASUREMENT_REPOS, measurementRepo);
}

export async function addMeasurementRepo(measurementRepo) {
    return arrayAdd(MEASUREMENT_REPOS, measurementRepo);
}

export async function removeMeasurementRepo(measurementRepo) {
    const hosts = await getHost();
    await Promise.all(Object.entries(hosts)
        .filter(([, val]) => val.trusted_measurement_repo === measurementRepo)
        .map(([host,]) => removeObjectProperty(host, "trusted_measurement_repo")));
    return arrayRemove(MEASUREMENT_REPOS, measurementRepo);
}

export async function setAuthorKey(host, authorkey) {
    await addAuthorKey(authorkey);
    return setObjectProperties(host, {author_key: authorkey});
}

/**
 * returns the author key belonging to the host or all author keys if no host is supplied
 * @param host
 * @returns {Promise<[]|*>}
 */
export async function getAuthorKey(host) {
    if (host)
        return getObjectProperty(host, "author_key");
    else
        return getArray(AUTHOR_KEYS);
}

export async function containsAuthorKey(authorKey) {
    return arrayContains(AUTHOR_KEYS, authorKey);
}

export async function addAuthorKey(authorKey) {
    return arrayAdd(AUTHOR_KEYS, authorKey);
}

export async function removeAuthorKey(authorKey) {
    const hosts = await getHost();
    await Promise.all(Object.entries(hosts)
        .filter(([, val]) => val.author_key === authorKey)
        .map(([host,]) => removeObjectProperty(host, "author_key")));
    return arrayRemove(AUTHOR_KEYS, authorKey);
}
