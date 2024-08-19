{
	"translatorID": "8a21d731-4330-4aa4-8e43-87a4da048f32",
	"label": "CNSDA",
	"creator": "jiaojiaodubai",
	"target": "^http://www\\.cnsda\\.org",
	"minVersion": "5.0",
	"maxVersion": "",
	"priority": 100,
	"inRepository": true,
	"translatorType": 4,
	"browserSupport": "gcsibv",
	"lastUpdated": "2024-02-26 08:37:30"
}

/*
    ***** BEGIN LICENSE BLOCK *****

    Copyright © 2024 jiaojiaodubai<jiaojiaodubai23@gmail.com>

    This file is part of Zotero.

    Zotero is free software: you can redistribute it and/or modify
    it under the terms of the GNU Affero General Public License as published by
    the Free Software Foundation, either version 3 of the License, or
    (at your option) any later version.

    Zotero is distributed in the hope that it will be useful,
    but WITHOUT ANY WARRANTY; without even the implied warranty of
    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
    GNU Affero General Public License for more details.

    You should have received a copy of the GNU Affero General Public License
    along with Zotero. If not, see <http://www.gnu.org/licenses/>.

    ***** END LICENSE BLOCK *****
*/


function detectWeb(doc, url) {
	if (url.includes('id=')) {
		return 'dataset';
	}
	else if (getSearchResults(doc, true)) {
		return 'multiple';
	}
	return false;
}

function getSearchResults(doc, checkOnly) {
	var items = {};
	var found = false;
	var rows = doc.querySelectorAll('.items > li > a');
	for (let row of rows) {
		let href = row.href;
		let title = ZU.trimInternal(row.textContent);
		if (!href || !title) continue;
		if (checkOnly) return true;
		found = true;
		items[href] = title;
	}
	return found ? items : false;
}

async function doWeb(doc, url) {
	if (detectWeb(doc, url) == 'multiple') {
		let items = await Zotero.selectItems(getSearchResults(doc, false));
		if (!items) return;
		for (let url of Object.keys(items)) {
			await scrape(await requestDocument(url));
		}
	}
	else {
		await scrape(doc, url);
	}
}

async function scrape(doc, url = doc.location.href) {
	let labels = new Labels(doc, 'tbody > tr');
	Z.debug(labels.innerData.map(arr => [arr[0], ZU.trimInternal(arr[1].innerText)]));
	var newItem = new Z.Item('dataset');
	newItem.title = text(doc, '.article > h2');
	newItem.abstractNote = labels.get('摘要');
	newItem.identifier = labels.get('编号');
	// 使用项目的执行时间作为发布时间
	newItem.date = ZU.strToISO(labels.get('执行时间'));
	newItem.DOI = labels.get('DOI');
	newItem.url = labels.get('网址') || url;
	newItem.libraryCatalog = '中国学术调查数据资料库';
	newItem.language = /[\u4e00-\u9fff]/.test(newItem.title) ? 'zh-CN' : 'en-US';
	labels.get('项目负责机构/负责人').replace(/([\u4e00-\u9fff]),\s?([\u4e00-\u9fff])/g, '$1$2').split(/[;，；]\s?/)
.forEach((creator) => {
	creator = ZU.cleanAuthor(creator, 'author');
	if (/[\u4e00-\u9fff]/.test(creator.lastName)) {
		creator.lastName = creator.firstName + creator.lastName;
		creator.firstName = '';
		creator.fildMode = 1;
	}
	newItem.creators.push(creator);
});
	// 数据集可能较大，而且需要权限，因此不作为附件下载
	newItem.attachments.push({
		title: 'Snapshot',
		document: doc
	});
	newItem.tags = labels.get('关键字').split(/[,;，;]\s?/);
	newItem.complete();
}

class Labels {
	constructor(doc, selector) {
		this.data = [];
		this.emptyElm = doc.createElement('div');
		Array.from(doc.querySelectorAll(selector))
			// avoid nesting
			.filter(element => !element.querySelector(selector))
			// avoid empty
			.filter(element => !/^\s*$/.test(element.textContent))
			.forEach((element) => {
				const elmCopy = element.cloneNode(true);
				// avoid empty text
				while (/^\s*$/.test(elmCopy.firstChild.textContent)) {
					// Z.debug(elementCopy.firstChild.textContent);
					elmCopy.removeChild(elmCopy.firstChild);
					// Z.debug(elementCopy.firstChild.textContent);
				}
				if (elmCopy.childNodes.length > 1) {
					const key = elmCopy.removeChild(elmCopy.firstChild).textContent.replace(/\s/g, '');
					this.data.push([key, elmCopy]);
				}
				else {
					const text = ZU.trimInternal(elmCopy.textContent);
					const key = tryMatch(text, /^[[【]?.+?[】\]:：]/).replace(/\s/g, '');
					elmCopy.textContent = tryMatch(text, /^[[【]?.+?[】\]:：]\s*(.+)/, 1);
					this.data.push([key, elmCopy]);
				}
			});
	}

	get(label, element = false) {
		if (Array.isArray(label)) {
			const results = label
				.map(aLabel => this.get(aLabel, element));
			const keyVal = element
				? results.find(element => !/^\s*$/.test(element.textContent))
				: results.find(string => string);
			return keyVal
				? keyVal
				: element
					? this.emptyElm
					: '';
		}
		const pattern = new RegExp(label, 'i');
		const keyVal = this.data.find(arr => pattern.test(arr[0]));
		return keyVal
			? element
				? keyVal[1]
				: ZU.trimInternal(keyVal[1].textContent)
			: element
				? this.emptyElm
				: '';
	}
}

function tryMatch(string, pattern, index = 0) {
	if (!string) return '';
	const match = string.match(pattern);
	return (match && match[index])
		? match[index]
		: '';
}

/** BEGIN TEST CASES **/
var testCases = [
	{
		"type": "web",
		"url": "http://www.cnsda.org/index.php?r=projects/view&id=65635422",
		"items": [
			{
				"itemType": "dataset",
				"title": "中国综合社会调查（2021）",
				"creators": [
					{
						"firstName": "",
						"lastName": "李路路",
						"creatorType": "author",
						"fildMode": 1
					},
					{
						"firstName": "",
						"lastName": "中国人民大学中国调查与数据中心",
						"creatorType": "author",
						"fildMode": 1
					}
				],
				"date": "2021",
				"abstractNote": "中国综合社会调查（Chinese General Social Survey，CGSS）始于2003年，是我国最早的全国性、综合性、连续性学术调查项目。CGSS系统、全面的收集社会、社区、家庭、个人多个层次的数据，总结社会变迁的趋势，探讨具有重大科学和现实意义的议题，推动国内科学研究的开放与共享，为国际比较研究提供数据资料，充当多学科的经济与社会数据采集平台。",
				"identifier": "65635422",
				"language": "zh-CN",
				"libraryCatalog": "中国学术调查数据资料库",
				"url": "http://www.cnsda.org/index.php?r=projects/view&id=65635422",
				"attachments": [
					{
						"title": "Snapshot",
						"mimeType": "text/html"
					}
				],
				"tags": [
					{
						"tag": "cgss"
					},
					{
						"tag": "价值观"
					},
					{
						"tag": "健康"
					},
					{
						"tag": "劳动力"
					},
					{
						"tag": "女性"
					},
					{
						"tag": "家庭"
					},
					{
						"tag": "截面调查"
					},
					{
						"tag": "男性"
					},
					{
						"tag": "职业"
					}
				],
				"notes": [],
				"seeAlso": []
			}
		]
	},
	{
		"type": "web",
		"url": "http://www.cnsda.org/index.php?r=projects/view&id=33209974",
		"items": [
			{
				"itemType": "dataset",
				"title": "Chinese Household Income Project, 1988",
				"creators": [
					{
						"firstName": "DSDR/Griffin",
						"lastName": "Keith",
						"creatorType": "author"
					},
					{
						"firstName": "Renwei",
						"lastName": "Zhao",
						"creatorType": "author"
					}
				],
				"date": "1989",
				"abstractNote": "The purpose of this project was to measure and estimate the distribution of income in both rural and urban areas of the People's Republic of China. The principal investigators based their definition of income on cash payments and on a broad range of additional components: payments in kind valued at market prices, agricultural output produced for self-consumption valued at market prices, the value of ration coupons and other direct subsidies, and the imputed value of housing. The rural component of this collection consists of two data files, one in which the individual is the unit of analysis and a second in which the household is the unit of analysis. Individual rural respondents reported on their employment status, level of education, Communist Party membership, type of employer (e.g., public, private, or foreign), type of economic sector in which employed, occupation, whether they held a second job, retirement status, monthly pension, monthly wage, and other sources of income. Demographic variables include relationship to householder, gender, age, and student status. Rural households reported extensively on the character of the household and residence. Information was elicited on type of terrain surrounding the house, geographic position, type of house, and availability of electricity. Also reported were sources of household income (e.g., farming, industry, government, rents, and interest), taxes paid, value of farm, total amount and type of cultivated land, financial assets and debts, quantity and value of various crops (e.g., grains, cotton, flax, sugar, tobacco, fruits and vegetables, tea, seeds, nuts, lumber, livestock and poultry, eggs, fish and shrimp, wool, honey, and silkworm cocoons), amount of grain purchased or provided by a collective, use of chemical fertilizers, gasoline, and oil, quantity and value of agricultural machinery, and all household expenditures (e.g., food, fuel, medicine, education, transportation, and electricity). The urban component of this collection also consists of two data files, one in which the individual is the unit of analysis and a second in which the household is the unit of analysis. Individual urban respondents reported on their economic status within the household, Communist Party membership, sex, age, nature of employment, and relationship to the household head. Information was collected on all types and sources of income from each member of the household whether working, nonworking, or retired, all revenue received by owners of private or individual enterprises, and all in-kind payments (e.g., food and durable and non-durable goods). Urban households reported total income (including salaries, interest on savings and bonds, dividends, rent, leases, alimony, gifts, and boarding fees), all types and values of food rations received, and total debt. Information was also gathered on household accommodations and living conditions, including number of rooms, total living area in square meters, availability and cost of running water, sanitary facilities, heating and air-conditioning equipment, kitchen availability, location of residence, ownership of home, and availability of electricity and telephone. Households reported on all of their expenditures including amounts spent on food items such as wheat, rice, edible oils, pork, beef and mutton, poultry, fish and seafood, sugar, and vegetables by means of both coupons in state-owned stores and at free market prices. Information was also collected on rents paid by the households, fuel available, type of transportation used, and availability and use of medical and child care. The Chinese Household Income Project collected data in 1988, 1995, 2002, and 2007. ICPSR holds data from the first three collections, and information about these can be found on the series description page. Data collected in 2007 are available through the China Institute for Income Distribution.",
				"identifier": "33209974",
				"language": "en-US",
				"libraryCatalog": "中国学术调查数据资料库",
				"url": "http://www.icpsr.umich.edu/icpsrweb/ICPSR/studies/9836?geography=China+%28Peoples+Republic%29",
				"attachments": [
					{
						"title": "Snapshot",
						"mimeType": "text/html"
					}
				],
				"tags": [
					{
						"tag": "agriculture"
					},
					{
						"tag": "cash payments"
					},
					{
						"tag": "child care"
					},
					{
						"tag": "debt"
					},
					{
						"tag": "demographic characteristics"
					},
					{
						"tag": "educational background"
					},
					{
						"tag": "electric utilities"
					},
					{
						"tag": "employers"
					},
					{
						"tag": "employment"
					},
					{
						"tag": "farms"
					},
					{
						"tag": "financial assets"
					},
					{
						"tag": "food"
					},
					{
						"tag": "food production"
					},
					{
						"tag": "home ownership"
					},
					{
						"tag": "household income"
					},
					{
						"tag": "housing construction"
					},
					{
						"tag": "income"
					},
					{
						"tag": "income distribution"
					},
					{
						"tag": "interest (finance)"
					},
					{
						"tag": "livestock"
					},
					{
						"tag": "living conditions"
					},
					{
						"tag": "medical care"
					},
					{
						"tag": "occupations"
					},
					{
						"tag": "pensions"
					},
					{
						"tag": "rental housing"
					},
					{
						"tag": "retirement income"
					},
					{
						"tag": "rural areas"
					},
					{
						"tag": "sanitation"
					},
					{
						"tag": "taxes"
					},
					{
						"tag": "transportation"
					},
					{
						"tag": "urban areas"
					},
					{
						"tag": "wages and salaries"
					}
				],
				"notes": [],
				"seeAlso": []
			}
		]
	},
	{
		"type": "web",
		"url": "http://www.cnsda.org/index.php?r=projects/index",
		"items": "multiple"
	}
]

/** END TEST CASES **/
