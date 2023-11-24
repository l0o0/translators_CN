{
	"translatorID": "8276f7cf-bc43-45b5-9409-8ba2af369c60",
	"label": "PatentStar",
	"creator": "Yizhao Wan",
	"target": "^https?://((www)|(cprs)).patentstar.com.cn",
	"minVersion": "3.0",
	"maxVersion": "",
	"priority": 100,
	"inRepository": true,
	"translatorType": 4,
	"browserSupport": "gcsibv",
	"lastUpdated": "2023-10-26 16:46:36"
}

/*
	***** BEGIN LICENSE BLOCK *****

	Copyright © 2020 Yizhao Wan, https://github.com/Zotero-CN/translators_CN
	
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
	if (url.includes('/Detail?')) {
		return 'patent';
	}
	else if (getSearchResults(doc, true)) {
		return 'multiple';
	}
	return false;
}

function getSearchResults(doc, checkOnly) {
	var items = {};
	var found = false;
	var rows = doc.querySelectorAll('label.title-color');
	for (let row of rows) {
		let ane = row.getAttribute('data-ane');
		let title = ZU.trimInternal(row.getAttribute('title'));
		if (!ane || !title) continue;
		if (checkOnly) return true;
		found = true;
		items[ane] = title;
	}
	return found ? items : false;
}

async function doWeb(doc, url) {
	if (detectWeb(doc, url) == 'multiple') {
		let items = await Zotero.selectItems(getSearchResults(doc, false));
		if (!items) return;
		for (let ane of Object.keys(items)) {
			let href = `/Search/Detail?ANE=${ane}`;
			await scrape(await requestDocument(href), href);
		}
	}
	else {
		// Z.debug(ane);
		await scrape(doc, url);
	}
}

async function scrape(doc, url) {
	var newItem = new Zotero.Item('patent');
	let ane = url.match(/ANE=[A-Z\d]+/)[0].substring(4);
	try {
		let dataUrl = "/Search/GetPatentByIDE";
		let postIDE = `IDE=${ane}`;
		let citationDetail = await requestJSON(
			dataUrl,
			{
				method: 'POST',
				body: postIDE
			}
		);
		if (citationDetail.Ret != 200) throw new Error('连接异常');
		var jsonData = citationDetail.Data.Patent;
		newItem.title = jsonData.TI;
		newItem.abstractNote = jsonData.AB;
		newItem.place = jsonData.DZ;
		newItem.country = jsonData.GJ;
		newItem.assignee = jsonData.PA;
		newItem.patentNumber = jsonData.AN;
		newItem.filingDate = toISODate(jsonData.AD);
		newItem.applicationNumber = jsonData.AN;
		newItem.priorityNumbers = jsonData.PR;
		newItem.issueDate = toISODate(jsonData.GD);
		newItem.legalStatus = {
			1: "有效",
			2: "失效",
			3: "审中"
		}[jsonData.LG];
		newItem.url = `https://cprs.patentstar.com.cn/Search/Detail?ANE=${ane}`;
		newItem.rights = jsonData.CL;
		newItem.type = {
			1: "发明专利",
			2: "实用新型专利",
			3: "外观专利"
		}[jsonData.PT];
		newItem.creators = jsonData.IN.split(/\s?;/).map(creator => handleName(creator));
	}
	catch (error) {
		newItem.title = doc.querySelector('label.title-color').title;
		var docData = {
			content: doc.querySelector('div.item-content.fl').innerText.split('\n\n'),
			getContent: function (label) {
				let point = this.content.indexOf(`${label}：`);
				if (point < 0) return '';
				return this.content[point + 1];
			},
			getSummery: function (label) {
				try {
					let summery = doc.querySelector('div.item-summary').innerText.split('\n\n');
					return summery.find(element => element.startsWith(label));
				}
				catch (error) {
					return '';
				}
			}
		};
		Z.debug(docData);
		newItem.abstractNote = docData.getSummery('摘要');
		newItem.place = docData.getContent('申请人地址');
		newItem.country = docData.getContent('国家/省市');
		newItem.assignee = docData.getContent('代理人');
		newItem.patentNumber = docData.getContent('申请号');
		newItem.filingDate = docData.getContent('申请日');
		newItem.applicationNumber = docData.getContent('申请号');
		newItem.priorityNumbers = docData.getContent('优先权');
		newItem.issueDate = docData.getContent('授权公告日');
		newItem.legalStatus = docData.getContent('当前状态');
		newItem.rights = docData.getSummery('主权利要求');
		newItem.creators = docData.getContent('发明人').split('  ').map(creator => handleName(creator));
	}
	
	/***************************************************************************/
	// 使用api获取pdf,该api返回的Data数据中包含可能包含两个pdf文件的网址
	// 如果有两个网址，则第一个为申请文件，第二个为授权文件
	// 故存在两个网址时，则取第二个作为附件保存
	// 注：以下代码在Scaffold调试时可能失败，但在浏览器是成功的
	if (doc.querySelector('span.username')) {
		let pdfGetUrl = "/WebService/GetPDFUrl";
		let postANE = `ANE=${ane}`;
		let pdfDetail = await requestJSON(
			pdfGetUrl,
			{
				method: 'POST',
				body: postANE
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
			newItem.debug = pdfDetail;
		}
	}
	newItem.url = url;
	newItem.complete();
}

function toISODate(str) {
	if (!str) return '';
	return str.replace(/^(\d{4})(\d{2})/, "$1-$2-");
}

function handleName(creator) {
	if (/[A-Za-z]/.test(creator)) {
		creator = ZU.cleanAuthor(creator, 'author');
	}
	else {
		let type = (creator.endsWith("指导")) ? 'contributor' : 'author';
		creator = creator.replace(/[等主编著]$/, '');
		creator = creator.replace(/\s/g, '');
		creator = {
			lastName: creator,
			creatorType: type,
			fieldMode: 1
		};
	}
	return creator;
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
						"lastName": "谢桂福",
						"creatorType": "author",
						"fieldMode": 1
					},
					{
						"lastName": "杨正星",
						"creatorType": "author",
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
				"place": "511365 广东省广州市增城区中新镇迳贝路8号",
				"rights": "1.一种空压机皮带自动预紧装置，应用于张紧压缩机（1）和发动机（2）之间的皮带（3），其特征在于，预紧装置包括连接架（4）、恒压牵引机构（5）、第一张力轮（6）和第二张力轮（7），所述连接架（4）的两端分别与发动机（2）的输出轴以及压缩机（1）的输入轴转动连接，所述恒压牵引机构（5）设置在所述连接架（4）上，所述恒压牵引机构（5）具有第一安装部和第二安装部，所述第一安装部和第二安装部位于所述连接架（4）的两侧，所述第一安装部和第二安装部可沿垂直于发动机（2）输出轴和压缩机（1）输入轴轴心连线的方向相向或背向移动，所述第一张力轮（6）转动地设置在所述第一安装部上，所述第二张力轮（7）转动地设置在所述第二安装部上，皮带（3）的两侧分别跨接在第一张力轮（6）和第二张力轮（7）上，工作状态下，第一张力轮（6）和第二张力轮（7）以恒定的压力张紧皮带（3）。",
				"url": "https://cprs.patentstar.com.cn/Search/Detail?ANE=9DHD6FBA7BEA6BCA3CAA9IHH8AIA9CHC9GDA8BGACEGAEHFA",
				"attachments": [],
				"tags": [],
				"notes": [],
				"seeAlso": []
			}
		]
	}
]
/** END TEST CASES **/
