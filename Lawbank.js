{
	"translatorID": "34940faa-9381-4bc8-b796-e83d36eecd48",
	"label": "Lawbank",
	"creator": "jiaojiaodubai",
	"target": "^https://(www|db)\\.lawbank\\.com\\.tw",
	"minVersion": "5.0",
	"maxVersion": "",
	"priority": 100,
	"inRepository": true,
	"translatorType": 4,
	"browserSupport": "gcsibv",
	"lastUpdated": "2025-04-30 00:29:46"
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
	if (url.includes('/FLAW/')) {
		return 'statute';
	}
	else if (url.includes('/FINT')) {
		for (const elm of (doc.querySelectorAll('.itemName'))) {
			if (/(解釋|發文)字號/.test(elm.textContent)) {
				return 'report';
			}
		}
		return 'case';
	}
	else if (url.includes('pl_article.aspx')) {
		return 'journalArticle';
	}
	else if (url.includes('ts_article.aspx')) {
		return 'thesis';
	}
	else if (url.includes('bk_book.aspx')) {
		return 'book';
	}
	// 或許應該採用document？
	else if (url.includes('dt_article.aspx')) {
		return 'book';
	}
	else if (getSearchResults(doc, true)) {
		return 'multiple';
	}
	return false;
}

function getSearchResults(doc, checkOnly) {
	const items = {};
	let found = false;
	const rows = doc.querySelectorAll('a[href*="_article.aspx"],a[href*="FINTQRY04.aspx"],a[href*="FLAWDAT09.aspx"]');
	for (const row of rows) {
		const href = row.href;
		const title = ZU.trimInternal(row.textContent);
		if (!href || !title) continue;
		if (checkOnly) return true;
		found = true;
		items[href] = title;
	}
	return found ? items : false;
}

async function doWeb(doc, url) {
	const itemType = detectWeb(doc, url);
	if (itemType === 'multiple') {
		const items = await Z.selectItems(getSearchResults(doc, false));
		if (!items) return;
		for (const url in items) {
			await scrape(await requestDocument(url));
		}
	}
	else {
		if (itemType === 'statute' && text(doc, '.pageTitle') !== '法規沿革') {
			const sourceLink = doc.querySelector('#h1Source');
			if (sourceLink) {
				doc = requestDocument(sourceLink.href);
			}
		}
		await scrape(doc, url);
	}
}

async function scrape(doc, url = doc.location.href) {
	const emptyElm = doc.createElement('div');
	const newItem = new Z.Item(detectWeb(doc, url));
	switch (newItem.itemType) {
		case 'statute': {
			const data = getLabeledData(
				doc.querySelectorAll('.law-header tr'),
				row => text(row, 'th').slice(0, -1),
				row => row.querySelector('td'),
				emptyElm
			);
			newItem.nameOfAct = data('法規名稱');
			newItem.dateEnacted = rocToISO(data('發布日期'));
			newItem.creators.push(cleanAuthor(data('主管機關')));
			break;
		}
		case 'case': {
			const data = getLabeledData(
				doc.querySelectorAll('.DataRow:has(.itemName)'),
				row => text(row, '.itemName').slice(0, -1).replace(/\s/g, ''),
				row => row.querySelector('.itemContent'),
				emptyElm
			);
			const fullNumber = (() => {
				const numberElm = data('裁判字號', true).cloneNode(true);
				const makrk = numberElm.querySelector('.markarea');
				if (makrk) {
					makrk.remove();
				}
				return numberElm.textContent;
			})();
			const court = tryMatch(fullNumber, /^\S+法(庭|院)/);
			const content = innerText(doc, '#sandbox');
			const appellants = tryMatch(content, /^(?:(?:上\s*訴|抗\s*告)\s*人)\s*(\S+(\n\s+\S+)*)/m, 1)
				.split(/\n\s*/g)
				.filter(name => name);
			const appellees = tryMatch(content, /^(?:被\s*上\s*訴\s*人|被\s*告)\s*(\S+(\n\s+\S+)*)/m, 1)
				.split(/\s+/g)
				.filter(name => name);
			const caseType = tryMatch(fullNumber, /號?(\S*(?:裁定|判決))$/, 1);
			if (caseType) {
				newItem.setExtra('genre', `${caseType}書`);
			}
			const cause = data('案由摘要');
			// 這裏的邏輯可能是不充分的
			if (appellees.length && cause) {
				newItem.caseName = `${/刑事/.test(caseType) ? '' : `${appellants.join('、')}訴`}${appellees.join('、')}${cause}案`;
			}
			else if (/抗.?字/.test(fullNumber)) {
				newItem.caseName = `${appellants.join('、')}${cause}案`;
			}
			else if (/不服.+判決.*提起上訴/s.test(content)) {
				const rank = tryMatch(content, /不服.+?第(.+?)判決/s, 1);
				newItem.caseName = `${appellants.join('、')}上訴${rank ? `（${rank}）` : rank}案`;
			}
			else {
				newItem.caseName = fullNumber.replace(/\s/g, '');
			}
			newItem.abstractNote = data('要旨').replace(/\s/g, '');
			newItem.court = `臺灣${court}`;
			newItem.dateDecided = rocToISO(data('裁判日期'));
			newItem.docketNumber = fullNumber.slice(court.length, -caseType.length).replace(/\s/g, '');
			doc.querySelectorAll('.keyword-list > span').forEach(elm => newItem.tags.push(elm.textContent));
			newItem.attachments.push({
				title: 'Snapshot',
				document: doc
			});
			break;
		}
		case 'report': {
			const data = getLabeledData(
				doc.querySelectorAll('.DataRow:has(.itemName)'),
				row => text(row, '.itemName').slice(0, -1).replace(/\s/g, ''),
				row => row.querySelector('.itemContent'),
				emptyElm
			);
			let number = '';
			if ((number = data('解釋標題').replace(/\s/g, ''))) {
				newItem.title = data('解釋標題');
				newItem.abstractNote = data('解釋文').replace(/\s/g, '');
				newItem.reportNumber = number;
				newItem.date = rocToISO(data('解釋日期'));
				newItem.creators.push(cleanAuthor(data('發文單位')));
			}
			else if ((number = data('發文字號').replace(/\s/g, ''))) {
				newItem.title = number;
				newItem.abstractNote = data('要旨').replace(/\s/g, '');
				newItem.reportNumber = number;
				newItem.date = rocToISO(data('發文日期'));
			}
			newItem.attachments.push({
				title: 'Snapshot',
				document: doc
			});
			break;
		}
		case 'journalArticle': {
			const data = getLabeledData(
				doc.querySelectorAll('[class^="resultsArticle"] tr'),
				row => text(row, 'th').slice(0, -1).replace(/\s/g, ''),
				row => row.querySelector('td'),
				emptyElm
			);
			newItem.title = data('論著名稱').replace(/\s*文獻引用$/, '');
			newItem.abstractNote = data('中文摘要');
			newItem.publicationTitle = text(doc, 'a[href*="pl_introduction"]');
			const pubInfo = text(doc, 'a[href*="pl_issue"]').replace(/\s/g, '');
			newItem.volume = tryMatch(pubInfo, /\d*(\d+)卷/, 1);
			newItem.issue = tryMatch(pubInfo, /([a-z\d]+)期/, 1).replace(/0*(\d+)/, '$1');
			newItem.pages = tryMatch(data('刊登出處'), /([\d-]+)頁$/, 1);
			newItem.date = ZU.strToISO(data('出版日期'));
			doc.querySelectorAll('a[href*="queryresult.aspx?KW="]').forEach(elm => newItem.tags.push(elm.textContent));
			doc.querySelectorAll('a[href*="author.aspx"]').forEach(elm => newItem.creators.push(cleanAuthor(elm.textContent)));
			break;
		}
		case 'thesis': {
			const data = getLabeledData(
				doc.querySelectorAll('[class^="resultsArticle"] tr'),
				row => text(row, 'th').slice(0, -1).replace(/\s/g, ''),
				row => row.querySelector('td'),
				emptyElm
			);
			const title = data('論著名稱').replace(/\s*文獻引用$/, '');
			newItem.title = title;
			const originalTitle = tryMatch(title, /\((.+?)\)$/, 1);
			if (originalTitle) {
				newItem.setExtra('original-title', originalTitle);
				newItem.title = title.slice(0, -(originalTitle.length + 2));
			}
			newItem.abstractNote = data('中文摘要');
			const degree = data('校院名稱');
			newItem.thesisType = `${degree.slice(-2)}學位論文`;
			newItem.university = degree.slice(0, -2);
			newItem.place = data('出版地區');
			newItem.date = ZU.strToISO('出版日期');
			newItem.numPages = data('頁數');
			doc.querySelectorAll('a[href*="queryresult.aspx?KW="]').forEach(elm => newItem.tags.push(elm.textContent));
			const zhName = data('研究生');
			const enName = tryMatch(zhName, /\((.+?)\)$/, 1);
			if (enName) {
				const original = ZU.cleanAuthor(ZU.capitalizeName(enName));
				newItem.setExtra('original-author', `${original.lastName} || ${original.firstName}`);
				newItem.creators.push(cleanAuthor(zhName.slice(0, -(enName.length + 2))));
			}
			else {
				newItem.creators.push(cleanAuthor(zhName));
			}
			data('指導教授', true).querySelectorAll('a[href*="author.aspx"]').forEach((elm) => {
				newItem.creators.push(cleanAuthor(elm.textContent, 'contributor'));
			});
			break;
		}
		case 'book': {
			const data = getLabeledData(
				doc.querySelectorAll('[class^="resultsArticle"] tr'),
				row => text(row, 'th').slice(0, -1).replace(/\s/g, ''),
				row => row.querySelector('td'),
				emptyElm
			);
			newItem.title = data('論著名稱').replace(/\s*文獻引用$/, '');
			newItem.abstractNote = data('內容簡介');
			newItem.publisher = data('出版社');
			newItem.date = ZU.strToISO(data('出版日期'));
			newItem.ISBN = data('ISBN');
			newItem.numPages = data('頁數');
			doc.querySelectorAll('a[href*="author.aspx"]').forEach(elm => newItem.creators.push(cleanAuthor(elm.textContent)));
			break;
		}
	}
	newItem.language = 'zh-TW';
	newItem.url = url;
	newItem.complete();
}

function getLabeledData(rows, labelGetter, dataGetter, defaultElm) {
	const labeledElm = {};
	for (const row of rows) {
		labeledElm[labelGetter(row, rows)] = dataGetter(row, rows);
	}
	const data = (labels, element = false) => {
		if (Array.isArray(labels)) {
			for (const label of labels) {
				const result = data(label, element);
				if (
					(element && /\S/.test(result.textContent))
					|| (!element && /\S/.test(result))) {
					return result;
				}
			}
			return element ? defaultElm : '';
		}
		const targetElm = labeledElm[labels];
		return targetElm
			? element ? targetElm : ZU.trimInternal(targetElm.textContent)
			: element ? defaultElm : '';
	};
	return data;
}

function rocToISO(dateStr) {
	const parts = dateStr.replace(/\s/g, '').match(/民國(\d+)年(\d{2})月(\d{2})日/);
	if (!parts || !parts[3]) {
		return '';
	}
	const year = parts[1] + 1911;
	const month = parts[2];
	const day = parts[3];
	return `${year}-${month}-${day}`;
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
	if (match && match[index]) {
		return match[index];
	}
	return '';
}

/** BEGIN TEST CASES **/
var testCases = [
	{
		"type": "web",
		"url": "https://db.lawbank.com.tw/FLAW/FLAWDAT09.aspx?lsid=FL001378",
		"items": [
			{
				"itemType": "statute",
				"nameOfAct": "法人及夫妻財產制契約登記規則",
				"creators": [
					{
						"firstName": "",
						"lastName": "司法院民事廳",
						"creatorType": "author",
						"fildMode": 1
					}
				],
				"dateEnacted": "1973-07-06",
				"language": "zh-TW",
				"url": "https://db.lawbank.com.tw/FLAW/FLAWDAT09.aspx?lsid=FL001378",
				"attachments": [],
				"tags": [],
				"notes": [],
				"seeAlso": []
			}
		]
	},
	{
		"type": "web",
		"url": "https://db.lawbank.com.tw/FINT/FINTQRY04.aspx?id=J%2cU%2c105%2c%e5%8f%b0%e4%b8%8a%2c2111%2c001&ro=1&category=3&type=3&subtype=1,A,S,U,4,G,I,O,CA&filter=7&sort=1&p=CF434FFF8364ED26B8C898DE4F1FFAAA",
		"items": [
			{
				"itemType": "case",
				"caseName": "翁日章、翁明陽、翁寶秀、翁寶釧訴翁明輝請求分割遺產等事件案",
				"creators": [],
				"dateDecided": "2016-11-29",
				"abstractNote": "按民法第二百二十五條第二項所定之代償請求權之立法目的，係基於衡平 思想，旨在調整失當之財產價值分配，保護債權人之利益，使債權人有主 張以債務人對於第三人之損害賠償請求權或受領自第三人之賠償物代替原 給付標的之權利，其因不可歸責於債務人之事由直接轉換之利益（如交易 之對價）與損害賠償，發生之原因雖有不同，但性質上同為給付不能之代 替利益，應類推適用上開規定，得為代償請求權之標的。又依民法第二百 二十五條第一項、第二項規定之文義，固須不可歸責於債務人之事由致給 付不能者，債權人始得主張代償請求權。惟因可歸責於債務人之事由致給 付不能者，參酌民法第二百二十五條第二項規定之立法理由謂「其不能給 付，『不問其債務人應否負責』，須以債務人所受之損害賠償或其所有之 損害賠償請求權，代債務之標的，以保護債權人之利益」，應認債權人得 選擇行使損害賠償請求權（民法第二百二十六條第一項）或代償請求權以 保護其利益。惟代償請求權之目的，係於債務人給付不能時，使債權人得 向債務人請求讓與其損害賠償請求權或交付受領之賠償物或交付其所取得 交易之對價，代替原來債務之標的為給付，以保障債權人之利益。準此， 即應以債務人就原來債務之標的仍應為給付為前提，始可因其給付不能而 發生代償請求權。倘原來之債權已罹於消滅時效期間，債務人本得行使時 效抗辯，拒絕為給付，自不可能再有給付不能，而發生代償請求權及其時 效期間重新起算之情事，否則即與時效制度原期確保交易安全，維護社會 秩序之目的有違。",
				"court": "臺灣最高法院",
				"docketNumber": "105年度台上字第2111號",
				"extra": "genre: 判決書",
				"language": "zh-TW",
				"url": "https://db.lawbank.com.tw/FINT/FINTQRY04.aspx?id=J%2cU%2c105%2c%e5%8f%b0%e4%b8%8a%2c2111%2c001&ro=1&category=3&type=3&subtype=1,A,S,U,4,G,I,O,CA&filter=7&sort=1&p=CF434FFF8364ED26B8C898DE4F1FFAAA",
				"attachments": [
					{
						"title": "Snapshot",
						"mimeType": "text/html"
					}
				],
				"tags": [
					{
						"tag": "不當得利"
					},
					{
						"tag": "公同共有"
					},
					{
						"tag": "分割遺產"
					},
					{
						"tag": "消滅時效"
					}
				],
				"notes": [],
				"seeAlso": []
			}
		]
	},
	{
		"type": "web",
		"url": "https://db.lawbank.com.tw/FINT/FINTQRY04.aspx?id=J%2c1%2c112%2c%e5%8f%b0%e6%8a%97%e5%a4%a7%2c630%2c001&ro=1&category=3&type=3&subtype=1,A,S,U,4,G,I,O,CA&sort=1&p=49DF6736B28D1583084F33CB442ACFA6",
		"items": [
			{
				"itemType": "case",
				"caseName": "吳○○請求損害賠償等聲請退還裁判費案",
				"creators": [],
				"dateDecided": "2024-02-20",
				"court": "臺灣最高法院",
				"docketNumber": "112年度台抗大字第630號",
				"extra": "genre: 民事裁定書",
				"language": "zh-TW",
				"url": "https://db.lawbank.com.tw/FINT/FINTQRY04.aspx?id=J%2c1%2c112%2c%e5%8f%b0%e6%8a%97%e5%a4%a7%2c630%2c001&ro=1&category=3&type=3&subtype=1,A,S,U,4,G,I,O,CA&sort=1&p=49DF6736B28D1583084F33CB442ACFA6",
				"attachments": [
					{
						"title": "Snapshot",
						"mimeType": "text/html"
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
		"url": "https://db.lawbank.com.tw/FINT/FINTQRY04.aspx?id=J%2cV%2c113%2c%e5%8f%b0%e4%b8%8a%2c292%2c001&ro=1&category=4&sort=1&p=1028CE2C61721F61383E2643AECF1029",
		"items": [
			{
				"itemType": "case",
				"caseName": "鍾志彬上訴（二審）案",
				"creators": [],
				"dateDecided": "2024-02-29",
				"abstractNote": "（一）免於身心傷害之身體權，雖非憲法明文列舉之權利，惟基於人性尊嚴理念，維護個人主體性及人格自由發展，亦屬憲法第22條所保障之基本權利。而人民之健康關乎生命之存續與品質，身體與健康同屬法律保障之人格法益，並與人性尊嚴之普世價值息息相關，是人民之健康權，乃內含於憲法保障身體權之一環。而憲法所保障之健康權，旨在保障人民生理機能及心理健康（精神狀態）之完整健全，不受任意侵害。故刑法傷害罪，係以身體、健康為其保護法益，並以維護個人身體的完整性、生理機能之健全，與心理狀態之健康為其內容。故所謂健康，當然包含生理及心理上之健康狀態。（二）以心理健康之傷害為例，其傷害是否重大，除須符合精神衛生法第3條第1項第1款規定精神疾病之定義外，尚須其所罹之精神疾病已達上開重大不治或難治之重傷要件，始能論以重傷罪。準此，法院關於被害人之思考、情緒、知覺、認知、行為及其他精神狀態有無因精神疾病之影響而有重大異常之表現？被害人適應原本生活之基本角色功能（職業、社交活動執行與日常生活之參與）是否因而發生重大障礙？及被害人是否因而需要長期持續接受醫療及照顧？被害人所罹之精神疾病是否已達不治或難治之程度等，攸關被害人心理健康之傷害是否已達重傷相關審酌事項之判斷，事涉醫療相關領域之專業知識，倘業已綜合專科醫師經診療或鑑定後之意見、被害人經治療後心理健康狀態及其原本生活基本角色功能之回復狀況等各項證據而為重傷之認定，如與證據法則無違，即不能任意指為違法。",
				"court": "臺灣最高法院",
				"docketNumber": "113年度台上字第292號",
				"extra": "genre: 判決書",
				"language": "zh-TW",
				"url": "https://db.lawbank.com.tw/FINT/FINTQRY04.aspx?id=J%2cV%2c113%2c%e5%8f%b0%e4%b8%8a%2c292%2c001&ro=1&category=4&sort=1&p=1028CE2C61721F61383E2643AECF1029",
				"attachments": [
					{
						"title": "Snapshot",
						"mimeType": "text/html"
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
		"url": "https://db.lawbank.com.tw/FINT/FINTQRY04.aspx?id=J%2c2%2c110%2c%e5%8f%b0%e4%b8%8a%e5%a4%a7%2c5217%2c002&ro=2&category=4&type=3&subtype=2,B,T,V,5,H,J,P,DB&sort=1&p=A64DFF30A7E3D66A674F900E2D8CD95B",
		"items": [
			{
				"itemType": "case",
				"caseName": "林益世違反貪污治罪條例案",
				"creators": [],
				"dateDecided": "2023-03-02",
				"court": "臺灣最高法院",
				"docketNumber": "110年度台上大字第5217號",
				"extra": "genre: 刑事裁定書",
				"language": "zh-TW",
				"url": "https://db.lawbank.com.tw/FINT/FINTQRY04.aspx?id=J%2c2%2c110%2c%e5%8f%b0%e4%b8%8a%e5%a4%a7%2c5217%2c002&ro=2&category=4&type=3&subtype=2,B,T,V,5,H,J,P,DB&sort=1&p=A64DFF30A7E3D66A674F900E2D8CD95B",
				"attachments": [
					{
						"title": "Snapshot",
						"mimeType": "text/html"
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
		"url": "https://db.lawbank.com.tw/FINT/FINTQRY04.aspx?id=M%2cCJ00005684&ro=1&category=11&type=12&subtype=*&sort=1&p=CF434FFF8364ED26B8C898DE4F1FFAAA",
		"items": [
			{
				"itemType": "case",
				"caseName": "憲法法庭113年憲判字第3號判決判決",
				"creators": [],
				"dateDecided": "2024-04-26",
				"abstractNote": "刑法第309條第1項規定所處罰之公然侮辱行為，係指依個案之表意脈絡，表意人故意發表公然貶損他人名譽之言論，已逾越一般人可合理忍受之範圍；經權衡該言論對他人名譽權之影響，及該言論依其表意脈絡是否有益於公共事務之思辯，或屬文學、藝術之表現形式，或具學術、專業領域等正面價值，於個案足認他人之名譽權應優先於表意人之言論自由而受保障者。於此範圍內，與憲法第11條保障言論自由之意旨尚屬無違。（裁判要旨內容由法源資訊撰寫）",
				"court": "臺灣憲法法庭",
				"docketNumber": "113年憲判字第3號",
				"extra": "genre: 判決判決書",
				"language": "zh-TW",
				"url": "https://db.lawbank.com.tw/FINT/FINTQRY04.aspx?id=M%2cCJ00005684&ro=1&category=11&type=12&subtype=*&sort=1&p=CF434FFF8364ED26B8C898DE4F1FFAAA",
				"attachments": [
					{
						"title": "Snapshot",
						"mimeType": "text/html"
					}
				],
				"tags": [
					{
						"tag": "人格權"
					},
					{
						"tag": "公然侮辱"
					},
					{
						"tag": "比例原則"
					}
				],
				"notes": [],
				"seeAlso": []
			}
		]
	},
	{
		"type": "web",
		"url": "https://db.lawbank.com.tw/FINT/FINTQRY04.aspx?id=C%2cD%2c813&ro=1&category=11&type=2&subtype=D&sort=1&p=CF434FFF8364ED26B8C898DE4F1FFAAA",
		"items": [
			{
				"itemType": "report",
				"title": "歷史建築所定著之土地為第三人所有之補償案",
				"creators": [
					{
						"firstName": "",
						"lastName": "司法院",
						"creatorType": "author",
						"fildMode": 1
					}
				],
				"date": "2021-12-24",
				"abstractNote": "文化資產保存法第9條第1項及第18條第1項關於歷史建築登錄部分規定，於歷史建築所定著之土地為第三人所有之情形，未以取得土地所有人同意為要件，尚難即認與憲法第15條保障人民財產權之意旨有違。惟上開情形之土地所有人，如因定著於其土地上之建造物及附屬設施，被登錄為歷史建築，致其就該土地原得行使之使用、收益、處分等權能受到限制，究其性質，屬國家依法行使公權力，致人民財產權遭受逾越其社會責任所應忍受範圍之損失，而形成個人之特別犧牲，國家應予相當補償。文化資產保存法第9條第1項及第18條第1項規定，構成對上開情形之土地所有人之特別犧牲者，同法第99條第2項及第100條第1項規定，未以金錢或其他適當方式給予上開土地所有人相當之補償，於此範圍內，不符憲法第15條保障人民財產權之意旨。有關機關應自本解釋公布之日起2年內，依本解釋意旨，修正文化資產保存法妥為規定。",
				"language": "zh-TW",
				"libraryCatalog": "Lawbank",
				"reportNumber": "歷史建築所定著之土地為第三人所有之補償案",
				"url": "https://db.lawbank.com.tw/FINT/FINTQRY04.aspx?id=C%2cD%2c813&ro=1&category=11&type=2&subtype=D&sort=1&p=CF434FFF8364ED26B8C898DE4F1FFAAA",
				"attachments": [
					{
						"title": "Snapshot",
						"mimeType": "text/html"
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
		"url": "https://db.lawbank.com.tw/FINT/FINTQRY04.aspx?id=C%2cD%2c813&ro=1&category=11&type=2&subtype=D&sort=1&p=CF434FFF8364ED26B8C898DE4F1FFAAA",
		"items": [
			{
				"itemType": "report",
				"title": "歷史建築所定著之土地為第三人所有之補償案",
				"creators": [
					{
						"firstName": "",
						"lastName": "司法院",
						"creatorType": "author",
						"fildMode": 1
					}
				],
				"date": "2021-12-24",
				"abstractNote": "文化資產保存法第9條第1項及第18條第1項關於歷史建築登錄部分規定，於歷史建築所定著之土地為第三人所有之情形，未以取得土地所有人同意為要件，尚難即認與憲法第15條保障人民財產權之意旨有違。惟上開情形之土地所有人，如因定著於其土地上之建造物及附屬設施，被登錄為歷史建築，致其就該土地原得行使之使用、收益、處分等權能受到限制，究其性質，屬國家依法行使公權力，致人民財產權遭受逾越其社會責任所應忍受範圍之損失，而形成個人之特別犧牲，國家應予相當補償。文化資產保存法第9條第1項及第18條第1項規定，構成對上開情形之土地所有人之特別犧牲者，同法第99條第2項及第100條第1項規定，未以金錢或其他適當方式給予上開土地所有人相當之補償，於此範圍內，不符憲法第15條保障人民財產權之意旨。有關機關應自本解釋公布之日起2年內，依本解釋意旨，修正文化資產保存法妥為規定。",
				"language": "zh-TW",
				"libraryCatalog": "Lawbank",
				"reportNumber": "歷史建築所定著之土地為第三人所有之補償案",
				"url": "https://db.lawbank.com.tw/FINT/FINTQRY04.aspx?id=C%2cD%2c813&ro=1&category=11&type=2&subtype=D&sort=1&p=CF434FFF8364ED26B8C898DE4F1FFAAA",
				"attachments": [
					{
						"title": "Snapshot",
						"mimeType": "text/html"
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
		"url": "https://www.lawbank.com.tw/treatise/pl_article.aspx?AID=P000268067",
		"items": [
			{
				"itemType": "journalArticle",
				"title": "公然侮辱的代價－是否能以『罵人價目表』為憑據？",
				"creators": [
					{
						"firstName": "",
						"lastName": "羅裕翔",
						"creatorType": "author",
						"fildMode": 1
					}
				],
				"date": "2025-03-15",
				"abstractNote": "慰撫金酌定要件的標準及金額如何量化，是我國實務一直懸而未決的問題，當中的審查要件莫過於「故意或過失程度及侵害影響程度」、「職業與經濟能力」、「身分及社經地位」均是會列為審酌的要件。本文認為，為確保法院在酌定慰撫金有一定之依據，也可使當事人瞭解最後為何判決結果之範圍與原因，建議我國可建立自身之裁判指引，並編纂裁判彙編。法官即可依據歷年判決金額判決慰撫金，除有特別情事需增加或減少慰撫金數額，則於判決中指明清楚，自可減少重複爭執的可能，也會增加一般民眾對司法之信賴。",
				"issue": "5",
				"language": "zh-TW",
				"libraryCatalog": "Lawbank",
				"publicationTitle": "財稅法令半月刊",
				"url": "https://www.lawbank.com.tw/treatise/pl_article.aspx?AID=P000268067",
				"volume": "8",
				"attachments": [],
				"tags": [
					{
						"tag": "侵害影響程度"
					},
					{
						"tag": "公然侮辱罪"
					},
					{
						"tag": "慰撫金"
					},
					{
						"tag": "社經地位"
					}
				],
				"notes": [],
				"seeAlso": []
			}
		]
	},
	{
		"type": "web",
		"url": "https://www.lawbank.com.tw/treatise/ts_article.aspx?AID=T000010454",
		"items": [
			{
				"itemType": "thesis",
				"title": "商業訴訟與爭端解決制度改革之比較研究",
				"creators": [
					{
						"firstName": "",
						"lastName": "黃兆揚",
						"creatorType": "author",
						"fildMode": 1
					},
					{
						"firstName": "",
						"lastName": "謝銘洋",
						"creatorType": "contributor",
						"fildMode": 1
					},
					{
						"firstName": "",
						"lastName": "何曜琛",
						"creatorType": "contributor",
						"fildMode": 1
					}
				],
				"abstractNote": "商業訴訟與商事處理制度攸關一國法治、經濟發展與競爭力，各國一向高度重視。2021 年我國商業法院新制成立，期能改善過往商業事件裁判效率不佳（延宕多年）與資源配置不當（重刑輕民）等結構面問題，積極邁向國際化。論文第二章從比較法的角度及歷史脈絡，分析商業事件的需求及程序特性，探討商業訴訟改革的目標與建構商業法院的方向。第三章延伸視野，介紹各區域（英國、美國、歐洲、亞洲）主要國家籌劃商業法院的經驗及改善商業訴訟的策略，發覺各國多以英國商業法院或英美法（沒有陪審的）商業程序規則為改革藍本。回顧我國的商業法院的建構模式，與程序新制，本章提出比較法的觀察心得。司法改革無法單靠公部門法院獨善其身，應借重民間專業蓬勃的活力及資訊科技，有效整合各種替代紛爭解決機制（ADR）。第四章檢視商業法院與仲裁、調解或其他爭議解決模式之分工協力與搭配關係，省思法院在眾多機制中適合扮演的角色與應有的轉型，包括以科技重塑法院程序之變革（網路法院計畫），並以實例分析商業事件採行 ADR 的可能性與挑戰。商業事件審理法已酌採英美法兼顧公平效率的事證開示與裁判規則。在此基礎上，第五章再擇選：「訴訟前守則（起訴前的紛爭解決規則）、錄取證詞（Deposition 作為事證開示方法）、書面證詞、即決裁判、專家證人」等英國或美國法上獨有而細膩的程序規則，作為未來商業訴訟持續提升取證之公平、程序之效率及裁判品質之參考。第六章為結論與建議。",
				"extra": "original-title: A Comparative Study on Institutional Reform for Commercial Litigation and Dispute Resolution",
				"language": "zh-TW",
				"libraryCatalog": "Lawbank",
				"numPages": "293",
				"place": "台灣",
				"thesisType": "博士學位論文",
				"university": "私立中國文化大學法律學研究所",
				"url": "https://www.lawbank.com.tw/treatise/ts_article.aspx?AID=T000010454",
				"attachments": [],
				"tags": [
					{
						"tag": "ADR"
					},
					{
						"tag": "commercial court"
					},
					{
						"tag": "discovery"
					},
					{
						"tag": "online court"
					},
					{
						"tag": "witness statement"
					},
					{
						"tag": "事證開示"
					},
					{
						"tag": "即決裁判"
					},
					{
						"tag": "商業事件"
					},
					{
						"tag": "商業法院"
					},
					{
						"tag": "紛爭解決"
					}
				],
				"notes": [],
				"seeAlso": []
			}
		]
	},
	{
		"type": "web",
		"url": "https://www.lawbank.com.tw/treatise/ts_article.aspx?AID=T000018124",
		"items": [
			{
				"itemType": "thesis",
				"title": "AI 在法律執行之應用與隱私權保障之研究",
				"creators": [
					{
						"firstName": "",
						"lastName": "許淑媛",
						"creatorType": "author",
						"fildMode": 1
					},
					{
						"firstName": "",
						"lastName": "施慧玲",
						"creatorType": "contributor",
						"fildMode": 1
					}
				],
				"abstractNote": "隨著科技的進步和人工智慧的發展，資訊的使用和共享越來越頻繁，這也使得隱私權保障變得越來越重要，本文針對人工智慧與隱私權保障進行研究，分析現代科技和資訊隱私權之間的拉鋸戰，並探討如何保障個人資訊自主權，本文指出隨著人工智慧技術的發展，個人資訊的搜集、分析和使用越來越容易，因此需要加強相關法律法規的制定和執行，同時也需要人工智慧技術的自我約束和監管。以人工智慧適用在協助執法為例，為法庭內及法庭外四個類型，以刑事量刑標準、親子酌定、法律機器人、科技執法為例，適用上有侵害隱私權或與隱私權對立等衝突時該如何處理，藉由這些法律上適用之例子來提出問題並解決之技術發展，未來可能會有更先進的加密技術、隱私保護技術、去識別化技術等出現以及符合可信賴 AI 原則來提出建議，可以在更好的數據流通分析與科技發展的同時，實現保護個人資料隱私。",
				"extra": "original-author: Hsu || Cadalina",
				"language": "zh-TW",
				"libraryCatalog": "Lawbank",
				"numPages": "152",
				"place": "台灣",
				"thesisType": "博士學位論文",
				"university": "國立中正大學法律學系",
				"url": "https://www.lawbank.com.tw/treatise/ts_article.aspx?AID=T000018124",
				"attachments": [],
				"tags": [
					{
						"tag": "Artificial Intelligence"
					},
					{
						"tag": "Information Autonomy"
					},
					{
						"tag": "Information Privacy"
					},
					{
						"tag": "Technology Enforcement"
					},
					{
						"tag": "The Protection of Privacy Right"
					},
					{
						"tag": "Trustworthy AI"
					},
					{
						"tag": "人工智慧"
					},
					{
						"tag": "個人資訊自主權"
					},
					{
						"tag": "可信賴AI"
					},
					{
						"tag": "科技執法"
					},
					{
						"tag": "資訊隱私"
					},
					{
						"tag": "隱私權保障"
					}
				],
				"notes": [],
				"seeAlso": []
			}
		]
	},
	{
		"type": "web",
		"url": "https://www.lawbank.com.tw/treatise/bk_book.aspx?AID=B000005715",
		"items": [
			{
				"itemType": "book",
				"title": "銀行法講義（2025 年 4 月版）",
				"creators": [
					{
						"firstName": "",
						"lastName": "戴銘昇",
						"creatorType": "author",
						"fildMode": 1
					}
				],
				"date": "2025-04",
				"abstractNote": "本講義蒐集了大量立法沿革、相關法令、法院裁判、行政函令、時事新聞與趣聞、學說及文章節錄、外國法等資訊，朝向「百科全書」的方向編纂，固定每月更新法令及增補最新實務見解，可作為教學之用，也可供實務工作者作為工具書之用。講義編寫時，各單元的內容會做有體系之編排，對於法令、裁判及函令，會在有疑義處做特殊標記，也會適時加上評釋。財經法能力之提升，除了要閱讀基本的教科書外，也必須涉獵各種資訊才行。讀者們如果能把本份講義讀熟，財經法能力應該會很驚人！本份講義也歡迎各校老師做為上課教材之用。",
				"language": "zh-TW",
				"libraryCatalog": "Lawbank",
				"numPages": "3222",
				"publisher": "台灣",
				"url": "https://www.lawbank.com.tw/treatise/bk_book.aspx?AID=B000005715",
				"attachments": [],
				"tags": [],
				"notes": [],
				"seeAlso": []
			}
		]
	},
	{
		"type": "web",
		"url": "https://www.lawbank.com.tw/treatise/author.aspx?AID=17977",
		"items": "multiple"
	},
	{
		"type": "web",
		"url": "https://www.lawbank.com.tw/treatise/pl_issue.aspx?IID=PI037425",
		"items": "multiple"
	},
	{
		"type": "web",
		"url": "https://db.lawbank.com.tw/SBAR/RESULTS.aspx?kw=%e8%a9%90%e9%a8%99&category=3",
		"items": "multiple"
	}
]
/** END TEST CASES **/
