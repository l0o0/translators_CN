{
	"translatorID": "8276f7cf-bc43-45b5-9409-8ba2af369c60",
	"label": "PatentStar",
	"creator": "Yizhao Wan",
	"target": "^https?://cprs.patentstar.com.cn",
	"minVersion": "3.0",
	"maxVersion": "",
	"priority": 100,
	"inRepository": true,
	"translatorType": 4,
	"browserSupport": "gc",
	"lastUpdated": "2020-12-22 13:40:44"
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
	else if(url.includes('/ResultList?')){
		return 'multiple';
	}
	return false;
}

function getSearchResults(doc, checkOnly) {
	
	
	var mainDomain="http://cprs.patentstar.com.cn";
	var items = {};
	var found = false;
	var rows = ZU.xpath(doc, "//label[@class='title-color']");
	Z.debug(rows.length);
	if (checkOnly) {
		
		return rows.length ? 'multiple' : false;
	}
	for (let i=0; i < rows.length; i++) {
		//Z.debug(rows[0]);
		let title = rows[i].getAttribute('title');
		let ane = rows[i].getAttribute('data-ane');
		Z.debug(title);
		//let click = title.;
		//Z.debug(click);
		
		//Z.debug(href);
		let href = mainDomain+"/Search/Detail?ANE="+ane;
		Z.debug(href);
		//title = ZU.trimInternal(title.textContent);
		if (!href || !title) continue;
		found = true;
		items[href] = (i+1) + " " + title;
		//Z.debug(items[href]);
	}
	return found ? items : false;
}


function doWeb(doc, url) {
	
	if (detectWeb(doc, url) == "multiple") {
		Zotero.selectItems(getSearchResults(doc, false), function (items) {
			if (items) {
					processURL(Object.keys(items));
				}
		});
	}
	else {
		scrape(doc, url);
	}//*[@id="summary"]/div/span
}

function processURL(urls) {
	Z.debug(urls);
	var url = urls.pop();
	//Z.debug(url);
	//ZU.doGet(url, function(text) {
	ZU.processDocuments(url,function(doc){
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

function scrape(doc,url){
	

	//var itemURL="http://cprs.patentstar.com.cn/Download/DownloadExcel?ANE=";
	var newItem=new Zotero.Item('patent');
	
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
	
	var dataUrl="http://cprs.patentstar.com.cn/"+"Search/GetPatentByIDE"
	var ANE=url.split('=')[1];
	var postData="IDE="+ANE;
	ZU.doPost(dataUrl,postData,function(text){
		//Z.debug(text);
		try{
			var  data=JSON.parse(text);
			if (data.Ret == 200){
				//Z.debug(JSON.stringify(data.Data['Patent']));
				Z.debug(data.Data['Patent']);
				var patent=data.Data['Patent'];
				newItem.title=ZU.trimInternal(patent['TI']);
				
				var inventors=patent['IN'];
				//Z.debug(inventors)
				if (inventors.search(/[A-Za-z]/) !== -1) {
					inventors = inventors.split(/;/)
					inventors=inventors.filter((ele) => !ele.match(/^[ ]*$/));//
				} 
				else {
					inventors = inventors.split(/[\s ;]+/);  // Special comma
					inventors=inventors.filter((ele) => !ele.match(/^[ ]*$/));
					//inventors.push(patent['AT']);
					//Z.debug(inventors);
				}
				newItem.creators = handleName(inventors);
				
				newItem.applicationNumber=ZU.trimInternal(patent['AN']);
				
				newItem.assignee=ZU.trimInternal(patent['PA']);
				
				newItem.filingDate=(ZU.trimInternal(patent['AD'])).replace(/(.{4})(.{2})/,"$1-$2-");
		
				newItem.place=ZU.trimInternal(patent['CO']);
				
				newItem.country="中国";
				
				legStatus={
					1:"有效",
					2:"失效",
					3:"审中"
				}
				newItem.legalStatus=legStatus[patent['LG']];
				
				if(patent['LG']!=2){
					newItem.patentNumber=patent['AN'];
				}
				
				if(patent['LG']==3){
					newItem.issueDate=patent['AD'].substr(0,4);
				}
				else{
					newItem.issueDate=ZU.trimInternal(patent['GD']).replace(/(.{4})(.{2})/,"$1-$2-");
				}
				
				newItem.abstractNote=ZU.trimInternal(patent['AB'])
				
				newItem.rights=ZU.trimInternal(patent['CL']);
				
				type={
					1:"发明专利",
					2:"实用新型专利",
					3:"外观专利"
				}
				newItem.extra=type[patent['PT']];
				
				
				
				/***************************************************************************/
				//pdf附件的获取不变
				if (detectLogin(doc,url)){
					var pdfGetUrl="http://cprs.patentstar.com.cn/"+"WebService/GetPDFUrl";
					var ANE=url.split('=')[1];
	
					var postData="ANE="+ANE;
	
					ZU.doPost(pdfGetUrl, postData,
						function (text) {
							//Z.debug(text);
							try{
								var  data=JSON.parse(text);
								//Z.debug(data.Ret);
								if(data.Ret==200){
									var pdfurl = data.Data[0];
									newItem.attachments.push({
										title: "Full Text PDF",
										mimeType: "application/pdf",
										url: pdfurl
									});
										
									newItem.url = url;
									newItem.complete();
								}
								else{
									Z.debug("获取pdf地址失败");
								}
							}
							catch(err){
								Z.debug("获取pdf地址出错");
								newItem.url = url;
								newItem.complete();
							}
					})
				}
			}
		}
		catch{
			Z.debug("获取信息失败");
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
			creator.lastName = author.slice(lastSpace+1);
			
		} else {
			// Chinese
			if (authors.indexOf(author) > -1) {
				
				//if (author.endsWith("等") || author.endsWith("著")) {
				//	author = author.slice(0, author.length -1);
				//作者姓名可能以"等"、"等编"、"编著"、"主编"、"著"这几种形式结尾
				if (author.indexOf("等") !==-1) {
					author=author.slice(0,author.indexOf("等"));
					//Z.debug(author);
					// 去除等或著后与其他姓名重名，跳过
					if (authors.indexOf(author) > -1) {
						continue;
					}
				}
				else if(author.indexOf("主") !==-1){
					author=author.slice(0,author.indexOf("主"));
					if (authors.indexOf(author) > -1) {
						continue;
					}
				}
				else if(author.indexOf("编") !==-1){
					author=author.slice(0,author.indexOf("编"));
					if (authors.indexOf(author) > -1) {
						continue;
					}
				}
				else if(author.indexOf("著") !==-1){
					author=author.slice(0,author.indexOf("著"));
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

function detectLogin(doc,url){
	var username=ZU.xpath(doc,"//div[@class='username-box f1']");
	if(!username){
		Z.debug("未登陆，无法获取pdf");
		return false;
	}
	else
		return true;
}
