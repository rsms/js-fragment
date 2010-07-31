// Post
function Post(href) {
  var m;
  this.href = href;
  if ((m = Post.HREF_RE.exec(decodeURIComponent(href)))) {
    // year, month, date [, hour, minute, second
    t = new Date;
    t.setUTCFullYear(parseInt(m[1]));
    t.setUTCMonth(parseInt(m[2])-1);
    t.setUTCDate(parseInt(m[3]));
    t.setUTCHours(parseInt(m[4]));
    t.setUTCMinutes(parseInt(m[5]));
    t.setUTCSeconds(parseInt(m[6]));
    this.datePublished = t;
    this.title = m[7];
  }
}
Post.prototype.rep = function(context) {
  if (!this.template) return {};
  var self = this;
  var rep = {};
  for (var k in this) {
    if (k !== 'rep')
      rep[k] = this[k];
  }
  rep.body = function() {
    return self.template.createFragment(this,
                                        true,  // HTML output
                                        false, // Enable preprocessing
                                        true   // No Mu untouchables
                                               // expansion.
                                       );
  }
  return rep;
};
Post.HREF_RE = 
  /^(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2}).(.+?)(\.[^\.]+|)$/;
Post.cache = {
  posts: {},
  get: function(key) { return Post.cache.posts[key]; },
  put: function(key, post) { Post.cache.posts[key] = post; },
  remove: function(key) { Post.cache.posts[key] = undefined; }
};
Post.get = function(href, callback, noCache) {
  var post;
  if (!noCache && (post = Post.cache.get(href)) && post.template) {
    return callback(null, post);
  }
  fragment.template(context.postURLBase + href, function(err, t) {
    if (!err) {
      post = Post.cache.get(href);
      if (!post) {
        post = new Post(href);
        Post.cache.put(href, post);
      }
      post.template = t;
    }
    callback(err, post);
  });
};
/**
 * Load many posts, possibly chained to maintain order
 */
Post.loadMany = function(posts, chained, loadCallback, completeCallback) {
  if (posts.length === 0) return completeCallback();
  if (chained) {
    var postsToLoad = posts.map(function(a){ return a; }); // copy
    var next = function(){
      var post = postsToLoad.shift();
      if (!post) return completeCallback();
      Post.get(post.href, function(err, post){
        loadCallback(err, post);
        next();
      });
    }
    next();
  } else {
    var counter = posts.length;
    posts.forEach(function(post){
      Post.get(post.href, function(err, post){
        loadCallback(err, post);
        if (--counter === 0)
          completeCallback();
      });
    });
  }
};
/**
 * Fetch the index of posts
 */
Post.fetchIndex = function(callback) {
  GET(context.postURLBase, function(err, data, rsp) {
    if (err) return callback(err);
    var links = findLinksInText(data), posts = [];
    links.sort();
    links.reverse();
    links.forEach(function(href) {
      var post, m, t, cachedPost;
      if ((cachedPost = Post.cache.get(href))) {
        post = cachedPost;
      } else {
        post = new Post(href);
        if (!post.title) {
          post = null;
        } else {
          Post.cache.put(post.href, post);
        }
      }
      if (post)
        posts.push(post);
    });
    //console.log(posts);
    callback(null, posts);
  });
};
/**
 * 
 */
Post.getIndex = function(indexCallback, postCallback, allDoneCallback){
  Post.fetchIndex(function(err, posts){
    if (err) return indexCallback(err);
    var loadedPosts = [], postsToLoad = [];
    posts.forEach(function(post){
      // might load already loaded posts, but we want to avoid "jumping"
      if (postsToLoad.length === 0 && post.template) {
        loadedPosts.push(post);
      } else {
        postsToLoad.push(post);
      }
    });
    indexCallback(err, loadedPosts, postsToLoad);
    // load posts (chained)
    Post.loadMany(postsToLoad, true, postCallback, function(err) {
      allDoneCallback(err, postsToLoad);
    });
  });
};
