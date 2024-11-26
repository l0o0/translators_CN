{
	"translatorID": "8276f7cf-bc43-45b5-9409-8ba2af369c60",
	"label": "PatentStar",
	"creator": "Yizhao Wan, jiaojiaodubai",
	"target": "^https?://((www)|(cprs))\\.patentstar\\.com\\.cn",
	"minVersion": "3.0",
	"maxVersion": "",
	"priority": 100,
	"inRepository": true,
	"translatorType": 4,
	"browserSupport": "gcsibv",
	"lastUpdated": "2024-11-26 05:51:41"
}

/*
	***** BEGIN LICENSE BLOCK *****

	Copyright © 2020 Yizhao Wan; 2024 jiojiaodubai
	
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
	const list = doc.querySelector('#listcontainer');
	if (list) {
		Z.monitorDOMChanges(list, { childList: true });
	}
	if (url.includes('/Detail')) {
		return 'patent';
	}
	else if (getSearchResults(doc, true)) {
		return 'multiple';
	}
	return false;
}

function getSearchResults(doc, checkOnly) {
	const items = {};
	let found = false;
	const rows = doc.querySelectorAll('label.title-color');
	for (const row of rows) {
		const ane = row.getAttribute('data-ane') || row.getAttribute('data-pne');
		const title = ZU.trimInternal(row.getAttribute('title'));
		if (!ane || !title) continue;
		if (checkOnly) return true;
		found = true;
		items[ane] = title;
	}
	return found ? items : false;
}

async function doWeb(doc, url) {
	if (detectWeb(doc, url) == 'multiple') {
		const items = await Zotero.selectItems(getSearchResults(doc, false));
		if (!items) return;
		for (const ane of Object.keys(items)) {
			const href = `/Search/Detail?ANE=${ane}`;
			await scrape(await requestDocument(href), href);
		}
	}
	else {
		await scrape(doc, url);
	}
}

async function scrape(doc, url) {
	var newItem = new Zotero.Item('patent');
	let ide = tryMatch(url, /[AP]NE=([A-Z\d]+)/, 1);
	Z.debug(ide);
	try {
		let dataUrl = "/Search/GetPatentByIDE";
		let postData = `IDE=${ide}${/ANE=/.test(url) ? '' : '&type=1'}`;
		Z.debug(postData);
		let citationDetail = await requestJSON(
			dataUrl,
			{
				method: 'POST',
				body: postData
			}
		);
		Z.debug(citationDetail);
		if (citationDetail.Ret != 200) throw new Error('连接异常');
		var jsonData = citationDetail.Data.Patent;
		newItem.title = jsonData.TI;
		newItem.abstractNote = jsonData.AB;
		// newItem.place = jsonData.DZ;
		newItem.place = jsonData.GJ;
		newItem.country = jsonData.GJ;
		newItem.assignee = jsonData.FP;
		newItem.patentNumber = jsonData.AN;
		newItem.filingDate = toISODate(jsonData.AD);
		newItem.applicationNumber = jsonData.AN;
		newItem.priorityNumbers = jsonData.PR;
		newItem.issueDate = toISODate(jsonData.GD || jsonData.PD);
		newItem.legalStatus = {
			1: "有效",
			2: "失效",
			3: "审中"
		}[jsonData.LG];
		newItem.url = `https://cprs.patentstar.com.cn/Search/Detail?ANE=${ide}`;
		newItem.rights = jsonData.CL;
		newItem.genre = {
			1: "发明专利",
			2: "实用新型专利",
			3: "外观专利"
		}[jsonData.PT];
		jsonData.IN.split(/\s?;/).forEach(creator => newItem.creators.push(cleanAuthor(creator)));
	}
	catch (error) {
		Z.debug(error);
		newItem.title = attr(doc, 'label.title-color', 'title');
		let labels = new Labels(doc, '.item-content > div');
		Z.debug(labels.data.map(arr => [arr[0], ZU.trimInternal(arr[1].innerText)]));
		newItem.abstractNote = text(doc, '.item-summary > p:nth-child(1) > strong+span');
		// newItem.place = labels.getWith('申请人地址');
		newItem.place = labels.get('国家/省市');
		newItem.country = labels.get('国家/省市');
		newItem.assignee = labels.get('当前权利人');
		newItem.patentNumber = labels.get('申请号');
		newItem.filingDate = labels.get('申请日').replace(/\./g, '-');
		newItem.applicationNumber = labels.get('申请号');
		newItem.priorityNumbers = labels.get('优先权');
		newItem.issueDate = labels.get(['授权公告日', '公开日']).replace(/\./g, '-');
		newItem.legalStatus = labels.get('当前状态');
		newItem.rights = text(doc, '.item-summary > p:nth-child(2) > strong+span');
		labels.get('发明人', true).querySelectorAll('a').forEach((element) => {
			newItem.creators.push(cleanAuthor(ZU.trimInternal(element.textContent)));
		});
	}
	
	/***************************************************************************/
	// 使用api获取pdf,该api返回的Data数据中包含可能包含两个pdf文件的网址
	// 如果有两个网址，则第一个为申请文件，第二个为授权文件
	// 故存在两个网址时，则取第二个作为附件保存
	// 注：以下代码在Scaffold调试时可能失败，但在浏览器是成功的
	if (doc.querySelector('span.username')) {
		let pdfGetUrl, postIDE;
		if (/ANE=/.test(url)) {
			pdfGetUrl = '/WebService/GetPDFUrl';
			postIDE = `ANE=${ide}`;
		}
		else {
			pdfGetUrl = '/WebService/GetPDFUrl_EN';
			postIDE = `PNE=${ide}`;
		}
		let pdfDetail = await requestJSON(
			pdfGetUrl,
			{
				method: 'POST',
				body: postIDE
			}
		);
		try {
			if (pdfDetail.Ret != 200) throw new Error('获取pdf地址失败');
			let pdfurl = pdfDetail.Data.pop();
			newItem.attachments.push({
				title: "Full Text PDF",
				mimeType: "application/pdf",
				url: pdfurl
			});
		}
		catch (error) {
			newItem.debug = JSON.stringify(pdfDetail);
		}
	}
	newItem.url = url;
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

function toISODate(str) {
	if (!str) return '';
	return str.replace(/^(\d{4})(\d{2})/, "$1-$2-");
}

function cleanAuthor(name) {
	const creator = ZU.cleanAuthor(name.replace(/指导$/, ''), name.endsWith('指导') ? 'contributor' : 'inventor');
	if (/[\u4e00-\u9fff]/.test(creator.lastName)) {
		creator.lastName = creator.firstName + creator.lastName;
		creator.firstName = '';
		creator.fieldMode = 1;
	}
	return creator;
}

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
		"url": "https://cprs.patentstar.com.cn/Search/ResultList?CurrentQuery=5Y+R5Yqo5py6L1lZ&type=cn",
		"items": "multiple"
	},
	{
		"type": "web",
		"url": "https://cprs.patentstar.com.cn/Search/Detail?ANE=9DHD6FBA7BEA6BCA3CAA9IHH8AIA9CHC9GDA8BGACEGAEHFA",
		"items": [
			{
				"itemType": "patent",
				"title": "一种空压机皮带自动预紧装置",
				"creators": [
					{
						"firstName": "",
						"lastName": "谢桂福",
						"creatorType": "inventor",
						"fieldMode": 1
					},
					{
						"firstName": "",
						"lastName": "杨正星",
						"creatorType": "inventor",
						"fieldMode": 1
					}
				],
				"issueDate": "2023-10-10",
				"abstractNote": "本发明涉及传动皮带张紧技术领域，具体是涉及一种空压机皮带自动预紧装置，包括连接架、恒压牵引机构、第一张力轮和第二张力轮，连接架的两端分别与发动机的输出轴以及压缩机的输入轴转动连接，恒压牵引机构设在连接架上，恒压牵引机构具有第一安装部和第二安装部，第一张力轮转动地设置在第一安装部上，第二张力轮转动地设置在第二安装部上，皮带的两侧分别跨接在第一张力轮和第二张力轮上，本发明通过将连接架的两端与压缩机输入轴和电动机输出轴转动连接，使得皮带在出现松弛现象时，恒压牵引机构能够自行将第一张力轮和第二张力轮以恒定的压力绷紧皮带，提高调节效率，精确度更高，可实时响应，减少操作风险。",
				"applicationNumber": "CN202311020199.X",
				"assignee": "广州艾玛压缩机有限公司",
				"country": "CN",
				"filingDate": "2023-08-15",
				"legalStatus": "有效",
				"patentNumber": "CN202311020199.X",
				"place": "CN",
				"rights": "1.一种空压机皮带自动预紧装置，应用于张紧压缩机（1）和发动机（2）之间的皮带（3），其特征在于，预紧装置包括连接架（4）、恒压牵引机构（5）、第一张力轮（6）和第二张力轮（7），所述连接架（4）的两端分别与发动机（2）的输出轴以及压缩机（1）的输入轴转动连接，所述恒压牵引机构（5）设置在所述连接架（4）上，所述恒压牵引机构（5）具有第一安装部和第二安装部，所述第一安装部和第二安装部位于所述连接架（4）的两侧，所述第一安装部和第二安装部可沿垂直于发动机（2）输出轴和压缩机（1）输入轴轴心连线的方向相向或背向移动，所述第一张力轮（6）转动地设置在所述第一安装部上，所述第二张力轮（7）转动地设置在所述第二安装部上，皮带（3）的两侧分别跨接在第一张力轮（6）和第二张力轮（7）上，工作状态下，第一张力轮（6）和第二张力轮（7）以恒定的压力张紧皮带（3）。",
				"url": "https://cprs.patentstar.com.cn/Search/Detail?ANE=9DHD6FBA7BEA6BCA3CAA9IHH8AIA9CHC9GDA8BGACEGAEHFA",
				"attachments": [],
				"tags": [],
				"notes": [],
				"seeAlso": []
			}
		]
	},
	{
		"type": "web",
		"url": "https://cprs.patentstar.com.cn/Search/Detail_EN?PNE=MEGAYFFA2AAA6ECA9CID9FED9HHF9BIB9EEF8CGA9HBC9CAAFBEA9GFE",
		"items": [
			{
				"itemType": "patent",
				"title": "Anticuerpos anti-tigit, anticuerpos anti-cd96 y métodos de uso de estos",
				"creators": [
					{
						"firstName": "CHAND DHAN",
						"lastName": "SIDHARTHA",
						"creatorType": "inventor"
					},
					{
						"firstName": "JAWAD",
						"lastName": "ZAHRA",
						"creatorType": "inventor"
					},
					{
						"firstName": "IGNATOVICH",
						"lastName": "OLGA",
						"creatorType": "inventor"
					},
					{
						"firstName": "RAMSAY NICOLA",
						"lastName": "ANNE",
						"creatorType": "inventor"
					},
					{
						"firstName": "CAMPBELL",
						"lastName": "SPENCER",
						"creatorType": "inventor"
					},
					{
						"firstName": "WENSLEY",
						"lastName": "BETH",
						"creatorType": "inventor"
					},
					{
						"firstName": "BRIEND EMMANUEL CYRILLE",
						"lastName": "PASCAL",
						"creatorType": "inventor"
					},
					{
						"firstName": "BUSHELL K.",
						"lastName": "MARK",
						"creatorType": "inventor"
					},
					{
						"firstName": "MORIN BENJAMIN",
						"lastName": "MAXIME",
						"creatorType": "inventor"
					},
					{
						"firstName": "ILKOW VERONICA",
						"lastName": "FRANCISZKA",
						"creatorType": "inventor"
					}
				],
				"issueDate": "2023-11-30",
				"abstractNote": "The instant disclosure provides multispecific molecules that specifically bind to CD96 (e.g., human CD96) and/or TIGIT (e.g., human TIGIT) and isolated antibodies that specifically bind to TIGIT (e.g., human TIGIT). Also provided are pharmaceutical compositions comprising these multispecific molecules and antibodies, nucleic acids encoding these multispecific molecules and antibodies, expression vectors and host cells for making these multispecific molecules and antibodies, and methods of treating a subject using these multispecific molecules and antibodies.",
				"applicationNumber": "CO2023016037A",
				"assignee": "AGENUS INC",
				"country": "CO(哥伦比亚)",
				"filingDate": "2023-11-23",
				"patentNumber": "CO2023016037A",
				"place": "CO(哥伦比亚)",
				"priorityNumbers": "WO2022US72099 20220504;US202163201537P 20210504",
				"url": "https://cprs.patentstar.com.cn/Search/Detail_EN?PNE=MEGAYFFA2AAA6ECA9CID9FED9HHF9BIB9EEF8CGA9HBC9CAAFBEA9GFE",
				"attachments": [],
				"tags": [],
				"notes": [],
				"seeAlso": []
			}
		]
	}
]
/** END TEST CASES **/
