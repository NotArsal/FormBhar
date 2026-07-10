/**
 * Feature Flags Utility
 * 
 * Ship incomplete features behind flags so you can deploy without releasing.
 * Helps prevent long-lived branches.
 */

const FLAGS = {
    // Example: 'new-analytics-engine': false
};

/**
 * Checks if a feature flag is enabled.
 * @param {string} flagName 
 * @returns {boolean}
 */
const isFeatureEnabled = (flagName) => {
    return !!FLAGS[flagName];
};

module.exports = {
    isFeatureEnabled
};
