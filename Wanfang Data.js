{
	"translatorID": "eb876bd2-644c-458e-8d05-bf54b10176f3",
	"label": "Wanfang Data",
	"creator": "Ace Strong <acestrong@gmail.com>, rnicrosoft",
	"target": "^https?://.*(d|s)(\\.|-)wanfangdata(\\.|-)com(\\.|-)cn",
	"minVersion": "2.0rc1",
	"maxVersion": "",
	"priority": 100,
	"inRepository": true,
	"translatorType": 4,
	"browserSupport": "gcsibv",
	"lastUpdated": "2024-01-09 12:03:47"
}

/*
	***** BEGIN LICENSE BLOCK *****

	Copyright © 2019 Xingzhong Lin, https://github.com/Zotero-CN/translators_CN

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
// var core = {
// 	PKU: "北大《中文核心期刊要目总览》",
// 	北大核心: "北大《中文核心期刊要目总览》",
// 	ISTIC: "中国科技论文与引文数据库",
// 	CSSCI: "中文社会科学引文索引",
// 	NJU: "中文社会科学引文索引",
// 	CSTPCD: "中文社会科学引文索引",
// 	CSCD: "中国科学引文数据库",
// 	CASS: "《中国人文社会科学核心期刊要览》",
// 	AJ: "俄罗斯《文摘杂志》",
// 	CA: "美国《化学文摘》",
// 	EI: "美国《工程索引》",
// 	SCI: "美国《科学引文索引》",
// 	SCIE: "美国《科学引文索引(扩展版)》",
// 	"A&HCI": "《艺术与人文科学引文索引》",
// 	SSCI: "美国《社会科学引文索引》",
// 	CBST: "日本《科学技术文献速报》",
// 	SA: "英国《科学文摘》",
// 	GDZJ: "广电总局认定学术期刊"
// };

class ID {
	constructor(node, url) {
		// url有时是加密过的字符，而“收藏”按钮上有含id的链接
		let hiddenId = text(node, 'span.title-id-hidden') || attr(node, '.collection > wf-favourite', 'url');
		Z.debug(`hiddenId: ${hiddenId}`);
		this.filename = tryMatch(
			hiddenId,
			new RegExp(`${hiddenId.includes('wanfang') ? '/' : ''}\\w+[_/]([\\w.% -/]+)$`), 1);
		this.dbname = tryMatch(
			hiddenId,
			new RegExp(`${hiddenId.includes('wanfang') ? '/' : ''}(\\w+)[_/][\\w.% -/]+$`), 1);
		const dbType = {
			periodical: "journalArticle",
			perio: "journalArticle",
			thesis: "thesis",
			conference: "conferencePaper",
			patent: "patent",
			degree: "thesis",
			standard: "standard",
		};
		this.itemType = dbType[this.dbname];
		this.url = url || `https://d.wanfangdata.com.cn/${hiddenId.replace("_", "/")}`;
	}
}

function detectWeb(doc, url) {
	let dynamic = doc.querySelector('.container-flex, .periodical');
	if (dynamic) {
		Z.monitorDOMChanges(dynamic, { childList: true });
	}
	if (getSearchResults(doc, true)) return 'multiple';
	let ids = new ID(doc, url);
	Z.debug(ids);
	return ids.itemType;
}

function getSearchResults(doc, checkOnly) {
	var items = {};
	var found = false;
	var rows = doc.querySelectorAll('div.normal-list');
	for (let i = 0; i < rows.length; i++) {
		let row = rows[i];
		let title = text(row, '.title');
		let filename = text(row, 'span.title-id-hidden');
		if (!filename || !title) continue;
		if (checkOnly) return true;
		found = true;
		items[filename] = `${i + 1}. ${title}`;
	}
	Z.debug(items);
	return found ? items : false;
}

async function doWeb(doc, url) {
	if (detectWeb(doc, url) == 'multiple') {
		let items = await Zotero.selectItems(getSearchResults(doc, false));
		Z.debug(items);
		if (!items) return;
		let rows = Array.from(doc.querySelectorAll('div.normal-list'));
		for (let filename of Object.keys(items)) {
			Z.debug(filename);
			let row = rows.find(r => text(r, 'span.title-id-hidden') == filename);
			// Z.debug(row.innerText);
			let cite = row.querySelector('.wf-button-quote');
			if (cite) await cite.click();
			let pane = row.querySelector('.export-tab-pane:nth-last-child(2)');
			let startTime = Date.now();
			while (pane.children.length == 0 && Date.now() - startTime < 5000) {
				await new Promise(resolve => setTimeout(resolve, 200));
			}
			let close = doc.querySelector('.ivu-modal-wrap:not(.ivu-modal-hidden) .ivu-modal-close');
			if (close) await close.click();
			if (pane.children.length > 0) {
				await scrapeRow(row);
			}
		}
	}
	else {
		await scrapePage(doc, url);
	}
}

async function scrapePage(doc, url = doc.location.href) {
	Z.debug("--------------- WanFang Data 2024-01-09 19:39:21 ---------------");
	let ids = new ID(doc, url);
	var newItem = new Zotero.Item(ids.itemType);
	newItem.title = text(doc, '.detailTitleCN > span:first-child') || text(doc, '.detailTitleCN');
	newItem.extra = '';
	// Display full abstract
	let clickMore = Array.from(doc.querySelectorAll('span.abstractIcon.btn, .moreFlex > span:first-child'));
	for (let button of clickMore) {
		let buttonText = button.getAttribute('title') || button.innerText;
		if (!buttonText.includes('收起')) await button.click();
	}
	newItem.abstractNote = text(doc, '.summary > .item+*');
	newItem.publicationTitle = text(doc, '.periodicalName');
	newItem.pages = tryMatch(text(doc, '.pages > .item+* span, .pageNum > .item+*'), /[\d+,~-]+/).replace('+', ',').replace('~', '-');
	newItem.url = url;
	Array.from(doc.querySelectorAll('.author.detailTitle span')).forEach((creator) => {
		newItem.creators.push(ZU.cleanAuthor(creator.innerText, 'author'));
	});
	Array.from(doc.querySelectorAll('.keyword > .item+* > a')).forEach((tag) => {
		newItem.tags.push(tag.innerText);
	});
	function addExtra(field, value) {
		if (value) {
			newItem.extra += `${field}: ${value}`;
		}
	}
	addExtra('original-title', text(doc, '.detailTitleEN'));
	switch (newItem.itemType) {
		case 'journalArticle': {
			let pubInfo = text(doc, '.publishData > .item+*');
			newItem.date = tryMatch(pubInfo, /^\d{4}/);
			newItem.volume = tryMatch(pubInfo, /,0*(\d+)\(/, 1);
			newItem.issue = tryMatch(pubInfo, /0*\(([a-z\d]+)\)/, 1);
			newItem.DOI = attr(doc, '.doiStyle > a', 'href');
			newItem.ISSN = tryMatch(text(doc, '.periodicalDataItem'), /:\w+/);
			break;
		}
		case 'thesis':
			newItem.university = text(doc, '.detailOrganization');
			newItem.thesisType = `${text(doc, '.degree > .item+*')}学位论文`;
			Array.from(doc.querySelectorAll('.tutor > .item+* > a')).forEach((creator) => {
				newItem.creators.push(ZU.cleanAuthor(creator.innerText, 'contributor'));
			});
			newItem.date = tryMatch(text(doc, '.thesisYear'), /\d+/);
			break;
		case 'conferencePaper':
			newItem.date = text(doc, '.meetingDate > .item+*');
			newItem.proceedingsTitle = text(doc, '.mettingCorpus > .item+*');
			newItem.conferenceName = text(doc, '.mettingName > .item+*');
			newItem.place = text(doc, '.meetingArea > .item+*');
			break;
		case 'patent': {
			let inventors = Array.from(pickLabel(doc, '.applicant', '发明/设计人').querySelectorAll('.item+* > a'));
			inventors.forEach((creator) => {
				newItem.creators.push(ZU.cleanAuthor(creator.innerText, 'inventor'));
			});
			Array.from(doc.querySelectorAll('.agent .itemUrl > span')).forEach((creator) => {
				newItem.creators.push(ZU.cleanAuthor(creator.innerText, 'attorneyAgent'));
			});
			addExtra('Genre', text(doc, '.patentType > .item+*'));
			newItem.place = text(doc, '.applicantAddress > .item+*');
			newItem.country = text(doc, '.applicantArea > .item+*');
			newItem.assignee = text(pickLabel(doc, '.applicant', '申请/专利权人'), '.item+*');
			newItem.patentNumber = text(doc, '.patentCode > .item+*');
			newItem.filingDate = text(pickLabel(doc, '.applicationDate', '申请日期'), '.item+*');
			newItem.priorityNumbers = text(pickLabel(doc, '.applicant', '优先权'), '.item+*');
			newItem.issueDate = text(pickLabel(doc, '.applicationDate', '公开/公告日'), '.item+*');
			newItem.legalStatus = text(doc, '.periodicalContent .messageTime > span:last-child');
			newItem.rights = text(doc, '.signoryItem > .item+*');
			break;
		}
		case 'standard':
			newItem.number = text(doc, '.standardId > .item+*');
			newItem.date = text(doc, '.issueDate > .item+*');
			newItem.status = text(doc, '.status > .item+*');
			addExtra('apply date', text(doc, '.applyDate > .item+*'));
			break;
		default:
			break;
	}
	newItem.creators.forEach((creator) => {
		if (/[\u4e00-\u9fa5]/.test(creator.lastName)) {
			creator.fieldMode = 1;
		}
	});
	// let pdfLink = getPDF(doc);
	// if (pdfLink) {
	// 	newItem.attachments.push({
	// 		url: pdfLink,
	// 		title: 'Full Text PDF',
	// 		mimeType: 'application/pdf'
	// 	});
	// }
	newItem.complete();
}

async function scrapeRow(row) {
	Z.debug('scrape with row...');
	let ids = new ID(row);
	Z.debug(ids);
	let referText = text(row, '.export-tab-pane:nth-last-child(2) > .end-note-list');
	Z.debug('referText:');
	Z.debug(referText);
	referText = referText
		.replace(/\\n/g, '\n')
		.replace(/^%([KAYI]) .*/gm, function (match) {
			let tag = match[1];
			return match.replace(/[,;，；]\s?/g, `\n%${tag} `);
		})
		.replace(/(\n\s*)+/g, '\n');
	Z.debug(referText);
	let translator = Zotero.loadTranslator('import');
	// Refer/BibIX
	translator.setTranslator('881f60f2-0802-411a-9228-ce5f47b64c7d');
	translator.setString(referText);
	translator.setHandler('itemDone', (_obj, item) => {
		if (item.language) {
			item.language = { chi: 'zh-CN', eng: 'en-US' }[item.language] || item.language;
		}
		if (item.archiveLocation) {
			item.archiveLocation = item.archiveLocation.replace(/\n.*$/, '');
		}
		// if (ZU.xpath(row, '//div[contains(text(), "下载")]').length) {
		// 	item.attachments.push({
		// 		url: getPDF(row),
		// 		title: 'Full Text PDF',
		// 		mimeType: 'application/pdf'
		// 	});
		// }
		item.creators.forEach((creator) => {
			if (/[\u4e00-\u9fa5]/.test(creator.lastName)) {
				creator.fieldMode = 1;
			}
		});
		item.complete();
	});
	await translator.translate();
}

function tryMatch(string, pattern, index = 0) {
	let match = string.match(pattern);
	if (match && match[index]) {
		return match[index];
	}
	return '';
}

function pickLabel(doc, selector, label) {
	let fineElement = Array.from(doc.querySelectorAll(selector))
		.find(element => element.innerText.includes(label));
	return fineElement
		? fineElement
		: document.createElement('div');
}

// function getPDF(doc) {
// 	let hiddenId = attr(doc, 'a.download', 'href') || ZU.trimInternal(text(doc, 'span.title-id-hidden'));
// 	let match = hiddenId.match(/(\w+)_([^.]+)/);
// 	if (!hiddenId || !match) return '';
// 	return "https://oss.wanfangdata.com.cn/www/" + encodeURIComponent(doc.title) + ".ashx?isread=true&type=" + match[1] + "&resourceId=" + encodeURI(decodeURIComponent(match[2]));
// }

/** BEGIN TEST CASES **/
var testCases = [
	{
		"type": "web",
		"url": "https://d.wanfangdata.com.cn/periodical/hgxb2019z1002",
		"items": [
			{
				"itemType": "journalArticle",
				"title": "微波法制备生物柴油研究进展",
				"creators": [
					{
						"firstName": "",
						"lastName": "商辉",
						"creatorType": "author",
						"fieldMode": 1
					},
					{
						"firstName": "",
						"lastName": "丁禹",
						"creatorType": "author",
						"fieldMode": 1
					},
					{
						"firstName": "",
						"lastName": "张文慧",
						"creatorType": "author",
						"fieldMode": 1
					}
				],
				"date": "2019",
				"abstractNote": "基于微波的选择性、瞬时性及体积性加热的特点,可以有效提高反应分子的平均能量、分子的碰撞频率,加快反应速率,采用微波辅助催化酯交换反应制备生物柴油近几年得到了国内外学者的广泛关注.将微波能应用于生物柴油制备过程具有显著的优势,与传统加热方式相比,采用微波辐射加热,反应时间明显缩短,产物组成也有所变化.因此主要从酸碱催化剂催化酯交换反应和酯化反应的角度,综述了国内外对微波辅助生物柴油制备的研究进展,并对微波优势及未来发展趋势进行了展望.",
				"issue": "z1",
				"libraryCatalog": "Wanfang Data",
				"pages": "15-22",
				"publicationTitle": "化工学报",
				"url": "https://d.wanfangdata.com.cn/periodical/hgxb2019z1002",
				"volume": "70",
				"attachments": [
					{
						"title": "Full Text PDF",
						"mimeType": "application/pdf"
					}
				],
				"tags": [
					{
						"tag": "催化剂"
					},
					{
						"tag": "微波"
					},
					{
						"tag": "生物柴油"
					},
					{
						"tag": "酯交换"
					},
					{
						"tag": "酯化"
					}
				],
				"notes": [],
				"seeAlso": []
			}
		]
	},
	{
		"type": "web",
		"url": "https://d.wanfangdata.com.cn/thesis/D01698671",
		"items": [
			{
				"itemType": "thesis",
				"title": "济南市生物多样性评价及与生物入侵关系研究",
				"creators": [
					{
						"firstName": "",
						"lastName": "孟令玉",
						"creatorType": "author",
						"fieldMode": 1
					},
					{
						"firstName": "",
						"lastName": "曲爱军",
						"creatorType": "contributor",
						"fieldMode": 1
					}
				],
				"date": "2019",
				"abstractNote": "生物多样性是我国生态环境的重要组成部分，也是生态文明建设的重要内容。如何更合理的建立评价生物多样性体系及确定威胁生物多样性相关因素，对政府科学制定生物多样性保护战略规划及行动计划极其重要，对生态文明建设具有重要意义。同时，生物多样性是一种资源，是生物资源的基础，具有多种多样的生态和环境服务功能。　　通过济南市生物多样性现状评价，可明确济南市生物多样性现状、威胁因素和保护现状，有助于济南市资源有效利用与保护，以及相关政府部门科学的制定生物多样性保护战略与具体行动计划。本研究依据环保部生物多样性省域评价体系，组建了暖温带生物多样...",
				"libraryCatalog": "Wanfang Data",
				"thesisType": "硕士学位论文",
				"university": "山东农业大学",
				"url": "https://d.wanfangdata.com.cn/thesis/D01698671",
				"attachments": [
					{
						"title": "Full Text PDF",
						"mimeType": "application/pdf"
					}
				],
				"tags": [
					{
						"tag": "生物入侵"
					},
					{
						"tag": "生物多样性"
					},
					{
						"tag": "评价指标体系"
					},
					{
						"tag": "资源利用"
					}
				],
				"notes": [],
				"seeAlso": []
			}
		]
	},
	{
		"type": "web",
		"url": "https://d.wanfangdata.com.cn/conference/9534067",
		"items": [
			{
				"itemType": "conferencePaper",
				"title": "生物发酵提高芦笋汁生物利用率研究",
				"creators": [
					{
						"firstName": "",
						"lastName": "吴晓春",
						"creatorType": "author",
						"fieldMode": 1
					},
					{
						"firstName": "",
						"lastName": "黄惠华",
						"creatorType": "author",
						"fieldMode": 1
					}
				],
				"date": "2018-12-04",
				"abstractNote": "本研究在单因素试验的基础上通过响应面法优化安琪酵母发酵芦笋汁生产工艺,以芦笋汁中总皂苷元含量作为响应值,各影响因素为自变量,设计响应面实验方案.结果表明一次项X1(接种量)、X2(发酵温度)、X3(发酵时间)和所有因素的二次项都达到了极显著水平(P<0.01).并得到安琪酵母发酵芦笋汁的最优生产工艺条件:利用R2A琼脂作为基础培养基接种量0.2％、发酵温度30℃、发酵时间7天.在此条件下重复实验3次,整理结果可知芦笋总皂苷元含量可达到(361.68±8.62)μg.",
				"conferenceName": "2018年广东省食品学会年会",
				"extra": "original-title: Biological Fermentation Improves the Bioavailability of Asparagus Juice",
				"libraryCatalog": "Wanfang Data",
				"pages": "69-74",
				"place": "广州",
				"proceedingsTitle": "2018年广东省食品学会年会论文集",
				"url": "https://d.wanfangdata.com.cn/conference/9534067",
				"attachments": [],
				"tags": [
					{
						"tag": "总皂苷元含量"
					},
					{
						"tag": "生物利用率"
					},
					{
						"tag": "生物发酵"
					},
					{
						"tag": "芦笋汁"
					}
				],
				"notes": [],
				"seeAlso": []
			}
		]
	},
	{
		"type": "web",
		"url": "https://d.wanfangdata.com.cn/patent/CN201880013080.0",
		"items": [
			{
				"itemType": "patent",
				"title": "生物体签名系统及生物体签名方法",
				"creators": [
					{
						"firstName": "",
						"lastName": "加贺阳介",
						"creatorType": "inventor",
						"fieldMode": 1
					},
					{
						"firstName": "",
						"lastName": "高桥健太",
						"creatorType": "inventor",
						"fieldMode": 1
					},
					{
						"firstName": "",
						"lastName": "藤尾正和",
						"creatorType": "inventor",
						"fieldMode": 1
					},
					{
						"firstName": "",
						"lastName": "陈伟",
						"creatorType": "attorneyAgent",
						"fieldMode": 1
					},
					{
						"firstName": "",
						"lastName": "沈静",
						"creatorType": "attorneyAgent",
						"fieldMode": 1
					}
				],
				"issueDate": "2019-10-11",
				"abstractNote": "生物体签名系统保持将从用户的部位得到的第一生物体信息转换而得到的第一模板和通过单向性转换将从该用户的该部位得到的第二生物体信息进行转换而得到的第二模板，根据认证对象的第一生物体信息生成第一模板，对使用参数修正后的认证对象的第一模板与生物体签名系统保持的第一模板之间的相似度高的该参数进行特定，分别根据分别使用包括该特定出的参数在内的规定范围所包括的参数修正后的认证对象的第二生物体信息，生成第二模板，并将该生成的第二模板分别与生物体签名系统保持的第二模板进行比较来判定认证对象的认证成功与否。",
				"assignee": "株式会社日立制作所",
				"country": "日本;JP",
				"extra": "Genre: 发明专利",
				"filingDate": "2018-02-14",
				"legalStatus": "公开",
				"patentNumber": "CN201880013080.0",
				"place": "日本东京都",
				"priorityNumbers": "2017-114023 2017.06.09 JP",
				"rights": "1.一种生物体签名系统，其特征在于， 包括处理器和存储器， 所述存储器保持第一模板和第二模板，该第一模板表示通过规定的转换将从用户的规定部位得到的第一生物体信息进行转换后的结果，该第二模板表示通过规定的单向性转换将从所述用户的所述规定部位得到的第二生物体信息进行转换后的结果， 所述处理器进行以下处理： 获取认证对象的所述第一生物体信息和所述第二生物体信息， 根据获取到的所述第一生物体信息生成所述认证对象的第一模板， 对使用参数修正后的所述认证对象的第一模板与所述存储器保持的第一模板之间的相似度比规定条件高的所述参数进行特定， 分别使用包括特定出的所述参数在内的规定范围所包括的参数来修正所述认证对象的第二生物体信息， 分别根据修正后的所述第二生物体信息生成所述认证对象的第二模板， 将生成的所述第二模板分别与所述存储器保持的第二模板进行比较来判定所述认证对象的认证成功与否。 2.根据权利要求1所述的生物体签名系统，其特征在于， 所述处理器通过所述规定的转换对获取到的所述第一生物体信息进行转换而生成所述认证对象的第一模板。 3.根据权利要求1所述的生物体签名系统，其特征在于， 所述处理器通过所述规定的单向性转换对修正后的所述第二生物体信息分别进行转换而生成所述认证对象的第二模板。 4.根据权利要求1所述的生物体签名系统，其特征在于， 储存于所述存储器内的第一生物体信息与第二生物体信息的相关系数为规定值以下。 5.根据权利要求1所述的生物体签名系统，其特征在于， 所述参数包括所述第一模板及所述第二模板的修正中的、表示平行移动量的参数和表示旋转量的参数。 6.根据权利要求1所述的生物体签名系统，其特征在于， 所述存储器保持多个用户的第一模板和第二模板， 所述处理器进行以下处理： 对与所述存储器保持的多个第一模板中的、存在所述相似度比规定条件高的所述参数的第一模板对应的用户群进行特定， 关于特定出的所述用户群的每个用户，分别使用包括特定出的参数在内的规定范围所包括的参数来修正所述认证对象的第二生物体信息并生成第二模板，并且将该生成的第二模板分别与该用户的第二模板进行比较， 基于分别针对特定出的所述用户群的比较结果来判定所述认证对象的认证成功与否。 7.一种生物体签名方法，由生物体签名系统进行生物体签名，其特征在于， 所述生物体签名系统保持第一模板和第二模板，该第一模板表示通过规定的转换将从用户的规定部位得到的第一生物体信息进行转换后的结果，该第二模板表示通过规定的单向性转换将从所述用户的所述规定部位得到的第二生物体信息进行转换后的结果， 在所述方法中，所述生物体签名系统进行以下处理： 获取认证对象的所述第一生物体信息和所述第二生物体信息， 根据获取到的所述第一生物体信息生成所述认证对象的第一模板， 对使用参数修正后的所述认证对象的第一模板与所述生物体签名系统保持的第一模板之间的相似度比规定条件高的所述参数进行特定， 分别使用包括特定出的所述参数在内的规定范围所包括的参数来修正所述认证对象的第二生物体信息， 分别从修正后的所述第二生物体信息生成所述认证对象的第二模板， 将生成的所述第二模板分别与所述生物体签名系统保持的第二模板进行比较来判定所述认证对象的认证成功与否。 8.根据权利要求7所述的方法，其特征在于， 在所述方法中，所述生物体签名系统通过所述规定的转换对获取到的所述第一生物体信息进行转换而生成所述认证对象的第一模板。 9.根据权利要求7所述的方法，其特征在于， 在所述方法中，所述生物体签名系统通过所述规定的单向性转换对修正后的所述第二生物体信息分别进行转换而生成所述认证对象的第二模板。 10.根据权利要求7所述的方法，其特征在于， 储存于所述生物体签名系统内的第一生物体信息与第二生物体信息的相关系数为规定值以下。 11.根据权利要求7所述的方法，其特征在于， 所述参数包括所述第一模板及所述第二模板的修正中的、表示平行移动量的参数和表示旋转量的参数。 12.根据权利要求7所述的方法，其特征在于， 所述生物体签名系统保持多个用户的第一模板和第二模板， 在所述方法中，所述生物体签名系统进行以下处理： 对与所述生物体签名系统保持的多个第一模板中的、存在所述相似度比规定条件高的所述参数的第一模板对应的用户群进行特定， 关于特定出的所述用户群的每个用户，分别使用包括特定出的参数在内的规定范围所包括的参数来修正所述认证对象的第二生物体信息并生成第二模板，并且将该生成的第二模板分别与该用户的第二模板进行比较， 基于分别针对特定出的所述用户群的比较结果来判定所述认证对象的认证成功与否。",
				"url": "https://d.wanfangdata.com.cn/patent/CN201880013080.0",
				"attachments": [
					{
						"title": "Full Text PDF",
						"mimeType": "application/pdf"
					}
				],
				"tags": [],
				"notes": [],
				"seeAlso": []
			}
		]
	},
	{
		"type": "web",
		"url": "https://d.wanfangdata.com.cn/standard/GB%252FT%25252019001-2016",
		"items": [
			{
				"itemType": "standard",
				"title": "质量管理体系  要求",
				"creators": [],
				"date": "2016-12-30",
				"abstractNote": "本标准为下列组织规定了质量管理体系要求:\r\na)需要证实其具有稳定提供满足顾客要求及适用法律法规要求的产品和服务的能力;\r\nb)通过体系的有效应用，包括体系改进的过程，以及保证符合顾客要求和适用的法律法规要求，旨在增强顾客满意。\r\n本标准规定的所有要求是通用的，旨在适用于各种类型、不同规模和提供不同产品和服务的组织。",
				"extra": "original-title: Quality management systems-Requirementsapply date: 2017-07-01",
				"libraryCatalog": "Wanfang Data",
				"number": "GB/T 19001-2016",
				"status": "现行",
				"url": "https://d.wanfangdata.com.cn/standard/GB%252FT%25252019001-2016",
				"attachments": [],
				"tags": [],
				"notes": [],
				"seeAlso": []
			}
		]
	},
	{
		"type": "web",
		"url": "https://s.wanfangdata.com.cn/paper?q=%E9%A3%8E%E6%B9%BF",
		"items": "multiple"
	}
]
/** END TEST CASES **/
