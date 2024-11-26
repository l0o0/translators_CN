{
	"translatorID": "65440cd1-8932-4d1c-a0d7-bc81398c3384",
	"label": "Modern History",
	"creator": "jiaojiaodubai",
	"target": "^https?://www\\.modernhistory\\.org\\.cn",
	"minVersion": "5.0",
	"maxVersion": "",
	"priority": 100,
	"inRepository": true,
	"translatorType": 4,
	"browserSupport": "gcsibv",
	"lastUpdated": "2024-11-26 00:52:50"
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

const typeMap = {
	ts: 'book',
	// bz: 'newspaperArticle',
	da: 'document',
	qk: 'journalArticle',
	yp: 'audioRecording',
	tp: 'artwork',
	sp: 'videoRecording'
};

function detectUrl(url) {
	const typeKey = Object.keys(typeMap).find(key => url.includes(`_${key}_`));
	if (typeKey) {
		const itemType = typeMap[typeKey];
		if (itemType == 'book') {
			return /treeId=[^&/]+/.test(url)
				? 'bookSection'
				: 'book';
		}
		else if (['document', 'artwork'].includes(itemType)) {
			return /\/Detailedreading(Video)?\?/i.test(url)
				? itemType
				: 'multiple';
		}
		else if (itemType == 'journalArticle' && /uniqTag=[^&/]+/.test(url)) {
			return itemType;
		}
		else {
			return itemType;
		}
	}
	return '';
}

function detectWeb(doc, url) {
	const app = doc.querySelector('#app');
	if (app) {
		Z.monitorDOMChanges(app, { childList: true, subtree: true });
	}
	const itemType = detectUrl(url);
	if (itemType) {
		return itemType;
	}
	else if (getSearchResults(doc, true)) {
		return 'multiple';
	}
	return false;
}

function getSearchResults(doc, checkOnly) {
	const items = {};
	let found = false;
	const rows = doc.querySelectorAll('.items > .item');
	for (const row of rows) {
		const imgUrl = attr(row, Object.keys(typeMap).map(key => `img[src*="_${key}_"]`).join(', '), 'src');
		const fileCode = tryMatch(imgUrl, /\/(\d+_[a-z]{2}_\d+)\//, 1);
		const title = ZU.trimInternal(text(row, 'h5'));
		// 档案和期刊应在出版物详情中抓取具体篇目
		if (!fileCode || !title || /_(da|qk)_/.test(fileCode)) continue;
		if (checkOnly) return true;
		found = true;
		items[fileCode] = title;
	}
	return found ? items : false;
}

async function doWeb(doc, url) {
	const itemType = detectWeb(doc, url);
	const fileCode = tryMatch(url, /fileCode=(\d+_[a-z]{2}_\d+)/, 1);
	if (itemType == 'multiple') {
		let items = {};
		// 位于档案中时，能够获取到fileCode
		if (fileCode) {
			const respond = await requestJSON(`https://www.modernhistory.org.cn/backend-prod/esBook/findDirectory/${fileCode}`);
			Z.debug(respond);
			let directory = respond.result;
			Z.debug(directory);
			let page = text(doc, '.number.active');
			if (page) {
				page = Number(page);
				directory = directory.slice((page - 1) * 10, page * 10);
			}
			Z.debug(directory);
			directory.forEach(dir => items[dir.directoryCode] = dir.label);
			items = await Zotero.selectItems(items);
			if (!items) return;
			for (const dirCode of Object.keys(items)) {
				const obj = findObj(directory, 'directoryCode', dirCode);
				url = encodeURI('https://www.modernhistory.org.cn/#/Detailedreading?'
					+ `fileCode=${fileCode}&`
					+ `treeId=${obj.startPageId}&`
					+ `imageUrl=${obj.iiifObj.imgUrl}&`
					+ `dirCode=${obj.directoryCode}&`
					+ `uniqTag=${obj.iiifObj.uniqTag}&`
					+ `contUrl=${obj.iiifObj.jsonUrl}`);
				await scrape(doc, url, obj);
			}
		}
		// 在搜索页面，fileCode来自页面元素
		else {
			items = await Zotero.selectItems(getSearchResults(doc, false));
			if (!items) return;
			for (const fileCode of Object.keys(items)) {
				url = 'https://www.modernhistory.org.cn/#/'
				+ {
					book: 'DocumentDetails_ts_da',
					audioRecording: 'DocumentDetails_yp',
					artwork: 'DocumentDetails_tp',
					// 尚未明确“hc”是什么意思
					videoRecording: 'DocumentDetails_ysp_hc'
				}[detectUrl(fileCode)]
				+ `?fileCode=${fileCode}`;
				await scrape(doc, url);
			}
		}
	}
	else {
		await scrape(doc, url);
	}
}

async function scrape(doc, url, obj) {
	Z.debug(`url: ${url}`);
	const fileCode = tryMatch(url, /fileCode=(\d+_[a-z]{2}_\d+)/, 1);
	const respond = await requestJSON(`https://www.modernhistory.org.cn/backend-prod/esBook/findDetailsInfo/${fileCode}`);
	cleanObject(respond);
	const info = respond.result.info;
	Z.debug('info:');
	Z.debug(info);
	const newItem = new Z.Item(detectUrl(url));
	const extra = new Extra();
	newItem.language = {
		汉语: 'zh-CN',
		日语: 'jp-JP',
		英语: 'en-US'
	}[info.language[0]];
	newItem.url = url;
	newItem.libraryCatalog = '抗日战争与近代中日关系文献数据平台';
	newItem.archive = info.orgName;
	let creators = [
		...processNames(info.firstResponsible, info.firstResponsibleNation, info.firstCreationWay, 'author'),
		...processNames(info.secondResponsible, info.secondResponsibleNation, info.secondCreationWay, 'contributor')
	];
	switch (newItem.itemType) {
		case 'book': {
			newItem.title = info.title;
			newItem.series = info.seriesVolume;
			newItem.seriesNumber = info.seriesVolume;
			newItem.edition = info.version;
			newItem.place = info.place[0];
			newItem.publisher = info.publisher[0];
			newItem.date = ZU.strToISO(info.publishTime);
			newItem.numPages = info.pageAmount;
			break;
		}
		case 'bookSection': {
			if (!obj) {
				const respond = await requestJSON(`https://www.modernhistory.org.cn/backend-prod/esBook/findDirectory/${fileCode}?uniqTag=`);
				obj = findObj(respond.result, 'startPageId', tryMatch(url, /treeId=([^&/]+)/, 1));
			}
			cleanObject(obj);
			newItem.title = obj.label;
			newItem.bookTitle = info.title;
			newItem.series = info.seriesVolume;
			newItem.seriesNumber = info.seriesVolume;
			newItem.edition = info.version;
			newItem.place = info.place[0];
			newItem.publisher = info.publisher[0];
			newItem.date = ZU.strToISO(info.publishTime);
			newItem.pages = Array.from(new Set([obj.startPage, obj.endPage])).join('-');
			creators.forEach((creator) => {
				if (creator.creatorType == 'author') {
					creator.creatorType = 'bookAuthor';
				}
			});
			break;
		}
		case 'document': {
			if (!obj) {
				const respond = await requestJSON(`https://www.modernhistory.org.cn/backend-prod/esBook/findDirectory/${fileCode}?uniqTag=`);
				obj = findObj(respond.result, 'directoryCode', decodeURIComponent(tryMatch(url, /dirCode=([^&/]+)/, 1)));
			}
			cleanObject(obj);
			newItem.title = obj.label || `${info.title} ${obj.directoryCode}`;
			newItem.abstractNote = info.roundup;
			newItem.publisher = info.publisher[0];
			newItem.date = ZU.strToISO(info.publishTime);
			newItem.archiveLocation = `${info.title}${/^[a-z]/i.test(obj.directoryCode) ? ' ' : ''}${obj.directoryCode}`;
			extra.set('container-title', info.title, true);
			extra.set('type', 'collection', true);
			extra.set('place', info.place[0], true);
			extra.set('numPages', obj.endPage, true);
			break;
		}
		case 'journalArticle': {
			if (!obj) {
				// 在Scaffold中失败
				const respond = await requestJSON(`https://www.modernhistory.org.cn/backend-prod/esBook/findDirectory/${fileCode}?uniqTag=${tryMatch(url, /uniqTag=([^&/]+)/, 1)}`);
				obj = findObj(respond.result, 'directoryCode', tryMatch(url, /dirCode=([^&/]+)/, 1));
			}
			cleanObject(obj);
			const title = obj.label;
			const names = [];
			const countries = [];
			const role = [];
			tryMatch(title, /【(.+?)】$/, 1).split(',').forEach((name) => {
				countries.push(tryMatch(name, /^\((.+?)\)/, 1));
				name = name.replace(/^\(.+?\)/, '');
				role.push(tryMatch(name, /\(([^)]+)\)$/, 1));
				name = name.replace(/\([^)]+\)$/g, '');
				names.push(name);
			});
			creators = processNames(names, countries, role, 'author');
			newItem.title = title.replace(/【.+?】$/, '');
			newItem.publicationTitle = info.title;
			let volumeInfo = obj.iiifObj.volumeInfo;
			newItem.volume = obj.volumeNo || toArabicNum(tryMatch(volumeInfo, /第(.+?)卷/, 1));
			newItem.issue = toArabicNum(tryMatch(volumeInfo, /第(.+?)[期号]/, 1));
			newItem.pages = Array.from(new Set([obj.startPage, obj.endPage])).join('-');
			newItem.date = ZU.strToISO(info.publishTime) || ZU.strToISO(volumeInfo);
			break;
		}
		case 'audioRecording':
			newItem.title = info.title;
			newItem.audioRecordingFormat = info.docFormat;
			newItem.label = info.publisher[0];
			extra.set('place', info.place[0], true);
			extra.set('genre', 'Album', true);
			break;
		case 'artwork':
			if (!obj) {
				const respond = await requestJSON(`https://www.modernhistory.org.cn/backend-prod/esBook/findDirectory/${fileCode}?uniqTag=`);
				obj = findObj(respond.result, 'directoryCode', tryMatch(url, /dirCode=([^&/]+)/, 1));
			}
			newItem.title = obj.label;
			newItem.date = info.timeRange;
			newItem.artworkMedium = 'photography';
			extra.set('container-title', info.title, true);
			extra.set('amount', info.amount);
			break;
		case 'videoRecording':
			newItem.title = info.title;
			newItem.abstractNote = info.notes;
			newItem.videoRecordingFormat = info.docFormat;
			newItem.place = info.place[0];
			newItem.studio = info.publisher[0];
			newItem.date = info.createTimeStr;
			newItem.runningTime = info.duration || ZU.strToISO(info.createTime);
			extra.set('download', info.download);
			break;
	}
	if (creators.some(creator => creator.country)) {
		extra.set('creatorsExt', JSON.stringify(creators));
	}
	creators.forEach((creator) => {
		delete creator.country;
		newItem.creators.push(creator);
	});
	newItem.tags = info.keyWords || [];
	newItem.attachments.push({
		title: 'Snapshot',
		document: doc
	});
	newItem.extra = extra.toString();
	newItem.complete();
}

class Extra {
	constructor() {
		this.fields = [];
	}

	push(key, val, csl = false) {
		this.fields.push({ key: key, val: val, csl: csl });
	}

	set(key, val, csl = false) {
		let target = this.fields.find(obj => new RegExp(`^${key}$`, 'i').test(obj.key));
		if (target) {
			target.val = val;
		}
		else {
			this.push(key, val, csl);
		}
	}

	get(key) {
		let result = this.fields.find(obj => new RegExp(`^${key}$`, 'i').test(obj.key));
		return result
			? result.val
			: '';
	}

	toString(history = '') {
		this.fields = this.fields.filter(obj => obj.val);
		return [
			this.fields.filter(obj => obj.csl).map(obj => `${obj.key}: ${obj.val}`).join('\n'),
			history,
			this.fields.filter(obj => !obj.csl).map(obj => `${obj.key}: ${obj.val}`).join('\n')
		].filter(obj => obj).join('\n');
	}
}

function tryMatch(string, pattern, index = 0) {
	let match = string.match(pattern);
	return match && match[index]
		? match[index]
		: '';
}

function processNames(names, countries, role, creatorType) {
	const creators = [];
	names = names || [];
	countries = countries || [];
	role = role || [];
	for (let i = 0; i < names.length; i++) {
		const creatorTypes = [];
		if (/翻?译/.test(role[i])) {
			creatorTypes.push('translator');
		}
		if (/[编辑纂]+|记/.test(role[i])) {
			creatorTypes.push('editor');
		}
		if (!creatorTypes.length) {
			creatorTypes.push(creatorType);
		}
		for (const type of creatorTypes) {
			creators.push({
				firstName: '',
				// https://www.modernhistory.org.cn/#/Detailedreading?docType=qk&fileCode=9999_qk_05009&treeId=105495871&qkTitle=No.2%283%E6%9C%88%29&uniqTag=9999_qk_05009_0002&dirCode=ec97be75bf774836a1244e98686ca1bf&contUrl=https%3A%2F%2Fkrwxk-prod.oss-cn-beijing.aliyuncs.com%2F9999_qk_05009%2F9999_qk_05009_0002%2F9999_qk_05009_0002.json
				lastName: names[i].replace(/\.\s*/, '. '),
				creatorType: type,
				fieldMode: 1,
				country: countries[i] || ''
			});
		}
	}
	return creators;
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

function cleanObject(object) {
	for (const key in object) {
		if (typeof object[key] === 'string') {
			object[key] = object[key].replace(/^--$/, '');
		}
		else if (typeof object[key] === 'object') {
			cleanObject(object[key]);
		}
		else if (object[key] === null) {
			object[key] = '';
		}
		else if (Array.isArray(object[key])) {
			object[key].forEach((item, index) => {
				if (typeof item === 'string') {
					object[key][index] = item.replace(/^--$/, '');
				}
				else if (typeof item === 'object') {
					cleanObject(item);
				}
				else if (item === null) {
					object[key][index] = '';
				}
			});
		}
	}
}

function findObj(tree, attribute, value) {
	for (const branch of tree) {
		if (branch[attribute] == value) {
			return branch;
		}
		else {
			const result = findObj(branch.children, attribute, value);
			if (result) return result;
		}
	}
	return undefined;
}

/** BEGIN TEST CASES **/
var testCases = [
	{
		"type": "web",
		"url": "https://www.modernhistory.org.cn/#/DocumentDetails_ts_da?fileCode=9999_ts_00553714&title=%E8%BE%A9%E8%AF%81%E5%94%AF%E7%89%A9%E4%B8%BB%E4%B9%89%E4%B8%8E%E5%8E%86%E5%8F%B2%E5%94%AF%E7%89%A9%E4%B8%BB%E4%B9%89&flag=false",
		"defer": true,
		"items": [
			{
				"itemType": "book",
				"title": "辩证唯物主义与历史唯物主义",
				"creators": [
					{
						"firstName": "",
						"lastName": "斯大林",
						"creatorType": "author",
						"fieldMode": 1
					},
					{
						"firstName": "",
						"lastName": "蓝火",
						"creatorType": "translator",
						"fieldMode": 1
					}
				],
				"date": "1949-06-01",
				"archive": "社会来源",
				"edition": "第一版",
				"extra": "creatorsExt: [{\"firstName\":\"\",\"lastName\":\"斯大林\",\"creatorType\":\"author\",\"fieldMode\":1,\"country\":\"苏联\"},{\"firstName\":\"\",\"lastName\":\"蓝火\",\"creatorType\":\"translator\",\"fieldMode\":1,\"country\":\"\"}]",
				"language": "zh-CN",
				"libraryCatalog": "抗日战争与近代中日关系文献数据平台",
				"numPages": "61",
				"place": "上海",
				"url": "https://www.modernhistory.org.cn/#/DocumentDetails_ts_da?fileCode=9999_ts_00553714&title=%E8%BE%A9%E8%AF%81%E5%94%AF%E7%89%A9%E4%B8%BB%E4%B9%89%E4%B8%8E%E5%8E%86%E5%8F%B2%E5%94%AF%E7%89%A9%E4%B8%BB%E4%B9%89&flag=false",
				"attachments": [
					{
						"title": "Snapshot",
						"mimeType": "text/html"
					}
				],
				"tags": [
					{
						"tag": "历史唯物主义"
					},
					{
						"tag": "哲学"
					},
					{
						"tag": "辩证唯物主义"
					}
				],
				"notes": [],
				"seeAlso": []
			}
		]
	},
	{
		"type": "web",
		"url": "https://www.modernhistory.org.cn/#/Detailedreading?fileCode=9999_ts_00316571&treeId=145458905&contUrl=https%3A%2F%2Fkrwxk-prod.oss-cn-beijing.aliyuncs.com%2F9999_ts_00316571%2F9999_ts_00316571.json",
		"defer": true,
		"items": [
			{
				"itemType": "bookSection",
				"title": "一 抽象与具体性",
				"creators": [
					{
						"firstName": "",
						"lastName": "马克思",
						"creatorType": "bookAuthor",
						"fieldMode": 1
					},
					{
						"firstName": "",
						"lastName": "恩格斯",
						"creatorType": "bookAuthor",
						"fieldMode": 1
					},
					{
						"firstName": "",
						"lastName": "郭沫若",
						"creatorType": "translator",
						"fieldMode": 1
					}
				],
				"date": "1949-01-01",
				"archive": "社会来源",
				"bookTitle": "艺术的真实",
				"extra": "creatorsExt: [{\"firstName\":\"\",\"lastName\":\"马克思\",\"creatorType\":\"bookAuthor\",\"fieldMode\":1,\"country\":\"德国\"},{\"firstName\":\"\",\"lastName\":\"恩格斯\",\"creatorType\":\"bookAuthor\",\"fieldMode\":1,\"country\":\"\"},{\"firstName\":\"\",\"lastName\":\"郭沫若\",\"creatorType\":\"translator\",\"fieldMode\":1,\"country\":\"\"}]",
				"language": "zh-CN",
				"libraryCatalog": "抗日战争与近代中日关系文献数据平台",
				"pages": "9-16",
				"place": "上海",
				"url": "https://www.modernhistory.org.cn/#/Detailedreading?fileCode=9999_ts_00316571&treeId=145458905&contUrl=https%3A%2F%2Fkrwxk-prod.oss-cn-beijing.aliyuncs.com%2F9999_ts_00316571%2F9999_ts_00316571.json",
				"attachments": [
					{
						"title": "Snapshot",
						"mimeType": "text/html"
					}
				],
				"tags": [
					{
						"tag": "具体与抽象"
					},
					{
						"tag": "思辨方法"
					},
					{
						"tag": "浪漫主义"
					}
				],
				"notes": [],
				"seeAlso": []
			}
		]
	},
	{
		"type": "web",
		"url": "https://www.modernhistory.org.cn/#/Detailedreading?docType=qk&fileCode=9999_qk_05012&treeId=106127676&qkTitle=%E7%AC%AC%E4%BA%8C%E5%8D%B7%E7%AC%AC%E5%9B%9B%E5%8F%B7%285%E6%9C%8820%E6%97%A5%29&uniqTag=9999_qk_05012_0010&dirCode=c3dc322a36e74ec99019e5a9c1689994&contUrl=https%3A%2F%2Fkrwxk-prod.oss-cn-beijing.aliyuncs.com%2F9999_qk_05012%2F9999_qk_05012_0002%2F9999_qk_05012_0002.json",
		"defer": true,
		"items": [
			{
				"itemType": "journalArticle",
				"title": "新兴艺术概况",
				"creators": [
					{
						"firstName": "",
						"lastName": "冯宪章",
						"creatorType": "translator",
						"fieldMode": 1
					},
					{
						"firstName": "",
						"lastName": "冯宪章",
						"creatorType": "editor",
						"fieldMode": 1
					}
				],
				"date": "1930-05-20",
				"archive": "社会来源",
				"issue": 4,
				"language": "zh-CN",
				"libraryCatalog": "抗日战争与近代中日关系文献数据平台",
				"pages": "452",
				"publicationTitle": "大众文艺",
				"url": "https://www.modernhistory.org.cn/#/Detailedreading?docType=qk&fileCode=9999_qk_05012&treeId=106127676&qkTitle=%E7%AC%AC%E4%BA%8C%E5%8D%B7%E7%AC%AC%E5%9B%9B%E5%8F%B7%285%E6%9C%8820%E6%97%A5%29&uniqTag=9999_qk_05012_0010&dirCode=c3dc322a36e74ec99019e5a9c1689994&contUrl=https%3A%2F%2Fkrwxk-prod.oss-cn-beijing.aliyuncs.com%2F9999_qk_05012%2F9999_qk_05012_0002%2F9999_qk_05012_0002.json",
				"volume": 2,
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
	},
	{
		"type": "web",
		"url": "https://www.modernhistory.org.cn/#/DetailedreadingVideo?docType=yp&id=71729&fileCode=6666_yp_00000022&treeId=134",
		"defer": true,
		"items": [
			{
				"itemType": "audioRecording",
				"title": "纪念江定仙教授百年诞辰——江定仙作品选",
				"creators": [
					{
						"firstName": "",
						"lastName": "江定仙",
						"creatorType": "author",
						"fieldMode": 1
					},
					{
						"firstName": "",
						"lastName": "江自生",
						"creatorType": "contributor",
						"fieldMode": 1
					}
				],
				"archive": "社会捐赠",
				"audioRecordingFormat": "mp3",
				"extra": "place: 深圳\ngenre: Album",
				"label": "中国唱片深圳公司",
				"language": "zh-CN",
				"libraryCatalog": "抗日战争与近代中日关系文献数据平台",
				"url": "https://www.modernhistory.org.cn/#/DetailedreadingVideo?docType=yp&id=71729&fileCode=6666_yp_00000022&treeId=134",
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
	},
	{
		"type": "web",
		"url": "https://www.modernhistory.org.cn/#/Detailedreading?fileCode=9999_tp_00000006&treeId=196970787&imageUrl=https%3A%2F%2Fkrwxk-prod.oss-cn-beijing.aliyuncs.com%2F9999_tp_00000006%2F9999_tp_00000006_00002.jpg&dirCode=1b5e6954e5204328bc849743600d66ec",
		"defer": true,
		"items": [
			{
				"itemType": "artwork",
				"title": "自南向北拍摄的通州码头",
				"creators": [
					{
						"firstName": "",
						"lastName": "香港华芳照相馆",
						"creatorType": "author",
						"fieldMode": 1
					}
				],
				"date": "1879",
				"archive": "社会来源",
				"artworkMedium": "photography",
				"extra": "container-title: 香港华芳照相馆（AFong）摄影集\namount: 95\ncreatorsExt: [{\"firstName\":\"\",\"lastName\":\"香港华芳照相馆\",\"creatorType\":\"author\",\"fieldMode\":1,\"country\":\"中国\"},{\"firstName\":\"\",\"lastName\":\"\",\"creatorType\":\"contributor\",\"fieldMode\":1,\"country\":\"\"}]",
				"libraryCatalog": "抗日战争与近代中日关系文献数据平台",
				"url": "https://www.modernhistory.org.cn/#/Detailedreading?fileCode=9999_tp_00000006&treeId=196970787&imageUrl=https%3A%2F%2Fkrwxk-prod.oss-cn-beijing.aliyuncs.com%2F9999_tp_00000006%2F9999_tp_00000006_00002.jpg&dirCode=1b5e6954e5204328bc849743600d66ec",
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
	},
	{
		"type": "web",
		"url": "https://www.modernhistory.org.cn/#/Detailedreading?fileCode=9999_tp_00000005&treeId=196970737&imageUrl=https%3A%2F%2Fkrwxk-prod.oss-cn-beijing.aliyuncs.com%2F9999_tp_00000005%2F9999_tp_00000005_00002.jpg&dirCode=99435ef71d6640c689ec4886d96cd8d0",
		"defer": true,
		"items": [
			{
				"itemType": "artwork",
				"title": "在雅宾利道自南向北拍摄维多利亚湾",
				"creators": [
					{
						"firstName": "",
						"lastName": "威廉·普瑞尔·弗洛伊德",
						"creatorType": "author",
						"fieldMode": 1
					}
				],
				"date": "1873",
				"archive": "社会来源",
				"artworkMedium": "photography",
				"extra": "container-title: 威廉·普瑞尔·弗洛伊德（William Pryor Floyd）摄影集\namount: 50\ncreatorsExt: [{\"firstName\":\"\",\"lastName\":\"威廉·普瑞尔·弗洛伊德\",\"creatorType\":\"author\",\"fieldMode\":1,\"country\":\"英国\"},{\"firstName\":\"\",\"lastName\":\"\",\"creatorType\":\"contributor\",\"fieldMode\":1,\"country\":\"\"}]",
				"libraryCatalog": "抗日战争与近代中日关系文献数据平台",
				"url": "https://www.modernhistory.org.cn/#/Detailedreading?fileCode=9999_tp_00000005&treeId=196970737&imageUrl=https%3A%2F%2Fkrwxk-prod.oss-cn-beijing.aliyuncs.com%2F9999_tp_00000005%2F9999_tp_00000005_00002.jpg&dirCode=99435ef71d6640c689ec4886d96cd8d0",
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
	},
	{
		"type": "web",
		"url": "https://www.modernhistory.org.cn/#/DocumentDetails_ysp_hc?fileCode=0002_sp_00000001&title=%E4%B8%9C%E4%BA%AC%E5%AE%A1%E5%88%A4&flag=false",
		"defer": true,
		"items": [
			{
				"itemType": "videoRecording",
				"title": "东京审判",
				"creators": [
					{
						"firstName": "",
						"lastName": "东京国际军事法庭",
						"creatorType": "author",
						"fieldMode": 1
					}
				],
				"date": "1946",
				"abstractNote": "本数据经上海交通大学出版社授权发布，仅供学术研究使用用。以任何形式用于商业目的，请务必与版权方联系。",
				"archive": "上海交通大学东京审判研究中心",
				"language": "zh-CN",
				"libraryCatalog": "抗日战争与近代中日关系文献数据平台",
				"runningTime": "6:43:31",
				"url": "https://www.modernhistory.org.cn/#/DocumentDetails_ysp_hc?fileCode=0002_sp_00000001&title=%E4%B8%9C%E4%BA%AC%E5%AE%A1%E5%88%A4&flag=false",
				"videoRecordingFormat": "mp4",
				"attachments": [
					{
						"title": "Snapshot",
						"mimeType": "text/html"
					}
				],
				"tags": [
					{
						"tag": "东京审判"
					},
					{
						"tag": "伪满洲国"
					},
					{
						"tag": "关东军"
					}
				],
				"notes": [],
				"seeAlso": []
			}
		]
	},
	{
		"type": "web",
		"url": "https://www.modernhistory.org.cn/#/SearchResult_list?searchValue=%E6%B0%91%E4%BF%97&seniorType=&selectType=",
		"defer": true,
		"items": "multiple"
	},
	{
		"type": "web",
		"url": "https://www.modernhistory.org.cn/#/DocumentDetails_tp?fileCode=9999_tp_00000006&title=%E9%A6%99%E6%B8%AF%E5%8D%8E%E8%8A%B3%E7%85%A7%E7%9B%B8%E9%A6%86%EF%BC%88AFong%EF%BC%89%E6%91%84%E5%BD%B1%E9%9B%86&flag=false",
		"defer": true,
		"items": "multiple"
	},
	{
		"type": "web",
		"url": "https://www.modernhistory.org.cn/#/DocumentDetails_da?fileCode=1003_da_0005&title=%E5%9F%83%E6%96%87%E6%96%AF%C2%B7%E5%8D%A1%E5%B0%94%E9%80%8A%E8%97%8F%E6%8A%97%E6%88%98%E5%8F%B2%E6%96%99%E6%A1%A3%E6%A1%88&flag=false",
		"defer": true,
		"items": "multiple"
	}
]
/** END TEST CASES **/
