'use strict';
const Handlebars = require('handlebars');

module.exports = function(percent) {
	let html = '<svg > <rect x="0" y="0" width="100" height="12" style="fill:none;stroke-width:1;stroke:rgb(0,0,0)"/>';
	html += '<rect x="0" y="0" width="' + percent + '" height="12" style="fill:rgb(0,0,0)"/>';
	html += '</svg>';
	return new Handlebars.SafeString(html);
};
