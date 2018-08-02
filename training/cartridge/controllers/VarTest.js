/**
* Description of the Controller and the logic it provides
*
* @module  controllers/VarTest
*/

'use strict';
var ISML = require('dw/template/ISML');
var guard = require('storefront_controllers/cartridge/scripts/guard');



function start() {
	
	ISML.renderTemplate('vartest');
	
}

exports.Start = guard.ensure(['get'], start);