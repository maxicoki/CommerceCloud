'use strict';

/**
 * @type {dw.system.Site}
 */
const Site = require('dw/system/Site');
const ArrayList = require('dw/util/ArrayList');

var mailingListsEnabled = false;

(function mcMailingListsInit(){
    mailingListsEnabled = !!(Site.current.getCustomPreferenceValue('mcEnableMailingLists'));
})();

function subscribe(subscriberData) {
    var defaultLists = (new ArrayList(Site.current.getCustomPreferenceValue('mcDefaultMailingLists'))).toArray();
    var subscriber = require('int_marketing_cloud').subscriber(subscriberData);
    var lists = empty(subscriberData.lists) ? defaultLists : lists;
    if (lists instanceof ArrayList) {
        lists = lists.toArray();
    }
    subscriber.assignLists(lists);
    return subscriber.commit();
}

function unsubscribe(subscriberData) {
    var defaultLists = (new ArrayList(Site.current.getCustomPreferenceValue('mcDefaultMailingLists'))).toArray();
    var subscriber = require('int_marketing_cloud').subscriber(subscriberData);
    var lists = empty(subscriberData.lists) ? defaultLists : lists;
    if (lists instanceof ArrayList) {
        lists = lists.toArray();
    }
    subscriber.unassignLists(lists);
    return subscriber.commit();
}

// Ensure hooks only fire if enabled
if (mailingListsEnabled) {
    exports.subscribe = subscribe;
    exports.unsubscribe = unsubscribe;
} else {
    exports.subscribe = function(){};
    exports.unsubscribe = function(){};
}
