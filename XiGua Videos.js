{
	"translatorID": "4248f9cf-a6ac-49f1-a0f0-d8d6648dac42",
	"label": "XiGua Videos",
	"creator": "yfdyh000",
	"target": "https?://www.ixigua.com/(\\d+|search\\/)",
	"minVersion": "5.0",
	"maxVersion": "",
	"priority": 100,
	"inRepository": true,
	"translatorType": 4,
	"browserSupport": "gcsibv",
	"lastUpdated": "2023-12-15 10:57:43"
}

/*
	***** BEGIN LICENSE BLOCK *****

	Copyright © 2023 YFdyh000

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

function doDebug() {
	scrapeProfile('https://www.ixigua.com/home/6519449097/', '');
}

function detectWeb(doc, url) {
	//doDebug();
	if (doc.querySelectorAll('.videoTitle').length > 0) {
		return 'videoRecording';
	}
	else if (doc.querySelectorAll('.teleplayPage__Description__header>h1').length > 0) { // FIXME: 支持不完整
		return 'film'; // or tvBroadcast
	}
	else if (getSearchResults(doc, true)) {
		return 'multiple';
	}
	return false;
}

/**
 * @param {boolean} [checkOnly]
 */
function getSearchResults(doc, checkOnly) {
	var items = {};
	var found = false;
	var rows = doc.querySelectorAll('a.HorizontalFeedCard__title');
	for (let row of rows) {
		let href = row.href;
		let title = ZU.trimInternal(row.textContent);
		if (!href || !title) continue;
		if (checkOnly) return true;
		href = href.replace(/\?&$/, ''); // cleanup
		found = true;
		items[href] = title;
	}
	return found ? items : false;
}

async function doWeb(doc, url) {
	if (detectWeb(doc, url) == "multiple") {
		let items = await Zotero.selectItems(getSearchResults(doc, false));
		if (!items) return;
		for (let url of Object.keys(items)) {
			await scrape(await requestDocument(url), url);
		}
	}
	else {
		await scrape(doc, url);
	}
}

var isRegistered = false;
async function registerCookies() {
	if (isRegistered) return;
	let data = await requestJSON('https://ttwid.bytedance.com/ttwid/union/register/', {
		method: 'POST',
		body: '{"region":"cn","aid":1768,"needFid":false,"service":"www.ixigua.com","migrate_info":{"ticket":"","source":"node"},"cbUrlProtocol":"https","union":true}'
	});
	if (data.status_code === 0) {
		await requestText(data.redirect_url);
		isRegistered = true;
	}
}

/**
 * @param {Date} date
 */
function beautifyDate(date) {
	const year = date.getFullYear();
	const month = String(date.getMonth() + 1).padStart(2, '0');
	const day = String(date.getDate()).padStart(2, '0');
	const hours = String(date.getHours()).padStart(2, '0');
	const minutes = String(date.getMinutes()).padStart(2, '0');
	const seconds = String(date.getSeconds()).padStart(2, '0');
	const formattedDateTime = `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
	return formattedDateTime;
}

function formatRunningTime(seconds) {
	const hours = Math.floor(seconds / 3600);
	const minutes = Math.floor((seconds % 3600) / 60);
	const remainingSeconds = seconds % 60;

	const formattedHours = hours > 0 ? hours.toString().padStart(1, '0') + ':' : '';
	const formattedMinutes = minutes.toString().padStart(2, '0');
	const formattedSeconds = remainingSeconds.toString().padStart(2, '0');

	return `${formattedHours}${formattedMinutes}:${formattedSeconds}`;
}

function texts(doc, selector, separator = '\n') {
	let el = doc.querySelectorAll(selector);
	let text = '';
	if (el.length === 0) return null;
	for (let e of Array.from(el)) {
		let newText = ZU.trim(e.textContent);
		if (newText) text += newText + separator;
	}
	return text;
}

// #############################
// ##### Scraper functions #####
// #############################

/**
 * @param {string} url
 * @param {string} referrer
 */
async function scrapeProfile(url, referrer) {
	await registerCookies();
	const profileDoc = await requestDocument(url, { headers: { Referer: referrer } }); // referrer非必选，有正确cookie就行

	let userInfo = texts(profileDoc, '.userDetailV3__header__textInfo p'); // 认证、简介
	let userExtraInfo = texts(profileDoc, '.userDetailV3__header__extra-info span'); // IP属地、MCN。
	let userStatInfo = texts(profileDoc, '.userDetailV3__header__detail2>div>span'); // 关注/粉丝/获赞。现有格式不佳。
	return userInfo + userExtraInfo + userStatInfo;
}

async function scrape(doc, url = doc.location.href) {
	let itemType = "videoRecording";
	let newItem = new Zotero.Item(itemType);
	newItem.url = url;

	let title = text(doc, '.videoTitle>h1').trim() || text(doc, '.teleplayPage__Description__header>h1').trim();
	if (!title) return false;
	newItem.title = title;

	newItem.abstractNote = text(doc, '.videoDesc__contentWrapper');
	let dateUnix = parseInt(attr(doc, '.videoDesc__publishTime', 'data-publish-time')); // alternative, meta[]
	if (dateUnix > 0) {
		let date = new Date(dateUnix * 1000);
		//newItem.date =date.toISOString() // ISO UTC
		newItem.date = beautifyDate(date);
	}

	newItem.studio = text(doc, '.author__userName .user__name');
	newItem.runningTime = formatRunningTime(attr(doc, 'meta[name="op:video:duration"]', 'content'));
	let viewStat = text(doc, '.videoDesc__videoStatics');
	if (viewStat.includes('条弹幕 ·')) {
		viewStat = viewStat.substring(0, viewStat.indexOf('条弹幕 ·') + '条弹幕'.length);
	}
	else {
		viewStat = viewStat.substring(0, viewStat.indexOf('次观看 ·') + '次观看'.length);
	}

	let userinfo = '';
	const originDomain = new URL(doc.location.href).origin;
	if (text(doc, '.co-creator-list')) { // 多人共创
		for (let p of doc.querySelectorAll('.co-creator-list .co-creator-list__item')) {
			let pname = text(p, '.co-creator-list__item-name');
			let proleLabel = text(p, '.co-creator-list__item-role');
			let prole;
			switch (proleLabel) {
				case '作者':
					prole = 'director'; break;
				case '出镜':
					prole = 'castMember'; break;
				case '策划':
					prole = 'scriptwriter'; break;
				case '后期':
					prole = 'producer'; break;
				case '录制':
					prole = 'contributor'; break;
				default:
					prole = 'contributor'; break;
			}
			newItem.creators.push({
				lastName: pname,
				creatorType: prole
			});
			const profileUrl = attr(p, '.co-creator-list__item-name', 'href');
			if (profileUrl) {
				newItem.seeAlso.push(originDomain + profileUrl);
			}
			if (newItem.seeAlso.length > 0) {
				userinfo = await scrapeProfile(newItem.seeAlso[0], doc.location.href);
			}
		}
	}
	else {
		newItem.creators.push({
			lastName: text(doc, '.author__userName .user__name'),
			creatorType: "author"
		});
		const profileUrl = attr(doc, '.author__userName', 'href');
		if (profileUrl) {
			newItem.seeAlso.push(originDomain + profileUrl);
			userinfo = await scrapeProfile(originDomain + profileUrl, doc.location.href);
		}
	}
	let voteupCount = attr(doc, '.video_action_item--like', 'aria-label');
	let commentCount = text(doc, '.new-comment-count');
	let authorStat = text(doc, '.author_statics');
	if (authorStat)authorStat = '作者: ' + authorStat;
	newItem.extra = `${viewStat}\n${voteupCount}\n${commentCount}\n\n${authorStat}\n\n${userinfo}`;
	// FIXME: 部分元素是动态加载，multiple时取不到。
	newItem.complete();
}

/** BEGIN TEST CASES **/
var testCases = [
	{
		"type": "web",
		"url": "https://www.ixigua.com/7236669158899843621",
		"items": [
			{
				"itemType": "videoRecording",
				"title": "终极迎战歼-20！美军拿F-35练兵做准备",
				"creators": [
					{
						"lastName": "央视网",
						"creatorType": "author"
					}
				],
				"date": "2023-05-24 16:52:18",
				"extra": "原创 · 1386万次观看\n109390个点赞\n665 条评论\n\n作者: 4207万粉丝 · 125856视频\n\n认证：央视网新闻频道官方账号\n简介：央视网原创内容，包含热点解析，精彩图片，说新闻等。\nIP属地： 北京\n所属MCN： 央视网\n2\n关注\n4207万\n粉丝\n40862.4万\n获赞",
				"libraryCatalog": "XiGua Videos",
				"runningTime": "00:28",
				"studio": "央视网",
				"url": "https://www.ixigua.com/7236669158899843621",
				"attachments": [],
				"tags": [],
				"notes": [],
				"seeAlso": [
					"https://www.ixigua.com/home/50025817786/"
				]
			}
		]
	},
	{
		"type": "web",
		"url": "https://www.ixigua.com/7308738714326041151",
		"items": [
			{
				"itemType": "videoRecording",
				"title": "票选！超十万莫斯科市民为旅俄大熊猫幼崽定名",
				"creators": [
					{
						"lastName": "央视网",
						"creatorType": "author"
					}
				],
				"date": "2023-12-04 21:58:59",
				"abstractNote": "票选！超十万莫斯科市民为旅俄大熊猫幼崽定名",
				"extra": "原创 · 4.1万次观看\n1648个点赞\n98 条评论\n\n作者: 4207万粉丝 · 125856视频\n\n认证：央视网新闻频道官方账号\n简介：央视网原创内容，包含热点解析，精彩图片，说新闻等。\nIP属地： 北京\n所属MCN： 央视网\n2\n关注\n4207万\n粉丝\n40862.4万\n获赞",
				"libraryCatalog": "XiGua Videos",
				"runningTime": "00:28",
				"studio": "央视网",
				"url": "https://www.ixigua.com/7308738714326041151",
				"attachments": [],
				"tags": [],
				"notes": [],
				"seeAlso": [
					"https://www.ixigua.com/home/50025817786/"
				]
			}
		]
	},
	{
		"type": "web",
		"url": "https://www.ixigua.com/7277151693161103932",
		"items": [
			{
				"itemType": "videoRecording",
				"title": "刀郎新歌《序曲》气势十足，配上这样的画面，太令人震撼了",
				"creators": [
					{
						"lastName": "最久音乐",
						"creatorType": "author"
					}
				],
				"date": "2023-09-10 19:05:12",
				"abstractNote": "刀郎新歌《序曲》气势十足，配上这样的画面，太令人震撼了",
				"extra": "原创 · 13.3万次观看 · 179条弹幕\n1758个点赞\n189 条评论\n\n作者: 225万粉丝 · 2142视频\n\n认证：优质音乐领域创作者\n简介：好听的音乐，好看的MV都在这里了，喜欢记得给我一个关注哦！\nIP属地： 四川\n所属MCN： 最久音乐\n35\n关注\n225万\n粉丝\n570万\n获赞",
				"libraryCatalog": "XiGua Videos",
				"runningTime": "03:18",
				"studio": "最久音乐",
				"url": "https://www.ixigua.com/7277151693161103932",
				"attachments": [],
				"tags": [],
				"notes": [],
				"seeAlso": [
					"https://www.ixigua.com/home/57142156659/"
				]
			}
		]
	},
	{
		"type": "web",
		"url": "https://www.ixigua.com/6569375701898625550",
		"detectedItemType": "film",
		"items": [
			{
				"itemType": "videoRecording",
				"title": "大宅男",
				"creators": [],
				"extra": "819 条评论\n\n作者: 466.2万粉丝",
				"libraryCatalog": "XiGua Videos",
				"runningTime": "00:00",
				"url": "https://www.ixigua.com/6569375701898625550",
				"attachments": [],
				"tags": [],
				"notes": [],
				"seeAlso": []
			}
		]
	},
	{
		"type": "web",
		"url": "https://www.ixigua.com/7278659914560438825",
		"items": [
			{
				"itemType": "videoRecording",
				"title": "#星球重启 #外星降临怎么活  外星人按当地习俗办，泡酒！怎么样",
				"creators": [
					{
						"lastName": "大漠叔叔",
						"creatorType": "director"
					},
					{
						"lastName": "开普勒星人",
						"creatorType": "castMember"
					},
					{
						"lastName": "孙国帅八龙",
						"creatorType": "castMember"
					}
				],
				"date": "2023-09-14 20:37:52",
				"extra": "9.7万次观看 · 87条弹幕\n2902个点赞\n337 条评论\n\n\n\n认证：优质vlog领域创作者\n简介：漠叔叔的VLOG（已认证）其他号非本人号。\nIP属地： 海南\n18\n关注\n1076万\n粉丝\n612.6万\n获赞",
				"libraryCatalog": "XiGua Videos",
				"runningTime": "09:59",
				"url": "https://www.ixigua.com/7278659914560438825",
				"attachments": [],
				"tags": [],
				"notes": [],
				"seeAlso": [
					"https://www.ixigua.com/home/69527923933/",
					"https://www.ixigua.com/home/290723363298589/",
					"https://www.ixigua.com/home/3953446705184462/"
				]
			}
		]
	},
	{
		"type": "web",
		"url": "https://www.ixigua.com/6835408048324870670",
		"items": [
			{
				"itemType": "videoRecording",
				"title": "汽车兵硬核比武现场！看完怀疑自己驾照是假的……",
				"creators": [
					{
						"lastName": "新华网",
						"creatorType": "author"
					}
				],
				"date": "2020-06-07 09:14:15",
				"abstractNote": "连续障碍路驾驶、原地紧急调头、高速连续绕弯......这些不是电影里的特技，而是汽车兵的日常训练课目。近日，新疆军区某合成师组织了一场驾驶专业比武，驾驶员在实战背景下进行多课目连贯考核，充分展现了汽车兵的速度与激情。",
				"extra": "970.8万次观看\n61955个点赞\n5056 条评论\n\n作者: 5557万粉丝 · 31190视频\n\n认证：新华网官方账号\n简介：引领品质阅读，让新闻离你更近！\nIP属地： 北京\n所属MCN： 新华网\n6\n关注\n5557万\n粉丝\n19941.8万\n获赞",
				"libraryCatalog": "XiGua Videos",
				"runningTime": "01:00",
				"studio": "新华网",
				"url": "https://www.ixigua.com/6835408048324870670",
				"attachments": [],
				"tags": [],
				"notes": [],
				"seeAlso": [
					"https://www.ixigua.com/home/4377795668/"
				]
			}
		]
	}
]
/** END TEST CASES **/
