xpath = Meteor.npmRequire('xpath');
dom = Meteor.npmRequire('xmldom').DOMParser;
Meteor.methods({
	getAssetsForFullText: function(mongoId){
		// console.log('... getAssetsForFullText: ' + mongoId);
		var fut = new future();
		var articleJson,
			articleInfo,
			figures = [],
			xml;
		articleInfo = articles.findOne({'_id' : mongoId});
		if(articleInfo){
			Meteor.call('articleAssests',mongoId, function(assetsError, assets){
				if(assetsError){
					console.error('assetsError',assetsError);
				}else if(assets && assets.xml_url){
					// console.log('XML URL',assets.xml_url);
					if(assets.figures){
						figures = assets.figures;
					}
					Meteor.http.get(assets.xml_url,function(getXmlError, xmlRes){
						if(getXmlError){
							console.error('getXmlError',getXmlError);
							fut['throw'](getXmlError);
						}else if(xmlRes){
							xml = xmlRes.content;
							Meteor.call('fullTextToJson',xml, figures, function(convertXmlError, convertedXml){
								if(convertXmlError){
									console.error('convertXmlError',convertXmlError);
									fut['throw'](convertXmlError);
								}else if(convertedXml){
									fut['return'](convertedXml);
								}
							});
						}
					});
				}
			});
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
		// <ref><label><element-citation>
		// we want to search for //ref because that has the ID attribute. We do not want to rely on the index of the reference for the ID.
		var references = xpath.select('//ref', doc);
		if(references[0]){
			articleObject.references = [];
			for(var referenceIdx = 0 ; referenceIdx < references.length ; referenceIdx++){
				var reference = references[referenceIdx];
				// console.log('... ref ' + referenceIdx);
				var refAttributes = reference.attributes;
				var referenceObj = {};

				// Reference content and type
				// --------------------------
				for(var refPiece =0 ; refPiece < reference.childNodes.length ; refPiece++){
					if(reference.childNodes[refPiece].localName === 'element-citation'){
						// Reference content
						referenceObj = Meteor.fullText.convertReference(reference.childNodes[refPiece])
						// Reference type
						var citationAttributes = reference.childNodes[refPiece].attributes;
						for(var cAttr=0 ; cAttr<citationAttributes.length ; cAttr++){
							if(citationAttributes[cAttr].localName == 'publication-type'){
								referenceObj.type = citationAttributes[cAttr].nodeValue;
							}
						}
					}
				}
				// Reference number
				// ------------------
				for(var refAttr = 0 ; refAttr < refAttributes.length ; refAttr++){
					if(refAttributes[refAttr].localName === 'id'){
						referenceObj.number = refAttributes[refAttr].nodeValue.replace('R','');
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

// for handling sections of XML, content, special elements like figures, references, tables
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
					sectionObject.title = Meteor.fullText.convertContent(sec);
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
					content = '<table class="bordered" id="' + tableId + '">';
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
				var nodeAnchor = '',
					nValue = '';
				// console.log('cc = ' + cc );
				if(childNode.localName != null){
					content += '<' + childNode.localName + '>';
				}

				// Special tags - xref
				// --------
				if(childNode.localName === 'xref'){
					// Determine - Reference or Figure?
					nValue = childNode.childNodes[0].nodeValue;
					var attributes = childNode.attributes;
					// tagName should be replace with figure or reference id. nodeValue would return F1C, but rid will return F1.
					for(var attr = 0 ; attr < attributes.length ; attr++){
						// console.log('      ' +attributes[attr].nodeName + ' = ' + attributes[attr].nodeValue);
						if(attributes[attr].nodeName === 'rid'){
							nodeAnchor = attributes[attr].nodeValue;
						}
					}
					content += '<a href="#' + nodeAnchor + '"  class="anchor">';
					content += nValue;
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
		var figObj = {};
		// get the figure ID
		for(var figAttr = 0 ; figAttr < node.attributes.length ; figAttr++){
			if(node.attributes[figAttr].localName === 'id'){
				figObj.id = node.attributes[figAttr].nodeValue;
				for(var f = 0 ; f < figures.length ; f++){
					if(figures[f]['figureID'] === figObj.id){
						// TODO : are there ever more than 1 image in this array? assets api response has an array of images for each fig.. waiting for example
						figObj.url = figures[f]['imgURLs'][0];
					}
				}
			}
		}

		// get the figure label, title, caption
		//------------------
		if(node.childNodes){

			for(var figChild=0 ; figChild < node.childNodes.length ; figChild++){
				var nod = node.childNodes[figChild];
				// label
					if(nod.localName == 'label'){
						figObj.label =Meteor.fullText.traverseNode(nod).replace(/^\s+|\s+$/g, '');
					}
				//------------------
				// title and caption
				//------------------
				if(nod.childNodes){
					for(var c = 0 ; c < nod.childNodes.length ; c++){
						var n = nod.childNodes[c];
						// console.log(n.localName);
						// figure title
						// ------------
						if(n.localName == 'title'){
							figObj.title =  Meteor.fullText.traverseNode(n).replace(/^\s+|\s+$/g, '');
						}
						// figure caption
						// ------------
						if(n.localName == 'p'){
							figObj.caption = Meteor.fullText.convertContent(n);
						}
					}
				}
			}
		}

		return figObj;
	},
	convertReference: function(reference){
		// console.log('...............convertReference');
		var referenceObj = {};
		for(var r = 0 ; r < reference.childNodes.length ; r++){
			// console.log('r = ' + r);
			if(reference.childNodes[r].childNodes){
				var referencePart,
					referencePartName;
				// Reference Title, Source, Pages, Year, Authors
				// -------
				if(reference.childNodes[r].localName){
					referencePart = reference.childNodes[r];
					referencePartName = reference.childNodes[r].localName.replace('-','_'); // cannot use dash in handlebars template variable
					// console.log(referencePartName);
					if(referencePartName == 'person_group'){
						referenceObj.authors = Meteor.fullText.traverseAuthors(referencePart);
					}else if(referencePartName == 'pub_id'){
						// make sure attribute has pmid
						var pmid = false;
						for(var attr=0 ; attr<referencePart.attributes.length ; attr++){
							// console.log(attr);
							if(referencePart.attributes[attr].nodeName == 'pub-id-type' && referencePart.attributes[attr].nodeValue == 'pmid'){
								// console.log(referencePart.childNodes[0].nodeValue);
								referenceObj.pmid =referencePart.childNodes[0].nodeValue;
							}
						}
					}else if(referencePartName == 'article_title'){
						if(referencePart.childNodes){
							var referencePartCount = referencePart.childNodes.length;
							for(var part = 0 ; part < referencePartCount ; part++){
								if(referencePart.childNodes[part].nodeValue){
									referenceObj['title'] = referencePart.childNodes[part].nodeValue;
								}
							}
						}
					}else if(referencePartName){
						// source, year, pages, issue, volume, chapter_title
						if(referencePart.childNodes){
							var referencePartCount = referencePart.childNodes.length;
							for(var part = 0 ; part < referencePartCount ; part++){
								if(referencePart.childNodes[part].nodeValue){
									referenceObj[referencePartName] = referencePart.childNodes[part].nodeValue;
								}
							}
						}
					}
				}
			}
		}

		// console.log(referenceObj);
		return referenceObj;
	},
	traverseAuthors: function(node){
		// console.log('..traverseNode');
		// first creating an array, so that we can ignore empty nodes
		// then using a string,
		// because there is some logic that is too complicated for handlebars. For ex, when 2 authors there is no comma and instead 'and' is used.
		var authors = [];
		if(node.childNodes){
			for(var c = 0 ; c < node.childNodes.length ; c++){
				var n = node.childNodes[c];
				if(n.nodeValue != ''){
					var author = '';
					// Get the author name
					if(n.nodeType == 3){
						author += n.nodeValue;
					}else{
						author += Meteor.fullText.traverseNode(n);
					}

					// trim author name
					author = author.replace(/^\s+|\s+$/g, '');
					if(author.length != 0){
						// if not empty node
						authors.push(author);
					}
				}
			}
		}

		// now join array
		if(authors.length > 2){
			authors = authors.join(', ');
		}else if(authors.length == 2){
			authors = authors.join(' and ');
		}else if(authors.length > 1){
			authors = authors.join('');
		}

		return authors;
	},
	traverseTable: function(node){
		// console.log('-----------------------traverseTable');
		// TODO: make this more general for traversing all nodes, not just table

		// TODO combine label and title
		var nodeString = '',
			tableHeading = '',
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

			if(n.localName == 'label'){
				// Table Title - part one
				tableLabel = Meteor.fullText.traverseTable(n);
			}else if( n.localName == 'caption'){
				// Table Title - part three
				// do not use traversing functions. problem keeping title separate
				for(var cc = 0 ; cc < n.childNodes.length ; cc++){
					if(n.childNodes[cc].localName == 'title'){
						tableTitle = Meteor.fullText.convertContent(n.childNodes[cc]);
					}else if(n.childNodes[cc].localName == 'p'){
						tableCaption += Meteor.fullText.convertContent(n.childNodes[cc]);
					}
				}
				tableHeading = '<h4>' + tableLabel + '. ' + tableTitle + '</h4><p>' + tableCaption + '</p>';
				nodeString += '<caption>' + tableHeading + '</caption>'
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
	traverseNode: function(node){
		// console.log('..traverseNode');
		// console.log(node.childNodes.length);
		var string = '';
		if(node.childNodes){
			for(var c = 0 ; c < node.childNodes.length ; c++){
				// console.log('..'+c);

				var n = node.childNodes[c];
				if(n.nodeType == 3 && n.nodeValue.replace(/^\s+|\s+$/g, '').length != 0){
					// console.log(n.nodeValue);
					string += n.nodeValue + ' ';
				}else{
					string += Meteor.fullText.traverseNode(n);
				}
			}
		}

		return string;
	},
	fixTags: function(content){
		// console.log('...fixTags');
		// Either object or string.
		// Figures are the only one with content array containing objects instead of strings
		if(typeof content == 'string'){
			// style tags
			content = content.replace(/<italic>/g,'<i>');
			content = content.replace(/<\/italic>/g,'</i>');
			content = content.replace(/<bold>/g,'<b>');
			content = content.replace(/<\/bold>/g,'</b>');

			// remove deprecated
			content = content.replace(/<fn>/g,'');
			content = content.replace(/<\/fn>/g,'');
		}else{
			// figures
			if(content.label){
				var label = Meteor.fullText.fixTags(content.label);
				content.label = label;
			}
			if(content.title){
				var title = Meteor.fullText.fixTags(content.title);
				content.title = title;
			}
			if(content.caption){
				var cap = Meteor.fullText.fixTags(content.caption);
				content.caption = cap;
			}
		}

		return content;
	}
}