{
	"translatorID": "a8eaa2c8-4ed6-44f5-8532-b7e8ad8aeb83",
	"label": "Jikan Full Text Database",
	"creator": "jiaojiaodubai",
	"target": "^https://www\\.jikan\\.com\\.cn",
	"minVersion": "5.0",
	"maxVersion": "",
	"priority": 100,
	"inRepository": true,
	"translatorType": 4,
	"browserSupport": "gcsibv",
	"lastUpdated": "2024-11-06 20:43:54"
}

/*
    ***** BEGIN LICENSE BLOCK *****

    Copyright © 2024 jiaojiaodubai<jiaojiaodubai23@gmail.com>

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
	// abbreviation of "article detail"
	if (url.includes('/aD/')) {
		return 'bookSection';
	}
	return false;
}

async function doWeb(doc, url) {
	const sectionRespond = await requestJSON(`https://www.jikan.com.cn/admin/api/article/detail?${tryMatch(url, /\bid=[^&]+/)}`);
	const sectionProxy = genProxy(sectionRespond.data);
	const newItem = new Z.Item('bookSection');
	newItem.title = sectionProxy.title;
	newItem.abstractNote = sectionProxy.abstractCn;
	newItem.bookTitle = sectionProxy.collectedPapersName;
	newItem.volume = sectionProxy.collectnum;
	newItem.date = sectionProxy.releaseDate;
	newItem.pages = sectionProxy.bookNums;
	newItem.language = 'zh-CN';
	newItem.url = `https://www.jikan.com.cn/aD/a?${tryMatch(url, /\bid=[^&]+/)}`;
	newItem.libraryCatalog = '集刊全文数据库';
	const names = sectionProxy.author.split(' ');
	const creatorsExt = [];
	for (const name of names) {
		const creator = cleanAuthor(name.replace(/^〔.+?〕/, ''), 'author');
		newItem.creators.push(JSON.parse(JSON.stringify(creator)));
		creator.country = tryMatch(name, /^〔(.+?)〕/, 1);
		creatorsExt.push(creator);
	}
	if (creatorsExt.some(creator => creator.country)) {
		newItem.extra = `creatorsExt: ${JSON.stringify(creatorsExt)}`;
	}
	doc.querySelectorAll('.keywords-wrap > p').forEach(elm => newItem.tags.push(elm.textContent));
	try {
		const bookRespond = await requestJSON(`https://www.jikan.com.cn/admin/api/book/detail?id=${sectionProxy.bookId}`);
		const bookProxy = genProxy(bookRespond.data);
		newItem.publisher = bookProxy.publisher;
		newItem.ISBN = ZU.cleanISBN(bookProxy.isbn);
		bookProxy.author.split(' ').forEach(name => newItem.creators.push(cleanAuthor(name, 'editor')));
	}
	catch (error) {
		Z.debug(error);
	}
	newItem.complete();
}

function genProxy(raw) {
	const handler = {
		get(target, prop) {
			const value = target[prop];
			return value === null
				? ''
				: value;
		},
	};
	return new Proxy(raw, handler);
}

function tryMatch(string, pattern, index = 0) {
	if (!string) return '';
	const match = string.match(pattern);
	return (match && match[index])
		? match[index]
		: '';
}


function cleanAuthor(creator, creatorType = 'author') {
	creator = ZU.cleanAuthor(creator, creatorType);
	if (/[\u4e00-\u9fa5]/.test(creator.lastName)) {
		creator.lastName = creator.lastName.replace(/\.\s*/g, '. ');
		creator.fieldMode = 1;
	}
	return creator;
}

/** BEGIN TEST CASES **/
var testCases = [
	{
		"type": "web",
		"url": "https://www.jikan.com.cn/aD/a?id=2703546",
		"items": [
			{
				"itemType": "bookSection",
				"title": "关于民族志、历史及法律的几点思考",
				"creators": [
					{
						"firstName": "",
						"lastName": "劳伦斯·M. 弗里德曼",
						"creatorType": "author",
						"fieldMode": 1
					},
					{
						"firstName": "",
						"lastName": "王伟臣",
						"creatorType": "author",
						"fieldMode": 1
					},
					{
						"firstName": "",
						"lastName": "吴婷",
						"creatorType": "author",
						"fieldMode": 1
					},
					{
						"firstName": "",
						"lastName": "里赞",
						"creatorType": "editor",
						"fieldMode": 1
					},
					{
						"firstName": "",
						"lastName": "刘昕杰",
						"creatorType": "editor",
						"fieldMode": 1
					}
				],
				"date": "2021-10-01",
				"ISBN": "9787520192743",
				"abstractNote": "古典民族志有两大贡献，一是局外人的视角，二是文化相对性的论断。除此之外，民族志还是一种观察研究对象的技术或方法，可以弥补定量研究的缺陷。几乎关于人类社会的每一项重要研究都使用或暗含了民族志的研究方法。司法档案确实说明了一些案件事实，但我们必须学会批判式地解读。研究人员应该成为这些档案文件语言的解读者。档案研究、历史研究、司法档案的解读分析，归根结底都是民族志研究。",
				"bookTitle": "法律史评论",
				"extra": "creatorsExt: [{\"firstName\":\"\",\"lastName\":\"劳伦斯·M. 弗里德曼\",\"creatorType\":\"author\",\"fieldMode\":1,\"country\":\"美\"},{\"firstName\":\"\",\"lastName\":\"王伟臣\",\"creatorType\":\"author\",\"fieldMode\":1,\"country\":\"\"},{\"firstName\":\"\",\"lastName\":\"吴婷\",\"creatorType\":\"author\",\"fieldMode\":1,\"country\":\"\"}]",
				"language": "zh-CN",
				"libraryCatalog": "集刊全文数据库",
				"pages": "181-186",
				"publisher": "社会科学文献出版社",
				"url": "https://www.jikan.com.cn/aD/a?id=2703546",
				"volume": "17",
				"attachments": [],
				"tags": [
					{
						"tag": "司法档案"
					},
					{
						"tag": "定性研究"
					},
					{
						"tag": "民族志"
					},
					{
						"tag": "法律史"
					}
				],
				"notes": [],
				"seeAlso": []
			}
		]
	}
]
/** END TEST CASES **/
