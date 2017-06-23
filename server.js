var express = require('express');
var app = express();
var port = process.env.port || 8083;


var exposedNodeModules = [ 
  '/node_modules/requirejs',
  '/node_modules/monaco-editor',
  '/node_modules/thegamma-script',
  '/node_modules/babel-standalone' ];
  
for(var i=0; i<exposedNodeModules.length; i++) {
  var subdir = exposedNodeModules[i];
  app.use(subdir, express.static(__dirname + subdir));
}  
  
app.get('/', function(_, res) { res.redirect('/expenditure'); })
app.use('/img', express.static(__dirname + '/web/img'));
app.use('/lib', express.static(__dirname + '/web/lib'));
app.use('/expenditure', express.static(__dirname + '/web/expenditure'));
app.use('/favicon.ico', express.static(__dirname + '/web/favicon.ico'));

app.listen(port);

console.log('Listening on port: ', port);
