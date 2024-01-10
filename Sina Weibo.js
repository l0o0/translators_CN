{
	"translatorID": "231208c0-1a69-4f58-b0f7-4a78e5e057a5",
	"label": "Sina Weibo",
	"creator": "pixiandouban, jiaojiaodubai",
	"target": "^https?://.*weibo\\.com/",
	"minVersion": "4.0",
	"maxVersion": "",
	"priority": 100,
	"inRepository": true,
	"translatorType": 4,
	"browserSupport": "gcsibv",
	"lastUpdated": "2024-01-10 15:54:49"
}

/*
	***** BEGIN LICENSE BLOCK *****

	Weibo Translator
	Copyright © 2020-2021 pixiandouban, 2023 jiaojiaodubai
	
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
	if (/\/\d+\/[a-z\d]+/i.test(url)) {
		return 'blogPost';
	}
	else if (getSearchResults(doc, true)) {
		return 'multiple';
	}
	return false;
}

function getSearchResults(doc, checkOnly) {
	var items = {};
	var found = false;
	// article.woo-panel-main见于首页
	// [action-type="feed_list_item"]见于话题
	var rows = doc.querySelectorAll('article.woo-panel-main, [action-type="feed_list_item"]');
	// Z.debug(rows.length);
	for (let row of rows) {
		let href = attr(row, '.from > a, a[class*="head-info_time"]', 'href');
		// [class*="head_name"]、[class*="detail_wbtext"]见于首页
		// a[nick-name]、p[node-type="feed_list_content"]见于话题
		let title = `${text(row, '[class*="head_name"], a[nick-name]')}：${text(row, '[class*="detail_wbtext"], p[node-type="feed_list_content"]').substring(0, 30)}……`;
		if (!href || !title) continue;
		if (checkOnly) return true;
		found = true;
		items[href] = title;
	}
	return found ? items : false;
}

async function doWeb(doc, url) {
	if (detectWeb(doc, url) == 'multiple') {
		let rows = Array.from(doc.querySelectorAll('article.woo-panel-main, [action-type="feed_list_item"]'));
		let items = await Zotero.selectItems(getSearchResults(doc, false));
		if (!items) return;
		for (let url of Object.keys(items)) {
			let row = rows.find(row => row.querySelector(`a[href="${url}"]`));
			let href = row.querySelector('.from > a, a[class*="head-info_time"]').href;
			await scrape(row, href);
		}
	}
	else {
		await scrape(doc, url);
	}
}

async function scrape(doc, url = doc.location.href) {
	var newItem = new Z.Item('blogPost');
	newItem.extra = '';
	let detail = text(doc, '[class*="detail_wbtext"]');
	newItem.title = tryMatch(detail, /【(.+?)】/, 1).replace(/#/g, '')
		|| tryMatch(detail, /#(.+?)#/, 1)
		|| `${text(doc, '[class*="head_name"]')}的微博`;
	newItem.abstractNote = text(doc, '[class*="detail_wbtext"]');
	newItem.blogTitle = '新浪微博';
	newItem.date = ZU.strToISO(text(doc, '[class*="head-info_time"]'));
	newItem.url = tryMatch(url, /^.+?\/\d+\/[a-z\d]+/i) || url;
	newItem.language = 'zh-CN';
	newItem.extra += addExtra('reship', text(doc, '[class*="toolbar_num"]'));
	newItem.extra += addExtra('comments', text(doc, '[class*="toolbar_num"]', 1));
	newItem.extra += addExtra('likes', text(doc, '[class*="Detail_feed"] .woo-like-count') || text(doc, '.woo-like-count'));
	newItem.creators.push({
		firstName: '',
		lastName: text(doc, '[class*="head_name"]'),
		creatorType: 'author',
		fieldMode: 1
	});
	newItem.attachments.push({
		title: 'Snapshot',
		document: doc
	});
	newItem.complete();
}

/**
 * Attempts to get the part of the pattern described from the character,
 * and returns an empty string if not match.
 * @param {String} string
 * @param {RegExp} pattern
 * @param {Number} index
 * @returns
 */
function tryMatch(string, pattern, index = 0) {
	if (!string) return '';
	let match = string.match(pattern);
	return (match && match[index])
		? match[index]
		: '';
}

/**
 * When value is valid, return a key-value pair in string form.
 * @param {String} key
 * @param {*} value
 * @returns
 */
function addExtra(key, value) {
	return value
		? `${key}: ${value}\n`
		: '';
}

/** BEGIN TEST CASES **/
var testCases = [
	{
		"type": "web",
		"url": "https://weibo.com/newlogin?tabtype=weibo&gid=102803&openLoginLayer=0&url=https%3A%2F%2Fweibo.com%2F",
		"items": "multiple"
	},
	{
		"type": "web",
		"url": "https://weibo.com/newlogin?tabtype=weibo&gid=102803&openLoginLayer=0&url=https%3A%2F%2Fweibo.com%2F",
		"items": "multiple"
	},
	{
		"type": "web",
		"url": "https://weibo.com/7467277921/NBaFziUqv?refer_flag=1001030103_",
		"items": [
			{
				"itemType": "blogPost",
				"title": "大金砖来尔滨啦！迪拜小哥从沙漠来感受尔滨冬天",
				"creators": [
					{
						"firstName": "",
						"lastName": "西部决策",
						"creatorType": "author",
						"fieldMode": 1
					}
				],
				"date": "2010-01-24",
				"abstractNote": "【大金砖来尔滨啦！#迪拜小哥从沙漠来感受尔滨冬天# 】#全球媒体争相报道尔滨盛况# #尔滨大火引来迪拜大金砖# 1月9日，黑龙江哈尔滨。为感受哈尔滨的冬天，迪拜小哥特意从沙漠来到魅力四射的哈尔滨并手动点赞表示尔滨很棒。网友纷纷表示，尔滨欢迎国际友人！@西部决策 西部决策的微博视频 ​​​",
				"blogTitle": "新浪微博",
				"extra": "reship: 82\ncomments: 181\nlikes: 5203",
				"language": "zh-CN",
				"url": "https://weibo.com/7467277921/NBaFziUqv",
				"attachments": [
					{
						"title": "Snapshot",
						"mimeType": "text/html"
					}
				],
				"tags": [],
				"notes": [],
				"seeAlso": []
			}
		]
	}
]
/** END TEST CASES **/
