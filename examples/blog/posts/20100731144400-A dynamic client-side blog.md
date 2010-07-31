This blog is *running in your browser* and no server-side code is used, yet it 
makes use of dynamic content and optional Markdown conversion.

Blog posts can contain Mustache processing and Markdown. For instance this code:

    - Posts are based in `{\{postURLBase}}`.
    - This post is of type **{\{template.type}}**
    - ...and was published {\{datePublished.toLocaleDateString}}

Results in this output:

- Posts are based in `{{postURLBase}}`.
- This post is of type **{{template.type}}**
- ...and was published {{datePublished.toLocaleDateString}}

Here's the content of [this very post]({{postURLBase}}{{href}}):

<pre>{{template.body}}</pre>