{
	"translatorID": "79caf3fe-8fd0-4f61-9cf3-c33237d78cdf",
	"label": "Angle",
	"creator": "jiaojiaodubai",
	"target": "^https://www\\.angle\\.com\\.tw",
	"minVersion": "5.0",
	"maxVersion": "",
	"priority": 100,
	"inRepository": true,
	"translatorType": 4,
	"browserSupport": "gcsibv",
	"lastUpdated": "2025-02-12 10:45:24"
}

/*
	***** BEGIN LICENSE BLOCK *****

	Copyright © 2025 jiaojiaodubai<jiaojiaodubai23@gmail.com>

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
	if (/book\.asp/i.test(url)) {
		return 'book';
	}
	else if (/accounting\/[a-z]+\/content\.aspx/i.test(url)) {
		return 'journalArticle';
	}
	else if (getSearchResults(doc, true)) {
		return 'multiple';
	}
	return false;
}

function getSearchResults(doc, checkOnly) {
	const items = {};
	let found = false;
	const multiplePages = [
		// new books, https://www.angle.com.tw/message.asp
		{
			selector: 'a[href*="Book.asp?"],a[href*="book.asp?"]',
			title: row => attr(row, 'img', 'alt'),
			href: row => row.href
		},
		// ebook, https://www.angle.com.tw/layer.asp?bkid_1=3410&KindID3=3438
		{
			selector: '.booktb > a[href*="/redirectLink1.asp?"]',
			title: row => attr(row, 'img', 'alt'),
			href: row => row.href
		},
		// thesis, https://www.angle.com.tw/event/graduate/#
		{
			selector: '.list_book h3 > a',
			title: row => ZU.trimInternal(row.textContent),
			href: row => row.href
		},
		// journal TOC, https://www.angle.com.tw/accounting/event/aam/202502.asp
		{
			selector: '#magazing+#detial li > a:first-child',
			title: row => ZU.trimInternal(row.textContent),
			href: row => row.href
		}
	];
	for (const page of multiplePages) {
		const rows = doc.querySelectorAll(page.selector);
		if (!rows.length) continue;
		for (const row of rows) {
			const href = page.href(row);
			const title = page.title(row);
			if (!href || !title) continue;
			if (checkOnly) return true;
			found = true;
			items[href] = title;
		}
	}
	return found ? items : false;
}

async function doWeb(doc, url) {
	if (detectWeb(doc, url) == 'multiple') {
		const items = await Z.selectItems(getSearchResults(doc, false));
		if (!items) return;
		for (const url in items) {
			await scrape(await requestDocument(url));
		}
	}
	else {
		await scrape(doc, url);
	}
}

async function scrape(doc, url = doc.location.href) {
	const newItem = new Z.Item(detectWeb(doc, url));
	const data = {
		innerData: {},
		iterate: (callback) => {
			for (const key in data.innerData) {
				callback(key, data.get(key));
			}
		},
		set: (label, value) => {
			if (label && value) {
				data.innerData[label] = value;
			}
		},
		get: (label) => {
			const result = data.innerData[label];
			return result ? result : '';
		}
	};
	switch (newItem.itemType) {
		case 'book': {
			const bookInfo = doc.querySelector('#content_detial .bookinfo');
			newItem.title = text(bookInfo, 'h3');
			const rows = doc.querySelectorAll('#content_detial > table > tbody > tr');
			for (let i = 0; i < rows.length; i++) {
				const row = rows.item(i);
				if (row.innerText.trim() === '簡介' && i + 1 < rows.length) {
					newItem.abstractNote = rows.item(i + 1).innerText.replace(/(\s)+/g, '$1');
				}
			}
			bookInfo.querySelectorAll('table > tbody > tr').forEach((row) => {
				const label = text(row, 'td:first-child').replace(/\s/g, '').slice(1, -1);
				const value = ZU.trimInternal(text(row, 'td:last-child'));
				data.set(label, value);
			});
			newItem.edition = data.get('版次');
			newItem.publisher = data.get('出版社');
			newItem.date = ZU.strToISO(data.get('出版'));
			newItem.ISBN = ZU.cleanISBN(data.get('ISBN/ISSN'));
			data.iterate((label, value) => {
				if (label === '作者') {
					value.split('．').forEach(name => newItem.creators.push(cleanAuthor(name)));
				}
				// for book publish from thesis, tutor is contributor
				else if (label === '指導教授') {
					value.split('．').forEach(name => newItem.creators.push(cleanAuthor(name.replace(/\s博士$/, ''), 'contributor')));
				}
				else if (/[總主副執參]編[輯寫]/.test(label)) {
					value.split('．').forEach(name => newItem.creators.push(cleanAuthor(name, 'editor')));
				}
			});
			break;
		}
		case 'journalArticle': {
			doc.querySelectorAll('#summary > table > tbody > tr').forEach((row) => {
				const label = text(row, 'th:first-child');
				const value = ZU.trimInternal(text(row, 'td:nth-child(2)'));
				data.set(label, value);
			});
			newItem.title = data.get('中文篇名').replace(/【.+?】$/, '');
			const originalTitle = data.get('英文篇名');
			if (originalTitle) newItem.extra = `original-title: ${originalTitle}`;
			newItem.abstractNote = data.get('閱讀核心');
			newItem.publicationTitle = data.get('刊名');
			newItem.issue = tryMatch(data.get('期數'), /\((\d+)\)/, 1);
			newItem.pages = data.get('起訖頁').replace(/0*(\d+)/g, '$1');
			newItem.DOI = ZU.cleanDOI(data.get('DOI'));
			data.get('作者').split('、').forEach(name => newItem.creators.push(cleanAuthor(name)));
			data.get('關鍵詞').split('、').forEach(tag => newItem.tags.push(tag.trim()));
			break;
		}
	}
	newItem.title = newItem.title.replace(/\s?\((.+?版)\)/, '（$1）');
	newItem.shortTitle = tryMatch(newItem.title, /^(.+?)(?:：|——|──)/, 1);
	newItem.language = 'zh-TW';
	newItem.url = url;
	newItem.libraryCatalog = '元照出版';
	newItem.complete();
}

function cleanAuthor(name, creatorType = 'author') {
	return {
		firstName: '',
		lastName: name,
		creatorType,
		fildMode: 1
	};
}

function tryMatch(string, pattern, index = 0) {
	if (!string) return '';
	const match = string.match(pattern);
	return match && match[index]
		? match[index]
		: '';
}

/** BEGIN TEST CASES **/
var testCases = [
	{
		"type": "web",
		"url": "https://www.angle.com.tw/book.asp?BKID=17423",
		"items": [
			{
				"itemType": "book",
				"title": "碳交易與碳金融：企業如何邁向永續淨零",
				"creators": [
					{
						"firstName": "",
						"lastName": "許永欽",
						"creatorType": "editor",
						"fildMode": 1
					},
					{
						"firstName": "",
						"lastName": "楊敬先",
						"creatorType": "editor",
						"fildMode": 1
					},
					{
						"firstName": "",
						"lastName": "梁鴻烈",
						"creatorType": "editor",
						"fildMode": 1
					},
					{
						"firstName": "",
						"lastName": "李益甄",
						"creatorType": "editor",
						"fildMode": 1
					},
					{
						"firstName": "",
						"lastName": "胡為晴",
						"creatorType": "author",
						"fildMode": 1
					},
					{
						"firstName": "",
						"lastName": "林卉薰",
						"creatorType": "author",
						"fildMode": 1
					},
					{
						"firstName": "",
						"lastName": "陳柏霖",
						"creatorType": "author",
						"fildMode": 1
					},
					{
						"firstName": "",
						"lastName": "陳玟妤",
						"creatorType": "author",
						"fildMode": 1
					},
					{
						"firstName": "",
						"lastName": "王莉宸",
						"creatorType": "author",
						"fildMode": 1
					},
					{
						"firstName": "",
						"lastName": "李意茹",
						"creatorType": "author",
						"fildMode": 1
					},
					{
						"firstName": "",
						"lastName": "陳有光",
						"creatorType": "author",
						"fildMode": 1
					},
					{
						"firstName": "",
						"lastName": "董芃旻",
						"creatorType": "author",
						"fildMode": 1
					},
					{
						"firstName": "",
						"lastName": "蕭佩瑋",
						"creatorType": "author",
						"fildMode": 1
					},
					{
						"firstName": "",
						"lastName": "李函穎",
						"creatorType": "author",
						"fildMode": 1
					},
					{
						"firstName": "",
						"lastName": "郭家銘",
						"creatorType": "author",
						"fildMode": 1
					},
					{
						"firstName": "",
						"lastName": "吳芊柔",
						"creatorType": "author",
						"fildMode": 1
					},
					{
						"firstName": "",
						"lastName": "吳若瑜",
						"creatorType": "author",
						"fildMode": 1
					}
				],
				"date": "2024-12",
				"abstractNote": "隨著全球減碳法令日益嚴格，我國企業面臨前所未有的挑戰。如何在嚴格監管中，迅速有效地布局碳管理，將危機化為轉機，已成為當前棘手課題。\n本書共分八章。於第一章「碳交易國際起源」及第二章「碳交易市場運作」中，分別介紹碳交易制度的發展背景及碳交易市場的基本機制，可供企業建立對「碳交易」的基本認識。\n第三章「國際碳交易與碳金融市場」中提供對歐盟、英國、美國、日本、新加坡及中國大陸等國家碳交易制度的深入分析；第四章「我國碳交易法制發展」及第五章「臺灣碳權交易概要」則聚焦於我國適用碳交易之情形，分別概述我國碳交易法制發展及未來展望，以及介紹臺灣碳權交易所的成立背景及運作模式。\n第六章「碳權法律爭議」討論碳權交易在實際操作中可能遇到的爭議問題，並提供法律視角的解決方案和風險管理建議；第七章「臺灣企業碳管理實務觀察」則透過實際案例分析我國企業的碳管理實務操作和成功經驗。\n第八章「臺灣企業碳管理布局若干考量」總結前七章內容，提出企業應注意的四大關鍵要素：建置妥適之碳管理框架、評估進行碳權交易、投資自願減量方案及關注碳金融市場發展。\n本書詳細闡述企業碳管理策略與實踐，為企業提供全面且實用的指引，幫助企業在全球減碳大潮中立於不敗之地。",
				"edition": "1",
				"language": "zh-TW",
				"libraryCatalog": "元照出版",
				"publisher": "元照出版公司",
				"shortTitle": "碳交易與碳金融",
				"url": "https://www.angle.com.tw/book.asp?BKID=17423",
				"attachments": [],
				"tags": [],
				"notes": [],
				"seeAlso": []
			}
		]
	},
	{
		"type": "web",
		"url": "https://www.angle.com.tw/Book.asp?BKID=17591",
		"items": [
			{
				"itemType": "book",
				"title": "專業人士對兒童與精神障礙性侵害被害人協助詢問之研究（電子版）",
				"creators": [
					{
						"firstName": "",
						"lastName": "蔡蕙芳",
						"creatorType": "contributor",
						"fildMode": 1
					},
					{
						"firstName": "",
						"lastName": "洪崇傑",
						"creatorType": "author",
						"fildMode": 1
					}
				],
				"date": "2020-08",
				"abstractNote": "【電子版使用說明】\n1. 購買「電子版」書籍，啟用時需綁定Gmail信箱，客服將會與您聯繫開通使用權限。\n2. 「電子版」書籍的使用不可轉寄、複製、與列印；僅有翻頁功能。　因應長久以來性侵害犯罪防治法在兒童以及精神疾患受害者保護的不足，我國於2017年1月1日正式施行修法後增添的第15條之1，引進美國司法訪談員的概念，在該法條下設立「專業人士」來協助兒童與精神疾患遭受性侵害時對於被害經過的詢訊問。　「專業人士」協助司法調查兒童與精神疾患性侵害受害者的嶄新觀念，具體體現了各項國際人權法保護弱勢證人的基礎，其中包括「經濟、社會及文化權利國際公約」以及「公民權利和政治權利國際公約」兩公約；另外也呼應了「兒童權利公約」、「身心障礙者公約」與歐洲理事會通過的「伊斯坦堡公約」。而專業人士的制度引進也該觀察於我國刑事訴訟法的體系架構下，是否合乎程序，由於刑事訴訟法的主體為犯罪嫌疑人與被告，關於受害人的條文付之闕如，於是本論文亦將同時檢視與爬梳刑事訴訟法中關於證據法、鑑定人以及鑑定證人的規範。　國內學者主要引用美國的NICHD司法詢問員標準化問句，來標準化專業人士的司法訪談技巧，由於司法訪談之技巧緊密結合了精神醫學和心理學的基礎，本論文於此將整理精神科醫學在整合心理學與精神分析學，如何延伸對應到司法訪談員在接觸兒童與精神疾患受性侵害後的訪談技巧。　本論文第五章並且實證分析了2017年前後，在性侵害犯罪防治法第15條之1正式上路前後，臺中市對於兒童與精神疾患在遭受性暴力案件後，接受一般司法精神鑑定或專業人士介入的早期鑑定的比較，結果顯示早期鑑定可以更早去偵測性侵被害人的壓力症候群的時間。另外兒童與精神疾患性暴力受害者最大的不同在於兒童性暴力受害者家內性侵的比率高。除此之外專業人士的介入亦增加了司法訴追率。　專業人士介入兒童與精神疾患遭受性暴力的早期司法鑑定有協助司法調查以及保障弱勢族群權利的考量，後續修法若能更具體規範專業人士需受訓認證的專業課程範圍，以及協助司法調查權限，甚至延伸專業人士介入與保護對象到苦無客觀證據的所有遭受性暴力受害者，對於性侵害犯罪防治更向前邁進一大步。",
				"edition": "1",
				"language": "zh-TW",
				"libraryCatalog": "元照出版",
				"publisher": "元照出版公司",
				"url": "https://www.angle.com.tw/Book.asp?BKID=17591",
				"attachments": [],
				"tags": [],
				"notes": [],
				"seeAlso": []
			}
		]
	},
	{
		"type": "web",
		"url": "https://www.angle.com.tw/book.asp?BKID=15535",
		"items": [
			{
				"itemType": "book",
				"title": "酒駕嚴罰化政策中的法律意識",
				"creators": [
					{
						"firstName": "",
						"lastName": "謝煜偉",
						"creatorType": "contributor",
						"fildMode": 1
					},
					{
						"firstName": "",
						"lastName": "蔣聖謙",
						"creatorType": "author",
						"fildMode": 1
					}
				],
				"date": "2022-08",
				"abstractNote": "酒駕問題向來為台灣社會深惡痛絕，社會輿論倡議嚴罰聲浪從未止歇，攤開醉態駕駛罪的修正歷程，卻發現立法至今二十餘年已歷經多次修正。面對酒駕防制政策的嚴罰浪潮，學說多批判其為民粹所主導，並以刑罰民粹主義模型闡釋修正歷程，然而現行學說卻對於社會輿論的嚴罰意識未多著墨，本文旨在提出理論模型，以解析社會輿論的建構歷程與其內涵。　首先本文應用「法律意識」研究方法，參酌英美及日本學界法律社會學研究，整合提出懲罰社會學式的法律意識模型，用以剖析嚴罰政策的社會輿論面貌。接著本文將應用法律社會史方法，檢驗立法界、警政界、社會輿論界與法學界等四種場域言說，以回顧醉態駕駛罪與酒駕防制政策的歷史變遷。酒駕議題討論的早期動態與2010年代開啟的修法潮，顯現連續朝向嚴罰管控的傾向，可以發現到，修法潮存在警政界主導修法的特色，而非僅是輿論促成政策變化，於此同時，多樣的行政管制策略被提出，連同刑罰成為修法潮配套措施。　從犯罪化歷程開始觀察嚴罰政策中的法律意識，會發現酒駕議題的問題化歷程始自1990年代，其嚴罰政策的基本邏輯，是由法學論述的嚇阻典範與道德論述的零容忍所主導，修法變遷是由傳媒、政府與專家所組成的「鐵三角」與其道德信念變遷所推動。至於酒駕嚴罰政策的深層意識觀，則存在複數的酒駕犯罪者法律圖像，如妖魔化、治理慾望、權力倒置與理性形象生產等面向，共同支撐起刑事政策的基本邏輯。　最終，醉態駕駛罪的法律意識，其社會機能顯現精細的人口分類機制，而法律意識所支撐的嚴罰政策傾向，則是指向永遠無法達成的司法改革。本文為此提出現行政策的全面批判論述，同步揭露批判論述的反身性立場。面對酒駕議題，應採取「減害策略」思維，思考應用科技發展與強化社會連帶等替代方案，試圖減輕酒駕嚴罰政策所帶來的惡果，至於其實踐，則仰賴未來偶然翻轉結構的契機。",
				"edition": "1",
				"language": "zh-TW",
				"libraryCatalog": "元照出版",
				"publisher": "元照出版公司",
				"url": "https://www.angle.com.tw/book.asp?BKID=15535",
				"attachments": [],
				"tags": [],
				"notes": [],
				"seeAlso": []
			}
		]
	},
	{
		"type": "web",
		"url": "https://www.angle.com.tw/accounting/journal/content.aspx?no=913414",
		"items": [
			{
				"itemType": "journalArticle",
				"title": "本案移轉管轄後保全裁定之效力──探討民事訴訟法第524條之「本案管轄法院」解釋疑義",
				"creators": [
					{
						"firstName": "",
						"lastName": "吳美齡",
						"creatorType": "author",
						"fildMode": 1
					},
					{
						"firstName": "",
						"lastName": "蔡庭熏",
						"creatorType": "author",
						"fildMode": 1
					}
				],
				"DOI": "10.53106/252260962025020086006",
				"extra": "original-title: The Effectiveness of Injunctive Rulings after Transfer of Jurisdiction: A Discussion on the Interpretation of \"\"Competent Court for the Principal Case\"\" in Article 524 of the Code of Civil Procedure",
				"language": "zh-TW",
				"libraryCatalog": "元照出版",
				"pages": "54-59",
				"publicationTitle": "月旦會計實務研究",
				"shortTitle": "本案移轉管轄後保全裁定之效力",
				"url": "https://www.angle.com.tw/accounting/journal/content.aspx?no=913414",
				"attachments": [],
				"tags": [
					{
						"tag": "保全程序"
					},
					{
						"tag": "假扣押"
					},
					{
						"tag": "本案管轄法院"
					},
					{
						"tag": "移轉管轄"
					}
				],
				"notes": [],
				"seeAlso": []
			}
		]
	},
	{
		"type": "web",
		"url": "https://www.angle.com.tw/layer.asp?bkid_1=3410&KindID3=3438",
		"items": "multiple"
	},
	{
		"type": "web",
		"url": "https://www.angle.com.tw/event/graduate/#",
		"items": "multiple"
	},
	{
		"type": "web",
		"url": "https://www.angle.com.tw/accounting/event/aam/202502.asp",
		"items": "multiple"
	}
]
/** END TEST CASES **/
