'use strict';
const Handlebars = require('handlebars');

module.exports = function(percent, numPlayers, toExecute) {
	let fillColor, bgColor;
	let murderPercent = (toExecute-1)/numPlayers;
	
	if (percent >= 100) {
		fillColor = '#560000';
		bgColor = '#AC1717';
	} else if (percent >= murderPercent) {
		fillColor = '#617500';
		bgColor = '#B6CF3F';
	} else {
		fillColor = '#005600';
		bgColor = '#FFFFFF';
	}
	let xml = '<svg xmlns="http://www.w3.org/2000/svg" width="100" height="12">';
	xml += '<rect width="100%" height="100%" fill="' + bgColor + '"/>';
	xml += '<rect x="' + (100.0 - percent) + '%" width="' + percent + '" height="100%" fill="' + fillColor + '"/>';
	xml += '</svg>';
	
	const b64 = new Buffer(xml).toString('base64');
	const html = '<img src="data:image/svg+xml;base64,' + b64 + '">';
	return new Handlebars.SafeString(html);
};
