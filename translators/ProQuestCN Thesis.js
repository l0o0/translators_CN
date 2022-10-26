{
	"translatorID": "c90ad4a0-fe8a-4697-b345-ae5d3714d1fd",
	"label": "ProQuest学位论文(中国)",
	"creator": "Yizhao Wan",
	"target": "^https?://www.pqdtcn.com/",
	"minVersion": "3.0",
	"maxVersion": "",
	"priority": 100,
	"inRepository": true,
	"translatorType": 4,
	"browserSupport": "gcsbv",
	"lastUpdated": "2020-09-07 01:24:40"
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
	if (url.includes('/thesisDetails/')) {
		
		return 'thesis';
	}
	else if (getSearchResults(doc,true)) {
		return 'multiple';
	}
	return false;
}

function getSearchResults(doc, checkOnly) {
	var items = {};
	var found = false;
	var rows = ZU.xpath(doc, "//div[@id='basic_search']/table[@class='table']");
	if (checkOnly) {
		
		return rows.length ? 'multiple' : false;
	}
	for (let i=0; i < rows.length; i++) {
		//Z.debug(rows[0]);
		let title = ZU.xpath(rows[i], ".//td[@colspan='3']/a")[0];
		//Z.debug(title.innerText);
		//let click = title.;
		//Z.debug(click);
		let href = title.getAttribute('href');
		href = "http://www.pqdtcn.com/"+href;
		//Z.debug(href);
		title = ZU.trimInternal(title.textContent);
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
	//Z.debug(urls);
	var url = urls.pop();
	//Z.debug(url);
	//ZU.doGet(url, function(text) {
	ZU.processDocuments(url,function(doc){
		//Z.debug(text);
		//var parser = new DOMParser();
		//var doc = parser.parseFromString(text, "text/html");
		//Z.debug(doc);
		scrape(doc, url);
		if (urls.length) {
			processURL(urls);
		}
	})
}
function scrape(doc,url){
	var newItem=new Zotero.Item('thesis');
	
	var note=ZU.xpath(doc,"//div[@id='summary']/div/span");
	if(note.length){
		newItem.abstractNote=ZU.trimInternal(note[0].innerText);
	}
	var index=ZU.xpath(doc,"//div[@style='margin-top: 9px;']");
	
	//将所有的信息合并在一起后根据关键词找到对应的信息
	//但是如果某一个关键词是空的话，整个列表的结构会乱
	/*if(index.length){
		index=index[0].innerText.split("\n");
		//index=index.filter((ele) => !ele.match(/^[\t]*$/));
		Z.debug(index);
		
		var title=index.filter((ele) => ele.startsWith("标题"));
		if(title.length){
			//Z.debug(title);
			title=index[index.indexOf(title[0])+1];
			newItem.title=ZU.trimInternal(title);
		}
		var authors=index.filter((ele) => ele.startsWith("作者"));
		if(authors.length){
			//Z.debug(authors);
			var creators=[];
			authors=index[index.indexOf(authors[0])+1];
			authors=new Array(authors);
			authors = handleName(authors,false);
			//Z.debug(authors);
		}
		var supervisor=index.filter((ele) => ele.startsWith("导师"));
		if(supervisor.length){
			supervisor=index[index.indexOf(supervisor[0])+1];
			//导师可能有多个,具体以什么符号分割还未核实
			supervisor=supervisor.split(";");
			//Z.debug(supervisor);
			supervisor=handleName(supervisor,true);
			//Z.debug(supervisor);
		}
		if(supervisor.length && authors.length){
			newItem.creators=authors.concat(supervisor);
		}
		
		var language=index.filter((ele) => ele.startsWith("语言"));
		if(language.length){
			language=index[index.indexOf(language[0])+1];
			newItem.language=ZU.trimInternal(language);
		}
		var university=index.filter((ele) => ele.startsWith("大学/机构"));
		if(university.length){
			university=index[index.indexOf(university[0])+1];
			newItem.university=ZU.trimInternal(university);
		}
		var ISBN=index.filter((ele) => ele.startsWith("ISBN"));
		if(ISBN.length){
			ISBN=index[index.indexOf(ISBN[0])+1];
			newItem.ISBN=ZU.trimInternal(ISBN);
		}
		var pages=index.filter((ele) => ele.startsWith("页数"));
		if(pages.length){
			pages=index[index.indexOf(pages[0])+1];
			newItem.numPages=ZU.trimInternal(pages);
		}
		
		var date=index.filter((ele) => ele.startsWith("出版日期"));
		if(date.length){
			date=getNextItem(index,date[0]);
			newItem.date=ZU.trimInternal(date);
		}
		var type=index.filter((ele) => ele.startsWith("学位"));
		if(type.length){
			type=getNextItem(index,type[0]);
			newItem.thesisType=ZU.trimInternal(type);
		}
		var place=index.filter((ele) => ele.startsWith("出版国家"));
		if(place.length){
			place=getNextItem(index,place[0]);
			newItem.place=ZU.trimInternal(place);
		}
		
	}*/
	
	//分析发现，论文的关键词信息是固定的，可以直接通过索引号来实现对应信息的提取
	//Z.debug(index);
	//Z.debug(index[0].children);
	if(index.length){
		var title=index[0].children[1].innerText.split(":")[1];
		if(title.length){
			newItem.title=ZU.trimInternal(title);
		}
		
		var authors=index[0].children[2].innerText.split(":")[1];
		//Z.debug(authors);
		if(authors.length){
			//Z.debug(authors);
			authors=new Array(ZU.trimInternal(authors));
			authors = handleName(authors,false);
			//Z.debug(authors);
		}
		var supervisor=index[0].children[11].innerText.split(":")[1];
		if(supervisor.length){
			
			//导师可能有多个,具体以什么符号分割还未核实
			supervisor=ZU.trimInternal(supervisor).split(";");
			//Z.debug(supervisor);
			supervisor=handleName(supervisor,true);
			//Z.debug(supervisor);
		}
		if(supervisor.length || authors.length){
			newItem.creators=authors.concat(supervisor);
		}
		
		var pages=index[0].children[3].innerText.split(":")[1];
		if(pages.length){
			newItem.numPages=ZU.trimInternal(pages);
		}
		
		var date=index[0].children[4].innerText.split(":")[1];
		if(date.length){
			newItem.date=ZU.trimInternal(date);
		}
		
		var university=index[0].children[6].innerText.split(":")[1];
		if(university.length){
			newItem.university=ZU.trimInternal(university);
		}
		
		var place=index[0].children[9].innerText.split(":")[1];
		if(place.length){
			newItem.place=ZU.trimInternal(place);
		}
		
		var ISBN=index[0].children[10].innerText.split(":")[1];
		if(ISBN.length){
			newItem.ISBN=ZU.trimInternal(ISBN);
		}
		
		var type=index[0].children[13].innerText.split(":")[1];
		if(type.length){
			newItem.thesisType=ZU.trimInternal(type);
		}
		
		var language=index[0].children[14].innerText.split(":")[1];
		if(language.length){
			newItem.language=ZU.trimInternal(language);
		}
		
		
		var webType = detectWeb(doc, url);
		if (webType && webType != 'multiple') {
			var domain="http://www.pqdtcn.com/";
			//var domain="http://2253809.rm.cglhub.com/"
			ZU.doGet(domain+"thesis/downloadControl",function(text){
				Z.debug(domain+"thesis/downloadControl");	
				Z.debug(text);
				//succ=text.split(",")[0].split(":")[1];
		
				//Z.debug(succ);
				if(!text.length){
					newItem.url = url;
					newItem.complete();
					return;
				}
				var data=JSON.parse(text);
				
				//accesToken=text.split(",")[1].split(":")[1];
				//accesToken=accesToken.slice(1,accesToken.length-2);
				accesToken=data.accessToken;
				
				var code=(ZU.xpath(doc,"//input[@id='thesisEncryptCode']"))[0].getAttribute("value");
				var sites = ZU.xpath(doc,"//li[@role='presentation']");
				//获取可供下载pdf的服务器编号
				var remoteSites=[];
				if(sites.length){
				for (let site of sites){
					//Z.debug(site.innerText);
					remoteSites.push(site.getElementsByTagName("a")[0].getAttribute("value"));
					}
				}
				if(!remoteSites.length){
					newItem.url = url;
					newItem.complete();
					return;
				}
				Z.debug(remoteSites);
				var pdfurl=domain+"thesis/download/"+remoteSites[Math.floor(Math.random()*remoteSites.length)]+"/"+code+"?accessToken="+accesToken;
				//Z.debug(pdfurl);
		
				var attachments = [];
				Z.debug(pdfurl);
				if (pdfurl) {
					newItem.attachments.push({
						title: "Full Text PDF",
						mimeType: "application/pdf",
						url: pdfurl
					});
				}
				newItem.url = url;
				newItem.complete();
			})
		}
	}
	
}
function getNextItem(index,item){
	return index[index.indexOf(item)+1];
}
function handleName(authors,isContri){
	var creators=[];
	for (let author of authors) {
		
		var creator = {};
		var lastSpace = author.lastIndexOf(',');
		if (author.search(/[A-Za-z]/) !== -1 && lastSpace !== -1) {
			// English
			creator.lastName = author.slice(0, lastSpace);
			creator.firstName = author.slice(lastSpace+1);
		}
		if(isContri){
			creator.creatorType = "contributor";
		}
	}
	creators.push(creator);
	//Z.debug(creators);
	return creators;
}
