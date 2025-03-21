/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

import { XPCOMUtils } from "resource://gre/modules/XPCOMUtils.sys.mjs";

const lazy = {};

ChromeUtils.defineESModuleGetters(lazy, {
  getFrecentRecentCombinedUrls:
    "resource://gre/modules/contentrelevancy/private/InputUtils.sys.mjs",
  NimbusFeatures: "resource://nimbus/ExperimentAPI.sys.mjs",
  RelevancyStore: "resource://gre/modules/RustRelevancy.sys.mjs",
  InterestVector: "resource://gre/modules/RustRelevancy.sys.mjs",
});

XPCOMUtils.defineLazyServiceGetter(
  lazy,
  "timerManager",
  "@mozilla.org/updates/timer-manager;1",
  "nsIUpdateTimerManager"
);

// Constants used by `nsIUpdateTimerManager` for a cross-session timer.
const TIMER_ID = "content-relevancy-timer";
const PREF_TIMER_LAST_UPDATE = `app.update.lastUpdateTime.${TIMER_ID}`;
const PREF_TIMER_INTERVAL = "toolkit.contentRelevancy.timerInterval";
// Set the timer interval to 1 day for validation.
const DEFAULT_TIMER_INTERVAL_SECONDS = 1 * 24 * 60 * 60;

// Default maximum input URLs to fetch from Places.
const DEFAULT_MAX_URLS = 100;
// Default minimal input URLs for clasification.
const DEFAULT_MIN_URLS = 0;

// File name of the relevancy database
const RELEVANCY_STORE_FILENAME = "content-relevancy.sqlite";

// Nimbus variables
const NIMBUS_VARIABLE_ENABLED = "enabled";
const NIMBUS_VARIABLE_MAX_INPUT_URLS = "maxInputUrls";
const NIMBUS_VARIABLE_MIN_INPUT_URLS = "minInputUrls";
const NIMBUS_VARIABLE_TIMER_INTERVAL = "timerInterval";
const NIMBUS_VARIABLE_INGEST_ENABLED = "ingestEnabled";

ChromeUtils.defineLazyGetter(lazy, "log", () => {
  return console.createInstance({
    prefix: "ContentRelevancyManager",
    maxLogLevel: Services.prefs.getBoolPref(
      "toolkit.contentRelevancy.log",
      false
    )
      ? "Debug"
      : "Error",
  });
});

class RelevancyManager {
  get initialized() {
    return this.#initialized;
  }

  /**
   * Init the manager. An update timer is registered if the feature is enabled.
   * The pref observer is always set so we can toggle the feature without restarting
   * the browser.
   *
   * Note that this should be called once only. `#enable` and `#disable` can be
   * used to toggle the feature once the manager is initialized.
   */
  init() {
    if (this.initialized) {
      return;
    }

    lazy.log.info("Initializing the manager");

    if (this.shouldEnable) {
      this.#enable();
    }

    this._nimbusUpdateCallback = this.#onNimbusUpdate.bind(this);
    // This will handle both Nimbus updates and pref changes.
    lazy.NimbusFeatures.contentRelevancy.onUpdate(this._nimbusUpdateCallback);
    this.#initialized = true;
  }

  uninit() {
    if (!this.initialized) {
      return;
    }

    lazy.log.info("Uninitializing the manager");

    lazy.NimbusFeatures.contentRelevancy.offUpdate(this._nimbusUpdateCallback);
    this.#disable();

    this.#initialized = false;
  }

  /**
   * Determine whether the feature should be enabled based on prefs and Nimbus.
   */
  get shouldEnable() {
    return (
      lazy.NimbusFeatures.contentRelevancy.getVariable(
        NIMBUS_VARIABLE_ENABLED
      ) ?? false
    );
  }

  #startUpTimer() {
    // Log the last timer tick for debugging.
    const lastTick = Services.prefs.getIntPref(PREF_TIMER_LAST_UPDATE, 0);
    if (lastTick) {
      lazy.log.debug(
        `Last timer tick: ${lastTick}s (${
          Math.round(Date.now() / 1000) - lastTick
        })s ago`
      );
    } else {
      lazy.log.debug("Last timer tick: none");
    }

    const interval =
      lazy.NimbusFeatures.contentRelevancy.getVariable(
        NIMBUS_VARIABLE_TIMER_INTERVAL
      ) ??
      Services.prefs.getIntPref(
        PREF_TIMER_INTERVAL,
        DEFAULT_TIMER_INTERVAL_SECONDS
      );
    lazy.timerManager.registerTimer(
      TIMER_ID,
      this,
      interval,
      interval != 0 // Do not skip the first timer tick for a zero interval for testing
    );
  }

  get #storePath() {
    return PathUtils.join(
      Services.dirsvc.get("ProfLD", Ci.nsIFile).path,
      RELEVANCY_STORE_FILENAME
    );
  }

  #enable() {
    if (!this.#_store) {
      // Init the relevancy store.
      const path = this.#storePath;
      lazy.log.info(`Initializing RelevancyStore: ${path}`);

      try {
        this.#_store = lazy.RelevancyStore.init(path);
      } catch (error) {
        lazy.log.error(`Error initializing RelevancyStore: ${error}`);
        return;
      }
    }

    this.#startUpTimer();
  }

  /**
   * The reciprocal of `#enable()`, ensure this is safe to call when you add
   * new disabling code here. It should be so even if `#enable()` hasn't been
   * called.
   */
  #disable() {
    if (this._isStoreReady) {
      this.#_store.close();
      this.#_store = null;
    }
    lazy.timerManager.unregisterTimer(TIMER_ID);
  }

  #toggleFeature() {
    if (this.shouldEnable) {
      this.#enable();
    } else {
      this.#disable();
    }
  }

  /**
   * nsITimerCallback
   */
  notify() {
    lazy.log.info("Background job timer fired");
    this.#doClassification();
  }

  get isInProgress() {
    return this.#isInProgress;
  }

  /**
   * Perform classification based on browsing history.
   *
   * It will fetch up to `DEFAULT_MAX_URLS` (or the corresponding Nimbus value)
   * URLs from top frecent URLs and use most recent URLs as a fallback if the
   * former is insufficient. The returned URLs might be fewer than requested.
   *
   * The classification will not be performed if the total number of input URLs
   * is less than `DEFAULT_MIN_URLS` (or the corresponding Nimbus value).
   *
   * @param {object} options
   *   options.minUrlsForTest {number} A minimal URL count used only for testing.
   */
  async #doClassification(options = {}) {
    if (this.isInProgress) {
      lazy.log.info(
        "Another classification is in progress, aborting interest classification"
      );
      return;
    }

    // Set a flag indicating this classification. Ensure it's cleared upon early
    // exit points & success.
    this.#isInProgress = true;

    let timerId;

    try {
      lazy.log.info("Fetching input data for interest classification");

      const maxUrls =
        lazy.NimbusFeatures.contentRelevancy.getVariable(
          NIMBUS_VARIABLE_MAX_INPUT_URLS
        ) ?? DEFAULT_MAX_URLS;
      const minUrls =
        lazy.NimbusFeatures.contentRelevancy.getVariable(
          NIMBUS_VARIABLE_MIN_INPUT_URLS
        ) ??
        options.minUrlsForTest ??
        DEFAULT_MIN_URLS;
      const urls = await lazy.getFrecentRecentCombinedUrls(maxUrls);
      if (urls.length < minUrls) {
        lazy.log.info("Aborting interest classification: insufficient input");
        Glean.relevancyClassify.fail.record({ reason: "insufficient-input" });
        return;
      }

      lazy.log.info("Starting interest classification");
      timerId = Glean.relevancyClassify.duration.start();

      const interestVector = await this.#doClassificationHelper(urls);
      const sortedVector = Object.entries(interestVector).sort(
        ([, a], [, b]) => b - a // descending
      );
      lazy.log.info(`Classification results: ${JSON.stringify(sortedVector)}`);

      Glean.relevancyClassify.duration.stopAndAccumulate(timerId);
      Glean.relevancyClassify.succeed.record({
        input_size: urls.length,
        input_classified_size: sortedVector.reduce((acc, [, v]) => acc + v, 0),
        input_inconclusive_size: interestVector.inconclusive,
        output_interest_size: sortedVector.filter(([, v]) => v != 0).length,
        interest_top_1_hits: sortedVector[0][1],
        interest_top_2_hits: sortedVector[1][1],
        interest_top_3_hits: sortedVector[2][1],
      });
    } catch (error) {
      let reason;

      if (error instanceof StoreNotAvailableError) {
        lazy.log.error("#store became null, aborting interest classification");
        reason = "store-not-ready";
      } else {
        lazy.log.error("Classification error: " + (error.reason ?? error));
        reason = "component-errors";
      }
      Glean.relevancyClassify.fail.record({ reason });
      Glean.relevancyClassify.duration.cancel(timerId); // No error is recorded if `start` was not called.
    } finally {
      this.#isInProgress = false;
    }

    lazy.log.info("Finished interest classification");
  }

  /**
   * Exposed for testing.
   */
  async _test_doClassification(options = {}) {
    await this.#doClassification(options);
  }

  /**
   * Classification helper. Use the getter `this.#store` rather than `#_store`
   * to access the store so that when it becomes null, a `StoreNotAvailableError`
   * will be raised. Likewise, other store related errors should be propagated
   * to the caller if you want to perform custom error handling in this helper.
   *
   * @param {Array} urls
   *   An array of URLs.
   * @returns {InterestVector}
   *   An interest vector.
   * @throws {StoreNotAvailableError}
   *   Thrown when the store became unavailable (i.e. set to null elsewhere).
   * @throws {RelevancyAPIError}
   *   Thrown for other API errors on the store.
   */
  async #doClassificationHelper(urls) {
    lazy.log.info("Classification input: " + urls);

    let interestVector = new lazy.InterestVector({
      animals: 0,
      arts: 0,
      autos: 0,
      business: 0,
      career: 0,
      education: 0,
      fashion: 0,
      finance: 0,
      food: 0,
      government: 0,
      hobbies: 0,
      home: 0,
      news: 0,
      realEstate: 0,
      society: 0,
      sports: 0,
      tech: 0,
      travel: 0,
      inconclusive: 0,
    });

    if (
      lazy.NimbusFeatures.contentRelevancy.getVariable(
        NIMBUS_VARIABLE_INGEST_ENABLED
      ) ??
      false
    ) {
      interestVector = await this.#store.ingest(urls);
    }

    return interestVector;
  }

  /**
   * Internal getter for `#_store` used by for classification. It will throw
   * a `StoreNotAvailableError` is the store is not ready.
   */
  get #store() {
    if (!this._isStoreReady) {
      throw new StoreNotAvailableError("Store is not available");
    }

    return this.#_store;
  }

  /**
   * Whether or not the store is ready (i.e. not null).
   */
  get _isStoreReady() {
    return !!this.#_store;
  }

  /**
   * Nimbus update listener.
   */
  #onNimbusUpdate(_event, _reason) {
    this.#toggleFeature();
  }

  // The `RustRelevancy` store.
  #_store;

  // Whether or not the module is initialized.
  #initialized = false;

  // Whether or not there is an in-progress classification. Used to prevent
  // duplicate classification tasks.
  #isInProgress = false;
}

/**
 * Error raised when attempting to access a null store.
 */
class StoreNotAvailableError extends Error {
  constructor(message, ...params) {
    super(message, ...params);
    this.name = "StoreNotAvailableError";
  }
}

export var ContentRelevancyManager = new RelevancyManager();
