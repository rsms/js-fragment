(function(exports) {
  // first, some local helper functions (not exported)

  // Unattached element used by htmlToJQuery
  var tempElement = document.createElement('span');

  /**
   * Returns a DOM fragment as a jQuery object, given a HTML string.
   *
   * Currently only supports HTML with a root element (i.e. a single outer
   * element).
   */
  function htmlToJQuery(html) {
    tempElement.innerHTML = html;
    return $(tempElement.firstChild);
  }
  // fallback to slower method for other browsers
  //function htmlToJQuery(html) {
  //  return $(tempElement).empty().append(html).contents();
  //}

  // remove comment nodes from a tree
  function removeCommentsR(node){
    var i = 0, nodes = node.childNodes, n;
    while ((n = nodes.item(i++))) {
      switch (n.nodeType) {
        case Node.ELEMENT_NODE:
          removeCommentsR(n);
          break;
        case Node.COMMENT_NODE:
          node.removeChild(n);
          i--;
      }
    }
  }
  function removeComments(jQueryObj) {
    return $(jQueryObj).each(function(i) {
      return removeCommentsR(this);
    });
  }

  // fast text trimming
  function strtrim (str) {
    str = str.replace(/^\s+/, '');
    for (var i = str.length - 1; i >= 0; i--) {
      if (/\S/.test(str.charAt(i))) {
        str = str.substring(0, i + 1);
        break;
      }
    }
    return str;
  }

  /**
   * The global context
   */
  exports.context = {};

  /**
   * Returns a new fragment (as a jQuery object or a HTML string)
   *
   * fragment(id [,context] [,asHTML[, noProcessing]] [,callback]) -> new jQuery
   * - fragment("foo")
   * - fragment("foo", {user:"john"})
   * - fragment("foo", {user:"john"}, function(err, frag) {...})
   * - fragment("foo", {user:"john"}, true, true)
   * - fragment("foo", function(err, frag) {...})
   * - fragment("foo", true)
   * - fragment("foo", true, true)
   *
   * @param id
   *  The id of the fragment template on which to build the fragment upon.
   *
   * @param context
   *  Fragment instance-local context which will extend on the global context.
   *  Later accessible as fragment.context.
   *
   * @param asHTML
   *  A true value results in a HTML string being returned instead of a fragment
   *  jQuery object.
   *
   * @param noProcessing
   *  A true value avoids/skips any processing (e.g. markdown or mustache).
   *
   * @param callback
   *  If passed, this function will be invoked when the fragment is ready.
   *  Useful for fragments which are not embedded but loaded remotely. Must be
   *  the last argument.
   */
  exports.fragment = function(id, context, asHTML, noProcessing, callback) {
    var lastarg = arguments[arguments.length-1];
    if (typeof lastarg === 'function') {
      callback = lastarg;
      if (arguments.length === 4)      noProcessing = null;
      else if (arguments.length === 3) asHTML = null;
      else if (arguments.length === 2) context = null;
    }
    var template = exports.fragment.template.cache[id], frag;
    if (template) {
      frag = template.createFragment(context, asHTML, noProcessing);
      if (callback) callback(null, frag);
    } else if (callback) {
      exports.fragment.template(id, function(err, template) {
        if (!err)
          frag = template.createFragment(context, asHTML, noProcessing);
        callback(err, frag);
      });
    } else {
      throw new Error('fragment template not found "'+id+'"');
    }
    return frag;
  }

  // Type of element which will wrap each fragment when there are multiple
  // children in one fragment
  exports.fragment.tagName = 'frag';
  // Class prefix for new fragments. <frag class="{prefix}{id}">
  exports.fragment.classPrefix = '';
  // Content preprocessors keyed by mime type
  exports.fragment.preprocessors = {};

  // Common regular expressions
  var trimCRLFRE = /^[\r\n]+|[\r\n]+$/g,
      fnextRE = /\.[^\.]+$/,
      classnameReservedSeparatorsRE = /[\/\.]+/g,
      classnameReservedStripRE = /[^a-zA-Z0-9_-]+/g;

  /**
   * Template prototype constructor
   */
  exports.fragment.Template = function(id, content, type) {
    var needMustachePostHtmlization = false;
    if (typeof id === 'object') {
      if (!(id instanceof jQuery))
        throw new Error('first argument must be a string or a jQuery object');
      this.id = id.attr('id');
      type = id.attr('type');
      content = id;
    } else {
      this.id = id;
      if (typeof content !== 'string')
        throw new Error('second argument must be a string');
      // encode mustache partial statements
      content = content.replace(/\{\{>/g, '{{&gt;');
      needMustachePostHtmlization = true;
      content = htmlToJQuery('<span>'+content+'</span>');
    }
    // make classname
    if (typeof this.id === "string") {
      this.classname = this.id.replace(fnextRE, '')
        .replace(classnameReservedSeparatorsRE, '-')
        .replace(classnameReservedStripRE, '');
    }
    // save number of root nodes
    var rootNodeCount = content.children().length;
    // expand content to a string (innerHTML of content)
    content = content.html();
    // post-process string to HTML conversion for mustache
    // e.g. "{{>included}}" is encoded and need to be decoded
    if (needMustachePostHtmlization) {
      content = content.replace(/\{\{&gt;/g, '{{>');
    }
    // preprocess
    if (type && type !== 'text/html') {
      var pp = exports.fragment.preprocessors[type];
      if (pp) {
        content = pp(content, this);
      } else if (window.console) {
        console.warn(
          "fragment.js: Don't know how to process content of type '"+type+"'");
      }
    }
    // set class or wrap if needed
    var classname = exports.fragment.classPrefix + this.classname;
    if (rootNodeCount === 1) {
      // inject/set classname
      var classP = -1,
          spP = content.indexOf(' '),
          gtP = content.indexOf('>');
      if (gtP > spP) {
        spP = gtP;
      } else {
        classP = content.indexOf('class=', spP);
      }
      if (classP !== -1) {
        classP += 6;
        var x = content.charAt(classP);
        classP += (x === '"' || x === "'") ? 1 : 0;
        content = content.substr(0, classP) + classname +
                  content.substr(classP);
      } else {
        content = content.substr(0, spP) + ' class="'+classname+'"' +
                  content.substr(spP);
      }
    } else {
      // wrap
      content = '<'+exports.fragment.tagName + ' class="'+classname+'"' + '>' +
                content + '</'+exports.fragment.tagName +'>';
    }
    // strip comments
    if (content.indexOf('<!--') !== -1) {
      var q = htmlToJQuery('<span>'+content+'</span>');
      removeComments(q);
      content = q.html();
    }
    // assign this.html and trim away whitespace
    this.html = strtrim(content);
  }
  $.extend(exports.fragment.Template.prototype, {
    // creates a fragment
    createFragment: function(context, asHTML, noProcessing) {
      if (typeof context !== 'object') {
        noProcessing = asHTML;
        asHTML = context;
        context = null;
      }
      var html;
      if (noProcessing) {
        html = this.html;
      } else {
        html = this.processFragment(this.html, context);
      }
      if (asHTML) {
        return html;
      }
      var q = htmlToJQuery(html);
      q.context = context;
      q.template = this;
      q.update = function() {
        q.html(q.template.processFragment(q.template.html, q.context));
      }
      return q;
    },

    // Process a template with context and return HTML
    processFragment: function(html, context, preMustached) {
      if (typeof html !== 'string')
        throw new Error("processFragment: bad input -- typeof html !== 'string'");
      // always run through mustache if available
      if (window.Mustache && !preMustached) {
        var ctx = $.extend(true, {_template: this}, exports.context, context);
        var partials = exports.fragment.template.cache;
        html = Mustache.to_html(html, ctx, partials);
      }
      if (typeof html !== 'string')
        throw new Error("processFragment: internal inconsistency -- typeof html !== 'string'");
      return html;
    },

    toString: function() {
      return this.html;
    },

    preMustacheFilter: function(mustacheRenderer, context, partials) {
      return this.createFragment(context, true, true);
    },

    postMustacheFilter: function(text, mustacheRenderer, context, partials) {
      return this.processFragment(text, context, /*preMustached = */true);
    }
  });

  /**
   * Request a template.
   *
   * fragment.template(id [,callback]) -> Template
   *
   * @param id
   *  Fragment template id
   *
   * @param callback
   *  Invoked when the template is ready. Useful for templates which are not
   *  embedded, but loaded remotely. Must be the last argument.
   */
  exports.fragment.template = function(id, callback) {
    var t = exports.fragment.template.cache[id];
    if (t) {
      if (callback) callback(null, t);
      return t;
    } else if (!callback) {
      throw new Error('fragment template not found "'+id+'"');
    }
    var req = exports.fragment.template.requestQueue[id];
    if (req) {
      req.callbacks.push(callback);
    } else {
      var url = id;
      req = {callbacks:[callback]};
      exports.fragment.template.requestQueue[id] = req;
      $.ajax({
        url: url,
        complete: function (rsp, textStatus, err) {
          if (textStatus === 'success' && rsp.status >= 100 && rsp.status < 400) {
            var t = new exports.fragment.Template(id, rsp.responseText,
              rsp.getResponseHeader('content-type'));
            exports.fragment.template.cache[id] = t;
            for (var i=0;i<req.callbacks.length;++i)
              req.callbacks[i](null, t);
            delete exports.fragment.template.requestQueue[id];
          } else {
            var msg = rsp.status ? rsp.statusText : 'Communication error';
            msg += ' ('+url+')';
            callback(new Error(String(msg)));
          }
        }
      }); // ajax
    }
  };

  // Requests in-flight queued by id
  exports.fragment.template.requestQueue = {};

  // jQuery selector for templates (used by init())
  exports.fragment.template.selector = exports.fragment.tagName;

  // Map which keeps the templates, keyed by fragment template id
  exports.fragment.template.cache = {};

  /**
   * Load all templates found in the document
   */
  exports.fragment.template.loadEmbedded = function() {
    // puts all fragments on the shelf and removes them from the document
    $(exports.fragment.template.selector).each(function(){
      var $this = $(this);
      var t = new exports.fragment.Template($this.remove());
      if (t.id) exports.fragment.template.cache[t.id] = t;
    });
  }

  // When DOM is ready...
  $(function(){
    // try to detect some common preprocessors
    if (window.Showdown !== undefined
      && typeof Showdown.converter === 'function')
    {
      exports.fragment.preprocessors['text/markdown'] =
      exports.fragment.preprocessors['text/x-markdown'] =
        (new Showdown.converter()).makeHtml;
    }
    // Trigger loading of templates when the DOM is ready
    exports.fragment.template.loadEmbedded();
  });
})(window);