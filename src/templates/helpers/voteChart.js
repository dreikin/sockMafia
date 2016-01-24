'use strict';
const Handlebars = require('handlebars');

/*colors*/
const colors = {
	DARK_RED: '#560000',
	RED: '#AC1717',
	DARK_GREEN: '#005600',
	GREEN: '#617500',
	LIGHT_GREEN: '#B6CF3F',
	WHITE: '#FFFFFF'
};

module.exports = function(votes, modifier, toExecute) {
	let fillColor, bgColor;
	const percent = votes / (toExecute + modifier) * 100;
	const hammer = toExecute + modifier - votes  === 1;
	
	if (percent >= 100) {
		fillColor = colors.DARK_RED;
		bgColor = colors.RED;
	} else if (hammer) {
		//Hammer warning
		fillColor = colors.GREEN;
		bgColor = colors.LIGHT_GREEN;
	} else {
		fillColor = colors.DARK_GREEN;
		bgColor = colors.WHITE;
	}
	let xml = '<svg xmlns="http://www.w3.org/2000/svg" width="100" height="12">';
	xml += '<rect width="100%" height="100%" fill="' + bgColor + '"/>';
	xml += '<rect x="' + (100.0 - percent) + '%" width="' + percent + '" height="100%" fill="' + fillColor + '"/>';
	xml += '</svg>';
	
	const b64 = new Buffer(xml).toString('base64');
	const html = '<img src="data:image/svg+xml;base64,' + b64 + '">';
	return new Handlebars.SafeString(html);
};
