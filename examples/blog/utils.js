if (!Array.prototype.forEach) {
  Array.prototype.forEach =  function(block, ctx) {
    var len = this.length >>> 0;
    for (var i = 0; i < len; ++i) {
      if (i in this) {
        block.call(ctx, this[i], i, this);
      }
    }
  };
}
if (!Array.prototype.map) {
  Array.prototype.map = function(fun, ctx) {
    var len = this.length >>> 0, res = new Array(len);
    for (var i = 0; i < len; ++i) {
      if (i in this) {
        res[i] = fun.call(ctx, this[i], i, this);
      }
    }
    return res;
  };
}
if (!Array.prototype.filter) {
  Array.prototype.filter = function (block, ctx) {
    var values = [];
    for (var i = 0; i < this.length; i++) {
      if (block.call(ctx, this[i])) {
        values.push(this[i]);
      }
    }
    return values;
  };
}

// callback-style GET
function GET(url, callback) {
  $.ajax({
    url: url,
    complete: function (rsp, textStatus, err) {
      if (textStatus === 'success' && rsp.status >= 100 
          && rsp.status < 400) {
        callback(null, rsp.responseText, rsp);
      } else {
        var msg = rsp.status ? rsp.statusText : 'Network error';
        msg += ' ('+url+')';
        callback(new Error(String(msg)));
      }
    }
  });
}

function findLinksInText(text) {
  var links = [], m,
      re = new RegExp('<a href="([^\\?\\/][^"]*)"', 'gi');
  while ((m = re.exec(text)) !== null) {
    links.push(m[1]);
  }
  return links;
}