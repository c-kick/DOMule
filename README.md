# js-modules
This is where I maintain a base collection of JavaScript modules I wrote and use regularly in my projects. These are all specifically aimed at integration inside the module ecosystem I wrote, which is designed and built around the `hnl.dynamicimports.mjs` and `hnl.eventhandler.mjs` base modules.

Although the modules can be used outside that ecosystem, I did not intend for this use. Modules may change/disappear without prior notice.

# Basic usage

Write an entrypoint module (e.g. `entrypoint.mjs`), include it in the page (`<script type="module" src="entrypoint.mjs" defer></script>`), and inside that:

    import eventHandler from 'hnl.eventhandler.mjs';
    import {dynImports} from 'hnl.dynamicimports.mjs';

    eventHandler.docReady(function(){
      //do stuff as soon as the document is ready (HTML content has been loaded, but not necessarily all images & resources)

      //handle all dynamic module imports
      dynImports({
        'assets'  :  'https://code.hnldesign.nl/js-modules/' //optional - path references to resolve (in this case) dynamically loaded module paths that begin with '%assets%/'
      }, function(e){
        //callback for when all modules loaded/primed
      });

    });
    
    eventHandler.docLoaded( function() {
      //do stuff as soon as the entire document is loaded (including images)
    });

Then, follow the module system's `data-requires="modulename"` methodology inside the page to load modules when required. See `hnl.dynamicimports.mjs` for instructions.
