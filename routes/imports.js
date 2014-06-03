/**
 * InfraNodus is a lightweight interface to graph databases.
 *
 * This open source, free software is available under MIT license.
 * It is provided as is, with no guarantees and no liabilities.
 * You are very welcome to reuse this code if you keep this notice.
 *
 * Written by Dmitry Paranyushkin | Nodus Labs and hopefully you also...
 * www.noduslabs.com | info AT noduslabs DOT com
 *
 * In some parts the code from the book "Node.js in Action" is used,
 * (c) 2014 Manning Publications Co.
 *
 */

var User = require('../lib/user');

var Twit = require('twit');
var FlowdockText = require("flowdock-text");

var validate = require('../lib/middleware/validate');
var entries = require('../routes/entries');



var T = new Twit({
    consumer_key:         'thuprgnrfxsKUV78Q6LdPqZWJ'
    , consumer_secret:      '2kaOHBI71anPOOthkNr5OHIfqt0gbARcKXgCsss2LJndVrmmQg'
    , access_token:         '77502415-1AHLCPML1tFYm2q27sEYt5YWYp9M5QhGhWvy12qPC'
    , access_token_secret:  'rn9Vve1c5oDtyGqbPhKM1AFN0KNDWoO9L296bIBpDiMGJ'
});

// GET request to the /settings page (view settings)

exports.render = function(req, res) {

    res.render('import', { title: 'Import Data to InfraNodus' });

};


// POST request to the settings page (change settings)

exports.submit = function(req, res, next) {

    var user_id = res.locals.user.uid;

    // What will we analyze?
    var service = req.body.source;

    // What will we be extracting
    var extract = req.body.extract;

    var searchString = '';

    // What is the search string
    if (!req.body.search || req.body.search == '')  {
        res.error('Please, enter the @username or a #hashtag');
        res.redirect('back');
    }
    else {
        if (req.body.search.charAt(0) != '@' && req.body.search.charAt(0) != '#') {
            res.error('Please, enter the @username or a #hashtag');
            res.redirect('back');
        }
        searchString = req.body.search;
    }

    // How many recent posts
    var limit = 50;
    if (req.body.limit && req.body.limit < 101) {
            limit = req.body.limit;
    }

    // List to be used for import
    var importContext = 'imported';
    if (req.body.context && req.body.context.length > 3 && req.body.context.length < 13) {
        importContext = req.body.context;
    }
    else {
        req.body.context = importContext;
    }

    // We extract only hashtags or hashtags and morphemes
    // TODO reset res.locals after that parameter change

    if (req.body.settings == 'hashtags') {
        res.locals.user.hashnodes = '2';
    }
    else if (req.body.settings == 'morphemes') {
        res.locals.user.hashnodes = '1';
    }

    var twitterRequest = [];

    if (service == 'twitter' && extract == 'user') {
         twitterRequest = {
              type: 'statuses/user_timeline',
              params: {
                    screen_name: searchString.substr(1),
                    count: limit
              }
        }
    }
    else if (service == 'twitter' && extract == 'hashtag') {
         twitterRequest = {
            type: 'search/tweets',
            params: {
                q: searchString,
                count: limit
            }
        }
    }
    else if (service == 'twitter' && extract == 'timeline') {
        twitterRequest = {
            type: 'statuses/home_timeline',
            params: {
                count: limit
            }
        }
    }

    console.log('postparams');
    console.log(searchString);
    console.log(importContext);
    console.log(service);
    console.log(extract);


    if (searchString) {
    T.get(twitterRequest.type, twitterRequest.params, function(err, data, response) {

        var statements = [];

        var default_context = importContext;

        var result = data;

        // For hashtag surrounding search remove the actual hashtag from all tweets
        if (twitterRequest.type == 'search/tweets') {
            result = data['statuses'];

        }

        for (key in result) {
            var statement = result[key].text;
            var mentions = FlowdockText.extractMentions(statement);
            for (index in mentions) {
                statement = statement.replace(mentions[index], 'user_' + mentions[index].substr(1) + ' (http://twitter.com/' + mentions[index].substr(1) + ')');
            }
            if (twitterRequest.type == 'search/tweets') {
                statement = statement.toLowerCase().replace(twitterRequest.params.q.toLowerCase(),'_#'+twitterRequest.params.q.substr(1).toLowerCase());
            }
            statements.push(statement);
        }


        validate.getContextID(user_id, default_context, statements, function(result) {
            console.log('so the statements we got are');
            console.log(statements);
            console.log('and default context');
            console.log(default_context);
            // What are the contexts that already exist for this user and their IDs?
            // Note: actually there's been no contexts, so we just created IDs for all the contexts contained in the statement
            var contexts = result;

            console.log('extracted contexts');
            console.log(contexts);

            // Create default statement object that has an empty body, default context, and all the context IDs for the user
            // context: default_context is where all the statements are added anyway
            // contextids: contexts are the IDs of all the contexts that will be used in those statements

            var req = {
                body:  {
                    entry: {
                        body: ''
                    },
                    context: default_context
                },

                contextids: contexts,
                internal: 1
            };

            console.log('requestobject');
            console.log(req);


            for (var key in statements) {
                if (statements.hasOwnProperty(key)) {
                    req.body.entry.body = statements[key];
                    entries.submit(req, res);
                }

            }

            // Move on to the next one

            res.redirect('/contexts/' + default_context);


        });



    });
    }





};