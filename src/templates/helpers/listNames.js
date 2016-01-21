'use strict';
const Handlebars = require('handlebars');

const slugs = [
	'slug',
	'snail',
	'randomBSForDiscourse',
	'shoutOutToCodingHorror',
	'bodge',
	'stupidHack',
	'iJustMetYouAndILoveYou',
	'isAnyoneReadingThis',
	'nativeAmericanShootingAStar',
	'freeIpads',
	'easterEgg',
	'upupdowndownleftrightleftrightbastart',
	'discourse-sucks-purple-monkey-balls',
	'donateToAGDQ',
	'stillABetterLoveStoryThanTwilight'
];

module.exports = function(list) {
	list = list.map((value) => {
		if (typeof value === 'object') {
			if (value.retracted) {
				value = '<a href="/t/' + slugs[Math.floor(Math.random() * slugs.length)] + '/' + value.game + '/' + value.post + '"><s>' + value.voter + '</s></a>';
			} else {
				value = '<a href="/t/' + slugs[Math.floor(Math.random() * slugs.length)] + '/' + value.game + '/' + value.post + '">' + value.voter + '</a>';
			}
		}
		return value;
	});
	return new Handlebars.SafeString(list.join(', '));
};
