'use strict';

/**
 * @module models/authToken
 */

/**
 * Custom object name
 * @const {string}
 * @private
 */
const customObjectName = 'MarketingCloudAuthToken';
const helpers = require('../util/helpers');

/**
 * Retrieves cached token from custom object storage
 * If no existing token object, an empty one is created
 * @returns {dw.object.CustomAttributes} Returns token custom attributes
 */
function getObject() {
    var siteID = require('dw/system/Site').current.ID;
    return helpers.getCustomObject(customObjectName, siteID, true);
}

/**
 * Puts token into custom object storage
 * @param {Object} obj A plain JS object with the token
 * @returns {Object} Returns the same plain JS object
 */
function updateCachedTokenObject(obj) {
    var custObj = getObject();

    require('dw/system/Transaction').wrap(function(){
        custObj.token = JSON.stringify(obj);
    });

    return obj;
}

/**
 * Returns whether the stored token is valid
 * @returns {boolean} Whether the stored token is valid and not expired
 * @alias module:models/authToken~AuthToken#isValidAuth
 */
function isValidAuth() {
    if(!this.token || !this.token.accessToken){
        var cachedToken = getObject();
        if (!cachedToken || !cachedToken.token) {
            return false;
        }
        this.token = JSON.parse(cachedToken.token);
    }

    // check if expires is in the future
    return this.token && this.token.accessToken && this.token.expires > Date.now();
}

/**
 * Gets a valid token from storage or from a new auth request
 * @returns {boolean|Object} False or plain JS object containing the token response
 * @alias module:models/authToken~AuthToken#getValidToken
 */
function getValidToken() {
    if(!this.isValidAuth()){
        var result = require('dw/svc/ServiceRegistry').get('marketingcloud.rest.auth').call();
        if (result.status === 'OK' && result.object) {
            this.token = updateCachedTokenObject(result.object);
        }
    }

    return this.isValidAuth() && this.token;
}

/**
 * Token class for checking auth and retrieving valid token
 * @constructor
 * @alias module:models/authToken~AuthToken
 */
function AuthToken() {
    /**
     * Token object returned by Marketing Cloud
     * @type {Object}
     * @property {string} accessToken The token auth string
     * @property {number} expiresIn Expiration in seconds, relative to when requested
     * @property {number} issued Date issued in milliseconds
     * @property {number} expires Date expires in milliseconds
     */
    this.token = null;
}

/**
 * @alias module:models/authToken~AuthToken#prototype
 */
AuthToken.prototype = {
    isValidAuth: function isValid(){
        return isValidAuth.apply(this);
    },

    getValidToken: function getValid(){
        return getValidToken.apply(this);
    }
};

module.exports = AuthToken;
