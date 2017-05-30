if (!thegammaInit) { var thegammaInit = false; }

// We're not using any framework here (to keep it self-contained), 
// so the following implements simple dialog boxes for showing the code.
function openDialog(id) {
  document.getElementById("thegamma-" + id + "-dialog").style.display="block";
  setTimeout(function() { 
    document.getElementById("thegamma-" + id + "-dialog").style.opacity=1;
    document.getElementById("thegamma-" + id + "-dialog-window").style.top="0px";
  },1);
}
function closeDialog(id) {
  document.getElementById("thegamma-" + id + "-dialog").style.opacity=0;
  document.getElementById("thegamma-" + id + "-dialog-window").style.top="-500px";
  setTimeout(function() { 
    document.getElementById("thegamma-" + id + "-dialog").style.display="none";
  },400)
}

// When page loads - initialize all The Gamma visualizations
function loadTheGamma() {
  require.config({
    paths:{'vs':'node_modules/monaco-editor/min/vs'},
    map:{ "*":{"monaco":"vs/editor/editor.main"}}
  });
  require(["vs/editor/editor.main", "node_modules/thegamma-script/dist/thegamma.js"], function (_, g) {      
    // Go over all the visualizations as defined by 'var thegamma = [ .. ]' in the index.html file
    thegamma.forEach(function (info) {
      
      // Define the providers available in the visualizations
      var id = info.id;
      var services = "https://thegamma-services.azurewebsites.net/";      
      var providers = 
        g.providers.createProviders({ 
          "worldbank": g.providers.rest(services + "worldbank"),
          "libraries": g.providers.library("node_modules/thegamma-script/dist/libraries.json"),
          "shared": g.providers.rest("https://gallery-csv-service.azurewebsites.net/providers/listing", null, true),
          "olympics": g.providers.pivot(services + "pdata/olympics") });
        
      // Create context and setup error handler
      var ctx = g.gamma.createContext(providers);
      ctx.errorsReported(function (errs) { 
        var lis = errs.slice(0, 5).map(function (e) { 
          return "<li><span class='err'>error " + e.number + "</span>" +
            "<span class='loc'>at line " + e.startLine + " col " + e.startColumn + "</span>: " +
            e.message;
        });        
        var ul = "<ul>" + lis + "</ul>";
        document.getElementById("thegamma-" + id + "-errors").innerHTML = ul;
      });
      
      // Specify options and create the editor
      var opts =
        { height: document.getElementById("thegamma-" + id + "-sizer").clientHeight-250,
          width: document.getElementById("thegamma-" + id + "-sizer").clientWidth-20,
          monacoOptions: function(m) {
            m.fontFamily = "Inconsolata";
            m.fontSize = 15;
            m.lineHeight = 20;
            m.lineNumbers = false;
          } };
      var editor = ctx.createEditor("thegamma-" + id + "-ed", code, opts);
      
      // Set source code, evalate it and generate options for <select> elements
      // (only when there are placeholders and 'info.editors' is specified)
      function setSource(code) {
        ctx.evaluate(code, "thegamma-" + id + "-out");      
        editor.setValue(code);
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
                    setSource(newCode);
                  };
                  drop.innerHTML = html;
                });
            }
          });
        }
      }
      
      // Get and run default code, setup update handler
      var code = document.getElementById(id + "-code").innerHTML;      
      setSource(code);
      document.getElementById("thegamma-" + id + "-update").onclick = function() {
        ctx.evaluate(editor.getValue(), "thegamma-" + id + "-out");
        closeDialog(id);
        return false;
      }
    });
  });
}

// Generate HTML for each dialog box
function initTheGamma() {
  thegamma.forEach(function(info) {
    var el = document.getElementById(info.id);  
    el.innerHTML = 
      ("<div class='thegamma-edit'><a href='javascript:openDialog(\"[ID]\")'><i class='fa fa-code'></i> open source code</a></div>" +
      '<div id="thegamma-[ID]-out" class="thegamma-out"><p class="placeholder">Loading the visualization...</p></div>' +      
      '<div id="thegamma-[ID]-sizer" class="thegamma-sizer"></div>' +
      '<div id="thegamma-[ID]-dialog" class="thegamma-dialog">' +
      '  <div id="thegamma-[ID]-dialog-window" class="thegamma-dialog-window">' +
      '  <div class="header"><a href="javascript:closeDialog(\'[ID]\');">&times;</a><span>Edit source code</span></div>' +
      '  <div class="body"><div id="thegamma-[ID]-ed"></div><div id="thegamma-[ID]-errors" class="errors"></div>' +
      '    <button id="thegamma-[ID]-update">Update page</button></div>' +
      '</div></div>').replace(/\[ID\]/g, info.id);
  });
  loadTheGamma();
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
