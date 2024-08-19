{
	"translatorID": "bd4ef2e5-6f1f-4c5e-8638-e1fc1226bf8c",
	"label": "NTU Digital Library of Buddhist Studies",
	"creator": "jiaojiaodubai",
	"target": "^https://buddhism\\.lib\\.ntu\\.edu\\.tw",
	"minVersion": "5.0",
	"maxVersion": "",
	"priority": 100,
	"inRepository": true,
	"translatorType": 4,
	"browserSupport": "gcsibv",
	"lastUpdated": "2024-06-20 16:34:51"
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

var typeMap = {
	'期刊論文=Journal Article': 'journalArticle',
	'書籍=Book': 'book',
	'專題研究論文=Research Paper': 'book',
	'工具書=Reference Book': 'book',
	'博碩士論文=Thesis and Dissertation': 'thesis',
	'會議論文=Proceeding Article': 'conferencePaper',
	'連續性出版品=Serial': 'book',
	'其他=Others': 'document',
	'書評=Book Review': 'document',
	'網路資料=Internet Resrouce': 'document',
	'錄音資料=Sound Recording': 'audioRecording',
	'電影片及錄影資料=Audiovisual': 'videoRecording'
};

function detectWeb(doc, _url) {
	let docType = new Labels(doc, '.MainPanelCenter > table table:nth-of-type(2) > tbody > tr').get(['資料類型', 'Contenttype', '資料の種類']);
	let typeKey = Object.keys(typeMap).find(key => docType.includes(key));
	if (typeKey) {
		return typeMap[typeKey];
	}
	else if (getSearchResults(doc, true)) {
		return 'multiple';
	}
	return false;
}

function getSearchResults(doc, checkOnly) {
	var items = {};
	var found = false;
	var rows = doc.querySelectorAll('a.booktitle,a[href*="search_detail.jsp?seq="]');
	for (let row of rows) {
		let href = row.href;
		let title = row.getAttribute('title') || ZU.trimInternal(row.textContent);
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

/* 有meta可以用,但是meta的数据没有分割,且元数据不全面,因此还是用 */
async function scrape(doc, url = doc.location.href) {
	let labels = new Labels(doc, '.MainPanelCenter > table table:nth-of-type(2) > tbody > tr');
	Z.debug(labels.innerData.map(arr => [arr[0], ZU.trimInternal(arr[1].textContent)]));
	let extra = new Extra();
	let newItem = new Z.Item(detectWeb(doc, url));
	newItem.title = meta('title');
	extra.set('original-title', meta('title', true), true);
	if (/^(.+?)\s?(：|——|─)/.test(newItem.title)) {
		newItem.shortTitle = tryMatch(newItem.title, /^(.+?)\s?(：|——|─)/, 1);
	}
	function meta(name, original = false) {
		let content = attr(doc, `meta[name="citation_${name}"]`, 'content');
		return split(content, original);
	}
	newItem.abstractNote = labels.get(['摘要', 'Abstract', '抄録']);
	let creators = [];
	doc.querySelectorAll('meta[name="citation_author"]').forEach((element) => {
		creators.push(processName(element.getAttribute('content')));
	});
	switch (newItem.itemType) {
		case 'journalArticle':
			newItem.publicationTitle = meta('journal_title');
			extra.set('original-container-title', meta('journal_title', true), true);
			newItem.volume = meta('volume').replace(/0*(\d+)/, '$1');
			newItem.issue = meta('issue').replace(/0*(\d+)/, '$1');
			newItem.pages = Array.from(new Set([meta('firstpage'), meta('lastpage')])).join('-');
			newItem.ISSN = ZU.cleanISSN(meta('issn'));
			break;
		case 'book':
			newItem.series = labels.get(['叢書名', 'Series', 'シリーズ']);
			newItem.seriesNumber = labels.get(['叢書號', 'Series No', 'シリーズナンバー']);
			newItem.volume = meta('issue');
			newItem.ISBN = ZU.cleanISBN(meta('issn'));
			if (labels.get(['資料類型', 'Contenttype', '資料の種類']).includes('專題研究論文=Research Paper')) {
				newItem.itemType = 'bookSection';
				newItem.pages = Array.from(new Set([meta('firstpage'), meta('lastpage')])).join('-');
			}
			break;
		case 'conferencePaper':
			newItem.proceedingsTitle = meta('journal_title');
			newItem.pages = Array.from(new Set([meta('firstpage'), meta('lastpage')])).join('-');
			break;
		case 'thesis':
			newItem.thesisType = (() => {
				if (url.includes('/en/')) {
					return {
						master: "Master's thesis",
						doctor: 'Doctoral dissertation',
					}[labels.get('Degree')] || [labels.get('Degree')];
				}
				else if (url.includes('/jp/')) {
					return labels.get('学位') + '号論文';
				}
				return labels.get('學位類別') + '學位論文';
			});
			newItem.university = labels.get(['校院名稱', '学校', 'Institution']);
			labels.get(['指導教授', 'Advisor', '指導教官']).split(/\s?;\s?/).forEach(creator => creators.push(processName(creator, 'contributor')));
			newItem.numPages = meta('firstpage');
			break;
		case 'document':
			extra.set('container-title', labels.get('出處題名'), true);
			break;
	}
	newItem.date = ZU.strToISO(meta('date'));
	newItem.language = meta('language');
	newItem.url = tryMatch(url, /^.+seq=\d+/);
	[
		{ key: 'publisher', value: meta('publisher') },
		{ key: 'place', value: tryMatch(labels.get(['出版地', 'Location']), /^(.+?)\[/, 1) },
		// https://buddhism.lib.ntu.edu.tw/DLMBS/search/search_detail.jsp?seq=646597
		{ key: 'DOI', value: ZU.cleanDOI(labels.get('DOI')) }

	].forEach((obj) => {
		if (ZU.fieldIsValidForType(obj.key, newItem.itemType)) {
			newItem[obj.key] = obj.value;
		}
		else {
			extra.set(obj.key, obj.value, true);
		}
	});
	extra.set('original-publisher-place', tryMatch(labels.get('出版地'), /\[(.+?)\]$/, 1), true);
	extra.set('remark', labels.get(['附註項', 'Note', 'ノート']));
	extra.set('view', labels.get(['點閱次數', 'Hits', 'ヒット数']));
	extra.set('publisherURL', labels.get(['出版者網址', 'Publisher URL', '出版サイト']));
	if (creators.some(creator => creator.original)) {
		extra.set('creatorsExt', JSON.stringify(creators));
	}
	creators.forEach((creator) => {
		extra.set('original-author', creator.original, true);
		delete creator.original;
		newItem.creators.push(creator);
	});
	newItem.extra = extra.toString();
	let pdfLink = doc.querySelector('#fulltextdownload a');
	if (pdfLink) {
		newItem.attachments.push({
			url: pdfLink.href,
			title: 'Full Text PDF',
			mimeType: 'application/pdf'
		});
	}
	newItem.attachments.push({
		title: 'Snapshot',
		document: doc
	});
	newItem.tags = attr(doc, 'meta[name="citation_keywords"]', 'content').split('; ').map(keywordPair => split(keywordPair));
	if (labels.get(['目次', 'Table of contents'], true).querySelector('td')) {
		newItem.notes.push('<h1>目次</h1>' + labels.get(['目次', 'Table of contents'], true).querySelector('td').innerHTML);
	}
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

class Extra {
	constructor() {
		this.fields = [];
	}

	push(key, val, csl = false) {
		this.fields.push({ key: key, val: val, csl: csl });
	}

	set(key, val, csl = false) {
		let target = this.fields.find(obj => new RegExp(`^${key}$`, 'i').test(obj.key));
		if (target) {
			target.val = val;
		}
		else {
			this.push(key, val, csl);
		}
	}

	get(key) {
		let result = this.fields.find(obj => new RegExp(`^${key}$`, 'i').test(obj.key));
		return result
			? result.val
			: undefined;
	}

	toString(history = '') {
		this.fields = this.fields.filter(obj => obj.val);
		return [
			this.fields.filter(obj => obj.csl).map(obj => `${obj.key}: ${obj.val}`).join('\n'),
			history,
			this.fields.filter(obj => !obj.csl).map(obj => `${obj.key}: ${obj.val}`).join('\n')
		].filter(obj => obj).join('\n');
	}
}

function tryMatch(string, pattern, index = 0) {
	let match = string.match(pattern);
	if (match && match[index]) {
		return match[index];
	}
	return '';
}

function processName(creator, creatorType = 'author') {
	let zhName = split(creator).replace(/\s?\(.+?\)$/, '');
	let enName = split(creator, true).replace(/\s?\(.+?\)$/, '');
	creator = ZU.cleanAuthor(zhName, creatorType);
	if (/[\u4e00-\u9fff]/.test(creator.lastName)) {
		creator.lastName = creator.firstName + creator.lastName;
		creator.firstName = '';
		creator.fieldMode = 1;
	}
	creator.original = enName;
	return creator;
}

function split(string, original = false) {
	return original
		? tryMatch(string, /=(.+)$/, 1)
		: tryMatch(string, /^([^=]+)=?/, 1);
}

/** BEGIN TEST CASES **/
var testCases = [
	{
		"type": "web",
		"url": "https://buddhism.lib.ntu.edu.tw/DLMBS/search/search_detail.jsp?seq=573702",
		"items": [
			{
				"itemType": "journalArticle",
				"title": "馬來西亞華人宗教素食觀之宗教教育意義與實踐",
				"creators": [
					{
						"firstName": "",
						"lastName": "陳愛梅",
						"creatorType": "author",
						"fieldMode": 1
					},
					{
						"firstName": "",
						"lastName": "嚴家建",
						"creatorType": "author",
						"fieldMode": 1
					}
				],
				"date": "2016-06-01",
				"ISSN": "1015-8383",
				"abstractNote": "通過比較的方式，這篇論文主要梳理馬來西亞華人宗教素食觀的特色及其宗教教育意義。馬來西亞華人社會中吃素往往是普遍的宗教現象，特別是漢傳佛教、道教以及一貫道的素食觀大都有經典或教理為依據。本文將以此三教關於持素的說法為主，結合它們在馬來西亞的情況，探討其中的宗教教育意義。以素食為「常食」者，多是漢傳佛教和一貫道信徒，「非常食」則以九皇齋最為普遍。此外，儘管華人民間信仰中關於持素的經文缺如，但本文將以「吃素的大伯公」此個例講述民間信仰的吃素觀念。通過主張素食，這些華人宗教可以在深奧的宗教義理之外勸導信徒慈悲戒殺、視萬物為等齊、仁慈為本等等，從宗教教育這方面引導信眾道德倫理，不失為宗教教育中較為容易推行的一環。By way of comparison, this paper deals with vegetarianism among Chinese Religions in Malaysia, with reference to Chinese Buddhism, Taoism, I-Kuan Tao and Chinese Folk Religion, which are represented mostly by the Chinese ethnic. Vegetarians opt to become vegetarian with many different reasons. However, vegetarianism is a common religious phenomenon in Malaysian Chinese community. The concepts of vegetarian are well embedded in the scriptures and doctrines of Chinese Buddhism, Taoism and I-Kuan Tao. This paper first probes into the religious views on vegetarianism of Chinese Buddhism, Taoism and I-Kuan Tao, then elaborate further their situation in Malaysia, in order to explore the significance of religious education of these vegetarian standpoints. In addition, although Chinese Folk Religion lacks supporting scripture when it comes to vegetarianism, this article suggests that the case of ＂Vegetarian Ta-po Kong＂ shows how the concept of vegetarian is being treated in Chinese Folk Religion. This paper deems that by advocating vegetarianism, these Chinese Religions can persuade believers to show mercy, refrain from killing, treat all things equally, and etc., hence instill in them moral ethics by means of religious education, which in turn seems like an easy implementation as far as religion education is concerned.",
				"extra": "original-title: The Religious Education Meanings and Practices on Chinese Religious Vegetarian in Malaysia\noriginal-author: Yam, Kah-kean\noriginal-container-title: Monthly Review of Philosophy and Culture\npublisher: 哲學與文化月刊雜誌社\nplace: 臺北市, 臺灣 \noriginal-publisher-place: Taipei shih, Taiwan\ncreatorsExt: [{\"firstName\":\"\",\"lastName\":\"陳愛梅\",\"creatorType\":\"author\",\"fieldMode\":1,\"original\":\"Tan, Ai-boay\"},{\"firstName\":\"\",\"lastName\":\"嚴家建\",\"creatorType\":\"author\",\"fieldMode\":1,\"original\":\"Yam, Kah-kean\"}]\nremark: 作者單位：陳愛梅，拉曼大學中文系；嚴家建，馬來亞大學中文系。\nview: 288\npublisherURL: http://www.umrpc.fju.edu.tw",
				"issue": "6",
				"language": "zh",
				"libraryCatalog": "NTU Digital Library of Buddhist Studies",
				"pages": "137-152",
				"publicationTitle": "哲學與文化",
				"url": "https://buddhism.lib.ntu.edu.tw/DLMBS/search/search_detail.jsp?seq=573702",
				"volume": "43",
				"attachments": [
					{
						"title": "Full Text PDF",
						"mimeType": "application/pdf"
					},
					{
						"title": "Snapshot",
						"mimeType": "text/html"
					}
				],
				"tags": [
					{
						"tag": "九皇"
					},
					{
						"tag": "大伯公"
					},
					{
						"tag": "漢傳佛教"
					},
					{
						"tag": "素食"
					},
					{
						"tag": "華人宗教"
					}
				],
				"notes": [
					"<h1>目次</h1>壹、前言 137<br>貳、漢傳佛教的素食觀 139<br>一、平等的生命觀 139<br>二、長養慈悲 139<br>三、斷貪欲 140<br>參、道教的素食觀 140<br>一、殺戮有傷氣運 141<br>二、不同層面的生命觀 142<br>三、消災獲功德 143<br>肆、一貫道的素食觀 143<br>一、末世救劫和上昇天界 143<br>二、源自理天的生命觀 144<br>伍、馬來西亞華人宗教的素食概況 145<br>一、漢傳佛教——持素是傳教的契機 145<br>二、道教九皇誕——典型的非常食齋期 146<br>三、一貫道——因信仰而創業 146<br>四、民間信仰——吃素成佛的大伯公 147<br>陸、結語 147"
				],
				"seeAlso": []
			}
		]
	},
	{
		"type": "web",
		"url": "https://buddhism.lib.ntu.edu.tw/search/search_detail.jsp?seq=350002",
		"items": [
			{
				"itemType": "book",
				"title": "《摩訶止觀》之圓頓義，佛教的般若思想及其在中國的發展",
				"creators": [
					{
						"firstName": "",
						"lastName": "佛光山文教基金會",
						"creatorType": "author",
						"fieldMode": 1
					},
					{
						"firstName": "",
						"lastName": "戈國龍",
						"creatorType": "author",
						"fieldMode": 1
					},
					{
						"firstName": "",
						"lastName": "姚衛群",
						"creatorType": "author",
						"fieldMode": 1
					}
				],
				"date": "2001",
				"ISBN": "9789575439545",
				"extra": "original-publisher-place: Kaohsiung hsien, Taiwan\nremark: 共一百一十冊; (法藏文庫碩博士學位論文)\nview: 463\npublisherURL: https://fgs.webgo.com.tw/",
				"language": "zh",
				"libraryCatalog": "NTU Digital Library of Buddhist Studies",
				"place": "高雄縣, 臺灣",
				"publisher": "佛光山文教基金會",
				"series": "法藏文庫",
				"seriesNumber": "4",
				"url": "https://buddhism.lib.ntu.edu.tw/search/search_detail.jsp?seq=350002",
				"attachments": [
					{
						"title": "Snapshot",
						"mimeType": "text/html"
					}
				],
				"tags": [
					{
						"tag": "摩訶止觀"
					},
					{
						"tag": "般若思想"
					}
				],
				"notes": [],
				"seeAlso": []
			}
		]
	},
	{
		"type": "web",
		"url": "https://buddhism.lib.ntu.edu.tw/search/search_detail.jsp?seq=346749",
		"items": [
			{
				"itemType": "bookSection",
				"title": "元廷所傳西藏秘法考敘",
				"creators": [
					{
						"firstName": "",
						"lastName": "王堯",
						"creatorType": "author",
						"fieldMode": 1
					}
				],
				"date": "1998",
				"ISBN": "9789575437558",
				"extra": "original-publisher-place: Taipei shih, Taiwan\nremark: (佛光文選; 5807)\nview: 286\npublisherURL: http://www.hsilai.org/chinese/giftshop/GiftShop_main.asp",
				"language": "zh",
				"libraryCatalog": "NTU Digital Library of Buddhist Studies",
				"pages": "471-493",
				"place": "臺北市, 臺灣",
				"publisher": "佛光出版社",
				"url": "https://buddhism.lib.ntu.edu.tw/search/search_detail.jsp?seq=346749",
				"attachments": [
					{
						"title": "Snapshot",
						"mimeType": "text/html"
					}
				],
				"tags": [
					{
						"tag": "元代"
					},
					{
						"tag": "王堯"
					},
					{
						"tag": "藏傳佛教"
					}
				],
				"notes": [],
				"seeAlso": []
			}
		]
	},
	{
		"type": "web",
		"url": "https://buddhism.lib.ntu.edu.tw/search/search_detail.jsp?seq=267535",
		"items": [
			{
				"itemType": "book",
				"title": "第十三世達賴喇嘛年譜",
				"creators": [
					{
						"firstName": "",
						"lastName": "西藏自治區政協文史資料研究委員會",
						"creatorType": "author",
						"fieldMode": 1
					},
					{
						"firstName": "",
						"lastName": "耿昇",
						"creatorType": "author",
						"fieldMode": 1
					}
				],
				"date": "1989",
				"extra": "original-publisher-place: Beijing, China\nremark: 本書為簡體字印行.第十三世達賴喇嘛名羅桑陶凱嘉措,1876-1933年\nview: 231",
				"language": "zh",
				"libraryCatalog": "NTU Digital Library of Buddhist Studies",
				"place": "北京, 中國",
				"publisher": "民族出版社",
				"url": "https://buddhism.lib.ntu.edu.tw/search/search_detail.jsp?seq=267535",
				"attachments": [
					{
						"title": "Snapshot",
						"mimeType": "text/html"
					}
				],
				"tags": [
					{
						"tag": "喇嘛"
					},
					{
						"tag": "達賴喇嘛"
					}
				],
				"notes": [],
				"seeAlso": []
			}
		]
	},
	{
		"type": "web",
		"url": "https://buddhism.lib.ntu.edu.tw/DLMBS/search/search_detail.jsp?seq=156876",
		"items": [
			{
				"itemType": "thesis",
				"title": "The Deconstruction of Being by Value: Toward New Foundations for Psychotherapy",
				"creators": [
					{
						"firstName": "Norris, Carl",
						"lastName": "William",
						"creatorType": "author"
					},
					{
						"firstName": "Stighano",
						"lastName": "Anthony",
						"creatorType": "contributor"
					}
				],
				"date": "2001",
				"abstractNote": "The inability of the field of psychotherapy to enter into moral discourse according to limitations imposed by the epistemology and ontology it has borrowed from academic psychology was used as a deconstructive heuristic to examine the assumptions underlying these foundations. A search was made for components from which a more appropriate foundation for psychotherapy might be constructed by examining the relationship of being to value in early Greek thought, the contemporary writings of Heidegger, Levinas, and Derrida, and the Buddhist viewpoints of Nagarjuna and Shantideva. Tentative psychotherapy foundations are suggested in which value, rather than consisting of an optional appendage to being, is both integral and constuitive. At the same time, I maintain that shifts in value deconstruct being, allowing alternative configurations to emerge that may be psychotherapeutically useful. In this view, truth is a situationally, rather than cognitively, based creatively appropriate response that is healing. Arguments for this interpretation are presented at two levels of discourse, one in terms of conceptual analysis and the other personal narrative based on a phenomenological account of the AIDS pandemic.",
				"extra": "publisher: Alliant International University, San Francisco Bay\noriginal-publisher-place: 舊金山, 加利福尼亞州, 美國\nview: 1199\npublisherURL: http://www.alliant.edu/wps/wcm/connect/website",
				"language": "en",
				"libraryCatalog": "NTU Digital Library of Buddhist Studies",
				"numPages": "419",
				"place": "San Francisco, CA, US",
				"shortTitle": "The Deconstruction of Being by Value",
				"thesisType": "博士學位論文",
				"university": "Alliant International University",
				"url": "https://buddhism.lib.ntu.edu.tw/DLMBS/search/search_detail.jsp?seq=156876",
				"attachments": [
					{
						"title": "Full Text PDF",
						"mimeType": "application/pdf"
					},
					{
						"title": "Snapshot",
						"mimeType": "text/html"
					}
				],
				"tags": [
					{
						"tag": "佛教人物"
					},
					{
						"tag": "寂天菩薩"
					},
					{
						"tag": "本體論"
					},
					{
						"tag": "認識論"
					},
					{
						"tag": "龍樹"
					}
				],
				"notes": [],
				"seeAlso": []
			}
		]
	},
	{
		"type": "web",
		"url": "https://buddhism.lib.ntu.edu.tw/search/search_detail.jsp?seq=125799",
		"items": [
			{
				"itemType": "thesis",
				"title": "《成遮詮論》與科學方法：印度佛教邏輯學中的詞義分異理論與西方科學與經驗論的比較研究",
				"creators": [
					{
						"firstName": "",
						"lastName": "權道玄",
						"creatorType": "author",
						"fieldMode": 1
					},
					{
						"firstName": "",
						"lastName": "王邦維",
						"creatorType": "contributor",
						"fieldMode": 1
					}
				],
				"date": "1995",
				"extra": "publisher: 北京大學東語系印度語言文學專業\noriginal-publisher-place: China\nview: 200",
				"language": "zh",
				"libraryCatalog": "NTU Digital Library of Buddhist Studies",
				"place": "中國",
				"shortTitle": "《成遮詮論》與科學方法",
				"thesisType": "碩士學位論文",
				"university": "北京大學",
				"url": "https://buddhism.lib.ntu.edu.tw/search/search_detail.jsp?seq=125799",
				"attachments": [
					{
						"title": "Snapshot",
						"mimeType": "text/html"
					}
				],
				"tags": [
					{
						"tag": "印度佛教"
					},
					{
						"tag": "成遮詮論"
					},
					{
						"tag": "西方科學"
					}
				],
				"notes": [],
				"seeAlso": []
			}
		]
	},
	{
		"type": "web",
		"url": "https://buddhism.lib.ntu.edu.tw/DLMBS/search/search_detail.jsp?seq=599520",
		"items": [
			{
				"itemType": "conferencePaper",
				"title": "華嚴哲學與曹洞禪風的交涉 ─ 以宏智正覺與萬松行秀禪學思想為考察中心",
				"creators": [
					{
						"firstName": "",
						"lastName": "黃連忠",
						"creatorType": "author",
						"fieldMode": 1
					}
				],
				"date": "2014-03",
				"extra": "original-publisher-place: Taipei, Taiwan\nremark: 作者單位:高苑科技大學通識教育中心 助理教授\nview: 1421\npublisherURL: https://www.huayen.org.tw/",
				"language": "zh",
				"libraryCatalog": "NTU Digital Library of Buddhist Studies",
				"pages": "355-368",
				"place": "臺北, 臺灣",
				"proceedingsTitle": "《華嚴專宗國際學術研討會論文集2013》下冊",
				"publisher": "華嚴蓮社",
				"shortTitle": "華嚴哲學與曹洞禪風的交涉",
				"url": "https://buddhism.lib.ntu.edu.tw/DLMBS/search/search_detail.jsp?seq=599520",
				"attachments": [
					{
						"title": "Full Text PDF",
						"mimeType": "application/pdf"
					},
					{
						"title": "Snapshot",
						"mimeType": "text/html"
					}
				],
				"tags": [],
				"notes": [
					"<h1>目次</h1>一、前言 355<br>二、宏智正覺與萬松行秀對華嚴思想的詮釋與應用 356<br>三、結論 365"
				],
				"seeAlso": []
			}
		]
	},
	{
		"type": "web",
		"url": "https://buddhism.lib.ntu.edu.tw/search/search_detail.jsp?seq=544739",
		"items": [
			{
				"itemType": "book",
				"title": "人生 n.351：妙音傳法音：來聽佛教音樂",
				"creators": [
					{
						"firstName": "",
						"lastName": "人生雜誌編輯部",
						"creatorType": "author",
						"fieldMode": 1
					}
				],
				"date": "2012-11-01",
				"abstractNote": "還記得太虛大師寫詞、弘一法師所譜曲的〈三寶歌〉嗎？梵唄與佛曲到底有什麼不同？弘揚佛法為什麼需要音樂？本期專題從歷史來看梵唄與佛曲發展的淵源；透過Q&A來解答大眾對佛教音樂定義的疑惑，認識梵唄與佛曲的不同；藉由觀察佛教教團發展出的佛教讚唄團、音樂手語劇，來看臺灣佛教音樂的創新與發展；還有佛曲創作人奕睆、歌手孟庭葦與音樂製作人戴維雄分享，他們與佛教音樂的結緣經過與影響。另外，關於佛教音樂知識補充站，介紹佛教首位音樂家馬鳴菩薩、敦煌壁畫中伎樂飛天演變、古代流行的佛曲，以及當代大師的佛曲創作，包括了太虛大師、弘一法師、星雲法師與聖嚴法師 。佛教徒可以養寵物嗎？帶寵物做早晚課有用嗎？「學佛新手Q&A」讓人不再困擾。正逢法鼓山大悲心水陸法會啟建之際，「佛藝好修行」吳大仁老師所指導的手工線裝書，非常適合書法鈔經。對視障者來說，每踏出一步都需要勇氣，前面充斥著有形與無形的障礙，「電影與人生」介紹《逆光飛翔》，一個視障青年與愛跳舞女孩相伴跨越障礙，縱使逆著光，也要朝著夢想前進。",
				"extra": "original-publisher-place: Taipei shih, Taiwan\nview: 212\npublisherURL: http://www.humanity.com.tw/2.asp",
				"language": "zh",
				"libraryCatalog": "NTU Digital Library of Buddhist Studies",
				"place": "臺北市, 臺灣",
				"publisher": "人生雜誌社",
				"shortTitle": "人生 n.351",
				"url": "https://buddhism.lib.ntu.edu.tw/search/search_detail.jsp?seq=544739",
				"volume": "351",
				"attachments": [
					{
						"title": "Snapshot",
						"mimeType": "text/html"
					}
				],
				"tags": [],
				"notes": [
					"<h1>目次</h1>【本期專題】<br>妙音傳法音──來聽佛教音樂 10<br>佛曲弘法，「樂」來「樂」清淨　黃佳卿 12<br>BOX：佛教首位音樂家──馬鳴　許翠谷 16<br>BOX：用音聲弘法的緊那羅、乾闥婆 17<br>BOX：走入敦煌，聆聽飛天 18<br><br>【歷史篇】<br>佛教音樂傳唱二千年　黃佳卿 20<br>BOX：古代佛曲流行什麼曲調？ 24<br>BOX：當代大師的佛曲創作 26 <br><br>【認識篇】<br>佛教音樂Q&amp;A　編輯室 28<br><br>【觀察篇】<br>臺灣佛教音樂創新與發展　陳雪玉 30<br>BOX：當代教團的歌詠頌法　編輯室 36<br><br>【分享篇】<br>王俊雄 唱佛曲如禪修　邱惠敏 38<br>孟庭葦 用歌聲傳遞歡喜、善念　梁金滿 41<br>戴維雄 讓音樂自己說話　許翠谷 44<br><br>【智慧人生】 <br>知福惜福最幸福　聖嚴法師 06<br><br>【特別報導】<br>文字弘法 佛教期刊再出發──參與「佛教期刊發展研討會」紀實　梁金滿 48<br><br>【當代關懷】<br>真華法師　參學行化留史料　侯坤宏 52<br><br>【學佛新手Q&amp;A】<br>帶寵物做早晚課有用嗎？　編輯室 58<br><br>【清心自在】<br>到歐洲撒下禪法種子──2012德英禪七紀實　釋常隨 60<br><br>【佛藝好修行】<br>手工線裝鈔經本　示範／吳大仁 66<br><br>【農禪悟語】<br>止靜的母蝗　釋果祥  74<br><br>【遇見西洋僧】<br>領執，回饋的開始　文／釋常聞 中譯／法鼓山國際編譯組 76<br> <br>【爾然禪話】　　　<br>睡覺　釋繼程 82<br><br>【禪味點心坊】<br>秋栗椰奶&amp;地瓜銅鑼燒　陳滿花 84<br><br>【電影與人生】<br>逆光飛翔──你真的看到了嗎？　辜琮瑜  88<br><br>【人生新視界】 <br>臺灣與日本之「安寧療護」臨床宗教師培訓計畫交流紀實　釋惠敏 94<br><br>【佛法關鍵字】<br>睡眠middha　許洋主 100<br><br> 人生新聞 124<br><br>※ 大覺智海-別冊<br><br>【巨浪迴瀾】<br>天上人間信獨步──晚明賢首宗寶通系開山月川鎮澄　廖肇亨 104<br><br>【禪修指要】<br>作意圓滿──《六門教授習定論》正依門（四　釋繼程 108<br><br>【東亞佛寺之旅】<br>間關鶯語花底滑──鎌倉五山第五淨妙寺　秦 就 114<br><br>【華嚴心鑰】<br>「七處九會」（四）──第七、八會普光明殿察本覺　陳琪瑛 120"
				],
				"seeAlso": []
			}
		]
	},
	{
		"type": "web",
		"url": "https://buddhism.lib.ntu.edu.tw/search/search_detail.jsp?seq=345206",
		"items": [
			{
				"itemType": "document",
				"title": "人間佛教與慈濟志業：慈濟功德會在台灣及亞太地區的網路及社會影響",
				"creators": [
					{
						"firstName": "",
						"lastName": "張維安",
						"creatorType": "author",
						"fieldMode": 1
					}
				],
				"date": "1995-12",
				"abstractNote": "本研究分三年進行，第一年主是以在地的佛教慈濟功德會的特質和在地的活動為分析對象，包括人間佛教的理念特質；第二年以亞太地區的慈濟功德會網絡為分析的主線索，第三年則以慈濟全球化的議題及慈濟現象的社會學理論意涵作為研究的重點。在第一年的研究中，除人間佛教的理念整理和收集新竹地區的慈濟功德會資源回收的資料外，我們已著手收集慈濟功德會在中國大陸的賑災活動，我們在香港，安徽的全椒及蘇北的興化縣，分別做了實地的訪談與參觀，因資料尚屬零碎，又，第二年的計畫仍將前往湖南等地進行其他的觀察，擬將這部分的資料會同到第二年「慈濟功德會在亞太地區」的網絡與社會影響部分一起討論。今年結案的部分包括三個部分，第一部分 是關於慈濟功德會在台灣的一些現象的整理，這部分的整理，作為討論慈濟功德會的一個基礎，分從會員人數，委員人數，捐款，及委員的社會背景的統計資料等加以描述。第二部分則是關於慈濟功德會作為一個人間佛教的傳統，他的主理念發展如何?這部分我們分從最早的太虛和尚提出人生佛教的理念及其社會背景開始分析，再到印順法師對太虛的觀點德修正，後進入當前慈濟功德會的證嚴法師的人間佛教的觀點。我們認為理念和行動具密切的關係，而理念與其所處社會環境等也具相當重要的關聯性，因此我們對三者的理念背景也做一個比較分析。最後再討論慈濟現象的社會基礎。這兩部分主是由本計畫研究助理林宜璇執筆。第三部分是，以慈濟功德會在新竹地區的資源回收活動為研究對象，這是個在地的經驗研究。本研究採用實際參與活動，深入訪談，及文獻分析等方法的綜合運用。在觀點上，則是以日常言行的生活世界做為主觀點，基本看法分述如下：(1) 廣大的慈濟功德會信眾作為宗教理念的承攜者，其所持理念及意義與證嚴法師的理念可能有些距離，但自我認定與瞭解的意義，乃對行動具轉轍功能的意義，其中慈濟功德會的入世宗教理念，在說明慈濟功德會信眾的投入方面具關鍵地位；(2) 其入世的宗教理念，及強調佛教的理念重在實踐而非唸經，使佛教的理念在「日常言行的生活世界」中被實踐出來，本身具重構現實社會的可能性；(3) 慈濟功德會對社會的影響是從底層開始的，是日常生活的，社會性的，這種特質和強調政治性從上而下的結構性改革有所不同；(4)慈濟人的日常言行，並非「個人的」行動，而是形成一個社區，一個新的群體心態結構，慈濟人的社區是個「隱形的社區」，超越地理，族群與階級的界線，其行動具像社會運動與社會改革的的類似功能，這種來自底層的改革，將可能對社會秩序與社會結構產生重要的意義。這部分主由張維安執筆。",
				"extra": "original-title: Inner-Worldly Buddhism and Tzc-Chi's Religious Enterprise: The Network and Social Effects of Tzc-Chi Merit Association in Taiwan and Asian-Pacific Area\nplace: 臺北市, 臺灣 \noriginal-publisher-place: Taipei shih, Taiwan\noriginal-author: Chang, Wei-an\nremark: 執行機構：國立清華大學社會人類學研究所，計畫編號：NSC84-2412-H007-002-J2，研究期間：83年08月 ~ 84年07月\nview: 510\ncreatorsExt: [{\"firstName\":\"\",\"lastName\":\"張維安\",\"creatorType\":\"author\",\"fieldMode\":1,\"original\":\"Chang, Wei-an\"}]",
				"language": "zh",
				"libraryCatalog": "NTU Digital Library of Buddhist Studies",
				"publisher": "行政院國家科學委員會",
				"shortTitle": "人間佛教與慈濟志業",
				"url": "https://buddhism.lib.ntu.edu.tw/search/search_detail.jsp?seq=345206",
				"attachments": [
					{
						"title": "Snapshot",
						"mimeType": "text/html"
					}
				],
				"tags": [
					{
						"tag": "宗教與社會"
					},
					{
						"tag": "慈濟功德會"
					},
					{
						"tag": "理念與行動"
					}
				],
				"notes": [],
				"seeAlso": []
			}
		]
	},
	{
		"type": "web",
		"url": "https://buddhism.lib.ntu.edu.tw/search/search_detail.jsp?seq=181067",
		"items": [
			{
				"itemType": "document",
				"title": "《凈土新論》中的人間佛教思想探源",
				"creators": [
					{
						"firstName": "",
						"lastName": "謝路軍",
						"creatorType": "author",
						"fieldMode": 1
					}
				],
				"date": "2009-06-19",
				"abstractNote": "《淨土新論》是印順法師淨土研究的主要著作。除此之外，其淨土研究的著作還包括了《念佛淺說》(1953年冬台北善導寺講)、《求生天國與往生淨土》(在菲律賓佛教居士林講，年代不詳)、《東方淨土發微》、《東山法門的念佛禪》等，都是延續《淨土新論》的觀點而來。以後加入了一篇《宋譯楞伽與達摩禪》，而成為《淨土與禪》一書，列入妙雲集下編之四，正聞出版社出版。《淨土新論》是一部在台灣佛教界掀起激烈反對聲浪的頗受爭議的著作。盡管如此，其對傳統淨土信仰所作的反省仍是非常系統、非常深刻的。這部著作是印順法師在1951年冬，講於香港青山淨業叢林的演講稿，主要流通區則是在台灣，至1984年已發行至第五版，可見其影響之巨。",
				"extra": "remark: 取自於http://www.fjnet.com/fjlw/200906/t20090619_125330.htm\nview: 190",
				"language": "zh",
				"libraryCatalog": "NTU Digital Library of Buddhist Studies",
				"url": "https://buddhism.lib.ntu.edu.tw/search/search_detail.jsp?seq=181067",
				"attachments": [
					{
						"title": "Full Text PDF",
						"mimeType": "application/pdf"
					},
					{
						"title": "Snapshot",
						"mimeType": "text/html"
					}
				],
				"tags": [],
				"notes": [
					"<h1>目次</h1>一、印順法師的人間佛教思想<br>二、“人間佛教”思想是《淨土新論》的精神底蘊<br>三、《淨土新論》本著“人間佛教”的精神對傳統淨土思想展開批判<br>   (一)淨土觀<br>   (二)修行觀<br>"
				],
				"seeAlso": []
			}
		]
	},
	{
		"type": "web",
		"url": "https://buddhism.lib.ntu.edu.tw/search/search_detail.jsp?seq=297944&q=%E4%BD%9B&qf=TOPIC&comefrom=searchengine",
		"items": [
			{
				"itemType": "audioRecording",
				"title": "人間佛教禪法--基礎禪觀課程",
				"creators": [
					{
						"firstName": "",
						"lastName": "釋性廣",
						"creatorType": "author",
						"fieldMode": 1
					}
				],
				"date": "2001-01",
				"abstractNote": "89年初，法印講堂於鹿野苑舉辦禪七，法師於主七期間之剴切提撕，充滿著深刻的禪者睿智與豐沛的菩薩悲心，至今猶令人難忘！特別是提示「人間佛教禪者」所應有之觀念：老實正常. 平和處眾. 勤奮作務，都是最容易被禪者忽略，卻又非常重要的議題. 法師並開示學眾：離開禪堂後，要有包括常行布施. 戒德莊嚴. 早晚靜坐. 修慈心禪等「日常禪觀功課」，極為務實而人性化. 本講座亦教導日常之禪修功課，可配合法師近著《人間佛教禪法及其當代實踐》 研閱之.",
				"extra": "publisher: 法界出版社\noriginal-publisher-place: Taipei shih, Taiwan\nremark: 錄音卡帶8卷, 每卷60分鐘, 附解說手冊/ 解說手冊《人間佛教禪修行》 單獨贈閱 函索即贈\nview: 571\npublisherURL: http://www.hongshi.org.tw",
				"language": "zh",
				"libraryCatalog": "NTU Digital Library of Buddhist Studies",
				"place": "臺北市, 臺灣",
				"url": "https://buddhism.lib.ntu.edu.tw/search/search_detail.jsp?seq=297944",
				"attachments": [
					{
						"title": "Snapshot",
						"mimeType": "text/html"
					}
				],
				"tags": [
					{
						"tag": "四念住"
					},
					{
						"tag": "慈愛禪"
					},
					{
						"tag": "數息觀"
					}
				],
				"notes": [],
				"seeAlso": []
			}
		]
	},
	{
		"type": "web",
		"url": "https://buddhism.lib.ntu.edu.tw/search/search_detail.jsp?seq=140179",
		"items": [
			{
				"itemType": "videoRecording",
				"title": "離苦得樂的妙法(三)",
				"creators": [
					{
						"firstName": "",
						"lastName": "釋如石",
						"creatorType": "author",
						"fieldMode": 1
					}
				],
				"date": "2010-08",
				"extra": "publisher: 妙有菩提園\noriginal-publisher-place: Nantou hsien, Taiwan\nremark: 釋大勢俗名：郭欽堯\nview: 810\npublisherURL: http://www.deerbridge.idv.tw/index.htm",
				"language": "zh",
				"libraryCatalog": "NTU Digital Library of Buddhist Studies",
				"place": "南投縣, 臺灣",
				"url": "https://buddhism.lib.ntu.edu.tw/search/search_detail.jsp?seq=140179",
				"attachments": [
					{
						"title": "Snapshot",
						"mimeType": "text/html"
					}
				],
				"tags": [],
				"notes": [
					"<h1>目次</h1><br>DVD 1  <br>單元1.生天之論  （1-6） <br>單元2.欲不淨法  漏為大患  出離為要 （1-4） <br>DVD 2 <br>單元1.出家真好 <br>單元2.認清自己  （1-7） <br>單元3.我是那一種人 <br>單元4.為何生為女人 "
				],
				"seeAlso": []
			}
		]
	},
	{
		"type": "web",
		"url": "https://buddhism.lib.ntu.edu.tw/search/search_detail.jsp?seq=335302",
		"items": [
			{
				"itemType": "journalArticle",
				"title": "對《妙法蓮華經玄義研究》的看法",
				"creators": [
					{
						"firstName": "",
						"lastName": "楊惠南",
						"creatorType": "author",
						"fieldMode": 1
					}
				],
				"date": "1998-07",
				"ISSN": "1017-7132",
				"abstractNote": "《法華經》在中、日等佛教北傳的地區當中，向來佔有相當重要的地位，影響的範圍也很廣。很多經典經過翻譯來到北傳地區之後，幾乎就等於是死了的經典，因為很少人讀，甚至完全不知道有這些經典。但是《法華經》卻不然，它一直以不同的形式活著。尤其是一些特別的品，不斷為信徒與研究者所青睞，例如〈觀世音普門品〉，是很多信徒早晚課誦的功課，而〈藥王品〉裡所讚歎的焚身、燃指、燃臂供佛等現象，也仍在佛教界出現。由此可見《法華經》仍存在，以及它的重要性。",
				"extra": "original-container-title: Chung-Hwa Buddhist Journal=Journal of Chinese Buddhist Studies\npublisher: 中華佛學研究所\nplace: 新北市, 臺灣 \noriginal-publisher-place: New Taipei City, Taiwan\noriginal-author: 楊惠男\nview: 1178\npublisherURL: http://www.chibs.edu.tw/publication_tw.php?id=12\ncreatorsExt: [{\"firstName\":\"\",\"lastName\":\"楊惠南\",\"creatorType\":\"author\",\"fieldMode\":1,\"original\":\"楊惠男\"}]",
				"issue": "11",
				"language": "zh",
				"libraryCatalog": "NTU Digital Library of Buddhist Studies",
				"pages": "535-538",
				"publicationTitle": "中華佛學學報",
				"url": "https://buddhism.lib.ntu.edu.tw/search/search_detail.jsp?seq=335302",
				"attachments": [
					{
						"title": "Full Text PDF",
						"mimeType": "application/pdf"
					},
					{
						"title": "Snapshot",
						"mimeType": "text/html"
					}
				],
				"tags": [
					{
						"tag": "妙法蓮華經"
					}
				],
				"notes": [],
				"seeAlso": []
			}
		]
	},
	{
		"type": "web",
		"url": "https://buddhism.lib.ntu.edu.tw/search/default.jsp#1",
		"items": "multiple"
	},
	{
		"type": "web",
		"url": "https://buddhism.lib.ntu.edu.tw/author/authorinfo.jsp?ID=52849",
		"items": "multiple"
	}
]

/** END TEST CASES **/
