(function() {
	"use strict";
	const hasVargs = f => {
		const s = f+"",
			i = s.indexOf("...");
		return i>=0 && i<s.indexOf(")" || s.indexOf("arguments")>=0);
	}
	function nanomemoize (fn, options={}) {
		const {
			serializer = (value) => { 
				if(value && (typeof value === "string" || typeof value === "object")) {
					// strings must be stringified because cache[1] should not equal or overwrite cache["1"] for value = 1 and value = "1"
					return JSON.stringify(value);
				}
				return value;
			},
			equals,
			maxAge,
			maxArgs,
			vargs = hasVargs(fn)
		} = options,
			s = {}, // single arg function key/value cache
			k = [], // multiple arg function arg key cache
			v = [], // multiple arg function result cache
			c = {}, // key change cache
			change = (cache,key) => { // logs key changes
				c[key] = {key,cache};
			},
			t =  {},
			timeout = (change) => { // deletes timed-out keys
				if(t[change.key]) clearTimeout(t[change.key]);
				t[change.key] = setTimeout(() => {
					delete change.cache[change.key];
					delete t[change.key];
				},maxAge);
			};
		setInterval(() => { // process key changes out of cycle for speed
			for(let p in c) {
					if(maxAge) timeout(c[p]);
					delete c[p];
			}
		},1);
		let f,
			unary = fn.length===1 && !equals && !vargs;
	  // pre-bind core arguments, faster than using a closure or passing on stack
		if(unary) {
			f = single.bind(
				 this,
				 fn,
				 s,
				 (maxAge ? change.bind(this,s): null), // turn change logging on and bind to arg cache s
				 serializer
				 );
		} else {
			f = multiple.bind(
					 this,
					 fn,
					 k,
					 v,
					 equals || ((a,b) => a===b), // default to just a regular strict comparison
					 (maxAge ? change.bind(this,v): null), // turn change logging on and bind to arg cache v
					 maxArgs
					 );
		}
		// reset all the caches, must splice arrays or delete keys on objects to retain bind integrity
		f.clear = () => {
			Object.keys(s).forEach(k => delete s[k]);
			k.splice(0,k.length);
			v.splice(0,v.length);
			Object.keys(c).forEach(k => delete c[k]);
			Object.keys(t).forEach(k => { clearTimeout(t[k]); delete t[k]; });
		}
		f.keys = () => (!unary ? k.slice() : null);
		f.values = () => (!unary ? v.slice() : null);
		f.keyValues = () => (unary ? Object.assign({},s) : null);
		return f;
	}

	// for single argument functions, just use a JS object key look-up
	function single (f,cache,change,serializer,arg) {
		const key = (!arg || typeof arg === "number" || typeof arg ==="boolean" || arg.constructor===Number || arg.constructor===Boolean ? arg : serializer(arg));
		if(change) change(key);
		return cache[key] || ( cache[key] = f.call(this, arg));
	}
	
	// for multiple arg functions, loop through a cache of all the args
	// looking at each arg separately so a test can abort as soon as possible
	function multiple(f,keys,values,equals,change,max,...args) {
		const rslt = {};
		for(let i=0;i<keys.length;i++) { // an array of arrays of args
			let key = keys[i];
			if(max) key = key.slice(0,max);
			if(key.length===args.length) {
				const max = key.length - 1;
				for(let j=0;j<=max;j++) {
					if(!equals(key[j],args[j])) break; // go to next key if args don't match
					if(j===max) { // the args matched
						rslt.index = i;
						rslt.value = values[i]; // get the cached value
					}
				}
			}
		}
		const i = rslt.index>=0 ? rslt.index : values.length;
		if(change) change(i);
		return typeof rslt.value === "undefined" ? rslt.value = values[i] = f(...(keys[i] = args)) : rslt.value;
	}
		
	if(typeof(module)!=="undefined") module.exports = nanomemoize;
	if(typeof(window)!=="undefined") window.nanomemoize = nanomemoize;
}).call(this);

