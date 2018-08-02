/**
* Description of the Controller and the logic it provides
*
* @module  controllers/JCall
*/

'use strict';
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
// * @see {@link module:controllers/JCall~myFunction} */
//exports.MyFunction = myFunction;

function start() {
	var myParam=request.httpParameterMap.name.stringValue;
		
	if (myParam != null) {
		ISML.renderTemplate('call/jnotempty', {miparametro:myParam});
	} else{
		ISML.renderTemplate('call/jempty');
	}
}
exports.Start=guard.ensure(['get'], start);
