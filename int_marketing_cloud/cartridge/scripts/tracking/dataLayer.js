'use strict';

/**
 * @type {dw.system.Site}
 */
const Site = require('dw/system/Site');
/**
 * @type {dw.template.Velocity}
 */
const velocity = require('dw/template/Velocity');

var analyticsEnabled = false;

var dataLayer = {
    setOrgId: null,
    setUserInfo: null,
    trackPageView: null,
    trackCart: null,
    trackConversion: null,
    trackEvents: [],
    updateItems: []
};

(function mcDataLayerInit(){
    var curSite = Site.current;
    analyticsEnabled = !!(curSite.getCustomPreferenceValue('mcEnableAnalytics'));
    if (analyticsEnabled) {
        if (empty(dataLayer.setOrgId)) {
            dataLayer.setOrgId = curSite.getCustomPreferenceValue('mcMID');
        }
        // disable analytics if MID not configured
        analyticsEnabled = !empty(dataLayer.setOrgId);
    }
})();

/**
 * Build customer data for setUserInfo
 * @param {Object} requestData
 * @returns {{email: string}}
 */
function buildCustomer(requestData) {
    var customerInfo = {
        email: customer.ID
        //, details: {}
    };
    if (!empty(customer.profile)) {
        customerInfo.email = customer.profile.email;
        var customDetails = buildCustomEvent('setUserInfo', {
            RequestData: requestData,
            Customer: customer,
            Profile: customer.profile,
            Session: session
        }).details;
        if (!empty(customDetails)) {
            customerInfo.details = customDetails;
        }
    }
    return customerInfo;
}

/**
 * Builds basket object
 * @returns {{cart: object}|{clear_cart: boolean}}
 */
function buildBasket() {
    /**
     * @type {dw.order.Basket}
     */
    var basket = require('dw/order/BasketMgr').currentBasket;
    var basketInfo = {};
    if (basket.allProductLineItems.length > 0) {
        basketInfo.cart = buildCartItems(basket.allProductLineItems);
    } else {
        basketInfo.clear_cart = true;
    }
    return basketInfo;
}

/**
 * Builds order object
 * @param {string} orderID
 * @returns {{cart, order_number: *, discount: number, shipping: number}}
 */
function buildOrder(orderID) {
    /**
     * @type {dw.order.Order}
     */
    var order = require('dw/order/OrderMgr').getOrder(orderID);
    var merchTotalExclOrderDiscounts = order.getAdjustedMerchandizeTotalPrice(false);
    var merchTotalInclOrderDiscounts = order.getAdjustedMerchandizeTotalPrice(true);
    var orderDiscount = merchTotalExclOrderDiscounts.subtract( merchTotalInclOrderDiscounts );
    var orderInfo = {
        cart: buildCartItems(order.allProductLineItems),
        order_number: orderID,
        discount: orderDiscount.valueOrNull,
        shipping: order.adjustedShippingTotalPrice.valueOrNull
    };
    var customDetails = buildCustomEvent('trackConversion', {Order: order}).details;
    if (!empty(customDetails)) {
        orderInfo.details = customDetails;
    }
    return orderInfo;
}

/**
 * Build cart items, used by both buildBasket and buildOrder
 * @param {dw.util.Collection} lineItems
 * @returns {Array<Object>}
 */
function buildCartItems(lineItems) {
    var cart = [];
    var pli;
    for (var item in lineItems) {
        pli = lineItems[item];
        cart.push(buildLineItem(pli));
    }
    return cart;
}

/**
 * Build product line items
 * @param {dw.order.ProductLineItem} pli
 * @returns {Object}
 */
function buildLineItem(pli) {
    var URLUtils = require('dw/web/URLUtils');
    var groupID = pli.product && pli.product.variant ? pli.product.masterProduct.ID : pli.productID;
    return {
        item: groupID,
        unique_id: pli.productID,
        name: pli.lineItemText,
        url: URLUtils.abs('Product-Show', 'pid', pli.productID).toString(),
        // image_url: '',
        // available: true,
        price: pli.basePrice.valueOrNull,
        sale_price: pli.proratedPrice.valueOrNull,
        // review_count: '',
        item_type: 'product'
    };
}

/**
 * Builds event details using custom mapping
 * @param {string} eventID
 * @param {Object} dataObject
 * @returns {{name: string, details: Object|null}}
 */
function buildCustomEvent(eventID, dataObject) {
    /**
     * @type {module:models/analytic~AnalyticEvent}
     */
    const AnalyticEvent = require('../models/analytic');
    var event = new AnalyticEvent(eventID);

    if (event.isEnabled()) {
        return {
            name: event.customEventName || eventID,
            details: event.trackEvent(dataObject)
        };
    } else {
        return {
            name: eventID,
            details: null
        }
    }
}

/**
 * Registered hook for app.tracking.trackCached
 */
function trackCached() {
    var mcInject = "<!-- Marketing Cloud Analytics - cached -->\n" +
        "<script type=\"text/javascript\">\n" +
        "try {\n" +
        "\t_etmc.push(['setOrgId', $dataLayer.setOrgId ]);\n" +
        "} catch (e) { console.error(e); }\n" +
        "</script>\n" +
        "<!-- End Marketing Cloud Analytics - cached -->\n";

    var jsonLayer = {};
    for (var i in dataLayer) {
        if (dataLayer.hasOwnProperty(i) && dataLayer[i]) {
            jsonLayer[i] = JSON.stringify(dataLayer[i]);
        }
    }

    velocity.render(mcInject, {dataLayer: jsonLayer});
}

/**
 * Registered hook for app.tracking.preEvents
 * @param {Object} requestData
 */
function eventsInit(requestData) {
    dataLayer.setUserInfo = buildCustomer(requestData);
}

/**
 * Registered hook for app.tracking.event
 * @param {string} eventName
 * @param {*} eventValue
 * @param {Object} requestData
 */
function requestEvent(eventName, eventValue, requestData) {
    var customDetails;
    switch(eventName) {
        case 'search':
            if (empty(dataLayer.trackPageView)) {
                dataLayer.trackPageView = {
                    search: eventValue
                };
            }
            break;
        case 'category':
            if (empty(dataLayer.trackPageView)) {
                dataLayer.trackPageView = {
                    category: eventValue
                };
            }
            break;
        case 'content':
            if (empty(dataLayer.trackPageView)) {
                dataLayer.trackPageView = {
                    item: eventValue
                };
                var contentAsset = require('dw/content/ContentMgr').getContent(eventValue);
                if (!empty(contentAsset)) {
                customDetails = buildCustomEvent('updateContent', {
                        RequestData: requestData,
                        Content: contentAsset
                    }).details;
                    if (!empty(customDetails)) {
                        dataLayer.updateItems.push(customDetails);
                    }
                }
            }
            break;
        case 'product':
            if (empty(dataLayer.trackPageView)) {
                dataLayer.trackPageView = {
                    item: eventValue
                };
                var product = require('dw/catalog/ProductMgr').getProduct(eventValue);
                if (!empty(product)) {
                    var defProduct;
                    if (product.isMaster() || product.isVariationGroup()) {
                        defProduct = product.getVariationModel().getDefaultVariant();
                    } else if (product.isVariant()) {
                        defProduct = product.getMasterProduct();
                    }
                    customDetails = buildCustomEvent('updateProduct', {
                        RequestData: requestData,
                        Product: product,
                        DefaultProduct: defProduct, // master, variation group, or default variant
                        ProductLink: require('dw/web/URLUtils').abs('Product-Show', 'pid', product.ID).https(),
                        ImageLink: function imageLink(cfg, data) {
                            if (cfg.hasOwnProperty('imageType')) {
                                var img = data.Product.getImage(cfg.imageType);
                                if (img) {
                                    return img.absURL.https().toString();
                                }
                            }
                        },
                        StandardPrice: function standardPrice(cfg, data) {
                            var stdPrice;
                            var priceModel;

                            if (!empty(data.Product.getPriceModel())) {
                                priceModel = data.Product.getPriceModel();
                            }
                            if (empty(priceModel) || !priceModel.price.available) {
                                if (!data.Product.isMaster() && data.Product.getMasterProduct() && !empty(data.Product.masterProduct.getPriceModel())) {
                                    priceModel = data.Product.masterProduct.getPriceModel();
                                } else if (data.Product.isMaster() || data.Product.isVariationGroup()) {
                                    priceModel = data.Product.getVariationModel().getDefaultVariant().getPriceModel();
                                }
                            }

                            if (!empty(priceModel) && priceModel.price.available) {
                                var priceBook = priceModel.priceInfo.priceBook;

                                while (priceBook.parentPriceBook) {
                                    priceBook = priceBook.parentPriceBook ? priceBook.parentPriceBook : priceBook;
                                }

                                stdPrice = priceModel.getPriceBookPrice(priceBook.ID);
                                return stdPrice.decimalValue;
                            }
                            // ensuring not sending "undefined" to velocity
                            return null;
                        },
                        SalePrice: function salePrice(cfg, data) {
                            var priceModel;

                            if (!empty(data.Product.getPriceModel())) {
                                priceModel = data.Product.getPriceModel();
                            }
                            if (empty(priceModel) || !priceModel.price.available) {
                                if (!data.Product.isMaster() && data.Product.getMasterProduct() && !empty(data.Product.masterProduct.getPriceModel())) {
                                    priceModel = data.Product.masterProduct.getPriceModel();
                                } else if (data.Product.isMaster() || data.Product.isVariationGroup()) {
                                    priceModel = data.Product.getVariationModel().getDefaultVariant().getPriceModel();
                                }
                            }

                            if (!empty(priceModel) && priceModel.price.available) {
                                return priceModel.price.decimalValue;
                            }
                            // ensuring not sending "undefined" to velocity
                            return null;
                        }
                    }).details;
                    if (!empty(customDetails)) {
                        dataLayer.updateItems.push(customDetails);
                    }
                }
            }
            break;
        case 'basketUpdated':
            if (empty(dataLayer.trackCart)) {
                dataLayer.trackCart = buildBasket();
            }
            break;
        case 'orderConfirmation':
            if (empty(dataLayer.trackConversion)) {
                dataLayer.trackConversion = buildOrder(eventValue);
            }
            break;
    }

    var customEvent = buildCustomEvent(eventName, {
        EventName: eventName,
        EventValue: eventValue,
        RequestData: requestData,
        Session: session,
        Customer: customer,
        Basket: require('dw/order/BasketMgr').currentBasket
    });
    if (!empty(customEvent.details)) {
        dataLayer.trackEvents.push(customEvent);

        // copy mapped custom event into customer details as well
        // this is a workaround for trackEvents not being fully fleshed out on MC side
        if (!empty(dataLayer.setUserInfo.details)) {
            for (var ev in customEvent.details) {
                if (customEvent.details.hasOwnProperty(ev)) {
                    if (!(ev in dataLayer.setUserInfo.details)) {
                        dataLayer.setUserInfo.details[ev] = customEvent.details[ev];
                    }
                }
            }
        } else {
            dataLayer.setUserInfo.details = customEvent.details;
        }
    }
}

/**
 * Registered hook for app.tracking.postEvents
 * @param {Object} requestData
 */
function eventsOutput(requestData) {
    var mcInject = "<!-- Marketing Cloud Analytics - noncached -->\n" +
        "<script type=\"text/javascript\">\n" +
        "try {\n";

    if (!requestData.request.isAjaxPartial) {
        if (!empty(dataLayer.setUserInfo)) {
            mcInject += "\t_etmc.push(['setUserInfo', $dataLayer.setUserInfo ]);\n";
        }
        if (!empty(dataLayer.updateItems)) {
            mcInject += "\t_etmc.push(['updateItem', $dataLayer.updateItems ]);\n";
        }
    }
    if (!empty(dataLayer.trackConversion)) {
        mcInject += "\t_etmc.push(['trackConversion', $dataLayer.trackConversion ]);\n";
    } else if (!empty(dataLayer.trackCart)) {
        mcInject += "\t_etmc.push(['trackCart', $dataLayer.trackCart ]);\n";
    }
    if (!empty(dataLayer.trackEvents)) {
        mcInject += "#foreach($event in $dataLayer.trackEvents)\n\t_etmc.push(['trackEvent', $event ]);\n#end\n";
    }
    if (!requestData.request.isAjaxPartial) {
        if (!empty(dataLayer.trackPageView)) {
            mcInject += "\t_etmc.push(['trackPageView', $dataLayer.trackPageView ]);\n";
        } else {
            mcInject += "\t_etmc.push(['trackPageView']);\n";
        }
    }

    mcInject += "} catch (e) { console.error(e); }\n" +
        //"console.log(_etmc);\n" +
        "</script>\n" +
        "<!-- End Marketing Cloud Analytics - noncached -->\n";

    var jsonLayer = {};
    for (var i in dataLayer) {
        if (dataLayer.hasOwnProperty(i) && dataLayer[i]) {
            if (i === 'trackEvents' && Array.isArray(dataLayer[i])) {
                jsonLayer[i] = dataLayer[i].map(function(e){return JSON.stringify(e);});
            } else {
                jsonLayer[i] = JSON.stringify(dataLayer[i]);
            }
        }
    }

    velocity.render(mcInject, {dataLayer: jsonLayer});
}

// Ensure MC Analytics hooks only fire if analytics are enabled
if (analyticsEnabled) {
    exports.trackCached = trackCached;
    exports.preEvents = eventsInit;
    exports.event = requestEvent;
    exports.postEvents = eventsOutput;
} else {
    exports.trackCached = function(){};
    exports.preEvents = function(){};
    exports.event = function(){};
    exports.postEvents = function(){};
}
