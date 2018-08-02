'use strict';

/* API Includes */
var Resource = require('dw/web/Resource');
var URLUtils = require('dw/web/URLUtils');
var logger = require('dw/system/Logger').getLogger('Adyen', 'adyen');
var OrderMgr = require('dw/order/OrderMgr');
var BasketMgr = require('dw/order/BasketMgr');
var Site = require('dw/system/Site');
var Status = require('dw/system/Status');
var Transaction = require('dw/system/Transaction');


/* Script Modules */
var app = require('storefront_controllers/cartridge/scripts/app');
var guard = require('storefront_controllers/cartridge/scripts/guard');
//var app = require('~/cartridge/scripts/app');
//var guard = require('~/cartridge/scripts/guard');

var AdyenHelper = require('int_adyen/cartridge/scripts/util/AdyenHelper');

var OrderModel = app.getModel('Order');

/**
 * Controller for all storefront processes.
 *
 * @module controllers/Adyen
 */

/**
 * Called by Adyen to update status of payments. It should always display [accepted] when finished.
 */
function notify() {
    var	checkAuth = require('int_adyen/cartridge/scripts/checkNotificationAuth');
	
    var status = checkAuth.check(request);
    if (!status) {
    	app.getView().render('error');
    	return {};
	}

	var	handleNotify = require('int_adyen/cartridge/scripts/handleNotify');
	Transaction.wrap(function () {
   		handleNotify.notify(request.httpParameterMap);
	});
	app.getView().render('notify');
}

/**
 * Redirect to Adyen after saving order etc.
 */
function redirect(order) {
	var	adyenVerificationSHA256 = require('int_adyen/cartridge/scripts/adyenRedirectVerificationSHA256'),
	result;
	
	Transaction.wrap(function () {
		result = adyenVerificationSHA256.verify({
			'Order': order,
			'OrderNo': order.orderNo,
			'CurrentSession' : session,
			'CurrentUser' : customer,
			'PaymentInstrument' : order.paymentInstrument,
			'brandCode': session.custom.brandCode,
			'issuerId' : request.httpParameterMap.issuerId.value,
			'dob' : session.forms.adyPaydata.dob.value,
			'gender' : session.forms.adyPaydata.gender.value,
			'houseNumber' : session.forms.adyPaydata.houseNumber.value,
			'houseExtension' : session.forms.adyPaydata.houseExtension.value,
			'personalNumber' : session.forms.adyPaydata.personalNumber.value,
			'ratePayFingerprint' : session.custom.ratePayFingerprint,
			'adyenFingerprint' : session.forms.adyPaydata.adyenFingerprint.value
		});
	});
	if (result === PIPELET_ERROR) {
		app.getView().render('error');
    	return {};
	}
	
	var pdict = {
		'merchantSig' :	result.merchantSig,
		'Amount100' : result.Amount100,
		'shopperEmail' : result.shopperEmail,
		'shopperReference' : result.shopperReference,
		'ParamsMap' : result.paramsMap,
		'SessionValidity' : result.sessionValidity,
		'Order': order,
		'OrderNo': order.orderNo
	};

	app.getView(pdict).render('redirect_sha256');
}

/**
 * Show confirmation after return from Adyen
 */
function showConfirmation() {
	var order = null;
	if (request.httpParameterMap.isParameterSubmitted('merchantReference')) {
		order = OrderMgr.getOrder(request.httpParameterMap.merchantReference.toString());
		var adyenOrderPaymentInstrument = AdyenHelper.getAdyenOrderPaymentInstrument(order);
		if (adyenOrderPaymentInstrument) {
			var transaction = adyenOrderPaymentInstrument.getPaymentTransaction();
			Transaction.wrap(function () {
				AdyenHelper.saveAuthResponseAttributes(transaction, request.httpParameterMap);
			});
		}
	}
	
	/*	AUTHORISED: The payment authorisation was successfully completed.
		REFUSED: The payment was refused. Payment authorisation was unsuccessful.
		CANCELLED: The payment was cancelled by the shopper before completion, or the shopper returned to the merchant's site before completing the transaction.
		PENDING: It is not possible to obtain the final status of the payment.
		This can happen if the systems providing final status information for the payment are unavailable, or if the shopper needs to take further action to complete the payment.
		ERROR: An error occurred during the payment processing.
	*/
	if (request.httpParameterMap.authResult.value != 'CANCELLED') {

		var requestMap = new Array();
		for(var item in request.httpParameterMap) {
			requestMap[item] = request.httpParameterMap.get(item).getStringValue();
		}
		
		var	authorizeConfirmation = require('int_adyen/cartridge/scripts/authorizeConfirmationCallSHA256');
    	var authorized = authorizeConfirmation.authorize(requestMap);
    	if (!authorized) {
    		app.getController('Error').Start();
    		return {};
    	}
	}
	
	if (!order) {
		app.getController('Error').Start();
		return {};
	}
	
	//AUTHORISED: The payment authorisation was successfully completed.
	if (request.httpParameterMap.authResult.value == 'AUTHORISED' || request.httpParameterMap.authResult.value == 'PENDING') {
		pendingPayment(order);
		app.getController('COSummary').ShowConfirmation(order);
		return {};
	}
	
	if (order.status != dw.order.Order.ORDER_STATUS_CREATED) {
		// If the same order is tried to be cancelled more than one time, show Error page to user
		if (request.httpParameterMap.authResult.value == 'CANCELLED') {
			app.getController('Error').Start();
		} else {
			// TODO: check is there should be errro value { PlaceOrderError: pdict.PlaceOrderError }
			app.getController('COSummary').Start();
		}
		return {};
	}
	
	// Handle Cancelled or Refused payments
	cancelledPayment(order);
	refusedPayment(order);
	// fail order
	Transaction.wrap(function () {
		OrderMgr.failOrder(order);
	});
	
	// should be assingned by previous calls or not
	var errorStatus = new dw.system.Status(dw.system.Status.ERROR, "confirm.error.declined");
	
	app.getController('COSummary').Start({
            PlaceOrderError: errorStatus
        });
    return {};
}

/**
 * Make a request to Adyen to get payment methods based on countryCode. Called from COBilling-Start
 */
function getPaymentMethods(cart) {
    // TODO: check is that used CSE Enabled (AdyenCseEnabled) Site.getCurrent().getCustomPreferenceValue("AdyenCseEnabled");
    // Site.getCurrent().getCustomPreferenceValue("Adyen_directoryLookup")
    if (Site.getCurrent().getCustomPreferenceValue("Adyen_directoryLookup")) {
        var	getPaymentMethods = require('int_adyen/cartridge/scripts/getPaymentMethodsSHA256');
        return getPaymentMethods.getMethods(cart.object);
    }
    return {};
}

/**
 * Make a request to Adyen to get payment methods based on countryCode. Meant for AJAX storefront requests
 */
function getPaymentMethodsJSON() {
	var cart = app.getModel('Cart').get();
    if (Site.getCurrent().getCustomPreferenceValue("Adyen_directoryLookup")) {
    	var	getPaymentMethods = require('int_adyen/cartridge/scripts/getPaymentMethodsSHA256');
    	var json = JSON.stringify(getPaymentMethods.getMethods(cart.object, request.httpParameterMap.country.getStringValue()));
    }
    app.getView({
        hppJson: json || {}
    }).render('hppjson');
}

/**
 * Get configured terminals  
 */
function getTerminals() {
	var terminals = Site.getCurrent().getCustomPreferenceValue("Adyen_multi_terminals");
   	return terminals;
}

/**
 * Get orderdata for the Afterpay Payment method
 */
function afterpay() {
	var	readOpenInvoiceRequest = require('int_adyen/cartridge/scripts/readOpenInvoiceRequest');
   	var invoice = readOpenInvoiceRequest.getInvoiceParams(request.httpParameterMap);
   	var order = OrderMgr.getOrder(invoice.penInvoiceReference);
   	// show error if data mismach
   	if ((order.getBillingAddress().getPostalCode() !=  request.httpParameterMap.pc.toString())
   	 || (order.getBillingAddress().getPhone() !=  request.httpParameterMap.pn.toString())
   	 || (order.getCustomerNo() != request.httpParameterMap.cn.toString())
   	 || (order.getCustomerEmail() != request.httpParameterMap.ce.toString())
   	 || (invoice.openInvoiceAmount != Math.round(order.totalGrossPrice * 100)))
   	{
   		app.getView().render('afterpayerror');
   		return {};
   	}
   	
   	var	buildOpenInvoiceResponse = require('int_adyen/cartridge/scripts/buildOpenInvoiceResponse');
   	var invoiceResponse = buildOpenInvoiceResponse.getInvoiceResponse(order);
   	app.getView({OpenInvoiceResponse:invoiceResponse}).render('afterpay');
}


/**
 * Handle Refused payments
 */
function refusedPayment(order) {
    if (request.httpParameterMap.authResult.value == 'REFUSED') {
		var	adyenHppRefusedPayment = require('int_adyen/cartridge/scripts/adyenHppRefusedPayment.ds');
		Transaction.wrap(function () {
			adyenHppRefusedPayment.handle(request.httpParameterMap, order);
		});
    	
	}
	return '';
}


/**
 * Handle payments Cancelled on Adyen HPP
 */
function cancelledPayment(order) {
    if (request.httpParameterMap.authResult.value == 'CANCELLED') {
		var	adyenHppCancelledPayment = require('int_adyen/cartridge/scripts/adyenHppCancelledPayment');
		Transaction.wrap(function () {
			adyenHppCancelledPayment.handle(request.httpParameterMap, order);
		});
	}
	return '';
}


/**
 * Handle payments Pending on Adyen HPP
 */
function pendingPayment(order) {
	if (request.httpParameterMap.authResult.value == 'PENDING') {
		var	adyenHppPendingPayment = require('int_adyen/cartridge/scripts/adyenHppPendingPayment');
		Transaction.wrap(function () {
			adyenHppPendingPayment.handle(request.httpParameterMap, order);
		});
	}
	return '';
}


/**
 * Call the Adyen API to capture order payment
 */
function capture(args) {
	var order = args.Order;
	var orderNo = args.OrderNo;
	
	if (!order) {
		// Checking order data against values from parameters
		order = OrderMgr.getOrder(orderNo);
		if (!order || order.getBillingAddress().getPostalCode() !=  session.custom.pc.toString() 
			|| order.getBillingAddress().getPhone() !=  session.custom.pn.toString() 
			|| order.getCustomerNo() != session.custom.cn.toString() 
			|| order.getCustomerEmail() != session.custom.ce.toString()) {
			return {error: true};
		}
	}

	
	var	adyenCapture = require('int_adyen/cartridge/scripts/adyenCapture'), result;
    Transaction.wrap(function () {
		result = adyenCapture.capture(order);
	});
	
	if (result === PIPELET_ERROR) {
		return {error: true};
	}
	
    return {sucess: true};
}


/**
 * Call the Adyen API to cancel order payment
 */
function cancel() {
    var order = args.Order;
	var orderNo = args.OrderNo;
	
	if (!order) {
		// Checking order data against values from parameters
		order = OrderMgr.getOrder(orderNo);
		if (!order || order.getBillingAddress().getPostalCode() !=  session.custom.pc.toString() 
			|| order.getBillingAddress().getPhone() !=  session.custom.pn.toString() 
			|| order.getCustomerNo() != session.custom.cn.toString() 
			|| order.getCustomerEmail() != session.custom.ce.toString()) {
			return {error: true};
		}
	}

	
	var	adyenCancel = require('int_adyen/cartridge/scripts/adyenCancel'), result;
    Transaction.wrap(function () {
		result = adyenCancel.cancel(order);
	});
	
	if (result === PIPELET_ERROR) {
		return {error: true};
	}
	
    return {sucess: true};
}


/**
 * Call the Adyen API to cancel or refund order payment
 */
function cancelOrRefund() {
    var order = args.Order;
	var orderNo = args.OrderNo;
	
	if (!order) {
		// Checking order data against values from parameters
		order = OrderMgr.getOrder(orderNo);
		if (!order || order.getBillingAddress().getPostalCode() !=  session.custom.pc.toString() 
			|| order.getBillingAddress().getPhone() !=  session.custom.pn.toString() 
			|| order.getCustomerNo() != session.custom.cn.toString() 
			|| order.getCustomerEmail() != session.custom.ce.toString()) {
			return {error: true};
		}
	}

	
	var	adyenCapture = require('int_adyen/cartridge/scripts/adyenCapture'), result;
    Transaction.wrap(function () {
		result = adyenCapture.capture(order);
	});
	
	if (result === PIPELET_ERROR) {
		return {error: true};
	}
	
    return {sucess: true};
}

/**
 * Make second call to 3d verification system to complete authorization 
 * 
 * @returns redering template or error
 */
function authorizeWithForm()
{
	var	adyen3DVerification = require('int_adyen/cartridge/scripts/adyen3DVerification'), result,
	order = session.custom.order,
	paymentInstrument = session.custom.paymentInstrument,
	adyenResponse  = session.custom.adyenResponse;
	clearCustomSessionFields();
	
	Transaction.begin();
	result = adyen3DVerification.verify({
		Order: order,
		Amount: paymentInstrument.paymentTransaction.amount,
		PaymentInstrument: paymentInstrument,
		CurrentSession: session,
		CurrentRequest: request,
		MD: adyenResponse.MD,
		PaResponse: adyenResponse.PaRes
	});
	
    if (result.error || result.Decision != 'ACCEPT') {
    	Transaction.rollback();
    	Transaction.wrap(function () {
			OrderMgr.failOrder(order);
		});
		app.getController('COSummary').Start({
            PlaceOrderError: new Status(Status.ERROR, 'confirm.error.declined', '')
        });
		return;
    }
    
	order.setPaymentStatus(dw.order.Order.PAYMENT_STATUS_PAID);
	order.setExportStatus(dw.order.Order.EXPORT_STATUS_READY);
	paymentInstrument.paymentTransaction.transactionID = result.RequestToken;
    Transaction.commit();
	
    OrderModel.submit(order);
	clearForms();
	app.getController('COSummary').ShowConfirmation(order);
}

/**
 * Close IFrame where was 3d secure form
 * 
 * @returns template
 */
function closeIFrame() {
	var adyenResponse = {
			MD : request.httpParameterMap.get("MD").stringValue,
			PaRes : request.httpParameterMap.get("PaRes").stringValue
	}
	session.custom.adyenResponse = adyenResponse;
    app.getView({
        ContinueURL: URLUtils.https('Adyen-AuthorizeWithForm')
    }).render('adyenpaymentredirect');
}

/**
 * Clear system session data 
 */
function clearForms() {
    // Clears all forms used in the checkout process.
    session.forms.singleshipping.clearFormElement();
    session.forms.multishipping.clearFormElement();
    session.forms.billing.clearFormElement();
    
    clearCustomSessionFields();
}

/**
 * Clear custom session data 
 */
function clearCustomSessionFields() {
	// Clears all fields used in the 3d secure payment.
    session.custom.adyenResponse = null;
    session.custom.paymentInstrument = null;
    session.custom.order = null;
    session.custom.adyenBrandCode = null;
    session.custom.adyenIssuerID = null;
}

exports.AuthorizeWithForm = guard.ensure(['https', 'post'], authorizeWithForm);

exports.CloseIFrame = guard.ensure(['https', 'post'], closeIFrame);

exports.Notify = guard.ensure(['post'], notify);

exports.Redirect = redirect;

exports.Afterpay = guard.ensure(['get'], afterpay);

exports.ShowConfirmation = guard.httpsGet(showConfirmation);

exports.GetPaymentMethods = getPaymentMethods;

exports.GetPaymentMethodsJSON = guard.ensure(['get'], getPaymentMethodsJSON);

exports.GetTerminals = getTerminals;

exports.RefusedPayment = refusedPayment;

exports.CancelledPayment = cancelledPayment;

exports.PendingPayment = pendingPayment;

exports.Capture = capture;

exports.Cancel = cancel;

exports.CancelOrRefund = cancelOrRefund;