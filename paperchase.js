// Config
if (Meteor.isServer) {
	WebApp.connectHandlers.use(function(req, res, next) {
        res.setHeader("Access-Control-Allow-Origin", "*");
        return next();
    });
}

// async loader for fonts
// https://github.com/typekit/webfontloader
if (Meteor.isClient) {
	WebFontConfig = {
		google: { families: [ 'Lora:400,400italic,700,700italic:latin' , 'Open Sans'] }
	};
	(function() {
			var wf = document.createElement('script');
			wf.src = ('https:' == document.location.protocol ? 'https' : 'http') +
				'://ajax.googleapis.com/ajax/libs/webfont/1/webfont.js';
			wf.type = 'text/javascript';
			wf.async = 'true';
			var s = document.getElementsByTagName('script')[0];
			s.parentNode.insertBefore(wf, s);
			//console.log("async fonts loaded", WebFontConfig);
	})();
	// var journal = journalConfig.findOne();
	// Session.setDefault('journal',journal);
	Meteor.subscribe('journalConfig', function(){
		Session.set('journal', journalConfig.findOne());
	});
}
Router.configure({
	loadingTemplate: 'Loading'
});
Router.onBeforeAction(function() {
	// Site Settings
	// ------------------------
	Meteor.subscribe('sectionsVisible');
	Meteor.subscribe('sortedList','sections');
	this.next();
});
Meteor.startup(function () {
	// Email
	// ------------------------
	if (Meteor.isServer) {
		var emailSettings = Meteor.call('getConfigRecommendationEmail');
		if(emailSettings){
			process.env.MAIL_URL = 'smtp://' + emailSettings['address'] +':' + emailSettings['pw'] + '@smtp.gmail.com:465/';
		}
	}
	// Site Settings
	// ------------------------
	if (Meteor.isClient) {
		var journal = journalConfig.findOne();
		// journal color, side navigation
		Session.setDefault('journal',journal);
	}
});


institutionUpdateInsertHook = function(userId, doc, fieldNames, modifier, options) {
	var iprnew = [];
	var iprid = ipranges.find({institutionID: doc._id});
	iprid.forEach(function(rec) {
			ipranges.remove({_id: rec._id});
	});

	if(doc.IPRanges){
		doc.IPRanges.forEach(function(ipr) {
				ipranges.insert({
						institutionID: doc._id
						,startIP: ipr.startIP
						,endIP: ipr.endIP
						,startNum: dot2num(ipr.startIP)
						,endNum: dot2num(ipr.endIP)
					});
			});
	}
}

institutions.after.insert(institutionUpdateInsertHook);
institutions.after.update(institutionUpdateInsertHook);
institutions.after.remove(function(userId, doc) {
	var iprid = ipranges.find({institutionID: doc._id});
	iprid.forEach(function(rec) {
		ipranges.remove({_id: rec._id});
	});
});


// DOWNLOAD ROUTES
// Router.route('/pdf/:_filename',{
// 	where: 'server',
// 	action: function(){
// 		var name = this.params._filename;
// 		var filePath = process.env.PWD + '/uploads/pdf/' + name;
// 		var fs = Meteor.npmRequire('fs');
// 		var data = fs.readFileSync(filePath);
// 		this.response.writeHead(200, {
// 		  'Content-Type': 'application/pdf',
// 		  'Content-Disposition': 'attachment; filename=' + name
// 		});
// 		this.response.write(data);
// 		this.response.end();
// 	}
// });
Router.route('/xml-cite-set/:_filename',{
	where: 'server',
	action: function(){
		var name = this.params._filename;
		var filePath = process.env.PWD + '/xml-sets/' + name;
		// console.log(filePath);
		var fs = Meteor.npmRequire('fs');
		var data = fs.readFileSync(filePath);
		var headers = {'Content-type': 'application/xml','Content-Disposition': 'attachment'};
		this.response.writeHead(200, headers);
		this.response.write(data);
		this.response.end();
	}
});

// INTAKE ROUTES
Router.route('/admin/add-legacy-platform-article/',{
	where: 'server',
	action: function(){
        var response = this.response;
        Meteor.call('legacyArticleIntake', this.params.query, function(err, res) {
                if(err) {
                    response.setHeader('Content-Type', 'application/json');
                    response.end(JSON.stringify({'success':false}));
                }
                else {
                    response.setHeader('Content-Type', 'application/json');
                    response.end(JSON.stringify({'success':true}));
                }
            });
	}
});

// OUTTAKE ROUTES
Router.route('/get-advance-articles/',{
	where: 'server',
	waitOn: function(){
		return[
			Meteor.subscribe('publish'),
		]
	},
	action: function(){
		// var htmlString = '<head><meta charset="UTF-8"></head><body>';
		var htmlString = "<body>";
		var advance = publish.findOne({name: 'advance'}, {sort:{'pubtime':-1}});
		if(advance){
			var advanceList = advance.data;
			var prevSection;
            var last_index;

            if(this.params.query.rangeStart !== undefined) {
                var rangeSize = this.params.query.rangeSize*1 || 3;
                var rangeStart = this.params.query.rangeStart*rangeSize
                var rangeEnd = rangeStart + rangeSize;
                if(rangeEnd > advanceList.length) rangeEnd = advanceList.length;
            }
            else {
                var rangeStart = 0;
                var rangeEnd = advanceList.length;
            }

            var parity=0;
			for(var i = rangeStart ; i < rangeEnd; i++){
                parity++;
				var articleInfo = advanceList[i];
                last_index = i-1
                if(i > 0) {
                    prevSection = advanceList[last_index]['section_name'];
                }
				if(articleInfo['section_start']){
//					if(prevSection){
//						htmlString += '</div>';
//					}

//					htmlString += '<h4 class="tocSectionTitle" style="width:100%;clear:both;float:left;font-family:Arial, sans-serif;margin-top: 1em;padding-left: 1.5em;color: #FFF;background-color: #999;margin-bottom: 1em;border-left-width: thick;border-left-style: solid;border-left-color: #666;border-bottom-width: thin;border-bottom-style: solid;border-bottom-color: #666;text-transform: none !important; ">' + articleInfo['section_name'] + '</h4>';
//					htmlString += '<div class="articlewrapper">';
				}


                if(articleInfo['section_name'] != prevSection) {
                    if(i != 0) {
                        htmlString += '</div>';
                    }

                    if(i<40 && articleInfo['section_name'] == 'Research Papers') {
                        htmlString += "<h4 id=\"recent_"+articleInfo['section_name']+"\" class=\"tocSectionTitle\">Recent "+articleInfo['section_name']+"</h4>";
                    }
                    else {
                        htmlString += "<h4 id=\""+articleInfo['section_name']+"\" class=\"tocSectionTitle\">"+articleInfo['section_name']+"</h4>";
                    }

                    htmlString += "<div style=\"margin-bottom:30px;\" class=\"clearfix\">";
                    parity = 1;
                }
                else if(parity%2==1) {
                    htmlString += "<div style=\"margin-bottom:30px;\" class=\"clearfix\">";

                }

                htmlString += "<div style=\"width:360px; margin-right:15px; float:left;\" class=\"clearfix\">";
			    htmlString += '<span class="tocTitle">' + articleInfo['title'] + '</span>';

				if(articleInfo.authors){
//					htmlString += '<tr>';
//					htmlString += '<td class="tocAuthors">';

					htmlString += '<span class="tocAuthors">';

					if(articleInfo['ids']['pii']){
						htmlString += '<p><b>DOI: 10.18632/oncotarget.' + articleInfo['ids']['pii'] + '</b></p>';
					}
					var authors = articleInfo.authors;
					var authorsCount = authors.length;
					htmlString += '<p>';
					for(var a = 0 ; a < authorsCount ; a++){
						if(authors[a]['name_first']){
							htmlString += ' ' + authors[a]['name_first'];
						}
						if(authors[a]['name_middle']){
							htmlString += ' ' + authors[a]['name_middle'];
						}
						if(authors[a]['name_last']){
							htmlString += ' ' + authors[a]['name_last'];
						}
						if(a != parseInt(authorsCount - 1)){
							if(authors[a]['name_first'] || authors[a]['name_middle'] || authors[a]['name_last']){
								htmlString += ', ';
							}
						}
					}
					htmlString += '</p>';
					htmlString += '</span>';
				}

				// LINKS
				htmlString += '<span class="tocGalleys">';
				// Abstract
				if(articleInfo.legacy_files){
//					if(articleInfo.legacy_files.abstract && articleInfo.legacy_files.abstract != ''){
						htmlString += '<a href="http://www.impactjournals.com/oncotarget/index.php?journal=oncotarget&amp;page=article&amp;op=view&amp;path[]='+ articleInfo.ids.pii +'" class="file">Abstract</a>';
						htmlString += '&nbsp;';
//					}
					// HTML
					if(articleInfo.legacy_files.html_galley_id){
						htmlString += '<a href="http://www.impactjournals.com/oncotarget/index.php?journal=oncotarget&amp;page=article&amp;op=view&amp;path[]=' + articleInfo.ids.pii + '&amp;path%5B%5D=' + articleInfo.legacy_files.html_galley_id + '" class="file">HTML</a>';
						htmlString += '&nbsp;';
					}
					// PDF
					if(articleInfo.legacy_files.pdf_galley_id){
						htmlString += '<a href="http://www.impactjournals.com/oncotarget/index.php?journal=oncotarget&amp;page=article&amp;op=view&amp;path[]=' + articleInfo.ids.pii + '&amp;path%5B%5D=' + articleInfo.legacy_files.pdf_galley_id + '" class="file">PDF</a>';
						htmlString += '&nbsp;';
					}
					// Supplemental
					if(articleInfo.legacy_files.has_supps){
						htmlString += '<a href="javascript:openRTWindow(\'http://www.impactjournals.com/oncotarget/index.php?journal=oncotarget&amp;page=rt&amp;op=suppFiles&amp;path[]=' + articleInfo.ids.pii + '&amp;path%5B%5D=\');" class="file">Supplementary Information</a>';
						htmlString += '&nbsp;';
					}
				}

				htmlString += '</span>';

				htmlString += '</div>';

                if(parity%2==0) {
                    htmlString += '</div>';
                }
			}

			htmlString += '</body>';
			var headers = {'Content-type': 'text/html', 'charset' : 'UTF-8'};
			this.response.writeHead(200, headers);
			this.response.end(htmlString);
		}
	}
});

if (Meteor.isClient) {
	Session.setDefault('formMethod','');
	Session.setDefault('fileNameXML',''); //LIVE
	// Session.setDefault('fileNameXML','PMC2815766.xml'); //LOCAL TESTING
	Session.setDefault('error',false);
	Session.setDefault('errorMessages',null);
	Session.setDefault('articleData',null);
	Session.setDefault('article',null);
	Session.setDefault('article-id',null);
	Session.setDefault('article-assets',null);
	Session.setDefault('article-text',null);
	Session.setDefault('affIndex',null);
	Session.setDefault('missingPii',null);
	Session.setDefault('preprocess-article',false);
	Session.setDefault('issue',null);
	// for side navigation
	Session.setDefault('section-nav',null);
	// for section papers list
	Session.setDefault('article-list',null);

	Router.route('/', {
		name: 'Home',
		layoutTemplate: 'Visitor',
		title: function() {
			var pageTitle = '';
			if(Session.get('journal')){
				pageTitle = Session.get('journal').journal.name;
			}
			return pageTitle;
		},
		waitOn: function(){
			return[
				Meteor.subscribe('feature'),
				Meteor.subscribe('eic'),
				Meteor.subscribe('eb'),
				Meteor.subscribe('newsListDisplay')
			]
		},
		data: function(){
			var featureList = articles.find({'feature':true},{sort:{'_id':1}}).fetch();
			return {
				feature : featureList,
				eic: edboard.find({role: 'Editor-in-Chief'}) ,
				eb: edboard.find({role: 'Founding Editorial Board'}),
				news:  newsList.find({},{sort : {date: -1}}).fetch()
			}
		}
	});

	Router.route('/advance', {
		name: 'Advance',
		layoutTemplate: 'Visitor',
		title: function() {
			var pageTitle = '';
			if(Session.get('journal')){
				pageTitle = Session.get('journal').journal.name + ' | ';
			}
			return pageTitle + 'Advance Articles';
		},
		waitOn: function(){
			return[
				Meteor.subscribe('advance'),
				Meteor.subscribe('sortedList','advance')
			]
		},
		data: function(){
			if(this.ready()){
				var sorted  = sorters.findOne();
				return {
					advance : sorted['articles']
				}
			}
		}
	});

	Router.route('/account', {
		name: 'Account',
		layoutTemplate: 'Visitor',
		title: function() {
			var pageTitle = '';
			if(Session.get('journal')){
				pageTitle = Session.get('journal').journal.name + ' | ';
			}
			return pageTitle + 'Account';
		},
	});

	Router.route('/archive', {
		name: 'Archive',
		layoutTemplate: 'Visitor',
		title: function() {
			var pageTitle = '';
			if(Session.get('journal')){
				pageTitle = Session.get('journal').journal.name + ' | ';
			}
			return pageTitle + 'Archive';
		},
		waitOn: function(){
			return[
				Meteor.subscribe('volumes'),
				Meteor.subscribe('issues')
			]
		}
	});

	Router.route('/editorial-board', {
		name: 'EdBoard',
		layoutTemplate: 'Visitor',
		title: function() {
			var pageTitle = '';
			if(Session.get('journal')){
				pageTitle = Session.get('journal').journal.name + ' | ';
			}
			return pageTitle + 'Editorial Board';
		},
		waitOn: function(){
			return[
				Meteor.subscribe('eic'),
				Meteor.subscribe('fullBoard')
			]
		},
		data: function(){
			return {
				eic: edboard.find({role:"Editor-in-Chief"},{sort : {name_last:1}}),
				fullBoard: edboard.find({$or: [{role:"Founding Editorial Board"}, {role:"Editorial Board"}]},{sort : {name_last:1}})
			}
		}
	});

	Router.route('/for-authors', {
		name: 'ForAuthors',
		layoutTemplate: 'Visitor',
		waitOn: function(){
			return[
				Meteor.subscribe('forAuthorsPublic'),
				Meteor.subscribe('sortedList','forAuthors')
			]
		},
		data: function(){
			if(this.ready()){
				var sections = forAuthors.find().fetch();
				var sorted  = sorters.findOne();
				return {
					sections : sorted['ordered']
				};
			}
		},
	});

	Router.route('/about', {
		name: 'About',
		layoutTemplate: 'Visitor',
		waitOn: function(){
			return[
				Meteor.subscribe('aboutPublic'),
				Meteor.subscribe('sortedList','about')
			]
		},
		data: function(){
			if(this.ready()){
				var sections = about.find().fetch();
				var sorted  = sorters.findOne();
				return {
					sections : sorted['ordered']
				};
			}
		},
	});

	Router.route('/contact', {
		name: 'Contact',
		layoutTemplate: 'Visitor',
		title: function() {
			var pageTitle = '';
			if(Session.get('journal')){
				pageTitle = Session.get('journal').journal.name + ' | ';
			}
			return pageTitle + 'Contact';
		},
		waitOn: function(){
			return[
				Meteor.subscribe('contact')
			]
		},
		data: function(){
			if(this.ready()){
				var contactInfo = contact.findOne();
				return {
					contact: contactInfo
				};
			}
		}
	});

	Router.route('/recent-breakthroughs', {
		name: 'RecentBreakthroughs',
		layoutTemplate: 'Visitor',
		title: function() {
			var pageTitle = '';
			if(Session.get('journal')){
				pageTitle = Session.get('journal').journal.name + ' | ';
			}
			return pageTitle + 'Recent Breakthroughs';
		}
	});

	Router.route('/issue/:vi', {
		name: 'Issue',
		layoutTemplate: 'Visitor',
		title: function() {
			var pageTitle = '',
				vi = this.params.vi;
			var matches = vi.match('v([0-9]+)i([0-9]+)');
			var volume = parseInt(matches[1]);
			var issue = parseInt(matches[2]);
			if(Session.get('journal')){
				pageTitle = Session.get('journal').journal.name + ' | ';
			}
			return pageTitle + 'Volume ' + volume + ', Issue ' + issue;
		},
		onBeforeAction: function(){
			// console.log('..before');
			Session.set('issue',null);
			var vi = this.params.vi;
			var matches = vi.match('v([0-9]+)i([0-9]+)');
			var volume = parseInt(matches[1]);
			var issue = parseInt(matches[2]);

			// TODO: add redirect if no issue

			// for issue header while articles are processing and we retrieve assets links from API
			var issueData = issues.findOne();
			// console.log(issueData);
			Session.set('issue',issueData);

			Meteor.call('getIssueAndAssets',volume,issue,function(error,result){
				if(error){
					console.log('ERROR - getIssueAndAssets');
					console.log(error);
				}
				if(result){
					Session.set('issue',result);
				}
			});

			this.next();
		},
		waitOn: function(){
			var vi = this.params.vi;
			var matches = vi.match('v([0-9]+)i([0-9]+)');
			var volume = parseInt(matches[1]);
			var issue = parseInt(matches[2]);
			return[
				Meteor.subscribe('issue',volume,issue),
				Meteor.subscribe('issueArticles',volume,issue)
			]
		}
	});

	// Article
	// -------
	Router.route('/article/:_id', {
		name: 'Article',
		layoutTemplate: 'Visitor',
		title: function() {
			var pageTitle = '';
			if(Session.get('journal')){
				pageTitle = Session.get('journal').journal.name + ' | ';
			}
			var articleTitle = Meteor.article.pageTitle(this.params._id);
			return pageTitle + articleTitle;
		},
		onBeforeAction: function(){
			// check if article exists
			var articleExistsExists = articles.findOne({'_id': this.params._id});
			if(!articleExistsExists){
				Router.go('ArticleNotFound');
			}

			// get xml, figures, pdf links
			Meteor.call('availableAssests', this.params._id, function(error, result) {
				if(result){
					Session.set('article-assets',result);
				}
			});
			this.next();
		},
		waitOn: function(){
			return[
				Meteor.subscribe('articleInfo',this.params._id),
				Meteor.subscribe('articleTypes')
			]
		},
		data: function(){
			if(this.ready()){
				var id = this.params._id;
				Session.set('article-id',this.params._id);
				var article;
				article = articles.findOne({'_id': id});
				return {
					article: article
				};
			}
		}
	});
	Router.route('/article/:_id/text', {
		name: 'ArticleText',
		layoutTemplate: 'Visitor',
		onBeforeAction: function(){
			// check if article exists
			var articleExistsExists = articles.findOne({'_id': this.params._id});
			if(!articleExistsExists){
				Router.go('ArticleNotFound');
			}

			// Get assets and fulltext
			Session.set('article-text', null);
			Meteor.call('availableAssests', this.params._id, function(error, result) {
				if(result){
					Session.set('article-assets',result);
				}
			});
			Meteor.call('getAssetsForFullText', this.params._id, function(error, result) {
				if(result){
					if(articleExistsExists.abstract){
						result.abstract = articleExistsExists.abstract;
					}
					Session.set('article-text',result);
				}
			});
			this.next();
		},
		waitOn: function(){
			return[
				Meteor.subscribe('articleInfo',this.params._id),
				Meteor.subscribe('articleTypes')
			]
		},
		data: function(){
			if(this.ready()){
				var id = this.params._id;
				Session.set('article-id',this.params._id);
				var article;
				article = articles.findOne({'_id': id});
				return {
					article: article
				};
			}
		},
		title: function() {
			var pageTitle = '';
			console.log(Session.get('journal'));
			if(Session.get('journal')){
				pageTitle = Session.get('journal').journal.name + ' | ';
			}
			var articleTitle = Meteor.article.pageTitle(this.params._id) + ' - Full Text' ;
			return pageTitle + articleTitle;
		},
	});
	Router.route('/article/:_id/purchase', {
		name: 'PurchaseArticle',
		layoutTemplate: 'Visitor',
		title: function() {
			var pageTitle = '';
			if(Session.get('journal')){
				pageTitle = Session.get('journal').journal.name + ' | ';
			}
			var articleTitle = Meteor.article.pageTitle(this.params._id) + ' - Purchase' ;
			return pageTitle + articleTitle;
		},
		waitOn: function(){
			return[
				Meteor.subscribe('articleInfo',this.params._id)
			]
		},
		data: function(){
			if(this.ready()){
				var id = this.params._id;
				Session.set('article-id',this.params._id);
				var article = articles.findOne({'_id': id});
				return {
					article: article,
				};
			}
		}
	});
	Router.route('/figure(.*)', {
		name: 'ArticleFigureViewer',
		layoutTemplate: 'ArticleFigureViewer',title: function() {
			var pageTitle = '';
			if(Session.get('journal')){
				pageTitle = Session.get('journal').journal.name + ' | ';
			}
			// TODO: add article title
			return pageTitle + 'Figure Viewer';
		},
		waitOn: function(){
			return[
				Meteor.subscribe('articleInfo',this.params.query.article),
				Meteor.subscribe('articleTypes')
			]
		},
		data: function(){
			if(this.ready()){
				var id = this.params.query.article;
				// var assets = Meteor.call('availableAssests',id);
				Session.set('article-id',id);
				var article;
				article = articles.findOne({'_id': id});
				return {
					article: article,
					img: this.params.query.img,
                    title:this.params.query.figureId
				};
			}
		}
	});
	Router.route('/404/article', {
		name: 'ArticleNotFound',
		layoutTemplate: 'Visitor',
		title: function() {
			var pageTitle = '';
			if(Session.get('journal')){
				pageTitle = Session.get('journal').journal.name + ' | ';
			}
			return pageTitle + '404: Article Not Found';
		},
	});

	Router.route('/recommend', {
		name: 'Recommend',
		layoutTemplate: 'Visitor',
		title: function() {
			var pageTitle = '';
			if(Session.get('journal')){
				pageTitle = Session.get('journal').journal.name + ' | ';
			}
			return pageTitle + 'Recommend';
		},
		waitOn: function(){
			Meteor.subscribe('currentUser');
		},
		data: function(){
			if(Meteor.user()){
				var u =  Meteor.users.findOne();
				return {
					user: u
				}
			}
		}
	});

	Router.route('/section/:_section_dash_name', {
		name: 'SectionPapers',
		layoutTemplate: 'Visitor',
		onBeforeAction: function(){
			Meteor.call('preprocessSectionArticles',articles.find().fetch(), function(error,result){
				if(error){
					console.log('ERROR - preprocessSectionArticles');
					console.log(error);
				}
				if(result){
					Session.set('article-list',result);
				}
			});
			this.next();
		},
		title: function() {
			var pageTitle = '',
				sectionName = '';
			// console.log(this.params._section_short_name);
			// console.log(sections.find().fetch());
			var section = sections.findOne({dash_name : this.params._section_dash_name});
			// console.log(sectionName);
			if(section){
				sectionName = section.name;
			}
			if(Session.get('journal')){
				pageTitle = Session.get('journal').journal.name + ' | ';
			}
			return pageTitle + sectionName;
		},
		waitOn: function(){
			return [
				Meteor.subscribe('sectionPapersByDashName', this.params._section_dash_name)
			]
		},
		data: function(){
			if(this.ready()){
				// more data set in helpersData.js, articles
				return {
					section : sections.findOne({dash_name : this.params._section_dash_name})
				}
			}
		}
	});

	Router.route('/subscribe', {
		name: 'Subscribe',
		layoutTemplate: 'Visitor',
		title: function() {
			var pageTitle = '';
			if(Session.get('journal')){
				pageTitle = Session.get('journal').journal.name + ' | ';
			}
			return pageTitle + 'Subscribe';
		},
		waitOn: function(){
			return[
			Meteor.subscribe('currentIssue')
			]
		},
		data: function(){
			if(this.ready()){
				return{
					issue: issues.findOne(),
					today: new Date(),
					nextYear: new Date(new Date().setYear(new Date().getFullYear() + 1))
				}
			}
		}
	});
}
