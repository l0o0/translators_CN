{
	"translatorID": "9444e3cb-e7d6-4735-b5f5-7d103838f3d9",
	"label": "xiaoyuzhouFM",
	"creator": "dofine, jiaojiaodubai",
	"target": "^https://www\\.xiaoyuzhoufm\\.com",
	"minVersion": "5.0",
	"maxVersion": "",
	"priority": 100,
	"inRepository": true,
	"translatorType": 4,
	"browserSupport": "gcsibv",
	"lastUpdated": "2024-04-17 23:09:59"
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
	if (url.includes('/episode/')) {
		return 'podcast';
	}
	else if (getSearchResults(doc, true)) {
		return 'multiple';
	}
	return false;
}

function getSearchResults(doc, checkOnly) {
	var items = {};
	var found = false;
	var rows = doc.querySelectorAll('a.card');
	for (let row of rows) {
		let href = row.href;
		let title = text(row, '.title');
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
	const newItem = new Z.Item('podcast');
	const json = JSON.parse(text(doc, '#__NEXT_DATA__')).props.pageProps.episode;
	Z.debug(json);
	newItem.title = json.title;
	newItem.abstractNote = json.description;
	newItem.seriesTitle = json.podcast.title;
	newItem.audioFileType = tryMatch(json.mediaKey, /\.(\w+?)$/, 1);
	newItem.runningTime = (() => {
		const date = new Date(null);
		date.setSeconds(json.duration);
		return `${date.getHours()}:${date.getMinutes()}:${date.getSeconds()}`;
	})();
	newItem.url = url;
	json.podcast.author.split(';').forEach((str) => {
		const creator = ZU.cleanAuthor(str, 'podcaster');
		if (/[\u4e00-\u9fff]/.test(creator.lastName)) {
			creator.lastName = creator.firstName + creator.lastName;
			creator.fieldMode = 1;
		}
		newItem.creators.push(creator);
	});
	newItem.attachments.push({
		url: json.media.source.url,
		title: 'Audio',
		mimeType: json.media.mimeType
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

/** BEGIN TEST CASES **/
var testCases = [
	{
		"type": "web",
		"url": "https://www.xiaoyuzhoufm.com/podcast/62b42afbc9eae959ff1df95b",
		"items": "multiple"
	},
	{
		"type": "web",
		"url": "https://www.xiaoyuzhoufm.com/episode/65c35d5e0bef6c2074ba73a5",
		"items": [
			{
				"itemType": "podcast",
				"title": "号外：提前给大家拜年啦！",
				"creators": [
					{
						"firstName": "",
						"lastName": "宇宙乘客",
						"creatorType": "podcaster",
						"fieldMode": 1
					}
				],
				"abstractNote": "大家好，好久不见！今天坐在这里也是想大家提前说一声春节祝福，给大家拜个早年。在过去的 4 个月，有很多朋友留言或者私信催更，这些留言和私信我们都看到了。过去这几个月，我们个人的生活都发生了一些变化，我自己也是经历了一次比较剧烈的情绪问题，好在这一切都结束了，我自己的情绪也慢慢好起来。\n到这个月的 14 号，宇宙乘客就要开始第四个年头了，非常感谢大家一直的支持，你们的每一条留言我都有看到。新的一年，我们也想做一点和之前不一样的内容给大家，所以，宇宙乘客的更新还得再等等。 不过，我自己开了一档 solo 播客叫「三文鱼」，记录了我最近经历的事情、感悟和一些计划，也会帮助到很多人来认识自己、关注自己的情绪、改善自己的人际关系，提升自己的行动力。欢迎大家订阅、收听。\n还有一件事，如果近期有朋友在爱发电购买我们的付费内容，没有收到兑换码，请添加我的微信：holauntie（备注爱发电），我来给大家亲自发送兑换码，如果大家想购买付费，可以直接在小宇宙或者公众号购买，支付后不需要兑换可以直接收听。\n接下来，到了煽情的节点了，这一年发生了很多事情，也失去了很多，但同时也得到了很多。我想每个人在深夜思考自己这一年的时候，一定是有说有笑但不可避免的有痛苦有眼泪有委屈，这都是生活的组成，正是因为这些吉光片羽的时刻，才让我们活的更加深刻。\n在这几天的假期里，希望我们都可以好好休息，把那些暂时还没有解决的事情暂时放下，那些还没有修复好的关系暂时放下，那些还没有想明白的事情暂时放下，彻底的让自己好好休息一下，调整好身体和心理，春节后我们再满怀热情的大干一场，时间还有很多，我们不要着急，一切事情都会朝我们期待的方向进行。\n再次感谢大家对宇宙乘客的支持和陪伴，祝大家春节快乐，龙年大吉！",
				"audioFileType": "m4a",
				"runningTime": "8:5:48",
				"seriesTitle": "宇宙乘客",
				"url": "https://www.xiaoyuzhoufm.com/episode/65c35d5e0bef6c2074ba73a5",
				"attachments": [
					{
						"title": "Audio",
						"mimeType": "audio/mp4"
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
