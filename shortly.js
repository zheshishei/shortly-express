var express = require('express');
var util = require('./lib/utility');
var partials = require('express-partials');
var bodyParser = require('body-parser');
var session = require('express-session');

var db = require('./app/config');
var Users = require('./app/collections/users');
var User = require('./app/models/user');
var Links = require('./app/collections/links');
var Link = require('./app/models/link');
var Click = require('./app/models/click');

var app = express();

app.set('views', __dirname + '/views');
app.set('view engine', 'ejs');
app.use(partials());
// Parse JSON (uniform resource locators)
app.use(bodyParser.json());
// Parse forms (signup/login)
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static(__dirname + '/public'));

app.use(session({
  secret: 'keyboard cat',
  resave: false,
  saveUninitialized: true,
  // cookie: { maxAge: 5000 }
}));

function restrict(req, res) {
  console.log(!req.session.user);
  if (!req.session.user) {
    console.log('restricted access,', req.session.user);
    // req.session.error = 'Access denied!';
    req.session.destroy();
    res.redirect('/login');
    return true;
  }
  return false;
}

app.get('/',
function(req, res) {
  if(!restrict(req,res)) {
    console.log('rendering anyways,', req.session.user);
    res.render('index');
  }
});

app.get('/create',
function(req, res) {
  if(!restrict(req,res)) {
    console.log('rendering anyways');
    res.render('index');
  }
});

app.get('/logout', function(req,res) {
  console.log('logging out');
});

app.get('/links',
function(req, res) {
  restrict(req,res);
  Links.reset().fetch().then(function(links) {
    res.send(200, links.models);
  });
});

app.post('/links',
function(req, res) {
  var uri = req.body.url;
  if (!util.isValidUrl(uri)) {
    console.log('Not a valid url: ', uri);
    return res.send(404);
  }

  new Link({ url: uri }).fetch().then(function(found) {
    if (found) {
      res.send(200, found.attributes);
    } else {
      util.getUrlTitle(uri, function(err, title) {
        if (err) {
          console.log('Error reading URL heading: ', err);
          return res.send(404);
        }
        var link = new Link({
          url: uri,
          title: title,
          base_url: req.headers.origin
        });

        link.save().then(function(newLink) {
          Links.add(newLink);
          res.send(200, newLink);
        });
      });
    }
  });
});

/************************************************************/
// Write your authentication routes here
/************************************************************/
  app.get('/login',
  function(req, res){
    res.render('login');
  });


  app.post('/login',
  function(req, res) {
    var username = req.body.username;
    var password = req.body.password;

    new User({ username: username }).fetch().then(function(found) {
      if (found) {
        found.testPassword(password, function(hashed){
          if(found.get('password')===hashed){
            req.session.regenerate(function(){
            req.session.user = username;
            res.redirect(302, '/index')
            });
          } else{
            res.redirect(302, '/login');
          }
        })
      } else {
        res.redirect(302, '/login');
        }
    });
  });

  app.get('/signup',
  function(req, res){
    res.render('signup');
  });

  app.post('/signup',
  function(req, res) {
    var username = req.body.username;
    var password = req.body.password;

    var user = new User({
      username: username
    });

    user.fetch().then(function(found) {
      if (found) {
        res.redirect(302, '/login');
      } else {
        var user = new User({
          username: username,
          password: password
        });
        Users.add(user)
        req.session.regenerate(function(){
        req.session.user = username;
        res.redirect(302, '/index');
        });
      }
    });
  });


/************************************************************/
// Handle the wildcard route last - if all other routes fail
// assume the route is a short code and try and handle it here.
// If the short-code doesn't exist, send the user to '/'
/************************************************************/

app.get('/*', function(req, res) {
  new Link({ code: req.params[0] }).fetch().then(function(link) {
    if (!link) {
      res.redirect('/');
    } else {
      var click = new Click({
        link_id: link.get('id')
      });

      click.save().then(function() {
        db.knex('urls')
          .where('code', '=', link.get('code'))
          .update({
            visits: link.get('visits') + 1,
          }).then(function() {
            return res.redirect(link.get('url'));
          });
      });
    }
  });
});

console.log('Shortly is listening on 4568');
app.listen(4568);
