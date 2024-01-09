{
	"translatorID": "fc353b26-8911-4c34-9196-f6f567c93901",
	"label": "Douban",
	"creator": "不是船长<tanguangzhi@foxmail.com>, Ace Strong<acestrong@gmail.com>, Zeping Lee",
	"target": "^https?://\\w+\\.douban\\.com",
	"minVersion": "2.0rc1",
	"maxVersion": "",
	"priority": 100,
	"inRepository": true,
	"translatorType": 4,
	"browserSupport": "gcsibv",
	"lastUpdated": "2024-01-09 05:07:21"
}

/*
	***** BEGIN LICENSE BLOCK *****

	Copyright © 2009-2022 Tao Cheng, Zeping Lee

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

const typeMap = {
	'book.douban.com/subject': 'book',
	'movie.douban.com/subject': 'film',
	'music.douban.com/subject': 'audioRecording',
	'read.douban.com/ebook': 'book'
};

function detectWeb(doc, url) {
	Z.debug('---------- Douban 2024-01-09 11:22:42 ----------');
	let typeKey = Object.keys(typeMap).find(key => new RegExp(`${key}/\\d+/`).test(url));
	if (typeKey) {
		return typeMap[typeKey];
	}
	else if (getSearchResults(doc, true)) {
		return 'multiple';
	}
	return false;
}

function getSearchResults(doc, checkOnly) {
	var items = {};
	var found = false;
	// h2见于read.douban.com/ebook
	// td > .pl2见于music.douban.com/top250
	var rows = Array.from(doc.querySelectorAll('.title > a, h2 > a, td > .pl2 > a, a.album-title')).filter(row => Object.keys(typeMap).some(key => new RegExp(`${key}/\\d+/`).test(row.href))
	);
	for (let row of rows) {
		let href = row.href;
		let title = ZU.trimInternal(row.textContent);
		if (!href || !title) continue;
		if (checkOnly) return true;
		found = true;
		items[href] = title;
	}
	return found ? items : false;
}

async function doWeb(doc, url) {
	if (detectWeb(doc, url) == 'multiple') {
		let items = await Zotero.selectItems(getSearchResults(doc, false));
		if (!items) return;
		for (let url of Object.keys(items)) {
			await scrape(await requestDocument(url));
		}
	}
	else {
		await scrape(doc, url);
	}
}

async function scrape(doc, url = doc.location.href) {
	var newItem = new Z.Item(detectWeb(doc, url));
	newItem.extra = '';
	var creators = [];
	const isRead = url.includes('read.douban.com/ebook');
	// .article-meta for read
	var labels = isRead
		? new Labels(doc, '.article-meta > p')
		: new TextLabels(doc, '#info');
	Z.debug(isRead ? labels.innerData.map(arr => [arr[0], arr[1].innerText]) : labels.innerData);
	var title = ZU.trimInternal(text(doc, 'h1'));
	switch (newItem.itemType) {
		case 'book': {
			Z.debug('this is a book');
			if (title.match(/[(（].*第.*?(?:版|卷)[)）]$/)) {
				newItem.title = tryMatch(title, /(.+)\s*[(（].*第.*?(?:版|卷)[)）]/, 1);
				newItem.edition = toArabicNum(tryMatch(title, /[(（].*第(.*?)版[)）]/, 1));
				newItem.volume = toArabicNum(tryMatch(title, /[(（].*第(.*?)卷[)）]/, 1));
			}
			else {
				newItem.title = title;
			}
			let subtitle = labels.getWith('副标题');
			if (subtitle) {
				newItem.shortTitle = newItem.title;
				newItem.title = `${newItem.title}${/[\u4e00-\u9fff]/.test(newItem.title) ? '：' : ': '}${subtitle}`;
			}
			// https://book.douban.com/subject/21294724/
			newItem.abstractNote = text(doc, '#link-report .hidden .intro') || text(doc, '#link-report .intro');
			newItem.series = labels.getWith('丛书');
			newItem.publisher = isRead
				? labels.getWith('出版社').split(' / ')[0]
				: labels.getWith('出版社');
			// https://book.douban.com/subject/1451400/
			newItem.date = isRead
				? tryMatch(labels.getWith('出版社'), /[\d.-]+/)
				: labels.getWith('出版年').replace(/\./g, '-');
			newItem.numPages = labels.getWith('页数');
			newItem.ISBN = labels.getWith('ISBN');
			newItem.shortTitle = tryMatch(newItem.title, /[:：] (.+)$/, 1);
			let authors = isRead
				? Array.from(labels.getWith('作者', true).querySelectorAll('.author-item'))
					.map(creator => processName(ZU.trimInternal(creator.textContent), 'author'))
				: labels.getWith('作者').split(' / ')
					.map(creator => processName(creator, 'author'));
			let translators = isRead
				? Array.from(labels.getWith('译者', true).querySelectorAll('.author-item'))
					.map(translator => processName(ZU.trimInternal(translator.textContent), 'translator'))
				: labels.getWith('译者').split(' / ')
					.map(translator => processName(translator, 'translator'));
			creators = [...authors, ...translators];
			// 仅在read中有效
			doc.querySelectorAll('.tags a > span:first-child').forEach((tag) => {
				newItem.tags.push(tag.innerText);
			});
			let contents = doc.querySelector('[id*="dir_"][id*="_full"], .table-of-contents');
			if (contents) {
				newItem.notes.push(`<h1>《${newItem.title}》 - 目录</h1>` + contents.innerHTML.replace(/ · · · [\s\S]*$/, '').replace(/展开全部$/, ''));
			}
			// https://book.douban.com/subject/26604008/
			newItem.extra += addExtra('original-title', labels.getWith('原作名'));
			newItem.extra += addExtra('price', labels.getWith('定价'));
			break;
		}
		case 'film': {
			Z.debug('this is a film');
			let json = JSON.parse(text(doc, 'script[type="application/ld+json"]'));
			Z.debug(json);
			if (/^[\u4e00-\u9fff ]+ [\w() ]+/i.test(title)) {
				Z.debug(title);
				Z.debug('zh + en');
				newItem.title = tryMatch(title, /(^[\u4e00-\u9fff ]+) [\w() ]+/i, 1);
				newItem.extra += addExtra('original-title', tryMatch(title, / ([\w() ]+)/i, 1));
			}
			else {
				newItem.title = title;
			}
			if (/tv/i.test(json['@type'])) {
				newItem.itemType = 'tvBroadcast';
				newItem.date = ZU.strToISO(labels.getWith('首播'));
			}
			else {
				newItem.itemType = 'film';
				newItem.date = tryMatch(labels.getWith('上映日期'), /[\d-]+/);
			}
			newItem.abstractNote = text('.related-info .all');
			newItem.runningTime = labels.getWith('片长').replace('分钟', ' min');
			newItem.extra += addExtra('place', labels.getWith('制片国家'));
			newItem.extra += addExtra('alias', labels.getWith('又名'));
			newItem.extra += addExtra('IMDb', labels.getWith('IMDb'));
			newItem.extra += addExtra('style', labels.getWith('类型'));
			let creatorsMap = {
				director: json.actor,
				scriptwriter: json.author,
				contributor: json.actor
			};
			for (const creatorType in creatorsMap) {
				for (let creator of creatorsMap[creatorType]) {
					// 仅给出双语的需要替换
					creator = /([\u4e00-\u9fffA-Z·]+) ([\w .]+)/.test(creator.name)
						? creator.name.replace(/([\u4e00-\u9fffA-Z·]+) ([\w .]+)/, '$1($2)')
						: creator.name.trim();
					creators.push(processName(creator, creatorType));
				}
			}
			break;
		}
		case 'audioRecording': {
			newItem.title = title;
			newItem.abstractNote = text('.related-info .all');
			newItem.audioRecordingFormat = labels.getWith('介质');
			newItem.label = labels.getWith('出版者');
			newItem.date = labels.getWith('发行时间').replace(/\./, '-');
			// runningTime: 时长,
			newItem.extra += addExtra('genre', 'Album');
			newItem.extra += addExtra('style', labels.getWith('流派'));
			newItem.extra += addExtra('alias', labels.getWith('又名'));
			newItem.extra += addExtra('ISRC', labels.getWith('ISRC'));
			newItem.extra += addExtra('bar-code', labels.getWith('条形码'));
			labels.getWith('表演者').split(' / ').forEach(performer => creators.push(processName(performer, 'performer')));
			let contents = doc.querySelector('.track-list');
			if (contents) {
				newItem.notes.push(`<h1>《${newItem.title}》 - 目录</h1>` + contents.innerHTML.replace(/ · · · [\s\S]*$/, '').replace(/展开全部$/, ''));
			}
			break;
		}
		default:
			break;
	}
	newItem.abstractNote = ZU.trimInternal(newItem.abstractNote);
	newItem.language = /[\u4e00-\u9fff]/.test(newItem.title)
		? 'zh-CN'
		: 'en-US';
	newItem.url = url;
	newItem.extra += addExtra('rating', text(doc, '.rating_num'));
	newItem.extra += addExtra('rating-people', text(doc, '.rating_people'));
	newItem.extra += addExtra('comments', tryMatch(text(doc, '#comments-section h2'), /\d+/));
	Z.debug(creators);
	newItem.extra += addExtra('creatorsExt', JSON.stringify(creators));
	creators.forEach((creator) => {
		newItem.extra += addExtra('original-author', creator.original);
		delete creator.country;
		delete creator.original;
		newItem.creators.push(creator);
	});
	newItem.complete();
}

class TextLabels {
	constructor(doc, selector) {
		// innerText在详情页表现良好，但在多条目表现欠佳，故统一使用经过处理的text
		this.innerData = text(doc, selector)
			.replace(/^[\s\n]*/gm, '')
			.replace(/:\n/g, ': ')
			.replace(/\n\/\n/g, ' / ')
			// https://book.douban.com/subject/1291204/
			.replace(/\n([^】\]:：]+?\n)/g, ' $1')
			.split('\n')
			.map(keyVal => [
				tryMatch(keyVal, /^[[【]?([\s\S]+?)[】\]:：]\s*[\s\S]+$/, 1).replace(/\s/g, ''),
				tryMatch(keyVal, /^[[【]?[\s\S]+?[】\]:：]\s*([\s\S]+)$/, 1)
			]);
	}

	getWith(label) {
		if (Array.isArray(label)) {
			let result = label
				.map(aLabel => this.getWith(aLabel))
				.find(value => value);
			return result
				? result
				: '';
		}
		let pattern = new RegExp(label);
		let keyVal = this.innerData.find(element => pattern.test(element[0]));
		return keyVal
			? ZU.trimInternal(keyVal[1])
			: '';
	}
}

class Labels {
	constructor(doc, selector) {
		this.innerData = [];
		Array.from(doc.querySelectorAll(selector))
			.filter(element => element.firstElementChild)
			.forEach((element) => {
				let elementCopy = element.cloneNode(true);
				let key = elementCopy.removeChild(elementCopy.firstElementChild).innerText.replace(/\s/g, '');
				this.innerData.push([key, elementCopy]);
			});
	}

	getWith(label, element = false) {
		if (Array.isArray(label)) {
			let result = label
				.map(aLabel => this.getWith(aLabel, element));
			result = element
				? result.find(element => element.childNodes.length)
				: result.find(element => element);
			return result
				? result
				: element
					? document.createElement('div')
					: '';
		}
		let pattern = new RegExp(label);
		let keyValPair = this.innerData.find(element => pattern.test(element[0]));
		if (element) return keyValPair ? keyValPair[1] : document.createElement('div');
		return keyValPair
			? ZU.trimInternal(keyValPair[1].innerText)
			: '';
	}
}

function addExtra(key, value) {
	return value
		? `${key}: ${value}\n`
		: '';
}

function tryMatch(string, pattern, index = 0) {
	let match = string.match(pattern);
	if (match && match[index]) {
		return match[index];
	}
	return '';
}

function processName(fullName, defaultType) {
	var creatorType, country, original;
	// 当多个人名折叠时，最后一个人名可能带有“更多”。
	fullName = fullName.replace(/更多\.\.\.$/, '');
	// https://book.douban.com/subject/35152294/
	country = tryMatch(fullName, /^[[(（【](.+?)国?[】）)\]]/, 1);
	fullName = fullName.replace(/^[[(（【].+?国?[】）)\]]/, '');

	const role = {
		著: 'author',
		编: 'author',
		主编: 'editor',
		译: 'translator',
		校: 'contributor',
		审校: 'contributor',
		审: 'contributor',
		校注: 'contributor',
		注: 'contributor'
	};
	let remark = tryMatch(fullName, /[(（)](.+)[）)]$/, 1);
	fullName = fullName.replace(/[(（)](.+)[）)]$/, '');
	if (remark in role) {
		creatorType = role[remark];
	}
	else {
		// https://book.douban.com/subject/26604008/
		original = remark;
		for (const key in role) {
			let rolePattern = new RegExp(`(${key} )|( ${key})`);
			if (rolePattern.test(fullName)) {
				creatorType = role[key];
				fullName = fullName.replace(key, '');
				break;
			}
		}
	}
	creatorType = creatorType || defaultType;
	let creator = ZU.cleanAuthor(fullName, creatorType);
	// https://book.douban.com/subject/26604008/
	if (/[\u4e00-\u9fff]/.test(creator.lastName)) {
		creator.lastName = creator.firstName + creator.lastName;
		creator.lastName = creator.lastName.replace(/([\u4e00-\u9fff])([a-z])/gi, '$1·$2');
		creator.lastName = creator.lastName.replace(/\.(\S)/gi, '. $1');
		// https://book.douban.com/subject/25807982/
		creator.lastName = creator.lastName.replace(/•/gi, '·');
		creator.firstName = '';
		creator.fieldMode = 1;
	}
	creator.country = country;
	creator.original = original;
	return creator;
}

function toArabicNum(zhNum) {
	if (!zhNum) return '';
	let res = 0;
	let lastDigit = 0;
	const digitMap = {
		一: 1,
		二: 2,
		三: 3,
		四: 4,
		五: 5,
		六: 6,
		七: 7,
		八: 8,
		九: 9,
	};
	const unitMap = {
		十: 10,
		百: 100,
		千: 1000,
		万: 10000,
	};
	for (let char of zhNum) {
		if (char in digitMap) {
			lastDigit = digitMap[char];
		}
		else if (char in unitMap) {
			if (lastDigit > 0) {
				res += lastDigit * unitMap[char];
			}
			else {
				res += unitMap[char];
			}
			lastDigit = 0;
		}
	}
	res += lastDigit;
	return res;
}


/** BEGIN TEST CASES **/
var testCases = [
	{
		"type": "web",
		"url": "https://book.douban.com/subject/26604008/",
		"items": [
			{
				"itemType": "book",
				"title": "计算机组成与设计：硬件/软件接口",
				"creators": [
					{
						"firstName": "",
						"lastName": "戴维·A. 帕特森",
						"creatorType": "author",
						"fieldMode": 1
					},
					{
						"firstName": "",
						"lastName": "约翰·L. 亨尼斯",
						"creatorType": "author",
						"fieldMode": 1
					},
					{
						"firstName": "",
						"lastName": "王党辉",
						"creatorType": "translator",
						"fieldMode": 1
					},
					{
						"firstName": "",
						"lastName": "康继昌",
						"creatorType": "translator",
						"fieldMode": 1
					},
					{
						"firstName": "",
						"lastName": "安建峰",
						"creatorType": "translator",
						"fieldMode": 1
					}
				],
				"date": "2015-7-1",
				"ISBN": "9787111504825",
				"abstractNote": "《计算机组成与设计：硬件/软件接口》是计算机组成与设计的经典畅销教材，第5版经过全面更新，关注后PC时代发生在计算机体系结构领域的革命性变革——从单核处理器到多核微处理器，从串行到并行。本书特别关注移动计算和云计算，通过平板电脑、云体系结构以及ARM（移动计算设备）和x86（云计算）体系结构来探索和揭示这场技术变革。 与前几版一样，本书采用MIPS处理器讲解计算机硬件技术、汇编语言、计算机算术、流水线、存储器层次结构以及I/O等基本功能。",
				"extra": "original-title: Computer Organization and Design: The Hardware/Software Interface (5/e)\nprice: 99.00元\nrating: 9.2\nrating-people: 396人评价\ncomments: 110\ncreatorsExt: [{\"firstName\":\"\",\"lastName\":\"戴维·A. 帕特森\",\"creatorType\":\"author\",\"fieldMode\":1,\"country\":\"\",\"original\":\"David A.Patterson\"},{\"firstName\":\"\",\"lastName\":\"约翰·L. 亨尼斯\",\"creatorType\":\"author\",\"fieldMode\":1,\"country\":\"\",\"original\":\"John L.Hennessy\"},{\"firstName\":\"\",\"lastName\":\"王党辉\",\"creatorType\":\"translator\",\"fieldMode\":1,\"country\":\"\",\"original\":\"\"},{\"firstName\":\"\",\"lastName\":\"康继昌\",\"creatorType\":\"translator\",\"fieldMode\":1,\"country\":\"\",\"original\":\"\"},{\"firstName\":\"\",\"lastName\":\"安建峰\",\"creatorType\":\"translator\",\"fieldMode\":1,\"country\":\"\",\"original\":\"\"}]\noriginal-author: David A.Patterson\noriginal-author: John L.Hennessy",
				"language": "zh-CN",
				"libraryCatalog": "Douban",
				"numPages": "536",
				"publisher": "机械工业出版社",
				"series": "计算机科学丛书",
				"url": "https://book.douban.com/subject/26604008/",
				"attachments": [],
				"tags": [],
				"notes": [
					"《计算机组成与设计：硬件/软件接口》\n\n        出版者的话\n        本书赞誉\n        译者序\n        前言\n        作者简介\n        第1章　计算机概要与技术1\n        1.1　引言1\n        1.1.1　计算应用的分类及其特性2\n        1.1.2　欢迎来到后PC时代3\n        1.1.3　你能从本书学到什么4\n        1.2　计算机系统结构中的8个伟大思想6\n        1.2.1　面向摩尔定律的设计6\n        1.2.2　使用抽象简化设计6\n        1.2.3　加速大概率事件6\n        1.2.4　通过并行提高性能7\n        1.2.5　通过流水线提高性能7\n        1.2.6　通过预测提高性能7\n        1.2.7　存储器层次7\n        1.2.8　通过冗余提高可靠性7\n        1.3　程序概念入门7\n        1.4　硬件概念入门10\n        1.4.1　显示器11\n        1.4.2　触摸屏12\n        1.4.3　打开机箱12\n        1.4.4　数据安全15\n        1.4.5　与其他计算机通信16\n        1.5　处理器和存储器制造技术17\n        1.6　性能20\n        1.6.1　性能的定义20\n        1.6.2　性能的度量22\n        1.6.3　CPU性能及其因素23\n        1.6.4　指令的性能24\n        1.6.5　经典的CPU性能公式25\n        1.7　功耗墙27\n        1.8　沧海巨变：从单处理器向多处理器转变29\n        1.9　实例：Intel Core i7基准31\n        1.9.1　SPEC CPU基准测试程序31\n        1.9.2　SPEC功耗基准测试程序32\n        1.10　谬误与陷阱33\n        1.11　本章小结35\n        1.12　历史观点和拓展阅读36\n        1.13　练习题36\n        第2章　指令：计算机的语言40\n        2.1　引言40\n        2.2　计算机硬件的操作43\n        2.3　计算机硬件的操作数44\n        2.3.1　存储器操作数45\n        2.3.2　常数或立即数操作数47\n        2.4　有符号数和无符号数48\n        2.5　计算机中指令的表示53\n        2.6　逻辑操作58\n        2.7　决策指令60\n        2.7.1　循环61\n        2.7.2　case/switch语句63\n        2.8　计算机硬件对过程的支持64\n        2.8.1　使用更多的寄存器66\n        2.8.2　嵌套过程67\n        2.8.3　在栈中为新数据分配空间69\n        2.8.4　在堆中为新数据分配空间70\n        2.9　人机交互72\n        2.10　MIPS中32位立即数和寻址75\n        2.10.1　32位立即数75\n        2.10.2　分支和跳转中的寻址76\n        2.10.3　MIPS寻址模式总结78\n        2.10.4　机器语言解码79\n        2.11　并行与指令：同步81\n        2.12　翻译并执行程序83\n        2.12.1　编译器83\n        2.12.2　汇编器84\n        2.12.3　链接器85\n        2.12.4　加载器87\n        2.12.5　动态链接库87\n        2.12.6　启动一个Java程序89\n        2.13　以一个C排序程序作为完整的例子90\n        2.13.1　swap过程90\n        2.13.2　sort过程91\n        2.14　数组与指针96\n        2.14.1　用数组实现clear96\n        2.14.2　用指针实现clear97\n        2.14.3　比较两个版本的clear97\n        2.15　高级内容：编译C语言和解释Java语言98\n        2.16　实例：ARMv7(32位)指令集98\n        2.16.1　寻址模式99\n        2.16.2　比较和条件分支100\n        2.16.3　ARM的特色100\n        2.17　实例：x86指令集102\n        2.17.1　Intel x86的改进102\n        2.17.2　x86寄存器和数据寻址模式103\n        2.17.3　x86整数操作105\n        2.17.4　x86指令编码107\n        2.17.5　x86总结108\n        2.18　实例：ARMv8（64位）指令集108\n        2.19　谬误与陷阱109\n        2.20　本章小结110\n        2.21　历史观点和拓展阅读111\n        2.22　练习题112\n        第3章　计算机的算术运算117\n        3.1　引言117\n        3.2　加法和减法117\n        3.3　乘法121\n        3.3.1　顺序的乘法算法和硬件121\n        3.3.2　有符号乘法124\n        3.3.3　更快速的乘法124\n        3.3.4　MIPS中的乘法124\n        3.3.5　小结125\n        3.4　除法125\n        3.4.1　除法算法及其硬件结构125\n        3.4.2　有符号除法128\n        3.4.3　更快速的除法128\n        3.4.4　MIPS中的除法129\n        3.4.5　小结129\n        3.5　浮点运算130\n        3.5.1　浮点表示131\n        3.5.2　浮点加法135\n        3.5.3　浮点乘法138\n        3.5.4　MIPS中的浮点指令139\n        3.5.5　算术精确性145\n        3.5.6　小结146\n        3.6　并行性和计算机算术：子字并行148\n        3.7　实例：x86中流处理SIMD扩展和高级向量扩展149\n        3.8　加速：子字并行和矩阵乘法150\n        3.9　谬误与陷阱153\n        3.10　本章小结155\n        3.11　历史观点和拓展阅读158\n        3.12　练习题159\n        第4章　处理器162\n        4.1　引言162\n        4.2　逻辑设计的一般方法165\n        4.3　建立数据通路167\n        4.4　一个简单的实现机制173\n        4.4.1　ALU控制173\n        4.4.2　主控制单元的设计175\n        4.4.3　为什么不使用单周期实现方式181\n        4.5　流水线概述182\n        4.5.1　面向流水线的指令集设计186\n        4.5.2　流水线冒险186\n        4.5.3　对流水线概述的小结191\n        4.6　流水线数据通路及其控制192\n        4.6.1　图形化表示的流水线200\n        4.6.2　流水线控制203\n        4.7　数据冒险：旁路与阻塞206\n        4.8　控制冒险214\n        4.8.1　假定分支不发生215\n        4.8.2　缩短分支的延迟215\n        4.8.3　动态分支预测216\n        4.8.4　流水线小结220\n        4.9　异常221\n        4.9.1　MIPS体系结构中的异常处理221\n        4.9.2　在流水线实现中的异常222\n        4.10　指令级并行226\n        4.10.1　推测的概念227\n        4.10.2　静态多发射处理器227\n        4.10.3　动态多发射处理器231\n        4.10.4　能耗效率与高级流水线233\n        4.11　实例：ARM Cortex-A8和Intel Core i7流水线234\n        4.11.1　ARM Cortex-A8235\n        4.11.2　Intel Core i7 920236\n        4.11.3　Intel Core i7 920的性能238\n        4.12　运行更快：指令级并行和矩阵乘法240\n        4.13　高级主题：通过硬件设计语言描述和建模流水线来介绍数字设计以及更多流水线示例242\n        4.14　谬误与陷阱242\n        4.15　本章小结243\n        4.16　历史观点和拓展阅读243\n        4.17　练习题243\n        第5章　大容量和高速度：开发存储器层次结构252\n        5.1　引言252\n        5.2　存储器技术255\n        5.2.1　SRAM技术256\n        5.2.2　DRAM技术256\n        5.2.3　闪存258\n        5.2.4　磁盘存储器258\n        5.3　cache的基本原理259\n        5.3.1　cache访问261\n        5.3.2　cache缺失处理265\n        5.3.3　写操作处理266\n        5.3.4　一个cache的例子:内置FastMATH处理器267\n        5.3.5　小结269\n        5.4　cache性能的评估和改进270\n        5.4.1　通过更灵活地放置块来减少cache缺失272\n        5.4.2　在cache中查找一个块275\n        5.4.3　替换块的选择276\n        5.4.4　使用多级cache结构减少缺失代价277\n        5.4.5　通过分块进行软件优化280\n        5.4.6　小结283\n        5.5　可信存储器层次283\n        5.5.1　失效的定义283\n        5.5.2　纠正一位错、检测两位错的汉明编码（SEC/DED）284\n        5.6　虚拟机287\n        5.6.1　虚拟机监视器的必备条件289\n        5.6.2　指令集系统结构（缺乏）对虚拟机的支持289\n        5.6.3　保护和指令集系统结构289\n        5.7　虚拟存储器290\n        5.7.1　页的存放和查找293\n        5.7.2　缺页故障294\n        5.7.3　关于写297\n        5.7.4　加快地址转换：TLB297\n        5.7.5　集成虚拟存储器、TLB和cache 300\n        5.7.6　虚拟存储器中的保护302\n        5.7.7　处理TLB缺失和缺页303\n        5.7.8　小结307\n        5.8　存储器层次结构的一般框架309\n        5.8.1　问题1：一个块可以被放在何处309\n        5.8.2　问题2：如何找到一个块310\n        5.8.3　问题3：当cache缺失时替换哪一块311\n        5.8.4　问题4：写操作如何处理311\n        5.8.5　3C：一种理解存储器层次结构行为的直观模型312\n        5.9　使用有限状态机来控制简单的cache314\n        5.9.1　一个简单的cache314\n        5.9.2　有限状态机315\n        5.9.3　一个简单的cache控制器的有限状态机316\n        5.10　并行与存储器层次结构：cache一致性317\n        5.10.1　实现一致性的基本方案318\n        5.10.2　监听协议319\n        5.11　并行与存储器层次结构：冗余廉价磁盘阵列320\n        5.12　高级内容：实现cache控制器320\n        5.13　实例：ARM Cortex-A8和Intel Core i7的存储器层次结构320\n        5.14　运行更快:cache分块和矩阵乘法324\n        5.15　谬误和陷阱326\n        5.16　本章小结329\n        5.17　历史观点和拓展阅读329\n        5.18　练习题329\n        第6章　从客户端到云的并行处理器340\n        6.1　引言340\n        6.2　创建并行处理程序的难点342\n        6.3　SISD、MIMD、SIMD、SPMD和向量机345\n        6.3.1　在x86中的SIMD：多媒体扩展346\n        6.3.2　向量机346\n        6.3.3　向量与标量的对比347\n        6.3.4　向量与多媒体扩展的对比348\n        6.4　硬件多线程350\n        6.5　多核和其他共享内存多处理器352\n        6.6　图形处理单元简介355\n        6.6.1　NVIDIA GPU体系结构简介356\n        6.6.2　NVIDIA GPU存储结构357\n        6.6.3　GPU展望358\n        6.7　集群、仓储级计算机和其他消息传递多处理器360\n        6.8　多处理器网络拓扑简介363\n        6.9　与外界通信：集群网络366\n        6.10　多处理器测试集程序和性能模型366\n        6.10.1　性能模型368\n        6.10.2　Roofline模型369\n        6.10.3　两代Opteron的比较370\n        6.11　实例：评测Intel Core i7 960和NVIDIA Tesla GPU的Roofline模型373\n        6.12　运行更快：多处理器和矩阵乘法376\n        6.13　谬误与陷阱378\n        6.14　本章小结379\n        6.15　历史观点和拓展阅读381\n        6.16　练习题382\n        附录A　汇编器、链接器和SPIM仿真器389\n        附录B　逻辑设计基础437\n        索引494\n    "
				],
				"seeAlso": []
			}
		]
	},
	{
		"type": "web",
		"url": "https://read.douban.com/ebook/314197637/?dcs=search",
		"items": [
			{
				"itemType": "book",
				"title": "永不停歇的时钟",
				"creators": [
					{
						"firstName": "",
						"lastName": "杰西卡·里斯金",
						"creatorType": "author",
						"fieldMode": 1
					},
					{
						"firstName": "",
						"lastName": "王丹",
						"creatorType": "translator",
						"fieldMode": 1
					},
					{
						"firstName": "",
						"lastName": "朱丛",
						"creatorType": "translator",
						"fieldMode": 1
					}
				],
				"date": "2020-07",
				"ISBN": "9787508699806",
				"extra": "creatorsExt: [{\"firstName\":\"\",\"lastName\":\"杰西卡·里斯金\",\"creatorType\":\"author\",\"fieldMode\":1,\"country\":\"美\",\"original\":\"\"},{\"firstName\":\"\",\"lastName\":\"王丹\",\"creatorType\":\"translator\",\"fieldMode\":1,\"country\":\"\",\"original\":\"\"},{\"firstName\":\"\",\"lastName\":\"朱丛\",\"creatorType\":\"translator\",\"fieldMode\":1,\"country\":\"\",\"original\":\"\"}]",
				"language": "zh-CN",
				"libraryCatalog": "Douban",
				"publisher": "中信出版社",
				"url": "https://read.douban.com/ebook/314197637/?dcs=search",
				"attachments": [],
				"tags": [
					{
						"tag": "人工智能"
					},
					{
						"tag": "历史"
					},
					{
						"tag": "生命科学"
					},
					{
						"tag": "科学"
					},
					{
						"tag": "科学史"
					},
					{
						"tag": "科普"
					},
					{
						"tag": "限时特价"
					}
				],
				"notes": [
					"《永不停歇的时钟》\n作品目录\n引言 究竟是赫胥黎的玩笑，还是自然与科学界的能动作用\n第一章 花园里的机器\n第二章 机器之间的笛卡儿\n第三章 被动的望远镜还是永不停歇的时钟\n第四章 最早的机器人\n第五章 机器先生冒险记\n第六章 自组织机器的困境\n第七章 机器间的达尔文\n第八章 机械卵和智能卵\n第九章 由外而内\n第十章 历史的重要性\n致谢\n参考文献\n"
				],
				"seeAlso": []
			}
		]
	},
	{
		"type": "web",
		"url": "https://book.douban.com/",
		"items": "multiple"
	},
	{
		"type": "web",
		"url": "https://read.douban.com/ebooks/",
		"items": "multiple"
	},
	{
		"type": "web",
		"url": "https://movie.douban.com/subject/1292052/",
		"items": [
			{
				"itemType": "film",
				"title": "肖申克的救赎",
				"creators": [
					{
						"firstName": "",
						"lastName": "蒂姆·罗宾斯",
						"creatorType": "director",
						"fieldMode": 1
					},
					{
						"firstName": "",
						"lastName": "摩根·弗里曼",
						"creatorType": "director",
						"fieldMode": 1
					},
					{
						"firstName": "",
						"lastName": "鲍勃·冈顿",
						"creatorType": "director",
						"fieldMode": 1
					},
					{
						"firstName": "",
						"lastName": "威廉姆·赛德勒",
						"creatorType": "director",
						"fieldMode": 1
					},
					{
						"firstName": "",
						"lastName": "克兰西·布朗",
						"creatorType": "director",
						"fieldMode": 1
					},
					{
						"firstName": "",
						"lastName": "吉尔·贝罗斯",
						"creatorType": "director",
						"fieldMode": 1
					},
					{
						"firstName": "",
						"lastName": "马克·罗斯顿",
						"creatorType": "director",
						"fieldMode": 1
					},
					{
						"firstName": "",
						"lastName": "詹姆斯·惠特摩",
						"creatorType": "director",
						"fieldMode": 1
					},
					{
						"firstName": "",
						"lastName": "杰弗里·德曼",
						"creatorType": "director",
						"fieldMode": 1
					},
					{
						"firstName": "",
						"lastName": "拉里·布兰登伯格",
						"creatorType": "director",
						"fieldMode": 1
					},
					{
						"firstName": "",
						"lastName": "尼尔·吉恩托利",
						"creatorType": "director",
						"fieldMode": 1
					},
					{
						"firstName": "",
						"lastName": "布赖恩·利比",
						"creatorType": "director",
						"fieldMode": 1
					},
					{
						"firstName": "",
						"lastName": "大卫·普罗瓦尔",
						"creatorType": "director",
						"fieldMode": 1
					},
					{
						"firstName": "",
						"lastName": "约瑟夫·劳格诺",
						"creatorType": "director",
						"fieldMode": 1
					},
					{
						"firstName": "",
						"lastName": "祖德·塞克利拉",
						"creatorType": "director",
						"fieldMode": 1
					},
					{
						"firstName": "",
						"lastName": "保罗·麦克兰尼",
						"creatorType": "director",
						"fieldMode": 1
					},
					{
						"firstName": "",
						"lastName": "芮妮·布莱恩",
						"creatorType": "director",
						"fieldMode": 1
					},
					{
						"firstName": "",
						"lastName": "阿方索·弗里曼",
						"creatorType": "director",
						"fieldMode": 1
					},
					{
						"firstName": "",
						"lastName": "V·J·福斯特",
						"creatorType": "director",
						"fieldMode": 1
					},
					{
						"firstName": "",
						"lastName": "弗兰克·梅德拉诺",
						"creatorType": "director",
						"fieldMode": 1
					},
					{
						"firstName": "",
						"lastName": "马克·迈尔斯",
						"creatorType": "director",
						"fieldMode": 1
					},
					{
						"firstName": "",
						"lastName": "尼尔·萨默斯",
						"creatorType": "director",
						"fieldMode": 1
					},
					{
						"firstName": "",
						"lastName": "耐德·巴拉米",
						"creatorType": "director",
						"fieldMode": 1
					},
					{
						"firstName": "",
						"lastName": "布赖恩·戴拉特",
						"creatorType": "director",
						"fieldMode": 1
					},
					{
						"firstName": "",
						"lastName": "唐·麦克马纳斯",
						"creatorType": "director",
						"fieldMode": 1
					},
					{
						"firstName": "",
						"lastName": "弗兰克·德拉邦特",
						"creatorType": "scriptwriter",
						"fieldMode": 1
					},
					{
						"firstName": "",
						"lastName": "斯蒂芬·金",
						"creatorType": "scriptwriter",
						"fieldMode": 1
					},
					{
						"firstName": "",
						"lastName": "蒂姆·罗宾斯",
						"creatorType": "contributor",
						"fieldMode": 1
					},
					{
						"firstName": "",
						"lastName": "摩根·弗里曼",
						"creatorType": "contributor",
						"fieldMode": 1
					},
					{
						"firstName": "",
						"lastName": "鲍勃·冈顿",
						"creatorType": "contributor",
						"fieldMode": 1
					},
					{
						"firstName": "",
						"lastName": "威廉姆·赛德勒",
						"creatorType": "contributor",
						"fieldMode": 1
					},
					{
						"firstName": "",
						"lastName": "克兰西·布朗",
						"creatorType": "contributor",
						"fieldMode": 1
					},
					{
						"firstName": "",
						"lastName": "吉尔·贝罗斯",
						"creatorType": "contributor",
						"fieldMode": 1
					},
					{
						"firstName": "",
						"lastName": "马克·罗斯顿",
						"creatorType": "contributor",
						"fieldMode": 1
					},
					{
						"firstName": "",
						"lastName": "詹姆斯·惠特摩",
						"creatorType": "contributor",
						"fieldMode": 1
					},
					{
						"firstName": "",
						"lastName": "杰弗里·德曼",
						"creatorType": "contributor",
						"fieldMode": 1
					},
					{
						"firstName": "",
						"lastName": "拉里·布兰登伯格",
						"creatorType": "contributor",
						"fieldMode": 1
					},
					{
						"firstName": "",
						"lastName": "尼尔·吉恩托利",
						"creatorType": "contributor",
						"fieldMode": 1
					},
					{
						"firstName": "",
						"lastName": "布赖恩·利比",
						"creatorType": "contributor",
						"fieldMode": 1
					},
					{
						"firstName": "",
						"lastName": "大卫·普罗瓦尔",
						"creatorType": "contributor",
						"fieldMode": 1
					},
					{
						"firstName": "",
						"lastName": "约瑟夫·劳格诺",
						"creatorType": "contributor",
						"fieldMode": 1
					},
					{
						"firstName": "",
						"lastName": "祖德·塞克利拉",
						"creatorType": "contributor",
						"fieldMode": 1
					},
					{
						"firstName": "",
						"lastName": "保罗·麦克兰尼",
						"creatorType": "contributor",
						"fieldMode": 1
					},
					{
						"firstName": "",
						"lastName": "芮妮·布莱恩",
						"creatorType": "contributor",
						"fieldMode": 1
					},
					{
						"firstName": "",
						"lastName": "阿方索·弗里曼",
						"creatorType": "contributor",
						"fieldMode": 1
					},
					{
						"firstName": "",
						"lastName": "V·J·福斯特",
						"creatorType": "contributor",
						"fieldMode": 1
					},
					{
						"firstName": "",
						"lastName": "弗兰克·梅德拉诺",
						"creatorType": "contributor",
						"fieldMode": 1
					},
					{
						"firstName": "",
						"lastName": "马克·迈尔斯",
						"creatorType": "contributor",
						"fieldMode": 1
					},
					{
						"firstName": "",
						"lastName": "尼尔·萨默斯",
						"creatorType": "contributor",
						"fieldMode": 1
					},
					{
						"firstName": "",
						"lastName": "耐德·巴拉米",
						"creatorType": "contributor",
						"fieldMode": 1
					},
					{
						"firstName": "",
						"lastName": "布赖恩·戴拉特",
						"creatorType": "contributor",
						"fieldMode": 1
					},
					{
						"firstName": "",
						"lastName": "唐·麦克马纳斯",
						"creatorType": "contributor",
						"fieldMode": 1
					}
				],
				"date": "1994-09-10",
				"abstractNote": "一场谋杀案使银行家安迪（蒂姆•罗宾斯 Tim Robbins 饰）蒙冤入狱，谋杀妻子及其情人的指控将囚禁他终生。在肖申克监狱的首次现身就让监狱“大哥”瑞德（摩根•弗里曼 Morgan Freeman 饰）对他另眼相看。瑞德帮助他搞到一把石锤和一幅女明星海报，两人渐成患难 之交。很快，安迪在监狱里大显其才，担当监狱图书管理员，并利用自己的金融知识帮助监狱官避税，引起了典狱长的注意，被招致麾下帮助典狱长洗黑钱。偶然一次，他得知一名新入狱的小偷能够作证帮他洗脱谋杀罪。燃起一丝希望的安迪找到了典狱长，希望他能帮自己翻案。阴险伪善的狱长假装答应安迪，背后却派人杀死小偷，让他唯一能合法出狱的希望泯灭。沮丧的安迪并没有绝望，在一个电闪雷鸣的风雨夜，一场暗藏几十年的越狱计划让他自我救赎，重获自由！老朋友瑞德在他的鼓舞和帮助下，也勇敢地奔向自由。 本片获得1995年奥斯卡10项提名，以及金球奖、土星奖等多项提名。",
				"extra": "original-title: The Shawshank Redemption (1994)\nplace: 美国\nalias: 月黑高飞(港) / 刺激1995(台) / 地狱诺言 / 铁窗岁月 / 消香克的救赎\nIMDb: tt0111161\nstyle: 剧情 / 犯罪\nrating: 9.7\nrating-people: 2967875人评价\ncomments: 580148\ncreatorsExt: [{\"firstName\":\"\",\"lastName\":\"蒂姆·罗宾斯\",\"creatorType\":\"director\",\"fieldMode\":1,\"country\":\"\",\"original\":\" Tim Robbins\"},{\"firstName\":\"\",\"lastName\":\"摩根·弗里曼\",\"creatorType\":\"director\",\"fieldMode\":1,\"country\":\"\",\"original\":\" Morgan Freeman\"},{\"firstName\":\"\",\"lastName\":\"鲍勃·冈顿\",\"creatorType\":\"director\",\"fieldMode\":1,\"country\":\"\",\"original\":\" Bob Gunton\"},{\"firstName\":\"\",\"lastName\":\"威廉姆·赛德勒\",\"creatorType\":\"director\",\"fieldMode\":1,\"country\":\"\",\"original\":\" William Sadler\"},{\"firstName\":\"\",\"lastName\":\"克兰西·布朗\",\"creatorType\":\"director\",\"fieldMode\":1,\"country\":\"\",\"original\":\" Clancy Brown\"},{\"firstName\":\"\",\"lastName\":\"吉尔·贝罗斯\",\"creatorType\":\"director\",\"fieldMode\":1,\"country\":\"\",\"original\":\" Gil Bellows\"},{\"firstName\":\"\",\"lastName\":\"马克·罗斯顿\",\"creatorType\":\"director\",\"fieldMode\":1,\"country\":\"\",\"original\":\" Mark Rolston\"},{\"firstName\":\"\",\"lastName\":\"詹姆斯·惠特摩\",\"creatorType\":\"director\",\"fieldMode\":1,\"country\":\"\",\"original\":\" James Whitmore\"},{\"firstName\":\"\",\"lastName\":\"杰弗里·德曼\",\"creatorType\":\"director\",\"fieldMode\":1,\"country\":\"\",\"original\":\" Jeffrey DeMunn\"},{\"firstName\":\"\",\"lastName\":\"拉里·布兰登伯格\",\"creatorType\":\"director\",\"fieldMode\":1,\"country\":\"\",\"original\":\" Larry Brandenburg\"},{\"firstName\":\"\",\"lastName\":\"尼尔·吉恩托利\",\"creatorType\":\"director\",\"fieldMode\":1,\"country\":\"\",\"original\":\" Neil Giuntoli\"},{\"firstName\":\"\",\"lastName\":\"布赖恩·利比\",\"creatorType\":\"director\",\"fieldMode\":1,\"country\":\"\",\"original\":\" Brian Libby\"},{\"firstName\":\"\",\"lastName\":\"大卫·普罗瓦尔\",\"creatorType\":\"director\",\"fieldMode\":1,\"country\":\"\",\"original\":\" David Proval\"},{\"firstName\":\"\",\"lastName\":\"约瑟夫·劳格诺\",\"creatorType\":\"director\",\"fieldMode\":1,\"country\":\"\",\"original\":\" Joseph Ragno\"},{\"firstName\":\"\",\"lastName\":\"祖德·塞克利拉\",\"creatorType\":\"director\",\"fieldMode\":1,\"country\":\"\",\"original\":\" Jude Ciccolella\"},{\"firstName\":\"\",\"lastName\":\"保罗·麦克兰尼\",\"creatorType\":\"director\",\"fieldMode\":1,\"country\":\"\",\"original\":\" Paul McCrane\"},{\"firstName\":\"\",\"lastName\":\"芮妮·布莱恩\",\"creatorType\":\"director\",\"fieldMode\":1,\"country\":\"\",\"original\":\" Renee Blaine\"},{\"firstName\":\"\",\"lastName\":\"阿方索·弗里曼\",\"creatorType\":\"director\",\"fieldMode\":1,\"country\":\"\",\"original\":\" Alfonso Freeman\"},{\"firstName\":\"\",\"lastName\":\"V·J·福斯特\",\"creatorType\":\"director\",\"fieldMode\":1,\"country\":\"\",\"original\":\" V.J. Foster\"},{\"firstName\":\"\",\"lastName\":\"弗兰克·梅德拉诺\",\"creatorType\":\"director\",\"fieldMode\":1,\"country\":\"\",\"original\":\" Frank Medrano\"},{\"firstName\":\"\",\"lastName\":\"马克·迈尔斯\",\"creatorType\":\"director\",\"fieldMode\":1,\"country\":\"\",\"original\":\" Mack Miles\"},{\"firstName\":\"\",\"lastName\":\"尼尔·萨默斯\",\"creatorType\":\"director\",\"fieldMode\":1,\"country\":\"\",\"original\":\" Neil Summers\"},{\"firstName\":\"\",\"lastName\":\"耐德·巴拉米\",\"creatorType\":\"director\",\"fieldMode\":1,\"country\":\"\",\"original\":\" Ned Bellamy\"},{\"firstName\":\"\",\"lastName\":\"布赖恩·戴拉特\",\"creatorType\":\"director\",\"fieldMode\":1,\"country\":\"\",\"original\":\" Brian Delate\"},{\"firstName\":\"\",\"lastName\":\"唐·麦克马纳斯\",\"creatorType\":\"director\",\"fieldMode\":1,\"country\":\"\",\"original\":\" Don McManus\"},{\"firstName\":\"\",\"lastName\":\"弗兰克·德拉邦特\",\"creatorType\":\"scriptwriter\",\"fieldMode\":1,\"country\":\"\",\"original\":\" Frank Darabont\"},{\"firstName\":\"\",\"lastName\":\"斯蒂芬·金\",\"creatorType\":\"scriptwriter\",\"fieldMode\":1,\"country\":\"\",\"original\":\" Stephen King\"},{\"firstName\":\"\",\"lastName\":\"蒂姆·罗宾斯\",\"creatorType\":\"contributor\",\"fieldMode\":1,\"country\":\"\",\"original\":\" Tim Robbins\"},{\"firstName\":\"\",\"lastName\":\"摩根·弗里曼\",\"creatorType\":\"contributor\",\"fieldMode\":1,\"country\":\"\",\"original\":\" Morgan Freeman\"},{\"firstName\":\"\",\"lastName\":\"鲍勃·冈顿\",\"creatorType\":\"contributor\",\"fieldMode\":1,\"country\":\"\",\"original\":\" Bob Gunton\"},{\"firstName\":\"\",\"lastName\":\"威廉姆·赛德勒\",\"creatorType\":\"contributor\",\"fieldMode\":1,\"country\":\"\",\"original\":\" William Sadler\"},{\"firstName\":\"\",\"lastName\":\"克兰西·布朗\",\"creatorType\":\"contributor\",\"fieldMode\":1,\"country\":\"\",\"original\":\" Clancy Brown\"},{\"firstName\":\"\",\"lastName\":\"吉尔·贝罗斯\",\"creatorType\":\"contributor\",\"fieldMode\":1,\"country\":\"\",\"original\":\" Gil Bellows\"},{\"firstName\":\"\",\"lastName\":\"马克·罗斯顿\",\"creatorType\":\"contributor\",\"fieldMode\":1,\"country\":\"\",\"original\":\" Mark Rolston\"},{\"firstName\":\"\",\"lastName\":\"詹姆斯·惠特摩\",\"creatorType\":\"contributor\",\"fieldMode\":1,\"country\":\"\",\"original\":\" James Whitmore\"},{\"firstName\":\"\",\"lastName\":\"杰弗里·德曼\",\"creatorType\":\"contributor\",\"fieldMode\":1,\"country\":\"\",\"original\":\" Jeffrey DeMunn\"},{\"firstName\":\"\",\"lastName\":\"拉里·布兰登伯格\",\"creatorType\":\"contributor\",\"fieldMode\":1,\"country\":\"\",\"original\":\" Larry Brandenburg\"},{\"firstName\":\"\",\"lastName\":\"尼尔·吉恩托利\",\"creatorType\":\"contributor\",\"fieldMode\":1,\"country\":\"\",\"original\":\" Neil Giuntoli\"},{\"firstName\":\"\",\"lastName\":\"布赖恩·利比\",\"creatorType\":\"contributor\",\"fieldMode\":1,\"country\":\"\",\"original\":\" Brian Libby\"},{\"firstName\":\"\",\"lastName\":\"大卫·普罗瓦尔\",\"creatorType\":\"contributor\",\"fieldMode\":1,\"country\":\"\",\"original\":\" David Proval\"},{\"firstName\":\"\",\"lastName\":\"约瑟夫·劳格诺\",\"creatorType\":\"contributor\",\"fieldMode\":1,\"country\":\"\",\"original\":\" Joseph Ragno\"},{\"firstName\":\"\",\"lastName\":\"祖德·塞克利拉\",\"creatorType\":\"contributor\",\"fieldMode\":1,\"country\":\"\",\"original\":\" Jude Ciccolella\"},{\"firstName\":\"\",\"lastName\":\"保罗·麦克兰尼\",\"creatorType\":\"contributor\",\"fieldMode\":1,\"country\":\"\",\"original\":\" Paul McCrane\"},{\"firstName\":\"\",\"lastName\":\"芮妮·布莱恩\",\"creatorType\":\"contributor\",\"fieldMode\":1,\"country\":\"\",\"original\":\" Renee Blaine\"},{\"firstName\":\"\",\"lastName\":\"阿方索·弗里曼\",\"creatorType\":\"contributor\",\"fieldMode\":1,\"country\":\"\",\"original\":\" Alfonso Freeman\"},{\"firstName\":\"\",\"lastName\":\"V·J·福斯特\",\"creatorType\":\"contributor\",\"fieldMode\":1,\"country\":\"\",\"original\":\" V.J. Foster\"},{\"firstName\":\"\",\"lastName\":\"弗兰克·梅德拉诺\",\"creatorType\":\"contributor\",\"fieldMode\":1,\"country\":\"\",\"original\":\" Frank Medrano\"},{\"firstName\":\"\",\"lastName\":\"马克·迈尔斯\",\"creatorType\":\"contributor\",\"fieldMode\":1,\"country\":\"\",\"original\":\" Mack Miles\"},{\"firstName\":\"\",\"lastName\":\"尼尔·萨默斯\",\"creatorType\":\"contributor\",\"fieldMode\":1,\"country\":\"\",\"original\":\" Neil Summers\"},{\"firstName\":\"\",\"lastName\":\"耐德·巴拉米\",\"creatorType\":\"contributor\",\"fieldMode\":1,\"country\":\"\",\"original\":\" Ned Bellamy\"},{\"firstName\":\"\",\"lastName\":\"布赖恩·戴拉特\",\"creatorType\":\"contributor\",\"fieldMode\":1,\"country\":\"\",\"original\":\" Brian Delate\"},{\"firstName\":\"\",\"lastName\":\"唐·麦克马纳斯\",\"creatorType\":\"contributor\",\"fieldMode\":1,\"country\":\"\",\"original\":\" Don McManus\"}]\noriginal-author:  Tim Robbins\noriginal-author:  Morgan Freeman\noriginal-author:  Bob Gunton\noriginal-author:  William Sadler\noriginal-author:  Clancy Brown\noriginal-author:  Gil Bellows\noriginal-author:  Mark Rolston\noriginal-author:  James Whitmore\noriginal-author:  Jeffrey DeMunn\noriginal-author:  Larry Brandenburg\noriginal-author:  Neil Giuntoli\noriginal-author:  Brian Libby\noriginal-author:  David Proval\noriginal-author:  Joseph Ragno\noriginal-author:  Jude Ciccolella\noriginal-author:  Paul McCrane\noriginal-author:  Renee Blaine\noriginal-author:  Alfonso Freeman\noriginal-author:  V.J. Foster\noriginal-author:  Frank Medrano\noriginal-author:  Mack Miles\noriginal-author:  Neil Summers\noriginal-author:  Ned Bellamy\noriginal-author:  Brian Delate\noriginal-author:  Don McManus\noriginal-author:  Frank Darabont\noriginal-author:  Stephen King\noriginal-author:  Tim Robbins\noriginal-author:  Morgan Freeman\noriginal-author:  Bob Gunton\noriginal-author:  William Sadler\noriginal-author:  Clancy Brown\noriginal-author:  Gil Bellows\noriginal-author:  Mark Rolston\noriginal-author:  James Whitmore\noriginal-author:  Jeffrey DeMunn\noriginal-author:  Larry Brandenburg\noriginal-author:  Neil Giuntoli\noriginal-author:  Brian Libby\noriginal-author:  David Proval\noriginal-author:  Joseph Ragno\noriginal-author:  Jude Ciccolella\noriginal-author:  Paul McCrane\noriginal-author:  Renee Blaine\noriginal-author:  Alfonso Freeman\noriginal-author:  V.J. Foster\noriginal-author:  Frank Medrano\noriginal-author:  Mack Miles\noriginal-author:  Neil Summers\noriginal-author:  Ned Bellamy\noriginal-author:  Brian Delate\noriginal-author:  Don McManus",
				"language": "zh-CN",
				"libraryCatalog": "Douban",
				"runningTime": "142 min",
				"url": "https://movie.douban.com/subject/1292052/",
				"attachments": [],
				"tags": [],
				"notes": [],
				"seeAlso": []
			}
		]
	},
	{
		"type": "web",
		"url": "https://movie.douban.com/subject/35840681/",
		"detectedItemType": "film",
		"items": [
			{
				"itemType": "tvBroadcast",
				"title": "良医 第六季",
				"creators": [
					{
						"firstName": "",
						"lastName": "弗莱迪·海默",
						"creatorType": "director",
						"fieldMode": 1
					},
					{
						"firstName": "",
						"lastName": "菲奥娜·嘉伯曼",
						"creatorType": "director",
						"fieldMode": 1
					},
					{
						"firstName": "",
						"lastName": "李威尹",
						"creatorType": "director",
						"fieldMode": 1
					},
					{
						"firstName": "",
						"lastName": "克里斯蒂娜·张",
						"creatorType": "director",
						"fieldMode": 1
					},
					{
						"firstName": "",
						"lastName": "布里亚·亨德森",
						"creatorType": "director",
						"fieldMode": 1
					},
					{
						"firstName": "",
						"lastName": "诺亚·盖尔文",
						"creatorType": "director",
						"fieldMode": 1
					},
					{
						"firstName": "",
						"lastName": "希尔·哈勃",
						"creatorType": "director",
						"fieldMode": 1
					},
					{
						"firstName": "",
						"lastName": "理查德·希夫",
						"creatorType": "director",
						"fieldMode": 1
					},
					{
						"firstName": "",
						"lastName": "布兰登·拉瑞昆特",
						"creatorType": "director",
						"fieldMode": 1
					},
					{
						"firstName": "Jennifer",
						"lastName": "Tong",
						"creatorType": "director"
					},
					{
						"firstName": "",
						"lastName": "胡安尼·费利兹",
						"creatorType": "director",
						"fieldMode": 1
					},
					{
						"firstName": "",
						"lastName": "大卫·肖",
						"creatorType": "scriptwriter",
						"fieldMode": 1
					},
					{
						"firstName": "",
						"lastName": "弗莱迪·海默",
						"creatorType": "contributor",
						"fieldMode": 1
					},
					{
						"firstName": "",
						"lastName": "菲奥娜·嘉伯曼",
						"creatorType": "contributor",
						"fieldMode": 1
					},
					{
						"firstName": "",
						"lastName": "李威尹",
						"creatorType": "contributor",
						"fieldMode": 1
					},
					{
						"firstName": "",
						"lastName": "克里斯蒂娜·张",
						"creatorType": "contributor",
						"fieldMode": 1
					},
					{
						"firstName": "",
						"lastName": "布里亚·亨德森",
						"creatorType": "contributor",
						"fieldMode": 1
					},
					{
						"firstName": "",
						"lastName": "诺亚·盖尔文",
						"creatorType": "contributor",
						"fieldMode": 1
					},
					{
						"firstName": "",
						"lastName": "希尔·哈勃",
						"creatorType": "contributor",
						"fieldMode": 1
					},
					{
						"firstName": "",
						"lastName": "理查德·希夫",
						"creatorType": "contributor",
						"fieldMode": 1
					},
					{
						"firstName": "",
						"lastName": "布兰登·拉瑞昆特",
						"creatorType": "contributor",
						"fieldMode": 1
					},
					{
						"firstName": "Jennifer",
						"lastName": "Tong",
						"creatorType": "contributor"
					},
					{
						"firstName": "",
						"lastName": "胡安尼·费利兹",
						"creatorType": "contributor",
						"fieldMode": 1
					}
				],
				"date": "2022-10-03",
				"extra": "original-title: The Good Doctor Season 6 (2022)\nplace: 美国\nalias: 好医生 / 仁医 / 良医心 / 良医墨非\nIMDb: tt19267596\nstyle: 剧情\nrating: 8.7\nrating-people: 2505人评价\ncomments: 607\ncreatorsExt: [{\"firstName\":\"\",\"lastName\":\"弗莱迪·海默\",\"creatorType\":\"director\",\"fieldMode\":1,\"country\":\"\",\"original\":\"Freddie Highmore\"},{\"firstName\":\"\",\"lastName\":\"菲奥娜·嘉伯曼\",\"creatorType\":\"director\",\"fieldMode\":1,\"country\":\"\",\"original\":\"Fiona Gubelmann\"},{\"firstName\":\"\",\"lastName\":\"李威尹\",\"creatorType\":\"director\",\"fieldMode\":1,\"country\":\"\",\"original\":\"Will Yun Lee\"},{\"firstName\":\"\",\"lastName\":\"克里斯蒂娜·张\",\"creatorType\":\"director\",\"fieldMode\":1,\"country\":\"\",\"original\":\"Christina Chang\"},{\"firstName\":\"\",\"lastName\":\"布里亚·亨德森\",\"creatorType\":\"director\",\"fieldMode\":1,\"country\":\"\",\"original\":\"Bria Henderson\"},{\"firstName\":\"\",\"lastName\":\"诺亚·盖尔文\",\"creatorType\":\"director\",\"fieldMode\":1,\"country\":\"\",\"original\":\"Noah Galvin\"},{\"firstName\":\"\",\"lastName\":\"希尔·哈勃\",\"creatorType\":\"director\",\"fieldMode\":1,\"country\":\"\",\"original\":\"Hill Harper\"},{\"firstName\":\"\",\"lastName\":\"理查德·希夫\",\"creatorType\":\"director\",\"fieldMode\":1,\"country\":\"\",\"original\":\"Richard Schiff\"},{\"firstName\":\"\",\"lastName\":\"布兰登·拉瑞昆特\",\"creatorType\":\"director\",\"fieldMode\":1,\"country\":\"\",\"original\":\"Brandon Larracuente\"},{\"firstName\":\"Jennifer\",\"lastName\":\"Tong\",\"creatorType\":\"director\",\"country\":\"\",\"original\":\"\"},{\"firstName\":\"\",\"lastName\":\"胡安尼·费利兹\",\"creatorType\":\"director\",\"fieldMode\":1,\"country\":\"\",\"original\":\"Juani Feliz\"},{\"firstName\":\"\",\"lastName\":\"大卫·肖\",\"creatorType\":\"scriptwriter\",\"fieldMode\":1,\"country\":\"\",\"original\":\"David Shore\"},{\"firstName\":\"\",\"lastName\":\"弗莱迪·海默\",\"creatorType\":\"contributor\",\"fieldMode\":1,\"country\":\"\",\"original\":\"Freddie Highmore\"},{\"firstName\":\"\",\"lastName\":\"菲奥娜·嘉伯曼\",\"creatorType\":\"contributor\",\"fieldMode\":1,\"country\":\"\",\"original\":\"Fiona Gubelmann\"},{\"firstName\":\"\",\"lastName\":\"李威尹\",\"creatorType\":\"contributor\",\"fieldMode\":1,\"country\":\"\",\"original\":\"Will Yun Lee\"},{\"firstName\":\"\",\"lastName\":\"克里斯蒂娜·张\",\"creatorType\":\"contributor\",\"fieldMode\":1,\"country\":\"\",\"original\":\"Christina Chang\"},{\"firstName\":\"\",\"lastName\":\"布里亚·亨德森\",\"creatorType\":\"contributor\",\"fieldMode\":1,\"country\":\"\",\"original\":\"Bria Henderson\"},{\"firstName\":\"\",\"lastName\":\"诺亚·盖尔文\",\"creatorType\":\"contributor\",\"fieldMode\":1,\"country\":\"\",\"original\":\"Noah Galvin\"},{\"firstName\":\"\",\"lastName\":\"希尔·哈勃\",\"creatorType\":\"contributor\",\"fieldMode\":1,\"country\":\"\",\"original\":\"Hill Harper\"},{\"firstName\":\"\",\"lastName\":\"理查德·希夫\",\"creatorType\":\"contributor\",\"fieldMode\":1,\"country\":\"\",\"original\":\"Richard Schiff\"},{\"firstName\":\"\",\"lastName\":\"布兰登·拉瑞昆特\",\"creatorType\":\"contributor\",\"fieldMode\":1,\"country\":\"\",\"original\":\"Brandon Larracuente\"},{\"firstName\":\"Jennifer\",\"lastName\":\"Tong\",\"creatorType\":\"contributor\",\"country\":\"\",\"original\":\"\"},{\"firstName\":\"\",\"lastName\":\"胡安尼·费利兹\",\"creatorType\":\"contributor\",\"fieldMode\":1,\"country\":\"\",\"original\":\"Juani Feliz\"}]\noriginal-author: Freddie Highmore\noriginal-author: Fiona Gubelmann\noriginal-author: Will Yun Lee\noriginal-author: Christina Chang\noriginal-author: Bria Henderson\noriginal-author: Noah Galvin\noriginal-author: Hill Harper\noriginal-author: Richard Schiff\noriginal-author: Brandon Larracuente\noriginal-author: Juani Feliz\noriginal-author: David Shore\noriginal-author: Freddie Highmore\noriginal-author: Fiona Gubelmann\noriginal-author: Will Yun Lee\noriginal-author: Christina Chang\noriginal-author: Bria Henderson\noriginal-author: Noah Galvin\noriginal-author: Hill Harper\noriginal-author: Richard Schiff\noriginal-author: Brandon Larracuente\noriginal-author: Juani Feliz",
				"language": "zh-CN",
				"libraryCatalog": "Douban",
				"url": "https://movie.douban.com/subject/35840681/",
				"attachments": [],
				"tags": [],
				"notes": [],
				"seeAlso": []
			}
		]
	},
	{
		"type": "web",
		"url": "https://movie.douban.com/",
		"items": "multiple"
	},
	{
		"type": "web",
		"url": "https://music.douban.com/subject/25811077/",
		"items": [
			{
				"itemType": "audioRecording",
				"title": "克卜勒",
				"creators": [
					{
						"firstName": "",
						"lastName": "孙燕姿",
						"creatorType": "performer",
						"fieldMode": 1
					}
				],
				"date": "2014-02-27",
				"audioRecordingFormat": "CD",
				"extra": "genre: Album\nstyle: 流行\nalias: Kepler\nbar-code: 0602488970204\nrating: 8.7\nrating-people: 33559人评价\ncomments: 11318\ncreatorsExt: [{\"firstName\":\"\",\"lastName\":\"孙燕姿\",\"creatorType\":\"performer\",\"fieldMode\":1,\"country\":\"\",\"original\":\"\"}]",
				"label": "环球唱片",
				"language": "zh-CN",
				"libraryCatalog": "Douban",
				"url": "https://music.douban.com/subject/25811077/",
				"attachments": [],
				"tags": [],
				"notes": [
					"《克卜勒》\n01. 克卜勒\n02. 渴\n03. 无限大\n04. 尚好的青春\n05. 天使的指纹\n06. 银泰\n07. 围绕\n08. 错觉\n09. 比较幸褔\n10. 雨还是不停地落下"
				],
				"seeAlso": []
			}
		]
	},
	{
		"type": "web",
		"url": "https://www.douban.com/doulist/176513/",
		"items": "multiple"
	}
]
/** END TEST CASES **/
