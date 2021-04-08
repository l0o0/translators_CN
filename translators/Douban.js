{
	"translatorID": "fc353b26-8911-4c34-9196-f6f567c93901",
	"label": "Douban",
	"creator": "不是船长<tanguangzhi@foxmail.com>,Ace Strong<acestrong@gmail.com>",
	"target": "^https?://(www|book)\\.douban\\.com/(subject|doulist|people/[a-zA-Z._]*/(do|wish|collect)|.*?status=(do|wish|collect)|group/[0-9]*?/collection|tag)",
	"minVersion": "2.0rc1",
	"maxVersion": "",
	"priority": 100,
	"inRepository": true,
	"translatorType": 4,
	"browserSupport": "gcsibv",
	"lastUpdated": "2021-04-01 03:23:39"
}

/*
   Douban Translator
   Copyright (C) 2009-2010 TAO Cheng, acestrong@gmail.com

   This program is free software: you can redistribute it and/or modify
   it under the terms of the GNU General Public License as published by
   the Free Software Foundation, either version 3 of the License, or
   (at your option) any later version.

   This program is distributed in the hope that it will be useful,
   but WITHOUT ANY WARRANTY; without even the implied warranty of
   MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
   GNU General Public License for more details.

   You should have received a copy of the GNU General Public License
   along with this program.  If not, see <http://www.gnu.org/licenses/>.
*/

// #######################
// ##### Sample URLs #####
// #######################

/*
 * The starting point for an search is the URL below.
 * In testing, I tried the following:
 *
 *   - A search listing of books
 *   - A book page
 *   - A doulist page
 *   - A do page
 *   - A wish page
 *   - A collect page
 */
// http://book.douban.com/


function detectWeb(doc, url) {
	var pattern = /subject_search|doulist|people\/[a-zA-Z._]*?\/(?:do|wish|collect)|.*?status=(?:do|wish|collect)|group\/[0-9]*?\/collection|tag/;

	if (pattern.test(url)) {
		return "multiple";
	}
	else {
		return "book";
	}
}

function detectTitles(doc, url) {
	
	var pattern = /\.douban\.com\/tag\//;
	if (pattern.test(url)) {
		return ZU.xpath(doc, '//div[@class="info"]/h2/a');
	} else {
		return ZU.xpath(doc, '//div[@class="title"]/a');
	}
}

function doWeb(doc, url) {
	var articles = [];
	let r = /douban.com\/url\//;
	if (detectWeb(doc, url) == "multiple") {
		// also searches but they don't work as test cases in Scaffold
		// e.g. https://book.douban.com/subject_search?search_text=Murakami&cat=1001
		var items = {};
		// var titles = ZU.xpath(doc, '//div[@class="title"]/a');
		var titles = detectTitles(doc, url);
		var title;
		for (let i = 0; i < titles.length; i++) {
			title = titles[i];
			// Zotero.debug({ href: title.href, title: title.textContent });
			if (r.test(title.href)) { // Ignore links
				continue;
			}
			items[title.href] = title.textContent;
		}
		Zotero.selectItems(items, function (items) {
			if (!items) {
				return;
			}
			for (var i in items) {
				articles.push(i);
			}
			Zotero.Utilities.processDocuments(articles, scrapeAndParse);
		});
	}
	else {
		scrapeAndParse(doc, url);
	}
}




function trimTags(text) {
	return text.replace(/(<.*?>)/g, "");
}

// #############################
// ##### Scraper functions #####
// #############################

function scrapeAndParse(doc, url) {
	// Z.debug({ url })
	Zotero.Utilities.HTTP.doGet(url, function (page) {
		// Z.debug(page)
		var pattern;

		// 类型 & URL
		var itemType = "book";
		var newItem = new Zotero.Item(itemType);
		// Zotero.debug(itemType);
		newItem.url = url;

		// 评分
		let dbScore = ZU.xpathText(doc, '//*[@id="interest_sectl"]/div[1]/div[2]/strong')
		dbScore= dbScore.trim()
		if(dbScore==="  "||dbScore===""){
			dbScore = "?"
		}
		
		
		// 评价人数
		let commentNum = ZU.xpathText(doc, '//*[@id="interest_sectl"]/div[1]/div[2]/div/div[2]/span/a/span')
		newItem.place = commentNum+"人评分"
		
		// 副标题
		pattern = /<span [^>]*?>副标题:<\/span>(.*?)<br\/>/;
		if (pattern.test(page)) {
			var subTitle = pattern.exec(page)[1].trim()
		}
		
		// 原作名
		pattern = /<span [^>]*?>原作名:<\/span>(.*?)<br\/>/;
		if (pattern.test(page)) {
			var originalTitle = pattern.exec(page)[1].trim()
		}
		
		// 标题
		let titleTemp = ""
		pattern = /<h1>([\s\S]*?)<\/h1>/;
		if (pattern.test(page)) {
			var title = pattern.exec(page)[1];
			title = Zotero.Utilities.trim(trimTags(title))
			let originalTitlePre = " #"
			if(!originalTitle){ // 当没有原名时,使用空字符
				originalTitlePre = ""
			}
			if(title === subTitle){ // 判断下副标题与标题一样否,避免重复
				titleTemp = "《"+title+"》"+commentNum+" "+"评"+" "+dbScore+originalTitlePre+originalTitle
			} else {
				titleTemp = "《"+title+" - "+subTitle+"》"+commentNum+" "+"评"+" "+dbScore+originalTitlePre+originalTitle			
			}
			titleTemp = titleTemp.replace(/( - )?undefined/g,"").replace("null","0")
			newItem.title = titleTemp
		}
		
		
		// 短标题
			newItem.shortTitle = "《"+title+"》"


		// 目录
		let catalogueList = ZU.xpath(doc, "//div[@class='indent' and contains(@id, 'dir_') and contains(@id, 'full')]")
		let catalogue = ""
		if(catalogueList.length>0){
			catalogue = "<h1>#摘录-《"+title+"》目录</h1>\n"+catalogueList[0].innerHTML
			newItem.notes.push({note:catalogue})
		}
		

		// 作者
		page = page.replace(/\n/g, "");
		page = page.replace(/&nbsp;/g,"")
		// Z.debug(page)
		// 豆瓣里作者一栏及其不规范,这里使用多正则匹配更多情况,提高兼容性
		let regexp = new RegExp() // 这里要把类型定义为RegExp,否则下面赋值后test(page)会失败
		let regexp2 = new RegExp()
		let regexp3 = new RegExp()
		regexp = /<span>\s*<span[^>]*?>\s*作者<\/span>:(.*?)<\/span>/;
		regexp2 = /<span class="pl">作者:<\/span>\s*?<a href="https:\/\/book\.douban\.com\/author\/\d+\/">\s*?\S*?\s*?\S*?<\/a>\s*?<br>/
		regexp3 = /<span class="pl">作者:<\/span>\s*?<a href="https:\/\/book\.douban\.com\/author\/\d+\/">\s*?\S*?\s*?\S*?<\/a>\s+\//
		if (regexp2.test(page)) { 
			regexp = regexp2
		} else if(regexp3.test(page)){
			regexp = regexp3
		}
		
		if (regexp.test(page)) { 
			var authorNames = trimTags(regexp.exec(page)[0]);
			pattern = /(\[.*?\]|\(.*?\)|（.*?）)/g;
			authorNames = authorNames.replace(pattern, "").split("/");
			// 国家
			let country = RegExp.$1
			country = country.replace("美国","美")
			country = country.match(/[一-龥]+/g)
			if(country===null){
				country = [" "]
			}

			// Zotero.debug(authorNames);
			let firstNameList = [] // 作者名列表
			let lastNameList = [] // 作者姓列表
			for (let i = 0; i < authorNames.length; i++) {
				let useComma = true;
				pattern = /[A-Za-z]/;
				if (pattern.test(authorNames[i])) {
				// 外文名
					pattern = /,/;
					if (!pattern.test(authorNames[i])) {
						useComma = false;
					}
				}
				// 实现欧美作者姓与名分开展示
				let patt1 = new RegExp("·.+\.+")
				let authorNameTemp = ""
				let ming = ""
				let xing = ""
				
				authorNames[i] = authorNames[i].replace(/作者:?(&nbsp;)?\s+/g, "")
				if(authorNames[i].indexOf(".")!= -1){ // 名字中带.的   如:斯蒂芬·D.埃平格
					authorNameTemp = authorNames[i].trim().split(".")
					xing = authorNameTemp.pop() // 取数组最后一个值作为名
					ming = authorNameTemp.join("·") // 姓氏
				} else {
					authorNames[i] =authorNames[i].replace(/•/g,"·") // 替换中文•分隔符为英文·
					authorNameTemp = authorNames[i].trim().split("·")
					xing = authorNameTemp.pop()
					ming = authorNameTemp.join("·")
				}
				if(country[i]){
					country = country[i].replace(/<\/a>/g,"")
				}
			
				if(country!=" "){
					country = "["+country+"]"
				}
				
				firstNameList.push(country+ming)
				lastNameList.push(xing)
				
				newItem.creators.push({firstName:firstNameList[i],lastName:lastNameList[i], creatorType:"author", fieldMode:true});
				// newItem.creators.push(Zotero.Utilities.cleanAuthor(
				// 	Zotero.Utilities.trim(authorNames[i]),
				// 	"author", useComma));
			}
		}
		

		// 译者
		pattern = /<span>\s*<span [^>]*?>\s*译者<\/span>:(.*?)<\/span>/;
		if (pattern.test(page)) {
			var translatorNames = trimTags(pattern.exec(page)[1]);
			pattern = /(\[.*?\])/g;
			translatorNames = translatorNames.replace(pattern, "").split("/");
			//		Zotero.debug(translatorNames);
			for (let i = 0; i < translatorNames.length; i++) {
				let useComma = true;
				pattern = /[A-Za-z]/;
				if (pattern.test(translatorNames[i])) {
				// 外文名
					useComma = false;
				}
				newItem.creators.push(Zotero.Utilities.cleanAuthor(
					Zotero.Utilities.trim(translatorNames[i]),
					"translator", useComma));
			}
		}

		// ISBN
		pattern = /<span [^>]*?>ISBN:<\/span>(.*?)<br\/>/;
		if (pattern.test(page)) {
			var isbn = pattern.exec(page)[1];
			newItem.ISBN = Zotero.Utilities.trim(isbn);
			// Zotero.debug("isbn: "+isbn);
		}

		// 页数
		pattern = /<span [^>]*?>页数:<\/span>(.*?)<br\/>/;
		if (pattern.test(page)) {
			var numPages = pattern.exec(page)[1];
			newItem.numPages = Zotero.Utilities.trim(numPages);
			// Zotero.debug("numPages: "+numPages);
		}

		// 出版社
		pattern = /<span [^>]*?>出版社:<\/span>(.*?)<br\/>/;
		if (pattern.test(page)) {
			var publisher = pattern.exec(page)[1];
			newItem.publisher = Zotero.Utilities.trim(publisher);
			// Zotero.debug("publisher: "+publisher);
		}

		// 定价
		pattern = /<span [^>]*?>定价:(.*?)<\/span>(.*?)<br\/?>/;
		if (pattern.test(page)) {
			var price = pattern.exec(page)[2];
			// price = "60"
			let prefix = price.match(/^((?!(\d+\.?\d*)).)*/g)[0] // 正则匹配前缀,如USD,CAD
			price = price.match(/(\d+\.?\d*)/g)[0]
			
			// 小数点后2为保持
			let numPrice = Number(price) 
			numPrice = numPrice.toFixed(2)
			
			// 车同轨书同文,一统金额样式
			if(prefix===""||prefix===" "||prefix.includes("CNY")){
				price = numPrice+" 元"
			} else {
				price = prefix+numPrice
			}
			
			newItem.rights = Zotero.Utilities.trim(price);
		}
		
		// 丛书
		pattern = /<span [^>]*?>丛书:<\/span>(.*?)<br\/>/;
		if (pattern.test(page)) {
			var series = trimTags(pattern.exec(page)[1]);
			newItem.series = Zotero.Utilities.trim(series);
			// Zotero.debug("series: "+series);
		}

		// 出版年
		pattern = /<span [^>]*?>出版年:<\/span>(.*?)<br\/>/;
		if (pattern.test(page)) {
			var date = pattern.exec(page)[1];
			newItem.date = Zotero.Utilities.trim(date);
			// Zotero.debug("date: "+date);
		}
		
		//获取当前日期，格式YYYY-MM-DD
		function getNowFormatDay(nowDate) {
			var char = "-";
			if(nowDate == null){
				nowDate = new Date();
			}
			var day = nowDate.getDate();
			var month = nowDate.getMonth() + 1;//注意月份需要+1
			var year = nowDate.getFullYear();
			//补全0，并拼接
			return year + char + completeDate(month) + char +completeDate(day);
		}
	 
		//获取当前时间，格式YYYY-MM-DD HH:mm:ss
		function getNowFormatTime() {
			var nowDate = new Date();
			var colon = ":";
			var h = nowDate.getHours();
			var m = nowDate.getMinutes();
			var s = nowDate.getSeconds();
			//补全0，并拼接
			return getNowFormatDay(nowDate) + " " + completeDate(h) + colon + completeDate(m) + colon + completeDate(s);
		}
	 
		//补全0
		function completeDate(value) {
			return value < 10 ? "0"+value:value;
		}
		// 其他
		let nowTime = getNowFormatTime() // 在评分后面新增时间,保持时效性
		newItem.extra = "D"+dbScore.trim()+" 📅"+nowTime
	
		
		// 标签
		var tags = ZU.xpath(doc, '//div[@id="db-tags-section"]/div[@class="indent"]/span/a[contains(@class, "tag") ]');
		for (let i in tags) {
			newItem.tags.push(tags[i].text);
		}
		
		// 作者简介
		let authorInfoList = ZU.xpath(doc, "//span[text()='作者简介']/parent::h2/following-sibling::div//div[@class='intro']")
		// 这里会获取平级的元素,当有多个时(有展开全部按钮)取最后一个
		let authorInfo = ""
		let authorInfotwo = ""
		if(authorInfoList.length>0){
			authorInfo = authorInfoList[authorInfoList.length-1].innerHTML
			// 正则提取<p>标签里面的元素,并添加换行
			authorInfo = authorInfo.match(/<[a-zA-Z]+.*?>([\s\S]*?)<\/[a-zA-Z]+.*?>/g)
			for(i=0;i<authorInfo.length;i++){
			authorInfo[i] = authorInfo[i].match(/<[a-zA-Z]+.*?>([\s\S]*?)<\/[a-zA-Z]+.*?>/g)
			authorInfotwo = authorInfotwo+RegExp.$1+"\n"
			}
		}
	
		
		// 内容简介
		// 获取展开全部按钮里面的内容
		let contentInfoList = ZU.xpath(doc, "//span[text()='内容简介']/parent::h2/following-sibling::div[@id='link-report']//div[@class='intro']")
		let contentInfo = ""
		let contentInfoTwo = ""
		if(contentInfoList.length>0){
			contentInfo = contentInfoList[contentInfoList.length-1].innerHTML
			contentInfo = contentInfo.match(/<[a-zA-Z]+.*?>([\s\S]*?)<\/[a-zA-Z]+.*?>/g)
			for(i=0;i<contentInfo.length;i++){
			contentInfo[i] = contentInfo[i].match(/<[a-zA-Z]+.*?>([\s\S]*?)<\/[a-zA-Z]+.*?>/g)
			contentInfoTwo = contentInfoTwo+RegExp.$1+"\n"
			}
		}
		
		let abstractNoteTemp = "作者简介:"+"\n"+authorInfotwo+"\n"+
		"内容简介:"+"\n"+contentInfoTwo

		newItem.abstractNote = abstractNoteTemp
		
	
		// 调用qk api,实现html转md
		var postUrl = "https://tools.getquicker.cn/api/MarkDown/Html2Markdown"
		let postData = "{\"source\":\"<h1>string</h1>\"}"
		let headers  = {
		 	Accept: "text/plain",
		 	"Content-Type": "application/json",
		}
	
	  
		ZU.doPost(postUrl, postData, function(text){
			
		}, headers)
		
		newItem.complete();
	});
}

/** BEGIN TEST CASES **/
var testCases = [
	{
		"type": "web",
		"url": "https://book.douban.com/subject/1355643/",
		"items": [
			{
				"itemType": "book",
				"title": "Norwegian Wood",
				"creators": [
					{
						"firstName": "Haruki",
						"lastName": "Murakami",
						"creatorType": "author"
					},
					{
						"firstName": "Jay",
						"lastName": "Rubin",
						"creatorType": "translator"
					}
				],
				"date": "2003",
				"ISBN": "9780099448822",
				"abstractNote": "When he hears her favourite Beatles song, Toru Watanabe recalls his first love Naoko, the girlfriend of his best friend Kizuki. Immediately he is transported back almost twenty years to his student days in Tokyo, adrift in a world of uneasy friendships, casual sex, passion, loss and desire - to a time when an impetuous young woman called Midori marches into his life and he has ..., (展开全部)",
				"libraryCatalog": "Douban",
				"numPages": "389",
				"publisher": "Vintage",
				"url": "https://book.douban.com/subject/1355643/",
				"attachments": [],
				"tags": [
					{
						"tag": "HarukiMurakami"
					},
					{
						"tag": "小说"
					},
					{
						"tag": "挪威森林英文版"
					},
					{
						"tag": "日本"
					},
					{
						"tag": "日本文学"
					},
					{
						"tag": "村上春树"
					},
					{
						"tag": "英文原版"
					},
					{
						"tag": "英文版"
					}
				],
				"notes": [],
				"seeAlso": []
			}
		]
	},
	{
		"type": "web",
		"url": "https://www.douban.com/doulist/120664512/",
		"items": "multiple"
	},
	{
		"type": "web",
		"url": "https://book.douban.com/tag/认知心理学?type=S",
		"items": "multiple"
	}
]
/** END TEST CASES **/
