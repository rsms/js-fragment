# js-fragment

Client-side templating for modern thinkers.

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
    <frag id="header" type="text/markdown">
      <h1>{{siteTitle}}</h1>
      <p>
        Welcome
        {{#session}}back {{username}}!{{/session}}
        {{^session}}stranger.{{/session}}
      </p>
    </frag>

See [source of example.html](http://github.com/rsms/js-fragment/blob/master/example.html) for a complete set of features [and try it out in your browser](http://github.com/rsms/js-fragment/raw/master/example.html).

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

