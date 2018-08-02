/**
* Description of the Controller and the logic it provides
*
* @module  controllers/JShowProduct
*/

'use strict';
/** @module controllers/JShowProduct */

var ISML = require('dw/template/ISML');
var guard = require('storefront_controllers/cartridge/scripts/guard');

// HINT: do not put all require statements at the top of the file
// unless you really need them for all functions

/**
* Description of the function
*
* @return {String} The string 'myFunction'
*/
// var myFunction = function(){
//     return 'myFunction';
// }

/* Exports of the controller */
///**
// * @see {@link module:controllers/JShowProduct~myFunction} */
//exports.MyFunction = myFunction;

function start() {
	var parameterId =request.httpParameterMap.pid.stringValue;
	
	//import ProductMgr    aqui es donde estan definidas las funcionalidades del producto (api)
	var ProductMgr = require('dw/catalog/ProductMgr');  
	
	var product = ProductMgr.getProduct(parameterId);
	
	if (product != null) {
		//a renderTemplate le envio el 2do parametro como name:valor (name lo defino en el template resultante, valor lo defino en esta funcion)
		ISML.renderTemplate('product/productfound', {myProduct:product});
	} else {
		var mymessage = 'product with id '+parameterId+' not found';
		ISML.renderTemplate('product/productnotfound', {ismlmessage:mymessage});
	}
	
}
exports.Start = guard.ensure(['get'], start);


//invoco una funcion definida por mi  dentro de un modulo tambien definido x mi (myProductFinder)
function startmyownmodule() {
	
	var parameterId=request.httpParameterMap.pid.stringValue;
	var ProductMgr = require('~/cartridge/scripts/myProductFinder');  
	var product = ProductMgr.find(parameterId);
	
	if (product != null) {
		ISML.renderTemplate('product/productfound', {myProduct:product});
		
		//puedo usar bundle (locale) para mostrar mensajes
		//ISML.renderTemplate('product/productfound', {myProduct:product,....a:b,c:d,dw....message:product});
		
	} else {
		var mymessage = 'product with id '+parameterId+' not found';
		ISML.renderTemplate('product/productnotfound', {ismlmessage:mymessage});
	}
}

exports.Startmyownmodule = guard.ensure(['get'], startmyownmodule);
