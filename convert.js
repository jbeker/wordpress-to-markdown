var xml2js = require('xml2js');
var fs = require('fs');
var util = require('util');
var toMarkdown = require('to-markdown');
var http = require('http');
var request = require('request');

fs.mkdir('_posts', function () {
    fs.mkdir('images', function () {

        processExport();
    });
});

function processExport() {
    var parser = new xml2js.Parser();
    fs.readFile('export.xml', function (err, data) {
        if (err) {
            console.log('Error: ' + err);
        }

        parser.parseString(data, function (err, result) {
            if (err) {
                console.log('Error parsing xml: ' + err);
            }
            console.log('Parsed XML');
            //console.log(util.inspect(result.rss.channel));

            var posts = result.rss.channel[0].item;


            fs.mkdir('out', function () {
                for (var i = 0; i < posts.length; i++) {
                    processPost(posts[i]);
                    //console.log(util.inspect(posts[i]));
                }
            });
        });
    });
}

function processPost(post) {
    console.log('Processing Post');

    var postTitle = post.title;
    console.log('Post title: ' + postTitle);
    var postDate = new Date(post.pubDate);
    console.log('Post Date: ' + postDate);
    var postData = post['content:encoded'][0];
    console.log('Post length: ' + postData.length + ' bytes');
    var slug = post['wp:post_name'];
    console.log('Post slug: ' + slug);
    var postType = post['wp:post_type'];
    console.log('Post type: ' + postType);

    if (postType != 'post') 
    { 
        console.log('**** Skipping non-post type: '+postType)
        return;
    };

    //Merge categories and tags into tags
    var categories = [];
    if (post.category != undefined) {
        for (var i = 0; i < post.category.length; i++) {
            var cat = post.category[i]['_'];
            if (cat != "Uncategorized")
                categories.push(cat);
            //console.log('CATEGORY: ' + util.inspect(post.category[i]['_']));
        }
    }

    var fullPath = '_posts/' + postDate.getFullYear() + '-' + getPaddedMonthNumber(postDate.getMonth() + 1) + '-' + getPaddedDayNumber(postDate.getDay() + 1) + '-' + slug + '.md';


    //Find all images
    var patt = new RegExp("(?:src=\"(.*?)\")", "gi");

    var m;
    var matches = [];
    while ((m = patt.exec(postData)) !== null) {
        matches.push(m[1]);
        //console.log("Found: " + m[1]);
    }


    if (matches != null && matches.length > 0) {
        for (var i = 0; i < matches.length; i++) {
            //console.log('Post image found: ' + matches[i])

            var url = matches[i];
            var urlParts = matches[i].split('/');
            var imageName = urlParts[urlParts.length - 1];

            var filePath =  'images/' + imageName;

            downloadFile(url, filePath);

            //Make the image name local relative in the markdown
            postData = postData.replace(url, '/images/'+ imageName);
            //console.log('Replacing ' + url + ' with ' + imageName);
        }
    }

    var markdown = toMarkdown.toMarkdown(postData);

    //Fix characters that markdown doesn't like
    // smart single quotes and apostrophe
    markdown = markdown.replace(/[\u2018|\u2019|\u201A]/g, "\'");
    // smart double quotes
    markdown = markdown.replace(/&quot;/g, "\"");
    markdown = markdown.replace(/[\u201C|\u201D|\u201E]/g, "\"");
    // ellipsis
    markdown = markdown.replace(/\u2026/g, "...");
    // dashes
    markdown = markdown.replace(/[\u2013|\u2014]/g, "-");
    // circumflex
    markdown = markdown.replace(/\u02C6/g, "^");
    // open angle bracket
    markdown = markdown.replace(/\u2039/g, "<");
    markdown = markdown.replace(/&lt;/g, "<");
    // close angle bracket
    markdown = markdown.replace(/\u203A/g, ">");
    markdown = markdown.replace(/&gt;/g, ">");
    // spaces
    markdown = markdown.replace(/[\u02DC|\u00A0]/g, " ");
    // ampersand
    markdown = markdown.replace(/&amp;/g, "&");

    var header = "";
    header += "---\n";
    header += "layout: post\n";
    header += "title: \"" + postTitle + "\"\n";
    header += "date: " + postDate.getFullYear() + '-' + getPaddedMonthNumber(postDate.getMonth() + 1) + '-' + getPaddedDayNumber(postDate.getDate()) + "\n";
    if (categories.length > 0)
        header += "tags: " + JSON.stringify(categories) + '\n';
    header += "---\n";
    header += "\n";

    fs.writeFile(fullPath, header + markdown, function (err) {

    });
}

var download = function (url, dest, cb) {
    var file = fs.createWriteStream(dest);
    var sendReq = request.get(url);

    // verify response code
    sendReq.on('response', function (response) {
        if (response.statusCode !== 200) {
            return cb('Response status was ' + response.statusCode + ' ' + url);
        }
    });

    // check for request errors
    sendReq.on('error', function (err) {
        fs.unlink(dest);
        return cb(err.message);
    });

    sendReq.pipe(file);

    file.on('finish', function () {
        file.close(cb);  // close() is async, call cb after close completes.
    });

    file.on('error', function (err) { // Handle errors
        fs.unlink(dest); // Delete the file async. (But we don't check the result)
        return cb(err.message);
    });
};

function downloadFile(url, path) {
    //console.log("Attempt downloading " + url + " to " + path + ' ' + url.indexOf("https:") + ' ' + url.indexOf("http:"));
    if (url.indexOf("https:") >= 0 || url.indexOf("http:") >= 0) {
        if (url.indexOf(".jpeg") >= 0 || url.indexOf(".jpg") >= 0 || url.indexOf(".png") >= 0 || url.indexOf(".png") >= 0) {

            download(url, path, function (status) {
                if (status !== undefined) { console.log(status); }
            });
        }
        else {
            console.log('passing on 2: ' + url + ' ' + url.indexOf('https:'));
        }
    }
    else {
        console.log('passing on: ' + url + ' ' + url.indexOf('https:'));
    }
}
function getPaddedMonthNumber(month) {
    if (month < 10)
        return "0" + month;
    else
        return month;
}

function getPaddedDayNumber(day) {
    if (day < 10)
        return "0" + day;
    else
        return day;
}
