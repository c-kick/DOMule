# js-modules
This is an ES6 JavaScript moduling ecosystem I wrote, which allows dynamic loading of frontend JavaScript, using [ES6 modules](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Modules), mitigating page load times and streamlining productivity by keeping the need for compiling to a minimum. It is based on the philosophy that JavaScript should be used to enhance the frontend experience, in a progressive way.

It consists of core functionality (described [below](#basic-usage), and utilizing the `hnl.dynamicimports.mjs` and `hnl.eventhandler.mjs` modules), and a collection of JavaScript modules I wrote and regularly use in my various projects. 

Though this is my personal repository for maintaining the moduling system, feel free to use it yourself. But please note: modules may change/disappear without prior notice.

# The moduling ecsystem in a nutshell
- On page load, it initializes itself as a deferred JavaScript module
- Firstly, event handlers are set up, and then the system waits for the page (DOM) to load
- On load (DOM has loaded) all HTML nodes are scanned for `data-requires` attributes, indicating they rely on, or are ehanced by, (a) certain JavaScript module(s)
- A list of modules to load is compiled, de-duped, and then (down)loaded asynchronously in the order they were found
- If a module exports an initializing function (`init`), this is called automatically after loading, using *all* nodes that required the module as an argument (`NodeList`)
- If a module is loaded with the additional `data-requires-lazy="true"` option, the module is not loaded immediately, but instead a watcher is set-up to check if the requiring node has become **visible inside the viewport**, after which the module is loaded. This allows you to postpone the loading of large scripts (or scripts that handle large amounts of data) until the user has actually scrolled far enough to reach them.

This system effectively relocates the logic of what your JavaScript should do, and when it should happen, to each individual module, keeping your main code clean and not worrying about when to initialize certain scripts.

# Basic usage

Store all modules inside your project (e.g. in /js/modules), write an entrypoint module (e.g. `entrypoint.mjs`), and include it in your page (`<script type="module" src="entrypoint.mjs" defer></script>`). Inside that module:

    import eventHandler from 'js/modules/hnl.eventhandler.mjs';
    import {dynImports} from 'js/modules/hnl.dynamicimports.mjs';

    eventHandler.docReady(function(){
      //do stuff as soon as the document is ready (HTML content has been loaded, but not necessarily all images & resources)

      //handle all dynamic module imports
      dynImports({
        'assets'  :  'https://code.hnldesign.nl/js/modules/'
        //optional - path references to resolve dynamically loaded module paths that begin with '%assets%/'. This allows for fast replacement of lots of modules, e.g. in a development/live situation.
      }, function(e){
        //callback for when all modules loaded/primed
      });

    });
    
    eventHandler.docLoaded( function() {
      //do stuff as soon as the entire document is loaded (including images)
    });

Then, follow the module system's `data-requires="modulename"` methodology inside the page to load modules when required:

    <div data-requires="mymodule.mjs"></div>

Or, if path references were set (see above):

    <div data-requires="%assets%/mymodule.mjs"></div>

You can even load multiple modules per node:

    <div data-requires="mymodule.mjs,myothermodule.mjs" data-require-lazy="true"></div>

(require-lazy means the module will only get loaded when the requiring element has become visible inside the users viewport. It will then try running the module's exported 'init' function, if it has one, with the element in question as an object argument).

See the JSDoc comments inside each module to see what they do. `_template.mjs` provides a boilerplate, and further instructions, for writing your own modules.
