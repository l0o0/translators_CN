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
	"lastUpdated": "2022-10-26 15:50:12"
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
	}
	else {
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
			ZU.processDocuments(articles, scrapeAndParse);
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
	ZU.doGet(url, function (page) {
		// Z.debug(page)
		var pattern, extra;

		// 类型 & URL
		var itemType = "book";
		var newItem = new Zotero.Item(itemType);
		// Zotero.debug(itemType);
		newItem.url = url;

		// 评分
		let dbScore = ZU.xpathText(doc, '//*[@id="interest_sectl"]/div[1]/div[2]/strong');
		dbScore = dbScore.trim();
		if (dbScore === "  " || dbScore === "") {
			dbScore = "?";
		}


		// 评价人数
		let commentNum = ZU.xpathText(doc, '//*[@id="interest_sectl"]/div[1]/div[2]/div/div[2]/span/a/span');

		// 副标题
		pattern = /<span [^>]*?>副标题:<\/span>(.*?)<br\/>/;
		if (pattern.test(page)) {
			var subTitle = pattern.exec(page)[1].trim();
		}

		// 原作名
		pattern = /<span [^>]*?>原作名:<\/span>(.*?)<br\/>/;
		if (pattern.test(page)) {
			var originalTitle = pattern.exec(page)[1].trim();
		}

		// 标题
		let titleTemp = "";
		pattern = /<h1>([\s\S]*?)<\/h1>/;
		if (pattern.test(page)) {
			var title = pattern.exec(page)[1];
			title = ZU.trim(trimTags(title));
			let originalTitlePre = " #";
			if (!originalTitle) { // 当没有原名时,使用空字符
				originalTitlePre = "";
			}
			if (title === subTitle) { // 判断下副标题与标题一样否,避免重复
				extra = "👩‍⚖️" + commentNum + ";" + "🔟" + dbScore + originalTitlePre + originalTitle;
			}
			else {
				extra = "《" + title + " - " + subTitle + "》;" + "👩‍⚖️" + commentNum + ";" + "🔟" + dbScore + originalTitlePre + originalTitle;
			}
			extra = extra.replace(/( - )?undefined/g, "").replace("null", "0");
			extra += ';';
			newItem.title = title;
		}


		// 短标题
		newItem.shortTitle = "《" + title + "》";


		// 目录
		let catalogueList = ZU.xpath(doc, "//div[@class='indent' and contains(@id, 'dir_') and contains(@id, 'full')]");
		let catalogue = "";
		if (catalogueList.length > 0) {
			catalogue = "<h1>#摘录-《" + title + "》目录</h1>\n" + catalogueList[0].innerHTML;
			newItem.notes.push({ note: catalogue });
		}


		// 作者
		page = page.replace(/\n/g, "");
		page = page.replace(/&nbsp;/g, "");
		// Z.debug(page)
		// 豆瓣里作者一栏及其不规范,这里使用多正则匹配更多情况,提高兼容性
		let regexp = new RegExp(); // 这里要把类型定义为RegExp,否则下面赋值后test(page)会失败
		let regexp2 = new RegExp();
		let regexp3 = new RegExp();
		regexp = /<span>\s*<span[^>]*?>\s*作者<\/span>:(.*?)<\/span>/;
		regexp2 = /<span class="pl">作者:<\/span>\s*?<a href="https:\/\/book\.douban\.com\/author\/\d+\/">\s*?\S*?\s*?\S*?<\/a>\s*?<br>/;
		regexp3 = /<span class="pl">作者:<\/span>\s*?<a href="https:\/\/book\.douban\.com\/author\/\d+\/">\s*?\S*?\s*?\S*?<\/a>\s+\//;
		if (regexp2.test(page)) {
			regexp = regexp2;
		}
		else if (regexp3.test(page)) {
			regexp = regexp3;
		}

		if (regexp.test(page)) {
			var authorNames = trimTags(regexp.exec(page)[0]);
			pattern = /(\[.*?\]|\(.*?\)|（.*?）)/g;
			authorNames = authorNames.replace(pattern, "").split("/");
			// 国家
			let country = RegExp.$1;
			country = country.replace("美国", "美");
			country = country.match(/[一-龥]+/g);
			if (country === null) {
				country = [" "];
			}

			// Zotero.debug(authorNames);
			let firstNameList = []; // 作者名列表
			let lastNameList = []; // 作者姓列表
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
				let patt1 = new RegExp("·.+\.+");
				let authorNameTemp = "";
				let ming = "";
				let xing = "";

				authorNames[i] = authorNames[i].replace(/作者:?(&nbsp;)?\s+/g, "");
				if (authorNames[i].indexOf(".") != -1) { // 名字中带.的   如:斯蒂芬·D.埃平格
					authorNameTemp = authorNames[i].trim().split(".");
					xing = authorNameTemp.pop(); // 取数组最后一个值作为名
					ming = authorNameTemp.join("·"); // 姓氏
				}
				else {
					authorNames[i] = authorNames[i].replace(/•/g, "·"); // 替换中文•分隔符为英文·
					authorNameTemp = authorNames[i].trim().split("·");
					xing = authorNameTemp.pop();
					ming = authorNameTemp.join("·");
				}
				if (country[i]) {
					country = country[i].replace(/<\/a>/g, "");
				}

				if (country != " ") {
					country = "[" + country + "]";
				}

				firstNameList.push(country + ming);
				lastNameList.push(xing);

				newItem.creators.push({ firstName: firstNameList[i], lastName: lastNameList[i], creatorType: "author", fieldMode: true });
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
				newItem.creators.push(ZU.cleanAuthor(
					ZU.trim(translatorNames[i]),
					"translator", useComma));
			}
		}

		// ISBN
		pattern = /<span [^>]*?>ISBN:<\/span>(.*?)<br\/>/;
		if (pattern.test(page)) {
			var isbn = pattern.exec(page)[1];
			newItem.ISBN = ZU.trim(isbn);
			// Zotero.debug("isbn: "+isbn);
		}

		// 页数
		pattern = /<span [^>]*?>页数:<\/span>(.*?)<br\/>/;
		if (pattern.test(page)) {
			var numPages = pattern.exec(page)[1];
			newItem.numPages = ZU.trim(numPages);
			// Zotero.debug("numPages: "+numPages);
		}

		// 出版社
		pattern = /<span [^>]*?>出版社:<\/span>(.*?)<br>/;
		if (pattern.test(page)) {
			var publisher = pattern.exec(page)[1];
			newItem.publisher = ZU.trim(trimTags(publisher));
			// Zotero.debug("publisher: "+publisher);
		}

		// 定价
		pattern = /<span [^>]*?>定价:(.*?)<\/span>(.*?)<br\/?>/;
		var price;
		if (pattern.test(page)) {
			var price = pattern.exec(page)[2];
			// price = "60"
			let prefix = price.match(/^((?!(\d+\.?\d*)).)*/g)[0]; // 正则匹配前缀,如USD,CAD
			price = price.match(/(\d+\.?\d*)/g)[0];

			// 小数点后2为保持
			let numPrice = Number(price);
			numPrice = numPrice.toFixed(2);

			// 车同轨书同文,一统金额样式
			if (prefix === "" || prefix === " " || prefix.includes("CNY")) {
				price = numPrice + " 元;";
			}
			else {
				price = prefix + numPrice + ';';
			}
		}

		// 丛书
		pattern = /<span [^>]*?>丛书:<\/span>(.*?)<br\/>/;
		if (pattern.test(page)) {
			var series = trimTags(pattern.exec(page)[0]);
			series = series.split("ISBN")[0].replace("丛书:", "");
			newItem.series = ZU.trim(series);
			// Zotero.debug("series: "+series);
		}

		// 出版年
		pattern = /<span [^>]*?>出版年:<\/span>(.*?)<br\/>/;
		if (pattern.test(page)) {
			var date = pattern.exec(page)[1];
			newItem.date = ZU.trim(date);
			// Zotero.debug("date: "+date);
		}

		// 补全0
		function completeDate(value) {
			return value < 10 ? "0" + value : value;
		}
		// 其他
		newItem.extra = extra + price;


		// 标签
		var tags = ZU.xpath(doc, '//div[@id="db-tags-section"]/div[@class="indent"]/span/a[contains(@class, "tag") ]');
		for (let i in tags) {
			newItem.tags.push(tags[i].text);
		}

		// 作者简介
		let authorInfoList = ZU.xpath(doc, "//span[text()='作者简介']/parent::h2/following-sibling::div//div[@class='intro']");
		// 这里会获取平级的元素,当有多个时(有展开全部按钮)取最后一个
		let authorInfo = "";
		let authorInfotwo = "";
		if (authorInfoList.length > 0) {
			authorInfo = authorInfoList[authorInfoList.length - 1].innerHTML;
			// 正则提取<p>标签里面的元素,并添加换行
			authorInfo = authorInfo.match(/<[a-zA-Z]+.*?>([\s\S]*?)<\/[a-zA-Z]+.*?>/g);
			for (i = 0; i < authorInfo.length; i++) {
				authorInfo[i] = authorInfo[i].match(/<[a-zA-Z]+.*?>([\s\S]*?)<\/[a-zA-Z]+.*?>/g);
				authorInfotwo = authorInfotwo + RegExp.$1 + "\n";
			}
		}


		// 内容简介
		// 获取展开全部按钮里面的内容
		let contentInfoList = ZU.xpath(doc, "//span[text()='内容简介']/parent::h2/following-sibling::div[@id='link-report']//div[@class='intro']");
		let contentInfo = "";
		let contentInfoTwo = "";
		if (contentInfoList.length > 0) {
			contentInfo = contentInfoList[contentInfoList.length - 1].innerHTML;
			contentInfo = contentInfo.match(/<[a-zA-Z]+.*?>([\s\S]*?)<\/[a-zA-Z]+.*?>/g);
			for (i = 0; i < contentInfo.length; i++) {
				contentInfo[i] = contentInfo[i].match(/<[a-zA-Z]+.*?>([\s\S]*?)<\/[a-zA-Z]+.*?>/g);
				contentInfoTwo = contentInfoTwo + RegExp.$1 + "\n";
			}
		}

		let abstractNoteTemp = "作者简介:" + "\n" + authorInfotwo + "\n"
		+ "内容简介:" + "\n" + contentInfoTwo;

		newItem.abstractNote = abstractNoteTemp;
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
						"firstName": " ",
						"lastName": "Haruki Murakami",
						"creatorType": "author",
						"fieldMode": true
					},
					{
						"firstName": "Jay",
						"lastName": "Rubin",
						"creatorType": "translator"
					}
				],
				"date": "2003",
				"ISBN": "9780099448822",
				"abstractNote": "作者简介:\nHaruki Murakami (村上春樹, Murakami Haruki, born January 12, 1949) is a popular contemporary Japanese writer and translator.His work has been described by the Virginia Quarterly Review as \"easily accessible, yet profoundly complex.\"\n\n内容简介:\nWhen he hears her favourite Beatles song, Toru Watanabe recalls his first love Naoko, the girlfriend of his best friend Kizuki. Immediately he is transported back almost twenty years to his student days in Tokyo, adrift in a world of uneasy friendships, casual sex, passion, loss and desire - to a time when an impetuous young woman called Midori marches into his life and he has to choose between the future and the past. (20021018)\n\n  点击链接进入中文版： \n 挪威的森林",
				"extra": "《Norwegian Wood》;👩‍⚖️711;🔟9.0; GBP 8.99;",
				"libraryCatalog": "Douban",
				"numPages": "389",
				"publisher": "Vintage                                                   译者:                                Jay Rubin                  出版年: 2003              页数: 389              定价: GBP 8.99              装帧: Paperback              丛书:Works by Haruki Murakami",
				"series": "Works by Haruki Murakami",
				"shortTitle": "《Norwegian Wood》",
				"url": "https://book.douban.com/subject/1355643/",
				"attachments": [],
				"tags": [],
				"notes": [],
				"seeAlso": []
			}
		]
	},
	{
		"type": "web",
		"url": "https://book.douban.com/subject/26604008/",
		"items": [
			{
				"itemType": "book",
				"title": "计算机组成与设计（原书第5版）",
				"creators": [
					{
						"firstName": " 戴维 A",
						"lastName": "帕特森",
						"creatorType": "author",
						"fieldMode": true
					},
					{
						"firstName": " 约翰 L",
						"lastName": "亨尼斯",
						"creatorType": "author",
						"fieldMode": true
					},
					{
						"lastName": "王党辉",
						"creatorType": "translator"
					},
					{
						"lastName": "康继昌",
						"creatorType": "translator"
					},
					{
						"lastName": "安建峰",
						"creatorType": "translator"
					}
				],
				"date": "2015-7-1",
				"ISBN": "9787111504825",
				"abstractNote": "作者简介:\nDavid A. Patterson\n加州大学伯克利分校计算机科学系教授，美国国家工程研究院院士，IEEE和ACM会士，曾因成功的启发式教育方法被IEEE授予James H. Mulligan，Jr教育奖章。他因为对RISC技术的贡献而荣获1995年IEEE技术成就奖，而在RAID技术方面的成就为他赢得了1999年IEEE Reynold Johnson信息存储奖。2000年他和John L. Hennessy分享了John von Neumann奖。\nJohn L. Hennessy\n斯坦福大学校长，IEEE和ACM会士，美国国家工程研究院院士及美国科学艺术研究院院士。Hennessy教授因为在RISC技术方面做出了突出贡献而荣获2001年的Eckert-Mauchly奖章，他也是2001年Seymour Cray 计算机工程奖得主，并且和David A. Patterson分享了2000年John von Neumann奖。\n\n内容简介:\n《计算机组成与设计：硬件/软件接口》是计算机组成与设计的经典畅销教材，第5版经过全面更新，关注后PC时代发生在计算机体系结构领域的革命性变革——从单核处理器到多核微处理器，从串行到并行。本书特别关注移动计算和云计算，通过平板电脑、云体系结构以及ARM（移动计算设备）和x86（云计算）体系结构来探索和揭示这场技术变革。\n与前几版一样，本书采用MIPS处理器讲解计算机硬件技术、汇编语言、计算机算术、流水线、存储器层次结构以及I/O等基本功能。",
				"extra": "《计算机组成与设计（原书第5版） - 硬件/软件接口》;👩‍⚖️349;🔟9.2 #Computer Organization and Design: The Hardware/Software Interface (5/e);99.00 元;",
				"libraryCatalog": "Douban",
				"numPages": "536",
				"publisher": "机械工业出版社",
				"series": "计算机科学丛书",
				"shortTitle": "《计算机组成与设计（原书第5版）》",
				"url": "https://book.douban.com/subject/26604008/",
				"attachments": [],
				"tags": [],
				"notes": [
					{
						"note": "<h1>#摘录-《计算机组成与设计（原书第5版）》目录</h1>\n\n        出版者的话<br>\n        本书赞誉<br>\n        译者序<br>\n        前言<br>\n        作者简介<br>\n        第1章　计算机概要与技术1<br>\n        1.1　引言1<br>\n        1.1.1　计算应用的分类及其特性2<br>\n        1.1.2　欢迎来到后PC时代3<br>\n        1.1.3　你能从本书学到什么4<br>\n        1.2　计算机系统结构中的8个伟大思想6<br>\n        1.2.1　面向摩尔定律的设计6<br>\n        1.2.2　使用抽象简化设计6<br>\n        1.2.3　加速大概率事件6<br>\n        1.2.4　通过并行提高性能7<br>\n        1.2.5　通过流水线提高性能7<br>\n        1.2.6　通过预测提高性能7<br>\n        1.2.7　存储器层次7<br>\n        1.2.8　通过冗余提高可靠性7<br>\n        1.3　程序概念入门7<br>\n        1.4　硬件概念入门10<br>\n        1.4.1　显示器11<br>\n        1.4.2　触摸屏12<br>\n        1.4.3　打开机箱12<br>\n        1.4.4　数据安全15<br>\n        1.4.5　与其他计算机通信16<br>\n        1.5　处理器和存储器制造技术17<br>\n        1.6　性能20<br>\n        1.6.1　性能的定义20<br>\n        1.6.2　性能的度量22<br>\n        1.6.3　CPU性能及其因素23<br>\n        1.6.4　指令的性能24<br>\n        1.6.5　经典的CPU性能公式25<br>\n        1.7　功耗墙27<br>\n        1.8　沧海巨变：从单处理器向多处理器转变29<br>\n        1.9　实例：Intel Core i7基准31<br>\n        1.9.1　SPEC CPU基准测试程序31<br>\n        1.9.2　SPEC功耗基准测试程序32<br>\n        1.10　谬误与陷阱33<br>\n        1.11　本章小结35<br>\n        1.12　历史观点和拓展阅读36<br>\n        1.13　练习题36<br>\n        第2章　指令：计算机的语言40<br>\n        2.1　引言40<br>\n        2.2　计算机硬件的操作43<br>\n        2.3　计算机硬件的操作数44<br>\n        2.3.1　存储器操作数45<br>\n        2.3.2　常数或立即数操作数47<br>\n        2.4　有符号数和无符号数48<br>\n        2.5　计算机中指令的表示53<br>\n        2.6　逻辑操作58<br>\n        2.7　决策指令60<br>\n        2.7.1　循环61<br>\n        2.7.2　case/switch语句63<br>\n        2.8　计算机硬件对过程的支持64<br>\n        2.8.1　使用更多的寄存器66<br>\n        2.8.2　嵌套过程67<br>\n        2.8.3　在栈中为新数据分配空间69<br>\n        2.8.4　在堆中为新数据分配空间70<br>\n        2.9　人机交互72<br>\n        2.10　MIPS中32位立即数和寻址75<br>\n        2.10.1　32位立即数75<br>\n        2.10.2　分支和跳转中的寻址76<br>\n        2.10.3　MIPS寻址模式总结78<br>\n        2.10.4　机器语言解码79<br>\n        2.11　并行与指令：同步81<br>\n        2.12　翻译并执行程序83<br>\n        2.12.1　编译器83<br>\n        2.12.2　汇编器84<br>\n        2.12.3　链接器85<br>\n        2.12.4　加载器87<br>\n        2.12.5　动态链接库87<br>\n        2.12.6　启动一个Java程序89<br>\n        2.13　以一个C排序程序作为完整的例子90<br>\n        2.13.1　swap过程90<br>\n        2.13.2　sort过程91<br>\n        2.14　数组与指针96<br>\n        2.14.1　用数组实现clear96<br>\n        2.14.2　用指针实现clear97<br>\n        2.14.3　比较两个版本的clear97<br>\n        2.15　高级内容：编译C语言和解释Java语言98<br>\n        2.16　实例：ARMv7(32位)指令集98<br>\n        2.16.1　寻址模式99<br>\n        2.16.2　比较和条件分支100<br>\n        2.16.3　ARM的特色100<br>\n        2.17　实例：x86指令集102<br>\n        2.17.1　Intel x86的改进102<br>\n        2.17.2　x86寄存器和数据寻址模式103<br>\n        2.17.3　x86整数操作105<br>\n        2.17.4　x86指令编码107<br>\n        2.17.5　x86总结108<br>\n        2.18　实例：ARMv8（64位）指令集108<br>\n        2.19　谬误与陷阱109<br>\n        2.20　本章小结110<br>\n        2.21　历史观点和拓展阅读111<br>\n        2.22　练习题112<br>\n        第3章　计算机的算术运算117<br>\n        3.1　引言117<br>\n        3.2　加法和减法117<br>\n        3.3　乘法121<br>\n        3.3.1　顺序的乘法算法和硬件121<br>\n        3.3.2　有符号乘法124<br>\n        3.3.3　更快速的乘法124<br>\n        3.3.4　MIPS中的乘法124<br>\n        3.3.5　小结125<br>\n        3.4　除法125<br>\n        3.4.1　除法算法及其硬件结构125<br>\n        3.4.2　有符号除法128<br>\n        3.4.3　更快速的除法128<br>\n        3.4.4　MIPS中的除法129<br>\n        3.4.5　小结129<br>\n        3.5　浮点运算130<br>\n        3.5.1　浮点表示131<br>\n        3.5.2　浮点加法135<br>\n        3.5.3　浮点乘法138<br>\n        3.5.4　MIPS中的浮点指令139<br>\n        3.5.5　算术精确性145<br>\n        3.5.6　小结146<br>\n        3.6　并行性和计算机算术：子字并行148<br>\n        3.7　实例：x86中流处理SIMD扩展和高级向量扩展149<br>\n        3.8　加速：子字并行和矩阵乘法150<br>\n        3.9　谬误与陷阱153<br>\n        3.10　本章小结155<br>\n        3.11　历史观点和拓展阅读158<br>\n        3.12　练习题159<br>\n        第4章　处理器162<br>\n        4.1　引言162<br>\n        4.2　逻辑设计的一般方法165<br>\n        4.3　建立数据通路167<br>\n        4.4　一个简单的实现机制173<br>\n        4.4.1　ALU控制173<br>\n        4.4.2　主控制单元的设计175<br>\n        4.4.3　为什么不使用单周期实现方式181<br>\n        4.5　流水线概述182<br>\n        4.5.1　面向流水线的指令集设计186<br>\n        4.5.2　流水线冒险186<br>\n        4.5.3　对流水线概述的小结191<br>\n        4.6　流水线数据通路及其控制192<br>\n        4.6.1　图形化表示的流水线200<br>\n        4.6.2　流水线控制203<br>\n        4.7　数据冒险：旁路与阻塞206<br>\n        4.8　控制冒险214<br>\n        4.8.1　假定分支不发生215<br>\n        4.8.2　缩短分支的延迟215<br>\n        4.8.3　动态分支预测216<br>\n        4.8.4　流水线小结220<br>\n        4.9　异常221<br>\n        4.9.1　MIPS体系结构中的异常处理221<br>\n        4.9.2　在流水线实现中的异常222<br>\n        4.10　指令级并行226<br>\n        4.10.1　推测的概念227<br>\n        4.10.2　静态多发射处理器227<br>\n        4.10.3　动态多发射处理器231<br>\n        4.10.4　能耗效率与高级流水线233<br>\n        4.11　实例：ARM Cortex-A8和Intel Core i7流水线234<br>\n        4.11.1　ARM Cortex-A8235<br>\n        4.11.2　Intel Core i7 920236<br>\n        4.11.3　Intel Core i7 920的性能238<br>\n        4.12　运行更快：指令级并行和矩阵乘法240<br>\n        4.13　高级主题：通过硬件设计语言描述和建模流水线来介绍数字设计以及更多流水线示例242<br>\n        4.14　谬误与陷阱242<br>\n        4.15　本章小结243<br>\n        4.16　历史观点和拓展阅读243<br>\n        4.17　练习题243<br>\n        第5章　大容量和高速度：开发存储器层次结构252<br>\n        5.1　引言252<br>\n        5.2　存储器技术255<br>\n        5.2.1　SRAM技术256<br>\n        5.2.2　DRAM技术256<br>\n        5.2.3　闪存258<br>\n        5.2.4　磁盘存储器258<br>\n        5.3　cache的基本原理259<br>\n        5.3.1　cache访问261<br>\n        5.3.2　cache缺失处理265<br>\n        5.3.3　写操作处理266<br>\n        5.3.4　一个cache的例子:内置FastMATH处理器267<br>\n        5.3.5　小结269<br>\n        5.4　cache性能的评估和改进270<br>\n        5.4.1　通过更灵活地放置块来减少cache缺失272<br>\n        5.4.2　在cache中查找一个块275<br>\n        5.4.3　替换块的选择276<br>\n        5.4.4　使用多级cache结构减少缺失代价277<br>\n        5.4.5　通过分块进行软件优化280<br>\n        5.4.6　小结283<br>\n        5.5　可信存储器层次283<br>\n        5.5.1　失效的定义283<br>\n        5.5.2　纠正一位错、检测两位错的汉明编码（SEC/DED）284<br>\n        5.6　虚拟机287<br>\n        5.6.1　虚拟机监视器的必备条件289<br>\n        5.6.2　指令集系统结构（缺乏）对虚拟机的支持289<br>\n        5.6.3　保护和指令集系统结构289<br>\n        5.7　虚拟存储器290<br>\n        5.7.1　页的存放和查找293<br>\n        5.7.2　缺页故障294<br>\n        5.7.3　关于写297<br>\n        5.7.4　加快地址转换：TLB297<br>\n        5.7.5　集成虚拟存储器、TLB和cache 300<br>\n        5.7.6　虚拟存储器中的保护302<br>\n        5.7.7　处理TLB缺失和缺页303<br>\n        5.7.8　小结307<br>\n        5.8　存储器层次结构的一般框架309<br>\n        5.8.1　问题1：一个块可以被放在何处309<br>\n        5.8.2　问题2：如何找到一个块310<br>\n        5.8.3　问题3：当cache缺失时替换哪一块311<br>\n        5.8.4　问题4：写操作如何处理311<br>\n        5.8.5　3C：一种理解存储器层次结构行为的直观模型312<br>\n        5.9　使用有限状态机来控制简单的cache314<br>\n        5.9.1　一个简单的cache314<br>\n        5.9.2　有限状态机315<br>\n        5.9.3　一个简单的cache控制器的有限状态机316<br>\n        5.10　并行与存储器层次结构：cache一致性317<br>\n        5.10.1　实现一致性的基本方案318<br>\n        5.10.2　监听协议319<br>\n        5.11　并行与存储器层次结构：冗余廉价磁盘阵列320<br>\n        5.12　高级内容：实现cache控制器320<br>\n        5.13　实例：ARM Cortex-A8和Intel Core i7的存储器层次结构320<br>\n        5.14　运行更快:cache分块和矩阵乘法324<br>\n        5.15　谬误和陷阱326<br>\n        5.16　本章小结329<br>\n        5.17　历史观点和拓展阅读329<br>\n        5.18　练习题329<br>\n        第6章　从客户端到云的并行处理器340<br>\n        6.1　引言340<br>\n        6.2　创建并行处理程序的难点342<br>\n        6.3　SISD、MIMD、SIMD、SPMD和向量机345<br>\n        6.3.1　在x86中的SIMD：多媒体扩展346<br>\n        6.3.2　向量机346<br>\n        6.3.3　向量与标量的对比347<br>\n        6.3.4　向量与多媒体扩展的对比348<br>\n        6.4　硬件多线程350<br>\n        6.5　多核和其他共享内存多处理器352<br>\n        6.6　图形处理单元简介355<br>\n        6.6.1　NVIDIA GPU体系结构简介356<br>\n        6.6.2　NVIDIA GPU存储结构357<br>\n        6.6.3　GPU展望358<br>\n        6.7　集群、仓储级计算机和其他消息传递多处理器360<br>\n        6.8　多处理器网络拓扑简介363<br>\n        6.9　与外界通信：集群网络366<br>\n        6.10　多处理器测试集程序和性能模型366<br>\n        6.10.1　性能模型368<br>\n        6.10.2　Roofline模型369<br>\n        6.10.3　两代Opteron的比较370<br>\n        6.11　实例：评测Intel Core i7 960和NVIDIA Tesla GPU的Roofline模型373<br>\n        6.12　运行更快：多处理器和矩阵乘法376<br>\n        6.13　谬误与陷阱378<br>\n        6.14　本章小结379<br>\n        6.15　历史观点和拓展阅读381<br>\n        6.16　练习题382<br>\n        附录A　汇编器、链接器和SPIM仿真器389<br>\n        附录B　逻辑设计基础437<br>\n        索引494<br>\n     · · · · · ·     (<a href=\"javascript:$('#dir_26604008_full').hide();$('#dir_26604008_short').show();void(0);\">收起</a>)\n"
					}
				],
				"seeAlso": []
			}
		]
	},
	{
		"type": "web",
		"url": "https://book.douban.com/subject/30280001/",
		"items": [
			{
				"itemType": "book",
				"title": "计算机网络（原书第7版）",
				"creators": [
					{
						"firstName": " James F",
						"lastName": " Kurose",
						"creatorType": "author",
						"fieldMode": true
					},
					{
						"firstName": " Keith W",
						"lastName": " Ross",
						"creatorType": "author",
						"fieldMode": true
					},
					{
						"lastName": "陈鸣",
						"creatorType": "translator"
					}
				],
				"date": "2018-6",
				"ISBN": "9787111599715",
				"abstractNote": "作者简介:\nJames F.Kurose是美国马萨诸塞大学阿默斯特分校杰出的计算机科学教授。他目前担任美国国家科学基金会的副主任，领导计算机和信息科学工程理事会。\nKurose博士在教育领域的活动获得了许多赞誉，其中包括国立技术大学（8次）、马萨诸塞大学和研究生院东北联合会杰出教师奖。他获得了IEEE Taylor Booth 教育奖章，从而确立了他在马萨诸塞共同体信息技术促进会的领导地位。他多次赢得优秀会议论文奖并获得IEEE Infocom成就奖和ACM Sigcomm的时间考验奖。\nKurose博士是《IEEE通信会刊》（IEEE Transactions on Communications）和《IEEE/ACM网络会刊》(IEEE/ACM Transactions on Networking)的前任总编辑。他担任了IEEE Infocom、ACM SIGCOMM、ACM因特网测量会议和ACM SIGMETRICS的技术程序的共同主席。他是IEEE会士（Fellow）和ACM会士。他的研究兴趣包括网络协议和体系结构、网络测量、多媒体通信以及建模和性能评价。他拥有哥伦比亚大学计算机科学的博士学位。\nKeith W.Ross是美国纽约大学（NYU）上海分校工程和计算机科学学院院长以及NYU计算机科学和工程系的Leonard J.Shustek首席教授。在此之前，他就职于宾夕法尼亚大学（13年）、Eurecom学院（5年）和理工大学（10年）。他从Tufts大学获得电气工程学士学位，从哥伦比亚大学获得电气工程硕士学位，从密歇根大学获得计算机和控制工程博士学位。Ross也是Wimba公司奠基人和首任CEO，该公司为电子学习研发了在线多媒体应用并于2010年被Blackboard收购。\nRoss教授的研究兴趣在隐私、社交网络、对等（P2P）网络、因特网测量、内容分发网和随机建模等方面。他是ACM会士和IEEE会士，获得了Infocom 2009年优秀论文奖，并且获得《多媒体通信》2011年和2008年优秀论文奖（由IEEE通信学会授予）。他担任多个杂志编委和会议程序委员会委员，包括《IEEE/ACM网络会刊》、ACM SIGCOMM、ACM CoNext和ACM因特网测量会议。他还担任联邦贸易委员会P2P文件共享方面的顾问。\n陈鸣，南京航空航天大学特聘教授、研究生导师；分别于1982年、1988年在解放军信息工程学院获得学士、硕士学位，于1991年在解放军通信工程学院获得博士学位，1999~2000年为美国哥伦比亚大学访问科学家，现在任中国计算机学会网络与数据通信专委会副主任，是中国通信学会等多个学术团体委员和IEEE会员；长期从事网络测量、分布式系统、未来网络、网络安全等领域研究和教学工作，近期研究兴趣包括无人机网络、软件定义网络、网络功能虚拟化；承担了国家自然科学基金、国家863、国家973子课题等项目；开发的多个网络管理系统和应用系统在多个领域得到广泛应用；撰写网络著作近10本，发表SCI/EI论文几十篇，有国家发明专利10项；获得国家教学成果二等奖1项和省部级科技进步二、三等奖十几项。\n\n内容简介:\n本书是经典的计算机网络教材，采用作者独创的自顶向下方法来讲授计算机网络的原理及其协议，自第1版出版以来已经被数百所大学和学院选作教材，被译为14种语言。\n第7版保持了以前版本的特色，继续关注因特网和计算机网络的现代处理方式，注重原理和实践，为计算机网络教学提供一种新颖和与时俱进的方法。同时，第7版进行了相当多的修订和更新，首次改变了各章的组织结构，将网络层分成两章（第4章关注网络层的数据平面，第5章关注网络层的控制平面），并将网络管理主题放入新的第5章中。此外，为了反映自第6版以来计算机网络领域的新变化，对其他章节也进行了更新，删除了FTP和分布式散列表的材料，用流行的因特网显式拥塞通告（ECN）材料代替了ATM网络的材料，更新了有关802.11（即WiFi）网络和蜂窝网络（包括4G和LTE）的材料，全面修订并增加了新的课后习题，等等。\n本书适合作为计算机、电气工程等专业本科生的“计算机网络”课程教科书，同时也适合网络技术人员、专业研究人员阅读。",
				"extra": "《计算机网络（原书第7版） - 自顶向下方法》;👩‍⚖️751;🔟9.3 #Computer Networking: A Top-Down Approach;89.00 元;",
				"libraryCatalog": "Douban",
				"numPages": "480",
				"publisher": "机械工业出版社",
				"series": "计算机科学丛书",
				"shortTitle": "《计算机网络（原书第7版）》",
				"url": "https://book.douban.com/subject/30280001/",
				"attachments": [],
				"tags": [],
				"notes": [
					{
						"note": "<h1>#摘录-《计算机网络（原书第7版）》目录</h1>\n\n        目录<br>\n        出版者的话<br>\n        作译者简介<br>\n        译者序<br>\n        前言<br>\n        第1章　计算机网络和因特网1<br>\n        1.1　什么是因特网1<br>\n        1.1.1　具体构成描述1<br>\n        1.1.2　服务描述4<br>\n        1.1.3　什么是协议5<br>\n        1.2　网络边缘6<br>\n        1.2.1　接入网8<br>\n        1.2.2　物理媒体13<br>\n        1.3　网络核心15<br>\n        1.3.1　分组交换15<br>\n        1.3.2　电路交换19<br>\n        1.3.3　网络的网络22<br>\n        1.4　分组交换网中的时延、丢包和吞吐量24<br>\n        1.4.1　分组交换网中的时延概述24<br>\n        1.4.2　排队时延和丢包27<br>\n        1.4.3　端到端时延28<br>\n        1.4.4　计算机网络中的吞吐量30<br>\n        1.5　协议层次及其服务模型32<br>\n        1.5.1　分层的体系结构32<br>\n        1.5.2　封装36<br>\n        1.6　面对攻击的网络37<br>\n        1.7　计算机网络和因特网的历史40<br>\n        1.7.1　分组交换的发展：1961～197241<br>\n        1.7.2　专用网络和网络互联：1972～198042<br>\n        1.7.3　网络的激增：1980～199042<br>\n        1.7.4　因特网爆炸：20世纪90年代43<br>\n        1.7.5　最新发展44<br>\n        1.8　小结44<br>\n        课后习题和问题46<br>\n        复习题46<br>\n        习题47<br>\n        Wireshark实验51<br>\n        人物专访52<br>\n        第2章　应用层54<br>\n        2.1　应用层协议原理54<br>\n        2.1.1　网络应用程序体系结构55<br>\n        2.1.2　进程通信57<br>\n        2.1.3　可供应用程序使用的运输服务59<br>\n        2.1.4　因特网提供的运输服务60<br>\n        2.1.5　应用层协议63<br>\n        2.1.6　本书涉及的网络应用63<br>\n        2.2　Web和HTTP64<br>\n        2.2.1　HTTP概况64<br>\n        2.2.2　非持续连接和持续连接65<br>\n        2.2.3　HTTP报文格式67<br>\n        2.2.4　用户与服务器的交互：cookie70<br>\n        2.2.5　Web缓存72<br>\n        2.2.6　条件GET方法74<br>\n        2.3　因特网中的电子邮件75<br>\n        2.3.1　SMTP76<br>\n        2.3.2　与HTTP的对比78<br>\n        2.3.3　邮件报文格式79<br>\n        2.3.4　邮件访问协议79<br>\n        2.4　DNS：因特网的目录服务83<br>\n        2.4.1　DNS提供的服务83<br>\n        2.4.2　DNS工作机理概述85<br>\n        2.4.3　DNS记录和报文89<br>\n        2.5　P2P文件分发92<br>\n        2.6　视频流和内容分发网97<br>\n        2.6.1　因特网视频97<br>\n        2.6.2　HTTP流和DASH98<br>\n        2.6.3　内容分发网98<br>\n        2.6.4　学习案例：Netflix、YouTube和“看看”101<br>\n        2.7　套接字编程：生成网络应用104<br>\n        2.7.1　UDP套接字编程105<br>\n        2.7.2　TCP套接字编程109<br>\n        2.8　小结112<br>\n        课后习题和问题113<br>\n        复习题113<br>\n        习题114<br>\n        套接字编程作业118<br>\n        Wireshark实验：HTTP119<br>\n        Wireshark实验：DNS120<br>\n        人物专访120<br>\n        第3章　运输层121<br>\n        3.1　概述和运输层服务121<br>\n        3.1.1　运输层和网络层的关系122<br>\n        3.1.2　因特网运输层概述123<br>\n        3.2　多路复用与多路分解125<br>\n        3.3　无连接运输：UDP130<br>\n        3.3.1　UDP报文段结构132<br>\n        3.3.2　UDP检验和133<br>\n        3.4　可靠数据传输原理134<br>\n        3.4.1　构造可靠数据传输协议135<br>\n        3.4.2　流水线可靠数据传输协议143<br>\n        3.4.3　回退N步145<br>\n        3.4.4　选择重传148<br>\n        3.5　面向连接的运输：TCP152<br>\n        3.5.1　TCP连接152<br>\n        3.5.2　TCP报文段结构154<br>\n        3.5.3　往返时间的估计与超时157<br>\n        3.5.4　可靠数据传输159<br>\n        3.5.5　流量控制164<br>\n        3.5.6　TCP连接管理166<br>\n        3.6　拥塞控制原理170<br>\n        3.6.1　拥塞原因与代价171<br>\n        3.6.2　拥塞控制方法175<br>\n        3.7　TCP拥塞控制176<br>\n        3.7.1　公平性183<br>\n        3.7.2　明确拥塞通告：网络辅助拥塞控制184<br>\n        3.8　小结185<br>\n        课后习题和问题187<br>\n        复习题187<br>\n        习题189<br>\n        编程作业195<br>\n        Wireshark实验：探究TCP196<br>\n        Wireshark实验：探究UDP196<br>\n        人物专访196<br>\n        第4章　网络层：数据平面198<br>\n        4.1　网络层概述198<br>\n        4.1.1　转发和路由选择：数据平面和控制平面199<br>\n        4.1.2　网络服务模型202<br>\n        4.2　路由器工作原理203<br>\n        4.2.1　输入端口处理和基于目的地转发205<br>\n        4.2.2　交换207<br>\n        4.2.3　输出端口处理209<br>\n        4.2.4　何处出现排队209<br>\n        4.2.5　分组调度211<br>\n        4.3　网际协议：IPv4、寻址、IPv6及其他214<br>\n        4.3.1　IPv4数据报格式214<br>\n        4.3.2　IPv4数据报分片216<br>\n        4.3.3　IPv4编址217<br>\n        4.3.4　网络地址转换225<br>\n        4.3.5　IPv6227<br>\n        4.4　通用转发和SDN231<br>\n        4.4.1　匹配233<br>\n        4.4.2　动作234<br>\n        4.4.3　匹配加动作操作中的OpenFlow例子234<br>\n        4.5　小结236<br>\n        课后习题和问题236<br>\n        复习题236<br>\n        习题237<br>\n        Wireshark实验240<br>\n        人物专访241<br>\n        第5章　网络层：控制平面242<br>\n        5.1　概述242<br>\n        5.2　路由选择算法244<br>\n        5.2.1　链路状态路由选择算法246<br>\n        5.2.2　距离向量路由选择算法248<br>\n        5.3　因特网中自治系统内部的路由选择：OSPF254<br>\n        5.4　ISP之间的路由选择：BGP256<br>\n        5.4.1　BGP的作用257<br>\n        5.4.2　通告BGP路由信息257<br>\n        5.4.3　确定最好的路由259<br>\n        5.4.4　IP任播261<br>\n        5.4.5　路由选择策略262<br>\n        5.4.6　拼装在一起：在因特网中呈现264<br>\n        5.5　SDN控制平面265<br>\n        5.5.1　SDN控制平面：SDN控制器和SDN网络控制应用程序266<br>\n        5.5.2　OpenFlow协议267<br>\n        5.5.3　数据平面和控制平面交互的例子269<br>\n        5.5.4　SDN的过去与未来270<br>\n        5.6　ICMP：因特网控制报文协议272<br>\n        5.7　网络管理和SNMP274<br>\n        5.7.1　网络管理框架274<br>\n        5.7.2　简单网络管理协议275<br>\n        5.8　小结277<br>\n        课后习题和问题278<br>\n        复习题278<br>\n        习题279<br>\n        套接字编程作业281<br>\n        编程作业282<br>\n        Wireshark实验282<br>\n        人物专访283<br>\n        第6章　链路层和局域网285<br>\n        6.1　链路层概述285<br>\n        6.1.1　链路层提供的服务287<br>\n        6.1.2　链路层在何处实现287<br>\n        6.2　差错检测和纠正技术288<br>\n        6.2.1　奇偶校验289<br>\n        6.2.2　检验和方法290<br>\n        6.2.3　循环冗余检测291<br>\n        6.3　多路访问链路和协议292<br>\n        6.3.1　信道划分协议294<br>\n        6.3.2　随机接入协议295<br>\n        6.3.3　轮流协议301<br>\n        6.3.4　DOCSIS：用于电缆因特网接入的链路层协议301<br>\n        6.4　交换局域网302<br>\n        6.4.1　链路层寻址和ARP303<br>\n        6.4.2　以太网308<br>\n        6.4.3　链路层交换机312<br>\n        6.4.4　虚拟局域网317<br>\n        6.5　链路虚拟化：网络作为链路层319<br>\n        6.6　数据中心网络322<br>\n        6.7　回顾：Web页面请求的历程326<br>\n        6.7.1　准备：DHCP、UDP、IP和以太网326<br>\n        6.7.2　仍在准备：DNS和ARP327<br>\n        6.7.3　仍在准备：域内路由选择到DNS服务器328<br>\n        6.7.4　Web客户-服务器交互：TCP和HTTP329<br>\n        6.8　小结330<br>\n        课后习题和问题331<br>\n        复习题331<br>\n        习题331<br>\n        Wireshark实验335<br>\n        人物专访336<br>\n        第7章　无线网络和移动网络338<br>\n        7.1　概述339<br>\n        7.2　无线链路和网络特征341<br>\n        7.3　WiFi：802.11无线LAN346<br>\n        7.3.1　802.11体系结构347<br>\n        7.3.2　802.11 MAC协议350<br>\n        7.3.3　IEEE 802.11帧353<br>\n        7.3.4　在相同的IP子网中的移动性355<br>\n        7.3.5　802.11中的高级特色356<br>\n        7.3.6　个人域网络：蓝牙和ZigBee357<br>\n        7.4　蜂窝因特网接入358<br>\n        7.4.1　蜂窝网体系结构概述359<br>\n        7.4.2　3G蜂窝数据网：将因特网扩展到蜂窝用户360<br>\n        7.4.3　走向4G：LTE362<br>\n        7.5　移动管理：原理364<br>\n        7.5.1　寻址367<br>\n        7.5.2　路由选择到移动节点367<br>\n        7.6　移动IP371<br>\n        7.7　管理蜂窝网中的移动性374<br>\n        7.7.1　对移动用户呼叫的路由选择375<br>\n        7.7.2　GSM中的切换376<br>\n        7.8　无线和移动性：对高层协议的影响378<br>\n        7.9　小结380<br>\n        课后习题和问题380<br>\n        复习题380<br>\n        习题381<br>\n        Wireshark实验383<br>\n        人物专访383<br>\n        第8章　计算机网络中的安全385<br>\n        8.1　什么是网络安全385<br>\n        8.2　密码学的原则387<br>\n        8.2.1　对称密钥密码体制388<br>\n        8.2.2　公开密钥加密392<br>\n        8.3　报文完整性和数字签名396<br>\n        8.3.1　密码散列函数397<br>\n        8.3.2　报文鉴别码398<br>\n        8.3.3　数字签名399<br>\n        8.4　端点鉴别404<br>\n        8.4.1　鉴别协议ap1.0404<br>\n        8.4.2　鉴别协议ap2.0405<br>\n        8.4.3　鉴别协议ap3.0405<br>\n        8.4.4　鉴别协议ap3.1406<br>\n        8.4.5　鉴别协议ap4.0406<br>\n        8.5　安全电子邮件407<br>\n        8.5.1　安全电子邮件407<br>\n        8.5.2　PGP409<br>\n        8.6　使TCP连接安全：SSL410<br>\n        8.6.1　宏观描述411<br>\n        8.6.2　更完整的描述413<br>\n        8.7　网络层安全性：IPsec和虚拟专用网415<br>\n        8.7.1　IPsec和虚拟专用网415<br>\n        8.7.2　AH协议和ESP协议416<br>\n        8.7.3　安全关联416<br>\n        8.7.4　IPsec数据报417<br>\n        8.7.5　IKE：IPsec中的密钥管理420<br>\n        8.8　使无线LAN安全420<br>\n        8.8.1　有线等效保密421<br>\n        8.8.2　IEEE 802.11i422<br>\n        8.9　运行安全性：防火墙和入侵检测系统424<br>\n        8.9.1　防火墙424<br>\n        8.9.2　入侵检测系统429<br>\n        8.10　小结431<br>\n        课后习题和问题432<br>\n        复习题432<br>\n        习题434<br>\n        Wireshark实验437<br>\n        IPsec实验437<br>\n        人物专访438<br>\n        第9章　多媒体网络439<br>\n        9.1　多媒体网络应用439<br>\n        9.1.1　视频的性质439<br>\n        9.1.2　音频的性质440<br>\n        9.1.3　多媒体网络应用的类型441<br>\n        9.2　流式存储视频443<br>\n        9.2.1　UDP流444<br>\n        9.2.2　HTTP流444<br>\n        9.3　IP语音447<br>\n        9.3.1　尽力而为服务的限制448<br>\n        9.3.2　在接收方消除音频的时延抖动449<br>\n        9.3.3　从丢包中恢复451<br>\n        9.3.4　学习案例：使用Skype的VoIP453<br>\n        9.4　实时会话式应用的协议455<br>\n        9.4.1　RTP455<br>\n        9.4.2　SIP457<br>\n        9.5　支持多媒体的网络461<br>\n        9.5.1　定制尽力而为网络462<br>\n        9.5.2　提供多种类型的服务463<br>\n        9.5.3　区分服务468<br>\n        9.5.4　每连接服务质量保证：资源预约和呼叫准入470<br>\n        9.6　小结472<br>\n        课后习题和问题473<br>\n        复习题473<br>\n        习题473<br>\n        编程作业477<br>\n        人物专访478<br>\n        参考文献480<br>\n     · · · · · ·     (<a href=\"javascript:$('#dir_30280001_full').hide();$('#dir_30280001_short').show();void(0);\">收起</a>)\n"
					}
				],
				"seeAlso": []
			}
		]
	},
	{
		"type": "web",
		"url": "https://book.douban.com/subject/35152294/",
		"items": [
			{
				"itemType": "book",
				"title": "社会资本：关于社会结构与行动的理论",
				"creators": [
					{
						"firstName": " ",
						"lastName": "【美】林南 著",
						"creatorType": "author",
						"fieldMode": true
					},
					{
						"lastName": "张磊 译",
						"creatorType": "translator"
					}
				],
				"date": "2020-7",
				"ISBN": "9787509782149",
				"abstractNote": "作者简介:\n林南，现任杜克大学社会学教授、亚太研究所所长，前美国社会学会副会长（1999-2000），台湾中研院院士，中国人民大学荣誉教授，华中理工大学顾问教授，南开大学客座教授，复旦大学顾问教授和中山大学客座教授。其著作包括：《社会支持、生活事件与抑郁》（Social Support, Life Events and Depression）（与Alfred Dean, Walter Ensel 合著，1986）；《社会研究的基础》（Foundation of Social Research）（1976）；《人类沟通研究》（The Study of Human Communication）（1973）等。他与Peter Marsden合编了《社会结构与社会网络分析》（Social Structure and network Analysis）（1982）。林南还有很多文章在《美国社会学评论》（American Sociological Review）、《美国社会学杂志》（American Journal of Sociology）、《健康与社会行为杂志》（Journal of Health and Social Behavior）、《社会力量》（Social Forces）等杂志上发表。\n\n内容简介:\n林南将社会资本理论放在资本理论（古典资本理论与新古典资本理论）的体系之中，详细阐述了社会资本的要素、命题和理论发现，介绍了研究计划与研究议程，对个体行动与社会结构之间的互动意义进行了理论说明（在对首属群体、社会交换、组织、制度转型和数码网络的论述中）。林南开创性地提出并且令人信服地解释了为什么“你认识谁“和“你知道什么“在生活与社会中具有重要意义。",
				"extra": "《社会资本：关于社会结构与行动的理论》;👩‍⚖️95;🔟8.1;89.00 元;",
				"libraryCatalog": "Douban",
				"publisher": "社会科学文献出版社",
				"shortTitle": "《社会资本：关于社会结构与行动的理论》",
				"url": "https://book.douban.com/subject/35152294/",
				"attachments": [],
				"tags": [],
				"notes": [],
				"seeAlso": []
			}
		]
	},
	{
		"type": "web",
		"url": "https://book.douban.com/subject/24720345/",
		"items": [
			{
				"itemType": "book",
				"title": "反叛的科学家",
				"creators": [
					{
						"firstName": " 弗里曼",
						"lastName": "戴森",
						"creatorType": "author",
						"fieldMode": true
					},
					{
						"lastName": "肖明波",
						"creatorType": "translator"
					},
					{
						"lastName": "杨光松",
						"creatorType": "translator"
					}
				],
				"date": "2013-6-1",
				"ISBN": "9787308112246",
				"abstractNote": "作者简介:\n弗里曼•戴森（Freeman Dyson，1923－），出生于英国。他早年追随著名的数学家G. H. 哈代研究数学，二战后去了美国，师从汉斯•贝特和理查德•费曼等人，开展物理学方面的研究工作。他证明了施温格与朝永振一郎的变分法方法和费曼的路径积分法相互等价，为量子电动力学的建立作出了决定性的贡献，是量子电动力学的第一代巨擘。后来，费曼、施温格和朝永振一郎因为在量子电动力学方面的成就获得了1965年的诺贝尔物理奖，而戴森却因获奖人数的限制而与诺贝尔奖失之交臂。\n他发表于1956年的论文《自旋波》堪称物理学史上的重量级论文之一。1960年，他又提出了旨在有效利用外太空能量的“费曼球”理论。因为卓越的学术成就，他先后获得了伦敦皇家学会休斯奖、德国物理学会普朗克奖、奥本海默纪念奖、以色列海法理工学院的哈维奖等多项殊荣。\n戴森教授不仅是一位大科学家，更是一位科学界的通人。1953年后，他一直在举世闻名的普林斯顿高等研究院担任教授，与爱因斯坦、奥本海默、费米、费曼、杨振宁、李政道和维纳等科学巨匠有密切的交往，对美国科学界近几十年的发展动态和内幕相当了解。他一生优游于数学、粒子物理、固态物理、核子工程、生命科学和天文学等广阔的学科领域，同时又热爱和平，关心人类命运，思索宇宙与人类心智的奥秘，检讨人类道德伦理的困境，还特别以在核武器政策和外星智能方面的工作而闻名。尤为难得的是，他从小就喜爱文学作品，文字根底深厚，并重视普及性读物的撰写，先后出版了《全方位的无限》、《武器与希望》、《宇宙波澜》、《想象的未来》、《太阳、基因组与互联网：科学革命的工具》、《想象中的世界》和《多彩的镜子：生命在宇宙中位置的反思录》等多部广受读者欢迎的著作。\n\n内容简介:\n从伽利略到今天的业余天文观测者，科学家们都有反叛精神，戴森如是说。在追求大自然真理时，他们受理性更受想象力的指引，他们最伟大的理论就具有伟大艺术作品的独特性与美感。\n戴森以生动优美的语言讲述了科学家在工作中的故事，从牛顿专心致志于物理学、炼金术、神学和政治，到卢瑟福发现原子结构，再到爱因斯坦固执地反对黑洞观念。他还以切身经历回忆了他的老师和朋友特勒与费曼等聪明绝顶的科学家。书里充满了有趣的逸事和对人心的深刻体察，反映了作者的怀疑精神。\n这组文章出自卓越的科学家同时也是文笔生动的作家之手，展现出对科学史的深刻洞察，以及当代人探讨科学、伦理与信仰的新视角。",
				"extra": "《反叛的科学家》;👩‍⚖️201;🔟8.6 #The Scientist as Rebel;52.00 元;",
				"libraryCatalog": "Douban",
				"numPages": "396",
				"publisher": "浙江大学出版社",
				"series": "启真·科学",
				"shortTitle": "《反叛的科学家》",
				"url": "https://book.douban.com/subject/24720345/",
				"attachments": [],
				"tags": [],
				"notes": [
					{
						"note": "<h1>#摘录-《反叛的科学家》目录</h1>\n\n        目　　录<br>\n        译本序（尹传红） 1<br>\n        作者序 1<br>\n        第一部分　当代科学中的问题<br>\n        1　反叛的科学家 13<br>\n        2　科学可以合乎道德吗？ 31<br>\n        3　现代异教徒 46<br>\n        4　未来需要我们 53<br>\n        5　好一个大千世界！ 68<br>\n        6　一场悲剧的见证 83<br>\n        第二部分　战争与和平<br>\n        7　炸弹与土豆 89<br>\n        8　将军 94<br>\n        9　 俄罗斯人 112<br>\n        10　和平主义者 125<br>\n        11　军备竞赛结束了 144<br>\n        12　理性的力量 150<br>\n        13　血战到底 157<br>\n        第三部分　科学史与科学家<br>\n        14　两种历史 177<br>\n        15　爱德华• 特勒的《回忆录》 186<br>\n        16　业余科学家礼赞 192<br>\n        17　老牛顿，新印象 205<br>\n        18　时钟的科学 219<br>\n        19　弦上的世界 231<br>\n        20　奥本海默：科学家、管理者与诗人 247<br>\n        21　看到不可见的东西 263<br>\n        22　一位天才人物的悲惨故事 276<br>\n        23　智者 291<br>\n        第四部分　个人与哲学随笔<br>\n        24　世界、肉体与魔鬼 309<br>\n        25　实验室里有上帝吗？ 327<br>\n        26　我的偶像崇拜 338<br>\n        27　百万分之一的可能性 344<br>\n        28　众多世界 357<br>\n        29　从局外看宗教 363<br>\n        第五部分<br>\n        书目注释 379<br>\n        附录：一个保守的革命者 383<br>\n        译后记 391<br>\n     · · · · · ·     (<a href=\"javascript:$('#dir_24720345_full').hide();$('#dir_24720345_short').show();void(0);\">收起</a>)\n"
					}
				],
				"seeAlso": []
			}
		]
	},
	{
		"type": "web",
		"url": "https://book.douban.com/subject/1291204/",
		"items": [
			{
				"itemType": "book",
				"title": "哥德尔、艾舍尔、巴赫",
				"creators": [
					{
						"firstName": "[美]",
						"lastName": "侯世达",
						"creatorType": "author",
						"fieldMode": true
					},
					{
						"lastName": "严勇",
						"creatorType": "translator"
					},
					{
						"lastName": "刘皓明",
						"creatorType": "translator"
					},
					{
						"lastName": "莫大伟",
						"creatorType": "translator"
					}
				],
				"date": "1997-5",
				"ISBN": "9787100013239",
				"abstractNote": "作者简介:\n道格拉斯·理查·郝夫斯台特（Douglas Richard Hofstadter，1945年2月15日－）\n中文名侯世达，美国学者、作家。主要研究领域包括意识、类比、艺术创造、文学翻译以及数学和物理学探索。因其著作《哥德尔、埃舍尔、巴赫》获得普立兹奖（非小说类别）和美国国家图书奖（科学类别）。\n侯世达是美国印第安纳大学文理学院认知科学杰出教授，主管概念和认知研究中心。他本人和他辅导的研究生组成“流体类推研究小组”。1977年，侯世达原本属于印第安纳大学的计算机科学系，然后他开始了自己的研究项目，研究心理活动的计算机建模（他原本称之为“人工智能研究”，不久就改称为“认知科学研究”）。1984年，侯世达受聘于密歇根大学，任心理学教授，同时负责人类认识研究。1988年，他回到印第安纳大学，任“文理学院教授”，参与认知科学和计算机科学两个学科，同时还是科学史和科学哲学、哲学、比较文学、心理学的兼职教授，当然侯世达本人表示他只是在名义上参与这些系科的工作。2009年4月，侯世达被选为美国文理科学院院士，并成为美国哲学会会员。\n侯世达曾说过他对“以计算机为中心的宅文化感到不适”。他承认“（他的受众中）很大一部分人是被技术吸引”，但提到他的成果“激励了很多学生开始计算机和人工智能方面的研究”时，他回应说尽管他对此感到高兴，但他本人“对计算机没有兴趣”。那次访谈中他谈到一门他在印第安纳大学教授过两次的课程，在那门课程中，他以“怀疑的眼光审视了众多广受赞誉的人工智能项目和整体的发展”。例如，就国际象棋选手卡斯帕罗夫被超级计算机深蓝击败一事，他评论说“这是历史性的转折，但和电脑变聪明了没有关系”。\n\n内容简介:\n集异璧－GEB，是数学家哥德尔、版画家艾舍尔、音乐家巴赫三个名字的前缀。《哥德尔、艾舍尔、巴赫书：集异璧之大成》是在英语世界中有极高评价的科普著作，曾获得普利策非小说奖。它通过对哥德尔的数理逻辑，艾舍尔的版画和巴赫的音乐三者的综合阐述，引人入胜地介绍了数理逻辑 学、可计算理 论、人工智能学、语言学、遗传学、音乐、绘画的理论等方面，构思精巧、含义深刻、视野广阔、富于哲学韵味。\n中译本前后费时十余年，译者都是数学和哲学的专家，还得到原作者的直接参与，译文严谨通达，特别是在原作者的帮助下，把西方的文化典故和说法，尽可能转换为中国文化的典故和说法，使这部译本甚至可看作是一部新的创作，也是中外翻译史上的一个创举。",
				"extra": "《哥德尔、艾舍尔、巴赫 - 集异璧之大成》;👩‍⚖️7683;🔟9.4 #Gödel, Escher, Bach: An Eternal Golden Braid;88.00 元;",
				"libraryCatalog": "Douban",
				"numPages": "1053",
				"publisher": "商务印书馆",
				"shortTitle": "《哥德尔、艾舍尔、巴赫》",
				"url": "https://book.douban.com/subject/1291204/",
				"attachments": [],
				"tags": [],
				"notes": [
					{
						"note": "<h1>#摘录-《哥德尔、艾舍尔、巴赫》目录</h1>\n\n        作者为中文版所写的前言<br>\n        译校者的话<br>\n        概览<br>\n        插图目示<br>\n        鸣谢<br>\n        上篇：集异璧 GEB<br>\n        导言 一首音乐--逻辑的奉献:三部创意曲<br>\n        第一章 wu谜题:二部创意曲<br>\n        第二章 数学中的意义与形式:无伴奏阿基里斯奏鸣曲<br>\n        第三章 图形与衬底:对位藏头诗<br>\n        第四章 一致性、完全性与几何学:和声小迷宫<br>\n        第五章 递归结构和递归过程:音程增值的卡农<br>\n        第六章 意义位于何处:半音阶幻想曲，及互格<br>\n        第七章 命题演算:螃蟹卡农<br>\n        第八章 印符数论:一首无的奉献<br>\n        第九章 无门与歌德尔<br>\n        下篇：异集璧 EGB<br>\n        前奏曲<br>\n        第十章 描述的层次和计算机系统:蚂蚁赋格<br>\n        第十一章 大脑和思维:英、法、德、中组曲<br>\n        第十二章 心智和思维:咏叹调及其种种变奏<br>\n        第十三章 bloop和floop和gloop:g弦上的咏叹调<br>\n        第十四章 论tnt及有关系统中形式上不可判定的命题:生日大合唱哇哇哇乌阿乌阿乌阿<br>\n        第十五章 跳出系统:一位烟民富于启发性的思想<br>\n        第十六章 自指和自复制:的确该赞美螃蟹<br>\n        第十七章 丘奇、图灵、塔斯基及别的人:施德鲁，人设计的玩具<br>\n        第十八章 人工智能：回顾:对实<br>\n        第十九章 人工智能：展望:树懒卡农<br>\n        第二十章 怪圈，或缠结的层次结构:六部无插入赋格<br>\n        注释<br>\n        文献目录<br>\n        索引<br>\n     · · · · · ·     (<a href=\"javascript:$('#dir_1291204_full').hide();$('#dir_1291204_short').show();void(0);\">收起</a>)\n"
					}
				],
				"seeAlso": []
			}
		]
	},
	{
		"type": "web",
		"url": "https://book.douban.com/subject/25807982/",
		"items": [
			{
				"itemType": "book",
				"title": "创新者的窘境（全新修订版）",
				"creators": [
					{
						"firstName": "[美]克莱顿",
						"lastName": "克里斯坦森",
						"creatorType": "author",
						"fieldMode": true
					},
					{
						"lastName": "胡建桥",
						"creatorType": "translator"
					}
				],
				"date": "2014-1-1",
				"ISBN": "9787508642802",
				"abstractNote": "作者简介:\n克莱顿•克里斯坦森：哈佛商学院教授，因其在企业创新方面的深入研究和独到见解，被尊称为“创新大师”。1997年，当《创新者的窘境》英文版出版时，克莱顿•克里斯坦森只是哈佛商学院的助理教授。而此书一出，就确立了他在创新技术管理领域的权威地位\n\n内容简介:\n全球商业领域中，许多企业曾叱咤风云，但面对市场变化及新技术的挑战，最终惨遭淘汰。究其原因，竟然是因为它们精于管理，信奉客户至上等传统商业观念。这就是所有企业如今都正面临的“创新者的窘境”。\n在《创新者的窘境》中，管理大师克里斯坦森指出，一些看似很完美的商业动作——对主流客户所需、赢利能力最强的产品进行精准投资和技术研发——最终却很可能毁掉一家优秀的企业。他分析了计算机、汽车、钢铁等多个行业的创新模式，发现正是那些暂时遭到主流客户拒绝的关键的、突破性的技术，逐渐演变成了主导新市场的“破坏性创新”。如果企业过于注重客户当下的需求，就会导致创新能力下降，从而无法开拓新市场，常常在不经意间与宝贵机遇失之交臂。而更灵活、更具创业精神的企业则能立足创新，把握产业增长的下一波浪潮。\n克里斯坦森根据大量企业的成败经验，提出将破坏性创新进行资本化运作的一系列规则——何时不应盲从客户，何时应投向性能较低、利润空间较小的产品，何时需舍弃看似规模更大、利润更高的市场，转而发展细分市场。《创新者的窘境》将助你预知即将来临的变化，在险象环生的商业竞争中实现基业长青。",
				"extra": "《创新者的窘境（全新修订版）》;👩‍⚖️1839;🔟8.5 #The Innovator&#39;s Dilemma: When New Technologies Cause Great Firms to Fail;48.00 元;",
				"libraryCatalog": "Douban",
				"numPages": "296",
				"publisher": "中信出版社",
				"shortTitle": "《创新者的窘境（全新修订版）》",
				"url": "https://book.douban.com/subject/25807982/",
				"attachments": [],
				"tags": [],
				"notes": [
					{
						"note": "<h1>#摘录-《创新者的窘境（全新修订版）》目录</h1>\n\n        引言<br>\n        第一部分 大企业为什么会失败<br>\n        第1章 大企业为什么会失败？从硬盘驱动器行业获得的启示<br>\n        硬盘驱动器的工作原理<br>\n        最早的硬盘驱动器的出现<br>\n        技术变革的影响<br>\n        延续性技术变革<br>\n        在破坏性技术创新来临时遭遇失败<br>\n        小结<br>\n        附件1.1<br>\n        注释<br>\n        第2章  价值网络和创新推动力<br>\n        从组织和管理上解释为什么企业会遭遇失败<br>\n        能力和突破性技术可能是一种解释<br>\n        价值网络和对导致失败的各种因素的新看法<br>\n        技术S形曲线和价值网络<br>\n        管理决策过程和破坏性技术变革<br>\n        闪存和价值网络<br>\n        价值网络体系对创新的意义<br>\n        注释<br>\n        第3章 机械挖掘机行业的破坏性技术变革<br>\n        在延续性技术变革中的领导地位<br>\n        破坏性液压技术的影响<br>\n        成熟挖掘机制造商为应对液压技术采取的措施<br>\n        在缆索与液压之间做出选择<br>\n        液压技术的崛起所产生的结果和影响<br>\n        注释<br>\n        第4章 回不去的低端市场<br>\n        硬盘驱动器行业的“右上方向大迁移”<br>\n        价值网络和典型的成本结构<br>\n        资源分配和向上迁移<br>\n        案例：1.8英寸硬盘驱动器<br>\n        价值网络和市场可预见性<br>\n        综合性钢铁企业的“右上角”移动<br>\n        小型钢铁厂薄板坯连铸技术<br>\n        注释<br>\n        第二部分 管理破坏性技术变革<br>\n        导言<br>\n        第5章  把开发破坏性技术的职责赋予存在客户需求的机构<br>\n        创新和资源分配<br>\n        开发破坏性硬盘驱动器技术的成功案例<br>\n        破坏性技术和资源依赖理论<br>\n        数字设备公司、IBM公司和个人电脑<br>\n        克雷斯吉公司、伍尔沃思公司和折扣零售<br>\n        自杀以求生存：惠普公司的激光喷射打印机和喷墨打印机<br>\n        注释<br>\n        第6章 如何使机构与市场的规模相匹配<br>\n        先锋企业是否真的时刻做好了准备<br>\n        企业规模和破坏性技术变革中的领先地位<br>\n        案例研究：推动新兴市场的增长率<br>\n        案例研究：等到市场发展到一定规模时再进入<br>\n        案例研究：让小机构去利用小机遇<br>\n        小结<br>\n        注释<br>\n        第7章 发现新兴市场<br>\n        对延续性技术和破坏性技术市场的预测<br>\n        为惠普公司的1.3英寸Kittyhawk硬盘驱动器寻找市场<br>\n        本田公司对北美摩托车行业的冲击<br>\n        英特尔公司是如何发现微处理器市场的<br>\n        成熟企业面临的不可预见性和向下游市场移动的难度<br>\n        注释<br>\n        第8章 如何评估机构的能力与缺陷<br>\n        机构能力框架<br>\n        流程与价值观的关系，以及如何成功应对延续性技术与破坏性技术<br>\n        能力的转移<br>\n        创造新能力应对变革<br>\n        小结<br>\n        注释<br>\n        第9章  产品性能、市场需求和生命周期<br>\n        性能过度供给和竞争基础的变化<br>\n        产品何时演变为商品<br>\n        性能过度供给和产品竞争的演变<br>\n        破坏性技术的其他普遍特征<br>\n        发生在会计软件市场的性能过度供给<br>\n        发生在胰岛素产品生命周期中的性能过度供给<br>\n        控制产品竞争的演变<br>\n        正确的战略和错误的战略<br>\n        注释<br>\n        第10章  管理破坏性技术变革：案例研究<br>\n        我们怎样才能判断出某项技术是否具有破坏性<br>\n        电动汽车的市场到底在哪儿<br>\n        我们应采取什么样的产品技术和经销策略<br>\n        什么样的机构最适合进行破坏性创新<br>\n        注释<br>\n        第11章 创新者的窘境：概要<br>\n        后记 创新者的窘境：阅读分类指南<br>\n        致谢<br>\n     · · · · · ·     (<a href=\"javascript:$('#dir_25807982_full').hide();$('#dir_25807982_short').show();void(0);\">收起</a>)\n"
					}
				],
				"seeAlso": []
			}
		]
	},
	{
		"type": "web",
		"url": "https://book.douban.com/subject/25817381/",
		"items": [
			{
				"itemType": "book",
				"title": "普林斯顿数学指南（第一卷）",
				"creators": [
					{
						"firstName": "[主编]",
						"lastName": "Timothy Gowers",
						"creatorType": "author",
						"fieldMode": true
					},
					{
						"lastName": "齐民友",
						"creatorType": "translator"
					}
				],
				"date": "2014-1",
				"ISBN": "9787030393210",
				"abstractNote": "作者简介:\n\n内容简介:\n《数学名著译丛：普林斯顿数学指南（第1卷）》是由Fields奖得主T.Gowers主编、133位著名数学家共同参与撰写的大型文集，全书由288篇长篇论文和短篇条目构成，目的是对20世纪最后一二十年纯粹数学的发展给出一个概览，以帮助青年数学家学习和研究其最活跃的部分，这些论文和条目都可以独立阅读，原书有八个部分，除第1部分是一个简短的引论、第Ⅷ部分是全书的“终曲”以外，全书分为三大板块，核心是第Ⅳ部分“数学的各个分支”，共26篇长文，介绍了20世纪最后一二十年纯粹数学研究中最重要的成果和最活跃的领域，第Ⅲ部分“数学概念”和第V部分“定理与问题”都是为它服务的短条目，第二个板块是数学的历史，由第Ⅱ部分“现代数学的起源”（共7篇长文）和第Ⅵ部分“数学家传记”（96位数学家的短篇传记）组成，第三个板块是数学的应用，即第Ⅶ部分“数学的影响”（14篇长文章）。作为全书“终曲”的第Ⅷ部分“结束语：一些看法”则是对青年数学家的建议等7篇文章。\n中译本分为三卷，第一卷包括第I-Ⅲ部分，第二卷即第Ⅳ部分，第三卷包括第V～Ⅷ部分。\n《数学名著译丛：普林斯顿数学指南（第1卷）》适合于高等院校本科生、研究生、教师和研究人员学习和参考。虽然主要是为了数学专业的师生写的，但是，具有大学数学基础知识，更重要的是对数学有兴趣的读者，都可以从本书得到很大的收获。",
				"extra": "《普林斯顿数学指南（第一卷）》;👩‍⚖️249;🔟9.4 #The Princeton Companion to Mathematics;128.00 元;",
				"libraryCatalog": "Douban",
				"numPages": "536",
				"publisher": "科学出版社",
				"series": "数学名著译丛",
				"shortTitle": "《普林斯顿数学指南（第一卷）》",
				"url": "https://book.douban.com/subject/25817381/",
				"attachments": [],
				"tags": [],
				"notes": [
					{
						"note": "<h1>#摘录-《普林斯顿数学指南（第一卷）》目录</h1>\n\n        译者序<br>\n        序<br>\n        撰稿人<br>\n        第1部分引论<br>\n        1数学是做什么的<br>\n        2数学的语言和语法<br>\n        3一些基本的数学定义<br>\n        4数学研究的一般目的<br>\n        第2部分现代数学的起源<br>\n        1从数到数系<br>\n        2几何学<br>\n        3抽象代数的发展<br>\n        4算法<br>\n        5数学分析的严格性的发展<br>\n        6证明的概念的发展<br>\n        7数学基础中的危机<br>\n        第3部分数学概念<br>\n        1选择公理<br>\n        2决定性公理<br>\n        3贝叶斯分析<br>\n        4辫群<br>\n        5厦<br>\n        6Calabi—Yau流形<br>\n        7基数<br>\n        8范畴<br>\n        9紧性与紧化<br>\n        10计算复杂性类<br>\n        11可数与不可数集合<br>\n        12C*—代数<br>\n        13曲率<br>\n        14设计<br>\n        15行列式<br>\n        16微分形式和积分<br>\n        17维<br>\n        18广义函数<br>\n        19对偶性<br>\n        20动力系统和混沌<br>\n        21椭圆曲线<br>\n        22欧几里得算法和连分数<br>\n        23欧拉方程和纳维一斯托克斯方程<br>\n        24伸展图<br>\n        25指数和对数函数<br>\n        26快速傅里叶变换<br>\n        27傅里叶变换<br>\n        28富克斯群<br>\n        29函数空间<br>\n        30伽罗瓦群<br>\n        31Gamma函数<br>\n        32生成函数<br>\n        33亏格<br>\n        34图<br>\n        35哈密顿函数<br>\n        36热方程<br>\n        37希尔伯特空间<br>\n        38同调与上同调<br>\n        39同伦群<br>\n        40理想类群<br>\n        41无理数和超越数<br>\n        42伊辛模型<br>\n        43约当法式<br>\n        44纽结多项式<br>\n        45K理论<br>\n        46利奇格网<br>\n        47L函数<br>\n        48李的理论<br>\n        49线性与非线性波以及孤子<br>\n        50线性算子及其性质<br>\n        5l数论中的局部与整体<br>\n        52芒德布罗集合<br>\n        53流形<br>\n        54拟阵<br>\n        55测度<br>\n        56度量空间<br>\n        57集合理论的模型<br>\n        58模算术<br>\n        59模形式<br>\n        60模空间<br>\n        61魔群<br>\n        62赋范空间与巴拿赫空间<br>\n        63数域<br>\n        64优化与拉格朗日乘子<br>\n        65轨道流形<br>\n        66序数<br>\n        67佩亚诺公理<br>\n        68置换群<br>\n        69相变<br>\n        70□<br>\n        71概率分布<br>\n        72射影空间<br>\n        73二次型<br>\n        74量子计算<br>\n        75量子群<br>\n        76四元数，八元数和赋范除法代数<br>\n        77表示<br>\n        78里奇流<br>\n        79黎曼曲面<br>\n        80黎曼□函数<br>\n        81环，理想与模<br>\n        82概型<br>\n        83薛定谔方程<br>\n        84单形算法<br>\n        85特殊函数<br>\n        86谱<br>\n        87球面调和<br>\n        88辛流形<br>\n        89张量积<br>\n        90拓扑空间<br>\n        91变换<br>\n        92三角函数<br>\n        93万有覆叠<br>\n        94变分法<br>\n        95簇<br>\n        96向量丛<br>\n        97冯·诺依曼代数<br>\n        98小波<br>\n        99策墨罗弗朗克尔公理<br>\n     · · · · · ·     (<a href=\"javascript:$('#dir_25817381_full').hide();$('#dir_25817381_short').show();void(0);\">收起</a>)\n"
					}
				],
				"seeAlso": []
			}
		]
	},
	{
		"type": "web",
		"url": "https://book.douban.com/subject/24862722/",
		"items": [
			{
				"itemType": "book",
				"title": "链接",
				"creators": [
					{
						"firstName": " 艾伯特-拉斯洛",
						"lastName": "巴拉巴西",
						"creatorType": "author",
						"fieldMode": true
					},
					{
						"lastName": "沈华伟",
						"creatorType": "translator"
					}
				],
				"date": "2013-8",
				"ISBN": "9787213056550",
				"abstractNote": "作者简介:\n[美]艾伯特-拉斯洛•巴拉巴西\n★全球复杂网络研究权威，“无尺度网络”创立者。美国物理学会荣誉会员，匈牙利科学院外籍院士，欧洲科学院院士。\n★美国东北大学教授，网络科学研究中心创始人兼主任，同时任职于哈佛大学医学院医学系，并担任丹那-法伯癌症研究所癌症系统生物学中心研究员。\n★提出无尺度网络模型，2006年因此荣获匈牙利计算机学会颁发的冯•诺依曼金质奖章；2008年获得美国国家科学院颁发的Cozzarelli奖章；2011年又荣获拉格朗日奖。\n★复杂网络界被引述最多的科学家。论文被引用总次数接近10万次，H-指数高达96。\n★世界著名科技杂志《科技新时代》（Popular Science）对他赞誉有加：“他可以控制世界”。\n\n内容简介:\n[内容简介]\n★《链接》是《爆发》的作者，艾伯特-拉斯洛•巴拉巴西的成名之作，同时也是复杂网络的奠基之作，社交网络的入门之作。巴拉巴西之前，随机网络理论一直主导者我们的网络思维，是巴拉巴西第一个证明了，我们不是生活在随机世界里，真实网络是无尺度的。\n★巴拉巴西在书中追溯了网络的数学起源，分析了社会学家在此基础上得出的研究成果，最后提出自己的观点：我们周围的复杂网络，从鸡尾酒会、恐怖组织、细胞网络、跨国公司到万维网，等等，所有这些网络都不是随机的，都可以用同一个稳健而普适的架构来刻画。这一发现为我们的网络研究提供了一个全新的视角。\n★虽然《链接》写于十年前，但这本书的精神到现在丝毫没有褪色。它带给了我们一种整体的、关联的、系统论的审视世界的方式，使我们不仅仅将视野局限于孤立的单元。广泛存在的链接是从简单到复杂、从单一到多样、从平凡到璀璨的桥梁。重温《链接》一书，领略科学家们在网络科学伊始对链接泛在性、数据复杂性、规律普适性的认识和思考，对我们在大数据时代抓住机遇、迎接挑战将大有裨益。\n★链接一书可以被视为复杂网络的基石，大数据时代的开端。\n[编辑推荐]\n★复杂网络研究权威 ，无尺度网络创立者，H-指数高达96的论文狂人，诺贝尔奖大热人选，超越《黑天鹅》的惊世之作《爆发》的作者艾伯特-拉斯洛•巴拉巴西经典力作\n★中科院计算所所长助理、中国科学院网络数据科学与技术重点实验室主任程学旗，电子科技大学教授、互联网科学中心主任周涛专文推荐。\n★巴拉巴西博士后，中科院计算所副研究员沈华伟打造唯一权威版本。\n★湛庐文化出品。",
				"extra": "《链接 - 商业、科学与生活的新思维(十周年纪念版)》;👩‍⚖️720;🔟8.2 #Linked: How Everything Is Connected to Everything Else and What It Means for Business, Science, and Everyday Life;59.90 元;",
				"libraryCatalog": "Douban",
				"numPages": "369",
				"publisher": "浙江人民出版社",
				"shortTitle": "《链接》",
				"url": "https://book.douban.com/subject/24862722/",
				"attachments": [],
				"tags": [],
				"notes": [
					{
						"note": "<h1>#摘录-《链接》目录</h1>\n\n        推荐序一链接，大数据之钥<br>\n        程学旗<br>\n        中科院计算所所长助理<br>\n        中科院网络数据科学与技术重点实验室主任<br>\n        推荐序二链接：泽万物以生机<br>\n        周涛<br>\n        电子科技大学教授<br>\n        互联网科学中心主任<br>\n        第1链 网络让世界变得不同<br>\n        让雅虎网站瘫痪的少年黑客<br>\n        谁在支配网络的结构与演化<br>\n        当还原论撞上复杂性<br>\n        探寻下一个大变革<br>\n        第一部分  复杂网络的起源<br>\n        第2链 随机宇宙<br>\n        欧拉的图论与哥尼斯堡七桥问题<br>\n        网络构造，理解复杂世界的关键<br>\n        只需30分钟，一个无形社会网络的形成<br>\n        世界是随机的吗<br>\n        寻找复杂网络背后的秩序<br>\n        第3链 六度分隔<br>\n        《链》与六度分隔的最早表述<br>\n        任意两个网页之间平均相隔19次点击<br>\n        对数让大网络缩小了<br>\n        六度，社会间隔的上限<br>\n        “小世界”，网络的普遍性质<br>\n        第4链小世界<br>\n        格兰诺维特与“弱关系的优势”<br>\n        趋同与聚团<br>\n        高度聚团的代价，消失的小世界<br>\n        抛弃随机世界观<br>\n        第二部分  复杂网络的本质<br>\n        第5链枢纽节点和连接者<br>\n        枢纽节点，颠覆“平等网络空间”<br>\n        贝肯数与埃尔德什数<br>\n        平均没有意义，多少不是关键<br>\n        重新思考网络<br>\n        第6链 幂律<br>\n        帕累托与80/20定律<br>\n        幂律，复杂网络背后的规律<br>\n        有序如何从无序中涌现<br>\n        从“随机”灌木丛到“自组织”舞台<br>\n        幂律无处不在<br>\n        第7链 富者愈富<br>\n        幂律为什么会出现<br>\n        生长机制，先发先至<br>\n        偏好连接，让强者愈强<br>\n        生长机制和偏好连接，支配真实网络的两大定律<br>\n        不断完善的无尺度网络理论<br>\n        第8链 爱因斯坦的馈赠<br>\n        为什么雅虎选择了谷歌<br>\n        新星效应打破先发先至<br>\n        适应度主导一切<br>\n        “适者愈富”与“胜者通吃”<br>\n        节点永远在为链接而竞争<br>\n        第9链 阿喀琉斯之踵<br>\n        美国西部大停电与互联导致的脆弱性<br>\n        有效的攻击：攻击枢纽节点<br>\n        丢失枢纽节点，网络变成碎片<br>\n        健壮性与脆弱性并存<br>\n        将对网络的认识转化为实践<br>\n        第三部分  复杂网络的影响<br>\n        第10链 病毒和时尚<br>\n        互联网，让一夜成名的梦想变为现实<br>\n        意见领袖的力量<br>\n        无尺度拓扑，病毒得以传播和存活的基础<br>\n        优先治疗枢纽节点，优先对付“毒王”<br>\n        社会网络的变化影响传播与扩散规律<br>\n        第11链 觉醒中的互联网<br>\n        保罗•巴兰与最优的抗击打系统<br>\n        将互不兼容的机器连起来——互联网的诞生<br>\n        人类创造的互联网有了自己的生命<br>\n        互联网中的“权力制衡”<br>\n        寄生计算，让所有的计算机都为你工作<br>\n        第12链 分裂的万维网<br>\n        万维网的结构影响一切最多不一定最好万维网上的四块“大陆”代码与架构不断扩大的互联网黑洞<br>\n        第13链 生命的地图<br>\n        寻找“躁郁症”基因的竞赛<br>\n        破译人类基因组，打造生命之书<br>\n        细胞网络的无尺度拓扑，少数分子参与多数反应<br>\n        个性化药物瞄准问题细胞<br>\n        网络思维引发生物学大变革<br>\n        第14链 网络新经济<br>\n        AOL吞并时代华纳<br>\n        公司网络，从树形结构到网状结构<br>\n        复杂董事网络中的完美“内部人士”<br>\n        市场，带权有向网络<br>\n        商业模式的转变，互联网带来的真正财富<br>\n        第15链 一张没有蜘蛛的网<br>\n        网络研究的冒险之旅网络理论，描述互联互通世界的新语言开启复杂性科学的世纪<br>\n        后记 复杂网络的未来 299<br>\n        一场范式变革应对多任务模块化，补上无尺度网络缺失的一链何时才能驯服复杂性<br>\n        注释<br>\n        译者后记<br>\n     · · · · · ·     (<a href=\"javascript:$('#dir_24862722_full').hide();$('#dir_24862722_short').show();void(0);\">收起</a>)\n"
					}
				],
				"seeAlso": []
			}
		]
	},
	{
		"type": "web",
		"url": "https://book.douban.com/subject/4606471/",
		"items": [
			{
				"itemType": "book",
				"title": "设计心理学",
				"creators": [
					{
						"firstName": "[美]唐纳德·A",
						"lastName": "诺曼",
						"creatorType": "author",
						"fieldMode": true
					},
					{
						"lastName": "梅琼",
						"creatorType": "translator"
					}
				],
				"date": "2010-03",
				"ISBN": "9787508619156",
				"abstractNote": "作者简介:\n唐纳德·A·诺曼 (Donald Arthur Norman)\n美国认知心理学家、计算机工程师、工业设计家，认知科学学会的发起人之一。现为美国西北大学计算机科学系和心理学教授，是尼而森-诺曼集团 (Nielsen Norman Group) 咨询公司的创办人之一，苹果计算机公司先进技术部副总裁。\n1999年，Upside杂志提名诺曼博士为世界100精英之一。2002年，诺曼获得了由人机交互专家协会 (SIGCHI) 授予的终身成就奖。\n作为一个以人为中心的设计的倡导者，诺曼最著名的书就是《设计心理学》。\n\n内容简介:\n诺曼博士用诙谐的语言讲述了许多我们日常生活中常常会遇到的挫折和危险，帮我们找到了这些问题的关键，即产品设计忽略了使用者在一定情境中的真实需求，甚至违背了认知学原理。诺曼博士本书中强调以使用者为中心的设计哲学，提醒消费者在挑选的物品，必须要方便好用，易于理解，希望设计师在注重设计美感的同时，不要忽略设计的一些必要因素，因为对于产品设计来说，安全好用永远是竞争的关键。",
				"extra": "《设计心理学》;👩‍⚖️3114;🔟8.2 #The Design of Everyday Things;30.00 元;",
				"libraryCatalog": "Douban",
				"numPages": "271",
				"publisher": "中信出版社",
				"series": "设计心理学",
				"shortTitle": "《设计心理学》",
				"url": "https://book.douban.com/subject/4606471/",
				"attachments": [],
				"tags": [],
				"notes": [
					{
						"note": "<h1>#摘录-《设计心理学》目录</h1>\n\n        推荐序一：设计是无言的服务<br>\n        推荐序二：“小”是一种更伟大的关怀<br>\n        新版序<br>\n        初版序<br>\n        第一章 日用品中的设计问题<br>\n        要想弄明白操作方法，你需要获得工程学学位<br>\n        日常生活中的烦恼<br>\n        日用品心理学<br>\n        易理解性和易使用性的设计原则<br>\n        可怜的设计人员<br>\n        技术进步带来的矛盾<br>\n        注释<br>\n        第二章 日常操作心理学<br>\n        替设计人员代过<br>\n        日常生活中的错误观念<br>\n        找错怪罪对象<br>\n        人类思考和解释的本质<br>\n        采取行动的七个阶段<br>\n        执行和评估之间的差距<br>\n        行动的七阶段分析法<br>\n        注释<br>\n        第三章 头脑中的知识与外界知识<br>\n        行为的精确性与知识的不精确性<br>\n        记忆是储存在头脑中的知识<br>\n        记忆也是储存于外界的知识<br>\n        外界知识和头脑中知识之间的权衡<br>\n        注释<br>\n        第四章 知道要做什么<br>\n        常用限制因素的类别<br>\n        预设用途和限制因素的应用<br>\n        可视性和反馈<br>\n        注释<br>\n        第五章 人非圣贤，孰能无过<br>\n        失误<br>\n        错误<br>\n        日常活动的结构<br>\n        有意识行为和下意识行为<br>\n        与差错相关的设计原则<br>\n        设计哲学<br>\n        注释<br>\n        第六章 设计中的挑战<br>\n        设计的自然演进<br>\n        设计人员为何误入歧途<br>\n        设计过程的复杂性<br>\n        水龙头：设计中所遇到的种种难题<br>\n        设计人员的两大致命诱惑<br>\n        注释<br>\n        第七章 以用户为中心的设计<br>\n        化繁为简的七个原则<br>\n        故意增加操作难度<br>\n        设计的社会功能<br>\n        日用品的设计<br>\n        注释<br>\n     · · · · · ·     (<a href=\"javascript:$('#dir_4606471_full').hide();$('#dir_4606471_short').show();void(0);\">收起</a>)\n"
					}
				],
				"seeAlso": []
			}
		]
	},
	{
		"type": "web",
		"url": "https://book.douban.com/subject/21294724/",
		"items": [
			{
				"itemType": "book",
				"title": "人格解码",
				"creators": [
					{
						"firstName": "[美]塞缪尔",
						"lastName": "巴伦德斯",
						"creatorType": "author",
						"fieldMode": true
					},
					{
						"lastName": "陶红梅 译",
						"creatorType": "translator"
					},
					{
						"lastName": "许燕 校",
						"creatorType": "translator"
					}
				],
				"date": "2013-2",
				"ISBN": "9787100096966",
				"abstractNote": "作者简介:\n作者简介\n塞缪尔•巴伦德斯（Samuel Barondes）：美国加利福尼亚大学心理学教授，神经生物和心理治疗中心主任，前美国国家心理健康研究学院科学顾问董事会主席，国际知名的精神病专家和神经科学家。他先后就学、受训、任职于哥伦比亚大学、哈佛大学以及美国国家健康研究院，发表了200余篇研究论文，获得过多项荣誉，是医学协会、美国艺术和科学学术研究会成员。除了研究性著作之外，巴伦德斯还为大众写了三部有关心理治疗方面的读物：《分子和心理疾病》、《情绪基因》、《胜过百忧解》。他和妻子Louann Brizendine现住在加利福尼亚的索萨利托。\n\n内容简介:\n《人格解码》是由著名的精神病专家和神经科学家塞缪尔·巴伦德斯为普通读者撰写的人格读本，它为我们提供了有效解读一个人的简洁途径。《人格解码》介绍如何运用当代心理学最为著名的“大五”人格模型、“十大”人格类型，以及伦理学的“六大”品格特性，科学而又深刻地剖析你想要了解的一个人的人格特质和类型，快速而又准确地读懂一个人。《人格解码》中贯穿了对克林顿、奥巴马、奥普拉、乔布斯、伯格扎克、富兰克林等名人人格的分析，不仅为我们提供了生动的范例，同时也使我们从科学心理学的视角，更为深入地了解这些名人。",
				"extra": "《人格解码》;👩‍⚖️209;🔟7.4 #Making Sense of People: Decoding the Mysteries of Personality;35.00 元;",
				"libraryCatalog": "Douban",
				"numPages": "226",
				"publisher": "商务印书馆",
				"series": "新曲线·心理学丛书",
				"shortTitle": "《人格解码》",
				"url": "https://book.douban.com/subject/21294724/",
				"attachments": [],
				"tags": [],
				"notes": [
					{
						"note": "<h1>#摘录-《人格解码》目录</h1>\n\n        详细目录<br>\n        导　言／13<br>\n        第一部分　描述人格差异<br>\n        1　人格特质／21<br>\n        当我们用“大五”人格来分析奥巴马和克林顿时，你会发现他们有哪些不同呢？你如何判断奥巴马和克林顿在外向性、自信心和活力等方面的不同？<br>\n        2　有问题的人格类型／49<br>\n        玛丽莲•梦露曾自述小时候有过想在教堂脱光自己衣服的冲动：“我非常想赤裸着身体站在神和其他人面前让他们看到我，我只得咬紧牙关，抑制住我的冲动：“我非常想赤裸着身体站在神和其他人面前让他们看到我，我只得咬紧牙关，抑制住我的冲动，这样才不致于去脱光衣服。”你知道在她身上到底发生了什么吗？<br>\n        第二部分　解释人格差异<br>\n        3　基因如何使我们各不相同／85<br>\n        人类心理上的差异反映了各种自然选择力量之间的冲突，进化是令人敬畏的，“如此看待生命，生命是壮观的……从如此简单的形势开始，不断进化成或正在进化成绝无仅有的最美丽和最精彩的生命。”<br>\n        4　发展个性化的大脑／113<br>\n        每一个大脑，就如同每张脸，都有它自身特有的构建计划。在每个人的大脑中都有其独特人格和根深蒂固的成分，它们继续指引着我们的余生。<br>\n        第三部分　整个人，整个生命<br>\n        5　什么是好品格／145<br>\n        我们对人的认识不全都是客观的，当我们第一次遇到他人时，我们不会只注意到他们的“大五”人格特质，而同时会对他们的品格形成一种本能的印象。你知道有哪些好品格吗？<br>\n        6　同一性：编织个人故事／173<br>\n        我们每个人都会编织自己的故事，随着同一性的形成，一些重要的记忆就无意识地被修改，以便于我们的内在自我形象保持一致。美国著名的节目主持人奥普拉的故事，是一个天赋战胜贫穷、虐待、种族歧视和青少年期所犯错误的一个典型例子，是雄心壮志带来成功机会的故事……而乔布斯的故事告诉我们他“求知若渴，虚心若愚”。<br>\n        7　一幅整合的画面／195<br>\n        特质、才能、价值观、环境和运气构成了我们的故事，我们可以在每个人的人格全景中看到每个组成部分的重要作用。为了整合这幅画面，我们要：记住我们共同的人性和人格发展的共同方式，形成一个“大五”人格轮廓，寻找潜在的问题类型，进行道德评价，聆听一个人的故事<br>\n     · · · · · ·     (<a href=\"javascript:$('#dir_21294724_full').hide();$('#dir_21294724_short').show();void(0);\">收起</a>)\n"
					}
				],
				"seeAlso": []
			}
		]
	},
	{
		"type": "web",
		"url": "https://book.douban.com/subject/4864832/",
		"items": [
			{
				"itemType": "book",
				"title": "为什么学生不喜欢上学?",
				"creators": [
					{
						"firstName": "[美]Daniel T",
						"lastName": " Willingham",
						"creatorType": "author",
						"fieldMode": true
					},
					{
						"lastName": "赵萌",
						"creatorType": "translator"
					},
					{
						"lastName": "朱永新(审校)",
						"creatorType": "translator"
					}
				],
				"date": "2010-5",
				"ISBN": "9787534396533",
				"abstractNote": "作者简介:\n丹尼尔·T威林厄姆\n1983年于杜克大学获得心理学本科学位，1990年于哈佛大学获得认知心理学博士学位，1992年至今在美国弗吉尼亚大学任心理学教授。2000年之前，其研究主要关注以大脑为基础的学习和记忆方面；2000年至今，其研究主要围绕认知心理学在基础教育方面的应 用。威林厄姆还为《美国教育家》杂志撰写《向认知科学家提问》专栏，其个人网站地址为：http://www.danielwillingham.com。\n\n内容简介:\n本书是美国弗吉尼亚大学心理学教授威林厄姆的重要著作，是一本深受学生和教师欢迎的教育心理学著作。他用认知心理学的原理，详细分析了学生学习的过程和教师在课堂教学中必须注意的一些问题。书中每一章都运用了一个认知心理学的基本原理，如“事实性的知识先于技能”、“记忆是思考的残留物”、“我们在已知的环境中理解新的事物”、“儿童在学习方面更多的是相似而不是不同”、“教学技能可以通过练习而提高”等等。\n本书是一本关于认知心理学的普及读物，也是一本教育心理学的入门书籍。书中的许多观点新颖而深刻。如开篇伊始关于大脑的作用的分析，作者认为，大脑不是用来思考的，它的真正作用在于使你避免思考。虽然人类生来就具有好奇心，但是我们不是天生的杰出思想者，除非认知环境符合一定的要求，否则我们会尽可能地避免思考。作者指出，学生是否喜欢学校，在很大程度上取决于学校能否持续地让学生体验到解决问题的愉悦感。",
				"extra": "《为什么学生不喜欢上学?》;👩‍⚖️4016;🔟9.3 #Why Don&#39;t Students Like School?: A Cognitive Scientist Answers Questions About How the Mind Works and What It Means for the Classroom;26.00 元;",
				"libraryCatalog": "Douban",
				"numPages": "168",
				"publisher": "江苏教育出版社",
				"shortTitle": "《为什么学生不喜欢上学?》",
				"url": "https://book.douban.com/subject/4864832/",
				"attachments": [],
				"tags": [],
				"notes": [
					{
						"note": "<h1>#摘录-《为什么学生不喜欢上学?》目录</h1>\n\n        序<br>\n        中文版序<br>\n        致谢<br>\n        导言<br>\n        Chapter1 为什么学生不喜欢上学？<br>\n        大脑不是用来思考的<br>\n        好奇心是与生俱来的，但它很脆弱<br>\n        我们是如何思考的<br>\n        对课堂的启示<br>\n        Chapter2 教师应如何教授学生所需的技巧？<br>\n        背景知识对阅读理解来说必不可少<br>\n        背景知识对于认知能力的必要性<br>\n        事实性知识可以增强记忆<br>\n        对课堂的启示<br>\n        Chapter3 为什么学生能记住电视里的所有细节，却记不住<br>\n        我们告诉他的任何知识？<br>\n        记忆的重要性<br>\n        好教师的共性<br>\n        故事的效用<br>\n        故事结构的实际应用<br>\n        无意义的情况<br>\n        对课堂的启示<br>\n        Chapter4 为什么让学生理解抽象概念这么难？<br>\n        理解其实是记忆<br>\n        为什么知识是浅表的<br>\n        为什么知识不能迁移<br>\n        对课堂的启示<br>\n        Chapter5 题海战术有用吗？<br>\n        练习是为了日后更好地学习<br>\n        练习使记忆更长久<br>\n        练习促进知识的迁移<br>\n        对课堂的启示<br>\n        Chapter6 让学生像真正的学者一样思考的秘诀是什么？<br>\n        科学家、数学家和其他专业人士如何思考<br>\n        专家的“工具箱”里有些什么<br>\n        如何让学生像专家一样思考<br>\n        对课堂的启示<br>\n        Chapter7 我们该如何因材施教？<br>\n        风格和能力<br>\n        认知风格<br>\n        视觉／听觉／运动知觉型的学习者<br>\n        能力和多元智能<br>\n        小结<br>\n        对课堂的启示<br>\n        Chapter8 怎样帮助“慢热型”学生？<br>\n        什么使人聪明<br>\n        对于智能，态度很重要<br>\n        对课堂的启示<br>\n        Chapter9 那么教师呢？<br>\n        作为认知技能的教学<br>\n        练习的重要性<br>\n        获得、给出反馈意见的方法<br>\n        有意识地提高：自我管理<br>\n        小步前进<br>\n        结语<br>\n        译后记<br>\n     · · · · · ·     (<a href=\"javascript:$('#dir_4864832_full').hide();$('#dir_4864832_short').show();void(0);\">收起</a>)\n"
					}
				],
				"seeAlso": []
			}
		]
	},
	{
		"type": "web",
		"url": "https://book.douban.com/subject/1451400/",
		"items": [
			{
				"itemType": "book",
				"title": "风格的要素",
				"creators": [
					{
						"firstName": "[美]威廉",
						"lastName": "斯特伦克",
						"creatorType": "author",
						"fieldMode": true
					},
					{
						"firstName": "[美]",
						"lastName": "",
						"creatorType": "author",
						"fieldMode": true
					},
					{
						"lastName": "陈玮",
						"creatorType": "translator"
					},
					{
						"lastName": "崔长青 校",
						"creatorType": "translator"
					}
				],
				"date": "2009.1",
				"ISBN": "9787801096418",
				"abstractNote": "作者简介:\n威廉·斯特伦克是著名的康奈尔大学英语系教授，英语语法和写作文法方面的专家。《风格的要素》是作者在1918年完成的，从那时起本书就成为英文写作方面的经典必读书，几乎每个美国人人手一册。\n\n内容简介:\n《风格的要素(全新修订版)(中英对照版)》在中国赴美国的留学生中享有广泛的声誉，经过口口相传，几乎成了每一个出国留学者必备的英文写作指南。一个人必须首先了解规则才能够去打破它。这本经典的指导书是每个学生和写作者的必读之书。《风格的要素(全新修订版)(中英对照版)》以简短的篇幅阐明了英文朴实风格必须具备的基本原则，集中阐释了英语文法应用、写作技巧以及一般人在写作中常犯的错误等。",
				"extra": "《风格的要素》;👩‍⚖️714;🔟8.1 #The Elements of Style;20.00 元;",
				"libraryCatalog": "Douban",
				"numPages": "251",
				"publisher": "中央编译出版社",
				"shortTitle": "《风格的要素》",
				"url": "https://book.douban.com/subject/1451400/",
				"attachments": [],
				"tags": [],
				"notes": [],
				"seeAlso": []
			}
		]
	},
	{
		"type": "web",
		"url": "https://book.douban.com/subject/25963469/",
		"items": [
			{
				"itemType": "book",
				"title": "好好讲道理",
				"creators": [
					{
						"firstName": "[美]T",
						"lastName": "爱德华•戴默",
						"creatorType": "author",
						"fieldMode": true
					},
					{
						"lastName": "刀尔登",
						"creatorType": "translator"
					},
					{
						"lastName": "黄琳",
						"creatorType": "translator"
					}
				],
				"date": "2014-8",
				"ISBN": "9787308133517",
				"abstractNote": "作者简介:\nT.爱德华•戴默，作家，美国哲学教授。作为成绩卓著的高校教授，被授予James A. David Faculty Recognition奖项。\n译者\n刀尔登，“海内中文网才气第一”“我们时代少有的好作者”“奇才”“当代大隐”“鲁迅、王小波后，最出色的文章高手”……时人往往这样形容刀尔登。其著作有《中国好人》《七日谈：字母表，以及希里花斯人的合理生活》。\n\n内容简介:\n应对蛮不讲理者的60种逻辑学策略\n为什么要讲理？为什么希望别人也讲理？有这么几个实际的理由。\n第一，也是最重要的一点，是好的论证使我们更好地做出自己的决定。那些在生活的方方面面都有理有据的人，无论是实现目标还是完成计划，成功的机会更大。\n第二，遇到艰难的道德选择，好的论证起的作用尤为重要，它不仅帮助我们决定采取什么样的行动，还使我们避开有不良后果的行为。\n第三，好的论证，使我们更愿意只遵从那些我们有充分理由信其为真的、牢固的观念。如果我们要求自己是个讲道理的人，我们就该加强现有的信念，或暴露其不足，以便取舍。\n第四，运用好的论证，还能提升我们在社交、工作及个人事务中思考和行动的水准。要想让别人接受你的某个观点，讲道理通常要比吓唬人、讨好人等办法更有效，至少效果更长远些。\n最后一点，要解决人与人之间的争执，平息冲突，把注意力放到道理上来，是个有效的办法。注意到对方论证中的哪怕一丝道理，我们才能替自己找到更好的立场。\n本书能够帮助你：\n1.更好地应对胡搅蛮缠的妻子或丈夫、蛮不讲理的老板、喜欢抬杠的同事\n2.在交谈中驳回对方的诡辩\n3.提高思维能力，解决实际思维中的逻辑错误\n4.使你的推理更正确、表达更清晰\n5.找出解决问题的方法所在",
				"extra": "《好好讲道理 - 反击谬误的逻辑学训练》;👩‍⚖️616;🔟8.2 #Attacking Faulty Reasoning: A Practical Guide to Fallacy-Free Arguments;48.00 元;",
				"libraryCatalog": "Douban",
				"numPages": "416",
				"publisher": "浙江大学出版社",
				"shortTitle": "《好好讲道理》",
				"url": "https://book.douban.com/subject/25963469/",
				"attachments": [],
				"tags": [],
				"notes": [
					{
						"note": "<h1>#摘录-《好好讲道理》目录</h1>\n\n        引言<br>\n        <br>\n        第一章\t智识行为规范<br>\n        程序标准<br>\n        伦理标准<br>\n        形成自己智识风格的原则<br>\n        1. 或谬原则<br>\n        2. 求真原则<br>\n        3. 清晰原则<br>\n        练习<br>\n        第二章  什么是论证<br>\n        论点即其他论断所支持的论断<br>\n        区分论点和意见<br>\n        4.举证原则<br>\n        论证的标准形式<br>\n        5.宽容原则<br>\n        演绎论证Vs 归纳论证<br>\n        规范性论证的演绎本质<br>\n        道德论证<br>\n        法律论证<br>\n        审美论证<br>\n        练习<br>\n        第三章  什么是好的论证<br>\n        好论证须符合五个标准<br>\n        6.结构原则<br>\n        7.相关原则<br>\n        8.接受原则<br>\n        前提的可接受标准<br>\n        前提不可接受的条件<br>\n        9.充分原则<br>\n        10.辩驳原则<br>\n        改善你的论证<br>\n        运用论证的规范<br>\n        11.延迟判断原则<br>\n        12.终结原则<br>\n        练习<br>\n        第四章  什么是谬误<br>\n        关于谬误的理论<br>\n        有名称的谬误VS未命名的谬误<br>\n        谬误的结构<br>\n        回击谬误<br>\n        自毁论证<br>\n        荒谬反证<br>\n        反证方式<br>\n        谬误游戏规则<br>\n        练习<br>\n        第五章  违反结构原则的谬误<br>\n        6.结构原则<br>\n        不当前提的谬误<br>\n        丐题谬误<br>\n        •回击谬误<br>\n        复合提问谬误<br>\n        •回击谬误<br>\n        丐题定义谬误<br>\n        •回击谬误<br>\n        前提不兼容的谬误<br>\n        •回击谬误<br>\n        前提和结论矛盾的谬误<br>\n        •回击谬误<br>\n        规范性前提不明的谬误<br>\n        •回击谬误<br>\n        练习<br>\n        <br>\n        演绎推理的谬误<br>\n        条件推理<br>\n        否定前件<br>\n        •回击谬误<br>\n        肯定后件<br>\n        •回击谬误<br>\n        三段论推理<br>\n        中词不周延的谬误<br>\n        •回击谬误<br>\n        端项周延不当的谬误<br>\n        •回击谬误<br>\n        不当换位<br>\n        •回击谬误<br>\n        练习<br>\n        第六章  违反相关原则的谬误<br>\n        7.相关原则<br>\n        无关前提的谬误<br>\n        起源谬误<br>\n        •回击谬误<br>\n        合理化谬误<br>\n        •回击谬误<br>\n        得出错误结论<br>\n        •回击谬误<br>\n        使用理由不当<br>\n        •回击谬误<br>\n        作业<br>\n        <br>\n        诉诸不当的谬误<br>\n        诉诸不当权威<br>\n        •回击谬误<br>\n        诉诸公议<br>\n        •回击谬误<br>\n        诉诸强力或威胁<br>\n        •回击谬误<br>\n        诉诸传统<br>\n        •回击谬误<br>\n        诉诸自利<br>\n        •回击谬误<br>\n        操纵情绪<br>\n        •回击谬误<br>\n        练习<br>\n        第七章  违反接受原则的谬误<br>\n        8.接受原则<br>\n        语义混乱的谬误<br>\n        模凌两可<br>\n        •回击谬误<br>\n        暧昧<br>\n        •破解谬误<br>\n        强调误导<br>\n        •回击谬误<br>\n        不当反推<br>\n        •回击谬误<br>\n        滥用模糊<br>\n        •回击谬误<br>\n        貌异实同<br>\n        •回击谬误<br>\n        练习<br>\n        无理预设的谬误<br>\n        后来居上<br>\n        •回击谬误<br>\n        连续体谬误<br>\n        •回击谬误<br>\n        合成谬误<br>\n        •回击谬误<br>\n        分割谬误<br>\n        •回击谬误<br>\n        非此即彼<br>\n        •回击谬误<br>\n        实然/应然之谬<br>\n        •回击谬误<br>\n        一厢情愿<br>\n        •回击谬误<br>\n        拒绝例外<br>\n        •回击谬误<br>\n        折衷谬误<br>\n        •回击谬误<br>\n        不当类比<br>\n        •回击谬误<br>\n        练习<br>\n        第八章  违反充分原则的谬误<br>\n        9.充分原则<br>\n        缺失证据的谬误<br>\n        样本不充分<br>\n        •回击谬误<br>\n        数据不具代表性<br>\n        •回击谬误<br>\n        诉诸无知<br>\n        •回击谬误<br>\n        罔顾事实的假设<br>\n        •回击谬误<br>\n        诉诸俗见<br>\n        •回击谬误<br>\n        片面辩护<br>\n        •回击谬误<br>\n        漏失关键证据<br>\n        •回击谬误<br>\n        练习<br>\n        因果谬误<br>\n        混淆充分与必要条件<br>\n        •回击谬误<br>\n        因果关系简单化<br>\n        •回击谬误<br>\n        后此谬误<br>\n        •回击谬误<br>\n        混淆因果关系<br>\n        •回击谬误<br>\n        忽视共同原因<br>\n        •回击谬误<br>\n        多米诺谬误（滑坡谬误）<br>\n        •回击谬误<br>\n        赌徒谬误<br>\n        •回击谬误<br>\n        练习<br>\n        第九章 违反辩驳原则的谬误<br>\n        10.辩驳原则<br>\n        有关反证的谬误<br>\n        否认反证<br>\n        •回击谬误<br>\n        忽略反证<br>\n        •回击谬误<br>\n        毛举细故<br>\n        •回击谬误<br>\n        练习<br>\n        诉诸人格的谬误<br>\n        人身攻击<br>\n        •回击谬误<br>\n        投毒于井<br>\n        •回击谬误<br>\n        彼此彼此<br>\n        •回击谬误<br>\n        练习<br>\n        转移焦点的谬误<br>\n        攻击稻草人<br>\n        •回击谬误<br>\n        红鲱鱼<br>\n        •回击谬误<br>\n        笑而不答<br>\n        •回击谬误<br>\n        练习<br>\n        第十章  如何写议论文<br>\n        研究问题<br>\n        陈述你的立场<br>\n        论证你的立场<br>\n        驳斥对立观点<br>\n        解决问题<br>\n        议论文样本<br>\n        练习<br>\n        译名表<br>\n        部分练习答案<br>\n     · · · · · ·     (<a href=\"javascript:$('#dir_25963469_full').hide();$('#dir_25963469_short').show();void(0);\">收起</a>)\n"
					}
				],
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
		"url": "https://book.douban.com/tag/%E8%AE%A4%E7%9F%A5%E5%BF%83%E7%90%86%E5%AD%A6?type=S",
		"items": "multiple"
	}
]
/** END TEST CASES **/
