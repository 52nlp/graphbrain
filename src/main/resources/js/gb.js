/* mindmaps.io */
// seedrandom.js version 2.0.
// Author: David Bau 4/2/2011
//
// Defines a method Math.seedrandom() that, when called, substitutes
// an explicitly seeded RC4-based algorithm for Math.random().  Also
// supports automatic seeding from local or network sources of entropy.
//
// Usage:
//
//   <script src=http://davidbau.com/encode/seedrandom-min.js></script>
//
//   Math.seedrandom('yipee'); Sets Math.random to a function that is
//                             initialized using the given explicit seed.
//
//   Math.seedrandom();        Sets Math.random to a function that is
//                             seeded using the current time, dom state,
//                             and other accumulated local entropy.
//                             The generated seed string is returned.
//
//   Math.seedrandom('yowza', true);
//                             Seeds using the given explicit seed mixed
//                             together with accumulated entropy.
//
//   <script src="http://bit.ly/srandom-512"></script>
//                             Seeds using physical random bits downloaded
//                             from random.org.
//
//   <script src="https://jsonlib.appspot.com/urandom?callback=Math.seedrandom">
//   </script>                 Seeds using urandom bits from call.jsonlib.com,
//                             which is faster than random.org.
//
// Examples:
//
//   Math.seedrandom("hello");            // Use "hello" as the seed.
//   document.write(Math.random());       // Always 0.5463663768140734
//   document.write(Math.random());       // Always 0.43973793770592234
//   var rng1 = Math.random;              // Remember the current prng.
//
//   var autoseed = Math.seedrandom();    // New prng with an automatic seed.
//   document.write(Math.random());       // Pretty much unpredictable.
//
//   Math.random = rng1;                  // Continue "hello" prng sequence.
//   document.write(Math.random());       // Always 0.554769432473455
//
//   Math.seedrandom(autoseed);           // Restart at the previous seed.
//   document.write(Math.random());       // Repeat the 'unpredictable' value.
//
// Notes:
//
// Each time seedrandom('arg') is called, entropy from the passed seed
// is accumulated in a pool to help generate future seeds for the
// zero-argument form of Math.seedrandom, so entropy can be injected over
// time by calling seedrandom with explicit data repeatedly.
//
// On speed - This javascript implementation of Math.random() is about
// 3-10x slower than the built-in Math.random() because it is not native
// code, but this is typically fast enough anyway.  Seeding is more expensive,
// especially if you use auto-seeding.  Some details (timings on Chrome 4):
//
// Our Math.random()            - avg less than 0.002 milliseconds per call
// seedrandom('explicit')       - avg less than 0.5 milliseconds per call
// seedrandom('explicit', true) - avg less than 2 milliseconds per call
// seedrandom()                 - avg about 38 milliseconds per call
//
// LICENSE (BSD):
//
// Copyright 2010 David Bau, all rights reserved.
//
// Redistribution and use in source and binary forms, with or without
// modification, are permitted provided that the following conditions are met:
// 
//   1. Redistributions of source code must retain the above copyright
//      notice, this list of conditions and the following disclaimer.
//
//   2. Redistributions in binary form must reproduce the above copyright
//      notice, this list of conditions and the following disclaimer in the
//      documentation and/or other materials provided with the distribution.
// 
//   3. Neither the name of this module nor the names of its contributors may
//      be used to endorse or promote products derived from this software
//      without specific prior written permission.
// 
// THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS
// "AS IS" AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT
// LIMITED TO, THE IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR
// A PARTICULAR PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT
// OWNER OR CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL,
// SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT
// LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE,
// DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY
// THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT
// (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE
// OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
//
/**
 * All code is in an anonymous closure to keep the global namespace clean.
 *
 * @param {number=} overflow 
 * @param {number=} startdenom
 */
(function (pool, math, width, chunks, significance, overflow, startdenom) {


//
// seedrandom()
// This is the seedrandom function described above.
//
math['seedrandom'] = function seedrandom(seed, use_entropy) {
  var key = [];
  var arc4;

  // Flatten the seed string or build one from local entropy if needed.
  seed = mixkey(flatten(
    use_entropy ? [seed, pool] :
    arguments.length ? seed :
    [new Date().getTime(), pool, window], 3), key);

  // Use the seed to initialize an ARC4 generator.
  arc4 = new ARC4(key);

  // Mix the randomness into accumulated entropy.
  mixkey(arc4.S, pool);

  // Override Math.random

  // This function returns a random double in [0, 1) that contains
  // randomness in every bit of the mantissa of the IEEE 754 value.

  math['random'] = function random() {  // Closure to return a random double:
    var n = arc4.g(chunks);             // Start with a numerator n < 2 ^ 48
    var d = startdenom;                 //   and denominator d = 2 ^ 48.
    var x = 0;                          //   and no 'extra last byte'.
    while (n < significance) {          // Fill up all significant digits by
      n = (n + x) * width;              //   shifting numerator and
      d *= width;                       //   denominator and generating a
      x = arc4.g(1);                    //   new least-significant-byte.
    }
    while (n >= overflow) {             // To avoid rounding up, before adding
      n /= 2;                           //   last byte, shift everything
      d /= 2;                           //   right using integer math until
      x >>>= 1;                         //   we have exactly the desired bits.
    }
    return (n + x) / d;                 // Form the number within [0, 1).
  };

  // Return the seed that was used
  return seed;
};

//
// ARC4
//
// An ARC4 implementation.  The constructor takes a key in the form of
// an array of at most (width) integers that should be 0 <= x < (width).
//
// The g(count) method returns a pseudorandom integer that concatenates
// the next (count) outputs from ARC4.  Its return value is a number x
// that is in the range 0 <= x < (width ^ count).
//
/** @constructor */
function ARC4(key) {
  var t, u, me = this, keylen = key.length;
  var i = 0, j = me.i = me.j = me.m = 0;
  me.S = [];
  me.c = [];

  // The empty key [] is treated as [0].
  if (!keylen) { key = [keylen++]; }

  // Set up S using the standard key scheduling algorithm.
  while (i < width) { me.S[i] = i++; }
  for (i = 0; i < width; i++) {
    t = me.S[i];
    j = lowbits(j + t + key[i % keylen]);
    u = me.S[j];
    me.S[i] = u;
    me.S[j] = t;
  }

  // The "g" method returns the next (count) outputs as one number.
  me.g = function getnext(count) {
    var s = me.S;
    var i = lowbits(me.i + 1); var t = s[i];
    var j = lowbits(me.j + t); var u = s[j];
    s[i] = u;
    s[j] = t;
    var r = s[lowbits(t + u)];
    while (--count) {
      i = lowbits(i + 1); t = s[i];
      j = lowbits(j + t); u = s[j];
      s[i] = u;
      s[j] = t;
      r = r * width + s[lowbits(t + u)];
    }
    me.i = i;
    me.j = j;
    return r;
  };
  // For robust unpredictability discard an initial batch of values.
  // See http://www.rsa.com/rsalabs/node.asp?id=2009
  me.g(width);
}

//
// flatten()
// Converts an object tree to nested arrays of strings.
//
/** @param {Object=} result 
  * @param {string=} prop
  * @param {string=} typ */
function flatten(obj, depth, result, prop, typ) {
  result = [];
  typ = typeof(obj);
  if (depth && typ == 'object') {
    for (prop in obj) {
      if (prop.indexOf('S') < 5) {    // Avoid FF3 bug (local/sessionStorage)
        try { result.push(flatten(obj[prop], depth - 1)); } catch (e) {}
      }
    }
  }
  return (result.length ? result : obj + (typ != 'string' ? '\0' : ''));
}

//
// mixkey()
// Mixes a string seed into a key that is an array of integers, and
// returns a shortened string seed that is equivalent to the result key.
//
/** @param {number=} smear 
  * @param {number=} j */
function mixkey(seed, key, smear, j) {
  seed += '';                         // Ensure the seed is a string
  smear = 0;
  for (j = 0; j < seed.length; j++) {
    key[lowbits(j)] =
      lowbits((smear ^= key[lowbits(j)] * 19) + seed.charCodeAt(j));
  }
  seed = '';
  for (j in key) { seed += String.fromCharCode(key[j]); }
  return seed;
}

//
// lowbits()
// A quick "n mod width" for width a power of 2.
//
function lowbits(n) { return n & (width - 1); }

//
// The following constants are related to IEEE 754 limits.
//
startdenom = math.pow(width, chunks);
significance = math.pow(2, significance);
overflow = significance * 2;

//
// When seedrandom.js is loaded, we immediately mix a few bits
// from the built-in RNG into the entropy pool.  Because we do
// not want to intefere with determinstic PRNG state later,
// seedrandom will not call math.random on its own again after
// initialization.
//
mixkey(math.random(), pool);

// End anonymous scope, and pass initial values.
})(
  [],   // pool: entropy pool starts empty
  Math, // math: package containing random, pow, and seedrandom
  256,  // width: each RC4 output is 0 <= x < 256
  6,    // chunks: at least six RC4 outputs for each double
  52    // significance: there are 52 significant digits in a double
);/*!
 * jQuery Cookie Plugin
 * https://github.com/carhartl/jquery-cookie
 *
 * Copyright 2011, Klaus Hartl
 * Dual licensed under the MIT or GPL Version 2 licenses.
 * http://www.opensource.org/licenses/mit-license.php
 * http://www.opensource.org/licenses/GPL-2.0
 */
(function($) {
    $.cookie = function(key, value, options) {

        // key and at least value given, set cookie...
        if (arguments.length > 1 && (!/Object/.test(Object.prototype.toString.call(value)) || value === null || value === undefined)) {
            options = $.extend({}, options);

            if (value === null || value === undefined) {
                options.expires = -1;
            }

            if (typeof options.expires === 'number') {
                var days = options.expires, t = options.expires = new Date();
                t.setDate(t.getDate() + days);
            }

            value = String(value);

            return (document.cookie = [
                encodeURIComponent(key), '=', options.raw ? value : encodeURIComponent(value),
                options.expires ? '; expires=' + options.expires.toUTCString() : '', // use expires attribute, max-age is not supported by IE
                options.path    ? '; path=' + options.path : '',
                options.domain  ? '; domain=' + options.domain : '',
                options.secure  ? '; secure' : ''
            ].join(''));
        }

        // key and possibly options given, get cookie...
        options = value || {};
        var decode = options.raw ? function(s) { return s; } : decodeURIComponent;

        var pairs = document.cookie.split('; ');
        for (var i = 0, pair; pair = pairs[i] && pairs[i].split('='); i++) {
            if (decode(pair[0]) === key) return decode(pair[1] || ''); // IE saves cookies with empty string as "c; ", e.g. without "=" as opposed to EOMB, thus pair[1] may be undefined
        }
        return null;
    };
})(jQuery);/*! Copyright (c) 2011 Brandon Aaron (http://brandonaaron.net)
 * Licensed under the MIT License (LICENSE.txt).
 *
 * Thanks to: http://adomas.org/javascript-mouse-wheel/ for some pointers.
 * Thanks to: Mathias Bank(http://www.mathias-bank.de) for a scope bug fix.
 * Thanks to: Seamus Leahy for adding deltaX and deltaY
 *
 * Version: 3.0.6
 * 
 * Requires: 1.2.2+
 */

(function($) {

var types = ['DOMMouseScroll', 'mousewheel'];

if ($.event.fixHooks) {
    for ( var i=types.length; i; ) {
        $.event.fixHooks[ types[--i] ] = $.event.mouseHooks;
    }
}

$.event.special.mousewheel = {
    setup: function() {
        if ( this.addEventListener ) {
            for ( var i=types.length; i; ) {
                this.addEventListener( types[--i], handler, false );
            }
        } else {
            this.onmousewheel = handler;
        }
    },
    
    teardown: function() {
        if ( this.removeEventListener ) {
            for ( var i=types.length; i; ) {
                this.removeEventListener( types[--i], handler, false );
            }
        } else {
            this.onmousewheel = null;
        }
    }
};

$.fn.extend({
    mousewheel: function(fn) {
        return fn ? this.bind("mousewheel", fn) : this.trigger("mousewheel");
    },
    
    unmousewheel: function(fn) {
        return this.unbind("mousewheel", fn);
    }
});


function handler(event) {
    var orgEvent = event || window.event, args = [].slice.call( arguments, 1 ), delta = 0, returnValue = true, deltaX = 0, deltaY = 0;
    event = $.event.fix(orgEvent);
    event.type = "mousewheel";
    
    // Old school scrollwheel delta
    if ( orgEvent.wheelDelta ) { delta = orgEvent.wheelDelta/120; }
    if ( orgEvent.detail     ) { delta = -orgEvent.detail/3; }
    
    // New school multidimensional scroll (touchpads) deltas
    deltaY = delta;
    
    // Gecko
    if ( orgEvent.axis !== undefined && orgEvent.axis === orgEvent.HORIZONTAL_AXIS ) {
        deltaY = 0;
        deltaX = -1*delta;
    }
    
    // Webkit
    if ( orgEvent.wheelDeltaY !== undefined ) { deltaY = orgEvent.wheelDeltaY/120; }
    if ( orgEvent.wheelDeltaX !== undefined ) { deltaX = -1*orgEvent.wheelDeltaX/120; }
    
    // Add event and delta to the front of the arguments
    args.unshift(event, delta, deltaX, deltaY);
    
    return ($.event.dispatch || $.event.handle).apply(this, args);
}

})(jQuery);/*! Copyright (c) 2011 Piotr Rochala (http://rocha.la)
 * Dual licensed under the MIT (http://www.opensource.org/licenses/mit-license.php)
 * and GPL (http://www.opensource.org/licenses/gpl-license.php) licenses.
 *
 * Version: 0.5.0
 * 
 */
(function($) {

  jQuery.fn.extend({
    slimScroll: function(options) {

      var defaults = {
        wheelStep : 20,
        width : 'auto',
        height : '250px',
        size : '7px',
        color: '#000',
        position : 'right',
        distance : '1px',
        start : 'top',
        opacity : .4,
        alwaysVisible : false,
        railVisible : false,
        railColor : '#333',
        railOpacity : '0.2',
        railClass : 'slimScrollRail',
        barClass : 'slimScrollBar',
        wrapperClass : 'slimScrollDiv',
        allowPageScroll: false,
        scroll: 0
      };

      var o = ops = $.extend( defaults , options );

      // do it for every element that matches selector
      this.each(function(){

      var isOverPanel, isOverBar, isDragg, queueHide, barHeight, percentScroll,
        divS = '<div></div>',
        minBarHeight = 30,
        releaseScroll = false,
        wheelStep = parseInt(o.wheelStep),
        cwidth = o.width,
        cheight = o.height,
        size = o.size,
        color = o.color,
        position = o.position,
        distance = o.distance,
        start = o.start,
        opacity = o.opacity,
        alwaysVisible = o.alwaysVisible,
        railVisible = o.railVisible,
        railColor = o.railColor,
        railOpacity = o.railOpacity,
        allowPageScroll = o.allowPageScroll,
        scroll = o.scroll;
      
        // used in event handlers and for better minification
        var me = $(this);

        //ensure we are not binding it again
        if (me.parent().hasClass('slimScrollDiv'))
        {
            //check if we should scroll existing instance
            if (scroll)
            {
                //find bar and rail
                bar = me.parent().find('.slimScrollBar');
                rail = me.parent().find('.slimScrollRail');

                //scroll by given amount of pixels
                scrollContent( me.scrollTop() + parseInt(scroll), false, true);
            }

            return;
        }

        // wrap content
        var wrapper = $(divS)
          .addClass( o.wrapperClass )
          .css({
            position: 'relative',
            overflow: 'hidden',
            width: cwidth,
            height: cheight
          });

        // update style for the div
        me.css({
          overflow: 'hidden',
          width: cwidth,
          height: cheight
        });

        // create scrollbar rail
        var rail  = $(divS)
          .addClass( o.railClass )
          .css({
            width: size,
            height: '100%',
            position: 'absolute',
            top: 0,
            display: (alwaysVisible && railVisible) ? 'block' : 'none',
            'border-radius': size,
            background: railColor,
            opacity: railOpacity,
            zIndex: 90
          });

        // create scrollbar
        var bar = $(divS)
          .addClass( o.barClass )
          .css({
            background: color,
            width: size,
            position: 'absolute',
            top: 0,
            opacity: opacity,
            display: alwaysVisible ? 'block' : 'none',
            'border-radius' : size,
            BorderRadius: size,
            MozBorderRadius: size,
            WebkitBorderRadius: size,
            zIndex: 99
          });

        // set position
        var posCss = (position == 'right') ? { right: distance } : { left: distance };
        rail.css(posCss);
        bar.css(posCss);

        // wrap it
        me.wrap(wrapper);

        // append to parent div
        me.parent().append(bar);
        me.parent().append(rail);

        // make it draggable
        bar.draggable({ 
          axis: 'y', 
          containment: 'parent',
          start: function() { isDragg = true; },
          stop: function() { isDragg = false; hideBar(); },
          drag: function(e) 
          { 
            // scroll content
            scrollContent(0, $(this).position().top, false);
          }
        });

        // on rail over
        rail.hover(function(){
          showBar();
        }, function(){
          hideBar();
        });

        // on bar over
        bar.hover(function(){
          isOverBar = true;
        }, function(){
          isOverBar = false;
        });

        // show on parent mouseover
        me.hover(function(){
          isOverPanel = true;
          showBar();
          hideBar();
        }, function(){
          isOverPanel = false;
          hideBar();
        });

        var _onWheel = function(e)
        {
          // use mouse wheel only when mouse is over
          if (!isOverPanel) { return; }

          var e = e || window.event;

          var delta = 0;
          if (e.wheelDelta) { delta = -e.wheelDelta/120; }
          if (e.detail) { delta = e.detail / 3; }

          // scroll content
          scrollContent(delta, true);

          // stop window scroll
          if (e.preventDefault && !releaseScroll) { e.preventDefault(); }
          if (!releaseScroll) { e.returnValue = false; }
        }

        function scrollContent(y, isWheel, isJump)
        {
          var delta = y;

          if (isWheel)
          {
            // move bar with mouse wheel
            delta = parseInt(bar.css('top')) + y * wheelStep / 100 * bar.outerHeight();

            // move bar, make sure it doesn't go out
            var maxTop = me.outerHeight() - bar.outerHeight();
            delta = Math.min(Math.max(delta, 0), maxTop);

            // scroll the scrollbar
            bar.css({ top: delta + 'px' });
          }

          // calculate actual scroll amount
          percentScroll = parseInt(bar.css('top')) / (me.outerHeight() - bar.outerHeight());
          delta = percentScroll * (me[0].scrollHeight - me.outerHeight());

          if (isJump)
          {
            delta = y;
            var offsetTop = delta / me[0].scrollHeight * me.outerHeight();
            bar.css({ top: offsetTop + 'px' });
          }

          // scroll content
          me.scrollTop(delta);

          // ensure bar is visible
          showBar();

          // trigger hide when scroll is stopped
          hideBar();
        }

        var attachWheel = function()
        {
          if (window.addEventListener)
          {
            this.addEventListener('DOMMouseScroll', _onWheel, false );
            this.addEventListener('mousewheel', _onWheel, false );
          } 
          else
          {
            document.attachEvent("onmousewheel", _onWheel)
          }
        }

        // attach scroll events
        attachWheel();

        function getBarHeight()
        {
          // calculate scrollbar height and make sure it is not too small
          barHeight = Math.max((me.outerHeight() / me[0].scrollHeight) * me.outerHeight(), minBarHeight);
          bar.css({ height: barHeight + 'px' });
        }

        // set up initial height
        getBarHeight();

        function showBar()
        {
          // recalculate bar height
          getBarHeight();
          clearTimeout(queueHide);

          // release wheel when bar reached top or bottom
          releaseScroll = allowPageScroll && percentScroll == ~~ percentScroll;

          // show only when required
          if(barHeight >= me.outerHeight()) {
            //allow window scroll
            releaseScroll = true;
            return;
          }
          bar.stop(true,true).fadeIn('fast');
          if (railVisible) { rail.stop(true,true).fadeIn('fast'); }
        }

        function hideBar()
        {
          // only hide when options allow it
          if (!alwaysVisible)
          {
            queueHide = setTimeout(function(){
              if (!isOverBar && !isDragg) 
              { 
                bar.fadeOut('slow');
                rail.fadeOut('slow');
              }
            }, 1000);
          }
        }

        // check start position
        if (start == 'bottom') 
        {
          // scroll content to bottom
          bar.css({ top: me.outerHeight() - bar.outerHeight() });
          scrollContent(0, true);
        }
        else if (typeof start == 'object')
        {
          // scroll content
          scrollContent($(start).position().top, null, true);

          // make sure bar stays hidden
          if (!alwaysVisible) { bar.hide(); }
        }
      });
      
      // maintain chainability
      return this;
    }
  });

  jQuery.fn.extend({
    slimscroll: jQuery.fn.slimScroll
  });

})(jQuery);var isOpera = !!(window.opera && window.opera.version);  // Opera 8.0+
var isFirefox = testCSS('MozBoxSizing');                 // FF 0.8+
var isSafari = Object.prototype.toString.call(window.HTMLElement).indexOf('Constructor') > 0;
    // At least Safari 3+: "[object HTMLElementConstructor]"
var isChrome = !isSafari && testCSS('WebkitTransform');  // Chrome 1+
var isIE = /*@cc_on!@*/false || testCSS('msTransform');  // At least IE6

function testCSS(prop) {
    return prop in document.documentElement.style;
}
;

var browserSpecificTweaks;

browserSpecificTweaks = function() {
  if (isSafari) {
    return $('#graph-view').css('overflow', 'hidden');
  }
};/*
Collection of linear algebra functions for vectors with 3 elements and 4x4 matrices.
Useful for 3D calculations.
*/

var m4x4mulv3, newv3, tmpVec, v3diffLength, v3dotv3, v3length;

tmpVec = new Array(3);

newv3 = function() {
  return new Array(3);
};

/*
Caluculates the dot product of a and b,
where a and b are vectors with 3 elements.
*/


v3dotv3 = function(a, b) {
  return (a[0] * b[0]) + (a[1] * b[1]) + (a[2] * b[2]);
};

v3length = function(v) {
  return Math.sqrt(v[0] * v[0] + v[1] * v[1] + v[2] * v[2]);
};

v3diffLength = function(v1, v2) {
  var v;
  v = newv3();
  v[0] = v2[0] - v1[0];
  v[1] = v2[1] - v1[1];
  v[2] = v2[2] - v1[2];
  return v3length(v);
};

/*
r = m * v

m: 4x4 matrix
v: vector with 3 elements
r: vetor with 3 elements to store results
*/


m4x4mulv3 = function(m, v, r) {
  var w;
  tmpVec[0] = m[3];
  tmpVec[1] = m[7];
  tmpVec[2] = m[11];
  w = v3dotv3(v, tmpVec) + m[15];
  tmpVec[0] = m[0];
  tmpVec[1] = m[4];
  tmpVec[2] = m[8];
  r[0] = (v3dotv3(v, tmpVec) + m[12]) / w;
  tmpVec[0] = m[1];
  tmpVec[1] = m[5];
  tmpVec[2] = m[9];
  r[1] = (v3dotv3(v, tmpVec) + m[13]) / w;
  tmpVec[0] = m[2];
  tmpVec[1] = m[6];
  tmpVec[2] = m[10];
  return r[2] = (v3dotv3(v, tmpVec) + m[14]) / w;
};
/*
This class implements certain aspects of quaternion arithmetic
necessary to perfrom 3D rotations without gimbal lock.
More info: http://en.wikipedia.org/wiki/Quaternions_and_spatial_rotation
*/

var Quaternion;

Quaternion = (function() {

  function Quaternion() {
    this.x = 0;
    this.y = 0;
    this.z = 0;
    this.w = 1;
  }

  Quaternion.prototype.fromEuler = function(pitch, yaw, roll) {
    var cosp, cosr, cosy, sinp, sinr, siny;
    sinp = Math.sin(pitch);
    siny = Math.sin(yaw);
    sinr = Math.sin(roll);
    cosp = Math.cos(pitch);
    cosy = Math.cos(yaw);
    cosr = Math.cos(roll);
    this.x = sinr * cosp * cosy - cosr * sinp * siny;
    this.y = cosr * sinp * cosy + sinr * cosp * siny;
    this.z = cosr * cosp * siny - sinr * sinp * cosy;
    this.w = cosr * cosp * cosy + sinr * sinp * siny;
    return this.normalise();
  };

  /*
      Normalise the quaternion so that it's length is 1
      Does not do anything if current length is within a certain tolerance
  */


  Quaternion.prototype.normalise = function() {
    var TOLERANCE, l;
    TOLERANCE = 0.00001;
    l = (this.x * this.x) + (this.y * this.y) + (this.z * this.z) + (this.w * this.w);
    if (Math.abs(l - 1) > TOLERANCE) {
      l = Math.sqrt(l);
      this.x /= l;
      this.y /= l;
      this.z /= l;
      return this.w /= l;
    }
  };

  /*
      Multiply quaternion q by this and store result in this
      (this = q * this)
      Purpose:
      Changes rotation represented by this by rotation represented by q
  */


  Quaternion.prototype.mul = function(q) {
    var _w, _x, _y, _z;
    _x = (this.w * q.x) + (this.x * q.w) + (this.y * q.z) - (this.z * q.y);
    _y = (this.w * q.y) - (this.x * q.z) + (this.y * q.w) + (this.z * q.x);
    _z = (this.w * q.z) + (this.x * q.y) - (this.y * q.x) + (this.z * q.w);
    _w = (this.w * q.w) - (this.x * q.x) - (this.y * q.y) - (this.z * q.z);
    this.x = _x;
    this.y = _y;
    this.z = _z;
    return this.w = _w;
  };

  /*
      Creates affine transformation matrix for the rotation represented by
      this quaternion.
      Matrix is written to the array with length 16 that must be provided as parameter.
      (for eficiency, avoid unnecesssary creation and destruction of arrays)
  */


  Quaternion.prototype.getMatrix = function(m) {
    var wx, wy, wz, x2, xy, xz, y2, yz, z2;
    x2 = this.x * this.x;
    y2 = this.y * this.y;
    z2 = this.z * this.z;
    xy = this.x * this.y;
    xz = this.x * this.z;
    yz = this.y * this.z;
    wx = this.w * this.x;
    wy = this.w * this.y;
    wz = this.w * this.z;
    m[0] = 1 - (2 * (y2 + z2));
    m[1] = 2 * (xy - wz);
    m[2] = 2 * (xz + wy);
    m[3] = 0;
    m[4] = 2 * (xy + wz);
    m[5] = 1 - (2 * (x2 + z2));
    m[6] = 2 * (yz - wx);
    m[7] = 0;
    m[8] = 2 * (xz - wy);
    m[9] = 2 * (yz + wx);
    m[10] = 1 - (2 * (x2 + y2));
    m[11] = 0;
    m[12] = 0;
    m[13] = 0;
    m[14] = 0;
    return m[15] = 1;
  };

  return Quaternion;

})();
var hideAlert, initAlert, setErrorAlert, setInfoAlert;

initAlert = function() {
  return $('#alert').css('display', 'none');
};

$('#alert').css('visibility', 'visible');

setInfoAlert = function(msg) {
  $('#alert').css('display', 'block');
  $('#alert').removeClass('alert-error');
  $('#alert').addClass('alert-info');
  return $('#alertMsg').html(msg);
};

setErrorAlert = function(msg) {
  $('#alert').css('display', 'block');
  $('#alert').removeClass('alert-info');
  $('#alert').addClass('alert-error');
  return $('#alertMsg').html(msg);
};

hideAlert = function() {
  return $('#alert').css('display', 'none');
};
var AnimInitRotation, AnimLookAt, AnimNodeGlow, Animation, addAnim, animCycle, anims, intervalID, stopAnims,
  __hasProp = {}.hasOwnProperty,
  __extends = function(child, parent) { for (var key in parent) { if (__hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; };

intervalID = false;

anims = [];

addAnim = function(anim) {
  if (anim.name === 'lookat') {
    anims = anims.filter(function(anim) {
      return (anim.name !== 'initrotation') && (anim.name !== 'lookat');
    });
  }
  if (anims.length === 0) {
    intervalID = window.setInterval(animCycle, 30);
  }
  return anims.push(anim);
};

animCycle = function() {
  var a, _i, _len;
  for (_i = 0, _len = anims.length; _i < _len; _i++) {
    a = anims[_i];
    a.runCycle();
  }
  anims = anims.filter(function(anim) {
    return anim.active;
  });
  if (anims.length === 0) {
    window.clearInterval(intervalID);
    return intervalID = false;
  }
};

stopAnims = function() {
  anims = anims.filter(function(anim) {
    return !anim.stoppable;
  });
  if (anims.length === 0) {
    window.clearInterval(intervalID);
    return intervalID = false;
  }
};

Animation = (function() {

  function Animation() {
    this.name = '';
    this.active = true;
    this.stoppable = false;
  }

  Animation.prototype.runCycle = function() {
    return this.active = this.cycle();
  };

  return Animation;

})();

AnimInitRotation = (function(_super) {

  __extends(AnimInitRotation, _super);

  function AnimInitRotation() {
    this.name = 'initrotation';
    this.stoppable = true;
    this.animSpeedX = 0.007;
    this.animSpeedY = 0.005;
  }

  AnimInitRotation.prototype.cycle = function() {
    g.rotateX(-this.animSpeedX);
    g.rotateY(this.animSpeedY);
    g.updateView();
    this.animSpeedX *= 0.98;
    this.animSpeedY *= 0.98;
    if (this.animSpeedX < 0.0001) {
      return false;
    } else {
      return true;
    }
  };

  return AnimInitRotation;

})(Animation);

AnimLookAt = (function(_super) {

  __extends(AnimLookAt, _super);

  function AnimLookAt(targetSNode) {
    AnimLookAt.__super__.constructor.call(this);
    this.name = 'lookat';
    this.stoppable = true;
    this.targetSNode = targetSNode;
  }

  AnimLookAt.prototype.cycle = function() {
    var precision, speedFactor, speedX, speedY;
    speedFactor = 0.05;
    precision = 0.01;
    speedX = this.targetSNode.angleX * speedFactor;
    speedY = this.targetSNode.angleY * speedFactor;
    g.rotateX(speedY);
    g.rotateY(-speedX);
    g.updateView();
    if ((Math.abs(this.targetSNode.angleX) < precision) && (Math.abs(this.targetSNode.angleY) < precision)) {
      return false;
    } else {
      return true;
    }
  };

  return AnimLookAt;

})(Animation);

AnimNodeGlow = (function(_super) {

  __extends(AnimNodeGlow, _super);

  function AnimNodeGlow(node) {
    AnimNodeGlow.__super__.constructor.call(this);
    this.name = 'nodeglow';
    this.node = node;
    this.x = 0;
    this.cycles = 0.0;
    this.delta = 0.05;
    this.r1 = 224.0;
    this.g1 = 224.0;
    this.b1 = 224.0;
    this.r2 = 189.0;
    this.g2 = 218.0;
    this.b2 = 249.0;
  }

  AnimNodeGlow.prototype.cycle = function() {
    var b, g, r, rgb;
    this.x += this.delta;
    if (this.x > 1) {
      this.x = 1;
      this.delta = -this.delta;
    }
    if (this.x < 0) {
      this.x = 0;
      this.delta = -this.delta;
      this.cycles += 1;
    }
    r = Math.round(this.r1 + ((this.r2 - this.r1) * this.x));
    g = Math.round(this.g1 + ((this.g2 - this.g1) * this.x));
    b = Math.round(this.b1 + ((this.b2 - this.b1) * this.x));
    rgb = 'rgb(' + r + ',' + g + ',' + b + ')';
    $('#' + this.node.divid).css({
      background: rgb
    });
    if (this.cycles > 3) {
      return false;
    } else {
      return true;
    }
  };

  return AnimNodeGlow;

})(Animation);
var dragging, fullBind, initInterface, lastScale, lastX, lastY, mouseDown, mouseMove, mouseUp, mouseWheel, scroll, scrollOff, scrollOn, touchEnd, touchMove, touchStart;

dragging = false;

lastX = 0;

lastY = 0;

lastScale = -1;

scroll = false;

scrollOn = function(e) {
  return scroll = true;
};

scrollOff = function(e) {
  return scroll = false;
};

mouseUp = function(e) {
  dragging = false;
  return false;
};

mouseDown = function(e) {
  dragging = true;
  lastX = e.pageX;
  lastY = e.pageY;
  stopAnims();
  return false;
};

mouseMove = function(e) {
  var deltaX, deltaY;
  if (dragging) {
    deltaX = e.pageX - lastX;
    deltaY = e.pageY - lastY;
    lastX = e.pageX;
    lastY = e.pageY;
    g.rotateX(-deltaX * 0.0015);
    g.rotateY(deltaY * 0.0015);
    g.updateView();
  }
  return false;
};

touchStart = function(e) {
  var touch;
  stopAnims();
  if (e.touches.length === 1) {
    touch = e.touches[0];
    lastX = touch.pageX;
    lastY = touch.pageY;
  }
  return true;
};

touchEnd = function(e) {
  lastScale = -1;
  return true;
};

touchMove = function(e) {
  var deltaScale, deltaX, deltaY, dx, dy, scale, touch, x, y;
  if (e.touches.length === 1) {
    e.preventDefault();
    touch = e.touches[0];
    deltaX = touch.pageX - lastX;
    deltaY = touch.pageY - lastY;
    lastX = touch.pageX;
    lastY = touch.pageY;
    g.rotateX(-deltaX * 0.0015);
    g.rotateY(deltaY * 0.0015);
    g.updateView();
    false;
  } else if (e.touches.length === 2) {
    e.preventDefault();
    dx = e.touches[0].pageX - e.touches[1].pageX;
    dy = e.touches[0].pageY - e.touches[1].pageY;
    scale = Math.sqrt(dx * dx + dy * dy);
    if (lastScale >= 0) {
      x = (e.touches[0].pageX + e.touches[1].pageX) / 2;
      y = (e.touches[0].pageY + e.touches[1].pageY) / 2;
      deltaScale = (scale - lastScale) * 0.025;
      g.zoom(deltaScale, x, y);
    }
    lastScale = scale;
    false;
  }
  return true;
};

mouseWheel = function(e, delta, deltaX, deltaY) {
  if (!scroll) {
    g.zoom(deltaY, e.pageX, e.pageY);
  }
  return true;
};

fullBind = function(eventName, f) {
  $("#graph-view").bind(eventName, f);
  $(".snode1").bind(eventName, f);
  $(".snodeN").bind(eventName, f);
  return $(".link").bind(eventName, f);
};

initInterface = function() {
  $('#search-field').submit(searchQuery);
  initSearchDialog();
  initSignUpDialog();
  $('.signupLink').bind('click', showSignUpDialog);
  $('#loginLink').bind('click', showSignUpDialog);
  $('#logoutLink').bind('click', logout);
  fullBind("mouseup", mouseUp);
  fullBind("mousedown", mouseDown);
  fullBind("mousemove", mouseMove);
  fullBind("mousewheel", mouseWheel);
  document.addEventListener('touchstart', touchStart);
  document.addEventListener('touchend', touchEnd);
  document.addEventListener('touchmove', touchMove);
  initAlert();
  if (typeof data !== "undefined" && data !== null) {
    initAiChat();
    initRemoveDialog();
    initDisambiguateDialog();
    $('#ai-chat-button').bind('click', aiChatButtonPressed);
  }
  if (typeof errorMsg !== "undefined" && errorMsg !== null) {
    if (errorMsg !== '') {
      return setErrorAlert(errorMsg);
    }
  }
};
var Node, nodeCount;

nodeCount = 0;

function getHostname(url) {
    var m = ((url||'')+'').match(/^http:\/\/([^/]+)/);
    return m ? m[1] : null;
};


Node = (function() {

  function Node(id, text, text2, type, snode, edge, url, icon, glow) {
    this.id = id;
    this.text = text;
    this.text2 = text2;
    this.type = type;
    this.snode = snode;
    this.edge = edge;
    this.url = url != null ? url : '';
    this.icon = icon != null ? icon : '';
    this.glow = glow != null ? glow : false;
    this.divid = 'n' + nodeCount++;
    this.root = false;
  }

  Node.prototype.place = function() {
    var html, nodeData, nodeTitleClass, nodeUrlClass, removeData, removeLinkId;
    if (this.root) {
      $('#' + this.snode.id + ' .viewport').append('<div id="' + this.divid + '" class="node_root" />');
    } else {
      $('#' + this.snode.id + ' .viewport').append('<div id="' + this.divid + '" class="node" />');
    }
    nodeData = {};
    if (this.snode.relpos === 0) {
      nodeData = {
        'node': this.id,
        'orig': rootNodeId,
        'etype': this.snode.etype,
        'link': this.snode.label,
        'targ': this.id
      };
    } else {
      nodeData = {
        'node': this.id,
        'targ': rootNodeId,
        'etype': this.snode.etype,
        'link': this.snode.label,
        'orig': this.id
      };
    }
    removeLinkId = '';
    nodeTitleClass = 'nodeTitle';
    nodeUrlClass = 'nodeUrl';
    if (this.root) {
      nodeTitleClass = 'nodeTitle_root';
      nodeUrlClass = 'nodeUrl_root';
    }
    if (this.type === 'url') {
      html = '<div class="' + nodeTitleClass + '" id="t' + this.divid + '"><a href="/node/' + this.id + '" id="' + this.divid + '">' + this.text + '</a></div><br />';
      if (this.icon !== '') {
        html += '<img src="' + this.icon + '" width="16px" height="16px" class="nodeIco" />';
      }
      html += '<div class="' + nodeUrlClass + '"><a href="' + this.url + '" id="url' + this.divid + '">' + this.url + '</a></div>';
      if (!this.root) {
        removeLinkId = 'rem' + this.divid;
        html += '<div class="nodeRemove"><a id="' + removeLinkId + '" href="#">x</a></div>';
      }
      html += '<div style="clear:both;"></div>';
      $('#' + this.divid).append(html);
    } else {
      html = '<div class="' + nodeTitleClass + '" id="t' + this.divid + '"><a href="/node/' + this.id + '" id="' + this.divid + '">' + this.text + '</a></div>';
      if (this.text2 != null) {
        html += '<div class="nodeSubText">(' + this.text2 + ')</div>';
      }
      if (!this.root) {
        removeLinkId = 'rem' + this.divid;
        html += '<div class="nodeRemove"><a id="' + removeLinkId + '" href="#">x</a></div>';
      }
      html += '<div style="clear:both;"></div>';
      $('#' + this.divid).append(html);
    }
    if (removeLinkId !== '') {
      removeData = {
        'node': this,
        'link': this.snode.label,
        'edge': this.edge
      };
      $('#' + removeLinkId).click(removeData, removeClicked);
    }
    if (this.glow) {
      return addAnim(new AnimNodeGlow(this));
    }
  };

  return Node;

})();
var SphericalCoords;

SphericalCoords = (function() {

  function SphericalCoords(negativeStretch, mappingPower) {
    this.negativeStretch = negativeStretch;
    this.mappingPower = mappingPower;
    this.theta = 0;
    this.phi = 0;
    this.r = 0;
    this.x = 0;
    this.y = 0;
    this.z = 0;
  }

  SphericalCoords.prototype.sphericalToCartesian = function() {
    var phi, theta;
    if (this.r === 0) {
      this.x = 0;
      this.y = 0;
      return this.z = 0;
    } else {
      theta = this.theta + (Math.PI / 2);
      phi = this.phi + (Math.PI / 2);
      this.x = this.r * Math.cos(theta) * Math.sin(phi);
      this.y = this.r * Math.cos(phi);
      this.z = this.r * Math.sin(theta) * Math.sin(phi);
      if (this.z < 0) {
        return this.z *= this.negativeStretch;
      }
    }
  };

  SphericalCoords.prototype.cartesianToSpherical = function() {
    this.r = Math.sqrt(this.x * this.x + this.y * this.y + this.z * this.z);
    this.theta = Math.atan2(this.z, this.x) - (Math.PI / 2);
    if (this.theta < -Math.PI) {
      this.theta += 2 * Math.PI;
    }
    return this.phi = Math.acos(this.y / this.r) - (Math.PI / 2);
  };

  SphericalCoords.prototype.scoordMapping = function(ang, maxAng) {
    var d, _maxAng;
    _maxAng = maxAng;
    if (ang < 0) {
      _maxAng = -maxAng;
    }
    d = Math.abs((_maxAng - ang) / maxAng);
    d = Math.abs(Math.pow(d, this.mappingPower));
    d *= _maxAng;
    return _maxAng - d;
  };

  SphericalCoords.prototype.viewMapping = function() {
    this.theta = this.scoordMapping(this.theta, Math.PI);
    return this.phi = this.scoordMapping(this.phi, Math.PI / 2);
  };

  return SphericalCoords;

})();
var SNode;

SNode = (function() {

  function SNode(graph, id, etype, relpos, label, color, isRoot) {
    this.graph = graph;
    this.id = id;
    this.etype = etype;
    this.relpos = relpos;
    this.label = label;
    this.color = color;
    this.isRoot = isRoot;
    this.nodes = {};
    this.width = 0;
    this.height = 0;
    this.halfWidth = 0;
    this.halfHeight = 0;
    this.scale = 1;
    this.jqDiv = false;
    this.pos = newv3();
    this.x = 0;
    this.y = 0;
    this.z = 0;
    this.layedOut = false;
  }

  SNode.prototype.initPosAndLayout = function() {
    this.rpos = Array(3);
    this.auxVec = new Array(3);
    this.f = newv3();
    return this.tpos = newv3();
  };

  SNode.prototype.moveTo = function(x, y, z) {
    var opacity, sc, spread, transformStr;
    this.x = x;
    this.y = y;
    this.z = z;
    this.auxVec[0] = this.x;
    this.auxVec[1] = this.y;
    this.auxVec[2] = this.z;
    m4x4mulv3(this.graph.affinMat, this.auxVec, this.rpos);
    sc = new SphericalCoords(this.graph.negativeStretch, this.graph.mappingPower);
    sc.x = this.rpos[0];
    sc.y = this.rpos[1];
    sc.z = this.rpos[2];
    sc.cartesianToSpherical();
    sc.viewMapping();
    sc.sphericalToCartesian();
    this.rpos[0] = sc.x;
    this.rpos[1] = sc.y;
    this.rpos[2] = sc.z;
    this.angleX = Math.atan2(sc.y, sc.z);
    this.angleY = Math.atan2(sc.x, sc.z);
    spread = 0.7;
    this.rpos[0] = this.rpos[0] * this.graph.halfWidth * spread + this.graph.halfWidth;
    this.rpos[1] += this.rpos[1] * this.graph.halfHeight * spread + this.graph.halfHeight;
    this.rpos[2] += this.rpos[2] * Math.min(this.graph.halfWidth, this.graph.halfHeight) * 0.8;
    x = this.rpos[0];
    y = this.rpos[1];
    z = this.rpos[2] + this.graph.zOffset;
    if (!isNaN(x) && !isNaN(y) && !isNaN(z)) {
      transformStr = 'translate3d(' + (x - this.halfWidth) + 'px,' + (y - this.halfHeight) + 'px,' + z + 'px)';
      transformStr += ' scale(' + this.scale + ')';
      this.jqDiv.css('-webkit-transform', transformStr);
      this.jqDiv.css('-moz-transform', transformStr);
      if (z < 0) {
        opacity = -1 / (z * 0.007);
        return this.jqDiv.css('opacity', opacity);
      } else {
        return this.jqDiv.css('opacity', 1);
      }
    }
  };

  SNode.prototype.applyPos = function() {
    return this.moveTo(this.pos[0], this.pos[1], this.pos[2]);
  };

  SNode.prototype.place = function() {
    var html, key, relText;
    html = '<div id="' + this.id + '" class="snode">';
    if (this.isRoot) {
      html = '<div id="' + this.id + '" class="snodeR">';
    }
    relText = '';
    if (!this.isRoot) {
      relText = this.graph.label(this.label, this.relpos);
    }
    html += '<div class="snodeLabel">' + relText + '</div>';
    html += '<div class="snodeInner">';
    html += '<div class="viewport" /></div></div>';
    $('#graph-view').append(html);
    this.jqDiv = $('#' + this.id);
    for (key in this.nodes) {
      if (this.nodes.hasOwnProperty(key)) {
        this.nodes[key].place();
      }
    }
    if (this.jqDiv.outerHeight() > 250) {
      $('#' + this.id + ' .viewport').slimScroll({
        height: '250px'
      });
      this.jqDiv.hover(scrollOn, scrollOff);
    }
    this.width = this.jqDiv.outerWidth();
    this.height = this.jqDiv.outerHeight();
    this.halfWidth = this.width / 2;
    this.halfHeight = this.height / 2;
    if (this.initialWidth < 0) {
      this.initialWidth = this.width;
    }
    if (!this.isRoot) {
      return this.setColor(this.color);
    }
  };

  SNode.prototype.setColor = function(color) {
    $('#' + this.id).css('border-color', color);
    return $('#' + this.id + ' .snodeLabel').css('background', color);
  };

  SNode.prototype.toString = function() {
    var key;
    for (key in this.nodes) {
      if (this.nodes.hasOwnProperty(key)) {
        return '{' + this.nodes[key].text + ', ...}';
      }
    }
  };

  return SNode;

})();
var frand, getCoulombEnergy, getForces, layout;

frand = function() {
  return Math.random() - 0.5;
};

getCoulombEnergy = function(snodeArray) {
  var N, e, i, j, _i, _j, _ref, _ref1, _ref2;
  e = 0;
  N = snodeArray.length;
  for (i = _i = 0, _ref = N - 1; 0 <= _ref ? _i <= _ref : _i >= _ref; i = 0 <= _ref ? ++_i : --_i) {
    if (i < N - 1) {
      for (j = _j = _ref1 = i + 1, _ref2 = N - 1; _ref1 <= _ref2 ? _j <= _ref2 : _j >= _ref2; j = _ref1 <= _ref2 ? ++_j : --_j) {
        e += 1 / v3diffLength(snodeArray[i].tpos, snodeArray[j].tpos);
      }
    }
  }
  return e;
};

getForces = function(snodeArray) {
  var N, ff, i, j, l, posi, posj, r, _i, _j, _ref, _ref1, _results;
  N = snodeArray.length;
  r = newv3;
  for (i = _i = 0, _ref = N - 1; 0 <= _ref ? _i <= _ref : _i >= _ref; i = 0 <= _ref ? ++_i : --_i) {
    snodeArray[i].f[0] = 0;
    snodeArray[i].f[1] = 0;
    snodeArray[i].f[2] = 0;
  }
  _results = [];
  for (i = _j = 0, _ref1 = N - 1; 0 <= _ref1 ? _j <= _ref1 : _j >= _ref1; i = 0 <= _ref1 ? ++_j : --_j) {
    posi = snodeArray[i].pos;
    if (i < N - 1) {
      _results.push((function() {
        var _k, _ref2, _ref3, _results1;
        _results1 = [];
        for (j = _k = _ref2 = i + 1, _ref3 = N - 1; _ref2 <= _ref3 ? _k <= _ref3 : _k >= _ref3; j = _ref2 <= _ref3 ? ++_k : --_k) {
          posj = snodeArray[j].pos;
          r[0] = posi[0] - posj[0];
          r[1] = posi[1] - posj[1];
          r[2] = posi[2] - posj[2];
          l = v3length(r);
          l = 1 / (l * l * l);
          ff = l * r[0];
          snodeArray[i].f[0] += ff;
          snodeArray[j].f[0] -= ff;
          ff = l * r[1];
          snodeArray[i].f[1] += ff;
          snodeArray[j].f[1] -= ff;
          ff = l * r[2];
          snodeArray[i].f[2] += ff;
          _results1.push(snodeArray[j].f[2] -= ff);
        }
        return _results1;
      })());
    } else {
      _results.push(void 0);
    }
  }
  return _results;
};

layout = function(snodeArray) {
  var N, Nstep, d, e, e0, f, i, k, l, minimalStep, pos, step, tpos, _i, _j, _k, _l, _ref, _ref1, _ref2, _ref3;
  N = snodeArray.length;
  if (N === 0) {
    return;
  }
  Nstep = 20;
  step = 0.01;
  minimalStep = 1e-10;
  for (i = _i = 0, _ref = N - 1; 0 <= _ref ? _i <= _ref : _i >= _ref; i = 0 <= _ref ? ++_i : --_i) {
    if (!snodeArray[i].layedOut) {
      snodeArray[i].pos[0] = 2 * frand();
      snodeArray[i].pos[1] = 2 * frand();
      snodeArray[i].pos[2] = 2 * frand();
    }
    l = v3length(snodeArray[i].pos);
    if (l !== 0.0) {
      if (!snodeArray[i].layedOut) {
        snodeArray[i].pos[0] /= l;
        snodeArray[i].pos[1] /= l;
        snodeArray[i].pos[2] /= l;
      }
      snodeArray[i].tpos[0] = snodeArray[i].pos[0];
      snodeArray[i].tpos[1] = snodeArray[i].pos[1];
      snodeArray[i].tpos[2] = snodeArray[i].pos[2];
    } else {
      i -= 1;
    }
    snodeArray[i].layedOut = true;
  }
  e0 = getCoulombEnergy(snodeArray);
  for (k = _j = 0, _ref1 = Nstep - 1; 0 <= _ref1 ? _j <= _ref1 : _j >= _ref1; k = 0 <= _ref1 ? ++_j : --_j) {
    getForces(snodeArray);
    for (i = _k = 0, _ref2 = N - 1; 0 <= _ref2 ? _k <= _ref2 : _k >= _ref2; i = 0 <= _ref2 ? ++_k : --_k) {
      f = snodeArray[i].f;
      pos = snodeArray[i].pos;
      tpos = snodeArray[i].tpos;
      d = v3dotv3(f, pos);
      f[0] -= pos[0] * d;
      f[1] -= pos[1] * d;
      f[2] -= pos[2] * d;
      tpos[0] = pos[0] + f[0] * step;
      tpos[1] = pos[1] + f[1] * step;
      tpos[2] = pos[2] + f[2] * step;
      l = v3length(tpos);
      tpos[0] /= l;
      tpos[1] /= l;
      tpos[2] /= l;
    }
    e = getCoulombEnergy(snodeArray);
    if (e >= e0) {
      step /= 2;
      if (step < minimalStep) {
        return;
      }
    } else {
      for (i = _l = 0, _ref3 = N - 1; 0 <= _ref3 ? _l <= _ref3 : _l >= _ref3; i = 0 <= _ref3 ? ++_l : --_l) {
        snodeArray[i].pos[0] = snodeArray[i].tpos[0];
        snodeArray[i].pos[1] = snodeArray[i].tpos[1];
        snodeArray[i].pos[2] = snodeArray[i].tpos[2];
      }
      e0 = e;
      step *= 2;
    }
  }
};
var Graph, rootNodeId;

rootNodeId = false;

Graph = (function() {

  function Graph(width, height, newedges) {
    this.width = width;
    this.height = height;
    this.newedges = newedges;
    this.halfWidth = width / 2;
    this.halfHeight = height / 2;
    this.snodes = {};
    this.scale = 1;
    this.offsetX = 0;
    this.offsetY = 0;
    this.zOffset = 0;
    this.quat = new Quaternion();
    this.deltaQuat = new Quaternion();
    this.affinMat = new Array(16);
    this.quat.getMatrix(this.affinMat);
    this.negativeStretch = 1;
    this.mappingPower = 1;
    this.changedSNode = null;
  }

  Graph.initGraph = function(newedges) {
    var graph, nid, node, snode, text, text2, type;
    graph = new Graph($('#graph-view').width(), $('#graph-view').height(), newedges);
    graph.updateTransform();
    snode = new SNode(graph, 'root', '', 0, '', '#000', true);
    graph.snodes['root'] = snode;
    graph.root = snode;
    nid = data['root']['id'];
    rootNodeId = nid;
    text = data['root']['text'];
    text2 = data['root']['text2'];
    type = data['root']['type'];
    if (type === 'url') {
      node = new Node(nid, text, text2, type, snode, '', data['root']['url'], data['root']['icon']);
    } else {
      node = new Node(nid, text, text2, type, snode, '');
    }
    node.root = true;
    snode.nodes[nid] = node;
    graph.rootNode = node;
    snode.place();
    graph.addSNodesFromJSON(data);
    return graph;
  };

  Graph.prototype.addSNodesFromJSON = function(json) {
    var color, e, edge, etype, glow, k, label, nid, nlist, nod, node, rpos, sid, snode, text, text2, type, v, _i, _j, _len, _len1, _ref, _ref1;
    _ref = json['snodes'];
    for (k in _ref) {
      v = _ref[k];
      label = v['label'];
      if ((label !== 'x') && (label !== 'X')) {
        sid = k;
        etype = v['etype'];
        rpos = v['rpos'];
        color = v['color'];
        nlist = v['nodes'];
        snode = new SNode(this, sid, etype, rpos, label, color, false);
        this.snodes[sid] = snode;
        for (_i = 0, _len = nlist.length; _i < _len; _i++) {
          nod = nlist[_i];
          nid = nod['id'];
          text = nod['text'];
          text2 = nod['text2'];
          type = nod['type'];
          edge = nod['edge'];
          glow = false;
          if (this.newedges !== void 0) {
            _ref1 = this.newedges;
            for (_j = 0, _len1 = _ref1.length; _j < _len1; _j++) {
              e = _ref1[_j];
              if (e !== '') {
                if (e === edge) {
                  this.changedSNode = snode;
                  glow = true;
                }
              }
            }
          }
          if (type === 'url') {
            node = new Node(nid, text, text2, type, snode, edge, nod['url'], nod['icon'], glow);
          } else {
            node = new Node(nid, text, text2, type, snode, edge, '', '', glow);
          }
          snode.nodes[nid] = node;
        }
        snode.place();
      }
    }
    return this.layout();
  };

  Graph.prototype.updateSize = function() {
    this.width = $('#graph-view').width();
    this.height = $('#graph-view').height();
    this.halfWidth = this.width / 2;
    return this.halfHeight = this.height / 2;
  };

  Graph.prototype.updateTransform = function() {
    var transformStr;
    transformStr = "translate(" + this.offsetX + "px," + this.offsetY + "px)" + " scale(" + this.scale + ")";
    $('#graph-view').css('-webkit-transform', transformStr);
    return $('#graph-view').css('-moz-transform', transformStr);
  };

  Graph.prototype.rotateX = function(angle) {
    this.deltaQuat.fromEuler(angle, 0, 0);
    this.quat.mul(this.deltaQuat);
    this.quat.normalise();
    return this.quat.getMatrix(this.affinMat);
  };

  Graph.prototype.rotateY = function(angle) {
    this.deltaQuat.fromEuler(0, 0, angle);
    this.quat.mul(this.deltaQuat);
    this.quat.normalise();
    return this.quat.getMatrix(this.affinMat);
  };

  Graph.prototype.zoom = function(deltaZoom, x, y) {
    var newScale, r, rx, ry;
    newScale = this.scale + (0.3 * deltaZoom);
    if (newScale < 0.4) {
      newScale = 0.4;
    }
    if (deltaZoom >= 0) {
      rx = x - this.halfWidth;
      this.offsetX = rx - (((rx - this.offsetX) / this.scale) * newScale);
      ry = y - this.halfHeight;
      this.offsetY = ry - (((ry - this.offsetY) / this.scale) * newScale);
    } else {
      if ((this.scale - 0.4) > 0) {
        r = (newScale - 0.4) / (this.scale - 0.4);
        this.offsetX *= r;
        this.offsetY *= r;
      }
    }
    this.scale = newScale;
    return this.updateTransform();
  };

  Graph.prototype.updateView = function() {
    var k, _results;
    _results = [];
    for (k in this.snodes) {
      _results.push(this.snodes[k].applyPos());
    }
    return _results;
  };

  Graph.prototype.layout = function() {
    var N, Nt, k, key, snodeArray;
    for (k in this.snodes) {
      this.snodes[k].initPosAndLayout();
    }
    this.root.moveTo(0, 0, 0);
    snodeArray = [];
    for (key in this.snodes) {
      if (this.snodes.hasOwnProperty(key) && !this.snodes[key].isRoot) {
        snodeArray.push(this.snodes[key]);
      }
    }
    layout(snodeArray);
    this.negativeStretch = 1;
    this.mappingPower = 1;
    N = snodeArray.length;
    Nt = 7;
    if (N > (Nt * 2)) {
      this.mappingPower = Math.log(Math.asin(Nt / (N / 2)) / Math.PI) * (1 / Math.log(0.5));
      this.negativeStretch = this.mappingPower * 2;
    }
    return this.updateView();
  };

  Graph.prototype.label = function(text, relpos) {
    if (relpos === 0) {
      return text + ' ' + this.rootNode['text'];
    } else {
      return text;
    }
  };

  return Graph;

})();
var initSearchDialog, resultsReceived, searchQuery, searchRequest, showSearchDialog;

initSearchDialog = function() {
  var dialogHtml;
  dialogHtml = $("<div class=\"modal hide\" id=\"searchResultsModal\">\n  <div class=\"modal-header\">\n    <a class=\"close\" data-dismiss=\"modal\">×</a>\n    <h3>Search Results</h3>\n  </div>\n  <div class=\"modal-body\" id=\"searchResultsBody\" />\n  <div class=\"modal-footer\">\n    <a class=\"btn btn-primary\" data-dismiss=\"modal\">Close</a>\n  </div>\n</div>");
  dialogHtml.appendTo('body');
  return $('#searchResultsModal').modal({
    show: false
  });
};

showSearchDialog = function(msg) {
  return $('#searchResultsModal').modal('show');
};

resultsReceived = function(msg) {
  var html, json, numResults, r, results, _i, _len;
  json = JSON.parse(msg);
  html = '';
  numResults = json['count'];
  results = json['results'];
  if (numResults === '0') {
    html += '<p>Sorry, no results found.</p>';
  } else {
    html += '<p>' + numResults + ' results found.</p>';
    for (_i = 0, _len = results.length; _i < _len; _i++) {
      r = results[_i];
      html += '<p><a href="/node/' + r[0] + '">' + r[1] + '</a></p>';
    }
  }
  $('#searchResultsBody').html(html);
  return showSearchDialog(msg);
};

searchRequest = function(query, callback) {
  return $.ajax({
    type: "POST",
    url: "/search",
    data: "q=" + query.toLowerCase(),
    dataType: "text",
    success: callback
  });
};

searchQuery = function() {
  searchRequest($("#search-input-field").val(), resultsReceived);
  return false;
};
var disambiguateActionReply, disambiguateQuery, disambiguateResultsReceived, hideDisambiguateDialog, initDisambiguateDialog, root, showDisambiguateDialog;

initDisambiguateDialog = function() {
  var dialogHtml;
  dialogHtml = $("<div class=\"modal hide\" id=\"disambiguateModal\">\n  <div class=\"modal-header\">\n    <a class=\"close\" data-dismiss=\"modal\">×</a>\n    <h3>Did you mean...</h3>\n  </div>\n  <div class=\"modal-body\" id=\"disambiguateBody\" />\n  <div class=\"modal-footer\">\n    <a class=\"btn btn-primary\" data-dismiss=\"modal\">Close</a>\n  </div>\n</div>");
  dialogHtml.appendTo('body');
  return $('#disambiguateModal').modal({
    show: false
  });
};

showDisambiguateDialog = function(msg) {
  return $('#disambiguateModal').modal('show');
};

hideDisambiguateDialog = function(msg) {
  return $('#disambiguateModal').modal('hide');
};

disambiguateResultsReceived = function(msg) {
  var html, json, mode, participants, pos, r, rel, results, text, _i, _len;
  json = JSON.parse(msg);
  mode = json['mode'];
  text = json['text'];
  rel = json['rel'];
  participants = json['participants'];
  pos = json['pos'];
  results = json['results'];
  html = '<p><a href="#" onclick="disambiguateCreateNode(\'' + mode + "','" + text + "','" + rel + "','" + participants + "'," + pos + ')">Create new</a></p>';
  for (_i = 0, _len = results.length; _i < _len; _i++) {
    r = results[_i];
    html += '<p><a href="#" onclick="disambiguateChangeNode(\'' + mode + "','" + rel + "','" + participants + "'," + pos + ",'" + r[0] + '\')">' + r[1] + '</a></p>';
  }
  $('#disambiguateBody').html(html);
  return showDisambiguateDialog(msg);
};

disambiguateQuery = function(mode, text, rel, participantIds, pos) {
  var params, participants;
  participants = participantIds.join(" ");
  params = "text=" + text;
  params += "&mode=" + mode;
  params += "&rel=" + encodeURIComponent(rel);
  params += "&participants=" + encodeURIComponent(participants);
  params += "&pos=" + pos;
  return $.ajax({
    type: "POST",
    url: "/disambig",
    data: params,
    dataType: "text",
    success: disambiguateResultsReceived
  });
};

disambiguateActionReply = function(msg) {
  aiChatAddLine('gb', 'fact updated.');
  return window.location.reload();
};

root = typeof exports !== "undefined" && exports !== null ? exports : this;

root.disambiguateCreateNode = function(mode, text, rel, participants, pos) {
  var params;
  params = "&mode=" + mode;
  params += "&text=" + encodeURIComponent(text);
  params += "&rel=" + encodeURIComponent(rel);
  params += "&participants=" + encodeURIComponent(participants);
  params += "&pos=" + pos;
  $.ajax({
    type: "POST",
    url: "/disambig_create",
    data: params,
    dataType: "text",
    success: disambiguateActionReply
  });
  return hideDisambiguateDialog();
};

root.disambiguateChangeNode = function(mode, rel, participants, pos, changeTo) {
  var params;
  params = "&mode=" + mode;
  params += "&rel=" + encodeURIComponent(rel);
  params += "&participants=" + encodeURIComponent(participants);
  params += "&pos=" + pos;
  params += "&changeto=" + encodeURIComponent(changeTo);
  $.ajax({
    type: "POST",
    url: "/disambig_change",
    data: params,
    dataType: "text",
    success: disambiguateActionReply
  });
  return hideDisambiguateDialog();
};
var root, undoFactReply;

undoFactReply = function(msg) {
  aiChatAddLine('gb', 'fact removed (undo).');
  return window.location.reload();
};

root = typeof exports !== "undefined" && exports !== null ? exports : this;

root.undoFact = function(rel, participants) {
  var params;
  params = "&rel=" + encodeURIComponent(rel);
  params += "&participants=" + encodeURIComponent(participants);
  return $.ajax({
    type: "POST",
    url: "/undo_fact",
    data: params,
    dataType: "text",
    success: undoFactReply
  });
};
String.prototype.replaceAll = function(str1, str2, ignore) {
  return this.replace(new RegExp(str1.replace(/([\/\,\!\\\^\$\{\}\[\]\(\)\.\*\+\?\|\<\>\-\&])/g,"\\$&"),(ignore?"gi":"g")),(typeof(str2)=="string")?str2.replace(/\$/g,"$$$$"):str2);
};

var autoUpdateUsername, checkEmail, checkEmailReply, checkUsername, checkUsernameReply, clearSignupErrors, emailChanged, emailStatus, initSignUpDialog, login, loginReply, loginRequest, logout, showSignUpDialog, signup, signupReply, submitting, updateUsername, usernameChanged, usernameStatus;

autoUpdateUsername = true;

usernameStatus = 'unknown';

emailStatus = 'unknown';

submitting = false;

initSignUpDialog = function() {
  var dialogHtml;
  dialogHtml = $("\n<div class=\"modal hide\" id=\"signUpModal\" style=\"width:650px; height:500px; margin: -295px 0 0 -325px;\">\n  <div class=\"modal-header\">\n    <a class=\"close\" data-dismiss=\"modal\">×</a>\n    <h3>Register or Login</h3>\n  </div>\n\n  <div class=\"modal-body\" id=\"registerLoginBody\" style=\"height:500px; overflow:hidden;\">\n    <div style=\"float:left\">\n      <h5>REGISTER NEW ACCOUNT</h5>\n      <span id=\"signupErrMsg\" class=\"error\" />\n      <form class=\"signupForm\">\n        <fieldset id=\"nameFieldSet\">\n          <label>Name</label>\n          <input id=\"suName\" type=\"text\" class=\"span3\" placeholder=\"Or an alias if you prefer\">\n        </fieldset>\n        <fieldset id=\"usernameFieldSet\">\n          <label>Username</label>\n          <input id=\"suUsername\" type=\"text\" class=\"span3\" placeholder=\"Unique identifier\">\n        </fieldset>\n        <fieldset id=\"emailFieldSet\">\n          <label>Email</label>\n          <input id=\"suEmail\" type=\"text\" class=\"span3\" placeholder=\"Will not be seen by other members\">\n        </fieldset>\n        <fieldset id=\"passFieldSet\">\n          <label>Password</label>\n          <input id=\"suPassword\" type=\"password\" class=\"span3\" placeholder=\"A good password\">\n          <br />\n          <input id=\"suPassword2\" type=\"password\" class=\"span3\" placeholder=\"Confirm password\">\n        </fieldset>\n    \n        <br />\n        <a id=\"signupButton\" class=\"btn btn-primary\">Sign Up</a>\n      </form>\n    </div>\n\n    <div style=\"float:right\">\n      <h5>LOGIN</h5>\n      <span id=\"loginErrMsg\" class=\"error\" />\n      <form class=\"loginForm\">\n        <fieldset id=\"logEmailFieldSet\">\n          <label>Email or Username</label>\n          <input id=\"logEmail\" type=\"text\" class=\"span3\">\n        </fieldset>\n        <fieldset id=\"logPassFieldSet\">\n          <label>Password</label>\n          <input id=\"logPassword\" type=\"password\" class=\"span3\">\n        </fieldset>\n      \n        <br />\n        <a id=\"loginButton\" class=\"btn btn-primary\" data-dismiss=\"modal\">Login</a>\n      </form>\n    </div>\n\n  </div>\n</div>");
  dialogHtml.appendTo('body');
  $('#signupButton').click(signup);
  $('#loginButton').click(login);
  $('#suName').keyup(updateUsername);
  $('#suName').blur(checkUsername);
  $('#suUsername').keyup(usernameChanged);
  $('#suUsername').blur(checkUsername);
  $('#suEmail').keyup(emailChanged);
  return $('#suEmail').blur(checkEmail);
};

showSignUpDialog = function() {
  return $('#signUpModal').modal('show');
};

clearSignupErrors = function() {
  $('#nameFieldSet').removeClass('control-group error');
  $('#usernameFieldSet').removeClass('control-group error');
  $('#emailFieldSet').removeClass('control-group error');
  $('#passFieldSet').removeClass('control-group error');
  $('#signupErrMsg').html('');
  $('#logEmailFieldSet').removeClass('control-group error');
  $('#logPassFieldSet').removeClass('control-group error');
  return $('#loginErrMsg').html('');
};

signup = function() {
  var email, filter, name, password, password2, username;
  clearSignupErrors();
  name = $("#suName").val();
  username = $("#suUsername").val();
  email = $("#suEmail").val();
  password = $("#suPassword").val();
  password2 = $("#suPassword2").val();
  if (name === '') {
    $('#nameFieldSet').addClass('control-group error');
    $('#signupErrMsg').html('Name cannot be empty.');
    return false;
  }
  if (username === '') {
    $('#usernameFieldSet').addClass('control-group error');
    $('#signupErrMsg').html('Username cannot be empty.');
    return false;
  }
  if (email === '') {
    $('#emailFieldSet').addClass('control-group error');
    $('#signupErrMsg').html('Email cannot be empty.');
    return false;
  }
  filter = /^([a-zA-Z0-9_\.\-])+\@(([a-zA-Z0-9\-])+\.)+([a-zA-Z0-9]{2,4})+$/;
  if (!filter.test(email)) {
    $('#emailFieldSet').addClass('control-group error');
    $('#signupErrMsg').html('Not a valid email address.');
    return false;
  }
  if (password === '') {
    $('#passFieldSet').addClass('control-group error');
    $('#signupErrMsg').html('You must specify a password.');
    return false;
  }
  if (password !== password2) {
    $('#passFieldSet').addClass('control-group error');
    $('#signupErrMsg').html('Passwords do not match.');
    return false;
  }
  if (usernameStatus === 'exists') {
    return false;
  } else if (usernameStatus === 'unknown') {
    submitting = true;
    checkUsername();
    return false;
  }
  if (emailStatus === 'exists') {
    return false;
  } else if (emailStatus === 'unknown') {
    submitting = true;
    checkEmail();
    return false;
  }
  $.ajax({
    type: "POST",
    url: "/signup",
    data: "name=" + name + "&username=" + username + "&email=" + email + "&password=" + password,
    dataType: "text",
    success: signupReply
  });
  return false;
};

login = function() {
  var logEmail, password;
  logEmail = $("#logEmail").val();
  password = $("#logPassword").val();
  return loginRequest(logEmail, password);
};

loginRequest = function(logEmail, password) {
  clearSignupErrors();
  if (logEmail === '') {
    $('#logEmailFieldSet').addClass('control-group error');
    $('#loginErrMsg').html('Email / Username cannot be empty.');
    return false;
  }
  if (password === '') {
    $('#logPassFieldSet').addClass('control-group error');
    $('#loginErrMsg').html('Password cannot be empty.');
    return false;
  }
  $.ajax({
    type: "POST",
    url: "/login",
    data: "login=" + logEmail + "&password=" + password,
    dataType: "text",
    success: loginReply
  });
  return false;
};

signupReply = function(msg) {
  return loginRequest($("#suEmail").val(), $("#suPassword").val());
};

loginReply = function(msg) {
  var response;
  if (msg === "failed") {
    return $('#loginErrMsg').html('Wrong username / email or password.');
  } else {
    response = msg.split(' ');
    $.cookie('username', response[0], {
      path: '/'
    });
    $.cookie('session', response[1], {
      path: '/'
    });
    if (typeof data !== "undefined" && data !== null) {
      return location.reload();
    } else {
      return window.location.href = '/node/user/' + response[0];
    }
  }
};

logout = function() {
  $.cookie('username', '', {
    path: '/'
  });
  $.cookie('session', '', {
    path: '/'
  });
  return location.reload();
};

usernameChanged = function(msg) {
  autoUpdateUsername = false;
  return usernameStatus = 'unknown';
};

updateUsername = function(msg) {
  var username;
  if (autoUpdateUsername) {
    username = $("#suName").val().toLowerCase().replaceAll(" ", "_");
    $("#suUsername").val(username);
    return usernameStatus = 'unknown';
  }
};

emailChanged = function(msg) {
  return emailStatus = 'unknown';
};

checkUsername = function() {
  if ($("#suUsername").val() !== '') {
    return $.ajax({
      type: "POST",
      url: "/checkusername",
      data: "username=" + $("#suUsername").val(),
      dataType: "text",
      success: checkUsernameReply
    });
  }
};

checkUsernameReply = function(msg) {
  var response, status, username;
  response = msg.split(' ');
  status = response[0];
  username = response[1];
  if (username === $("#suUsername").val()) {
    if (status === 'ok') {
      usernameStatus = 'ok';
      $('#usernameFieldSet').removeClass('control-group error');
      $('#usernameFieldSet').addClass('control-group success');
      if (submitting) {
        return signup();
      }
    } else {
      usernameStatus = 'exists';
      $('#usernameFieldSet').removeClass('control-group success');
      $('#usernameFieldSet').addClass('control-group error');
      $('#signupErrMsg').html('Sorry, this username is already in use.');
      return submitting = false;
    }
  }
};

checkEmail = function() {
  if ($("#suEmail").val() !== '') {
    return $.ajax({
      type: "POST",
      url: "/checkemail",
      data: "email=" + $("#suEmail").val(),
      dataType: "text",
      success: checkEmailReply
    });
  }
};

checkEmailReply = function(msg) {
  var email, response, status;
  response = msg.split(' ');
  status = response[0];
  email = response[1];
  if (email === $("#suEmail").val()) {
    if (status === 'ok') {
      emailStatus = 'ok';
      $('#emailFieldSet').removeClass('control-group error');
      $('#emailFieldSet').addClass('control-group success');
      $('#emailErrMsg').html('');
      if (submitting) {
        return signup();
      }
    } else {
      emailStatus = 'exists';
      $('#emailFieldSet').removeClass('control-group success');
      $('#emailFieldSet').addClass('control-group error');
      $('#signupErrMsg').html('Sorry, this email is already in use.');
      return submitting = false;
    }
  }
};
var initRelations, relationReply, relationSubmit;

initRelations = function() {
  var count, eventData, html, label, r, rels, _i, _j, _len, _len1, _results;
  html = "";
  rels = data['allrelations'];
  count = 0;
  for (_i = 0, _len = rels.length; _i < _len; _i++) {
    r = rels[_i];
    label = g.label(r['label'], r['pos']) + '<br />';
    if (g.snodes[r['snode']] === void 0) {
      html += '<a class="visible_rel_link" href="#" id="rel' + count + '">' + label + '</a>';
    } else {
      html += '<a class="hidden_rel_link" href="#" id="rel' + count + '">' + label + '</a>';
    }
    count += 1;
  }
  $('#rel-list').html(html);
  count = 0;
  _results = [];
  for (_j = 0, _len1 = rels.length; _j < _len1; _j++) {
    r = rels[_j];
    eventData = {
      rel: r['rel'],
      pos: r['pos'],
      snode: r['snode']
    };
    $('#rel' + count).bind('click', eventData, relationSubmit);
    _results.push(count += 1);
  }
  return _results;
};

relationSubmit = function(msg) {
  var eventData;
  eventData = msg.data;
  if (g.snodes[eventData.snode] === void 0) {
    $.ajax({
      type: "POST",
      url: "/rel",
      data: "rel=" + eventData.rel + "&pos=" + eventData.pos + "&rootId=" + rootNodeId,
      dataType: "json",
      success: relationReply
    });
  } else {
    addAnim(new AnimLookAt(g.snodes[eventData.snode]));
  }
  return false;
};

relationReply = function(msg) {
  var k, sid, snode, v, _ref;
  g.addSNodesFromJSON(msg);
  initRelations();
  sid = '';
  _ref = msg['snodes'];
  for (k in _ref) {
    v = _ref[k];
    sid = k;
  }
  if (sid !== '') {
    snode = g.snodes[sid];
    return addAnim(new AnimLookAt(snode));
  }
};
var aiChatAddLine, aiChatAddLineRaw, aiChatButtonPressed, aiChatGotoBottom, aiChatReply, aiChatSubmit, aiChatVisible, chatBuffer, chatBufferPos, chatBufferSize, clearChatBuffer, hideAiChat, initAiChat, initChatBuffer, printHelp, root, showAiChat;

aiChatVisible = false;

chatBuffer = [];

chatBufferPos = 0;

chatBufferSize = 100;

initChatBuffer = function() {
  var curPos, firstUse, line, pos, _i;
  firstUse = false;
  if (localStorage.getItem('chatBufferPos') !== null) {
    chatBufferPos = parseInt(localStorage.getItem('chatBufferPos'));
  } else {
    firstUse = true;
  }
  for (pos = _i = 0; 0 <= chatBufferSize ? _i <= chatBufferSize : _i >= chatBufferSize; pos = 0 <= chatBufferSize ? ++_i : --_i) {
    chatBuffer.push(localStorage.getItem('chatBuffer' + pos));
  }
  curPos = chatBufferPos;
  while (curPos < chatBufferSize) {
    line = chatBuffer[curPos];
    if (line !== null) {
      aiChatAddLineRaw(line);
    }
    curPos += 1;
  }
  curPos = 0;
  while (curPos < chatBufferPos) {
    line = chatBuffer[curPos];
    if (line !== null) {
      aiChatAddLineRaw(line);
    }
    curPos += 1;
  }
  if (firstUse) {
    return printHelp();
  }
};

clearChatBuffer = function() {
  var pos, _i, _results;
  localStorage.removeItem('chatBufferPos');
  _results = [];
  for (pos = _i = 0; 0 <= chatBufferSize ? _i <= chatBufferSize : _i >= chatBufferSize; pos = 0 <= chatBufferSize ? ++_i : --_i) {
    _results.push(localStorage.removeItem('chatBuffer' + pos));
  }
  return _results;
};

aiChatGotoBottom = function() {
  var height;
  height = $('#ai-chat')[0].scrollHeight;
  return $('#ai-chat').scrollTop(height);
};

showAiChat = function() {
  $('#ai-chat').css('display', 'block');
  aiChatVisible = true;
  localStorage.setItem('aichat', 'true');
  aiChatGotoBottom();
  return $('#ai-chat-input').focus();
};

hideAiChat = function() {
  $('#ai-chat').css('display', 'none');
  aiChatVisible = false;
  return localStorage.setItem('aichat', 'false');
};

initAiChat = function() {
  var html;
  html = "<div id=\"ai-chat-log\" />\n<form id=\"ai-chat-form\">\n<input id=\"ai-chat-input\" type=\"text\" />\n</form>";
  $('#ai-chat').html(html);
  $('#ai-chat-form').submit(aiChatSubmit);
  initChatBuffer();
  if (localStorage.getItem('aichat') === 'false') {
    return hideAiChat();
  } else {
    $("#ai-chat-button").button('toggle');
    return showAiChat();
  }
};

aiChatAddLineRaw = function(line) {
  $('#ai-chat-log').append(line);
  return aiChatGotoBottom();
};

aiChatAddLine = function(agent, line) {
  var html;
  html = '';
  if (agent === 'gb') {
    html += '<div class="gb-line"><b>GraphBrain:</b> ';
  } else if (agent === 'user') {
    html += '<div class="user-line"><b>You:</b> ';
  }
  html += line + '</div>';
  aiChatAddLineRaw(html);
  chatBuffer[chatBufferPos] = html;
  localStorage.setItem('chatBuffer' + chatBufferPos, html);
  chatBufferPos += 1;
  if (chatBufferPos >= chatBufferSize) {
    chatBufferPos = 0;
  }
  return localStorage.setItem('chatBufferPos', chatBufferPos);
};

printHelp = function() {
  var helpMsg;
  helpMsg = "GraphBrain allows you to record facts as relationships between entities (web resources, objects, concepts).<br />\nTo add a fact, simply type a sentence with a verb linking two entities (objects, concepts, websites), e.g.<br />\n\n<b>GraphBrain likes people</b><br />\n<b>GraphBrain lives at http://graphbrain.com</b><br />\n\nIn cases where there may be ambiguity, try to use quotation marks, e.g.<br />\n<b>\"Burn after reading\" is a film</b> <br />";
  return aiChatAddLine('gb', helpMsg);
};

aiChatSubmit = function(msg) {
  var sentence;
  sentence = $('#ai-chat-input').val();
  aiChatAddLine('user', sentence);
  $('#ai-chat-input').val('');
  if (sentence === '!clean') {
    clearChatBuffer();
    location.href = location.href;
    return false;
  }
  if (sentence === 'help') {
    printHelp();
    return false;
  }
  $.ajax({
    type: "POST",
    url: "/ai",
    data: "sentence=" + sentence + "&rootId=" + rootNodeId,
    dataType: "json",
    success: aiChatReply
  });
  return false;
};

aiChatReply = function(msg) {
  aiChatAddLine('gb', msg['sentence']);
  state.setNewEdges(msg['newedges']);
  if (msg['goto'] !== '') {
    return window.location.href = '/node/' + msg['goto'];
  }
};

aiChatButtonPressed = function(msg) {
  if (aiChatVisible) {
    return hideAiChat();
  } else {
    return showAiChat();
  }
};

root = typeof exports !== "undefined" && exports !== null ? exports : this;

root.aiChatDisambiguate = function(mode, text, rel, participantIds, pos) {
  return disambiguateQuery(mode, text, rel, participantIds, pos);
};var initRemoveDialog, removeAction, removeClicked, showRemoveDialog;

removeClicked = function(msg) {
  return showRemoveDialog(msg.data.node, msg.data.link, msg.data.edge);
};

initRemoveDialog = function() {
  var dialogHtml;
  dialogHtml = $("<div class=\"modal hide\" id=\"removeModal\">\n  <div class=\"modal-header\">\n    <a class=\"close\" data-dismiss=\"modal\">×</a>\n    <h3>Confirm Removal</h3>\n  </div>\n  <form id=\"removeForm\" action='/node/" + rootNodeId + "' method=\"post\">\n  <input type=\"hidden\" name=\"op\" value=\"remove\">\n  <input id=\"removeEdgeField\" type=\"hidden\" name=\"edge\">\n  <div class=\"modal-body\" id=\"addBrainBody\">\n      <div id=\"linkDesc\"></div>\n  </div>\n  <div class=\"modal-footer\">\n    <a class=\"btn\" data-dismiss=\"modal\">Close</a>\n    <a id=\"removeDlgButton\" class=\"btn btn-primary\">Remove</a>\n  </div>\n</form>\n</div>");
  dialogHtml.appendTo('body');
  return $('#removeDlgButton').click(removeAction);
};

showRemoveDialog = function(node, link, edge) {
  $('#removeEdgeField').val(edge);
  $('#linkDesc').html(node.text + ' <strong>(' + link + '</strong>)');
  return $('#removeModal').modal('show');
};

removeAction = function() {
  return $('#removeForm').submit();
};
var State;

State = (function() {

  function State() {
    this.values = {};
    if (localStorage.getItem('newedges') !== null) {
      this.values['newedges'] = JSON.parse(localStorage.getItem('newedges'));
    }
  }

  State.prototype.setNewEdges = function(newedges) {
    localStorage.setItem('newedges', JSON.stringify(newedges));
    return this.values['newedges'] = newedges;
  };

  State.prototype.getNewEdges = function() {
    return this.values['newedges'];
  };

  State.prototype.clean = function() {
    return localStorage.removeItem('newedges');
  };

  return State;

})();
var g, state;

g = false;

state = false;

$(function() {
  Math.seedrandom("GraphBrain GraphBrain");
  state = new State();
  if (typeof data !== "undefined" && data !== null) {
    g = Graph.initGraph(state.getNewEdges());
  }
  initInterface();
  if (typeof data !== "undefined" && data !== null) {
    initRelations();
  }
  browserSpecificTweaks();
  if (typeof data !== "undefined" && data !== null) {
    if (g.changedSNode === null) {
      addAnim(new AnimInitRotation());
    } else {
      addAnim(new AnimLookAt(g.changedSNode));
    }
  }
  return state.clean();
});
