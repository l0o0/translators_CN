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
	"lastUpdated": "2019-12-18 07:05:01"
}

function detectWeb(doc, url) {
	var items = getSearchItems(doc);
	// Z.debug(items);
	if (items && url.indexOf("Patent") == -1) {
		return "multiple";
	} else if (url.indexOf("Patent") != -1) {
		return "Patent";
	}
}
function scrape(doc, url, loginStatus) {
	var newItem = new Zotero.Item("patent");
	var detailtitle = ZU.xpath(doc, "//span[@class='detailtitle']")[0];
	var title = ZU.xpath(detailtitle, "./h1")[0];
	title = title.innerText.split(/\s/)[0];
	var appNo = ZU.xpath(detailtitle, "./strong")[0].innerText.split(/[：\s]/);
	var appDate = appNo[3];
	var appNo = appNo[1];
	var ab = ZU.xpath(doc, "//b[contains(text(), '摘要：')]/parent::td")[0].innerText;
	var inventor = ZU.xpath(doc, "//b[contains(text(), '发明(设计)人：')]/parent::td")[0].innerText;
	Z.debug(title + appDate + appNo);
	newItem['title'] = title;
	newItem['Abstract'] = ab;
	newItem['Application Number'] = appNo;
	newItem['Filing Date'] = appDate;
	newItem['attorneyAgent'] = ZU.xpath(doc, "//tr[td='专利代理机构']/td[2]")[0].innerText;
	newItem['assignee'] = ZU.xpath(doc, "//tr[td='代理人']/td[2]")[0].innerText;
	var legalStatusNodes = ZU.xpath(detailtitle, "./h1/div");
	var legalStatus = "";
	for (var n of legalStatusNodes) {
		legalStatus += "," + n.innerText;
	}
	legalStatus ? newItem['legalStatus'] = legalStatus : false;
	var note = ZU.xpath(doc, "//tr[td='主权项']/td[2]")[0].innerText;
	if (note) {
		newItem['notes'] = [{note:note}];
	}
	var inventors = ZU.xpath(doc, "//table[@class='datainfo']//tr[6]/td/a");
	newItem.creators = [];
	for (var inventor of inventors) {
		inventor = inventor.innerText;
		var creator = {};
		var lastSpace = inventor.lastIndexOf(' ');
		if (inventor.search(/[A-Za-z]/) !== -1 && lastSpace !== -1) {
			// western name. split on last space
			creator.firstName = inventor.substr(0,lastSpace);
			creator.lastName = inventor.substr(lastSpace + 1);
		} else {
			// Chinese name. first character is last name, the rest are first name
			creator.firstName = inventor.substr(1);
			creator.lastName = inventor.charAt(0);
		}
		newItem.creators.push(creator);
	}
	newItem['Contributor'] = ZU.xpath(doc, "//b[contains(text(), '申请人：')]/parent::td/a")[0].innerText;
	var downlink = ZU.xpath(doc, "//div[@class='mix']/a[2]")[0].getAttribute('onclick').split("'")[1];
	// Z.debug(downlink);
	
	if (loginStatus) {
		getPDF(downlink, newItem);
	} else {
		newItem.complete();
	}
}

function doWeb(doc, url) {
	var loginStatus = detectLogin(doc);
	if (detectWeb(doc, url) == "multiple") {
		var itemInfos = {}
		var items = getSearchItems(doc, itemInfos);
		Z.selectItems(items, function(selectedItems) {
			if (!selectedItems) return true;
			// Z.debug(Object.keys(selectedItems));
			var urls = Object.keys(selectedItems);
			getItemsFromSearch(urls, itemInfos, loginStatus);
		});
	} else {
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
		var headers = patentType[0].innerText.split(/\s/);
		var title = headers[1];
		var NO = headers[3];
		var url = patentType[0].getElementsByTagName('a')[0].href;
		items[url] = patentType[0].innerText;
		if (itemInfos) {
			itemInfos[url] = patent;
		}
	}
	return items;
}


function detectLogin(doc) {
	var loginHeader = ZU.xpath(doc, "//div[@class='login']")[0];
	var counts = (loginHeader.innerText.match(/登录/g) || []).length;
	if (counts == 2) {
		return false
	} else {
		return true
	}
}


function getPDF(downlink, newItem) {
	var pdfurl = ZU.doGet(downlink, function(text) {
		// Z.debug(text);
		var parser = new DOMParser();
		downHtml = parser.parseFromString(text, 'text/html');
		var link = ZU.xpath(downHtml, "//table/tbody/tr[3]/td[4]/a")[0];
		newItem['attachments'] = [{
			title: "Full Text PDF",
			mimeType: "application/pdf",
			url: link.href
		}];
		newItem.complete();
	})
}


function getItemsFromSearch(urls, itemInfos, loginStatus) {
	if (!urls.length) return;
	for (var url of urls) {
		var patent = itemInfos[url];
		// Z.debug(url);
		var newItem = new Zotero.Item("patent");
		newItem['url'] = url;
		var patentType = ZU.xpath(patent, ".//h2[@class='PatentTypeBlock']");
		var headers = patentType[0].innerText.split(/\s/);
		newItem['title'] = headers[1];
		newItem['Application Number'] = headers[3];
		newItem['Filing Date'] = ZU.xpath(patent, ".//span[@class='PatentAuthorBlock']")[0].innerText.split(/[\s：]/)[4];
		newItem['Abstract'] = ZU.xpath(patent, ".//span[@class='PatentContentBlock']")[0].innerText.replace('摘要:', '');
		newItem['Contributor'] = ZU.xpath(patent, ".//span[@class='PatentAuthorBlock']/a")[0].innerText;
		newItem['legalStatus'] = ZU.xpath(patent, ".//h2[@class='PatentTypeBlock']")[0].innerText.split(/\s/).slice(4, -1).join(',');
		var downlink = ZU.xpath(patent, ".//span[@class='PatentBottomBlock']/a[3]")[0].getAttribute('onclick').split("'")[1];
		if (loginStatus) {
			getPDF(downlink, newItem);
		} else {
			newItem.complete();
		}
	}
}
/** BEGIN TEST CASES **/
var testCases = [
	{
		"type": "web",
		"url": "http://www2.soopat.com/Patent/201510870162?lx=FMSQ",
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
				"legalStatus": ",有权,权利转移",
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
	},
	{
		"type": "web",
		"url": "http://www2.soopat.com/Home/Result?SearchWord=%E7%8C%8E",
		"items": "multiple"
	}
]
/** END TEST CASES **/
