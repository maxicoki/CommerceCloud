/**
* Description of the module and the logic it provides
*
* @module cartridge/scripts/myProductFinder
*/

'use strict';


//exports.find es lo mismo que hacer: exports.Find = guard.ensure(['get'], find);
exports.find=function(pid){
	var PGgr=require('dw/catalog/ProductMgr');
	return PGgr.getProduct(pid);
	
}
//si todo es correcto pero no obtengo el resultado deseado, debo debuggear.  Pagina 64 (si eclipse no me permite poner breakpoint
//debo abrir el archivo con UX).  Run/Debug configurations y crear una configuracion (solo 1 vez) para mi portal.  recargo pagina
//y veo el codigo n l eclipse (se abre solo el modo debug).