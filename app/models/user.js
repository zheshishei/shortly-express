var db = require('../config');
var bcrypt = require('bcrypt-nodejs');
var Promise = require('bluebird');

var User = db.Model.extend({
  tableName: 'users',
  hasTimestamps: true,

  initialize: function(){
    var model = this;

    var pass = model.get('password');

    if(pass !== undefined){
      bcrypt.genSalt(10, function(err, salt) {
        model.set('salt', salt);

        bcrypt.hash(pass, salt, null, function(err, hashedPass) {
          model.set('password', hashedPass);
          model.save();
        });
      });
    }
  },

  testPassword: function(password, callback){
    bcrypt.hash(password, this.get('salt'), null, function(err, hashedPass) {
      callback(hashedPass);
    });
  }

});

module.exports = User;
