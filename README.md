# js-modules
This is where I maintain a base collection of JavaScript modules I wrote and regularly use in my various projects. These are all specifically aimed at integration inside the module ecosystem I wrote, which is designed and built around the `hnl.dynamicimports.mjs` and `hnl.eventhandler.mjs` base modules.

Although the modules can be used outside that ecosystem, I did not intend for this use. All modules use an `init` function, which takes a bunch of elements (`NodeList`) to work on. Modules may change/disappear without prior notice.

# Basic usage

Write an entrypoint module (e.g. `entrypoint.mjs`), and include it in your page (`<script type="module" src="entrypoint.mjs" defer></script>`). Inside that module:

    import eventHandler from 'hnl.eventhandler.mjs';
    import {dynImports} from 'hnl.dynamicimports.mjs';

    eventHandler.docReady(function(){
      //do stuff as soon as the document is ready (HTML content has been loaded, but not necessarily all images & resources)

      //handle all dynamic module imports
      dynImports({
        'assets'  :  'https://code.hnldesign.nl/js-modules/'
        //optional - path references to resolve dynamically loaded module paths that begin with '%assets%/'. This allows for fast replacement of lots of modules, e.g. in a development/live situation.
      }, function(e){
        //callback for when all modules loaded/primed
      });

    });
    
    eventHandler.docLoaded( function() {
      //do stuff as soon as the entire document is loaded (including images)
    });

Then, follow the module system's `data-requires="modulename"` methodology inside the page to load modules when required:

    <div data-requires="./modules/hnl.colortool.mjs" data-require-lazy="true"></div>

Or, if path references were set (see above):

    <div data-requires="%assets%/hnl.colortool.mjs" data-require-lazy="true"></div>

(require-lazy means the module will only get loaded when the requiring element has become visible inside the users viewport. It will then try running the module's exported 'init' function, if it has one, with the element in question as an object argument).

See `hnl.dynamicimports.mjs` for further usage instructions.
