{
	"translatorID": "4424aefd-bcc9-41d7-ad2a-fb63c86b267f",
	"label": "BiliBili",
	"creator": "Xingzhong Lin",
	"target": "^https?://([^/]+\\.)?bilibili\\.com",
	"minVersion": "3.0",
	"maxVersion": "",
	"priority": 100,
	"inRepository": true,
	"translatorType": 4,
	"browserSupport": "gc",
	"lastUpdated": "2020-07-03 11:38:55"
}

/*
	***** BEGIN LICENSE BLOCK *****

	Copyright © 2020 Xingzhong Lin
	
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
  if (/\/video\/(BV|bv|av)/.test(url)) {
	return "videoRecording";
  } else
  if (getSearchResults(doc, true)) {
	return "multiple";
  }
  return false;
}

function getSearchResults(doc, checkOnly, itemInfos) {
  var items = {};
  var found = false;
  var rows = ZU.xpath(doc, "//ul[contains(@class, 'video-list')]/li");
  for (let row of rows) {
	let href = row.getElementsByTagName('a')[0].href;
	let title = ZU.trimInternal(row.getElementsByTagName('a')[0].title);
	if (!href || !title) continue;
	if (checkOnly) return true;
	found = true;
	items[href] = title;
	if (itemInfos) {
		itemInfos[href] = row;
	}
  }
  return found ? items : false;
}

function doWeb(doc, url) {
  if (detectWeb(doc, url) == "multiple") {
  	var itemInfos = {};
  	var items = getSearchResults(doc, false, itemInfos);
	Zotero.selectItems(items, function (selectedItems) {
	  for (url in selectedItems) {
	  	// Z.debug(url);
	  	selectedRow = itemInfos[url];
	  	scrape(selectedRow, url);
	  }
	});
  } else
  {
	scrape(doc, url);
  }
}


function scrape(doc, url) {
	var item = new Zotero.Item("videoRecording");
	var title = ZU.xpath(doc, "//h1[@class='video-title']");
	if (!title.length) {
		title = ZU.xpath(doc, ".//a[@class='title']"); 
	}
	// Z.debug(title[0]);
	item.title = title[0].title;
	
	item.url = url;
	var time = ZU.xpath(doc, "//span[@class='bilibili-player-video-time-total']");
	if (!time.length) {
		time = ZU.xpath(doc, "./a");
	}
	item.runningTime = time[0].innerText;
	var update = ZU.xpath(doc, "//div[@class='video-data'][1]/span[2]");
	if (!update.length) { 
		update = ZU.xpath(doc, "./div/div[3]/span[3]");
	}
	item.date = ZU.trimInternal(update[0].innerText);
	if (item.date) {
		item.date = ZU.strToISO(item.date);
	}
	var author = ZU.xpath(doc, "//div[@class='u-info']/div[@class='name']/a[1]");
	if (!author.length) {
		author = ZU.xpath(doc, "./div/div[3]/span[4]");
	}
	item.creators.push({
		lastName: author[0].innerText,
		creatorType: "author",
		fieldMode: 1
	});
	
	var description = ZU.xpath(doc, "//div[@id='v_desc']/div[contains(@class, 'info')]");
	if (description.length) {
		item.abstractNote = ZU.cleanTags(description[0].innerText);
	}
	
	var tags = ZU.xpath(doc, "//li[@class='tag'] ");
	if (tags.length) {
		item.tags = [];
		for (var tag of tags) {
			item.tags.push(tag.innerText);
		}
	}
	
	var series = ZU.xpath(doc, "//div[@class='cur-list']");
	if (series.length) {
		item.seriesTitle = item.title;
		var cur = ZU.xpath(doc, "//div[@class='cur-list']//li[contains(@class, 'on')]")[0];
		item.title = cur.innerText;
		var list = ZU.xpath(doc, "//div[@class='cur-list']//li");
		item.numberOfVolumes = list.length;
		item.volume = list.indexOf(cur) + 1;
	}
	item.complete();
}
