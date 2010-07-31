/**
 * Hook code to URL anchors.
 *
 * Example:
 *
 *   // Replacing contents of element "post" with data from a PHP script, triggering
 *   // on e.g. "#posts/2010/some-post-slug".
 *
 *   // Wait for DOM to load
 *   $(function(){
 *      // Register a handler using traditional ":" syntax
 *      hunchor.on('/posts/:year/:slug', function(params, path, prevPath){
 *        if (window.console)
 *          console.log('navigated from '+prevPath+' --> '+path);
 *        $.get('post.php?y='+params.year+'&s='+params.slug, function(data){
 *           $('#post').html(data);
 *        });
 *      });
 *   });
 *
 *
 * [MIT license]
 * Copyright (c) 2010 Rasmus Andersson <http://hunch.se/>
 * 
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 * 
 * The above copyright notice and this permission notice shall be included in
 * all copies or substantial portions of the Software.
 * 
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
 * THE SOFTWARE.
 */
var hunchor = {};

(function(){

// Map of path => element ( => [handler, ...] )
hunchor.routes = [];

/*
Events emitted by exports.events:
  change (ev, String currentPath, String previousPath, Array routes)
    Called when hash changes, before calling routes
  changed (ev, String currentPath, String previousPath, Array routes)
    Called when hash changed, after calling routes
*/
hunchor.events = new Object;

// Current path
//hunchor.path;

hunchor.on = function(path, priority, handler){
  if (typeof priority === 'function') {
    handler = priority;
    priority = 100;
  } else {
    priority = parseInt(priority);
  }
  handler = new hunchor.Route(path, handler);
  hunchor.routes.push([priority, handler]);
  hunchor.routes.sort(function(a,b){ return b[0]-a[0]; });
  handler.isIndex = (path === '' || (typeof path.test === 'function' && path.test('') === true));
  if (handler.isIndex && document.location.hash.substr(1) === '') {
    hunchor.path = undefined; // force update
	  onHashChange();
  }
  return handler;
};

hunchor.enableMultiRoutes = false;

hunchor.solve = function(path, params) {
  var route, matches, routes = [];
  for (var i=0, L = hunchor.routes.length; i < L; i++){
    route = hunchor.routes[i][1];
    if (route && (matches = route.path.exec(path))) {
      if (params && Array.isArray(matches) && matches.length)
        route.extractParams(params, matches);
      routes.push(route);
      if (!hunchor.enableMultiRoutes) break;
    }
  }
  return routes;
};

hunchor.reload = function(){
  hunchor.path = undefined;
  onHashChange();
};

// ----------------------------------------------------------------------------
// Internal

if (Array.prototype.indexOf === undefined) {
  Array.prototype.indexOf = function(item){
    for (var i=0,L=this.length; i<L; ++i)
      if (this[i] === item) return i;
    return -1;
  };
}
if (Array.isArray === undefined) {
  Array.isArray = $.isArray;
}

function querystringUnescape(str, decodeSpaces) {
  str = String(str);
  return decodeURIComponent(decodeSpaces ? str.replace(/\+/g, " ") : str);
}

function findByStrictPath(path) {
  var i, route;
  for (i=0; (route = hunchor.routes.routes[i]); ++i)
		if (route.path === path) return route;
}

function onHashChange() {
  var prevPath = hunchor.path,
      params = {}, routes;
  hunchor.path = document.location.hash.substr(1);
  if (prevPath === hunchor.path) return;
  routes = hunchor.solve(hunchor.path, params);
  $(hunchor.events).trigger('change', hunchor.path, prevPath, routes);
  for (var i=0; (route = routes[i]); ++i) {
    try {
      route.handler(params, hunchor.path, prevPath);
		} catch (e) {
			if (window.console) console.error('[hunchor] error when calling handler: '+(e.stack || e),
			  'handler =>', route.handler);
		}
	}
	$(hunchor.events).trigger('changed', hunchor.path, prevPath, routes);
}

function isRegExp(obj) {
  return (obj instanceof RegExp)
      || (typeof obj === 'object' && (obj.constructor === RegExp));
}

// ----------------------------------------------------------------------------

/** Represents a route to handler by path */
function FixedStringMatch(string, caseSensitive) {
  this.string = caseSensitive ? string : string.toLowerCase();
  if (caseSensitive) this.caseSensitive = caseSensitive;
}
FixedStringMatch.prototype.exec = function(str) {
  return this.caseSensitive ? (str === this.string) : (str.toLowerCase() === this.string);
};

/** Route */
hunchor.Route = function(pat, handler) {
  var nsrc, p, re, m, mlen;
  this.keys = [];
  this.path = pat;
  this.handler = handler;
  if (typeof handler !== 'function') throw new Error('handler must be a function');
  if (handler.routes === undefined) handler.routes = [this];
  else handler.routes.push(this);
  // x(['/users/([^/]+)/info', 'username'], ..
  if (Array.isArray(pat)) {
    re = pat.shift();
    if (!re || !isRegExp(re)) re = new RegExp('^'+re+'$');
    this.path = re;
    this.keys = pat;
  }
  // x('/users/:username/info', ..
  else if (!isRegExp(pat)) {
    pat = String(pat).replace(/^[#\/]+/, ''); // strip prefix "#" and "/"
    if (pat.indexOf(':') === -1) {
      this.path = new FixedStringMatch(pat);
    } else {
      nsrc = pat.replace(/:[^\/]*/g, '([^/]*)');
      nsrc = '^'+nsrc+'$';
      this.path = new RegExp(nsrc, 'i'); // case-insensitive by default
      var param_keys = pat.match(/:[^\/]*/g);
      if (param_keys) {
        for (var i=0; i < param_keys.length; i++)
          this.keys.push(param_keys[i].replace(/^:/g, ''));
      }
    }
  }
  // Pure RegExp
  // x(/^\/users\/(<username>[^\/]+)\/info$/', ..
  // x(/^\/users\/([^/]+)\/info$/, ..
  else {
    src = pat.source;
    p = src.indexOf('<');
    if (p !== -1 && src.indexOf('>', p+1) !== -1) {
      re = /\(<[^>]+>/;
      m = null;
      p--;
      nsrc = src.substr(0, p);
      src = src.substr(p);
      while ((m = re.exec(src))) {
        nsrc += src.substring(0, m.index+1); // +1 for "("
        mlen = m[0].length;
        src = src.substr(m.index+mlen);
        this.keys.push(m[0].substr(2,mlen-3));
      }
      if (src.length) nsrc += src;
      // i is the only modifier which makes sense for path matching routes
      this.path = new RegExp(nsrc, pat.ignoreCase ? 'i' : undefined);
    }
    else {
      this.path = pat;
    }
  }
};

hunchor.Route.prototype.extractParams = function(params, matches) {
  var i, l, captures = [], m;
  matches.shift();
  for (i=0, l = this.keys.length; i < l; i++) {
    if ((m = matches.shift()))
      params[this.keys[i]] = querystringUnescape(m, true);
  }
  for (i=0, l = matches.length; i < l; i++)
    captures[i] = querystringUnescape(matches[i], true);
  if (captures.length)
    params._captures = captures;
};


function _init() {
  hunchor._prevhash = '';
	if ("onhashchange" in window) {
	  //console.log('have onhashchange');
		$(window).bind('hashchange', function(){
		  if (hunchor._prevhash !== document.location.hash){
				hunchor._prevhash = document.location.hash;
				onHashChange();
			}
		});
	}
	// even though onhashchange exists in modern browsers, it's a bit buggy in some,
	// so always poll (however at a lower rate in that case) the state.
	setInterval(function(){
		if (hunchor._prevhash !== document.location.hash){
			hunchor._prevhash = document.location.hash;
			onHashChange();
		}
	}, ("onhashchange" in window) ? 500 : 100);
	onHashChange();
	return true;
}

// next tick after dom ready
$(function(){setTimeout(function(){ _init(); },1);});

})();

// ----------------------------------------------------------------------------
// jQuery plugin

jQuery.fn.hunchorBrowser = function(options) {
  var opt = jQuery.extend({
    // default options
    dirIndexSuffix: 'index.md',
    //relativePathPrefix: 'pages/',
    //indexURL: 'index.md',
    transitionDuration: 100,
    //breadcrumb: [jQuery object],
    breadcrumbSeparator: ' → ',
    breadcrumbLoadingTitle: '•••', // if not set, url is used
    markdownToHTML: null // function for converting markdown
  }, options);
  
  var $errorMessage = $(opt.errorDisplay),
      $breadcrumb = $(opt.breadcrumb),
      $breadcrumbRoot = $breadcrumb.find('.root');
  
  // Markdown parser auto-setup
  if (!opt.markdownToHTML && window.Showdown !== undefined && typeof Showdown.converter === 'function') {
    opt.markdownToHTML = (new Showdown.converter()).makeHtml;
  }
  if (typeof opt.markdownToHTML !== 'function') {
    opt.markdownToHTML = null;
  }
  
  // Breadcrumb functions
  if ($breadcrumb.length) {
    var baseDocumentTitle = document.title;
    if ($breadcrumbRoot.length === 0) {
      $breadcrumbRoot = $breadcrumb.children().first();
    }
    function breadcrumbClear() {
      $breadcrumbRoot.nextAll().remove();
      document.title = baseDocumentTitle;
    }
    function breadcrumbAppend(title, slug) {
      var prefix = opt.breadcrumbSeparator ?
        '<span>'+opt.breadcrumbSeparator+'</span>' : '';
      if (slug) {
        $breadcrumb.append(prefix+'<a href="#'+slug+'">'+title+'</a>');
      } else {
        $breadcrumb.append(prefix+'<a>'+title+'</a>');
      }
      document.title += opt.breadcrumbSeparator+title;
    }
    function breadcrumbSet(title, slug) {
      breadcrumbClear();
      breadcrumbAppend(title, slug);
    }
  } else {
    var breadcrumbClear = function() {},
        breadcrumbAppend = breadcrumbClear,
        breadcrumbSet = breadcrumbClear;
  }
  
  // Enable each element
  return this.each(function(){
    var $content = $(this),
        $index = $content.children().clone();
    $content.empty();
    
    var loadContent = function(url) {
      //console.log('loadContent: '+url);
      $errorMessage.hide();
      breadcrumbSet(opt.breadcrumbLoadingTitle || url);
      
      var _triggerOnFadedOut;
      var whenFadedOut = function(fun){ _triggerOnFadedOut = fun; };
      $content.fadeOut(opt.transitionDuration, function(){
        if (_triggerOnFadedOut) _triggerOnFadedOut();
        whenFadedOut = function(fun){ fun(); };
      });
      
      if (opt.dirIndexSuffix && url.substr(url.length-1) === '/')
        url += opt.dirIndexSuffix;
      if (opt.relativePathPrefix && url.indexOf('://') === -1)
        url = opt.relativePathPrefix + url;
      
      $.ajax({
        url: url,
        complete: function (rsp, textStatus) {
          if (textStatus === 'success') {
            whenFadedOut(function(){
              var html = rsp.responseText;
              var contentType = rsp.getResponseHeader('Content-Type') || 'text/html';
              if (opt.markdownToHTML && (contentType.indexOf('markdown') !== -1 || contentType === 'text/plain')) {
                html = opt.markdownToHTML(html);
              }
              var title = html.match(/<h[1-3][^<]*>([^<]+)<\/h[1-3]>/);
              if (title) {
                breadcrumbSet(title[1]);
              } else if (opt.breadcrumbLoadingTitle) {
                breadcrumbSet(url);
              }
              $content.html(html).fadeIn(opt.transitionDuration);
            });
          }
        },
        error: function(xhr, textStatus, errorThrown) {
          if (xhr.status === 404) {
            $errorMessage.text('Sorry, #'+url+' was not found');
          } else {
            $errorMessage.html(xhr.responseText);
          }
          whenFadedOut(function(){
            $errorMessage.fadeIn(opt.transitionDuration);
          });
          if (window.console) console.warn(xhr, textStatus, errorThrown);
        }
      }); // ajax
    }; // loadContent()
    
    function fetchDirIndex(url, callback) {
      var _url = url;
      if (opt.relativePathPrefix && _url.indexOf('://') === -1)
        _url = opt.relativePathPrefix + _url;
      $.ajax({
        url: _url,
        complete: function (rsp, textStatus, err) {
          if (textStatus === 'success') {
            //console.log(rsp);
            var links = [],
                re = new RegExp('<a href="([^\\?\\/][^"]*)"', 'gi'),
                m = null;
            while ((m = re.exec(rsp.responseText)) !== null) {
              links.push(m[1]);
              //$content.append('<a href="#'+baseURL+m[1]+'">'+m[1]+'</a>');
            }
            callback(null, links);
          } else {
            callback(err || new Error(String(rsp.statusText)));
          }
        }
      }); // ajax
    }
    
    // bind "" to index
    hunchor.on('', function(params, path, prevPath){
      //console.log('index');
      breadcrumbClear();
      $content.fadeOut(100);
      //todo: fadeout-trigger like in loadContent
      fetchDirIndex('', function(err, links) {
        $content.empty().html('<ul></ul>');
        var $ul = $content.find('ul');
        for(var i in links) {
          $ul.append('<li><a href="#'+links[i]+'">'+links[i]+'</a></li>');
        }
        $content.fadeIn(100);
      })
    });
    
    // bind ".+" to path
    hunchor.on(/^(<path>.+)/, function(params, path, prevPath){
      loadContent(params.path);
    });
    
  });
};