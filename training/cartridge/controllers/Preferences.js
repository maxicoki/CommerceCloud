'use strict';

/** @module controllers/JEditPreferences */

var ISML = require('dw/template/ISML');
var guard = require('storefront_controllers/cartridge/scripts/guard');

/*************************************************** **************   
 * 
	Use require syntax to get URLUtils from dw.web package 
 * ************** ************** ************** ************** */

var URLUtils = require('dw/web/URLUtils');


/*************************************************** **************   
 Use quickcard section “Handling Forms” to get Form object named myForm from the
 meta data named preferences
*
************** ************** ************** */

var myForm = session.forms.preferences;

function edit() {
	
	//Clear
	
	//Fill
	
	//Render
	
	myForm.clearFormElement();
	myForm.copyFrom(customer.profile); // UpdateFormWithObject
	
	ISML.renderTemplate('newsletter/editpreferences', {
		ContinueURL : dw.web.URLUtils.https('Preferences-HandleForm')
	});
}


exports.Edit = guard.ensure([ 'get', 'https', 'loggedIn' ], edit); //tengo que estar logueado 

function handleForm() {

	
	//log.debug('preferences form Input  {0}, {1}, {2}', 
	//		myForm.preferences.apparel.value,myForm.preferences.electronics.value,myForm.preferencies.newsletter.value);
	
	var Transaction=require('dw/system/Transaction');
		
		
	Transaction.wrap(function() {
		myForm.accept(); // en 'edit' llené el form.  aqui acepto los campos. (reemplaza a copyto)
	})

	response.redirect(URLUtils.https('Account-Show'));
	
}


exports.HandleForm = guard.ensure([ 'post', 'https', 'loggedIn' ], handleForm);
