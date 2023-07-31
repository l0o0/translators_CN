{
	"translatorID": "dbc3b499-88b6-4661-88c0-c27ac57ccd59",
	"label": "Renmin Ribao Data",
	"creator": "pixiandouban",
	"target": "^https?://data.people.com.cn/rmrb",
	"minVersion": "5.0",
	"maxVersion": "",
	"priority": 100,
	"inRepository": true,
	"translatorType": 4,
	"browserSupport": "gcsibv",
	"lastUpdated": "2022-12-22 09:42:49"
}

function detectWeb(doc, url) {
	var lists = doc.querySelector(".title_list, .daodu_warp");
	if (url.includes('qs') || lists) { //搜索界面
		return "multiple";
	}
	else {
		return "newspaperArticle";
	}
	//to do 匹配新闻版面，不止单篇文章
}

function getSearchResults(doc, checkOnly) {
	var articleList = doc.querySelectorAll(".title_list a, .daodu_warp a, .sreach_li a.open_detail_link");
	var items = {};
	for (let article of articleList) {
		Z.debug(article.textContent);
		Z.debug(article.href);
		items[article.href] = article.textContent;
	}
	return items;
}

function doWeb(doc, url) {
	if (detectWeb(doc, url) == "multiple") {
		Zotero.selectItems(getSearchResults(doc, false), function (items) {
			if (!items) {
				return;
			}
			var articles = [];
			for (var i in items) {
				articles.push(i);
			}
			ZU.processDocuments(articles, scrape);
		});
	}
	else if (detectWeb(doc, url) == "newspaperArticle") {//newspaperArticle 
		scrape(doc, url);
	}
	else {
		return false;
	}
}

function scrape(doc, url) {
	var type = detectWeb(doc, url);
	var item = new Zotero.Item(type);
	var user = null;

	item.title = ZU.xpathText(doc, '//div[@class="title"]');
	var authors = ZU.xpathText(doc, '//div[@class="author"]');
	if (authors) {
		authors = authors.replace("【作者：", "").replace("】", "").split(/[，、\s;]+/);
		//Z.debug(authors);
		if (authors.length > 1) {
			for (i = 0; i < authors.length; i = i + 1) {
				item.creators.push(ZU.cleanAuthor((authors[i]), "author"));
			}
		}
		else if (authors.length === 1) {
			item.creators.push(ZU.cleanAuthor((authors[0]), "author"));
		}
	}
	item.language = 'zh-CN';
	item.url = url;

	item.abstractNote = [];
	//Z.debug(item.abstractNote);

	item.publicationTitle = "人民日报";
	item.ISSN = "1672-8386";
	//item.CN = "11-0065"; //统一刊号

	var d = doc.querySelectorAll('div.sha_left span');
	item.date = d[0].innerText;
	Z.debug(item.date);

	item.attachments.push({
		title: "Snapshot",
		document: doc
	});

	item.complete();

}/** BEGIN TEST CASES **/
var testCases = [
	{
		"type": "web",
		"url": "http://data.people.com.cn/rmrb/20221111/2/9c32c291fb004412bad9eaa6ce828f46",
		"items": [
			{
				"itemType": "newspaperArticle",
				"language": "zh-CN",
				"title": "李克强参观中柬文化遗产交流合作30年成果展并出席文物修复移交仪式"
			}
		]
	},
	{
		"type": "web",
		"url": "http://data.people.com.cn/rmrb/20221111/1/4778f051fb5f49ab9709e7f4d6ed25fe",
		"title": "听取新冠肺炎疫情防控工作汇报 研究部署进一步优化防控工作的二十条措施"
	}
]
/** END TEST CASES **/
