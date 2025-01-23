import {AttestationReport} from "./attestation";
import {isEmpty} from "lodash";

/**
 * structure of the storage:
 * key------------------|-value-------------------------------|-comment-----------------------------
 * <url>                | data about the host behind the url  | the url has to be a qualified url
 *                      |                                     | like https://example.com
 * author_keys          | an array of author keys             | -
 * measurement_repos    | an array of url pointing to         | -
 *                      | measurement repos                   |
 * crls                 | a map of architectures and their    | -
 *                      | crl array buffer                    |
 */

/**
 * structure of the session storage:
 * key------------------|-value-------------------------------|-comment-----------------------------
 * hosts                | a map of hosts                      | -
 * tabs                 | a map of tabs and their last targets| -
 * sessions             | a map of sessionIds and information | -
 *                      | about them like their nonce         |
 */

const AUTHOR_KEYS = "author_keys";
const MEASUREMENT_REPOS = "measurement_repos";
const HOSTS = "hosts";
const TABS = "tabs";
const CRLS = "crls";
const SESSIONS = "sessions";

async function getObject(request, storageArea = browser.storage.local){
    const item = await storageArea.get(request);
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

export async function setObjectProperties(key, object, storageArea = browser.storage.local) {
    const old = await getObject(key, storageArea);
    return storageArea.set({
        [key]: {...old, ...object} // the latter overwrites the former
    });
}

async function getObjectProperty(key, propertyName, storageArea = browser.storage.local) {
    const hosts = await storageArea.get(key);
    return Object.keys(hosts).length !== 0 && hosts[key][propertyName];
}

async function removeObjectProperty(key, propertyName, storageArea = browser.storage.local) {
    let host = await getObject(key, storageArea);
    delete host[propertyName];
    return storageArea.set({[key]: host});
}

async function mapSet(mapName, key, value, storageArea = browser.storage.local) {
    let map = await getObject(mapName, storageArea);
    map[key] = value;
    return storageArea.set({
        [mapName]: map
    });
}

async function mapGet(mapName, key, storageArea = browser.storage.local) {
    const map = await getObject(mapName, storageArea);
    return map[key];
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
    return setObjectProperties(host, {trusted: true, ...infoObj});
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
 * @param [host]
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

export async function getUnsupported() {
    const hosts = await getHost();
    return Object.fromEntries(Object.entries(hosts).filter(([, val]) => val.unsupported));
}

export async function removeUnsupported() {
    const hosts = await getUnsupported();
    return await Promise.all(Object.keys(hosts).map(async host => await removeHost(host)));
}

export async function setSSLKey(host, ssl_sha512) {
    return setObjectProperties(host, {ssl_sha512: ssl_sha512});
}

export async function getSSLKey(host) {
    return getObjectProperty(host, "ssl_sha512");
}

export async function removeSSLKey(host) {
    return removeObjectProperty(host, "ssl_sha512");
}

export async function getAttestationReport(host) {
    const ar_arrayBuffer = await getObjectProperty(host, "ar_arrayBuffer");
    if (!ar_arrayBuffer) return null;
    return new AttestationReport(ar_arrayBuffer);
}

export async function removeAttestationReport(host) {
    return removeObjectProperty(host, "ar_arrayBuffer");
}

export async function setMeasurementRepo(host, url) {
    await addMeasurementRepo(url);
    return setObjectProperties(host, {trusted_measurement_repo: url});
}

/**
 * returns the measurement repo belonging to the host or all repos if no host is supplied
 * @param [host]
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

/**
 * @param measurementRepo
 * @param [host]
 * @returns {Promise<*>}
 */
export async function removeMeasurementRepo(measurementRepo, host) {
    if (host) {
        return removeObjectProperty(host, measurementRepo);
    } else {
        const hosts = await getHost();
        await Promise.all(Object.entries(hosts)
            .filter(([, val]) => val.trusted_measurement_repo === measurementRepo)
            .map(async ([host,]) => await removeObjectProperty(host, "trusted_measurement_repo")));
        return arrayRemove(MEASUREMENT_REPOS, measurementRepo);
    }
}

export async function setAuthorKey(host, authorkey) {
    await addAuthorKey(authorkey);
    return setObjectProperties(host, {author_key: authorkey});
}

/**
 * returns the author key belonging to the host or all author keys if no host is supplied
 * @param [host]
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

/**
 * @param authorKey
 * @param [host]
 * @returns {Promise<*>}
 */
export async function removeAuthorKey(authorKey, host) {
    if (host) {
        return removeObjectProperty(host, authorKey);
    } else {
        const hosts = await getHost();
        await Promise.all(Object.entries(hosts)
            .filter(([, val]) => val.author_key === authorKey)
            .map(async ([host,]) => await removeObjectProperty(host, "author_key")));
        return arrayRemove(AUTHOR_KEYS, authorKey);
    }
}

export async function setConfigMeasurement(host, config_measurement) {
    return setObjectProperties(host, {config_measurement: config_measurement});
}

export async function getConfigMeasurement(host) {
    return getObjectProperty(host, "config_measurement");
}

export async function removeConfigMeasurement(host) {
    return removeObjectProperty(host, "config_measurement");
}

export async function setNonce(sessionId, nonce) {
    let sessionInfo = await mapGet(SESSIONS, sessionId, browser.storage.session);
    if (!sessionInfo) sessionInfo = {}; // if key is unknown, hostInfo would be undefined
    console.log("old sessionInfo is ", sessionInfo);
    sessionInfo.nonce = nonce;
    return mapSet(SESSIONS, sessionId, sessionInfo, browser.storage.session);
}

export async function getNonce(sessionId){
    const sessionInfo = await mapGet(SESSIONS, sessionId, browser.storage.session);
    return sessionInfo.nonce;
}

export async function setPendingAttestationInfo(host, attestationInfo) {
    let hostInfo = await mapGet(HOSTS, host, browser.storage.session);
    if (!hostInfo) hostInfo = {}; // if key is unknown, hostInfo would be undefined
    hostInfo = {...hostInfo, ...attestationInfo};
    return mapSet(HOSTS, host, hostInfo, browser.storage.session);
}

export async function getPendingAttestationInfo(host){
    return mapGet(HOSTS, host, browser.storage.session);
}

// TODO for testing only, has to be rewritten for production
export async function setLastRequestTarget(tabId, target) {
    // return setObjectProperties(tabId.toString(), {target: target}, browser.storage.session);
    return mapSet(TABS, tabId.toString(), target, browser.storage.session);
}

export async function getLastRequestTarget(tabId){
    // return getObjectProperty(tabId.toString(), "target", browser.storage.session);
    return mapGet(TABS, tabId.toString(), browser.storage.session);
}

export async function setCrl(architecture, crl_arrayBuffer) {
    return mapSet(CRLS, architecture, crl_arrayBuffer, browser.storage.local);
}

export async function getCrl(architecture){
    return mapGet(CRLS, architecture, browser.storage.local);
}

export async function setAwaitingRA(host, awaitingRA) {
    return setObjectProperties(host, {awaitingRA: awaitingRA}, browser.storage.session);
}

export async function getAwaitingRA(host) {
    return getObjectProperty(host, "awaitingRA", browser.storage.session);
}
