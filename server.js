var express = require('express');
var app = express();
var port = process.env.port || 8083;


var exposedNodeModules = [ 
  '/node_modules/requirejs',
  '/node_modules/monaco-editor',
  '/node_modules/thegamma-script',
  '/node_modules/babel-standalone' ];
var exposedDirs = [
  'img', 'lib', 'expenditure', 'playground', 
  'carbon', 'turing-2017' ];
  
for(var i=0; i<exposedNodeModules.length; i++) {
  var subdir = exposedNodeModules[i];
  app.use(subdir, express.static(__dirname + subdir));
}  
for(var i=0; i<exposedDirs.length; i++) {    
  var dir = exposedDirs[i];
  app.use('/' + dir, express.static(__dirname + '/web/' + dir));
}
app.get('/', function(_, res) { res.redirect('/expenditure'); })
app.listen(port);

console.log('Listening on port: ', port);
