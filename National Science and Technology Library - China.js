{
	"translatorID": "0fbde090-5376-4ed9-8636-2c39588f7a0c",
	"label": "National Science and Technology Library - China",
	"creator": "jiaojiaodubai",
	"target": "^https?://www\\.nstl\\.gov\\.cn",
	"minVersion": "5.0",
	"maxVersion": "",
	"priority": 100,
	"inRepository": true,
	"translatorType": 4,
	"browserSupport": "gcsibv",
	"lastUpdated": "2024-03-21 08:48:12"
}

/*
	***** BEGIN LICENSE BLOCK *****

	Copyright © 2022 jiaojiaodubai23@gmail.com

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


const pageTypeMap = {
	期刊论文: 'journalArticle',
	会议论文: 'conferencePaper',
	学位论文: 'thesis',
	图书: 'bookSection',
	文集汇编: 'bookSection',
	标准: 'standard',
	专利: 'patent'
};

function detectWeb(doc, _url) {
	let serverContent = doc.querySelector('.serverleftcont, .searchResult-lists-midd-con');
	if (serverContent) {
		Z.monitorDOMChanges(serverContent, { childList: true, subtree: true });
	}
	let zhType = Object.keys(pageTypeMap).find(key => new RegExp(`${key}`).test(text(doc, '#title > span.frontLabel')));
	if (zhType) {
		return pageTypeMap[zhType];
	}
	else if (getSearchResults(doc, true)) {
		return 'multiple';
	}
	return false;
}

function getSearchResults(doc, checkOnly) {
	var items = {};
	var found = false;
	var rows = doc.querySelectorAll('.result-list-tit');
	for (let row of rows) {
		let id = row.getAttribute('data-id');
		let title = ZU.trimInternal(row.textContent);
		if (!id || !title) continue;
		if (checkOnly) return true;
		found = true;
		items[id] = title;
	}
	return found ? items : false;
}

async function doWeb(doc, url) {
	if (detectWeb(doc, url) == 'multiple') {
		let items = await Zotero.selectItems(getSearchResults(doc, false));
		if (!items) return;
		await scrapeMulti(Object.keys(items));
	}
	else {
		await scrape(doc, url);
	}
}

async function scrape(doc, url = doc.location.href) {
	Z.debug(doc.body.innerText);
	var newItem = new Z.Item(detectWeb(doc, url));
	var creators = [];
	let labels = new Labels(doc, '.summary');
	Z.debug(labels.data.map(arr => [arr[0], ZU.trimInternal(arr[1].innerText)]));
	newItem.title = decodeAttr(doc, '#title');
	newItem.extra = '';
	let clickMore = doc.querySelector('.btn_open_up');
	if (clickMore && !/收起/.test(clickMore.textContent)) {
		await clickMore.click();
	}
	newItem.abstractNote = text(doc, '.inner-abs > p').replace(/\s*收起/, '');
	switch (newItem.itemType) {
		case 'journalArticle':
			newItem.publicationTitle = decodeAttr(doc, '#other_content a:first-child');
			newItem.volume = tryMatch(labels.get('卷'), /0*([1-9]\d*)/, 1);
			newItem.issue = tryMatch(labels.get('期'), /0*([1-9]\d*)/, 1);
			newItem.date = labels.get('年份');
			newItem.ISSN = labels.get('ISSN');
			creators = Array.from(labels.get('作者', true).querySelectorAll('span > a')).map(
				element => processName(element.textContent, 'author')
			);
			break;
		case 'conferencePaper':
			newItem.date = labels.get('年份');
			newItem.proceedingsTitle = decodeAttr(doc, '#other_content a:first-child');
			newItem.conferenceName = text(labels.get('会议', true), '[title="会议"]');
			newItem.place = text(labels.get('会议', true), '[title*="举办地"]');
			newItem.volume = tryMatch(labels.get('卷'), /0*([1-9]\d*)/, 1);
			newItem.ISBN = labels.get('ISBN');
			newItem.extra += addExtra('session', text(labels.get('会议', true), '[title*="届次"]'));
			creators = Array.from(labels.get('作者', true).querySelectorAll('span > a')).map(
				element => processName(element.textContent, 'author')
			);
			break;
		case 'bookSection':
			newItem.bookTitle = decodeAttr(doc, '#other_content a:first-child').replace(/\s?%3A$/, '');
			newItem.date = labels.get('年份');
			newItem.ISBN = labels.get('ISBN');
			creators = Array.from(labels.get('作者', true).querySelectorAll('span > a')).map(
				element => processName(element.textContent, 'author')
			);
			break;
		case 'thesis': {
			newItem.thesisType = `${labels.get('学位')}学位论文`;
			newItem.university = labels.get(['院校', '授予机构', '机构']);
			newItem.date = labels.get(['提交日期', '年份']);
			newItem.numPages = labels.get('总页数');
			let authors = Array.from(labels.get('作者', true).querySelectorAll('span > a')).map(
				element => processName(element.textContent, 'author')
			);
			let tutors = Array.from(labels.get('导师', true).querySelectorAll('span > a')).map(
				element => processName(element.textContent, 'contributor')
			);
			creators = [...authors, ...tutors];
			break;
		}
		case 'standard':
			newItem.organization = labels.get('机构').replace(/ \| /g, ', ');
			newItem.number = labels.get('标准号').replace('-', '—');
			newItem.date = labels.get('发布日期');
			newItem.extra += addExtra('ICS', labels.get('ICS'));
			newItem.extra += addExtra('CSS', labels.get('CCS'));
			newItem.extra += addExtra('applyDate', labels.get('生效日期'));
			break;
		case 'patent':
			newItem.place = labels.get('^国家');
			newItem.country = labels.get('^国家');
			newItem.filingDate = labels.get('专利申请日期');
			newItem.applicationNumber = labels.get('专利申请号');
			newItem.issueDate = labels.get('公开日期');
			newItem.legalStatus = labels.get('法律状态');
			creators = Array.from(labels.get('发明人', true).querySelectorAll('span > a')).map(element => processName(element.textContent, 'inventor')
			);
			break;
		default:
			break;
	}
	newItem.pages = Array.from(
		new Set([labels.get('起始页'), labels.get('结束页')].filter(page => page))
	).join('-');
	newItem.DOI = labels.get('DOI');
	newItem.language = {
		汉语: 'zh-CN',
		英语: 'en-US',
		日语: 'jp-JP'
	}[labels.get('语种')] || 'en-US';
	newItem.url = url;
	newItem.libraryCatalog = '国家科技图书文献中心';
	newItem.extra += addExtra('original-title', labels.get(['替代标题', '英文标题']));
	newItem.extra += addExtra('CLC', labels.get('分类号'));
	Z.debug(creators);
	newItem.creators = creators;
	labels.get('关键词', true).querySelectorAll('span > a').forEach((element) => {
		newItem.tags.push(ZU.trimInternal(element.textContent));
	});
	newItem.complete();
}

async function scrapeMulti(ids) {
	Z.debug(ids);
	let referUrl = 'https://www.nstl.gov.cn/api/service/nstl/web/execute'
		+ '?target=nstl4.search4'
		+ '&function=export/preview'
		+ `&ids=${encodeURIComponent(ids.join(','))}`
		+ '&format=RefWorks';
	Z.debug(referUrl);
	// id似乎有时效性
	let referText = await requestJSON(
		referUrl,
		{
			headers: {
				Referer: 'https://www.nstl.gov.cn/export_preview.html?exporttype=exportItemsId'
			}
		});
	Z.debug(referText);
	const rtMap = {
		JournalPaper: 'Journal Article',
		ProceedingsPaper: 'Conference Proceedings',
		DegreePaper: 'Thesis',
		// Report: 'Report',
		Book: 'Book, Section',
		CorpusCompile: 'Book, Section',
		// StandardLiterature: 'Standard',
		Patent: 'Patent'
	};
	referText = referText.data
		// trim HTML tags
		.map(field => field.slice(5, -6))
		.join('\n')
		.split('\n\n')
		.map((record) => {
			for (const key in rtMap) {
				record = record.replace(new RegExp(`^RT ${key}(.*)`, 'gm'), `RT ${rtMap[key]}$1`);
			}
			return record;
		});
	Z.debug(referText);
	for (let i = 0; i < referText.length; i++) {
		let record = referText[i];
		let translator = Zotero.loadTranslator('import');
		// RefWorks
		translator.setTranslator('1a3506da-a303-4b0a-a1cd-f216e6138d86');
		translator.setString(record);
		translator.setHandler('itemDone', (_obj, item) => {
			if (/^RT StandardLiterature/m.test(record)) {
				item.itemType = 'standard';
			}
			item.creators = /^A1/m.test(record)
				? record.match(/^A1.*/gm).map((line) => {
					let creator = ZU.cleanAuthor(line.slice(2), 'author');
					if (/[\u4e00-\u9fa5]/.test(creator.lastName)) {
						creator.lastName = creator.firstName + creator.lastName;
						creator.firstName = '';
						creator.fieldMode = 1;
					}
					return creator;
				})
				: [];
			switch (item.itemType) {
				case 'thesis':
					item.numPages = item.pages;
					delete item.pages;
					item.university = tryMatch(record, /^AD (.*?)$/m, 1);
					break;
				case 'conferencePaper':
					item.proceedingsTitle = item.proceedingsTitle || item.publicationTitle;
					delete item.publicationTitle;
					break;
				case 'bookSection':
					item.bookTitle = item.publicationTitle.replace(/:$/, '');
					delete item.publicationTitle;
					break;
				default:
					break;
			}
			item.url = `https://www.nstl.gov.cn/paper_detail.html?id=${ids[i]}`;
			item.complete();
		});
		await translator.translate();
	}
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

function addExtra(key, value) {
	return value
		? `${key}: ${value}\n`
		: '';
}

function tryMatch(string, pattern, index = 0) {
	if (!string) return '';
	let match = string.match(pattern);
	return (match && match[index])
		? match[index]
		: '';
}

function processName(creator, creatorType = 'author') {
	creator = ZU.cleanAuthor(creator, creatorType);
	if (/[\u4e00-\u9fa5]/.test(creator.lastName)) {
		creator.lastName = creator.firstName + creator.lastName;
		creator.firstName = '';
		creator.fieldMode = 1;
	}
	return creator;
}

function decodeAttr(node, selector, attribute = 'data-log') {
	let json = JSON.parse(attr(node, selector, attribute));
	return json.text
		? decodeURI(json.text)
		: '';
}


/** BEGIN TEST CASES **/
var testCases = [
	{
		"type": "web",
		"url": "https://www.nstl.gov.cn/search.html?t=JournalPaper,ProceedingsPaper,DegreePaper&q=6YeP5a2Q54K5",
		"items": "multiple"
	},
	{
		"type": "web",
		"url": "https://www.nstl.gov.cn/paper_detail.html?id=11548b4483a0090a29ff858849128255",
		"items": [
			{
				"itemType": "journalArticle",
				"title": "基于量子中心的测量型量子保密求和协议",
				"creators": [
					{
						"firstName": "",
						"lastName": "王跃",
						"creatorType": "author",
						"fieldMode": 1
					},
					{
						"firstName": "",
						"lastName": "张可佳",
						"creatorType": "author",
						"fieldMode": 1
					},
					{
						"firstName": "",
						"lastName": "韩睿",
						"creatorType": "author",
						"fieldMode": 1
					}
				],
				"date": "2023",
				"ISSN": "1007-5461",
				"abstractNote": "量子保密求和是量子安全计算的基础,目的是在保护参与者私有信息的前提下求出参与者秘密信息的和.提出一个基于GHZ类态的三方量子保密求和协议,其中只有量子中心拥有全量子能力,其余参与者只能对接收的量子态进行反射或测量.理论分析表明,所提出的协议可以确保正确性,即多个参与者最后可以成功计算他们秘密的和;同时,该协议还可以抵抗参与者攻击和外部攻击,即无论是外部攻击者还是内部参与者都不能获得除自己的秘密与结果之外的任何信息.最后,进一步讨论了如何将协议的参与者由三方拓展至多方.",
				"extra": "original-title: Measurement type quantum secure summation protocol based on quantum center\nCLC: O236.2",
				"issue": "1",
				"language": "zh-CN",
				"libraryCatalog": "国家科技图书文献中心",
				"pages": "104-111",
				"publicationTitle": "量子电子学报",
				"url": "https://www.nstl.gov.cn/paper_detail.html?id=11548b4483a0090a29ff858849128255",
				"volume": "40",
				"attachments": [],
				"tags": [
					{
						"tag": "GHZ类态"
					},
					{
						"tag": "量子中心"
					},
					{
						"tag": "量子保密求和"
					},
					{
						"tag": "量子安全多方计算"
					},
					{
						"tag": "量子通信"
					}
				],
				"notes": [],
				"seeAlso": []
			}
		]
	},
	{
		"type": "web",
		"url": "https://www.nstl.gov.cn/paper_detail.html?id=548dca9c1908bbe3e6df0ba4490c94f2",
		"items": [
			{
				"itemType": "bookSection",
				"title": "Silicon based single-photon avalanche diode technology for low-light and high-speed applications",
				"creators": [
					{
						"firstName": "Daniel",
						"lastName": "Durini",
						"creatorType": "author"
					},
					{
						"firstName": "Uwe",
						"lastName": "Paschen",
						"creatorType": "author"
					},
					{
						"firstName": "Werner",
						"lastName": "Brockherde",
						"creatorType": "author"
					},
					{
						"firstName": "Bedrich J.",
						"lastName": "Hosticka",
						"creatorType": "author"
					}
				],
				"date": "2023",
				"ISBN": "9780081027950",
				"abstractNote": "2.1 Introduction Once photodetectors ceased to be used exclusively for creating images aimed to conserve the human memory or communicating ideas and were transformed into measuring devices, they almost immediately found their application in many different areas of science and industry. For an increasing number of applications, mainly related to material inspection and research, automation through optical sensing, particle physics, biology, or medicine, one of the main goals that photodetector technology has been striving for over the last decades is the ability to detect single photons over a variety of photon wavelengths, measuring their exact time of arrival to the detectors' active area and reconstructing their accurate spatial path. In other words, the \"holy grail\" of photodetection became offering the ability to measure as many characteristics as possible of a single photon in absence of other quanta of radiation. This proved to be a quite difficult task.",
				"bookTitle": "Photodetectors",
				"extra": "CLC: 红外探测、红外探测器",
				"language": "en-US",
				"libraryCatalog": "国家科技图书文献中心",
				"pages": "37-72",
				"url": "https://www.nstl.gov.cn/paper_detail.html?id=548dca9c1908bbe3e6df0ba4490c94f2",
				"attachments": [],
				"tags": [
					{
						"tag": "avalanche diode"
					},
					{
						"tag": "other quanta"
					},
					{
						"tag": "photodetection became"
					}
				],
				"notes": [],
				"seeAlso": []
			}
		]
	},
	{
		"type": "web",
		"url": "https://www.nstl.gov.cn/paper_detail.html?id=8232bdce6ef1c515e701e5c8333980b5",
		"items": [
			{
				"itemType": "thesis",
				"title": "跨文化交际中的文化身份",
				"creators": [
					{
						"firstName": "",
						"lastName": "温福兰",
						"creatorType": "author",
						"fieldMode": 1
					},
					{
						"firstName": "",
						"lastName": "肖华锋",
						"creatorType": "contributor",
						"fieldMode": 1
					}
				],
				"date": "2005-09-01",
				"abstractNote": "Chapter One.Introduction  1.1.The Significance of the Thesis\n    Cultural identity is important in intercultural communication，because a   person's cultural identity exerts a profound influence on his or her communicative   style and there are cultural differences in the structures of expectation to identity.  When people from different ethnic or cultural background come in contact，cultural   differences and historical and economical disparity between these cultural or social   groups Can easily lead to stereotyping，prejudice，discrimination，ethnocentrism，  which are serious pronems to effective intercultural communication. Sometimes   cultural conflicts occur.among which identity conflict is one of those intractable   conflicts.So，it is important for people to appreciate what constitutes membership in   the cultures and how that membership might influence the manner in which people   approach，perceive，and interact with other cultures.  1.2.The Purpose of the Thesis\n    This thesis is the study of cultural identity of sonic minority or marginalized  social groups.The author describes stereotypes，prejudice，discrimination based on  those identities，analyses their formation from the cultural，social.political and  historical perspectives and their negative effects on intercultural communication,in  ordder that we can develop our sensitivity to cultural diversity and cultural differences  and find out some practical approaches to effective intercultural communication  1.3.The PractieaI Value of the Thesis\n    Cultural identity is a controversial issue all around the world.\n    Cultural diversity has become a fact.Cultural diversity is considered as one of  key phenomena shaping the contemporary world and greatly enhances sensitivity to  cultural identity.Today,in an age when discrete cultures themselves are under threat.the question of cultural identity becomes newly problematic and takes on new urgency.People become more and more concerned about the uniqueness or the particularity of their own culture.National governments that promote multicultural，multiracial harmony like Singapore，or the United States，in fact eahance ethnic separateness by constantly drawing attention tO“racial”,or“ethnic”identities.\n    Contemporarily or in the long run，to preserve and promote cultural identities  and to discover their traditional value and adaptive function can achieve the harmony  of multicultural or multiethnic societies，and eventual integration and assimilation of cultures，whether on the global level or on the local level.So，the study of cultaral identity in this thesis embodies great practical and historical value.1.4.Methodity\n    Theoretical and methodological developments of recent decades have transformed anthropology by situating local ethnographic researches within larger systems of power,and by focusing attention on the complex relationships between local communities and larger-scale structures within which these communities are embedded.Studying multi-level，multi-sited research problems is undertaken through the local setting but frames them in terms of global issues and often incorporates ethnographic experience elsewhere.Sociocultural and linguistic anthropologists share a study of many key phenomena and critically analyze and theorize these phenomena through ethnographic investigation of contemporary social, cultural，political，economic，and communicative processes.\n    This thesis is to study communicative problems based on some cultural identities in intercultural communication.The author develops this study on the basis of sociocultural，anthropological and ethnographic approaches.",
				"extra": "CLC: H030;H315",
				"language": "zh-CN",
				"libraryCatalog": "国家科技图书文献中心",
				"numPages": "57",
				"thesisType": "硕士学位论文",
				"university": "江西师范大学",
				"url": "https://www.nstl.gov.cn/paper_detail.html?id=8232bdce6ef1c515e701e5c8333980b5",
				"attachments": [],
				"tags": [
					{
						"tag": "功能语言学"
					},
					{
						"tag": "文化身份"
					},
					{
						"tag": "语篇体裁"
					},
					{
						"tag": "语言空间"
					},
					{
						"tag": "跨文化交际"
					}
				],
				"notes": [],
				"seeAlso": []
			}
		]
	},
	{
		"type": "web",
		"url": "https://www.nstl.gov.cn/paper_detail.html?id=62a65387857fda4549fa792153075229",
		"items": [
			{
				"itemType": "bookSection",
				"title": "量子ドットによる細胞イメージング",
				"creators": [
					{
						"firstName": "",
						"lastName": "加地範匡",
						"creatorType": "author",
						"fieldMode": 1
					},
					{
						"firstName": "",
						"lastName": "渡慶次学",
						"creatorType": "author",
						"fieldMode": 1
					},
					{
						"firstName": "",
						"lastName": "馬場嘉信",
						"creatorType": "author",
						"fieldMode": 1
					}
				],
				"date": "2007",
				"abstractNote": "蛍光性半導体ナノ結晶、すなわち量子ドット(QDs)は、電子材料として開発されて以来、ここ十数年の間に著しく改良が加えられ、生物学分野へまでその適用範囲を拡げてきた。量子ドットは、半導体材料であるCdSeやCdTe,InP,InAsなどの様々な材料から合成され、それぞれのバンドギヤップエネルギーに応じた蛍光波長を有する。",
				"bookTitle": "電気学会研究会資料 バイオ·マイクロシステム研究会 BMS-07-1~6",
				"extra": "original-title: Bio-Molecule Imaging by Quantum Dots\nCLC: 医疗器械与设备",
				"language": "jp-JP",
				"libraryCatalog": "国家科技图书文献中心",
				"pages": "25-28",
				"url": "https://www.nstl.gov.cn/paper_detail.html?id=62a65387857fda4549fa792153075229",
				"attachments": [],
				"tags": [
					{
						"tag": "DNA"
					},
					{
						"tag": "イメージング"
					},
					{
						"tag": "細胞内導入"
					},
					{
						"tag": "量子ドット"
					}
				],
				"notes": [],
				"seeAlso": []
			}
		]
	},
	{
		"type": "web",
		"url": "https://www.nstl.gov.cn/paper_detail.html?id=031c48a44b069d07c3405be97782013f",
		"items": [
			{
				"itemType": "standard",
				"title": "制药机械(设备)材料选用导则",
				"creators": [],
				"date": "2023-03-17",
				"extra": "ICS: 11.120.30\nCSS: 制药、安全机械与设备综合\napplyDate: 2023-10-01\noriginal-title: General for selection material of pharmaceutical machinery\nCLC: 制药、安全机械与设备综合",
				"language": "zh-CN",
				"libraryCatalog": "国家科技图书文献中心",
				"number": "GB/T 42354—2023",
				"organization": "国药集团重庆医药设计院有限公司, 山西太钢不锈钢股份有限公司, 中国制药装备行业协会, 湖南千山制药机械股份有限公司, 浙江厚达智能科技股份有限公司",
				"url": "https://www.nstl.gov.cn/paper_detail.html?id=031c48a44b069d07c3405be97782013f",
				"attachments": [],
				"tags": [],
				"notes": [],
				"seeAlso": []
			}
		]
	},
	{
		"type": "web",
		"url": "https://www.nstl.gov.cn/paper_detail.html?id=693a65c33411667d124712efa881aca8",
		"items": [
			{
				"itemType": "patent",
				"title": "不锈钢平底锅",
				"creators": [
					{
						"firstName": "",
						"lastName": "黄桂深",
						"creatorType": "inventor",
						"fieldMode": 1
					}
				],
				"issueDate": "2023-03-14",
				"abstractNote": "1.本外观设计产品的名称：不锈钢平底锅。2.本外观设计产品的用途：本外观设计产品用于烹调食物的锅。3.本外观设计产品的设计要点：在于形状。4.最能表明设计要点的图片或照片：立体图1。5.仰视图已在立体图2中体现出来故省略，省略仰视图。",
				"applicationNumber": "CN202230481835.9",
				"country": "中国",
				"filingDate": "2022-07-27",
				"language": "zh-CN",
				"legalStatus": "有效",
				"place": "中国",
				"url": "https://www.nstl.gov.cn/paper_detail.html?id=693a65c33411667d124712efa881aca8",
				"attachments": [],
				"tags": [],
				"notes": [],
				"seeAlso": []
			}
		]
	}
]
/** END TEST CASES **/
