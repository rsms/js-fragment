/*
  mustache.js — Logic-less templates in JavaScript

  See http://mustache.github.com/ for more info.
*/

var Mustache = function() {
  var Renderer = function() {};

  Renderer.prototype = {
    otag: "{{",
    ctag: "}}",
    pragmas: {},
    buffer: [],
    pragmas_implemented: {
      "IMPLICIT-ITERATOR": true
    },
    context: {},
    partialMaxDepth: 10,
    decodeCurlyBraces: window.navigator.userAgent.indexOf('Firefox') !== -1,

    render: function(template, context, partials, in_recursion) {
      var templateObj;
      if (typeof template === 'object') {
        templateObj = template;
        if (templateObj.preMustacheFilter) {
          template = templateObj.preMustacheFilter.call(templateObj, this,
                                                        context, partials);
        }
      }
      if (typeof template !== 'string')
        template = String(template);
      if (this.decodeCurlyBraces)
        template = template.replace(/%7[Bb]/g, '{').replace(/%7[Dd]/g, '}');
      // reset buffer & set context
      if(!in_recursion) {
        this.context = context;
        this.buffer = []; // TODO: make this non-lazy
      }

      // fail fast
      if(template.length === 0) {
        if(in_recursion) {
          return template;
        } else {
          this.send(template);
          return;
        }
      }

      var s = this.render_pragmas(template);
      s = this.render_section(s, context, partials);
      s = this.render_tags(s, context, partials, in_recursion);
      
      if (in_recursion) {
        if (templateObj && templateObj.postMustacheFilter) {
          s = templateObj.postMustacheFilter.call(templateObj, s, this, context,
                                                  partials);
        }
        return s;
      }
    },

    /*
      Sends parsed lines
    */
    send: function(line) {
      this.buffer.push(line);
    },

    /*
      Looks for %PRAGMAS
    */
    render_pragmas: function(template) {
      // no pragmas
      if(!this.includes("%", template)) {
        return template;
      }

      var that = this;
      var regex = new RegExp(this.otag + "%([\\w-]+) ?([\\w]+=[\\w]+)?" +
            this.ctag);
      return template.replace(regex, function(match, pragma, options) {
        if(!that.pragmas_implemented[pragma]) {
          throw({message: 
            "This implementation of mustache doesn't understand the '" +
            pragma + "' pragma"});
        }
        that.pragmas[pragma] = {};
        if(options) {
          var opts = options.split("=");
          that.pragmas[pragma][opts[0]] = opts[1];
        }
        return "";
        // ignore unknown pragmas silently
      });
    },

    /*
      Tries to find a partial in the curent scope and render it
    */
    render_partial: function(name, context, partials) {
      name = this.trim(name);
      var partial;
      if(!partials || (partial = partials[name]) === undefined) {
        throw new Error("unknown_partial '" + name + "'");
      }
      if (!this.partialMaxDepth)
        throw new Error('max recursion depth for mustache partials');
      //if(typeof context[name] === "object") {
      //  return this.render(partials[name], context[name], partials, true);
      //};
      --this.partialMaxDepth;
      partial = this.render(partial, context, partials, true);
      ++this.partialMaxDepth;
      return partial;
    },

    /*
      Renders inverted (^) and normal (#) sections
    */
    render_section: function(template, context, partials) {
      if(!this.includes("#", template) && !this.includes("^", template)) {
        return template;
      }

      var that = this;
      // CSW - Added "+?" so it finds the tighest bound, not the widest
      var regex = new RegExp(this.otag + "(\\^|\\#)\\s*(.+)\\s*" + this.ctag +
              "\n*([\\s\\S]+?)" + this.otag + "\\/\\s*\\2\\s*" + this.ctag +
              "[\r\n]?", "mg");

      // for each {{#foo}}{{/foo}} section do...
      return template.replace(regex, function(match, type, name, content) {
        var value = that.find(name, context);
        if(type == "^") { // inverted section
          if(!value || that.is_array(value) && value.length === 0) {
            // false or empty list, render it
            return that.render(content, context, partials, true);
          } else {
            return "";
          }
        } else if(type == "#") { // normal section
          if(that.is_array(value)) { // Enumerable, Let's loop!
            return that.map(value, function(row) {
              return that.render(content, that.create_context(row),
                partials, true);
            }).join("");
          } else if(that.is_object(value)) { // Object, Use it as subcontext!
            return that.render(content, that.create_context(value),
              partials, true);
          } else if(typeof value === "function") {
            // higher order section
            return value.call(context, content, function(text) {
              return that.render(text, context, partials, true);
            });
          } else if(value) { // boolean section
            return that.render(content, context, partials, true);
          } else {
            return "";
          }
        }
      });
    },

    /*
      Replace {{foo}} and friends with values from our view
    */
    render_tags: function(template, context, partials, in_recursion) {
      // tit for tat
      var that = this;

      var new_regex = function() {
        return new RegExp(that.otag +
          "(=|!|>|\\{|%)?([^\\/#\\^].+?)\\1?" +
          that.ctag + "+", "g");
      };

      var tag_replace_callback = function(match, operator, name) {
        switch(operator) {
        case "!": // ignore comments
          return "";
        case "=": // set new delimiters, rebuild the replace regexp
          that.set_delimiters(name);
          regex = new_regex();
          return "";
        case ">": // render partial
          return that.render_partial(name, context, partials);
        case "{": // the triple mustache is unescaped
          return that.find(name, context);
        default: // escape the value
          return that.escape(that.find(name, context));
        }
      };
      var regex = new_regex();
      var lines = template.split("\n");
      for(var i = 0; i < lines.length; i++) {
        lines[i] = lines[i].replace(regex, tag_replace_callback, this);
        if(!in_recursion) {
          this.send(lines[i]);
        }
      }

      if(in_recursion) {
        return lines.join("\n");
      }
    },

    /*
      Replace {\{foo}} with {{foo}} (escaped)
    */
    expand_untouchables: function(template) {
      return template.replace(/\{\\\{(.+?)\}\}/g, '{{$1}}')
        .replace(/\{\\\\\{(.+?)\}\}/g, '{\\{$1}}');
    },

    set_delimiters: function(delimiters) {
      var dels = delimiters.split(" ");
      this.otag = this.escape_regex(dels[0]);
      this.ctag = this.escape_regex(dels[1]);
    },

    escape_regex: function(text) {
      // thank you Simon Willison
      if(!arguments.callee.sRE) {
        var specials = [
          '/', '.', '*', '+', '?', '|',
          '(', ')', '[', ']', '{', '}', '\\'
        ];
        arguments.callee.sRE = new RegExp(
          '(\\' + specials.join('|\\') + ')', 'g'
        );
      }
      return text.replace(arguments.callee.sRE, '\\$1');
    },

    /*
      find `name` in current `context`. That is find me a value
      from the view object
    */
    find: function(name, context) {
      var names = this.trim(name).split('.'),
          value = context, i, parent = context;
      for (i=0;(name = names[i]);++i) {
        parent = value;
        value = value[name];
        if (value === undefined && i === 0) {
          value = this.context[name];
        }
        if ((typeof value !== "object") && 
            (typeof value !== "function" || i === names.length-1)) {
          break;
        }
      }
      if (value === undefined) {
        return "";
      } else if (typeof value === "function") {
        return value.apply(names.length > 1 ? parent : context);
      }
      return value;
    },

    // Utility methods

    /* includes tag */
    includes: function(needle, haystack) {
      return haystack.indexOf(this.otag + needle) != -1;
    },

    /*
      Does away with nasty characters
    */
    escape: function(s) {
      s = String(s === null ? "" : s);
      s = s.replace(/&(?!\w+;)|["<>\\]/g, function(s) {
        switch(s) {
        case "&": return "&amp;";
        case "\\": return "\\\\";
        case '"': return '\"';
        case "<": return "&lt;";
        case ">": return "&gt;";
        default: return s;
        }
      });
      s = s.replace(/\{\{(.+?)\}\}/g, '{\\{$1}}');
      return s;
    },

    // by @langalex, support for arrays of strings
    create_context: function(_context) {
      if(this.is_object(_context)) {
        return _context;
      } else {
        var iterator = ".";
        if(this.pragmas["IMPLICIT-ITERATOR"]) {
          iterator = this.pragmas["IMPLICIT-ITERATOR"].iterator;
        }
        var ctx = {};
        ctx[iterator] = _context;
        return ctx;
      }
    },

    is_object: function(a) {
      return a && typeof a == "object";
    },

    is_array: function(a) {
      return Object.prototype.toString.call(a) === '[object Array]';
    },

    /*
      Gets rid of leading and trailing whitespace
    */
    trim: function(s) {
      return s.replace(/^\s*|\s*$/g, "");
    },

    /*
      Why, why, why? Because IE. Cry, cry cry.
    */
    map: function(array, fn) {
      if (typeof array.map == "function") {
        return array.map(fn);
      } else {
        var r = [];
        var l = array.length;
        for(var i = 0; i < l; i++) {
          r.push(fn(array[i]));
        }
        return r;
      }
    }
  };

  return({
    name: "mustache.js",
    version: "0.3.1-dev",

    /*
      Turns a template and view into HTML
      to_html(template[, context[, partials[, send_fun][, dontExpandUntouchables]]])
    */
    to_html: function(template, view, partials, send_fun, dontExpandUntouchables) {
      var renderer = new Renderer();
      if (typeof send_fun === "boolean") {
        dontExpandUntouchables = send_fun;
        send_fun = null;
      }
      if (send_fun) {
        renderer.send = send_fun;
      }
      renderer.render(template, view, partials);
      if (!send_fun) {
        var s = renderer.buffer.join("\n");
        if (!dontExpandUntouchables) {
          s = renderer.expand_untouchables(s);
        }
        //s = s.replace(/\{\\\\\{/g, '{\\{');
        return s;
      }
    }
  });
}();