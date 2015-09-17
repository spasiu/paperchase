institutionUpdateInsertHook = function(userId, doc, fieldNames, modifier, options) {
        var iprnew = [];
        var iprid = IPRanges.find({institutionID: doc._id});
        iprid.forEach(function(rec) {
                IPRanges.remove({_id: rec._id});
            });

        if(doc.IPRanges){
            doc.IPRanges.forEach(function(ipr) {
                    IPRanges.insert({
                            institutionID: doc._id
                            ,startIP: ipr.startIP
                            ,endIP: ipr.endIP
                            ,startNum: dot2num(ipr.startIP)
                            ,endNum: dot2num(ipr.endIP)
                        });
                });            
        }
    }

Institutions.after.insert(institutionUpdateInsertHook);
Institutions.after.update(institutionUpdateInsertHook);
Institutions.after.remove(function(userId, doc) {
        var iprid = IPRanges.find({institutionID: doc._id});
        iprid.forEach(function(rec) {
                IPRanges.remove({_id: rec._id});
            });
});

if (Meteor.isClient) {
    Template.registerHelper('clientIP', function() {
            return headers.getClientIP();
        });

    Template.registerHelper('isSubscribedIP', function() {
            ip = dot2num(headers.getClientIP());

            var match = IPRanges.findOne( { 
                    startNum: {$lte: ip} 
                    ,endNum: {$gte: ip}
                }
            );

            return match !== undefined;
        });

    Template.registerHelper('getInstitutionByIP', function() {
            ip = dot2num(headers.getClientIP());

            var match = IPRanges.findOne( { 
                    startNum: {$lte: ip} 
                    ,endNum: {$gte: ip}
                }
            );

            if(match) {
               inst_match = Institutions.findOne({
                       "_id": match.institutionID
                   });
            }

            return inst_match || false;
        });


    Template.AdminInstitution.helpers({
            'institutions': function() {
                return Institutions.find({});
            }
        });

    Template.AdminInstitutionEdit.helpers({
            'institution': function() {
                return Institutions.findOne({_id:this._id});
            }
        });

    Session.setDefault('formMethod','');
    Session.setDefault('fileNameXML',''); //LIVE
    // Session.setDefault('fileNameXML','PMC2815766.xml'); //LOCAL TESTING

    Router.route('/', { 
            name: "home",
            layoutTemplate: 'Visitor'
        });

    Router.route('/archive', { 
        name: 'archive',
        layoutTemplate: 'Visitor',
    });

    Router.route('/volume/:_volume/issue/:_issue', { 
            name: 'issue',
            layoutTemplate: 'Visitor',
            waitOn: function(){
                return[
                    Meteor.subscribe('issues'),
                    Meteor.subscribe('articles'),
                ]
            },
            data: function(){
                if(this.ready()){
                    var issue = this.params._issue;
                    var volume = parseInt(this.params._volume);
                    //get issue metadata
                    var issueData = issues.findOne({'issue': issue, 'volume': volume});

                    var issueArticles = Meteor.organize.getIssueArticlesByID(issueData['_id']);
                    //get articles in issue
                    //test for start of article type
                    
                    issueData['articles'] = issueArticles;
                    // console.log(issueData);
                    return {
                        issue: issueData
                    };
                }
            }
        });

    Router.route('/article/:_id', { 
            name: 'Article',
            layoutTemplate: 'Visitor',
            waitOn: function(){
                return[
                    Meteor.subscribe('articles')
                ]
            },
            data: function(){
                if(this.ready()){
                    var id = this.params._id;
                    var article = articles.findOne({'_id': id});
                    // console.log('article = ');console.log(article);
                    return {
                        article: article
                    };
                }
            }
        });
    Router.route('/article/:_id/text', { 
            name: 'ArticleText',
            layoutTemplate: 'Visitor',
            waitOn: function(){
                return[
                    Meteor.subscribe('articles')
                ]
            },
            data: function(){
                if(this.ready()){
                    var id = this.params._id;
                    var article = articles.findOne({'_id': id});
                    // console.log('article = ');console.log(article);
                    return {
                        article: article
                    };
                }
            }
        });


	/*
	ADMIN PAGES
	*/

    Router.route('/admin', {
            name: 'admin.dashboard'
            ,layoutTemplate: 'Admin'
        });

    /*xml intake*/
    Router.route('/admin/article-xml',{
        name: 'adminArticleXmlIntake',
        layoutTemplate: 'Admin'
    });
    Router.route('/admin/article-xml/process',{
        name: 'adminArticleXmlProcess',
        layoutTemplate: 'Admin',
        onBeforeAction: function(){
           var fileNameXML = Session.get('fileNameXML');
           if(fileNameXML === ''){
                Router.go('adminArticleXmlIntake');
           }else{
                this.next();
           }
        },
        waitOn: function(){
            return[
                Meteor.subscribe('articles'),
                Meteor.subscribe('issues')
            ]
        },
        data: function(){
            var fileName = Session.get('fileNameXML');
            var newArticle;
            newArticle =  ReactiveMethod.call('processXML',fileName);
            if(newArticle){
                //add issue_id if exists, 
                //later when INSERT into articles, check for if issue_id in doc (in meteor method addArticle)
                var articleIssue = issues.findOne({'volume' : newArticle['volume'], 'issue': newArticle['issue']});
                if(articleIssue){
                    newArticle['issue_id'] = articleIssue['_id'];
                }

                //TODO: better way of checking if article exists, title could change during production.
                var articleExists = articles.findOne({'title' : newArticle['title']});
                return {
                    article: newArticle,
                    articleExists: articleExists
                }            
            }
        }
    });

    /*article and articles*/
    Router.route('/admin/articles',{
        name: 'adminArticlesList',
        layoutTemplate: 'Admin',
        waitOn: function(){
            return[
                Meteor.subscribe('articles')
            ]
        },        
        data: function(){
            return {
                articles : articles.find().fetch()
            }
        }
    });    
    Router.route('/admin/article/:_id',{
        name: 'adminArticle',
        layoutTemplate: 'Admin',
        waitOn: function(){
            return[
                Meteor.subscribe('articles')
            ]
        },        
        data: function(){
            if(this.ready()){
                var id = this.params._id;
                var article = articles.findOne({'_id': id});
                // console.log('article = ');console.log(article);
                return {
                    article: article
                };
            }
        }
    })

    /*archive browsing*/
    Router.route('/admin/archive', {
            name: 'admin.archive'
            ,layoutTemplate: 'Admin'
        });


    /*issue control*/
    //TODO: LIMIT subscription of articles to just issue
    Router.route('/admin/issue/:vi', {
        name: 'admin.issue',
        layoutTemplate: 'Admin',
        waitOn: function(){
            return[
                Meteor.subscribe('articles')
            ]
        },
        data: function(){
            if(this.ready()){
                vi = this.params.vi;
                matches = vi.match("v([0-9]+)i([0-9]+)");
                volume = matches[1];
                issue = matches[2];
                var issueData = issues.findOne({'volume' : parseInt(volume), 'issue':issue});
                var issueArticles = Meteor.organize.getIssueArticlesByID(issueData['_id']);
                issueData['articles'] = issueArticles;
                var data = {
                    issue: issueData
                };
                return data;
            }
        }
    });



    /*users*/
    Router.route('/admin/users', {
    	name: 'AdminUsers',
    	layoutTemplate: 'Admin',
		waitOn: function(){
			return[
				Meteor.subscribe('allUsers')
			]
		},
		data: function(){
			if(this.ready()){
				var users = Meteor.users.find().fetch();
				return {
					users: users
				};
			}
		}
	});
    Router.route('/admin/user/:_id', {
    	name: 'AdminUser',
    	layoutTemplate: 'Admin',
		waitOn: function(){
			return[
				Meteor.subscribe('userData',this.params._id)
			]
		},
		data: function(){
			if(this.ready()){
                var id = this.params._id;
				var u = Meteor.users.findOne({'_id':id});
				//user permissions
				u['adminRole'] = '';
				u['superRole'] = '';
				u['articlesRole'] = '';
				var r = u.roles;
				var rL = r.length;
				for(var i = 0 ; i < rL ; i++){
					u[r[i]+'Role'] = 'checked';
				}
				return {
					u: u
				};
			}
		}
	});
    Router.route('/admin/adduser', {
    	name: 'AdminAddUser',
    	layoutTemplate: 'Admin'
	});
	//AddUser

    Router.route('/admin/institution', {
            name: 'admin.institution'
            ,layoutTemplate: 'Admin'
        });

    Router.route('/admin/institution/add', {
        layoutTemplate: 'Admin',
        name: 'AdminInstitutionAdd',
        waitOn: function(){
        },
        data: function(){
            Session.set('formType','insert');
        }
    });    

    Router.route('/admin/institution/edit/:_id', {
        layoutTemplate: 'Admin',
        name: 'AdminInstitutionEdit',
        waitOn: function(){
            return[
                Meteor.subscribe('institutions',this.params._id)
            ]
        },
        data: function(){
            if(this.ready()){
                var id = this.params._id;
                var institution = Institutions.findOne({'_id':id});
                // console.log(institution);
                Session.set('formType','update');
                return institution;
            }
        }
    });   

}

if (Meteor.isServer) {
    Meteor.startup(function () {
        });
}

var toType = function(obj) {
  return ({}).toString.call(obj).match(/\s([a-zA-Z]+)/)[1].toLowerCase()
}

function dot2num(dot) {
    var d = dot.split('.');
    return ((((((+d[0])*256)+(+d[1]))*256)+(+d[2]))*256)+(+d[3]);}

function num2dot(num) {
    var d = num%256;
    for (var i = 3; i > 0; i--) { 
        num = Math.floor(num/256);
        d = num%256 + '.' + d;}
    return d;}
