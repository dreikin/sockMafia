'use strict';
/*globals describe, it*/

const chai = require('chai'),
	sinon = require('sinon');
	
//promise library plugins
require('sinon-as-promised');
const chaiAsPromised = require('chai-as-promised');
chai.use(chaiAsPromised);

chai.should();
const expect = chai.expect;

const Handlebars = require('handlebars');

const listNamesHelper = require('../src/templates/helpers/listNames');
const voteChartHelper = require('../src/templates/helpers/voteChart');


describe('View helpers', () => {

	let sandbox, notificationSpy, commandSpy;
	beforeEach(() => {
		sandbox = sinon.sandbox.create();
	});
	
	afterEach(() => {
		sandbox.restore();
	});

	describe('listNames()', () => {	
		beforeEach(() => {
			sandbox.stub(Math, 'random').returns(0);
		});
	
		it('Should one player without a comma', () => {
			const input = [{
				game: 123,
				post: 43,
				voter: 'yamikuronue'
			}];
			const output = listNamesHelper(input).toString();
			output.should.contain('yamikuronue');
			output.should.not.contain(',');
		});
		
		it('Should link to the post', () => {
			const input = [{
				game: 123,
				post: 43,
				voter: 'yamikuronue'
			}];
			listNamesHelper(input).toString().should.contain('/t/slug/123/43');
		});
		
		it('Should bold current posts', () => {
			const input = [{
				game: 123,
				post: 43,
				voter: 'yamikuronue'
			}];
			listNamesHelper(input).toString().should.contain('<b>');
			listNamesHelper(input).toString().should.contain('</b>');
		});
		
		it('Should strikeout retracted posts', () => {
			const input = [{
				game: 123,
				post: 43,
				voter: 'yamikuronue',
				retracted: true,
				retractedAt: 44
			}];
			listNamesHelper(input).toString().should.contain('<s>');
			listNamesHelper(input).toString().should.contain('</s>');
		});
		
		it('Should link to the retraction', () => {
			const input = [{
				game: 123,
				post: 43,
				voter: 'yamikuronue',
				retracted: true,
				retractedAt: 44
			}];
			listNamesHelper(input).toString().should.contain('/t/slug/123/44');
		});

		it('Should list two votes with a comma', () => {
			const input = [{
				game: 123,
				post: 43,
				voter: 'yamikuronue'
			},
			{
				game: 123,
				post: 47,
				voter: 'accalia'
			}];
			listNamesHelper(input).toString().should.contain('/t/slug/123/43');
			listNamesHelper(input).toString().should.contain('/t/slug/123/47');
			listNamesHelper(input).toString().should.contain(',');
			listNamesHelper(input).toString().should.contain('yamikuronue');
			listNamesHelper(input).toString().should.contain('accalia');
		});
	});
	
	describe('listNames()', () => {	
		
		const colors = {
			DARK_RED: '#560000',
			RED: '#AC1717',
			DARK_GREEN: '#005600',
			GREEN: '#617500',
			LIGHT_GREEN: '#B6CF3F',
			WHITE: '#FFFFFF'
		};

		function decode(string) {
			const capture = /<img src="data:image\/svg\+xml;base64,(.+)">/i;
			const b64 = capture.exec(string)[1];
			return new Buffer(b64, 'base64').toString('ascii');
		}
		
		it('Should produce a 100x12 image', () => {
			const output = decode(voteChartHelper(1, 0, 12).toString());
			output.should.contain('<svg xmlns="http://www.w3.org/2000/svg" width="100" height="12">');
		});
		
		it('Should fill the right percent of the bar for vanila', () => {
			let output = decode(voteChartHelper(1, 0, 2).toString());
			output.should.contain('<rect x="50%" width="50" height="100%"');
			
			output = decode(voteChartHelper(1, 0, 4).toString());
			output.should.contain('<rect x="75%" width="25" height="100%"');
			
			output = decode(voteChartHelper(3, 0, 4).toString());
			output.should.contain('<rect x="25%" width="75" height="100%"');
		});
		
		it('Should fill normal votes with green on white', () => {
			const output = decode(voteChartHelper(1, 0, 12).toString());
			output.should.contain('fill="' + colors.DARK_GREEN);
			output.should.contain('fill="' + colors.WHITE);
		});
		
		it('Should fill hammer with green on light green', () => {
			const output = decode(voteChartHelper(11, 0, 12).toString());
			output.should.contain('fill="' + colors.GREEN);
			output.should.contain('fill="' + colors.LIGHT_GREEN);
		});
		
		it('Should fill dead with dark red on red', () => {
			const output = decode(voteChartHelper(12, 0, 12).toString());
			output.should.contain('fill="' + colors.DARK_RED);
			output.should.contain('fill="' + colors.RED);
		});
		
		it('Should show dead when hated is in hammer', () => {
			const output = decode(voteChartHelper(11, -1, 12).toString());
			output.should.contain('fill="' + colors.DARK_RED);
			output.should.contain('fill="' + colors.RED);
		});
		
		it('Should fill hammer when loved is dead', () => {
			const output = decode(voteChartHelper(12, +1, 12).toString());
			output.should.contain('fill="' + colors.GREEN);
			output.should.contain('fill="' + colors.LIGHT_GREEN);
		});
		
		it('Should reveal loved', () => {
			const output = decode(voteChartHelper(1, +1, 3).toString());
			output.should.contain('<rect x="75%" width="25" height="100%"');
		});
		
		it('Should reveal hated', () => {
			const output = decode(voteChartHelper(1, -1, 5).toString());
			output.should.contain('<rect x="75%" width="25" height="100%"');
		});
	});
});
