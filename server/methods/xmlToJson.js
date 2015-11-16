xpath = Meteor.npmRequire('xpath');
dom = Meteor.npmRequire('xmldom').DOMParser;
Meteor.methods({
	availableAssests: function(mongoId){
		// console.log('... availableAssests ' + mongoId);
		var fut = new future();
		var pii,
			articleInfo,
			configSettings,
			assetsLink,
			resLinks;
		articleInfo = articles.findOne({'_id' : mongoId});
		if(articleInfo){
			pii = articleInfo.ids.pii;
			configSettings = journalConfig.findOne({});
			assetsLink = configSettings.api.assets;

			if(pii){
				// console.log('assetsLink + pii');
				// console.log(assetsLink + pii);
				// get asset links
				resLinks = Meteor.http.get(assetsLink + pii);
				// console.log('resLinks');
				// console.log(resLinks);
				if(resLinks && resLinks.content != '{"error":"No XML data found for this PII."}'){
					resLinks = resLinks.content;
					resLinks = JSON.parse(resLinks);
					resLinks = resLinks[0];
					if(resLinks.figures.length === 0){
						delete resLinks.figures;
					}
					fut['return'](resLinks);
				}else{
					// console.log('no assets');
					fut['return']({});
				}
			}
			return fut.wait();
		}else{
			return;
		}
	},
	getAssetsForFullText: function(mongoId){
		// console.log('... mongo id = ' + mongoId);
		var fut = new future();
		var articleJson,
			articleFullTextLink,
			articleFullText = [],
			articleFullTextXml,
			pii,
			pmid,
			articleInfo,
			configSettings,
			assetsLink,
			resLinks,
			resXml,
			xml;
		articleInfo = articles.findOne({'_id' : mongoId});
		if(articleInfo){
			pmid = articleInfo.ids.pmid;
			pii = articleInfo.ids.pii;
			configSettings = journalConfig.findOne({});
			assetsLink = configSettings.api.assets;
		}


		if(pii){
			// get asset links
			resLinks = Meteor.http.get(assetsLink + pii);
			if(resLinks){
				resLinks = resLinks.content;
				resLinks = JSON.parse(resLinks);
				resLinks = resLinks[0];
				// console.log('resLinks');console.log(resLinks);
				articleFullTextLink = resLinks.full_xml_url;
			}

			// get XML
			if(articleFullTextLink){
				resXml = Meteor.http.get(articleFullTextLink);
				if(resXml){
					// XML to JSON
					xml = resXml.content;
					// console.log(xml);
				}
			}

			// get Figures


			if(xml){
				var articleJson = Meteor.call('fullTextToJson',xml, resLinks.figures);
			}
		}
		if(articleJson){
			articleJson.figures = resLinks.figures;
			fut['return'](articleJson);
		}
		return fut.wait();
	},
	fullTextToJson: function(xml, figures){
		// Full XML processing. Content, and References
		// console.log('... fullTextToJson');
		var fut = new future();
		var articleObject = {};
		var doc = new dom().parseFromString(xml);

		// Article Content
		// ---------------
		articleObject.sections = [];
		var sections = xpath.select('//sec', doc);
		if(sections[0]){
			// Sections
			for(var section = 0 ; section < sections.length ; section++){
				// console.log('-------section = ' + section);
				// console.log(sections[section].childNodes.length);
				var sectionType;
				var sectionObject = Meteor.fullText.sectionToJson(sections[section],figures);
				for(var sectionAttr = 0 ; sectionAttr < sections[section].attributes.length ; sectionAttr++){
					// console.log(sections[section].attributes[sectionAttr]);
					if(sections[section].attributes[sectionAttr].nodeName === 'sec-type'){
						sectionObject.type = sections[section].attributes[sectionAttr].nodeValue;
					}else if(sections[section].attributes[sectionAttr].nodeName === 'id'){
						var sectionId = sections[section].attributes[sectionAttr].nodeValue;

						sectionObject.headerLevel = Meteor.fullText.headerLevelFromId(sectionId);
						sectionObject.sectionId = sectionId;
					}
				}
				articleObject.sections.push(sectionObject);
			}
		}else{
			var body =  xpath.select('//body', doc);
			// there will only be 1 body node, so use body[0]
			// no <sec>
			// just create 1 section
			var sectionObject = Meteor.fullText.sectionToJson(body[0],figures);
			articleObject.sections.push(sectionObject);
		}

		// References
		// ----------
		// TODO: editorials have a different reference style
		var references = xpath.select('//ref', doc);
		if(references[0]){
			articleObject.references = [];
			for(var reference = 0 ; reference < references.length ; reference++){
				// console.log('... ref ' + reference);
				var refAttributes = references[reference].attributes;
				var referenceObj = {};
				// Reference number
				for(var refAttr = 0 ; refAttr < refAttributes.length ; refAttr++){
					if(refAttributes[refAttr].localName === 'id'){
						referenceObj.number = refAttributes[refAttr].nodeValue.replace('R','');
					}
				}
				var referencePieces = references[reference].childNodes;
				for(var refPiece =0 ; refPiece < referencePieces.length ; refPiece++){
					// console.log('.... ' + refPiece);
					var referenceInfo;
					if(referencePieces[refPiece].localName === 'element-citation'){
						referenceInfo = referencePieces[refPiece];
						for(var r = 0 ; r < referenceInfo.childNodes.length ; r++){
							if(referenceInfo.childNodes[r].childNodes){
								// console.log(referenceInfo.childNodes[r].localName);
								var referencePart = '';
								if(referenceInfo.childNodes[r].localName){
									referencePart = referenceInfo.childNodes[r].localName.replace('-','_');
								}

								// Reference Title, Source, Pages, Year
								// ---------------
								// TODO: nodes with style tags, just title really
								if(referencePart != ''){
									for(var refP = 0 ; refP < referenceInfo.childNodes[r].childNodes.length ; refP++){
										if(referenceInfo.childNodes[r].childNodes[refP].nodeValue){
											referenceObj[referencePart] = referenceInfo.childNodes[r].childNodes[refP].nodeValue;
										}else{
											// there are style tags
											// console.log(referenceInfo.childNodes[r].childNodes[refP]);
											// for(var refTT = 0 ; refTT < referenceInfo.childNodes[r].childNodes[refP].childNodes.length ; refTT++){
											// 	console.log(referenceInfo.childNodes[r].childNodes[refP].childNodes[refTT].localName);
											// 	console.log(referenceInfo.childNodes[r].childNodes[refP].childNodes[refTT].nodeValue);
											// }
										}
									}
								}
							}
						}
					}
				}
				articleObject.references.push(referenceObj);
			}
		}

		if(articleObject){
			fut['return'](articleObject);
		}
		return fut.wait();
	},
});

Meteor.fullText = {
	sectionToJson: function(section,figures){
		// XML processing of part of the content, <sec>
		// console.log('...sectionToJson');
		var sectionObject = {};
		sectionObject.content = [];

		for(var c = 0 ; c < section.childNodes.length ; c++){
			var sec = section.childNodes[c];
			var content,
				contentType;
			if(sec.localName != null){
				// Different processing for different node types
				if(sec.localName === 'title'){
					sectionObject.title = Meteor.fullText.sectionTitle(sec);
				}else if(sec.localName === 'table-wrap'){
					// get attributes
					var tableId;
					var tblAttr = sec.attributes;
					contentType = 'table';
					for(var tblA = 0 ; tblA < tblAttr.length ; tblA++){
						// console.log(tblAttr[tblA].localName + ' = ' + tblAttr[tblA].nodeValue );
						if(tblAttr[tblA].localName === 'id'){
							tableId = tblAttr[tblA].nodeValue;
						}
					}
					content = '<table class="striped" id="' + tableId + '">';
					content += Meteor.fullText.traverseTable(sec);
					content += '</table>';
				}else if(sec.localName === 'fig'){
					content = Meteor.fullText.convertFigure(sec,figures);
					contentType = 'figure';
				}else{
					content = Meteor.fullText.convertContent(sec);
					contentType = 'p';
				}

				// Add the content object to the section objectx
				if(content){
					content = Meteor.fullText.fixTags(content);
					sectionObject.content.push({contentType: contentType , content: content});
				}
			}
		}
		return sectionObject;
	},
	headerLevelFromId: function(sectionId){
		// section ids are in the format, s1, s1_1, s1_1_1
		var sectionIdPieces = sectionId.split('_');
		return sectionIdPieces.length;
	},
	sectionTitle: function(node){
		// Section: Title
		var sectionTitle = '';
		// if length greater than 1, then there are styling tags in the title. for ex, <italic>
		if(node.childNodes.length === 1){
			sectionTitle = node.childNodes[0].nodeValue;
		}else{
			for(var i = 0 ; i < node.childNodes.length ; i++){
				if(node.childNodes[i].nodeValue){
					sectionTitle += node.childNodes[i].nodeValue;
				}else{
					// Get the style tag
					sectionTitle += '<' + node.childNodes[i].localName + '>';
					// Get the node value of the style tag
					sectionTitle += node.childNodes[i].childNodes[0].nodeValue;
					// Close the style tag
					sectionTitle += '</' + node.childNodes[i].localName + '>';
				}
			}
		}
		// console.log(sectionTitle);
		return sectionTitle;
	},
	convertContent: function(node){
		// console.log('convertContent');
		// need to include figures so that we can fill in src within the content
		var content = '';
		// console.log(node.localName);
		if(node.localName != 'sec' && node.childNodes){
			// Section: Content
			// skip <sec> children because these will be processed separately. an xpath query was used to get all <sec> and then we loop through them

			// Style tags
			// --------
			for(var cc = 0 ; cc < node.childNodes.length ; cc++){
				var childNode = node.childNodes[cc];
				var nValue = '';
				// console.log('cc = ' + cc );
				if(childNode.localName != null){
					content += '<' + childNode.localName + '>';
				}

				// Special tags - xref
				// --------
				if(childNode.localName === 'xref'){
					// Determine - Reference or Figure?
					var attributes = childNode.attributes;
					// tagName should be replace with figure or reference id. nodeValue would return F1C, but rid will return F1.
					for(var attr = 0 ; attr < attributes.length ; attr++){
						// console.log('      ' +attributes[attr].nodeName + ' = ' + attributes[attr].nodeValue);
						if(attributes[attr].nodeName === 'rid'){
							nodeV = attributes[attr].nodeValue;
						}
					}
					content += '<a href="#' + nodeV + '">';
					content += nodeV;
					content += '</a>';
				}else if(childNode.nodeType == 3 && childNode.nodeValue.replace(/^\s+|\s+$/g, '').length != 0){
					//plain text or external link
					if(childNode.nodeValue.indexOf('http') != -1 || childNode.nodeValue.indexOf('https') != -1 ){
						content += '<a href="'+ childNode.nodeValue +'" target="_BLANK">' + childNode.nodeValue + '</a>';
					}else{
						content += childNode.nodeValue;
					}

				}else if(childNode.childNodes){
					content += Meteor.fullText.convertContent(childNode);
				}

				if(childNode.localName != null){
					content += '</' + childNode.localName + '>';
				}
				// console.log(content);
			}
		}
		content = Meteor.fullText.fixTags(content);
		return content;
	},
	convertFigure: function(node,figures){
		var content = '',
			figureId = '',
			figureUrl = '',
			figureTitle = '',
			figureCaption = '';
			figureFound  = true;

		// get the figure ID
		for(var figAttr = 0 ; figAttr < node.attributes.length ; figAttr++){
			if(node.attributes[figAttr].localName === 'id'){
				figureId = node.attributes[figAttr].nodeValue;
				for(var f = 0 ; f < figures.length ; f++){
					if(figures[f]['figureID'] === figureId){
						// TODO : are there ever more than 1 image in this array? assets api response has an array of images for each fig.. waiting for example
						figureUrl = figures[f]['imgURLs'][0];
						figureTitle = figures[f]['figureTitle'];
						figureCaption = figures[f]['figureText'];
					}
				}
			}
		}

		// make the figure content
		content += '<div class="full-text-image-container box border-gray center-align" id="' + figureId + '">';
			if(figureTitle != ''){
				content += '<h4>' + figureTitle + '</h4>';
			}
			content += '<img class="materialboxed full-text-image" src="' + figureUrl +'"/>';
			if(figureCaption != ''){
				content += '<p>' + figureCaption + '</p>';
			}
		content += '</div>';
		return content;
	},
	traverseTable: function(node){
		// console.log('-----------------------traverseTable');
		// TODO: make this more general for traversing all nodes, not just table

		// TODO combine label and title
		var nodeString = '',
			tableLabel = '',
			tableCaption = '',
			tableTitle = '';
		for(var c = 0 ; c < node.childNodes.length ; c++){
			var n = node.childNodes[c];
			// console.log(n.localName);
			// Start table el tag
			if(n.localName != null && n.localName != 'title' && n.localName != 'label' && n.localName != 'caption' && n.localName != 'table' && n.localName != 'table-wrap-foot'){// table tag added in sectionToJson()
				nodeString += '<' + n.localName + '>';
			}

			if(n.localName === 'label'){
				// Table Title - part one
				tableLabel = Meteor.fullText.traverseTable(n);
			}else if( n.localName == 'caption'){
				// Table Title - part two
				tableCaption = Meteor.fullText.traverseTable(n)
				tableTitle = tableLabel + '. ' + tableCaption;
				nodeString += '<caption>' + tableTitle + '</caption>'
			}else if(n.localName == 'table-wrap-foot'){
				// console.log('..footer');
				nodeString += '<tfoot>';
				// console.log(n);
				nodeString += '<tr>';
				nodeString += '<td>';
				nodeString += Meteor.fullText.traverseTable(n);
				nodeString += '</td>';
				nodeString += '</tr>';
				nodeString += '</tfoot>';
			}else{
				// Table content
				if(n.nodeType == 3 && n.nodeValue.replace(/^\s+|\s+$/g, '').length != 0){
					// text node, and make sure it is not just whitespace
					var val = n.nodeValue;
					nodeString += val;
				}else if(n.childNodes){
					nodeString += Meteor.fullText.traverseTable(n);
				}

				// Close table el tag
				if(n.localName != null && n.localName != 'title' && n.localName != 'label' && n.localName != 'caption' && n.localName != 'table' && n.localName != 'table-wrap-foot'){
					nodeString += '</' + n.localName + '>'
				}
			}
		}
		// console.log(nodeString);
		return nodeString;
	},
	fixTags: function(content){
		// style tags
		content = content.replace(/<italic>/g,'<i>');
		content = content.replace(/<\/italic>/g,'</i>');
		content = content.replace(/<bold>/g,'<b>');
		content = content.replace(/<\/bold>/g,'</b>');

		// remove deprecated
		content = content.replace(/<fn>/g,'');
		content = content.replace(/<\/fn>/g,'');

		return content;
	}
}