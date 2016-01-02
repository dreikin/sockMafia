'use strict';
const Handlebars = require('handlebars');

module.exports = function(percent) {
	let xml = '<svg xmlns="http://www.w3.org/2000/svg" width="110" height="15"> <rect x="0" y="0" width="100" height="12" style="fill:none;stroke-width:1;stroke:rgb(0,0,0)"/>';
	xml += '<rect x="0" y="0" width="' + percent + '" height="12" style="fill:rgb(0,0,0)"/>';
	xml += '</svg>';
	
	const b64 = new Buffer(xml).toString('base64');
	const html = '<img src="data:image/svg+xml;base64,' + b64 + '">';
	return new Handlebars.SafeString(html);
};
