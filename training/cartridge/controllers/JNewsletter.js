/**
* Description of the Controller and the logic it provides
*
* @module  controllers/JNewsletter
*/

'use strict';


var ISML = require('dw/template/ISML');
var guard = require('storefront_controllers/cartridge/scripts/guard');


var myForm = session.forms.newsletter;

function renderForm() {
	
	//le paso el parametro JNewsletter-Handle que seria el action
	ISML.renderTemplate('newsletter/newslettersignup', {ContinueURL: dw.web.URLUtils.https('JNewsletter-Handle')});
}

function start() {
	//clear the form
	myForm.clearFormElement();
	
	//render the form (llamar a la funcion que creé)
	renderForm();
}
exports.Start = guard.ensure(['get'], start);

//guardo el form en BBDD con un objeto creado x mi (custom) llamado 'NewsletterSubscription'
//lo he creado en: Merchant Tools >  Custom Objects >  Custom Objects
function handle() {
	
	//if form is not valid, render the form again....
	if (request.triggeredFormAction==null) {  //se valida el Form completo
		renderForm();
		return;
	}

	//Check the button
	if (request.triggeredFormAction.formId=='subscribe') {  //se valida el Form completo
		
		//Log 4j
		//el log lo veré (x mi prefix) en: Administration >  Site Development >  Development Setup > Log Files > 
		//https://student43-training-eu07-dw.demandware.net/on/demandware.servlet/webdav/Sites/Logs > ... (buscar el prefix 'maxi')
		
		var Logger=require('dw/system/Logger');
		var log=Logger.getLogger('maxi', 'newsletter');  //maxi  es mi local prefix, newsletter es el nombre del log (administration/operation/custom logger)
		log.debug('newsletter form Input  {0}, {1}, {2}', myForm.fname.value,myForm.lname.value,myForm.email.value);
		
		var Transaction=require('dw/system/Transaction');	//Transaction
		Transaction.begin(); //Transaction Starts
		
		try {
			
			//Create a newsletter instance
			var COMgr=require('dw/object/CustomObjectMgr')
			var nli=COMgr.createCustomObject('NewsletterSubscription', myForm.email.value);
			
			//update this instance (name by name) or can i use databinding
			//nli.custom.FirstName=myForm.fname.value; //el objeto es 'custom'.  
			//nli.custom.LastName=myForm.lname.value;
			
			//data binding
			myForm.copyTo(nli);
			
			//Commit
			Transaction.commit();
			
			//form ok
			ISML.renderTemplate('newsletter/newslettersuccess');
			return;
		} catch(e) {
			log.info('Error form newsletter: {0}' + e.causeMessage);
		
			Transaction.rollback(); //Transaction rollback
			
			//create value error
			myForm.email.invalidateFormElement();   //se escribe mensaje en el campo email (ver newsletter.xml: value-error="forms.contactus.email.value-error" )
			
			//render the form
			renderForm();
		};
		
		
	}
	
	//
}
exports.Handle = guard.ensure(['post'], handle);
