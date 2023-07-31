{
	"translatorID": "f9b132f7-8504-4a8f-b423-b61c8dae4783",
	"label": "BiliBili",
	"creator": "Felix Hui",
	"target": "https?://(search|www).bilibili.com/(video|bangumi|cheese|all)",
	"minVersion": "3.0",
	"maxVersion": "",
	"priority": 100,
	"inRepository": true,
	"translatorType": 4,
	"browserSupport": "gcsibv",
	"lastUpdated": "2020-12-19 07:48:50"
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

// eslint-disable-next-line
function attr(docOrElem,selector,attr,index){var elem=index?docOrElem.querySelectorAll(selector).item(index):docOrElem.querySelector(selector);return elem?elem.getAttribute(attr):null;}function text(docOrElem,selector,index){var elem=index?docOrElem.querySelectorAll(selector).item(index):docOrElem.querySelector(selector);return elem?elem.textContent:null;}
// eslint-disable-next-line
function getContentsFromURL(url){var xmlhttp=new XMLHttpRequest();xmlhttp.open("GET",url,false);xmlhttp.overrideMimeType("application/json");xmlhttp.send(null);return xmlhttp.responseText;}

/**
 * 根據 bvid 或 aid 獲取視頻信息
 * https://www.bilibili.com/video/BV1P7411R7bF
 * https://www.bilibili.com/video/av97308827
 */
function getInfoForVideo(url) {
	if (url.includes('/video/')) {
		var pattern, id;
		if ((pattern = /av\d+/).test(url)) {
			id = pattern.exec(url)[0].replace('av', '');
			return getVideoInfo(null, id);
		}
		else if ((pattern = /BV[0-9a-zA-z]*/).test(url)) {
			id = pattern.exec(url)[0];
			return getVideoInfo(id, null);
		}
	}
	return null;
}

/**
 * 根據 epid 獲取視頻信息(list)
 * https://www.bilibili.com/bangumi/play/ep250585
 */
function getInfoForEpisode(url) {
	if (!url.includes('/play/')) {
		return null;
	}
	var pattern, apiUrl, id;
	if ((pattern = /ep\d+/).test(url)) {
		id = pattern.exec(url)[0].replace('ep', '');
		apiUrl = "?ep_id=" + id;
	}
	else if ((pattern = /ss\d+/).test(url)) {
		id = pattern.exec(url)[0].replace('ss', '');
		apiUrl = "?season_id=" + id;
	}
	
	if (apiUrl) {
		var json, obj;
		if (url.includes('/bangumi/play/')) {
			apiUrl = 'https://api.bilibili.com/pgc/view/web/season' + apiUrl;
			json = getContentsFromURL(apiUrl);
			obj = JSON.parse(json);
			if (obj.code === 0) {
				// Z.debug(obj);
				return obj.result;
			}
		}
		else if (url.includes('/cheese/play/')) {
			apiUrl = 'https://api.bilibili.com/pugv/view/web/season' + apiUrl;
			json = getContentsFromURL(apiUrl);
			obj = JSON.parse(json);
			if (obj.code === 0) {
				// Z.debug(obj);
				return obj.data;
			}
		}
	}
	return null;
}

/**
 * 根據 mediaId 獲取視頻信息(list)
 * https://www.bilibili.com/bangumi/play/ep250585
 * https://www.bilibili.com/cheese/play/ep1491
 */
function getInfoForMedia(url) {
	if (url.includes('bangumi/media/')) {
		var pattern = /md\d+/;
		if (pattern.test(url)) {
			var id = pattern.exec(url)[0].replace('md', '');
			var apiUrl = 'https://api.bilibili.com/pgc/review/user?media_id=' + id;
			var json = getContentsFromURL(apiUrl);
			var obj = JSON.parse(json);
			if (obj.code === 0) {
				// Z.debug(obj);
				apiUrl = 'https://api.bilibili.com/pgc/view/web/season?season_id=' + obj.result.media.season_id;
				json = getContentsFromURL(apiUrl);
				obj = JSON.parse(json);
				if (obj.code === 0) {
					// Z.debug(obj);
					return obj.result;
				}
			}
		}
	}
	return null;
}

/**
 * 根據查詢條件獲取視頻信息(list)
 * https://search.bilibili.com/all?keyword=%E3%80%90%E4%B8%AD%E5%AD%97%E3%80%91%E7%B2%89%E9%9B%84%E6%95%91%E5%85%B5%EF%BC%9A%E6%88%91%E4%BB%AC%E5%9C%A8%E6%97%A5%E6%9C%AC
 */
function getInfoForSearch(url) {
	if (!url.includes('//search.')) {
		return null;
	}
	var apiUrl = '';
	var params = url.substring(url.indexOf('?') + 1);
	for (var item of params.split('&')) {
		switch (item.substring(0, item.indexOf('=')).toLowerCase()) {
			case 'search_type':
			case 'keyword':
			case 'order':
			case 'order_sort':
			case 'user_type':
			case 'duration':
			case 'tids':
			case 'category_id':
			case 'page':
				apiUrl += '&' + item;
				break;
			default:
				break;
		}
	}
	if (apiUrl.length >= 1) {
		apiUrl = apiUrl.substring(1);
	}
	apiUrl = 'https://api.bilibili.com/x/web-interface/search/all/v2?' + apiUrl;
	var json = getContentsFromURL(apiUrl);
	var obj = JSON.parse(json);
	if (obj.code === 0) {
		// Z.debug(obj);
		return obj.data;
	}
	return null;
}

/**
 * 獲取視頻分P列表信息
 * https://www.bilibili.com/bangumi/play/ep312267
 */
function getPlayList(bvid, aid) {
	var apiUrl = 'https://api.bilibili.com/x/player/pagelist';
	if (bvid) {
		apiUrl += "?bvid=" + bvid;
	}
	else if (aid) {
		apiUrl += "?aid=" + aid;
	}
	else {
		return [];
	}
	
	var json = getContentsFromURL(apiUrl);
	var obj = JSON.parse(json);
	if (obj.code === 0) {
		obj = obj.data;
		var playList = {};
		for (var item of obj) {
			playList[item.cid] = item;
		}
		return playList;
	}
	return null;
}

/**
 * 根據 bvid 或 aid 獲取視頻 tag 信息
 */
function getTags(bvid, aid) {
	var apiUrl = 'https://api.bilibili.com/x/tag/archive/tags';
	if (bvid) {
		apiUrl += "?bvid=" + bvid;
	}
	else if (aid) {
		apiUrl += "?aid=" + aid;
	}
	else {
		return [];
	}
	var tags = [];
	var json = getContentsFromURL(apiUrl);
	var obj = JSON.parse(json);
	if (obj.code === 0) {
		obj = obj.data;
		for (var item of obj) {
			tags.push(item.tag_name);
		}
	}
	return tags;
}

/**
 * 獲取視頻描述
 */
function getVideoInfo(bvid, aid) {
	var apiUrl = 'https://api.bilibili.com/x/web-interface/view';
	if (bvid) {
		apiUrl += "?bvid=" + bvid;
	}
	else if (aid) {
		apiUrl += "?aid=" + aid;
	}
	else {
		return null;
	}
	var json = getContentsFromURL(apiUrl);
	var obj = JSON.parse(json);
	if (obj.code === 0) {
		// Z.debug(obj);
		return obj.data;
	}
	return null;
}

function getSeasonInfo(url) {
	if (!url.includes("https")) {
		url = url.replace("http", "https");
	}
	var str = getContentsFromURL(url);
	var pattern = /__INITIAL_STATE__=({.*});/;
	if (pattern.test(str)) {
		var json = pattern.exec(str)[1].trim();
		// Z.debug(json);
		var obj = JSON.parse(json);
		return obj.mediaInfo;
	}
	return null;
}

function resolveForVideo(url) {
	var obj = getInfoForVideo(url);
	if (obj) {
		// Z.debug(JSON.stringify(obj));
		var tags = getTags(obj.bvid);
		return {
			url: "https://www.bilibili.com/video/" + obj.bvid,
			title: obj.title,
			genre: obj.tname,
			runningTime: obj.duration,
			date: obj.pubdate,
			creators: [
				obj.owner.name
			],
			description: obj.desc,
			tags: tags,
			extra: obj.stat.like + "/" + obj.stat.view
		};
	}
	return {};
}

function resolveForVideoPages(obj) {
	var items = {};
	// Z.debug(JSON.stringify(obj));
	var url;
	var isFirst = true;
	var tags = null;
	var apiUrl = "https://www.bilibili.com/video/" + obj.bvid + '?p=';
	for (var pageInfo of obj.pages) {
		if (isFirst) {
			tags = getTags(pageInfo.bvid);
		}
		url = apiUrl + pageInfo.page;
		items[url] = {
			url: url,
			title: pageInfo.part,
			genre: obj.tname,
			runningTime: pageInfo.duration,
			date: obj.pubdate,
			creators: [
				obj.owner.name
			],
			description: obj.desc,
			episodeNumber: pageInfo.page,
			programTitle: pageInfo.part,
			tags: tags,
			extra: obj.stat.like + "/" + obj.stat.view
		};
		isFirst = false;
	}
	return items;
}

function resolveForBangumi(obj) {
	var items = {};
	// Z.debug(JSON.stringify(obj));
	var seasonInfo = getSeasonInfo(obj.link);
	var tags = seasonInfo.styles.map(t => t.name);
	var areas = seasonInfo.areas.map(a => a.name).join("·");
	var archive = "";
	if (seasonInfo.staff) {
		archive += "STAFF:\n" + seasonInfo.staff;
	}
	if (seasonInfo.actors) {
		if (archive.length >= 1) {
			archive += "\n";
		}
		archive += "ACTORS:\n" + seasonInfo.actors;
	}
	var creator;
	if (obj.up_info && obj.up_info.uname) {
		creator = obj.up_info.uname;
	}
	else {
		creator = seasonInfo.rights.copyright;
	}
	
	var runningTime, needGetRunningTime = false;
	var isFirst = true, playList = null;
	for (var episodeInfo of obj.episodes) {
		// get video duration
		runningTime = 0;
		if (isFirst) {
			playList = getPlayList(episodeInfo.bvid);
			needGetRunningTime = (!playList || playList.length !== obj.episodes.length);
		}
		if (playList && playList[episodeInfo.cid]) {
			runningTime = playList[episodeInfo.cid].duration;
		}
		items[episodeInfo.link] = {
			url: episodeInfo.link,
			title: episodeInfo.share_copy,
			shortTitle: seasonInfo.origin_name,
			genre: seasonInfo.type_name || episodeInfo.from,
			runningTime: runningTime,
			date: seasonInfo.publish.pub_date,
			creators: [creator],
			description: seasonInfo.evaluate,
			episodeNumber: episodeInfo.title,
			programTitle: episodeInfo.long_title,
			tags: tags,
			place: areas,
			archive: archive,
			rights: seasonInfo.rights.copyright,
			extra: seasonInfo.rating.score + "/" + seasonInfo.stat.views + "/" + seasonInfo.rating.count,
			aid: episodeInfo.aid,
			bvid: episodeInfo.bvid,
			cid: episodeInfo.cid,
			needGetRunningTime: needGetRunningTime
		};
		isFirst = false;
	}
	return items;
}

function resolveForCheese(obj) {
	var items = {};
	// Z.debug(JSON.stringify(obj));
	var url;
	var isFirst = true;
	var tags = null;
	var apiUrl = 'https://www.bilibili.com/cheese/play/ep';
	for (var episodeInfo of obj.episodes) {
		if (isFirst) {
			tags = getTags(episodeInfo.bvid);
		}
		url = apiUrl + episodeInfo.id;
		items[url] = {
			url: url,
			title: "[" + obj.title + "] " + episodeInfo.title,
			shortTitle: episodeInfo.title,
			genre: "cheese",
			runningTime: episodeInfo.duration,
			date: episodeInfo.release_date,
			creators: [obj.up_info.uname],
			description: obj.subtitle,
			episodeNumber: episodeInfo.index,
			programTitle: episodeInfo.title,
			tags: tags,
			extra: "0/" + obj.stat.play
		};
		isFirst = false;
	}
	return items;
}

function resolveForSearch(obj) {
	var items = {};
	var apiUrl;
	// Z.debug(JSON.stringify(obj));
	obj = obj.result;
	var url;
	for (var resultInfo of obj) {
		switch (resultInfo.result_type) {
			case 'media_bangumi':
			case 'media_ft':
				apiUrl = 'https://www.bilibili.com/bangumi/media/md';
				for (var subItem1 of resultInfo.data) {
					url = apiUrl + subItem1.media_id;
					items[url] = {
						url: url,
						title: '[' + subItem1.media_score.score + '/' + subItem1.media_score.user_count + '] ' + ZU.cleanTags(subItem1.title)
					};
				}
				break;
			case 'video':
				apiUrl = 'https://www.bilibili.com/video/';
				for (var subItem2 of resultInfo.data) {
					url = apiUrl + subItem2.bvid;
					items[url] = {
						url: url,
						title: ZU.cleanTags(subItem2.title)
					};
				}
				break;
			default:
				break;
		}
	}
	return items;
}

function detectWeb(doc, url) {
	if (url.includes('/play/') || url.includes('/video/')) {
		if (getSearchResults(doc, url, true)) {
			return "multiple";
		}
		else {
			return "tvBroadcast";
		}
	}
	else if ((url.includes('//search.') || url.includes('/media/')) && getSearchResults(doc, url, true)) {
		return "multiple";
	}
	return false;
}

/**
 * var resultItem = {
 *   "url": {
 * 	   "url": "",
 *     "title": "",
 *     "shortTitle": "",
 *     "genre": "",
 *     "runningTime": 0,
 *     "date": 0,
 *     "creators": [],
 *     "description": "",
 *     "episodeNumber": "",
 *     "programTitle": "",
 *     "tags": []
 *     "extra": "", // 評分/觀看次數/評分次數
 * 	 }
 * }
 */
function getSearchResults(doc, url, checkOnly) {
	var items = [];
	var found = false;
	var obj;
	if (url.includes('/video/')) {
		// https://www.bilibili.com/video/BV1P7411R7bF
		// https://www.bilibili.com/video/av97308827
		obj = getInfoForVideo(url);
		if (!obj) {
			return found;
		}
		if (obj.pages && obj.pages.length >= 2) {
			found = true;
			if (checkOnly) return found;
			items = resolveForVideoPages(obj);
		}
	}
	else if (url.includes('/play/')) {
		obj = getInfoForEpisode(url);
		if (!obj) {
			return found;
		}
		if (url.includes('/bangumi/play/')) {
			// 紀錄片
			// https://www.bilibili.com/bangumi/play/ep250585
			if (obj.episodes && obj.episodes.length >= 2) {
				found = true;
				if (checkOnly) return found;
				// Z.debug(JSON.stringify(obj));
				items = resolveForBangumi(obj);
			}
		}
		else if (url.includes('/cheese/play/')) {
			// 課程
			// https://www.bilibili.com/cheese/play/ep1491
			if (obj.episodes && obj.episodes.length >= 2) {
				found = true;
				if (checkOnly) return found;
				// Z.debug(JSON.stringify(obj));
				items = resolveForCheese(obj);
			}
		}
	}
	else if (url.includes('/media/')) {
		// 紀錄片
		// https://www.bilibili.com/bangumi/media/md28227662/
		obj = getInfoForMedia(url);
		if (obj && obj.episodes && obj.episodes.length >= 1) {
			found = true;
			if (checkOnly) return found;
			items = resolveForBangumi(obj);
		}
	}
	else if (url.includes('//search.')) {
		// 搜索
		// https://search.bilibili.com/all?keyword=%E9%AC%BC%E7%81%AD%E4%B9%8B%E5%88%83&from_source=nav_search&spm_id_from=666.25.b_696e7465726e6174696f6e616c486561646572.11
		obj = getInfoForSearch(url);
		if (!obj || obj.numResults <= 0) {
			return false;
		}
		found = true;
		if (checkOnly) return found;
		items = resolveForSearch(obj);
	}
	return found ? items : false;
}

function doWeb(doc, url) {
	if (detectWeb(doc, url) == "multiple") {
		var objItems = getSearchResults(doc, url, false);
		Zotero.selectItems(objItems, function (items) {
			if (items) {
				Object.keys(items).forEach((key) => {
					scrape(objItems[key], url);
				});
			}
		});
	}
	else {
		scrape(null, url);
	}
}

function scrape(obj, url) {
	if (url) {
		if (!obj) {
			obj = resolveForVideo(url);
			if (!obj) {
				return;
			}
		}
		if (url.includes('//search.')) {
			var objs = Object.values(getSearchResults(null, obj.url, false));
			objs.forEach((objItem) => {
				scrape(objItem, objItem.url);
			});
			return;
		}
		// get video duration
		if (url.includes('/bangumi/') && obj.needGetRunningTime) {
			var videoInfo = getVideoInfo(obj.bvid);
			if (videoInfo) {
				obj.runningTime = videoInfo.duration;
				obj.creators = [videoInfo.owner.name];
				if (videoInfo.desc.length >= 5) {
					obj.description = videoInfo.desc;
				}
			}
		}
	}

	var item = new Zotero.Item("tvBroadcast");

	// URL
	item.url = obj.url;

	// 标题
	item.title = obj.title;
	// item.title = text(doc, '#viewbox_report h1.video-title');
	// Z.debug('title: ' + item.title);

	if (obj.place) {
		item.place = obj.place;
	}

	// 类型
	if (obj.genre) {
		item.libraryCatalog = obj.genre;
	}

	// 时长
	let hour = Math.floor(obj.runningTime / 3600 % 24);
	let min = Math.floor(obj.runningTime / 60 % 60);
	let sec = Math.floor(obj.runningTime % 60);
	item.runningTime = `${hour}:${min}:${sec}`;
	// item.runningTime = text(doc, 'span.bilibili-player-video-time-total');
	// Z.debug('runningTime: ' + item.runningTime);

	// 发布时间
	if (isNaN(obj.date)) {
		item.date = obj.date;
	}
	else {
		item.date = ZU.strToISO(new Date(obj.date * 1000));
	}
	// item.date = text(doc, '.video-data span:not([class])');
	// Z.debug('date: ' + item.date);

	// 导演?
	obj.creators.forEach((author) => {
		if (author) {
			item.creators.push({
				lastName: author,
				creatorType: "contributor",
				fieldMode: 1
			});
		}
	});
	// var author = text(doc, '#v_upinfo a.username');
	// Z.debug('director: ' + author);

	// 摘要
	var description = obj.description;
	// var description = text(doc, '#v_desc div.info');
	// Z.debug('description: ' + description);
	if (description) {
		item.abstractNote = ZU.cleanTags(description);
	}

	// 视频选集
	if (obj.episodeNumber) {
		item.episodeNumber = obj.episodeNumber;
	}
	if (obj.programTitle) {
		item.programTitle = obj.programTitle;
	}
	// var episodeInfo = doc.querySelector('#multi_page li[class*="on"] a');
	// if (episodeInfo) {
	// 	// Z.debug('episodeInfo: ' + episodeInfo);
	// 	item.episodeNumber = text(episodeInfo, 'span.s1');
	// 	item.programTitle = episodeInfo.title;
	// 	// item.url = episodeInfo.href;
	// }

	if (obj.archive) {
		item.archive = obj.archive;
	}

	if (obj.rights) {
		item.rights = obj.rights;
	}

	// 其他
	item.extra = obj.extra;

	// 标签
	if (obj.tags && obj.tags.length >= 1) {
		for (var tag of obj.tags) {
			item.tags.push(tag);
		}
	}

	item.complete();
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
		"url": "https://www.bilibili.com/cheese/play/ep1491",
		"items": "multiple"
	},
	{
		"type": "web",
		"url": "https://www.bilibili.com/video/BV1mE41187KT?p=1",
		"items": "multiple"
	},
	{
		"type": "web",
		"url": "https://www.bilibili.com/bangumi/media/md28227662/",
		"items": "multiple"
	}
]
/** END TEST CASES **/
