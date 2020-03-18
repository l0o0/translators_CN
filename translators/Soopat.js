{
	"translatorID": "441ffe59-2049-41b1-8ead-7a3a53f7d0bd",
	"label": "Soopat",
	"creator": "Xingzhong Lin",
	"target": "^https?://([^/]+\\.)?soopat\\.com",
	"minVersion": "1.0",
	"maxVersion": "",
	"priority": 100,
	"inRepository": true,
	"translatorType": 4,
	"browserSupport": "gcsv",
	"lastUpdated": "2020-03-18 06:28:12"
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


function detectWeb(doc, url) {
	var items = getSearchItems(doc);
	// Z.debug(items);
	if (items && !url.includes("Patent")) {
		return "multiple";
	}
	else if (url.includes("Patent")) {
		return "patent";
	}
}

function scrape(doc, url, loginStatus) {
	var newItem = new Zotero.Item("patent");
	var detailtitle = ZU.xpath(doc, "//span[@class='detailtitle']")[0];
	var title = ZU.xpath(detailtitle, "./h1")[0];
	title = title.innerText.split(/\s/)[0];
	var appNo = ZU.xpath(detailtitle, "./strong")[0].innerText.split(/[：\s]/);
	var appDate = appNo[3];
	appNo = appNo[1];
	var ab = ZU.xpath(doc, "//b[contains(text(), '摘要：')]/parent::td")[0].innerText;
	Z.debug(title + appDate + appNo);
	newItem.url = url;
	newItem.title = title;
	newItem.abstractNote = ab;
	newItem.applicationNumber = appNo;
	newItem.filingDate = appDate;
	newItem.attorneyAgent = ZU.xpath(doc, "//tr[td='专利代理机构']/td[2]")[0].innerText;
	newItem.assignee = ZU.xpath(doc, "//tr[td='代理人']/td[2]")[0].innerText;
	var legalStatusNodes = ZU.xpath(detailtitle, "./h1/div");
	var legalStatus = "";
	for (var n of legalStatusNodes) {
		legalStatus += "," + n.innerText;
	}
	if (legalStatus) {
		newItem.legalStatus = legalStatus.substr(1);
	}
	var note = ZU.xpath(doc, "//tr[td='主权项']/td[2]")[0].innerText;
	if (note) {
		newItem.notes = [{ note: note }];
	}
	var inventors = ZU.xpath(doc, "//table[@class='datainfo']//tr[6]/td/a");
	newItem.creators = [];
	for (let inventor of inventors) {
		inventor = inventor.innerText;
		var creator = {};
		var lastSpace = inventor.lastIndexOf(' ');
		if (inventor.search(/[A-Za-z]/) !== -1 && lastSpace !== -1) {
			// western name. split on last space
			creator.firstName = inventor.substr(0, lastSpace);
			creator.lastName = inventor.substr(lastSpace + 1);
		}
		else {
			// Chinese name. first character is last name, the rest are first name
			creator.firstName = inventor.substr(1);
			creator.lastName = inventor.charAt(0);
		}
		newItem.creators.push(creator);
	}
	newItem.place = ZU.xpath(doc, "//b[contains(text(), '申请人：')]/parent::td/a")[0].innerText;
	var downlink = ZU.xpath(doc, "//div[@class='mix']/a[2]")[0].getAttribute('onclick').split("'")[1];
	// Z.debug(downlink);
	if (loginStatus) {
		getPDF(downlink, newItem);
	}
	else {
		newItem.complete();
	}
}

function doWeb(doc, url) {
	var loginStatus = detectLogin(doc);
	if (detectWeb(doc, url) == "multiple") {
		var itemInfos = {};
		var items = getSearchItems(doc, itemInfos);
		Z.selectItems(items, function (selectedItems) {
			if (!selectedItems) return true;
			// Z.debug(Object.keys(selectedItems));
			var urls = Object.keys(selectedItems);
			getItemsFromSearch(urls, itemInfos, loginStatus);
		});
	}
	else {
		scrape(doc, url, loginStatus);
	}
}


// get item fields from search page
function getSearchItems(doc, itemInfos) {
	var patentNodes = ZU.xpath(doc, "//div[@class='PatentBlock']");
	var items = {};
	for (var i = 0, n = patentNodes.length; i < n; i++) {
		var patent = patentNodes[i];
		// Z.debug(patent.innerText);
		var patentType = ZU.xpath(patent, ".//h2[@class='PatentTypeBlock']");
		if (patentType.length == 0) {
			Z.debug('pass');
			continue;
		}
		var url = patentType[0].getElementsByTagName('a')[0].href;
		items[url] = patentType[0].innerText;
		if (itemInfos) {
			itemInfos[url] = patent;
		}
	}
	return items;
}

// detect user login state
function detectLogin(doc) {
	var loginHeader = ZU.xpath(doc, "//div[@class='login']")[0];
	var counts = (loginHeader.innerText.match(/登录/g) || []).length;
	if (counts == 2) {
		return false;
	}
	else {
		return true;
	}
}


function getPDF(downlink, newItem) {
	ZU.doGet(downlink, function (text) {
		// Z.debug(text);
		var parser = new DOMParser();
		var downHtml = parser.parseFromString(text, 'text/html');
		var link = ZU.xpath(downHtml, "//table/tbody/tr[3]/td[4]/a")[0];
		newItem.attachments = [{
			title: "Full Text PDF",
			mimeType: "application/pdf",
			url: link.href
		}];
		newItem.complete();
	});
}


function getItemsFromSearch(urls, itemInfos, loginStatus) {
	if (!urls.length) return;
	for (var url of urls) {
		var patent = itemInfos[url];
		// Z.debug(url);
		var newItem = new Zotero.Item("patent");
		newItem.url = url;
		var patentType = ZU.xpath(patent, ".//h2[@class='PatentTypeBlock']");
		var headers = patentType[0].innerText.split(/\s/);
		newItem.title = headers[1];
		newItem.applicationNumber = headers[3];
		newItem.filingDate = ZU.xpath(patent, ".//span[@class='PatentAuthorBlock']")[0].innerText.split(/[\s：]/)[4];
		newItem.abstractNote = ZU.xpath(patent, ".//span[@class='PatentContentBlock']")[0].innerText.replace('摘要:', '');
		newItem.place = ZU.xpath(doc, "//b[contains(text(), '申请人：')]/parent::td/a")
		  .map(item => item.innerText).join(';');
		newItem.legalStatus = ZU.xpath(patent, ".//h2[@class='PatentTypeBlock']")[0].innerText.split(/\s/).slice(4, -1).join(',');
		var downlink = ZU.xpath(patent, ".//span[@class='PatentBottomBlock']/a[3]")[0].getAttribute('onclick').split("'")[1];
		if (loginStatus){
			getPDF(downlink, newItem);
		}
		else {
			newItem.complete();
		}
	}
}

/** BEGIN TEST CASES **/
var testCases = [
	{
		"type": "web",
		"url": "http://www.soopat.com/Patent/201711256672",
		"items": [
			{
				"itemType": "patent",
				"title": "一种提高类PSE鸡胸肉肌原纤维蛋白凝胶品质的糖基化方法",
				"creators": [
					{
						"firstName": "幸莲",
						"lastName": "徐"
					},
					{
						"firstName": "光亮",
						"lastName": "卞"
					},
					{
						"firstName": "敏义",
						"lastName": "韩"
					},
					{
						"firstName": "虎虎",
						"lastName": "王"
					},
					{
						"firstName": "玉娟",
						"lastName": "许"
					},
					{
						"firstName": "光宏",
						"lastName": "周"
					},
					{
						"firstName": "士昌",
						"lastName": "邵"
					}
				],
				"abstractNote": "摘要：本发明公开了一种提高类PSE鸡胸肉肌原纤维蛋白凝胶品质的糖基化方法，该方法的步骤如下：(1)原材料处理；(2)肌原纤维蛋白的提取；(3)糖基化处理；(4)除糖处理；(5)凝胶制备获得蛋白凝胶。本发明使用的非酶湿法糖基化法对类PSE鸡胸肉进行处理，处理条件温和、均匀、无害；糖基化技术能够通过共价结合的形式对PSE鸡肉的肌原纤维蛋白进行改性，改变蛋白质的结构和加工特性，通过提高鸡胸肉肌原纤维蛋白凝胶的保水性和凝胶硬度，提高其凝胶品质和经济效益。",
				"applicationNumber": "201711256672.9",
				"assignee": "李德溅 徐冬涛",
				"filingDate": "2017-12-04",
				"legalStatus": "审中-实审",
				"place": "南京农业大学",
				"url": "http://www.soopat.com/Patent/201711256672",
				"attachments": [],
				"tags": [],
				"notes": [
					{
						"note": " 一种提高类PSE鸡胸肉肌原纤维蛋白凝胶品质的糖基化方法，其特征在于：所述方法的步骤如下：(1)原材料处理：将类PSE鸡胸肉去除结缔组织和脂肪，切成小块并绞碎；(2)肌原纤维蛋白的提取：将处理后的类PSE鸡胸肉按质量体积比加入四倍的标准盐溶液中，匀浆、双层纱布过滤后，用2000×g、至少10min的离心条件洗脱；然后将获得的沉淀按质量体积比加入四倍的0.1mol/L的KCl溶液中，匀浆后用2000×g、至少10min的离心条件再次洗脱，获得肌原纤维蛋白；(3)糖基化处理：将获得的肌原纤维蛋白溶于0.6mol/L的KCl和20mmol/L的磷酸盐构成的混合溶液中，并调节肌原纤维蛋白浓度为2mg/ml～6mg/ml，再加入肌原纤维蛋白质量6倍的氨基葡萄糖，在20℃～45℃的环境下反应12h；(4)除糖处理：将反应结束的溶液加入5倍体积的冷蒸馏水，然后用2000×g、至少10min的离心条件洗脱；将洗脱获得的沉淀按质量体积比加入四倍的0.1mol/L的KCl溶液中，再用2000×g、至少10min的离心条件洗脱；再将洗脱后获得的沉淀溶于0.6mol/L的KCl和20mmol/L的磷酸盐构成的混合溶液中，并调节肌原纤维蛋白浓度为20mg/ml～40mg/ml；(5)凝胶制备：将除糖后的肌原纤维蛋白溶液从25℃升到80℃后保温至少20min，即制成蛋白凝胶。"
					}
				],
				"seeAlso": []
			}
		]
	},
	{
		"type": "web",
		"url": "http://www.soopat.com/Patent/201510870162?lx=FMSQ",
		"items": [
			{
				"itemType": "patent",
				"title": "捕猎器",
				"creators": [
					{
						"firstName": "丹",
						"lastName": "李"
					}
				],
				"abstractNote": "摘要：一种捕猎器，包括驱赶通道和储物仓，驱赶通道与储物仓之间设置有隔离门，隔离门以平动或转动的方式设置在驱赶通道和储物仓之间，隔离门的平动或转动均位于驱赶通道和储物仓的分割面所在的平面或曲面内。该捕猎器能够使得隔离门可靠关闭，避免猎物返回到驱赶通道中。",
				"applicationNumber": "201510870162.5",
				"filingDate": "2015-12-01",
				"legalStatus": "有权,权利转移",
				"place": "深圳市丹明科技有限公司",
				"url": "http://www.soopat.com/Patent/201510870162?lx=FMSQ",
				"attachments": [],
				"tags": [],
				"notes": [
					{
						"note": " 1.一种捕猎器，包括驱赶通道和储物仓，其特征在于：所述驱赶通道与所述储物仓之间设置有隔离门，所述隔离门以平动或转动的方式设置在所述驱赶通道和所述储物仓之间，所述隔离门的平动或转动均位于所述驱赶通道和所述储物仓的分割面所在的平面或曲面内；所述驱赶通道内设置有驱赶板，在所述驱赶板运动到隔离门正下方后使隔离门回位。"
					}
				],
				"seeAlso": []
			}
		]
	}
]
/** END TEST CASES **/
