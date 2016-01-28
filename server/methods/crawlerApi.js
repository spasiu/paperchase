Meteor.methods({
	intiateArticleCollection: function(){
		console.log('..intiateArticleCollection');
		//for initiating articles collection. PII/PMID/Title sent from crawler
		// first make sure there are 0 docs
		if(articles.find().fetch().length == 0){
			var requestURL =  journalConfig.findOne().api.crawler + '/initiate_articles_collection/' + journalConfig.findOne().journal.short_name;
			Meteor.http.get(requestURL, function(error,result){
				if(error){
					console.error(error);
					throw new Meteor.Error(503, 'ERROR: DOI Registered Check' , error);
				}else if(result){
					// combine with articles DB
					var articlesList = JSON.parse(result.content);
					for(var a=0 ; a<articlesList.length ; a++){
						if(articlesList[a]['ids']['pii']){
							articlesList[a]['ids']['paperchase_id'] = articlesList[a]['ids']['pii'];
						}else if(articlesList[a]['ids']['doi']){
							articlesList[a]['ids']['paperchase_id'] = articlesList[a]['ids']['doi'];
						}else if(articlesList[a]['ids']['pmid']){
							articlesList[a]['ids']['paperchase_id'] = articlesList[a]['ids']['pmid'];
						}else{
							console.log('..missing IDS');
							console.log(articlesList[a]);
						}
						if(articlesList[a]['ids']['paperchase_id']){
							articlesList[a]['ids']['paperchase_id'] = articlesList[a]['ids']['paperchase_id'].replace(/\//g,'_');
						}else{
							console.log('MISSING paperchase_id: ' + JSON.stringify(articlesList[a]['ids']));
						}
						// console.log(articlesList[a]['ids']);
						Meteor.call('addArticle',articlesList[a],function(addError,articleAdded){
							if(addError){
								console.error('addError: ' + articlesList[a]['pii'], addError);
							}else if(articleAdded){
								console.log('added: '+ articleAdded);
							}
						});
					}
				}else{
					console.error('Could Not Initiate Articles Collection');
				}
			});
		}
	},
	getAllArticlesDoiStatus: function(){
		// console.log('..getAllArticlesDoiStatus');
		var fut = new future();
		var journalShortName = journalConfig.findOne().journal.short_name;
		var requestURL =  journalConfig.findOne().api.crawler + '/doi_status/' + journalShortName;
		var registerURL = journalConfig.findOne().api.doi;
		// console.log('requestURL = ' + requestURL);
		Meteor.http.get(requestURL, function(error,result){
			if(error){
				console.error(error);
				fut['throw'](error);
				throw new Meteor.Error(503, 'ERROR: DOI Registered Check' , error);
			}else if(result){
				// combine with articles DB
				// console.log('articles',result.content);
				var articlesDoiList = JSON.parse(result.content);

				for(var a=0 ; a<articlesDoiList.length ; a++){
					articlesDoiList[a]['paperchase'].doiRegisterUrl = registerURL + journalShortName + '/';
				}
				fut['return'](articlesDoiList);
			}
		});

		return fut.wait();
	},
	getAllArticlesPmcXml: function(){
		console.log('..getAllArticlesPmcXml');
		var fut = new future();
		var requestURL =  journalConfig.findOne().api.crawler + '/crawl_xml/' + journalConfig.findOne().journal.short_name;

		var missingInPaperchase = [];
		Meteor.http.get(requestURL, function(error,result){
			if(error){
				console.error(error);
				throw new Meteor.Error(503, 'ERROR: XML to S3' , error);
			}else if(result){
				// console.log('All XML Saved',result);
				// Loop through all articles in response and update the XML collection in the DB
				articlesList = result.data;
				if(articlesList.length > 1){
					// All article processed on crawler. Now update the XML collection. Return those without a paperchase_id to user.
					for(var i=0 ; i<articlesList.length ; i++){
						var paperchaseId = articlesList[i]['ids']['paperchase_id'];
						if(paperchaseId){
							updated = xmlCollection.update({paperchase_id: paperchaseId},{$set:articlesList[i]},{upsert: true});
						}else{
							missingInPaperchase.push(articlesList[i]);
						}
						if(i == parseInt(articlesList.length -1)){
							// TODO: fut not returning..
							fut['return'](articlesList.length);
							console.log('Could not update these. They are missing paperchase_id:',missingInPaperchase);
						}
					}
				}else{
					// No articles were updated
					console.error('No article XML was updated in crawl');
					fut['return'](true);
				}
			}
		});
		return fut.wait();
	},
	getLegacyEpub: function(){
		// use crawler to return JSON of article epub dates from legacy DB
		// then update the articles collection in the paperchase DB
		// console.log('..getLegacyEpub');
		var requestURL =  journalConfig.findOne().api.crawler + '/articles_epub_legacy/' + journalConfig.findOne().journal.short_name;
		// console.log(requestURL);
		Meteor.http.get(requestURL, function(error,articlesListRes){
			if(error){
				console.error(error);
				throw new Meteor.Error(503, 'ERROR: XML to S3' , error);
			}else if(articlesListRes){
				articlesList = articlesListRes.data;
				// console.log('articles = ',articlesList.length);
				for(var i=0 ; i<articlesList.length ; i++){
					if(articlesList[i]['published']){
						var pii = articlesList[i]['idarticles'].toString();
						var epubDate = new Date(articlesList[i]['published'] + ' 00:00:00.0000');
						// console.log(pii + ': ' + articlesList[i]['published'] + ' : ' + epubDate);
						articles.update({'ids.pii' : pii},{$set: {'dates.epub' :epubDate}});
					}
				}
			}
		});
	},
	getCrossRefEpub: function(){
		console.log('..getCrossRefEpub');
		var fut = new future();
		Meteor.call('getAllArticlesDoiStatus',function(error,articlesList){
			if(error){
				console.error('getCrossRefEpub/getAllArticlesDoiStatus', error);
			}else if(articlesList){
				for(var i=0 ; i<articlesList.length ; i++){
					if(articlesList[i]['crossref_epub_date']){
						// console.log(articlesList[i]['crossref_epub_date']);
						// see if Paperchase DB is missing Epub, if so add this date.
						var articleInfo = articles.findOne(articlesList[i]['paperchase']['_id']);
						if(articleInfo && articleInfo['dates'] && !articleInfo['dates']['epub']){
							console.log('MISSING DATE');
							var convertedDate = Meteor.dates.dashedToDate(articlesList[i]['crossref_epub_date']);
							// console.log('Update : ' + articlesList[i]['paperchase']['_id'] + ' / ' + convertedDate);
							articles.update({_id : articlesList[i]['paperchase']['_id']}, {$set: {'dates.epub' : convertedDate}},function(e,r){
								if(e){
									console.error('Update Article Error',e);
								}else if(r){
									console.log(r);
								}
							});
						}else if(articleInfo && articleInfo['dates']){
							var convertedDate = Meteor.dates.dashedToDate(articlesList[i]['crossref_epub_date']);
							console.log('Update : ' + articlesList[i]['paperchase']['_id'] + ' / ' + convertedDate);
							articles.update({_id : articlesList[i]['paperchase']['_id']}, {$set: {'dates.epub' : convertedDate}},function(e,r){
								if(e){
									console.error('Update Article Error',e);
								}else if(r){
									console.log(r);
								}
							});
						}
					}
				}
			}
		});
		return fut.wait();
	},
	getAllPmcPdf: function(){
		// use crawler to get PDF from PMC, save to S3
		console.log('..getAllPmcPdf');
		var fut = new future();
		var requestUrl = journalConfig.findOne().api.crawler + '/crawl_pdf/' + journalConfig.findOne().journal.short_name;

		var missingInPaperchase = [];
		Meteor.http.get(requestURL, function(error,result){
			if(error){
				console.error(error);
				throw new Meteor.Error(503, 'ERROR: PDF to S3' , error);
			}else if(result){
				// Loop through all articles in response and update the PDF collection in the DB
				articlesList = result.data;
				if(articlesList.length > 0){
					// All article processed on crawler. Now update the PDF collection. Return those without a paperchase_id to user.
					for(var i=0 ; i<articlesList.length ; i++){
						console.log(articlesList[i]['ids']);
						var paperchaseId = articlesList[i]['ids']['paperchase_id'];
						delete articlesList[i].ids._id; //remove the mongo ID from the article doc
						if(paperchaseId){
							updated =pdfCollection.update({paperchase_id: paperchaseId},{$set:articlesList[i]},{upsert: true});
						}else{
							missingInPaperchase.push(articlesList[i]);
						}
						if(i == parseInt(articlesList.length -1)){
							// TODO: fut not returning..
							// fut['return'][missingInPaperchase];
							fut['return'](articlesList.length);
							console.log('Could not update these. They are missing paperchase_id:',missingInPaperchase);
						}
					}
				}else{
					// No articles were updated
					console.error('No article XML was updated in crawl');
					fut['return'](0);
				}
			}
		});
		return fut.wait();
	}
});