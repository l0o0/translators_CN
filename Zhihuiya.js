{
	"translatorID": "f8fb9931-0f9c-493e-ac0a-e8721b2515c5",
	"label": "Zhihuiya",
	"creator": "jiaojiaodubai (maintained by AllinOnein), optimized for 2026 website structure",
	"target": "^https://analytics\\.zhihuiya\\.com",
	"minVersion": "6.0",
	"maxVersion": "",
	"priority": 100,
	"inRepository": true,
	"translatorType": 4,
	"browserSupport": "gcsibv",
	"lastUpdated": "2026-06-23 06:06:28"
}

/*
	***** BEGIN LICENSE BLOCK *****

	Copyright © 2024 jiaojiaodubai<jiaojiaodubai23@gmail.com>
	Copyright © 2026 AllinOnein<sunfei_1997@163.com>

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
	
	// ---- 专利权人提取 ----
	let extra = '';  // 用于存储附加信息
	
	// 获取中文和英文专利权人
	const chineseAssigneeElm = labels.get('^\\[标\\]原始申请\\(专利权\\)人$', true);
	const chineseAssignee = safeText(chineseAssigneeElm, 'p:first-child, .name.item, .item.el-popover__reference');
	
	const englishAssigneeElm = labels.get('^原始申请\\(专利权\\)人$', true);
	const englishAssignee = safeText(englishAssigneeElm, 'p:first-child, .name.item, .item.el-popover__reference');
	
	// 若没有，尝试 fallback 到当前专利权人
	let fallbackAssignee = '';
	if (!chineseAssignee && !englishAssignee) {
		const fallbackLabels = ['^\\[标\\]当前申请\\(专利权\\)人$', '^当前申请\\(专利权\\)人$'];
		for (const labelPattern of fallbackLabels) {
			const elm = labels.get(labelPattern, true);
			const textResult = safeText(elm, 'p:first-child, .name.item, .item.el-popover__reference');
			if (textResult) {
				fallbackAssignee = textResult;
				break;
			}
		}
	}
	
	// 决定 assignee 和 extra 内容
	if (chineseAssignee) {
		newItem.assignee = chineseAssignee;
		if (englishAssignee) {
			extra += 'Assignee English: ' + englishAssignee + '\n';
		}
	} else if (englishAssignee) {
		newItem.assignee = englishAssignee;
	} else if (fallbackAssignee) {
		newItem.assignee = fallbackAssignee;
	}

	// 如果 extra 不为空，写入 item 的 extra 字段
	if (extra) {
		// 若已有 extra 内容（可能来自其他逻辑），建议追加
		newItem.extra = (newItem.extra || '') + extra;
	}
	
	
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
			const priorityDateText = text(node, '.abst__timeline__item-date');
			if (priorityDateText) {
				newItem.priorityDate = ZU.trimInternal(priorityDateText);
				}
		}
	}
	newItem.legalStatus = text(doc, '.legal-tag');
	newItem.url = `https://analytics.zhihuiya.com/patent-view/abst?${tryMatch(url, /patentId=[^&]+/)}`;
	newItem.genre = text(doc, '.abst__patent-authority-type').replace(/\(.+?\)$/, '');
	const inventorLabels = ['^\\[标\\]发明人$', '^发明人$'];
	let inventorElements = null;
	for (const labelPattern of inventorLabels) {
		const elm = labels.get(labelPattern, true);
		const spans = elm.querySelectorAll('.name.item, .item.el-popover__reference');
		const links = elm.querySelectorAll('a');
		if (spans.length > 0 || links.length > 0) {
			inventorElements = spans.length > 0 ? spans : links;
			break;
		}
	}
	if (inventorElements) {
		const seenNames = new Set();
		inventorElements.forEach((row) => {
			const name = ZU.trimInternal(row.textContent);
			if (!seenNames.has(name)) {
				seenNames.add(name);
				const creator = ZU.cleanAuthor(ZU.capitalizeName(name), 'inventor');
				if (/[\u4e00-\u9fff]/.test(creator.lastName)) {
					creator.fieldMode = 1;
				}
				newItem.creators.push(creator);
			}
		});
	}
	newItem.attachments.push({
		title: 'Snapshot',
		document: doc
	});
	const patentId = tryMatch(url, /patentId=([^&]+)/, 1);
	if (patentId) {
		const pdfPageUrl = `https://analytics.zhihuiya.com/patent-view/pdf?patentId=${patentId}`;
		newItem.attachments.push({
			title: 'PDF Page',
			url: pdfPageUrl,
			mimeType: 'text/html'
		});
	}
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

function safeText(elem, selectors) {
	if (!elem) return '';
	const selectorList = selectors.split(',').map(s => s.trim());
	for (const selector of selectorList) {
		const found = text(elem, selector);
		if (found && found.trim()) {
			const trimmed = found.trim();
			if (trimmed !== '企业名称' && trimmed !== '-') {
				return trimmed;
			}
		}
	}
	return '';
}

/** BEGIN TEST CASES **/
var testCases = [
	{
		"type": "web",
		"url": "https://analytics.zhihuiya.com/patent-view/abst?_type=query&source_type=search_result&rows=100&patentId=54096db9-bc5f-485f-8c6f-d4335d598a40&sort=desc&page=1&q=%E8%BD%A8%E9%81%93%E7%81%AB%E8%BD%A6%E5%8F%8A%E9%AB%98%E9%80%9F%E8%BD%A8%E9%81%93%E7%81%AB%E8%BD%A6%E7%B4%A7%E6%80%A5%E5%AE%89%E5%85%A8%E5%88%B6%E5%8A%A8%E8%BE%85%E5%8A%A9%E8%A3%85%E7%BD%AE&signature=FEDssawMcDHd9MkpZuLq9NRJeRtEIKInQPqGYgzRQGY%3D&shareFrom=VIEW&date=20241102T070904Z&expire=94608000&shareId=351E2B497339672G3454C3E960B3D17B&version=1.0",
		"defer": true,
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
		"defer": true,
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
	},
	{
		"type": "web",
		"url": "https://analytics.zhihuiya.com/patent-view/abst?patentId=8b2cf66c-837d-4760-85e8-ba6800784404&shareId=CDE63B83-64E4-9C22-1F16-279439F97827&from=EXPORT&signature=oV3tAjafyaT0y9PNBFNu9WU4N4Amg21V0Nb42aCloh4%3D&expire=94608000&date=20260522T074905Z&version=1.0",
		"defer": true,
		"items": [
			{
				"itemType": "patent",
				"title": "Modified nucleoside, sirna comprising same, composition, and use method therefor",
				"creators": [
					{
						"firstName": "",
						"lastName": "王艳辉",
						"creatorType": "inventor",
						"fieldMode": 1
					},
					{
						"firstName": "",
						"lastName": "李军",
						"creatorType": "inventor",
						"fieldMode": 1
					},
					{
						"firstName": "",
						"lastName": "娄明亮",
						"creatorType": "inventor",
						"fieldMode": 1
					},
					{
						"firstName": "",
						"lastName": "熊慧中",
						"creatorType": "inventor",
						"fieldMode": 1
					},
					{
						"firstName": "",
						"lastName": "翟永彦",
						"creatorType": "inventor",
						"fieldMode": 1
					}
				],
				"issueDate": "2026-05-15",
				"abstractNote": "Provided are a modified nucleoside, a use and method for using the nucleoside to prepare an RNAi preparation for extrahepatic delivery, and an RNAi preparation for extrahepatic delivery obtained thereby. The RNAi preparation can effectively deliver RNAi to extrahepatic tissue, such as muscle tissue, like skeletal muscle tissue and myocardial tissue, and adipose tissue.",
				"applicationNumber": "PCT/CN2025/133302",
				"assignee": "信达生物制药(苏州)有限公司",
				"country": "世界知识产权组织",
				"extra": "Assignee English: INNOVENT BIOLOGICS (SUZHOU) CO., LTD.",
				"filingDate": "2025-11-07",
				"patentNumber": "WO2026098610A1",
				"place": "世界知识产权组织",
				"priorityDate": "2025-06-30",
				"priorityNumbers": "CN202510899205.6",
				"url": "https://analytics.zhihuiya.com/patent-view/abst?patentId=8b2cf66c-837d-4760-85e8-ba6800784404",
				"attachments": [
					{
						"title": "Snapshot",
						"mimeType": "text/html"
					},
					{
						"title": "PDF Page",
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
		"url": "https://analytics.zhihuiya.com/patent-view/abst?patentId=f7cdaed8-ecf9-4975-b68a-bce0a50e8a3f&shareId=FB241415-4E9F-73C1-37E5-46194D45EFGD&from=EXPORT&signature=C36YMoEtxOwskw%2BOjSfDJ31AXCDVCEc1QSmwZ1TNAJ4%3D&expire=94608000&date=20260517T143708Z&version=1.0",
		"defer": true,
		"items": [
			{
				"itemType": "patent",
				"title": "Sirna for regulating AGT gene expression and use thereof",
				"creators": [
					{
						"firstName": "",
						"lastName": "黄泽傲",
						"creatorType": "inventor",
						"fieldMode": 1
					},
					{
						"firstName": "",
						"lastName": "宋更申",
						"creatorType": "inventor",
						"fieldMode": 1
					},
					{
						"firstName": "",
						"lastName": "姬广屾",
						"creatorType": "inventor",
						"fieldMode": 1
					},
					{
						"firstName": "",
						"lastName": "杨硕",
						"creatorType": "inventor",
						"fieldMode": 1
					},
					{
						"firstName": "",
						"lastName": "吴玉成",
						"creatorType": "inventor",
						"fieldMode": 1
					},
					{
						"firstName": "",
						"lastName": "田志康",
						"creatorType": "inventor",
						"fieldMode": 1
					}
				],
				"issueDate": "2026-05-07",
				"abstractNote": "Provided are an siRNA for regulating AGT gene expression and the use thereof. The siRNA is verified in cellular experiments to have a significant inhibitory effect on AGT gene expression, and can be used in the development of a drug for treating and/or preventing diseases related to AGT gene expression.",
				"applicationNumber": "PCT/CN2025/131488",
				"assignee": "杭州天龙药业有限公司",
				"country": "世界知识产权组织",
				"extra": "Assignee English: HANGZHOU TIANLONG PHARMACEUTICAL CO., LTD.",
				"filingDate": "2025-10-31",
				"patentNumber": "WO2026092641A1",
				"place": "世界知识产权组织",
				"priorityDate": "2024-11-01",
				"priorityNumbers": "CN202411545710.2",
				"url": "https://analytics.zhihuiya.com/patent-view/abst?patentId=f7cdaed8-ecf9-4975-b68a-bce0a50e8a3f",
				"attachments": [
					{
						"title": "Snapshot",
						"mimeType": "text/html"
					},
					{
						"title": "PDF Page",
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
