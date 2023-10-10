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
	"lastUpdated": "2023-10-10 08:43:04"
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
	//else if (getSearchResults(doc,true)) {
	else if (url.includes('List')) {
		return 'multiple';
	}
	return false;
}

function getSearchResults(doc, checkOnly) {


	var mainDomain = "https://cprs.patentstar.com.cn";
	var items = {};
	var found = false;
	var rows = ZU.xpath(doc, "//label[@class='title-color']");
	Z.debug(rows.length);
	if (checkOnly) {

		return rows.length ? 'multiple' : false;
	}
	for (let i = 0; i < rows.length; i++) {
		//Z.debug(rows[0]);
		let title = rows[i].getAttribute('title');
		let ane = rows[i].getAttribute('data-ane');
		Z.debug(title);
		//let click = title.;
		//Z.debug(click);
		//Z.debug(href);
		let href = mainDomain + "/Search/Detail?ANE=" + ane;
		Z.debug(href);
		//title = ZU.trimInternal(title.textContent);
		if (!href || !title) continue;
		found = true;
		items[href] = (i + 1) + " " + title;
		//Z.debug(items[href]);
	}
	return found ? items : false;
}


async function doWeb(doc, url) {

	if (detectWeb(doc, url) == "multiple") {
		Zotero.selectItems(getSearchResults(doc, false), function (items) {
			if (items) {
				processURL(Object.keys(items));
			}
		});
	}
	else {
		await scrape(doc, url);
	}//*[@id="summary"]/div/span
}

function processURL(urls) {
	Z.debug(urls);
	var url = urls.pop();
	//Z.debug(url);
	//ZU.doGet(url, function(text) {
	ZU.processDocuments(url, function (doc) {
		//Z.debug(text);
		//var parser = new DOMParser();
		//var doc = parser.parseFromString(text, "text/html");
		//Z.debug(doc.URL);
		scrape(doc, url);
		if (urls.length) {
			processURL(urls);
		}
	})
}

async function scrape(doc, url) {


	//var itemURL="http://cprs.patentstar.com.cn/Download/DownloadExcel?ANE=";
	var newItem = new Zotero.Item('patent');

	/**************************************************************************/
	//直接从加载完成后的页面中提取文献信息

	/*var title=ZU.xpath(doc,"//label[@class='title-color']")[0].getAttribute('title');
	Z.debug(title);
	if(title.length){
		newItem.title=ZU.trimInternal(title);
	}
	
	var details = ZU.xpath(doc, "//div[@class='item-content fl']")[0].innerText;
	//Z.debug(details);
	details=details.split('\n');
	details=details.filter((ele) => !ele.match(/^[ ]*$/));
	Z.debug(details);
	
	var applNo=details.filter((ele) => ele.startsWith("申请号"));
	//Z.debug(applNo);
	if(applNo.length){
		applNo=place=details[details.indexOf(applNo[0])+1];
		newItem.applicationNumber=applNo;
	}
	
	var assignee=details.filter((ele) => ele.startsWith("代理人"));
	//Z.debug(assignee);
	if(assignee.length){
		assignee=place=details[details.indexOf(assignee[0])+1];
		newItem.assignee=assignee;
	}
	
	var attorneyAgent=details.filter((ele) => ele.startsWith("代理机构"));
	//Z.debug(attorneyAgent);
	if(attorneyAgent.length){
		attorneyAgent=place=details[details.indexOf(attorneyAgent[0])+1];
		newItem.attorneyAgent=attorneyAgent;
	}
	
	var filingDate=details.filter((ele) => ele.startsWith("申请日"));
	//Z.debug(filingDate);
	if(filingDate.length){
		filingDate=place=details[details.indexOf(filingDate[0])+1];
		newItem.filingDate=filingDate;
	}
	
	var inventors=details.filter((ele) => ele.startsWith("发明人"));
	
	if(inventors.length){
		inventors=details[details.indexOf(inventors[0])+1];
		Z.debug(inventors)
		if (inventors.search(/[A-Za-z]/) !== -1) {
			inventors = inventors.split(/;/)
			inventors=inventors.filter((ele) => !ele.match(/^[ ]*$/));//
		} else {
			inventors = inventors.split(/[\s ;]+/);  // Special comma
			inventors=inventors.filter((ele) => !ele.match(/^[ ]*$/));
			Z.debug(inventors);
		}
		newItem.creators = handleName(inventors);
		
	}
	
	var issueDate=details.filter((ele) => ele.startsWith("授权公告日"));
	if(issueDate.length){
		issueDate=details[details.indexOf(issueDate[0])+1];
		newItem.issueDate=issueDate;
	}
	
	var legalStatus=details.filter((ele) => ele.startsWith("当前状态"));
	if(legalStatus.length){
		legalStatus=details[details.indexOf(legalStatus[0])+1];
		newItem.legalStatus=legalStatus;
	}
	
	var absNote=ZU.xpath(doc,"//div[@class='item-summary']/p/span")[0].innerText;
	if(absNote.length){
		newItem.abstractNote=ZU.trimInternal(absNote);
	}
	
	var rights=ZU.xpath(doc,"//div[@class='item-summary']/p[2]/span")[0].innerText;
	//Z.debug(rights);
	if(rights.length){
		newItem.rights=ZU.trimInternal(rights);
	}*/

	/***************************************************************************/
	//发现新的接口，可以直接提取信息

	var dataUrl = "https://cprs.patentstar.com.cn/" + "Search/GetPatentByIDE"
	var ANE = url.split('=')[1];
	var postData = "IDE=" + ANE;
	ZU.doPost(dataUrl, postData, function (text) {
		//Z.debug(text);
		try {
			var data = JSON.parse(text);
			if (data.Ret == 200) {
				//Z.debug(JSON.stringify(data.Data['Patent']));
				//Z.debug(data.Data['Patent']);
				var patent = data.Data['Patent'];
				newItem.title = ZU.trimInternal(patent['TI']);

				var inventors = patent['IN'];
				//Z.debug(inventors)
				if (inventors.search(/[A-Za-z]/) !== -1) {
					inventors = inventors.split(/;/)
					inventors = inventors.filter((ele) => !ele.match(/^[ ]*$/));//
				}
				else {
					inventors = inventors.split(/[\s ;]+/);  // Special comma
					inventors = inventors.filter((ele) => !ele.match(/^[ ]*$/));
					//inventors.push(patent['AT']);
					//Z.debug(inventors);
				}
				newItem.creators = handleName(inventors);

				newItem.applicationNumber = ZU.trimInternal(patent['AN']);

				newItem.assignee = ZU.trimInternal(patent['PA']);

				newItem.filingDate = (ZU.trimInternal(patent['AD'])).replace(/(.{4})(.{2})/, "$1-$2-");

				newItem.place = ZU.trimInternal(patent['CO']);

				newItem.country = "中国";

				legStatus = {
					1: "有效",
					2: "失效",
					3: "审中"
				}
				newItem.legalStatus = legStatus[patent['LG']];

				if (patent['LG'] != 2) {
					newItem.patentNumber = patent['AN'];
				}

				if (patent['LG'] == 3) {
					newItem.issueDate = patent['AD'].substr(0, 4);
				}
				else {
					newItem.issueDate = ZU.trimInternal(patent['GD']).replace(/(.{4})(.{2})/, "$1-$2-");
				}

				newItem.abstractNote = ZU.trimInternal(patent['AB'])

				newItem.rights = ZU.trimInternal(patent['CL']);

				type = {
					1: "发明专利",
					2: "实用新型专利",
					3: "外观专利"
				}
				newItem.extra = type[patent['PT']];



				/***************************************************************************/
				// 使用api获取pdf,该api返回的Data数据中包含可能包含两个pdf文件的网址
				// 如果有两个网址，则第一个为申请文件，第二个为授权文件
				// 故存在两个网址时，则取第二个作为附件保存
				// 注：以下代码在Scaffold调试时可能失败，但在浏览器是成功的
				if (detectLogin(doc, url)) {
					var pdfGetUrl = "https://cprs.patentstar.com.cn/" + "WebService/GetPDFUrl";
					var ANE = url.split('=')[1];

					var postData = "ANE=" + ANE;

					ZU.doPost(pdfGetUrl, postData,
						function (text) {
							//Z.debug(text);
							try {
								var data = JSON.parse(text);
								Z.debug(data);
								var pdfurl = '';
								if (data.Ret == 200) {
									if (data.Data.length > 1) {
										pdfurl = data.Data[1];
									}
									else {
										pdfurl = data.Data[0];
									}

									newItem.attachments.push({
										title: "Full Text PDF",
										mimeType: "application/pdf",
										url: pdfurl
									});

									newItem.url = url;
									newItem.complete();
								}
								else {
									Z.debug("获取pdf地址失败");
								}
							}
							catch (err) {
								Z.debug(err);
								Z.debug("获取pdf地址出错");
								newItem.url = url;
								newItem.complete();
							}
						}
					)
				}
			}
		}
		catch {
			Z.debug("发生异常，获取信息失败");
		}

	})
}


function handleName(authors) {
	// 有英文
	var creators = [];
	for (let author of authors) {
		var creator = {};
		var lastSpace = author.lastIndexOf(' ');
		if (author.search(/[A-Za-z]/) !== -1 && lastSpace !== -1) {
			// English
			creator.firstName = author.slice(0, lastSpace);
			creator.lastName = author.slice(lastSpace + 1);

		} else {
			// Chinese
			if (authors.indexOf(author) > -1) {

				//if (author.endsWith("等") || author.endsWith("著")) {
				//	author = author.slice(0, author.length -1);
				//作者姓名可能以"等"、"等编"、"编著"、"主编"、"著"这几种形式结尾
				if (author.indexOf("等") !== -1) {
					author = author.slice(0, author.indexOf("等"));
					//Z.debug(author);
					// 去除等或著后与其他姓名重名，跳过
					if (authors.indexOf(author) > -1) {
						continue;
					}
				}
				else if (author.indexOf("主") !== -1) {
					author = author.slice(0, author.indexOf("主"));
					if (authors.indexOf(author) > -1) {
						continue;
					}
				}
				else if (author.indexOf("编") !== -1) {
					author = author.slice(0, author.indexOf("编"));
					if (authors.indexOf(author) > -1) {
						continue;
					}
				}
				else if (author.indexOf("著") !== -1) {
					author = author.slice(0, author.indexOf("著"));
					if (authors.indexOf(author) > -1) {
						continue;
					}
				}



			}
			//Z.debug(author);
			creator.firstName = author.slice(1);
			creator.lastName = author.charAt(0);
			if (author.endsWith("指导")) {
				creator.creatorType = "contributor";
			}
		}
		creators.push(creator);
	}
	return creators;
}

function detectLogin(doc, url) {
	var username = ZU.xpath(doc, "//div[@class='username-box f1']");
	if (!username) {
		Z.debug("未登陆，无法获取pdf");
		return false;
	}
	else
		return true;
}

/** BEGIN TEST CASES **/
var testCases = [
	{
		"type": "web",
		"url": "https://cprs.patentstar.com.cn/Search/ResultList?CurrentQuery=6auY5rip6Zmk5bCYL1lZ&type=cn",
		"items": "multiple"
	},
	{
		"type": "web",
		"url": "https://cprs.patentstar.com.cn/Search/Detail?ANE=8AGA9FGC5BCA9HGH8CFA6GAA9EBF9FHFAIHA9CBB6EBA9FDC",
		"items": [
			{
				"itemType": "patent",
				"title": "一种复合型耐高温除尘滤料及其制造方法",
				"creators": [
					{
						"firstName": "文镇",
						"lastName": "翟"
					},
					{
						"firstName": "丽萍",
						"lastName": "庄"
					},
					{
						"firstName": "连东",
						"lastName": "高"
					},
					{
						"firstName": "言财",
						"lastName": "申"
					},
					{
						"firstName": "加富",
						"lastName": "梁"
					}
				],
				"issueDate": "2023",
				"abstractNote": "本发明涉及过滤材料领域，公开了一种复合型耐高温除尘滤料及其制造方法，复合型耐高温除尘滤料包括多层基布层，相邻基布层之间纤维层，位于外侧的基布层均涂覆有耐高温涂层，一耐高温涂层外侧涂覆有耐腐蚀层，耐腐蚀层上涂覆有防护层，本发明提出的复合型耐高温除尘滤料，能够实现在高温环境下进行除尘过滤处理，耐高温效果好，具有耐腐蚀能力，同时配合气冲过滤的方式，不会导致纤维材料脱落，纤维材料附着能力强，满足了现在的使用要求。",
				"applicationNumber": "CN202310922713.2",
				"assignee": "山东海汇环保设备有限公司",
				"country": "中国",
				"extra": "发明专利",
				"filingDate": "2023-07-26",
				"legalStatus": "审中",
				"patentNumber": "CN202310922713.2",
				"place": "37(山东)",
				"rights": "1.一种复合型耐高温除尘滤料，其特征在于，包括多层基布层(100)，相邻基布层(100)之间纤维层(200)，位于外侧的基布层(100)均涂覆有耐高温涂层(300)，一耐高温涂层(300)外侧涂覆有耐腐蚀层(400)，耐腐蚀层(400)上涂覆有防护层(500)。",
				"url": "https://cprs.patentstar.com.cn/Search/Detail?ANE=8AGA9FGC5BCA9HGH8CFA6GAA9EBF9FHFAIHA9CBB6EBA9FDC",
				"attachments": [],
				"tags": [],
				"notes": [],
				"seeAlso": []
			}
		]
	}
]
/** END TEST CASES **/
