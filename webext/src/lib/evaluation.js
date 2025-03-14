/**
 * @param {string} name
 * @param {Object} details
 */
export function pmark(name, details) {
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
export function pmeasure(name, startMark, details, endMark) {
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
