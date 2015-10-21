volumes = new Mongo.Collection('volumes');
issues = new Mongo.Collection('issues');
articles = new Mongo.Collection('articles');
articleTypes = new Mongo.Collection('articleTypes'); //when saving an article query this db and add the name, short_name and id as an object to the article
institutions = new Mongo.Collection("institutions");
ipranges = new Mongo.Collection("ipranges");
edboard = new Mongo.Collection("edboard");
authors = new Mongo.Collection('authors');
recommendations = new Mongo.Collection('recommendations');
subs = new Mongo.Collection('subscriptions');
submissions = new Mongo.Collection('submissions');
journalConfig = new Mongo.Collection('config');


Meteor.users.allow({
  update: function (userId, doc, fields, modifier) {
    if (userId && doc._id === userId) {
      // user can modify own
      return true;
    }
    // admin can modify any
    var u = Meteor.users.findOne({_id:userId});
    if (Roles.userIsInRole(u, ['admin'])) {
      return true;
    }
  }
});
articles.allow({
  insert: function (userId, doc, fields, modifier) {
    var u = Meteor.users.findOne({_id:userId});
    if (Roles.userIsInRole(u, ['admin'])) {
      return true;
    }
  },
  update: function (userId, doc, fields, modifier) {
    var u = Meteor.users.findOne({_id:userId});
    if (Roles.userIsInRole(u, ['admin'])) {
      return true;
    }
  },
  remove: function (userId, doc, fields, modifier) {
    var u = Meteor.users.findOne({_id:userId});
    if (Roles.userIsInRole(u, ['admin'])) {
      return true;
    }
  }
});
recommendations.allow({
  insert: function (userId, doc, fields, modifier) {
    return true;
  },
  update: function (userId, doc, fields, modifier) {
    var u = Meteor.users.findOne({_id:userId});
    if (Roles.userIsInRole(u, ['admin'])) {
      return true;
    }
  },
  remove: function (userId, doc, fields, modifier) {
    var u = Meteor.users.findOne({_id:userId});
    if (Roles.userIsInRole(u, ['admin'])) {
      return true;
    }
  }
});

articles.before.update(function (userId, doc, fieldNames, modifier, options) {
  // console.log('..before update')
  //add affiliation number to author
  //might need to adjust this as article updates get added
  if(fieldNames.indexOf('authors') != -1){
    var authorsList = modifier['$set']['authors'];
    var affiliationsList = doc['affiliations'];
    // console.log('affiliationsList');console.log(affiliationsList);
    for(var i = 0 ; i < authorsList.length ; i++){

      if(authorsList[i]['affiliations_names'] && affiliationsList){
        //article update from a batch import of author affiliations
        //affiliations_names is only used to find index of affiliation after batch import
        authorsList[i]['affiliations_numbers'] = [];
        for(var a = 0 ; a < authorsList[i]['affiliations_names'].length ; a++){
          var affiliationIndex = affiliationsList.indexOf(authorsList[i]['affiliations_names'][a]);
          authorsList[i]['affiliations_numbers'].push(parseInt(affiliationIndex));
        }
      }else if(authorsList[i]['affiliations_numbers']){

      }
    }
  }
});


issues.allow({
  insert: function (userId, doc, fields, modifier) {
    var u = Meteor.users.findOne({_id:userId});
    if (Roles.userIsInRole(u, ['admin'])) {
      return true;
    }
  },
  update: function (userId, doc, fields, modifier) {
    var u = Meteor.users.findOne({_id:userId});
    if (Roles.userIsInRole(u, ['admin'])) {
      return true;
    }
  },
  remove: function (userId, doc, fields, modifier) {
    var u = Meteor.users.findOne({_id:userId});
    if (Roles.userIsInRole(u, ['admin'])) {
      return true;
    }
  }
});
volumes.allow({
  insert: function (userId, doc, fields, modifier) {
    var u = Meteor.users.findOne({_id:userId});
    if (Roles.userIsInRole(u, ['admin'])) {
      return true;
    }
  },
  update: function (userId, doc, fields, modifier) {
    var u = Meteor.users.findOne({_id:userId});
    if (Roles.userIsInRole(u, ['admin'])) {
      return true;
    }
  },
  remove: function (userId, doc, fields, modifier) {
    var u = Meteor.users.findOne({_id:userId});
    if (Roles.userIsInRole(u, ['admin'])) {
      return true;
    }
  }
});
authors.allow({
  insert: function (userId, doc, fields, modifier) {
    var u = Meteor.users.findOne({_id:userId});
    if (Roles.userIsInRole(u, ['admin'])) {
      return true;
    }
  },
  update: function (userId, doc, fields, modifier) {
    var u = Meteor.users.findOne({_id:userId});
    if (Roles.userIsInRole(u, ['admin'])) {
      return true;
    }
  },
  remove: function (userId, doc, fields, modifier) {
    var u = Meteor.users.findOne({_id:userId});
    if (Roles.userIsInRole(u, ['admin'])) {
      return true;
    }
  }
});
institutions.allow({
  insert: function (userId, doc, fields, modifier) {
    var u = Meteor.users.findOne({_id:userId});
    if (Roles.userIsInRole(u, ['admin'])) {
      return true;
    }
  },
  update: function (userId, doc, fields, modifier) {
    var u = Meteor.users.findOne({_id:userId});
    if (Roles.userIsInRole(u, ['admin'])) {
      return true;
    }
  },
  remove: function (userId, doc, fields, modifier) {
    var u = Meteor.users.findOne({_id:userId});
    if (Roles.userIsInRole(u, ['admin'])) {
      return true;
    }
  }
});
ipranges.allow({
  insert: function (userId, doc, fields, modifier) {
    var u = Meteor.users.findOne({_id:userId});
    if (Roles.userIsInRole(u, ['admin'])) {
      return true;
    }
  },
  update: function (userId, doc, fields, modifier) {
    var u = Meteor.users.findOne({_id:userId});
    if (Roles.userIsInRole(u, ['admin'])) {
      return true;
    }
  },
  remove: function (userId, doc, fields, modifier) {
    var u = Meteor.users.findOne({_id:userId});
    if (Roles.userIsInRole(u, ['admin'])) {
      return true;
    }
  }
});
submissions.allow({
  insert: function (userId, doc, fields, modifier) {
    var u = Meteor.users.findOne({_id:userId});
    if (Roles.userIsInRole(u, ['admin'])) {
      return true;
    }
  },
  update: function (userId, doc, fields, modifier) {
    var u = Meteor.users.findOne({_id:userId});
    if (Roles.userIsInRole(u, ['admin'])) {
      return true;
    }
  },
  remove: function (userId, doc, fields, modifier) {
    var u = Meteor.users.findOne({_id:userId});
    if (Roles.userIsInRole(u, ['admin'])) {
      return true;
    }
  }
});

if (Meteor.isServer) {
  Meteor.publish(null, function() {
    return Meteor.users.find({_id: this.userId}, {fields: {subscribed: 1}});
  });

  Meteor.publish('journalConfig', function() {
    var siteConfig =  journalConfig.find({},{fields: {journal : 1, 'submission.url' : 1, contact : 1}});
    return siteConfig;
  });

  Meteor.publish('volumes', function () {
    return volumes.find({},{sort : {volume:-1}});
  });

  Meteor.publish('issues', function () {
    return issues.find({},{sort : {volume:-1,issue:1}},{volume:1,issue:1,pub_date:1});
  });
  Meteor.publish('subs', function () {
    return subs.find({});
  });

  Meteor.publish('issue', function (v,i) {
    return issues.find({'volume': parseInt(v), 'issue': parseInt(i)});
  });
  Meteor.publish('currentIssue',function(){
    return issues.find({},{sort : {volume:-1,issue:-1}});
  });

  Meteor.publish('articles', function () {
    return articles.find({},{sort : {volume:-1,issue:-1}});
  });
  Meteor.publish('articleInfo', function(id) {
    return articles.find({'_id':id},{});
  });

  Meteor.publish('submission-set', function (queryType, queryParams) {
    var articlesList;
    if(queryType === 'issue'){
      articlesList = articles.find({'issue_id': queryParams});
    }else if(queryType === 'pii'){
      articlesList = articles.find({'_id':{'$in':queryParams}});
    }

    // if a user wants to change the submissions list and start over,
    // to clear the collection we just pass a queryType that is neither issue nor pii and undefined will be returned

    return articlesList;
  });
  /*TODO: RECENT define. By pub date?*/
  Meteor.publish('articlesRecentFive', function () {
    return articles.find({},{sort:{'_id':1},limit : 5});
  });
  Meteor.publish('feature', function () {
    return articles.find({'feature':true},{sort:{'_id':1}});
  });
  Meteor.publish('advance', function () {
    return articles.find({'advance':true},{sort:{'_id':1}});
  });
  Meteor.publish('submissions', function () {
    return submissions.find();
  });

  //users
  Meteor.publish('allUsers', function(){
     if (Roles.userIsInRole(this.userId, ['admin'])) {
      return Meteor.users.find();
     }else{
      this.stop();
      return;
     }
  });
  Meteor.publish('adminUsers', function(){
    if (Roles.userIsInRole(this.userId, ['admin'])) {
      return Meteor.users.find({'roles': {'$in': ['admin']}},{'name_first':1,'name_last':1});
    }else{
      this.stop();
      return;
    }
  });
  Meteor.publish('userData', function(id){
     if (Roles.userIsInRole(this.userId, ['admin'])) {
      return Meteor.users.find({'_id':id});
     }else{
      this.stop();
      return;
     }
  });
  Meteor.publish('currentUser', function(id){
    if(!this.userId) return null;
    return Meteor.users.find(this.userId, {fields: {
      name_first: 1,
      name_last: 1,
    }});
  });
  Meteor.publish('users',function(){
    return Meteor.users.find();
  });

  //institutions
  Meteor.publish('institutions', function(){
     if (Roles.userIsInRole(this.userId, ['admin'])) {
      return institutions.find();
     }else{
      this.stop();
      return;
     }
  });
  Meteor.publish('institution', function(id){
          if (Roles.userIsInRole(this.userId, ['admin'])) {
              return institutions.find({"_id":id});
          }else{
              this.stop();
              return;
          }
  });

  Meteor.publish('ipranges', function () {
          return ipranges.find({});
      });

  Meteor.publish('fullBoard', function () {
          return edboard.find({$or: [{role:"Impact Journals Director"}, {role:"Editorial Board"}]});
  });

  Meteor.publish('eic', function () {
          return edboard.find({role:"Editor-in-Chief"});
  });

  Meteor.publish('eb', function () {
          return edboard.find({role:"Founding Editorial Board"});
  });




  //AUTHORS
  Meteor.publish('authorsList', function(){
     if (Roles.userIsInRole(this.userId, ['admin'])) {
      return authors.find();
     }else{
      this.stop();
      return;
     }
  });
  Meteor.publish('authorData', function(mongoId){
     if (Roles.userIsInRole(this.userId, ['admin'])) {
      return  authors.find({'_id':mongoId})
     }else{
      this.stop();
      return;
     }
  });

  Meteor.publish('recommendations', function(){
    return recommendations.find({});
  });
  Meteor.publish('recommendationData',function(mongoId){
    if (Roles.userIsInRole(this.userId, ['admin'])) {
      return  recommendations.find({'_id':mongoId})
    }else{
      this.stop();
      return;
    }
  })
}
if (Meteor.isClient) {
	//TODO: remove global subscribe to collections
	// Meteor.subscribe('volumes');
	//  Meteor.subscribe('issues');
    Meteor.subscribe('ipranges');
    Meteor.subscribe('institutions');
    Meteor.subscribe('subs');
    Meteor.subscribe('journalConfig');
}
