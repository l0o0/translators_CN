{
	"translatorID": "e35f1704-5f0e-40db-8565-a6c5284e3681",
	"label": "China Social Science Library",
	"creator": "jiaojiaodubai",
	"target": "^https?://www\\.sklib\\.cn",
	"minVersion": "5.0",
	"maxVersion": "",
	"priority": 100,
	"inRepository": true,
	"translatorType": 4,
	"browserSupport": "gcsibv",
	"lastUpdated": "2024-04-01 08:04:40"
}

/*
	***** BEGIN LICENSE BLOCK *****

	Copyright © 2024 jiaojiaodubai<jiaojiaoduabi23@gmail.com>

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
	let row = doc.querySelector('.main > .container > .row');
	if (row) {
		Z.monitorDOMChanges(row, { childList: true, subtree: true });
	}
	if (url.includes('/bookPreview?')) {
		return 'book';
	}
	else if (url.includes('/databasedetail?')) {
		return 'bookSection';
	}
	else if (doc.querySelector('.viewpoint-title')) {
		return 'webpage';
	}
	else if (getSearchResults(doc, true)) {
		return 'multiple';
	}
	return false;
}

function getSearchResults(doc, checkOnly) {
	var items = {};
	var found = false;
	var rows = Array.from(doc.querySelectorAll('a'))
		.filter(element => ['/bookPreview?', '/databasedetail?', '/c/'].some(string => element.href.includes(string)));
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
	var newItem = new Z.Item(detectWeb(doc, url));
	newItem.extra = '';
	switch (newItem.itemType) {
		case 'book':
			newItem = Object.assign(newItem, scrapeBook(doc, url));
			break;
		case 'bookSection': {
			let labels = new LabelsX(doc, '.chapter-infor > *');
			Z.debug(labels.innerData.map(arr => [arr[0], ZU.trimInternal(arr[1].textContent)]));
			let bookLink = labels.getWith('所属图书', true).querySelector('a');
			if (bookLink) {
				try {
					let doc = await requestDocument(bookLink.href);
					let bookItem = scrapeBook(doc, url);
					bookItem.creators.forEach((creator) => {
						if (creator.creatorType == 'author') {
							creator.creatorType = 'bookAuthor';
						}
					});
					bookItem.bookTitle = bookItem.title;
					delete bookItem.title;
					newItem = Object.assign(bookItem, newItem);
				}
				catch (error) {
					Z.debug('Book page request failed');
				}
			}
			newItem.title = text(doc, '.book-head h3').split('\n')[0];
			newItem.bookTitle = labels.getWith('所属图书').replace(/(《|》)/g, '');
			newItem.date = labels.getWith('出版日期');
			doc.querySelectorAll('#authors > a').forEach((element) => {
				let creator = ZU.cleanAuthor(element.innerText, 'author');
				if (/[\u4e00-\u9fff]/.test(creator.lastName)) {
					creator.fieldMode = 1;
				}
				newItem.creators.push(creator);
			});
			doc.querySelectorAll('#key-words > span > a').forEach(element => newItem.tags.push(ZU.trimInternal(element.textContent)));
			newItem.attachments.push({
				title: 'Snapshot',
				document: doc
			});
			break;
		}
		case 'webpage':
			newItem.title = text(doc, '.viewpoint-title  h4');
			newItem.websiteTitle = '中国社会科学文库';
			newItem.date = ZU.strToISO(text(doc, '.viewpoint-top >span', 1));
			text(doc, '.viewpoint-top > span.link-color').split(/(：|\s|；)/).filter(string => !/(作者|：)/.test(string))
.forEach((creator) => {
	creator = ZU.cleanAuthor(creator, 'author');
	if (/[\u4e00-\u9fff]/.test(creator.lastName)) {
		creator.fieldMode = 1;
	}
	newItem.creators.push(creator);
});
			doc.querySelectorAll('#my_favorite_latin_words > span').forEach(element => newItem.tags.push(ZU.trimInternal(element.textContent)));
			newItem.attachments.push({
				title: 'Snapshot',
				document: doc
			});
			break;
	}
	newItem.libraryCatalog = '中国社会科学文库';
	newItem.language = 'zh-CN';
	newItem.url = tryMatch(url, /^.+ID=\d+/);
	newItem.complete();
}

function scrapeBook(doc, url = doc.location.href) {
	let newItem = new Z.Item(detectWeb(doc, url));
	newItem.extra = '';
	let labels = new LabelsX(doc, '.bookinfor-detail > .itemize, .book-info .content > p');
	Z.debug(labels.innerData.map(arr => [arr[0], ZU.trimInternal(arr[1].textContent)]));
	newItem.title = text(doc, '.book-info > h4');
	newItem.abstractNote = text(doc, '#book-list');
	newItem.series = labels.getWith('丛书名').replace(/(《|》)/g, '');
	let citation = text(doc, '.citation .right');
	// newItem.seriesNumber = 系列编号;
	// newItem.volume = 卷次;
	// newItem.numberOfVolumes = 总卷数;
	// newItem.edition = 版本;
	newItem.place = tryMatch(citation, /\]\.(.+?)：/, 1);
	newItem.publisher = labels.getWith('出版单位');
	newItem.date = labels.getWith('出版日期');
	newItem.numPages = labels.getWith('页数');
	newItem.ISBN = labels.getWith('ISBN');
	newItem.extra += addExtra('original-title', text(doc, '.book-info > h5'));
	newItem.extra += addExtra('cite', tryMatch(labels.getWith('引用量'), /\d*/));
	newItem.extra += addExtra('CLC', text(doc, '#classify-list'));
	newItem.extra += addExtra('price', text(doc, '.price'));
	newItem.extra += addExtra('fund', text(doc, 'fund-lists'));
	let creators = [];
	text('.author-list').split(/\s{2,}/).forEach((group) => {
		Z.debug(group);
		let creatorType = tryMatch(group, /\s(.+?)$/).includes('译')
			? 'translator'
			: 'author';
		Z.debug(tryMatch(group, /\s\S+?$/));
		group.replace(/\s\S+?$/, '').split('、').forEach((creator) => {
			Z.debug(creator);
			let country = tryMatch(creator, /^（(.+?)）/, 1);
			creator = creator.replace(/^（.+?）/, '');
			let original = tryMatch(creator, /\((.+?)\)$/, 1);
			creator = creator.replace(/\(.+?\)$/, '');
			creator = ZU.cleanAuthor(creator, creatorType);
			creator.country = country;
			creator.original = original;
			if (/[\u4e00-\u9fff]/.test(creator.lastName)) {
				creator.fieldMode = 1;
			}
			creators.push(creator);
		});
	});
	if (creators.some(creator => creator.original || creator.country)) {
		newItem.extra += addExtra('creatorsExt', JSON.stringify(creators));
	}
	creators.forEach((creator) => {
		delete creator.country;
		newItem.extra += addExtra('original-author', creator.original);
		delete creator.original;
		newItem.creators.push(creator);
	});
	doc.querySelectorAll('.key-words > span > a').forEach(element => newItem.tags.push(ZU.trimInternal(element.textContent)));
	let authorIntro = doc.querySelector('#author_introduction');
	if (authorIntro) {
		newItem.notes.push('<h1>作者简介</h1>' + ZU.trimInternal(authorIntro.textContent));
	}
	let contents = doc.querySelector('.infor-introduction > .menu_second');
	if (contents) {
		newItem.notes.push(`<h1>${newItem.title} -  目录</h1>` + contents.innerText);
	}
	return newItem;
}

class LabelsX {
	constructor(doc, selector) {
		this.innerData = [];
		this.emptyElement = doc.createElement('div');
		Array.from(doc.querySelectorAll(selector))
			// avoid nesting
			.filter(element => !element.querySelector(selector))
			// avoid empty
			.filter(element => !/^\s*$/.test(element.textContent))
			.forEach((element) => {
				let elementCopy = element.cloneNode(true);
				// avoid empty text
				while (/^\s*$/.test(elementCopy.firstChild.textContent)) {
					// Z.debug(elementCopy.firstChild.textContent);
					elementCopy.removeChild(elementCopy.firstChild);
					// Z.debug(elementCopy.firstChild.textContent);
				}
				if (elementCopy.childNodes.length > 1) {
					let key = elementCopy.removeChild(elementCopy.firstChild).textContent.replace(/\s/g, '');
					this.innerData.push([key, elementCopy]);
				}
				else {
					let text = ZU.trimInternal(elementCopy.textContent);
					let key = tryMatch(text, /^[[【]?.+?[】\]:：]/).replace(/\s/g, '');
					elementCopy.textContent = tryMatch(text, /^[[【]?.+?[】\]:：]\s*(.+)/, 1);
					this.innerData.push([key, elementCopy]);
				}
			});
	}

	getWith(label, element = false) {
		if (Array.isArray(label)) {
			let results = label
				.map(aLabel => this.getWith(aLabel, element));
			let keyVal = element
				? results.find(element => !/^\s*$/.test(element.textContent))
				: results.find(string => string);
			return keyVal
				? keyVal
				: element
					? this.emptyElement
					: '';
		}
		let pattern = new RegExp(label, 'i');
		let keyVal = this.innerData.find(arr => pattern.test(arr[0]));
		return keyVal
			? element
				? keyVal[1]
				: ZU.trimInternal(keyVal[1].textContent)
			: element
				? this.emptyElement
				: '';
	}
}

/**
 * When value is valid, return a key-value pair in string form.
 * @param {String} key
 * @param {*} value
 * @returns
 */
function addExtra(key, value) {
	return value
		? `${key}: ${value}\n`
		: '';
}

/**
 * Attempts to get the part of the pattern described from the character,
 * and returns an empty string if not match.
 * @param {String} string
 * @param {RegExp} pattern
 * @param {Number} index
 * @returns
 */
function tryMatch(string, pattern, index = 0) {
	if (!string) return '';
	let match = string.match(pattern);
	return (match && match[index])
		? match[index]
		: '';
}

/** BEGIN TEST CASES **/
var testCases = [
	{
		"type": "web",
		"url": "https://www.sklib.cn/booklib/bookPreview?SiteID=122&ID=10717270&fromSubID=",
		"items": [
			{
				"itemType": "book",
				"title": "中国农村发展报告.2023：新发展阶段全面深化农村改革",
				"creators": [
					{
						"firstName": "",
						"lastName": "魏后凯",
						"creatorType": "author",
						"fieldMode": 1
					},
					{
						"firstName": "",
						"lastName": "杜志雄",
						"creatorType": "author",
						"fieldMode": 1
					},
					{
						"firstName": "",
						"lastName": "檀学文",
						"creatorType": "author",
						"fieldMode": 1
					},
					{
						"firstName": "",
						"lastName": "于法稳",
						"creatorType": "author",
						"fieldMode": 1
					},
					{
						"firstName": "",
						"lastName": "崔红志",
						"creatorType": "author",
						"fieldMode": 1
					}
				],
				"date": "2023-07",
				"ISBN": "9787522722177",
				"abstractNote": "本书聚焦锚定建设农业强国目标，在新发展阶段推进全面深化农村改革的整体思路、重点难点、战略路径和主要突破口。全书由总报告和专题报告组成。总报告为年度报告的核心和精华，全面深入论述在农业强国建设目标引领下，新发展阶段如何推进全面深化农村改革。专题报告分为综合篇、经济篇、社会篇和生态环境篇四大板块。综合篇内容包括坚持与完善农村基本经营制度的对策与路径、深化和推进农村土地制度改革、完善涉农财政资金使用制度、健全城乡融合发展体制机制。经济篇包括农业强国建设的制度保障、深化国有农场体制改革、建立和完善农业高水平开放与支持保护制度、农业保险改革进展、资本进入乡村振兴的体制与机制改革。社会篇包括健全农民稳定增收长效机制、深化农村社会保障制度改革、建立常态化相对贫困治理机制、数字乡村建设中的改革问题。生态环境篇包括农作物生产生态补偿机制、生态农产品价值实现机制、和美乡村建设的长效管护机制、农业农村减排降碳的制度安排。",
				"extra": "original-title: China's Rural Development Report（2023） Deepening Overall Rural Reform in the New Stage of Development\nCLC: 经济>农业经济>中国农业经济\nprice: ¥105.6",
				"language": "zh-CN",
				"libraryCatalog": "中国社会科学文库",
				"numPages": "466",
				"place": "北京",
				"publisher": "中国社会科学出版社",
				"series": "中社智库年度报告",
				"url": "https://www.sklib.cn/booklib/bookPreview?SiteID=122&ID=10717270",
				"attachments": [],
				"tags": [
					{
						"tag": "中国"
					},
					{
						"tag": "农村经济发展"
					},
					{
						"tag": "研究报告"
					}
				],
				"notes": [
					"<h1>作者简介</h1>魏后凯 魏后凯 经济学博士，第十三、十四届全国人大代表、农业与农村委员会委员，中国社会科学院农村发展研究所所长、二级研究员、博士生导师，享受国务院特殊津贴专家。兼任中国社会科学院城乡发展一体化智库常务副理事长，中国农村发展学会和中国林牧渔业经济学会会长，国务院学位委员会农林经济管理学科评议组成员，中央农办、农业农村部乡村振兴专家咨询委员会委员。获第三届全国创新争先奖状，入选国家哲学社会科学领军人才和文化名家暨“四个一批”人才。主要研究领域：区域经济、城镇化、农业农村发展。 Wei Houkai, doctor of economics, director, researcher and doctoral supervisor of the Institute of Rural Development, the Chinese Academy of Social Sciences. Main research ﬁelds are regional economics and development economics. 杜志雄 杜志雄 日本东京大学农学博士，第十四届全国政协委员、农业和农村委员会委员，中国社会科学院农村发展研究所党委书记、副所长、二级研究员、博士生导师，享受国务院特殊津贴专家。兼任中国社会科学院城乡发展一体化智库副理事长、农业农村部农村社会事业专家委员会委员、中国农业经济学会副会长、中国县镇经济交流促进会会长和第四届国家食物与营养咨询委员会委员等。获得文化名家暨“四个一批”人才及国家“万人计划”哲学社会科学领军人才称号。主要研究领域：中国农业农村现代化理论与政策。 Du Zhixiong, doctor of agriculture at Tokyo University, researcher and doctoral supervisor at the Chinese Academy of Social Sciences. Main research ﬁelds are rural non-agricultural economy, China's modern agricultural development, etc. 檀学文 檀学文 经济学博士，中国社会科学院农村发展研究所贫困与福祉研究室主任、研究员、博士生导师。兼任中国社会科学院贫困问题研究中心秘书长、中国国外农业经济研究会副会长。主要研究领域：贫困与福祉、农民工与城市化、农业可持续发展。 于法稳于法稳 管理学博士，中国社会科学院农村发展研究所生态经济研究室主任、二级研究员、博士生导师。兼任中国社会科学院生态环境经济研究中心主任、中国生态经济学学会副理事长兼秘书长、《中国生态农业学报》《生态经济》副主编。主要研究领域：生态经济理论与方法、资源管理、农村生态治理、农业可持续发展等。 崔红志崔红志 管理学博士，中国社会科学院农村发展研究所农村组织与制度研究室主任、研究员、博士生导师。主要研究领域：农村社会保障、农村组织与制度。",
					"<h1>中国农村发展报告.2023：新发展阶段全面深化农村改革 -  目录</h1>编委会\n主报告\n综合篇\n经济篇\n社会篇\n生态环境篇"
				],
				"seeAlso": []
			}
		]
	},
	{
		"type": "web",
		"url": "https://www.sklib.cn/booklib/databasedetail?SiteID=122&ID=10795278",
		"items": [
			{
				"itemType": "bookSection",
				"title": "引导大学生抵御历史虚无主义",
				"creators": [
					{
						"firstName": "",
						"lastName": "张玲",
						"creatorType": "author",
						"fieldMode": 1
					},
					{
						"firstName": "",
						"lastName": "张勇",
						"creatorType": "author",
						"fieldMode": 1
					}
				],
				"date": "2023-07",
				"ISBN": "9787522720449",
				"abstractNote": "本书以习近平总书记关于思想政治教育的论述精神为指导，在现有研究基础上，以实证和调研为主要研究手段，对新形势下高校思政教育的育人理念、教育手段、理论体系、教育模式等进行积极探索，还包括研究团队结合院校特色形成的育人经验和相关思考。",
				"bookTitle": "铸魂新青年：高校思政工作的思与行",
				"language": "zh-CN",
				"libraryCatalog": "中国社会科学文库",
				"place": "北京",
				"publisher": "中国社会科学出版社",
				"url": "https://www.sklib.cn/booklib/databasedetail?SiteID=122&ID=10795278",
				"attachments": [
					{
						"title": "Snapshot",
						"mimeType": "text/html"
					}
				],
				"tags": [
					{
						"tag": "历史"
					},
					{
						"tag": "大学生"
					},
					{
						"tag": "思想"
					},
					{
						"tag": "社会主义"
					},
					{
						"tag": "虚无主义"
					}
				],
				"notes": [],
				"seeAlso": []
			}
		]
	},
	{
		"type": "web",
		"url": "https://www.sklib.cn//c/2022-12-05/656745.shtml",
		"items": [
			{
				"itemType": "webpage",
				"title": "【社科要论】加快推进民族地区中国式现代化建设步伐",
				"creators": [
					{
						"firstName": "",
						"lastName": "中国社会科学网",
						"creatorType": "author",
						"fieldMode": 1
					},
					{
						"firstName": "",
						"lastName": "涂裕春",
						"creatorType": "author",
						"fieldMode": 1
					},
					{
						"firstName": "",
						"lastName": "陈冰",
						"creatorType": "author",
						"fieldMode": 1
					}
				],
				"date": "2022-12-05",
				"language": "zh-CN",
				"websiteTitle": "中国社会科学文库",
				"attachments": [
					{
						"title": "Snapshot",
						"mimeType": "text/html"
					}
				],
				"tags": [
					{
						"tag": "东部地区"
					},
					{
						"tag": "中国社会"
					},
					{
						"tag": "中国社会科学"
					},
					{
						"tag": "中国社会科学院"
					},
					{
						"tag": "中部地区"
					},
					{
						"tag": "少数民族"
					},
					{
						"tag": "当代中国"
					},
					{
						"tag": "改革开放"
					},
					{
						"tag": "沿海地区"
					},
					{
						"tag": "现代中国"
					},
					{
						"tag": "现代化"
					},
					{
						"tag": "社会科学"
					},
					{
						"tag": "经济发展"
					},
					{
						"tag": "西部地区"
					}
				],
				"notes": [],
				"seeAlso": []
			}
		]
	},
	{
		"type": "web",
		"url": "https://www.sklib.cn/",
		"items": "multiple"
	},
	{
		"type": "web",
		"url": "https://www.sklib.cn/booklib/search?SiteID=122&fromSubID=&&resType=News&q=%25E7%258E%25B0%25E4%25BB%25A3%25E5%258C%2596&field=all&preciseSearch=N",
		"items": "multiple"
	}
]
/** END TEST CASES **/
