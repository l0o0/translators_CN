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
	"lastUpdated": "2024-02-03 10:18:43"
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
	let typeKey = Object.keys(typeMap).find(key => url.includes(`_${key}_`));
	if (typeKey) {
		let itemType = typeMap[typeKey];
		if (itemType == 'book') {
			return /treeId=[^&/]+/.test(url)
				? 'bookSection'
				: 'book';
		}
		else if (itemType == 'document') {
			return /dirCode=[^&/]+/.test(url)
				? 'document'
				: 'multiple';
		}
		else if (itemType == 'journalArticle') {
			return /treeId=[^&/]+/.test(url)
				? 'journalArticle'
				: 'multiple';
		}
		return itemType;
	}
	return '';
}

function detectWeb(doc, url) {
	// let tree = doc.querySelector('ul[role="tree"]');
	// if (tree) {
	// 	Z.monitorDOMChanges(tree, { childList: tree, subtree: true });
	// }
	let itemType = detectUrl(url);
	if (itemType) {
		return itemType;
	}
	else if (getSearchResults(doc, true)) {
		return 'multiple';
	}
	return false;
}

function getSearchResults(doc, checkOnly) {
	var items = {};
	var found = false;
	var rows = doc.querySelectorAll('.items > .item');
	for (let row of rows) {
		let imgUrl = attr(row, Object.keys(typeMap).map(key => `img[src*="_${key}_"]`).join(', '), 'src');
		let fileCode = tryMatch(imgUrl, /\/(\d+_[a-z]{2}_\d+)\//, 1);
		let title = ZU.trimInternal(text(row, 'h5'));
		if (!fileCode || !title || /_(da|qk)_/.test(fileCode)) continue;
		if (checkOnly) return true;
		found = true;
		items[fileCode] = title;
	}
	return found ? items : false;
}

async function doWeb(doc, url) {
	let fileCode = tryMatch(url, /fileCode=(\d+_[a-z]{2}_\d+)/, 1);
	let itemType = detectWeb(doc, url);
	if (itemType == 'multiple') {
		var items = {};
		if (fileCode) {
			let directory = await requestJSON(`https://www.modernhistory.org.cn/backend-prod/esBook/findDirectory/${fileCode}`);
			directory = directory.result;
			let page = text(doc, '.number.active');
			if (page) {
				page = Number(page);
				directory = directory.slice((page - 1) * 10, page * 10);
			}
			directory.forEach(item => items[item.directoryCode] = item.label);
			// Z.debug(directory);
			items = await Zotero.selectItems(items);
			// Z.debug(items);
			if (!items) return;
			for (let dirCode of Object.keys(items)) {
				await scrape(
					fileCode,
					url + `&dirCode=${encodeURIComponent(dirCode)}&treeId=${directory.find(item => item.directoryCode = dirCode).startPageId}`,
					directory
				);
			}
		}
		else {
			let items = await Zotero.selectItems(getSearchResults(doc, false));
			if (!items) return;
			for (let fileCode of Object.keys(items)) {
				let itemType = detectUrl(fileCode);
				Z.debug(itemType);
				url = 'https://www.modernhistory.org.cn/#/'
				+ {
					book: 'DocumentDetails_ts_da',
					audioRecording: 'DocumentDetails_yp',
					artwork: 'DocumentDetails_tp',
					// 尚未明确“hc”是什么意思
					videoRecording: 'DocumentDetails_ysp_hc'
				}[itemType]
				+ `?fileCode=${fileCode}`;
				await scrape(fileCode, url);
			}
		}
	}
	else {
		await scrape(fileCode, url);
	}
}

async function scrape(fileCode, url, directory) {
	Z.debug(`fileCode: ${fileCode}`);
	Z.debug(`url: ${url}`);
	Z.debug('director:');
	Z.debug(directory);
	var file = await requestJSON(`https://www.modernhistory.org.cn/backend-prod/esBook/findDetailsInfo/${fileCode}`);
	// let file = fileObj;
	cleanObject(file);
	file = file.result.info;
	Z.debug('file:');
	Z.debug(file);
	var newItem = new Z.Item(detectUrl(url));
	newItem.language = {
		汉语: 'zh-CN',
		日语: 'jp-JP',
		英语: 'en-US'
	}[file.language[0]];
	newItem.url = tryMatch(url, /^.+fileCode=\w+/);
	newItem.libraryCatalog = '抗日战争与近代中日关系文献数据平台';
	newItem.archive = file.orgName;
	var creators = [
		...processName(file.firstResponsible, file.firstResponsibleNation, file.firstCreationWay, 'author'),
		...processName(file.secondResponsible, file.secondResponsibleNation, file.secondCreationWay, 'contributor')
	];
	switch (newItem.itemType) {
		case 'book': {
			newItem.title = file.title;
			newItem.series = file.seriesVolume;
			newItem.seriesNumber = file.seriesVolume;
			newItem.edition = file.version;
			newItem.place = file.place[0];
			newItem.publisher = file.publisher[0];
			newItem.date = ZU.strToISO(file.publishTime);
			newItem.numPages = file.pageAmount;
			break;
		}
		case 'bookSection': {
			if (!directory) {
				directory = await requestJSON(`https://www.modernhistory.org.cn/backend-prod/esBook/findDirectory/${fileCode}?uniqTag=`);
				Z.debug(directory);
				directory = directory.result;
			}
			let dir = directory.find(child => child.startPageId == tryMatch(url, /treeId=([^&/]+)/, 1));
			// let dir = dirObj;
			cleanObject(dir);
			Z.debug('dir:');
			Z.debug(dir);
			newItem.title = dir.label;
			newItem.bookTitle = file.title;
			newItem.series = file.seriesVolume;
			newItem.seriesNumber = file.seriesVolume;
			newItem.edition = file.version;
			newItem.place = file.place[0];
			newItem.publisher = file.publisher[0];
			newItem.date = ZU.strToISO(file.publishTime);
			newItem.pages = Array.from(new Set([dir.startPage, dir.endPage])).join('-');
			break;
		}
		case 'document': {
			if (!directory) {
				directory = await requestJSON(`https://www.modernhistory.org.cn/backend-prod/esBook/findDirectory/${fileCode}?uniqTag=`);
				Z.debug(directory);
				directory = directory.result;
			}
			let dir = directory.find(child => child.directoryCode == decodeURIComponent(tryMatch(url, /dirCode=([^&/]+)/, 1)));
			// let dir = dirObj;
			cleanObject(dir);
			Z.debug('dir:');
			Z.debug(dir);
			newItem.title = dir.label || `${file.title} ${dir.directoryCode}`;
			newItem.abstractNote = file.roundup;
			newItem.place = file.place[0];
			newItem.publisher = file.publisher[0];
			newItem.date = ZU.strToISO(file.publishTime);
			newItem.archiveLocation = file.title + dir.directoryCode;
			extra.add('Type', 'collection', true);
			extra.add('numPages', dir.endPage, true);
			break;
		}
		case 'journalArticle': {
			if (!directory) {
				// 在Scaffold中失败
				directory = await requestJSON(`https://www.modernhistory.org.cn/backend-prod/esBook/findDirectory/${fileCode}?uniqTag=`);
				Z.debug(directory);
				directory = directory.result;
			}
			let dir = directory.find(child => child.startPageId == tryMatch(url, /treeId=([^&/]+)/, 1));
			// let dir = dirObj;
			cleanObject(dir);
			Z.debug('dir:');
			Z.debug(dir);
			let title = dir.label;
			let names = [];
			let countries = [];
			let role = [];
			tryMatch(title, /【(.+?)】$/, 1).split(',').forEach((creator) => {
				countries.push(tryMatch(creator, /^\((.+?)\)/, 1));
				creator = creator.replace(/^\(.+?\)/, '');
				role.push(tryMatch(creator, /\(?(翻?译)\)?$/, 1));
				creator = creator.replace(/\(?(翻?译|[主原]?[编著])\)?$/, '');
				names.push(creator);
			});
			creators = processName(names, countries, role, 'author');
			newItem.title = title.replace(/【.+?】$/, '');
			newItem.publicationTitle = file.title;
			let volumeInfo = dir.iiifObj.volumeInfo;
			newItem.volume = dir.volumeNo || toArabicNum(tryMatch(volumeInfo, /第(.+?)卷/, 1));
			newItem.issue = toArabicNum(tryMatch(volumeInfo, /第(.+?)[期号]/, 1));
			newItem.pages = Array.from(new Set([dir.startPage, dir.endPage])).join('-');
			newItem.date = ZU.strToISO(file.publishTime) || ZU.strToISO(volumeInfo);
			break;
		}
		case 'audioRecording':
			newItem.title = file.title;
			newItem.audioRecordingFormat = file.docFormat;
			newItem.label = file.publisher[0];
			extra.add('place', file.place[0], true);
			extra.add('genre', 'Album', true);
			break;
		case 'artwork':
			newItem.title = file.title;
			newItem.date = file.timeRange;
			newItem.artworkMedium = 'photography';
			extra.add('amount', file.amount);
			break;
		case 'videoRecording':
			newItem.title = file.title;
			newItem.abstractNote = file.notes;
			newItem.videoRecordingFormat = file.docFormat;
			newItem.place = file.place[0];
			newItem.studio = file.publisher[0];
			newItem.date = file.createTimeStr;
			newItem.runningTime = file.duration || ZU.strToISO(file.createTime);
			break;
	}
	if (creators.some(creator => creator.country)) {
		extra.add('creatorsExt', JSON.stringify(creators));
	}
	Z.debug(creators);
	creators.forEach((creator) => {
		delete creator.country;
		newItem.creators.push(creator);
	});
	newItem.tags = file.keyWords || [];
	newItem.extra = extra.toString();
	newItem.complete();
}

const extra = {
	clsFields: [],
	elseFields: [],
	add: function (key, value, cls = false) {
		if (value && cls) {
			this.clsFields.push([key, value]);
		}
		else if (value) {
			this.elseFields.push([key, value]);
		}
	},
	toString: function () {
		return [...this.clsFields, ...this.elseFields]
			.map(entry => `${entry[0]}: ${entry[1]}`)
			.join('\n');
	}
};

function tryMatch(string, pattern, index = 0) {
	let match = string.match(pattern);
	return match && match[index]
		? match[index]
		: '';
}

function processName(names, countries, role, creatorType) {
	names = names || [];
	countries = countries || [];
	role = role || [];
	for (let i = 0; i < names.length; i++) {
		names[i] = {
			firstName: '',
			lastName: names[i],
			creatorType: /[翻译]+/.test(role[i]) ? 'translator' : creatorType,
			fieldMode: 1,
			country: countries[i] || ''
		};
	}
	return names;
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

/** BEGIN TEST CASES **/
var testCases = [
	{
		"type": "web",
		"url": "https://www.modernhistory.org.cn/#/DocumentDetails_ts_da?fileCode=9999_ts_00553714&title=%E8%BE%A9%E8%AF%81%E5%94%AF%E7%89%A9%E4%B8%BB%E4%B9%89%E4%B8%8E%E5%8E%86%E5%8F%B2%E5%94%AF%E7%89%A9%E4%B8%BB%E4%B9%89&flag=false",
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
				"url": "https://www.modernhistory.org.cn/#/DocumentDetails_ts_da?fileCode=9999_ts_00553714",
				"attachments": [],
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
		"items": [
			{
				"itemType": "bookSection",
				"title": "一 抽象与具体性",
				"creators": [
					{
						"firstName": "",
						"lastName": "马克思",
						"creatorType": "author",
						"fieldMode": 1
					},
					{
						"firstName": "",
						"lastName": "恩格斯",
						"creatorType": "author",
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
				"extra": "creatorsExt: [{\"firstName\":\"\",\"lastName\":\"马克思\",\"creatorType\":\"author\",\"fieldMode\":1,\"country\":\"德国\"},{\"firstName\":\"\",\"lastName\":\"恩格斯\",\"creatorType\":\"author\",\"fieldMode\":1,\"country\":\"\"},{\"firstName\":\"\",\"lastName\":\"郭沫若\",\"creatorType\":\"translator\",\"fieldMode\":1,\"country\":\"\"}]",
				"language": "zh-CN",
				"libraryCatalog": "抗日战争与近代中日关系文献数据平台",
				"pages": "9-16",
				"place": "上海",
				"url": "https://www.modernhistory.org.cn/#/Detailedreading?fileCode=9999_ts_00316571",
				"attachments": [],
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
		"url": "https://www.modernhistory.org.cn/#/DocumentDetails_ysp_hc?fileCode=0002_sp_00000001&title=%E4%B8%9C%E4%BA%AC%E5%AE%A1%E5%88%A4&flag=false",
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
				"url": "https://www.modernhistory.org.cn/#/DocumentDetails_ysp_hc?fileCode=0002_sp_00000001",
				"videoRecordingFormat": "mp4",
				"attachments": [],
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
		"url": "https://www.modernhistory.org.cn/#/DetailedreadingVideo?docType=yp&id=71729&fileCode=6666_yp_00000022&treeId=134",
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
				"url": "https://www.modernhistory.org.cn/#/DetailedreadingVideo?docType=yp&id=71729&fileCode=6666_yp_00000022",
				"attachments": [],
				"tags": [],
				"notes": [],
				"seeAlso": []
			}
		]
	},
	{
		"type": "web",
		"url": "https://www.modernhistory.org.cn/#/DocumentDetails_tp?fileCode=9999_tp_00000006&title=%E9%A6%99%E6%B8%AF%E5%8D%8E%E8%8A%B3%E7%85%A7%E7%9B%B8%E9%A6%86%EF%BC%88AFong%EF%BC%89%E6%91%84%E5%BD%B1%E9%9B%86&flag=false",
		"items": [
			{
				"itemType": "artwork",
				"title": "香港华芳照相馆（AFong）摄影集",
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
				"extra": "amount: 95\ncreatorsExt: [{\"firstName\":\"\",\"lastName\":\"香港华芳照相馆\",\"creatorType\":\"author\",\"fieldMode\":1,\"country\":\"中国\"},{\"firstName\":\"\",\"lastName\":\"\",\"creatorType\":\"contributor\",\"fieldMode\":1,\"country\":\"\"}]",
				"libraryCatalog": "抗日战争与近代中日关系文献数据平台",
				"url": "https://www.modernhistory.org.cn/#/DocumentDetails_tp?fileCode=9999_tp_00000006",
				"attachments": [],
				"tags": [],
				"notes": [],
				"seeAlso": []
			}
		]
	},
	{
		"type": "web",
		"url": "https://www.modernhistory.org.cn/#/DocumentDetails_ysp_hc?fileCode=0002_sp_00000001&title=%E4%B8%9C%E4%BA%AC%E5%AE%A1%E5%88%A4&flag=false",
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
				"url": "https://www.modernhistory.org.cn/#/DocumentDetails_ysp_hc?fileCode=0002_sp_00000001",
				"videoRecordingFormat": "mp4",
				"attachments": [],
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
		"url": "https://www.modernhistory.org.cn/#/DocumentDetails_da?fileCode=0017_da_0006&title=%E8%A5%BF%E5%8D%97%E5%A4%AA%E5%B9%B3%E6%B4%8B%E6%88%98%E5%8C%BA%E6%97%A5%E6%9C%AC%E6%88%98%E4%BA%89%E5%AB%8C%E7%8A%AF%E8%AE%AF%E9%97%AE%E6%A1%A3%E6%A1%88&flag=false",
		"items": "multiple"
	},
	{
		"type": "web",
		"url": "https://www.modernhistory.org.cn/#/SearchResult_list?searchValue=%E6%B0%91%E4%BF%97&seniorType=&selectType=",
		"items": "multiple"
	}
]
/** END TEST CASES **/
