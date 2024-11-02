{
	"translatorID": "f8fb9931-0f9c-493e-ac0a-e8721b2515c5",
	"label": "Zhihuiya",
	"creator": "jiaojiaodubai",
	"target": "^https://analytics\\.zhihuiya\\.com",
	"minVersion": "5.0",
	"maxVersion": "",
	"priority": 100,
	"inRepository": true,
	"translatorType": 4,
	"browserSupport": "gcsibv",
	"lastUpdated": "2024-11-02 08:28:05"
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


function detectWeb(_doc, url) {
	if (url.includes('/patent-view/abst?')) {
		return 'patent';
	}
	return false;
}

async function doWeb(doc, url) {
	const labels = new Labels(doc, '.abst__layout-row');
	const newItem = new Z.Item('patent');
	newItem.title = ZU.capitalizeTitle(text(doc, '.patent-app__title-context'));
	newItem.abstractNote = text(doc, '.abst__abst-content');
	newItem.place = newItem.country = text(doc, '.abst__patent-authority-type > span').slice(1, -1);
	newItem.assignee = text(labels.get('^当前申请\\(专利权\\)人', true), 'p:first-child');
	newItem.patentNumber = text(doc, '.patent-app__title-pn');
	const timeline = doc.querySelectorAll('.abst__timeline__item');
	for (const node of timeline) {
		const isCurrent = !!node.querySelector('.abst__timeline__item-patent-tag--current');
		const contentTags = Array.from(node.querySelectorAll('.abst__timeline__item-patent-tag')).map(elm => ZU.trimInternal(elm.textContent));
		if (isCurrent && contentTags.includes('申请号')) {
			newItem.filingDate = text(node, '.abst__timeline__item-date');
			newItem.applicationNumber = text(node, '.abst__timeline__item-pn');
		}
		else if (isCurrent && contentTags.includes('公开(公告)号')) {
			newItem.issueDate = text(node, '.abst__timeline__item-date');
		}
		else if (contentTags.includes('优先权')) {
			newItem.priorityNumbers = text(node, '.abst__timeline__item-pn');
		}
	}
	newItem.legalStatus = text(doc, '.legal-tag');
	newItem.url = `https://analytics.zhihuiya.com/patent-view/abst?${tryMatch(url, /patentId=[^&]+/)}`;
	newItem.genre = text(doc, '.abst__patent-authority-type').replace(/\(.+?\)$/, '');
	labels.get('^发明人$', true).querySelectorAll('a').forEach((row) => {
		const creator = ZU.cleanAuthor(ZU.capitalizeName(ZU.trimInternal(row.textContent)), 'inventor');
		if (/[\u4e00-\u9fff]/.test(creator.lastName)) {
			creator.fieldMode = 1;
		}
		newItem.creators.push(creator);
	});
	newItem.attachments.push({
		title: 'Snapshot',
		document: doc
	});
	newItem.complete();
}

class Labels {
	constructor(doc, selector) {
		this.data = [];
		this.emptyElm = doc.createElement('div');
		const nodes = doc.querySelectorAll(selector);
		for (const node of nodes) {
			// avoid nesting
			// avoid empty
			if (node.querySelector(selector) || !/\S/.test(node.textContent)) continue;
			const elmCopy = node.cloneNode(true);
			// avoid empty text
			while (![1, 3, 4].includes(elmCopy.firstChild.nodeType) || !/\S/.test(elmCopy.firstChild.textContent)) {
				elmCopy.removeChild(elmCopy.firstChild);
				if (!elmCopy.firstChild) break;
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
		}
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
		"url": "https://analytics.zhihuiya.com/patent-view/abst?_type=query&source_type=search_result&rows=100&patentId=54096db9-bc5f-485f-8c6f-d4335d598a40&sort=desc&page=1&q=%E8%BD%A8%E9%81%93%E7%81%AB%E8%BD%A6%E5%8F%8A%E9%AB%98%E9%80%9F%E8%BD%A8%E9%81%93%E7%81%AB%E8%BD%A6%E7%B4%A7%E6%80%A5%E5%AE%89%E5%85%A8%E5%88%B6%E5%8A%A8%E8%BE%85%E5%8A%A9%E8%A3%85%E7%BD%AE&signature=FEDssawMcDHd9MkpZuLq9NRJeRtEIKInQPqGYgzRQGY%3D&shareFrom=VIEW&date=20241102T070904Z&expire=94608000&shareId=351E2B497339672G3454C3E960B3D17B&version=1.0",
		"items": [
			{
				"itemType": "patent",
				"title": "轨道火车及高速轨道火车紧急安全制动辅助装置",
				"creators": [
					{
						"firstName": "",
						"lastName": "张凯军",
						"creatorType": "inventor",
						"fieldMode": 1
					},
					{
						"firstName": "",
						"lastName": "赵永杰",
						"creatorType": "inventor",
						"fieldMode": 1
					},
					{
						"firstName": "",
						"lastName": "陈朝岗",
						"creatorType": "inventor",
						"fieldMode": 1
					}
				],
				"issueDate": "2013-03-27",
				"abstractNote": "本实用新型涉及一种轨道火车及高速轨道火车紧急安全制动辅助装置。现有的轨道火车及高速轨道火车在制动过程中轮毂和钢轨是点接触而引起附着力较小易产生滑移不能有效减速和缩短制动距离的问题。本实用新型在现有轨道火车及高速轨道火车的转向架同侧相邻两个轮毂桥架中间安装一个制动时可自由上下伸缩并能与钢轨相接触能增大摩擦力矩的制动辅助装置。该装置由摩擦片、摩擦片座、导向移动柱、基座、回位弹簧、联动杆、制动气室推柱及制动气室组成。该装置在制动过程中能增大火车的转向架与钢轨之间附着力及摩擦力，使高速行驶的轨道火车及高速轨道火车在紧急情况下迅速减速缩短制动距离并安全停车的制动辅助装置。",
				"applicationNumber": "CN201220158825.2",
				"assignee": "2012-04-05 申请日 CN201220158825.2 当前专利 申请号 2013-03-27 公开(公告)日, 授权日 CN202827616U 当前专利 公开(公告)号 2018-04-05 失效日 2022-04-05 预估到期日",
				"country": "中国",
				"filingDate": "2012-04-05",
				"legalStatus": "未缴年费",
				"patentNumber": "CN202827616U",
				"place": "中国",
				"url": "https://analytics.zhihuiya.com/patent-view/abst?patentId=54096db9-bc5f-485f-8c6f-d4335d598a40",
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
		"url": "https://analytics.zhihuiya.com/patent-view/abst?_type=query&source_type=search_result&rows=100&patentId=bdea2d87-b082-46c9-a084-919a389675eb&sort=desc&page=1&q=5G&efq=ANCS%3A%28%22%E5%8D%8E%E4%B8%BA%E6%8A%80%E6%9C%AF%E6%9C%89%E9%99%90%E5%85%AC%E5%8F%B8%22%29&signature=bXaeZcICVuCYF1ODaqxXKRovt7JQPnuI3z5wBeNS7s4%3D&shareFrom=VIEW&date=20241102T081043Z&expire=94608000&shareId=351E2B497339672G3454C3E960B3D17B&version=1.0",
		"items": [
			{
				"itemType": "patent",
				"title": "Transmission method and apparatus",
				"creators": [
					{
						"firstName": "Fan",
						"lastName": "Qiang",
						"creatorType": "inventor"
					},
					{
						"firstName": "Wang",
						"lastName": "Jun",
						"creatorType": "inventor"
					},
					{
						"firstName": "Dai",
						"lastName": "Mingzeng",
						"creatorType": "inventor"
					}
				],
				"issueDate": "2024-10-18",
				"abstractNote": "This application provides a transmission method and apparatus. The method includes: A first terminal device obtains information about N SL transmission units. The N SL transmission units are used on an SL for sending a data packet of a unicast connection or a groupcast communication group. The first terminal device transmits the data packet to a second terminal device by using an unused SL transmission unit in the N SL transmission units through a HARQ process used for the unicast connection or the groupcast communication group. The second terminal device sends a HARQ feedback result to the first terminal device based on a decoding result. When the first terminal device has not received the HARQ feedback result or the received HARQ feedback result indicates that the data packet fails to be transmitted, the first terminal device retransmits the data packet by using a next unused SL transmission unit in the N SL transmission units. A HARQ feedback retransmission mechanism and a corresponding resource allocation method are introduced into SL transmission, to improve reliability of a data packet in the SL transmission. FIG. 3",
				"applicationNumber": "IN202438077622",
				"assignee": "HUAWEI TECHNOLOGIES CO., LTD.",
				"country": "印度",
				"filingDate": "2024-10-14",
				"legalStatus": "公开",
				"patentNumber": "IN202438077622A",
				"place": "印度",
				"priorityNumbers": "CN201811302615.4",
				"url": "https://analytics.zhihuiya.com/patent-view/abst?patentId=bdea2d87-b082-46c9-a084-919a389675eb",
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
	}
]
/** END TEST CASES **/
