(function(exports) {
  // first, some local helper functions (not exported)

  /**
   * Returns a DOM fragment as a jQuery object, given a HTML string.
   *
   * Discussion:
   *   This is taken from jQuery core and optimized for our use-case. The
   *   jQuery(html) and jQuery(obj).html(html) functions try to be "smart" and
   *   guess the intentions of the caller (look up an id? load html? etc) which
   *   messes with for instance markdown content which often start with a "#",
   *   in which case jQuery tries to find an element with that id.
   */
  function htmlToDOM(html) {
    var wrap = document.createElement(exports.fragment.tagName);
    try {
      wrap.innerHTML = html;
      return $(wrap);
    } catch (e) {
      return $(wrap).empty().append(value);
    }
  }

  /**
   * Process a template with context and return HTML
   */
  function processFragment(template, context) {
    var html = template.html;
    if (typeof html !== 'string') return ""; // todo: throw error?
    var ctx = {
      _template: template
    };
    ctx = $.extend(true, ctx, exports.context, context);
    // always run through mustache if available
    if (window.Mustache) {
      if (template.id == 'remote.html')
        console.log('ctx', ctx);
      html = Mustache.to_html(html, ctx);
    }
    // if there's a custom type specified, try look up a preprocessor
    if (template.type && template.type !== 'text/html') {
      var pp = exports.fragment.preprocessors[template.type];
      if (pp) {
        html = pp(html, ctx);
      } else if (window.console) {
        console.warn("fragment.js: Don't know how to process content of type '"+
                     template.type+"'");
      }
    }
    return html;
  }
  
  /**
   * The global context
   */
  exports.context = {};
  
  // creates a fragment from a template
  function createFragment(template, context, asHTML, noProcessing) {
    if (typeof context !== 'object') {
      noPreprocessing = asHTML;
      asHTML = context;
      context = null;
    }
    var html;
    if (!noPreprocessing) {
      html = processFragment(template, context);
    }
    if (asHTML) {
      return html;
    }
    var q = htmlToDOM(html);
    if (template.classname)
      q.attr('class', exports.fragment.classPrefix + template.classname);
    q.context = context;
    q.template = template;
    q.update = function() {
      q.html(processFragment(template, q.context));
    }
    return q;
  }

  /**
   * Returns a new fragment (as a jQuery object or a HTML string)
   *
   * fragment(id [,context] [,asHTML[, noPreprocessing]] [,callback]) -> new jQuery
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
      frag = createFragment(template, context, asHTML, noProcessing);
      if (callback) callback(null, frag);
    } else if (callback) {
      exports.fragment.template(id, function(err, template) {
        if (!err)
          frag = createFragment(template, context, asHTML, noProcessing);
        callback(err, frag);
      });
    } else if (window.console) {
      window.console.error('template not found: "'+id+'"');
    }
    return frag;
  }
  
  // Type of element which will wrap each fragment
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
    if (typeof content === 'string') {
      this.html = content;
    } else {
      this.html = $(content).html();
    }
    this.html = this.html.replace(trimCRLFRE, '');
    this.id = id;
    this.type = type;
    if (typeof this.id === "string") {
      this.classname = this.id.replace(fnextRE, '')
        .replace(classnameReservedSeparatorsRE, '-')
        .replace(classnameReservedStripRE, '');
    }
  }

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
      if (window.console)
        window.console.error('template not found: "'+id+'"');
      return;
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
          } else {
            var msg = rsp.status ? rsp.statusText : 'Communication error';
            msg += ' ('+url+')';
            callback(err || new Error(String(msg)));
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
      var t = new exports.fragment.Template($this.attr('id'), $this.remove(),
                                            $this.attr('type'));
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