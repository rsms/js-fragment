# js-fragment

Client-side templating for modern thinkers.

Requires jQuery 1.4 or later. Tested in modern browsers (Chrome, Safari, Firefox). Patches are welcome.

## Example

    <script type="text/javascript">
      $(function(){
        context.siteTitle = "Fancy Restaurant";
        context.session = {username: "john.doe"};
        $('body').append(fragment('header').fadeIn(200));
        fragment('about/intro.html', function(err, frag){
          if (err) return alert(err.stack);
          $('body').append(frag.fadeIn(200));
        });
      });
    </script>
    <div fragment="header">
      <h1>{{siteTitle}}</h1>
      <p>
        Welcome
        {{#session}}back {{username}}!{{/session}}
        {{^session}}stranger.{{/session}}
      </p>
    </div>

Read [the introduction](http://hunch.se/js-fragment/) or look at the [source of some examples](http://github.com/rsms/js-fragment/blob/master/examples/basics.html) and [try them out in your browser](http://hunch.se/js-fragment/examples/basics.html).

## Caveats

- If Mustache processing is enabled, you must use the `mustacho.js` file bundled with `fragment.js` (the one in this repository), since fragment.js requires two things which are not in the regular mustache.js:
  - pre and post filter hooks (for partials) so we can perform our own processing (e.g. markdown)
  - preserve whitespace so to not mess upp markdown or other space and crlf sensitive markup.
- Dependency: jQuery >= 1.4

### TODO

- Make Mustache `{{>partial}}`s asynchronous. Needed when the requested template is not yet loaded. Currently a partial must already be loaded when requested.

## MIT license

Copyright (c) 2010 Rasmus Andersson <http://hunch.se/>

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in
all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
THE SOFTWARE.

