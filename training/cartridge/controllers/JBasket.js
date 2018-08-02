/**
* Description of the Controller and the logic it provides
*
* @module  controllers/JBasket
*/

'use strict';



var ISML = require('dw/template/ISML');
var guard = require('storefront_controllers/cartridge/scripts/guard');
var BasketMgr = require('dw/order/BasketMgr'); 


function start() {
	
	//import BasketMgr
	
	var basket=BasketMgr.currentBasket;
	
	ISML.renderTemplate('showBasket', {Basket:basket});
	
	
}
exports.Start = guard.ensure(['get'], start);
