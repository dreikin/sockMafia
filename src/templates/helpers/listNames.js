'use strict';
const Handlebars = require('handlebars');

module.exports = function(list) {
	list = list.map((value) => {
		if (typeof value === 'object') {
			if (value.retracted) {
				value = '<s>' + value.voter + '</s>';
			} else {
				value = value.voter;
			}
		}
		return value;
	});
	return new Handlebars.SafeString(list.join(', '));
};
