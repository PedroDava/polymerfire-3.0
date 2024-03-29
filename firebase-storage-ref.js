/**
@license
Copyright 2016 Google Inc. All Rights Reserved.
Use of this source code is governed by a BSD-style
license that can be found in the LICENSE file or at
https://github.com/firebase/polymerfire/blob/master/LICENSE
*/
import '@polymer/polymer/polymer-legacy.js';

import { FirebaseStorageBehavior } from './firebase-storage-behavior.js';
import { Polymer } from '@polymer/polymer/lib/legacy/polymer-fn.js';

/**
* The firebase-storage-ref element is an easy way to interact with a firebase
* storage as an object and expose it to the Polymer databinding system.
*
* For example:
*
*     <firebase-storage-ref
*       path="{{path}}"
*       metadata="{{metadata}}"
*       storage-uri="{{gsUri}}"
*       download-url="{{downloadUrl}}">
*     </firebase-storage-ref>
*
* This fetches file associated within the `path` attribute from the firebase storage
* and produces the metadata and the download url associated with it.
* It also exposes several firebase storage methods to manipulate and get
* additional data from it.
*
* `<firebase-storage>` needs some information about how to talk to Firebase.
* Set this configuration by adding a `<firebase-app>` element anywhere in your
* app.
*/
Polymer({
  is: 'firebase-storage-ref',

  properties: {
    /**
      * The url of the file for download
      */
    downloadUrl: {
      type: String,
      notify: true
    },

    /**
      * The metadata of the file
      */
    metadata: {
      type: Object,
      notify: true
    },

    /**
     * The Cloud Storage URI string of this object in the form `gs://<bucket>/<path>/<to>/<object>`
     */
    storageUri: {
      type: String,
      notify: true
    },

    /**
      * The upload task of the file when you use the put method.
      */
    uploadTask: {
      type: Object,
      notify: true
    }
  },

  behaviors: [
    FirebaseStorageBehavior
  ],
  
  
  observers: [
    '__pathChanged(path, storage)'
  ],

  /**
  * @override
  */
  get isNew() {
    return !this.path;
  },

  /**
  * @override
  */
  get zeroValue() {
    return [];
  },
  
  __pathChanged: function(path) {
    if (this.storage) {
      this.getDownloadURL(path).then(function(downloadUrl) {
        this.downloadUrl = downloadUrl;
      }.bind(this)).catch(function(error) {
        this.fire('error', error, { bubble: false});
      }.bind(this));

      this.getMetadata(path).then(function(metadata) {
        this.metadata = metadata;
      }.bind(this)).catch(function(error) {
        this.fire('error', error, { bubble: false});
      }.bind(this));
      
      this.storageUri = this.toGsString(path);
    }
  },


  /**
  *  Resets this element's path
  */
  reset: function() {
    this.path = null;
    return Promise.resolve();
  },

  /**
  *  Sets the path from url
  */
  setPathFromUrl: function(url) {
    if (url) {
      this.path = this.getPathFromUrl(url);
      return new Promise.resolve();
    }
    return new Promise.resolve();
  },

  /**
  *  Get's the path from url
  */
  getPathFromUrl: function(url) {
    return url ? this.storage.refFromURL(url) : null;
  },

  /**
  *  Deletes the file associated in the firebase storage path
  */
  delete: function() {
    return this.__put().then(function() {
      return this.reset();
    }.bind(this));
  },

  /**
  *  Stores a new single file inside this path
  */
  put: function(file, metadata) {
    this.uploadTask = this.__put(null, file, metadata);
    return this.uploadTask;
  },

  /**
  *  Stores a string in a given format
  */
  putString: function(data, format, metadata) {
    this.uploadTask = this.__putString(null, data, format, metadata);
    return this.uploadTask;
  },

  /**
  *  Get the download url of the file
  */
  getDownloadURL: function(path) {
    if (path) {
      return this.storage.ref(path).getDownloadURL();
    } else if (this.ref) {
      return this.ref.getDownloadURL();
    }
    return new Promise(function(resolve, reject) {resolve();});
  },

  /**
  *  Get the metadata of the file
  */
  getMetadata: function(path) {
    if (path) {
      return this.storage.ref(path).getMetadata();
    } else if (this.ref) {
      return this.ref.getMetadata();
    }
    return new Promise(function(resolve, reject) {resolve();});
  },

  /**
   * Returns a gs:// URL for this object in the form gs://<bucket>/<path>/<to>/<object>
   */

  toGsString: function(path) {
    if (path) {
      return this.storage.ref(path).toString();
    } else if (this.ref) {
      return this.ref.toString();
    }
  },

  /**
  *  Sets the metadata of the file
  */
  setMetadata: function(metadata, path) {
    if (path) {
      return this.storage.ref(path).updateMetadata(metadata);
    } else if (this.ref) {
      return this.ref.updateMetadata(metadata);
    }
    return new Promise(function(resolve, reject) {resolve();});
  }
});
