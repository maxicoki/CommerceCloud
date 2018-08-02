/**
* Description of the Controller and the logic it provides
*
* @module  controllers/Hello
*/
  
'use strict';

// HINT: do not put all require statements at the top of the file
// unless you really need them for all functions

/**
* Description of the function
*
* @return {String} The string 'myFunction'
*/

var ISML = require('dw/template/ISML');
var guard = require('storefront_controllers/cartridge/scripts/guard');

// var myFunction = function(){
//     return 'myFunction';
// }

/* Exports of the controller */
///**
// * @see {@link module:controllers/Hello~myFunction} */
//exports.MyFunction = myFunction;

function world()
{
	response.writer.print("<h1>Hello World</h1>");
}
exports.World=world;
exports.World.public=true;

function friend() 
{
	
	var friendName=request.httpParameterMap.name.stringValue;
	
	ISML.renderTemplate('hello', {fname:friendName});
}

exports.Friend=guard.ensure(['get'], friend);	//usando guard:


//exports.Friend=friend;	//sin usar guard
//exports.Friend.public=true;
