// ----------------------------------------------------------------------------------------
// Logging user events
// ----------------------------------------------------------------------------------------

function guid(){
  var d = new Date().getTime();
  if (window.performance && typeof window.performance.now === "function") d += performance.now();
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
      var r = (d + Math.random()*16)%16 | 0;
      d = Math.floor(d/16);
      return (c=='x' ? r : (r&0x3|0x8)).toString(16);
  });
}

var ssid = guid();
var logStarted = false;
var pendingEvents = [];
var logTimer = -1;

function writeLog() {
  logTimer = -1;
  if (pendingEvents.length > 0) {
    var req = new XMLHttpRequest();
    req.open("POST", "https://thegamma-logs.azurewebsites.net/log/turing");
    req.send(pendingEvents.join("\n"));
  }
  pendingEvents = [];
}

function logEvent(category, evt, id, data) {
  if (!logStarted) return;
  var usrid = document.cookie.replace(/(?:(?:^|.*;\s*)thegammausrid\s*\=\s*([^;]*).*$)|^.*$/, "$1");
  if (usrid == "") {
    usrid = guid();
    document.cookie = "thegammausrid=" + usrid;
  }
  var logObj =
    { "user":usrid, "session":ssid,
      "time":(new Date()).toISOString(),
      "url":window.location.toString(),
      "element": id, "category": category, "event": evt, "data": data };
  
  pendingEvents.push(JSON.stringify(logObj));
  if (logTimer != -1) clearTimeout(logTimer);
  logTimer = setTimeout(writeLog, 1000);  
}

// ----------------------------------------------------------------------------------------
// Tracking score
// ----------------------------------------------------------------------------------------

function pairwiseDifference(o1, o2, op) {
  var res = 0;
  Object.keys(o1).forEach(function(k) { 
    res = op(res, o1[k] - o2[k]);
  });
  return res;    
}

function makeDictionary(arr) { 
  var o = {};
  arr.forEach(function(v) { o[v[0]] = v[1]; });
  return o;
}

function scoreBars(maxError) {
  return function(guess, values) {
    function add(a, b) { return a + Math.abs(b); }
    return 1 - (Math.sqrt(pairwiseDifference(guess, values, add)) / Math.sqrt(maxError));  
  }
}

function scoreSortBars(maxError) {
  return function(guess, values) {
    function add(a, b) { return a + Math.abs(b); }
    return 1 - (pairwiseDifference(guess, values, add) / maxError);  
  }
}

function scoreLine(cutoff, minError, maxError) {
  return function(guess, values) {
    function add(a, b) { 
      var bb = Math.abs(b) > cutoff ? cutoff + Math.sqrt(Math.abs(b)) : Math.abs(b);
      return a + bb * bb; }
    return 1 - (((pairwiseDifference(guess, values, add) / Object.keys(guess).length) - minError) / (maxError - minError));
  }
}

var scoring = 
  { "thegamma-people-role-out": { title:"People", f:scoreBars(500) }, 
    "thegamma-people-uni-out": { title:"Universities", f:scoreBars(170) },
    "thegamma-youtube-views-out": { title:"Views", f:scoreLine(5,75,300) },
    "thegamma-youtube-videos-out": { title:"Videos", f:scoreSortBars(6000) },    
    "thegamma-events-attend-kind-out": { title:"Events", f:scoreBars(16500) },
    "thegamma-events-selected-out": { title:"Lectures", f:scoreSortBars(320) } }

function updateScoreTable() {
  var table = "";
  var tweet = "My%20%40turinginst%20score%3A%20"
  var first = true;
  Object.keys(scoring).forEach(function(id) {
    var stars = "";
    if (typeof(scoring[id].score) == "undefined") {
      stars = '<i class="fa fa-ellipsis-h"></i>';
    } else {
      var tstars = "";
      var s = scoring[id].score;
      for(var i=0.18; i<1.0; i+=0.18) {
        if (s > i) stars += '<i class="fa fa-star"></i>';
        else if (s > i-0.09) stars += '<i class="fa fa-star-half-o"></i>';
        else stars += '<i class="fa fa-star-o"></i>';
        if (s > i) tstars += "%E2%98%85";
      }
      tweet += (first?"":"%2C%20") + scoring[id].title + "%20" + tstars;
      first = false;
    }
    table += '<tr><td>' + scoring[id].title + '</td><td>' + stars + '</td></tr>';
  });
  document.getElementById("game-table").innerHTML = table;
  document.getElementById("game-tweet").href = "https://twitter.com/intent/tweet?url=http%3a%2f%2fgamma.turing.ac.uk%2fturing-2017&amp;text=" + tweet;
  document.getElementById("game-tweet-2").href = "https://twitter.com/intent/tweet?url=http%3a%2f%2fgamma.turing.ac.uk%2fturing-2017&amp;text=" + tweet;
}

function resetGame() {
  logEvent("game", "reset", "", "");  
  Object.keys(scoring).forEach(function(id) {
    scoring[id].score = undefined;
    var id = id.substr(9, id.length-13);
    var code = document.getElementById(id + "-code").innerHTML;
    setSourceLookup[id](code, false, false);
  });
  updateScoreTable();  
  showScore();
}
function dontLikeGames() {
  logEvent("game", "disable", "", "");
  Object.keys(scoring).forEach(function(id) {
    var id = id.substr(9, id.length-13);
    var code = document.getElementById(id + "-code").innerHTML;
    setSourceLookup[id](code, false, true);
  });
  document.getElementById("game-status").style.display="none";
}

function handleCompletedEvent(o) {
  document.getElementById("game-status").style.display="block";
  var guess = makeDictionary(o.data.guess);
  var values = makeDictionary(o.data.values);
  scoring[o.id].score = scoring[o.id].f(guess, values);
  updateScoreTable();
  showScore();
}

var open = false;

function switchDetails() {
  var el = document.getElementById("game-details");
  if (!open) {
    el.style.maxHeight = "170px";
    el.style.opacity = 1;
  } else {
    el.style.maxHeight = "0px";
    el.style.opacity = 0;
  }
  open = !open;
}

function showScore() {
  if (open) return;  
  open = true;
  var el = document.getElementById("game-details");
  el.style.maxHeight = "170px";
  el.style.opacity = 1;
  setTimeout(function() {
    open = false;
    el.style.maxHeight = "0px";
    el.style.opacity = 0;
  }, 3000);
}

// ----------------------------------------------------------------------------------------
// Creating The Gamma visualization
// ----------------------------------------------------------------------------------------

if (!thegammaInit) { var thegammaInit = false; }

var roots =
  (window.location.hostname == "localhost" || window.location.hostname == "127.0.0.1") ?
  ["/node_modules/monaco-editor/min/vs", "/node_modules/thegamma-script/dist"] :
  ["https://thegamma.net/lib/thegamma-0.1/vs", "https://thegamma.net/lib/thegamma-0.1"];
  
var vsRoot = roots[0];
var theGammaRoot = roots[1];
var editor;
var setSourceLookup = {};
var lastId;

// We're not using any framework here (to keep it self-contained),
// so the following implements simple dialog boxes for showing the code.
function openDialog(id) {
  logEvent("dialog", "open", id, "");  
  var code = document.getElementById(id + "-code").innerHTML;
  editor.setValue(code);
  lastId = id;
    
  document.getElementById("thegamma-update").onclick = function() {
    setSourceLookup[id](editor.getValue(), true);
    closeDialog();
    return false;
  }
  
  document.getElementById("thegamma-dialog").style.display="block";
  setTimeout(function() {
    document.getElementById("thegamma-dialog").style.opacity=1;
    document.getElementById("thegamma-dialog-window").style.top="0px";
  },1);
}

function closeDialog() {
  logEvent("dialog", "close", lastId, "");
  document.getElementById("thegamma-dialog").style.opacity=0;
  document.getElementById("thegamma-dialog-window").style.top="-500px";
  setTimeout(function() {
    document.getElementById("thegamma-dialog").style.display="none";
  },400)
}

// When page loads - initialize all The Gamma visualizations
function loadTheGamma() {
  require.config({
    paths:{'vs':vsRoot},
    map:{ "*":{"monaco":"vs/editor/editor.main"}}
  });
  require(["vs/editor/editor.main", theGammaRoot + "/thegamma.js"], function (_, g) {
    var services = "https://thegamma-services.azurewebsites.net/";
    var providers =
      g.providers.createProviders({
        "worldbank": g.providers.rest(services + "worldbank"),
        "libraries": g.providers.library(theGammaRoot + "/libraries.json"),
        "shared": g.providers.rest("https://gallery-csv-service.azurewebsites.net/providers/listing", null, true),
        
        // Turing 2016/2017
        "people": g.providers.pivot("https://gallery-csv-service.azurewebsites.net/providers/csv/2017-05-07/file_0.csv"),
        "views": g.providers.pivot("https://gallery-csv-service.azurewebsites.net/providers/csv/2017-05-29/file_3.csv"),
        "videos": g.providers.pivot("https://gallery-csv-service.azurewebsites.net/providers/csv/2017-05-29/file_1.csv"),
        "events": g.providers.pivot("https://gallery-csv-service.azurewebsites.net/providers/csv/2017-07-03/file_2.csv"),
        "papers": g.providers.pivot("https://gallery-csv-service.azurewebsites.net/providers/csv/2017-07-04/file_0.csv"),
        
        // shared.'by date'.'May 2017'.'The Alan Turing Institute People (7 May 2017)'
        "olympics": g.providers.pivot(services + "pdata/olympics"),
        "expenditure": g.providers.rest("https://thegamma-govuk-expenditure-service.azurewebsites.net/expenditure") 
      });
      
    // Create context and setup error handler
    var ctx = g.gamma.createContext(providers);
    ctx.errorsReported(function (errs) {
      var lis = errs.slice(0, 5).map(function (e) {
        return "<li><span class='err'>error " + e.number + "</span>" +
          "<span class='loc'>at line " + e.startLine + " col " + e.startColumn + "</span>: " +
          e.message;
      });
      var ul = "<ul>" + lis + "</ul>";
      document.getElementById("thegamma-errors").innerHTML = ul;
    });
    
    // Specify options and create the editor
    var opts =
      { height: document.getElementById("thegamma-sizer").clientHeight-115,
        width: document.getElementById("thegamma-sizer").clientWidth-20,
        monacoOptions: function(m) {
          m.fontFamily = "Inconsolata";
          m.fontSize = 15;
          m.lineHeight = 20;
          m.lineNumbers = false;
        } };
    editor = ctx.createEditor("thegamma-ed", "", opts);

    // Go over all the visualizations as defined by 'var thegamma = [ .. ]' in the index.html file
    thegamma.forEach(function (info) {
      var id = info.id;

      // Set source code, evalate it and generate options for <select> elements
      // (only when there are placeholders and 'info.editors' is specified)
      function setSource(code, log, completed) {
        document.getElementById(id + "-code").innerHTML = code;
        
        if (log) logEvent("source", "update", id, code);
        ctx.evaluate(code).then(function(res) { 
          Object.keys(res).forEach(function(k) {
            var it = res[k];
            if (typeof it.setLogger === 'function') it = it.setLogger(function(o) { 
              if (o.event == "completed") handleCompletedEvent(o);
              logEvent("interactive", o.event, o.id, o.data);
            });
            if (typeof it.show === 'function') {
              if (completed) it.setInteractive(false).show("thegamma-" + id + "-out");
              else it.show("thegamma-" + id + "-out");
            }
          });
        });
        
        if (info.editors) {
          // Type check the source code & get result (as a JS promise)
          ctx.check(code).then(function(res) {
            if (res.wellTyped) {
              // If type checking succeeded, get all 'syntactic entities' in the typed code,
              // find all placeholders and generate <select> options for each placeholder
              res.getEntities()
                .filter(function(ent) { return ent.kind == "placeholder"; })
                .forEach(function(place) {
                  var html = "";
                  // Get the name of the selected member and other possible members
                  // e.g. given `foo.[p:bar]`, selected will be "bar" and members
                  // will be all other members that are available in `foo.<here>`
                  var selected = place.getChildren()[0].getChildren()[1];
                  place.getChildren()[0].getChildren()[0].type.members
                    .filter(function(m) { return m != "preview"; })
                    .forEach(function(m) {
                      var sel = m == selected.name ? " selected" : "";
                      html += "<option value='" + m + "'" + sel + ">" + m + "</option>";
                    });

                  // Set elements of the drop down. When selection changes,
                  // replace the placeholder in the source code with a new one.
                  var drop = document.getElementById(info.editors + "-" + place.name);
                  drop.onchange = function() {
                    var newCode = code.substr(0, place.range.start) +
                      "[" + place.name + ":'" + drop.value + "']" +
                      code.substr(place.range.end + 1);
                    logEvent("source", "select", id, {"placeholder":place.name, "value":drop.value});
                    setSource(newCode, true, false);
                  };
                  drop.innerHTML = html;
                });
            }
          });
        }
      }

      // Get and run default code, setup update handler
      setSourceLookup[id] = setSource;
      var code = document.getElementById(id + "-code").innerHTML;
      setSource(code, false, false);
    });
  });
}

// Generate HTML for each dialog box
function initTheGamma() {
  thegamma.forEach(function(info) {
    var el = document.getElementById(info.id);
    if (info.inline) {
      el.innerHTML =
        ("<a href='javascript:openDialog(\"[ID]\")' title='Click here to see the calculation behind the number.' " +
            "class='thegamma-inline' id='thegamma-[ID]-out'>(...)</a>").replace(/\[ID\]/g, info.id);      
    } else {
      el.innerHTML =
        ("<div class='thegamma-edit'><a href='javascript:openDialog(\"[ID]\")'><i class='fa fa-code'></i> open source code</a></div>" +
        '<div id="thegamma-[ID]-out" class="thegamma-out"><p class="placeholder">Loading the visualization...</p></div>')
        .replace(/\[ID\]/g, info.id);
      }
  });
  loadTheGamma();
  
  logStarted = true;
  logEvent("page", "loaded", "", window.navigator.userAgent);
}

if (!thegammaInit) {
  thegammaInit=true;
  var ol = window.onload;
  window.onload = function() { initTheGamma(); if (ol) ol(); };
  var link = '<link href="https://thegamma.net/lib/thegamma-0.1/thegamma.css" rel="stylesheet">';
  var heads = document.getElementsByTagName("head");
  if (heads.length > 0) heads[0].innerHTML += link;
  else document.write(link);
}

var lastWinWidth = window.innerWidth;
window.onresize = function() { 
  var w = window.innerWidth;
  if (lastWinWidth != w) {
    lastWinWidth = w;
    Object.keys(setSourceLookup).forEach(function(id) {
      var code = document.getElementById(id + "-code").innerHTML;
      setSourceLookup[id](code, false, false);
    });
  }
}
