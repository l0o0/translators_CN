{
	"translatorID": "f9b132f7-8504-4a8f-b423-b61c8dae4783",
	"label": "BiliBili",
	"creator": "Felix Hui, jiaojiaoduabi",
	"target": "https?://(search|www)\\.bilibili\\.com",
	"minVersion": "3.0",
	"maxVersion": "",
	"priority": 100,
	"inRepository": true,
	"translatorType": 4,
	"browserSupport": "gcsibv",
	"lastUpdated": "2024-09-07 16:16:51"
}

/*
	***** BEGIN LICENSE BLOCK *****

	Copyright © 2020 Felix Hui

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

// API 參考: https://github.com/SocialSisterYi/bilibili-API-collect

function detectWeb(doc, url) {
	if (getSearchResults(doc, true)) {
		return 'multiple';
	}
	else if (url.includes('/play/')) {
		return 'tvBroadcast';
	}
	else if (url.includes('/video/')) {
		return 'videoRecording';
	}
	return false;
}

function getSearchResults(doc, checkOnly) {
	var items = {};
	var found = false;
	let url = doc.location.href;
	let type = multiType.find(type => type.urlPattern.test(url) && doc.querySelector(type.selector)
	);
	Z.debug('get multiple type:');
	Z.debug(type);
	if (!type) return false;
	var rows = doc.querySelectorAll(type.selector);
	if (type.selector == '.search-content a') {
		rows = Array.from(rows).filter(row => (row.title || row.querySelector('h3'))
		);
	}
	for (let i = 0; i < rows.length; i++) {
		let row = rows[i];
		let href = [/\/ss\d+/, /\/md\d+/].find(pattern => pattern.test(url))
			? `${i}`
			: row.href;
		let title = type.getTitle(row);
		if (!href || !title) continue;
		if (checkOnly) return true;
		found = true;
		items[href] = title;
	}
	return found ? items : false;
}

const multiType = [
	{
		selector: '.search-content a',
		urlPattern: /\/\/search\./,
		getTitle: function (row) {
			return ZU.trimInternal(row.textContent);
		}
	},
	{
		selector: '#multi_page a',
		urlPattern: /\/video\//,
		getTitle: function (row) {
			return `${text(row, '.page-num')}    ${text(row, '.part')}`;
		}
	},
	{
		selector: 'div[class^="eplist"] a',
		urlPattern: /bangumi\/play\/ss\d+/,
		getTitle: function (row) {
			return `第${ZU.trimInternal(row.textContent)}集`;
		}
	},
	{
		selector: '.section-item [class^="season-title"]',
		urlPattern: /cheese\/play\/ss\d+/,
		getTitle: function (row) {
			return ZU.trimInternal(row.textContent);
		}
	},
	{
		selector: '.sl-ep-list li[title]',
		urlPattern: /bangumi\/media\/md\d+/,
		getTitle: function (row) {
			return ZU.trimInternal(row.textContent);
		}
	}
];

async function doWeb(doc, url) {
	if (detectWeb(doc, url) == 'multiple') {
		Z.debug('this is a multiple page');
		let items = await Zotero.selectItems(getSearchResults(doc, false));
		if (!items) return;
		Z.debug(`select items:`);
		Z.debug(items);
		if (/\/ss\d+/.test(url)) {
			let par = await getInfo(url);
			for (let url of Object.keys(items)) {
				par.url = url;
				await scrape(par);
			}
		}
		else if (/\/md\d+/.test(url)) {
			let json = await requestJSON(`https://api.bilibili.com/pgc/review/user?media_id=${url.match(/\/md(\d+)/)[1]}`);
			// Z.debug(json);
			if (json.code === 0) {
				let par = await getInfo(`https://www.bilibili.com/bangumi/play/ss${json.result.media.season_id}`);
				for (let url of Object.keys(items)) {
					par.url = url;
					await scrape(par);
				}
			}
		}
		else {
			for (let url of Object.keys(items)) {
				await scrape(await getInfo(url));
			}
		}
	}
	else {
		await scrape(await getInfo(url));
	}
}

async function getInfo(url) {
	let type = singleType.find(type => url.includes(type.url));

	/* get basic info */
	var requestBody = '';
	for (const key in type.id) {
		if (type.id[key].test(url)) {
			// Z.debug(url.match(type.id[key]));
			let idLabel = key;
			let idSerial = url.match(type.id[key])[1];
			requestBody = `${idLabel}=${idSerial}`;
		}
	}
	let json = await requestJSON(`${type.api}?${requestBody}`);
	Z.debug('getInfo reurn:');
	Z.debug(json);
	return { url: url, type: type, json: json };
}

const singleType = [
	{
		// https://www.bilibili.com/video/av97308827
		// https://www.bilibili.com/video/BV1P7411R7bF
		dbType: 'video',
		itemType: 'videoRecording',
		url: '/video/',
		id: {
			aid: /av(\d+)/,
			bvid: /\/BV([\da-zA-z]*)/
		},
		api: 'https://api.bilibili.com/x/web-interface/view',
		keyNode: 'data',
		// api: 'https://api.bilibili.com/x/web-interface/view/detail',
		toItem: function (url, json) {
			let tempItem = {};
			tempItem.title = json.title;
			tempItem.abstractNote = json.desc;
			tempItem.date = secondsToDate(json.pubdate);
			tempItem.runningTime = secondsToTime(json.duration);
			tempItem.url = url;
			tempItem.libraryCatalog = json.tname;
			tempItem.creators = [ZU.cleanAuthor(
				json.owner.name,
				json.copyright > 1
					? 'contributor'
					: 'director'
			)];
			if (/\?p=(\d+)/.test(url)) {
				let index = parseInt(url.match(/\?p=(\d+)/)[1]) - 1;
				tempItem.title = json.pages[index].part;
				tempItem.seriesTitle = json.title;
				tempItem.volume = index + 1;
				tempItem.numberOfVolumes = json.pages.length;
				tempItem.runningTime = json.pages[index].duration;
			}
			if (json.staff) {
				json.staff.slice(1).forEach(element => tempItem.creators.push(ZU.cleanAuthor(element.name, 'castMember'))
				);
			}
			tempItem.extra = `like: ${json.stat.like}\nview: ${json.stat.view}`;
			return tempItem;
		}
	},
	{
		// 番剧
		// https://www.bilibili.com/bangumi/play/ep250585
		// https://www.bilibili.com/bangumi/play/ss42290
		dbType: 'bangumi',
		itemType: 'tvBroadcast',
		url: '/bangumi/play/',
		id: {
			// follows  the json
			// eslint-disable-next-line
			season_id: /ss(\d+)/,
			// follows  the json
			// eslint-disable-next-line
			ep_id: /ep(\d+)/
		},
		api: 'https://api.bilibili.com/pgc/view/web/season',
		keyNode: 'result',
		toItem: function (url, json) {
			let tempItem = {};
			let ep = /^\d+/.test(url)
				// from multiple
				? json.episodes[url]
				// from single
				: json.episodes.find(element => element.id == url.match(/\/ep(\d+)/)[1]);
			tempItem.title = [ep.long_title, json.title, ep.share_copy].find(element => element);
			tempItem.programTitle = json.title;
			tempItem.abstractNote = ZU.trimInternal(json.evaluate);
			tempItem.episodeNumber = json.episodes.indexOf(ep) + 1;
			tempItem.place = json.areas.map(element => element.name).join('; ');
			tempItem.date = secondsToDate(ep.pub_time);
			tempItem.runningTime = secondsToTime(ep.duration / 1000);
			tempItem.url = ep.link;
			if (ep.link.includes('movie')) {
				tempItem.itemType = 'film';
			}
			tempItem.rights = json.rights.copyright;
			tempItem.creators = Array.from(new Set(
				json.staff.split(/[\n,;，；、]/).map(element => element.replace(/^.*：/, '')
				))).map(element => ZU.cleanAuthor(element, 'contributor'));
			tempItem.extra = `like: ${json.stat.likes}\nview: ${json.stat.views}`;
			return tempItem;
		}
	},
	{
		// 課程
		// https://www.bilibili.com/cheese/play/ep1491
		dbType: 'cheese',
		itemType: 'tvBroadcast',
		url: '/cheese/play/',
		id: {
			// follows  the json
			// eslint-disable-next-line
			season_id: /ss(\d+)/,
			// follows  the json
			// eslint-disable-next-line
			ep_id: /ep(\d+)/
		},
		api: 'https://api.bilibili.com/pugv/view/web/season',
		keyNode: 'data',
		toItem: function (url, json) {
			let tempItem = {};
			let ep = /^\d+/.test(url)
				? json.episodes[url.match(/^\d+/)[0]]
				: json.episodes.find(element => element.id == url.match(/\/ep(\d+)/)[1]);
			tempItem.title = ep.title;
			tempItem.programTitle = json.title;
			tempItem.abstractNote = json.subtitle;
			tempItem.episodeNumber = ep.index;
			tempItem.date = secondsToDate(ep.release_date);
			tempItem.runningTime = secondsToTime(ep.duration);
			tempItem.url = `https://www.bilibili.com/cheese/play/ep${ep.id}`;
			tempItem.creators = [json.up_info.uname].map(element => ZU.cleanAuthor(element, 'director'));
			return tempItem;
		}
	}
];

async function scrape({ url, type, json }) {
	var newItem = new Z.Item(type.itemType);
	// Z.debug(json);
	if (json.code === 0) {
		json = json[type.keyNode];
		newItem = Object.assign(newItem, type.toItem(url, json));
		newItem.creators.forEach((creator) => {
			if (/[\u4e00-\u9fa5]/.test(creator.lastName)) {
				creator.fieldMode = 1;
			}
		});

		/* get tags */
		switch (type.dbType) {
			case 'video': {
				Z.debug(type.id.bvid.toString());
				const bvid = url.match(type.id.bvid);
				const avid = url.match(type.id.aid);
				let jsonUrl;
				if (bvid && bvid[1]) {
					jsonUrl = `https://api.bilibili.com/x/tag/archive/tags?bvid=${bvid[1]}`;
				}
				else if (avid && avid[1]) {
					jsonUrl = `https://api.bilibili.com/x/tag/archive/tags?aid=${avid[1]}`;
				}
				else {
					Z.debug(`url is malformation for getting tags`);
					break;
				}
				let tags = await requestJSON(jsonUrl);
				Z.debug(`tags`);
				Z.debug(tags);
				if (tags.code == 0) {
					tags = tags.data;
					for (const tag of tags) {
						newItem.tags.push(tag.tag_name);
					}
				}
				break;
			}
			case 'bangumi': {
				json.styles.forEach(element => newItem.tags.push(element));
				break;
			}
			default:
				break;
		}
		newItem.complete();
	}
}

function secondsToTime(seconds) {
	let hours = Math.floor(seconds / 3600);
	let minutes = Math.floor((seconds % 3600) / 60).toString().padStart(2, '0');
	let remainingSeconds = (seconds % 60).toString().padStart(2, '0');
	return `${hours}:${minutes}:${remainingSeconds}`;
}

function secondsToDate(seconds) {
	let date = new Date(seconds * 1000);
	let year = date.getFullYear();
	let month = (date.getMonth() + 1).toString().padStart(2, '0');
	let day = (date.getDate()).toString().padStart(2, '0');
	return `${year}-${month}-${day}`;
}

/** BEGIN TEST CASES **/
var testCases = [
	{
		"type": "web",
		"url": "https://search.bilibili.com/all?keyword=%E3%80%90%E4%B8%AD%E5%AD%97%E3%80%91%E7%B2%89%E9%9B%84%E6%95%91%E5%85%B5%EF%BC%9A%E6%88%91%E4%BB%AC%E5%9C%A8%E6%97%A5%E6%9C%AC",
		"items": "multiple"
	},
	{
		"type": "web",
		"url": "https://www.bilibili.com/bangumi/media/md28227662/",
		"items": "multiple"
	},
	{
		"type": "web",
		"url": "https://www.bilibili.com/video/BV19E41197Kc/",
		"items": "multiple"
	},
	{
		"type": "web",
		"url": "https://www.bilibili.com/video/BV1PK411L7h5/",
		"items": [
			{
				"itemType": "videoRecording",
				"title": "鼓乐《兰陵王入阵曲》耳机开最大！来听千军万马！！！",
				"creators": [
					{
						"firstName": "",
						"lastName": "共青团中央",
						"creatorType": "director",
						"fieldMode": 1
					},
					{
						"firstName": "",
						"lastName": "柳青瑶本尊",
						"creatorType": "castMember",
						"fieldMode": 1
					},
					{
						"firstName": "",
						"lastName": "中国鼓王佳男",
						"creatorType": "castMember",
						"fieldMode": 1
					},
					{
						"firstName": "",
						"lastName": "青瑶原创作品空间",
						"creatorType": "castMember",
						"fieldMode": 1
					},
					{
						"firstName": "",
						"lastName": "轩龙鸽鸽",
						"creatorType": "castMember",
						"fieldMode": 1
					},
					{
						"firstName": "",
						"lastName": "金大王gold",
						"creatorType": "castMember",
						"fieldMode": 1
					}
				],
				"date": "2020-04-02",
				"abstractNote": "作曲：青瑶\n编曲：金大王gold\n\n\n录音：张洋\n混音：徐晓晖\n琵琶：青瑶\n中国鼓：王佳男（著名国乐大师，中国歌剧舞剧院首席打击乐演奏家）",
				"extra": "like: 1318443\nview: 22127322",
				"libraryCatalog": "演奏",
				"runningTime": "0:04:59",
				"url": "https://www.bilibili.com/video/BV1PK411L7h5/",
				"attachments": [],
				"tags": [
					{
						"tag": "中国华服日"
					},
					{
						"tag": "中国鼓"
					},
					{
						"tag": "动感视频"
					},
					{
						"tag": "古风"
					},
					{
						"tag": "国风新风尚"
					},
					{
						"tag": "柳青瑶"
					},
					{
						"tag": "汉服"
					},
					{
						"tag": "王佳男"
					},
					{
						"tag": "琵琶"
					}
				],
				"notes": [],
				"seeAlso": []
			}
		]
	},
	{
		"type": "web",
		"url": "https://www.bilibili.com/bangumi/play/ep30478",
		"items": [
			{
				"itemType": "tvBroadcast",
				"title": "种花家的崛起",
				"creators": [
					{
						"firstName": "",
						"lastName": "逆光飞行",
						"creatorType": "contributor",
						"fieldMode": 1
					},
					{
						"firstName": "",
						"lastName": "十一",
						"creatorType": "contributor",
						"fieldMode": 1
					},
					{
						"firstName": "",
						"lastName": "梁园",
						"creatorType": "contributor",
						"fieldMode": 1
					},
					{
						"firstName": "",
						"lastName": "追梦赤子心",
						"creatorType": "contributor",
						"fieldMode": 1
					},
					{
						"firstName": "",
						"lastName": "张缘",
						"creatorType": "contributor",
						"fieldMode": 1
					},
					{
						"firstName": "",
						"lastName": "翼下之风",
						"creatorType": "contributor",
						"fieldMode": 1
					},
					{
						"firstName": "",
						"lastName": "厦门翼下之风动漫科技有限公司",
						"creatorType": "contributor",
						"fieldMode": 1
					}
				],
				"date": "2015-3-5",
				"abstractNote": "本片讲述了一群兔子是怎么从种花家一穷二白的时候，通过自身的努力与奋斗，蹬了鹰酱一脸血，并且养殖出了自己的大蘑菇，发展成为蓝星最强五流氓之一的故事。本片故事纯属虚构，如有雷同，纯属巧合。本片漫画更新频繁，对于喜欢作者拖更的观众可能会稍感不适。",
				"episodeNumber": 1,
				"extra": "like: 2135797\nview: 213711534",
				"libraryCatalog": "BiliBili",
				"place": "中国大陆",
				"programTitle": "那年那兔那些事儿 第一季",
				"rights": "bilibili",
				"runningTime": "0:7:32",
				"url": "https://www.bilibili.com/bangumi/play/ep30478",
				"attachments": [],
				"tags": [
					{
						"tag": "历史"
					},
					{
						"tag": "漫画改"
					},
					{
						"tag": "萌系"
					}
				],
				"notes": [],
				"seeAlso": []
			}
		]
	},
	{
		"type": "web",
		"url": "https://www.bilibili.com/bangumi/play/ss1689",
		"items": "multiple"
	},
	{
		"type": "web",
		"url": "https://www.bilibili.com/cheese/play/ss104",
		"items": "multiple"
	},
	{
		"type": "web",
		"url": "https://www.bilibili.com/cheese/play/ep1491",
		"items": [
			{
				"itemType": "tvBroadcast",
				"title": "28 财政政策：川普为什么加大开支？",
				"creators": [
					{
						"firstName": "",
						"lastName": "陆铭教授",
						"creatorType": "director",
						"fieldMode": 1
					}
				],
				"date": "2020-5-7",
				"abstractNote": "把经济学300年的精华浓缩到30期课程",
				"episodeNumber": 29,
				"libraryCatalog": "BiliBili",
				"programTitle": "上海交大陆铭教授的经济学思维课",
				"runningTime": "0:23:3",
				"url": "https://www.bilibili.com/cheese/play/ep1491",
				"attachments": [],
				"tags": [],
				"notes": [],
				"seeAlso": []
			}
		]
	},
	{
		"type": "web",
		"url": "https://www.bilibili.com/bangumi/play/ep788606",
		"detectedItemType": "tvBroadcast",
		"items": [
			{
				"itemType": "film",
				"title": "飞屋环游记",
				"creators": [
					{
						"firstName": "",
						"lastName": "彼特·道格特",
						"creatorType": "contributor",
						"fieldMode": 1
					},
					{
						"firstName": "",
						"lastName": "鲍勃·彼德森",
						"creatorType": "contributor",
						"fieldMode": 1
					},
					{
						"firstName": "",
						"lastName": "汤姆·麦卡锡",
						"creatorType": "contributor",
						"fieldMode": 1
					}
				],
				"date": "2023-11-26",
				"abstractNote": "小男孩卡尔（Carl Fredricksen）怀揣着对于冒险的热爱偶遇假小子艾丽（Ellie），而艾丽把整个屋子当成一艘大飞船游戏居然使他对这个女孩子有些着迷，相同的爱好最终使两个人成为了一生的爱侣。 他们有一个梦想，那就是有朝一日要去南美洲的“仙境瀑布”探险，但直到艾丽去世，这个梦想也未能实现。终于有一天，曾经专卖气球的老人卡尔居然用五颜六色的气球拽着他的房子飞上了天空，他决定要去实现他们未曾实现的梦想。令卡尔始料不及的是，门廊居然搭上了一个自称是“荒野开拓者”的小男孩小罗（Russell），小罗的喋喋不休让卡尔对这个小胖墩格外讨厌。",
				"extra": "like: 14826\nview: 2115391",
				"libraryCatalog": "BiliBili",
				"rights": "bilibili",
				"runningTime": "1:32:50",
				"url": "https://www.bilibili.com/bangumi/play/ep788606?theme=movie",
				"attachments": [],
				"tags": [
					{
						"tag": "冒险"
					},
					{
						"tag": "剧情"
					},
					{
						"tag": "动画"
					},
					{
						"tag": "喜剧"
					}
				],
				"notes": [],
				"seeAlso": []
			}
		]
	},
	{
		"type": "web",
		"url": "https://www.bilibili.com/bangumi/media/md28227662/",
		"items": "multiple"
	},
	{
		"type": "web",
		"url": "https://www.bilibili.com/video/av1305985741/",
		"items": [
			{
				"itemType": "videoRecording",
				"title": "让学霸医生都头疼的「偏头痛」，究竟要怎么办？",
				"creators": [
					{
						"firstName": "",
						"lastName": "大物是也",
						"creatorType": "director",
						"fieldMode": 1
					},
					{
						"firstName": "",
						"lastName": "斑马酱锵锵锵",
						"creatorType": "castMember",
						"fieldMode": 1
					}
				],
				"date": "2024-06-19",
				"extra": "like: 31144\nview: 711087",
				"libraryCatalog": "科学科普",
				"runningTime": "0:21:13",
				"url": "https://www.bilibili.com/video/av1305985741/",
				"attachments": [],
				"tags": [
					{
						"tag": "2024科学很可爱"
					},
					{
						"tag": "偏头痛"
					},
					{
						"tag": "健康"
					},
					{
						"tag": "冥想"
					},
					{
						"tag": "北大医生"
					},
					{
						"tag": "医院"
					},
					{
						"tag": "头疼"
					},
					{
						"tag": "止痛药"
					},
					{
						"tag": "看病"
					},
					{
						"tag": "神经内科"
					},
					{
						"tag": "科学很可爱"
					}
				],
				"notes": [],
				"seeAlso": []
			}
		]
	},
	{
		"type": "web",
		"url": "https://www.bilibili.com/video/BV1VM4m1U7r4/",
		"items": [
			{
				"itemType": "videoRecording",
				"title": "让学霸医生都头疼的「偏头痛」，究竟要怎么办？",
				"creators": [
					{
						"firstName": "",
						"lastName": "大物是也",
						"creatorType": "director",
						"fieldMode": 1
					},
					{
						"firstName": "",
						"lastName": "斑马酱锵锵锵",
						"creatorType": "castMember",
						"fieldMode": 1
					}
				],
				"date": "2024-06-19",
				"extra": "like: 31144\nview: 711087",
				"libraryCatalog": "科学科普",
				"runningTime": "0:21:13",
				"url": "https://www.bilibili.com/video/BV1VM4m1U7r4/",
				"attachments": [],
				"tags": [
					{
						"tag": "2024科学很可爱"
					},
					{
						"tag": "偏头痛"
					},
					{
						"tag": "健康"
					},
					{
						"tag": "冥想"
					},
					{
						"tag": "北大医生"
					},
					{
						"tag": "医院"
					},
					{
						"tag": "头疼"
					},
					{
						"tag": "止痛药"
					},
					{
						"tag": "看病"
					},
					{
						"tag": "神经内科"
					},
					{
						"tag": "科学很可爱"
					}
				],
				"notes": [],
				"seeAlso": []
			}
		]
	}
]
/** END TEST CASES **/
