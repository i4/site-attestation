const ALL_URLS = "https://*/*";

browser.webRequest.onBeforeRequest.addListener(details => {
    console.log(details.url);
    pmark("onBeforeRequest", details);
}, {urls: [ALL_URLS]}, ["blocking"]);

browser.webRequest.onCompleted.addListener(details => {
    pmark("onCompleted", details);
    pmeasure("webRequest", "onBeforeRequest", details, "onCompleted");
    const performanceTimeStamps =
        performance.getEntriesByType("measure").map(en => {
            return {...en.toJSON(), detail: en.detail};
        });
    // console.log(performanceTimeStamps);
    console.log(JSON.stringify(performanceTimeStamps));
}, {urls: [ALL_URLS]});

/**
 * @param {string} name
 * @param {Object} details
 */
function pmark(name, details) {
    const requestId = (details.requestId) ? details.requestId : "";
    return performance.mark(name + requestId, {
        detail: {
            name: name,
            url: details.url,
            requestId: requestId
        }
    });
}

/**
 * @param {string} name
 * @param {string} startMark
 * @param {Object} details
 * @param {string} [endMark]
 */
function pmeasure(name, startMark, details, endMark) {
    const requestId = (details.requestId) ? details.requestId : "";
    let options = {
        start: startMark + requestId,
        detail: {
            name: name,
            url: details.url,
            requestId: requestId
        }
    };
    if (endMark) options =
        {
            ...options,
            end: endMark + requestId,
        };
    return performance.measure(name + requestId, options);
}
