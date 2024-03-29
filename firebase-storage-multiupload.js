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
* The firebase-storage-multiupload element is an easy way to upload files by
* expose the firebase storage api to the Polymer databinding system.
*
* For example:
*
*     <firebase-storage-multiupload
*       path="/users/{{userId}}/files/{{filepath}}"
*       files="[[fileArray]]"
*       upload-tasks="{{uploadTasks}}">
*     </firebase-storage-multiupload>
*
* This fetches the `fileArray` object, which is usually an array of Files,
* or a FileList, which are then automatically uploaded to
* `/users/${userId}/files/${filepath}` and then creates an array of upload
* tasks that are exposed through the Polymer databinding system via the
* `uploadTasks`. Changes to `fileArray` will likewise create a new set of
* uploads, which creates a new set of tasks, which are appended to the
* `uploadTasks`.
*
* You can then use `<firebase-storage-upload-task>` to cancel, pause or resume the upload.
* There are two ways to do this. You can encapsulate `firebase-storage-upload-task` in another
* element to have a local scope of the upload task's state:
*
* ```
*   file-uploader
*
*     <firebase-storage-multiupload
*       path="/users/{{userId}}/files/{{filepath}}"
*       files="[[fileArray]]"
*       upload-tasks="{{uploadTasks}}">
*     </firebase-storage-multiupload>
*
*     <template is="dom-repeat" items="[[uploadTasks]]">
*        <file-task item="[[item]]"></file-task>
*     </template>
*
*
*   file-task
*
*     <firebase-storage-upload-task
*       task="[[item]]""
*       bytes-transferred="{{bytesTransferred}}"
*       total-bytes="{{totalBytes}}"
*       state="{{state}}"
*       download-url="{{downloadUrl}}"
*       metadata="{{metadata}}"
*       path="{{path}}"></firebase-storage-upload-task>
*
* ```
*
* or you can just add the states in the uploadTasks list
*
* ```
*     <firebase-storage-multiupload
*       path="/users/{{userId}}/files/{{filepath}}"
*       files="[[fileArray]]"
*       upload-tasks="{{uploadTasks}}">
*     </firebase-storage-multiupload>
*
*     <template is="dom-repeat" items="[[uploadTasks]]">
*       <firebase-storage-upload-task
*         task="[[item]]""
*         bytes-transferred="{{item.bytesTransferred}}"
*         total-bytes="{{item.totalBytes}}"
*         state="{{item.state}}"
*         download-url="{{item.downloadUrl}}"
*         metadata="{{item.metadata}}"
*         path="{{item.path}}"></firebase-storage-upload-task>
*     </template>
* ```
*
* `<firebase-storage>` needs some information about how to talk to Firebase.
* Set this configuration by adding a `<firebase-app>` element anywhere in your
* app.
*/
Polymer({
  is: 'firebase-storage-multiupload',

  properties: {
    /**
      * The files to be uploaded.
      */
    files: {
      type: Array
    },

    /**
      * The upload tasks after invoking the Firebase storage put method
      *
      */
    uploadTasks: {
      type: Array,
      notify: true,
      value: []
    },

    /**
      * Uploads the files automatically when the file list has been changed/updated
      *
      */
    auto: {
      type: Boolean,
      value: false
    }
  },

  behaviors: [
    FirebaseStorageBehavior
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

  observers: [
    '__filesChanged(files, auto)'
  ],

  /**
  * Upload files, update the path and write this.files to that new location.
  *
  * Important note: `this.path` is updated asynchronously.
  * 
  * @param {Array} Array of Files to be uploaded
  * @param {string} path of the new firebase location to write to.
  * @return {Promise} A promise that resolves once this.files has been
  *     written to the new path.
  * @override
  */
  upload: function(files, path) {
    if (!this.app) {
      this.fire('error', new Error('No app configured!'))
    }
    this._putMultipleFirebaseFiles(path || this.path, files && files.length ? files : this.files);
    if (path) {
      this.path = path;
    }
  },

  /**
    * Resets the firebase-storage-multiupload instance
    *
    */
  reset: function() {
    this.path = null;
    this.clearTasks();
    return Promise.resolve();
  },

  /**
    * Resets the upload tasks
    *
    */
  clearTasks: function() {
    this.uploadTasks = [];
  },

  _putMultipleFirebaseFiles: function(path, files) {
    this._log('Putting Multiple Firebase files at',  path ? this.path + '/' + path : this.path);
    files = files && typeof files === 'object' && files.name ? [files] : files;
    if (files && files.length > 0) {
      for (var i = 0; i < files.length; i++) {
        var uploadTask = this.__put(path, files[i], this.metadata ? this.metadata : files[i].metadata);
        uploadTask.on(firebase.storage.TaskEvent.STATE_CHANGED, function(snapshot) {}, function(error) {
          this.fire('error', error, { bubble: false});
        }.bind(this));
        this.push('uploadTasks', uploadTask);
      }
    }
  },

  __filesChanged: function(files, auto) {
    if (auto && files && files.length) {
      this.upload(files)
    }
  },

  __pathChanged: function(path, oldPath) {
    if (oldPath != null) {
      this.clearTasks();
    }
  },
});
