{
	"translatorID": "5b731187-04a7-4256-83b4-3f042fa3eaa4",
	"label": "Ncpssd",
	"creator": "018<lyb018@gmail.com>,l0o0<linxzh1989@gmail.com>",
	"target": "^https?://([^/]+\\.)?ncpssd\\.(org|cn)",
	"minVersion": "3.0",
	"maxVersion": "",
	"priority": 100,
	"inRepository": true,
	"translatorType": 4,
	"browserSupport": "gcsibv",
	"lastUpdated": "2024-02-10 13:18:05"
}

/*
	***** BEGIN LICENSE BLOCK *****

	Copyright © 2020 018<lyb018@gmail.com>
	
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

class ID {
	constructor(url) {
		this.id = tryMatch(url, /[?&]id=([^&#]*)/i, 1);
		this.datatype = tryMatch(url, /[?&]type=([^&#]*)/i, 1);
		this.typename = decodeURI(tryMatch(url, /[?&]typename=([^&#]*)/i, 1));
		this.barcodenum = tryMatch(url, /[?&]barcodenum=([^&#]*)/i, 1);
	}

	toItemType() {
		return {
			journalArticle: 'journalArticle',
			eJournalArticle: 'journalArticle',
			Ancient: 'book',
			collectionsArticle: 'journalArticle'
		}[this.datatype];
	}

	static toTypeName(datatype) {
		return {
			journalArticle: '中文期刊文章',
			eJournalArticle: '外文期刊文章',
			Ancient: '古籍',
			collectionsArticle: '集刊'
		}[datatype];
	}

	static toUrl(ids) {
		return encodeURI(
			'https://www.ncpssd.cn/Literature/articleinfo'
			+ `?id=${ids.id}`
			+ `&type=${ids.datatype}`
			+ `&typename=${ids.typename}`
			+ `&nav=0`
			+ `+&barcodenum=${ids.barcodenum}`
		);
	}

	toBoolean() {
		return (this.id && this.datatype);
	}
}

function detectWeb(doc, url) {
	let ids = new ID(url);
	Z.debug(ids);
	if (ids.toBoolean()) {
		return ids.toItemType();
	}
	else if (getSearchResults(doc, true)) {
		return 'multiple';
	}
	return false;
}

function getSearchResults(doc, checkOnly) {
	var items = {};
	var found = false;
	var rows = doc.querySelectorAll('#ul_articlelist li .julei-list a:first-of-type, a[onclick*="/Literature/"]');
	for (let row of rows) {
		let title = ZU.trimInternal(row.textContent);
		let datatype = {
			中文期刊文章: 'journalArticle',
			外文期刊文章: 'eJournalArticle',
			古籍: 'Ancient',
			外文图书: 'Book'
		}[row.getAttribute('data-type')];
		let url = datatype
			? ID.toUrl({
				id: row.getAttribute('data-id'),
				// 这里没有填反
				datatype: datatype,
				typename: row.getAttribute('data-type'),
				barcodenum: row.getAttribute('data-barcodenum')
			})
			: `https://www.ncpssd.cn${tryMatch(row.getAttribute('onclick'), /\('(.+)'\)/, 1)}`;
		if (checkOnly) return true;
		found = true;
		items[url] = title;
	}
	return found ? items : false;
}

async function doWeb(doc, url) {
	if (detectWeb(doc, url) == 'multiple') {
		let items = await Zotero.selectItems(getSearchResults(doc, false));
		if (!items) return;
		for (let url of Object.keys(items)) {
			await scrape(url);
		}
	}
	else {
		await scrape(url);
	}
}

async function scrape(url) {
	const ids = new ID(url);
	Z.debug(ids);
	var newItem = new Z.Item(ids.toItemType());
	newItem.extra = '';
	let postData = { type: ID.toTypeName(ids.datatype) };
	if (ids.datatype == 'Ancient') {
		postData.barcodenum = ids.barcodenum;
	}
	else {
		postData.lngid = ids.id;
	}
	postData = JSON.stringify(postData);
	Z.debug(postData);
	var json = {};
	const debug = false;
	if (debug) {
		json = {
			result: true,
			code: 200,
			data: {
				lngid: "7101551591",
				mediac: "心理学报",
				mediae: null,
				years: 2020,
				vol: "52",
				num: "5",
				volumn: "2020",
				specialnum: "B",
				subjectnum: "5",
				gch: "90117X",
				titlec: "长时联结表征对工作记忆的抑制效应",
				titlee: "The inhibitory effect of long-term associative representation on working memory",
				keywordc: "长时记忆;工作记忆;联结记忆;alpha震荡",
				keyworde: "long-term memory;working memory;associative memory;alpha power",
				remarkc: "本研究通过两个实验探讨了长时记忆联结表征如何影响当下工作记忆任务的加工。长时记忆联结表征采用无语义联系、无视觉相似性的Emoji图片对,提前一天让被试完成联结表征的建立,正式工作记忆任务采用独立探测的变化觉察范式。实验1控制呈现时间(500 ms/1000 ms)与呈现方式(联结/独立),发现两种呈现时间均显示出联结条件的正确率与记忆容量显著低于独立条件,说明长时记忆联结表征抑制了当前工作记忆的加工。实验2设置了记忆项目数(2/4/6项)与呈现方式(联结/独立),采用alpha震荡作为脑电指标,考察长时联结表征在工作记忆维持阶段的作用。结果发现在维持阶段,独立条件的alpha震荡随着记忆项目数量的增加而增大(2项<4项<6项),而联结条件在4项已经到达顶点(2项<4项=6项)。实验2进一步说明长时联结表征在维持阶段降低了当前工作记忆容量。本研究的两个实验结果表明,长时记忆联结表征对当前的工作记忆任务有一定的抑制作用,这种抑制作用产生的机制可能来自于联结表征干扰了维持阶段的注意分配。",
				remarke: "Studies on how long-term memory affects working memory(WM) have found that long-term memory can enhance WM processing. However, these studies only use item memory as the representation of long-term memory. In addition to item memory, associative memory is also an essential part of long-term memory. The associative memory and item memory involve different cognitive mechanisms and brain areas. The purpose of the present study was to investigate how associative memory affects WM processing. Before the WM task, participants were asked to store 16 pairs of dissimilar pictures into long-term memory. The participants would obtain the associative memory of these pairs of pictures in the long-term memory. The WM task was a change detection paradigm. Memory pictures in the memory array appeared in pairs(associative condition) or out of pairs(independent condition). In Experiment 1, the memory array with 6 items(3 pairs) was presented for 500 ms or 1000 ms. After a 1000 ms interval, participants needed to determine whether the probe item was the same as the memory array. The design and procedure of Experiment 2 were similar to those of Experiment 1, except that memory array was presented for only 500 ms, and 2 items(1 pairs) and 4 terms(2 pairs) were added in set size condition. Alpha power of electroencephalogram(EEG) was also collected and analyzed in Experiment 2. The results in Experiment 1 showed that WM capacity and accuracy were significantly lower in the associative condition than in the independent condition(for both presentation-time conditions: 500 ms and 1000 ms). The results in Experiment 2 showed that the alpha power in the independent condition increased as the memory set size increased(2 items < 4 items < 6 items), while the alpha power in the associative condition reached the asymptote when the set size was 4(2 items < 4 items = 6 items). Both of these two experiments’ results showed that WM capacity in the associative condition was lower than that in the independent condition. In conclusion, long-term associative representations inhibit the current WM processing and decrease WM capacity. This inhibitory effect is not affected by the length of encoding time. It implies that the reason for the increase of WM load by associative memory may come from the disorder of attention distribution.",
				clazz: "B842",
				beginpage: "562",
				endpage: "571",
				pagecount: 10,
				showwriter: "张引[1,2];梁腾飞[1,2];叶超雄[1,3];刘强[1,2]",
				showorgan: "[1]四川师范大学脑与心理科学研究院,成都610000;[2]辽宁师范大学脑与认知神经科学研究中心,大连116029;[3]于韦斯屈莱大学心理学系,芬兰于韦斯屈莱,40014",
				imburse: null,
				mediasQk: "2020年第5期,共10页",
				processdate: "2020-07-13",
				refercount: 0,
				referidsReal: null,
				range: "核心刊;BDHX2011;BDHX2004;BDHX2000;JST;CSSCI2010_2011;CSSCI2004_2005;CSSCI1999;BDHX1996;CSSCI2012_2013;CSC",
				fstorgan: 0,
				fstwriter: 0,
				firstwriter: "张引",
				firstorgan: "四川师范大学脑与心理科学研究院,成都610000",
				language: 1,
				type: 1,
				issn: "0439-755X",
				firstclass: "B842",
				publishdate: "2020-05-01",
				source: "nssd",
				pdfsize: 3097857,
				pdfurl: "http://www.nssd.org/articles/article_down.aspx?id=7101551591",
				isshield: false,
				isdelete: false,
				authore: "ZHANG Yin;LIANG Tengfei;YE Chaoxiong;LIU Qiang(Institute of Brain and Psychological Sciences,Sichuan Normal University,Chengdu 610000,China;Research Center of Brain and Cognitive Neuroscience,Liaoning Normal University,Dalian 116029,China;Department of Psychology,University of Jyvaskyla,Jyvaskyla,40014,Finland)",
				lagtype: null,
				coverPic: null,
				lngCollectIDs: null,
				lngids: null,
				lngidList: null,
				synUpdateType: null,
				id: null,
				title: null,
				author: null,
				pagenum: null,
				fileaddress: null,
				journalShieldRemark: null,
				periodShieldRemark: null,
				addtime: null,
				gchId: null,
				batchDate: null,
				sortId: null,
				month: null,
				isRecom: null,
				replaceId: null,
				top: null,
				publishDateTime: null,
				titleAcronym: null,
				iscollect: null,
				linkUrl: null,
				collections: null,
			},
			succee: true,
		};
	}
	else {
		let postUrl = `https://www.ncpssd.cn/articleinfoHandler/${ids.datatype == 'Ancient' ? 'getancientbooktable' : 'getjournalarticletable'}`;
		Z.debug(postUrl);
		json = await requestJSON(
			postUrl,
			{
				method: 'POST',
				body: postData,
				headers: {
					// 以下是必需的
					'Content-Type': 'application/json',
					Referer: encodeURI(url)
				}
			}
		);
	}
	let data = {
		innerData: json.data,
		getWith: function (label) {
			let result = this.innerData[label];
			return result
				? result
				: '';
		}
	};
	Z.debug(json);
	newItem.title = data.getWith('titlec');
	newItem.abstractNote = data.getWith('remarkc');
	newItem.publicationTitle = data.getWith('mediac');
	switch (newItem.itemType) {
		case 'journalArticle':
			newItem.volume = tryMatch(data.getWith('vol'), /0*([1-9]\d*)/, 1);
			newItem.issue = data.getWith('num').replace(/([A-Z]?)0*([1-9]\d*)/i, '$1$2');
			newItem.pages = Array.from(
				new Set([data.getWith('beginpage'), data.getWith('endpage')].filter(page => page))
			).join('-');
			newItem.date = data.getWith('publishdate');
			newItem.ISSN = data.getWith('issn');
			data.getWith('showwriter').split(';').forEach((string) => {
				let creator = ZU.cleanAuthor(string.replace(/\[.*\]$/, ''), 'author');
				if (/[\u4e00-\u9fff]/.test(creator.lastName)) {
					creator.lastName = creator.firstName + creator.lastName;
					creator.firstName = '';
					creator.fieldMode = 1;
				}
				newItem.creators.push(creator);
			});
			break;
		case 'book':
			newItem.abstractNote = '';
			newItem.publisher = data.getWith('press');
			newItem.date = data.getWith('pubdate');
			newItem.edition = data.getWith('section');
			data.getWith('authorc').split(';').forEach((string) => {
				let creator = ZU.cleanAuthor(string.slice(3, -1), 'author');
				if (/[\u4e00-\u9fff]/.test(creator.lastName)) {
					creator.lastName = creator.firstName + creator.lastName;
					creator.firstName = '';
					creator.fieldMode = 1;
				}
				newItem.creators.push(creator);
			});
			extra.add('classify', data.getWith('classname'));
			extra.add('remark', data.getWith('remarkc'));
			extra.add('barcode', data.getWith('barcodenum'));
			extra.add('Type', 'classic', true);
			break;
	}
	newItem.language = ['zh-CN', 'en-US'][data.getWith('language') - 1];
	newItem.url = ID.toUrl(ids);
	newItem.libraryCatalog = '国家哲学社会科学文献中心';
	extra.add('original-title', data.getWith('titlee'), true);
	data.getWith('keywordc').split(';').forEach(tag => newItem.tags.push(tag));
	let pdfLink = data.getWith('pdfurl');
	if (pdfLink) {
		newItem.attachments.push({
			url: pdfLink,
			mimeType: 'application/pdf',
			title: 'Full Text PDF',
		});
	}
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
		"url": "https://www.ncpssd.org/Literature/articlelist?sType=0&search=KElLVEU9IuaWh+WMluiHquS/oSIgT1IgSUtQWVRFPSLmlofljJboh6rkv6EiICBPUiBJS1NUPSLmlofljJboh6rkv6EiIE9SIElLRVQ9IuaWh+WMluiHquS/oSIgT1IgSUtTRT0i5paH5YyW6Ieq5L+hIik=&searchname=6aKY5ZCNL+WFs+mUruivjT0i5paH5YyW6Ieq5L+hIg==&nav=0&ajaxKeys=5paH5YyW6Ieq5L+h",
		"items": "multiple"
	},
	{
		"type": "web",
		"url": "https://www.ncpssd.org/index",
		"items": "multiple"
	},
	{
		"type": "web",
		"url": "https://www.ncpssd.org/Literature/articleinfo?id=SDJY2023035035&type=journalArticle&datatype=null&typename=%E4%B8%AD%E6%96%87%E6%9C%9F%E5%88%8A%E6%96%87%E7%AB%A0&synUpdateType=undefined&nav=0&barcodenum=&pageUrl=https%253A%252F%252Fwww.ncpssd.org%252FLiterature%252Farticlelist%253Fsearch%253DKElLVEU9IuaWh%252BWMluiHquS%252FoSIgT1IgSUtQWVRFPSLmlofljJboh6rkv6EiICBPUiBJS1NUPSLmlofljJboh6rkv6EiIE9SIElLRVQ9IuaWh%252BWMluiHquS%252FoSIgT1IgSUtTRT0i5paH5YyW6Ieq5L%252BhIikgQU5EIChUWVBFPSLkuK3mlofmnJ%252FliIrmlofnq6AiKQ%253D%253D%2526searchname%253D6aKY5ZCNL%252BWFs%252BmUruivjT0i5paH5YyW6Ieq5L%252BhIiDkuI4gKOexu%252BWeiz3kuK3mlofmnJ%252FliIrmlofnq6Ap%2526nav%253D0",
		"items": [
			{
				"itemType": "journalArticle",
				"title": "文化自信视角下陶行知外语论著的海外传播",
				"creators": [
					{
						"firstName": "",
						"lastName": "郭晓菊",
						"creatorType": "author",
						"fieldMode": 1
					}
				],
				"date": "2023-12-10",
				"abstractNote": "陶行知外语论著在世界范围内的传播可被视为中国教育史上的一次现象级传播，同时也是中国教育领域思想与文化的成功输出。作为中国优质教育文化的陶行知外语论著不仅彰显出陶行知教育理念的魅力，也凸显出了中华文化的当代价值及文化自信。基于此，本文在总结陶行知外语论著的传播现状的基础上，阐述了文化自信视角下陶行知外语论著的海外传播。",
				"issue": "35",
				"language": "zh-CN",
				"libraryCatalog": "国家哲学社会科学文献中心",
				"pages": "103-105",
				"publicationTitle": "时代教育",
				"url": "https://www.ncpssd.cn/Literature/articleinfo?id=SDJY2023035035&type=journalArticle&typename=%E4%B8%AD%E6%96%87%E6%9C%9F%E5%88%8A%E6%96%87%E7%AB%A0&nav=0+&barcodenum=",
				"attachments": [],
				"tags": [
					{
						"tag": "外语论著"
					},
					{
						"tag": "文化自信"
					},
					{
						"tag": "陶行知"
					}
				],
				"notes": [],
				"seeAlso": []
			}
		]
	},
	{
		"type": "web",
		"url": "https://www.ncpssd.org/Literature/articleinfo?id=CASS1039961165&type=eJournalArticle&datatype=journalArticle&typename=%E5%A4%96%E6%96%87%E6%9C%9F%E5%88%8A%E6%96%87%E7%AB%A0&synUpdateType=undefined&nav=0&barcodenum=&pageUrl=https%253A%252F%252Fwww.ncpssd.org%252FLiterature%252Farticlelist%253Fsearch%253DKElLVEU9IuaWh%252BWMluiHquS%252FoSIgT1IgSUtQWVRFPSLmlofljJboh6rkv6EiICBPUiBJS1NUPSLmlofljJboh6rkv6EiIE9SIElLRVQ9IuaWh%252BWMluiHquS%252FoSIgT1IgSUtTRT0i5paH5YyW6Ieq5L%252BhIikgQU5EIChUWVBFPSLlpJbmlofmnJ%252FliIrmlofnq6AiKQ%253D%253D%2526searchname%253D6aKY5ZCNL%252BWFs%252BmUruivjT0i5paH5YyW6Ieq5L%252BhIiDkuI4gKOexu%252BWeiz3lpJbmlofmnJ%252FliIrmlofnq6Ap%2526nav%253D0",
		"items": [
			{
				"itemType": "journalArticle",
				"title": "文化自信视域下古体诗词在专业教学中的应用研究",
				"creators": [
					{
						"firstName": "",
						"lastName": "王艺霖",
						"creatorType": "author",
						"fieldMode": 1
					},
					{
						"firstName": "",
						"lastName": "李秀领",
						"creatorType": "author",
						"fieldMode": 1
					},
					{
						"firstName": "",
						"lastName": "王军",
						"creatorType": "author",
						"fieldMode": 1
					},
					{
						"firstName": "",
						"lastName": "张玉明",
						"creatorType": "author",
						"fieldMode": 1
					}
				],
				"ISSN": "2160-729X",
				"abstractNote": "为提升理工科专业知识教育与思政教育的实效，本文以土木工程专业为例，基于“文化自信”理念探讨了将古体诗词与专业课程进行有机融合的新思路：首先创作了一系列表达专业知识的古体诗词，体现了文学性、艺术性与专业性的统一，进而提出了在教学中的具体应用方式(融入课件、用于课内；结合新媒体平台、用于课外)。研究表明，本方式可发掘传统文化的现代价值、提升学生的学习兴趣、感受文化自信、促进人文素养的提升，达到专业教育与传统文化教育的双赢。",
				"issue": "11",
				"language": "en-US",
				"libraryCatalog": "国家哲学社会科学文献中心",
				"pages": "4294-4299",
				"url": "https://www.ncpssd.cn/Literature/articleinfo?id=CASS1039961165&type=eJournalArticle&typename=%E5%A4%96%E6%96%87%E6%9C%9F%E5%88%8A%E6%96%87%E7%AB%A0&nav=0+&barcodenum=",
				"volume": "12",
				"attachments": [],
				"tags": [
					{
						"tag": "古体诗词"
					},
					{
						"tag": "土木工程"
					},
					{
						"tag": "思政"
					},
					{
						"tag": "文化自信"
					}
				],
				"notes": [],
				"seeAlso": []
			}
		]
	},
	{
		"type": "web",
		"url": "https://www.ncpssd.org/Literature/articleinfo?id=FXJYYJ2023001009&type=collectionsArticle&datatype=journalArticle&typename=%E9%9B%86%E5%88%8A%E6%96%87%E7%AB%A0&synUpdateType=undefined&nav=0&barcodenum=&pageUrl=https%253A%252F%252Fwww.ncpssd.org%252FLiterature%252Farticlelist%253Fsearch%253DKElLVEU9IuaWh%252BWMluiHquS%252FoSIgT1IgSUtQWVRFPSLmlofljJboh6rkv6EiICBPUiBJS1NUPSLmlofljJboh6rkv6EiIE9SIElLRVQ9IuaWh%252BWMluiHquS%252FoSIgT1IgSUtTRT0i5paH5YyW6Ieq5L%252BhIikgQU5EIChUWVBFPSLpm4bliIrmlofnq6AiKQ%253D%253D%2526searchname%253D6aKY5ZCNL%252BWFs%252BmUruivjT0i5paH5YyW6Ieq5L%252BhIiDkuI4gKOexu%252BWeiz3pm4bliIrmlofnq6Ap%2526nav%253D0",
		"items": [
			{
				"itemType": "journalArticle",
				"title": "文化安全视阈下高校法治人才培养策略研究",
				"creators": [
					{
						"firstName": "",
						"lastName": "雷艳妮",
						"creatorType": "author",
						"fieldMode": 1
					}
				],
				"date": "2023-01-01",
				"abstractNote": "文化安全事关国家安全和人民幸福，高校法治人才培养与文化安全紧密关联。当前，高校法治人才培养面临诸多文化安全困境，如西方价值观的文化渗透、社会不良文化思潮的冲击、网络新媒体应用过程中的负面影响、高校文化安全教育的不足等。对此，高校法治人才培养应当在保障文化安全的前提下开展。其具体策略有五项：一是将习近平法治思想融入高校法治人才培养，牢固树立思想政治意识；二是将中华优秀传统文化融入高校法治人才培养，着力提升思想道德水平；三是将红色文化融入高校法治人才培养，全面提高思想道德修养；四是加强法律职业道德教育，持续提升职业道德水准；五是加强文化安全教育，坚定文化自觉与文化自信。唯有如此，方能为将我国建成社会主义现代化文化强国提供强大的法治人才保障与智力支持。",
				"issue": "1",
				"language": "zh-CN",
				"libraryCatalog": "国家哲学社会科学文献中心",
				"pages": "144-157",
				"publicationTitle": "法学教育研究",
				"url": "https://www.ncpssd.cn/Literature/articleinfo?id=FXJYYJ2023001009&type=collectionsArticle&typename=%E9%9B%86%E5%88%8A%E6%96%87%E7%AB%A0&nav=0+&barcodenum=",
				"volume": "40",
				"attachments": [],
				"tags": [
					{
						"tag": "培养策略"
					},
					{
						"tag": "文化安全"
					},
					{
						"tag": "文化自信"
					},
					{
						"tag": "文化自觉"
					},
					{
						"tag": "法治人才"
					}
				],
				"notes": [],
				"seeAlso": []
			}
		]
	},
	{
		"type": "web",
		"url": "https://www.ncpssd.org/Literature/articleinfo?id=GJ10017&type=Ancient&typename=%E5%8F%A4%E7%B1%8D&nav=5&barcodenum=70050810",
		"items": [
			{
				"itemType": "book",
				"title": "太平樂圖",
				"creators": [
					{
						"firstName": "",
						"lastName": "吳之龍",
						"creatorType": "author",
						"fieldMode": 1
					}
				],
				"edition": "繪本",
				"extra": "Type: classic\nclassify: 子\nremark: 版心：樂闲馆本；浙江民俗畫 \nbarcode: 70050810",
				"libraryCatalog": "国家哲学社会科学文献中心",
				"publisher": "樂闲馆",
				"url": "https://www.ncpssd.cn/Literature/articleinfo?id=GJ10017&type=Ancient&typename=%E5%8F%A4%E7%B1%8D&nav=0+&barcodenum=70050810",
				"attachments": [],
				"tags": [],
				"notes": [],
				"seeAlso": []
			}
		]
	},
	{
		"type": "web",
		"url": "https://www.ncpssd.cn/Literature/articleinfo?id=PRP1192499916434309120&type=journalArticle&datatype=journalArticle&typename=%E4%B8%AD%E6%96%87%E6%9C%9F%E5%88%8A%E6%96%87%E7%AB%A0&synUpdateType=2&nav=0&barcodenum=&pageUrl=https%253A%252F%252Fwww.ncpssd.cn%252FLiterature%252Farticlelist%253FsType%253D0%2526search%253DKElLVEU9IuaWh%252BWMluiHquS%252FoSIgT1IgSUtQWVRFPSLmlofljJboh6rkv6EiICBPUiBJS1NUPSLmlofljJboh6rkv6EiIE9SIElLRVQ9IuaWh%252BWMluiHquS%252FoSIgT1IgSUtTRT0i5paH5YyW6Ieq5L%252BhIik%253D%2526searchname%253D6aKY5ZCNL%252BWFs%252BmUruivjT0i5paH5YyW6Ieq5L%252BhIg%253D%253D%2526nav%253D0%2526ajaxKeys%253D5paH5YyW6Ieq5L%252Bh",
		"items": [
			{
				"itemType": "journalArticle",
				"title": "新中国成立以来中国共产党榜样文化叙事的特色与经验",
				"creators": [
					{
						"firstName": "",
						"lastName": "艾丹",
						"creatorType": "author",
						"fieldMode": 1
					}
				],
				"date": "2024-01-04",
				"ISSN": "1673-3851",
				"abstractNote": "榜样因其真实、生动、形象的特点，具有强大的说服力和感染力。中国共产党榜样文化建设对社会主义核心价值观的培育与践行以及对外弘扬中国价值、彰显中国力量、讲好中国故事等具有不可替代的价值。新中国成立以来，中国共产党榜样文化叙事呈现出鲜明的中国特色，积累了宝贵的工作经验：榜样选树标准突显人民性和时代性的价值取向；榜样典型构建彰显代表性和先进性的双重特质；榜样人物奖励注重规范化和制度化的运作机制；榜样文化传播体现传承性与创新性的融合发展。该研究拓宽了榜样文化的研究视域，有助于深入推进社会主义文化强国建设。",
				"language": "zh-CN",
				"libraryCatalog": "国家哲学社会科学文献中心",
				"pages": "52-58",
				"publicationTitle": "浙江理工大学学报：社会科学版",
				"url": "https://www.ncpssd.cn/Literature/articleinfo?id=PRP1192499916434309120&type=journalArticle&typename=%E4%B8%AD%E6%96%87%E6%9C%9F%E5%88%8A%E6%96%87%E7%AB%A0&nav=0+&barcodenum=",
				"attachments": [
					{
						"mimeType": "application/pdf",
						"title": "Full Text PDF"
					}
				],
				"tags": [
					{
						"tag": "中国共产党 榜样文化 英雄模范 主流意识形态 精神谱系 社会主义核心价值观 文化自信"
					}
				],
				"notes": [],
				"seeAlso": []
			}
		]
	}
]
/** END TEST CASES **/
