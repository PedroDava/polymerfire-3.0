/**
@license
Copyright 2016 Google Inc. All Rights Reserved.
Use of this source code is governed by a BSD-style
license that can be found in the LICENSE file or at
https://github.com/firebase/polymerfire/blob/master/LICENSE
*/
/*
`firebase-query` combines the given properties into query options that generate
a query, a request for a filtered, ordered, immutable set of Firebase data. The
results of this Firebase query are then synchronized into the `data` parameter.

If the child nodes of the query are objects (most cases), `data` will be an array
of those objects with an extra `$key` field added to represent the key. If the
child nodes are non-object leaf values, `data` will be an array of objects of
the structure `{$key: key, $val: val}`.

Example usage:
```html
<firebase-query
    id="query"
    app-name="notes"
    path="/notes/[[uid]]"
    data="{{data}}">
</firebase-query>

<template is="dom-repeat" items="{{data}}" as="note">
  <sticky-note note-data="{{note}}"></sticky-note>
</template>

<script>
Polymer({
  properties: {
    uid: String,
    data: {
      type: Object,
      observer: 'dataChanged'
    }
  },

  dataChanged: function (newData, oldData) {
    // do something when the query returns values
  }
});
</script>
```
*/
/*
  FIXME(polymer-modulizer): the above comments were extracted
  from HTML and may be out of place here. Review them and
  then delete this comment!
*/
import '@polymer/polymer/polymer-legacy.js';

import { FirebaseDatabaseBehavior } from './firebase-database-behavior.js';
import { Polymer } from '@polymer/polymer/lib/legacy/polymer-fn.js';

Polymer({
  is: 'firebase-query',

  behaviors: [
    FirebaseDatabaseBehavior
  ],

  properties: {
    /**
     * [`firebase.database.Query`](https://firebase.google.com/docs/reference/js/firebase.database.Query#property)
     * object computed by the following parameters.
     */
    query: {
      type: Object,
      computed: '__computeQuery(ref, orderByChild, orderByValue, limitToFirst, limitToLast, startAt, endAt, equalTo)',
      observer: '__queryChanged'
    },

    /**
     * The child key of each query result to order the query by.
     *
     * Changing this value generates a new `query` ordered by the
     * specified child key.
     */
    orderByChild: {
      type: String,
      value: ''
    },

    /**
     * Order this query by values. This is only applicable to leaf node queries
     * against data structures such as `{a: 1, b: 2, c: 3}`.
     */
    orderByValue: {
      type: Boolean,
      value: false
    },

    /**
     * The value to start at in the query.
     *
     * Changing this value generates a new `query` with the specified
     * starting point. The generated `query` includes children which match
     * the specified starting point.
     */
    startAt: {
      type: String,
      value: ''
    },

    /**
     * The value to end at in the query.
     *
     * Changing this value generates a new `query` with the specified
     * ending point. The generated `query` includes children which match
     * the specified ending point.
     */
    endAt: {
      type: String,
      value: ''
    },

    /**
     * Specifies a child-key value that must be matched for each candidate result.
     *
     * Changing this value generates a new `query` which includes children
     * which match the specified value.
     */
    equalTo: {
      type: Object,
      value: null
    },

    /**
     * The maximum number of nodes to include in the query.
     *
     * Changing this value generates a new `query` limited to the first
     * number of children.
     */
    limitToFirst: {
      type: Number,
      value: 0
    },

    /**
     * The maximum number of nodes to include in the query.
     *
     * Changing this value generates a new `query` limited to the last
     * number of children.
     */
    limitToLast: {
      type: Number,
      value: 0
    }
  },

  created: function() {
    this.__map = {};
  },

  attached: function() {
    this.__queryChanged(this.query, this.query);
  },

  detached: function() {
    if (this.query == null) {
      return;
    }

    this.__queryChanged(null, this.query);
  },

  child: function(key) {
    return this.__map[key];
  },

  get isNew() {
    return this.disabled || !this.__pathReady(this.path);
  },

  get zeroValue() {
    return [];
  },

  memoryPathToStoragePath: function(path) {
    var storagePath = this.path;

    if (path !== 'data') {
      var parts = path.split('.');
      var index = window.parseInt(parts[1], 10);

      if (index != null && !isNaN(index)) {
        parts[1] = this.data[index] != null && this.data[index].$key;
      }

      storagePath += parts.join('/').replace(/^data\.?/, '');
    }

    return storagePath;
  },

  storagePathToMemoryPath: function(storagePath) {
    var path = 'data';

    if (storagePath !== this.path) {
      var parts = storagePath.replace(this.path + '/', '').split('/');
      var key = parts[0];
      var datum = this.__map[key];

      if (datum) {
        parts[0] = this.__indexFromKey(key);
      }

      path += '.' + parts.join('.');
    }

    return path;
  },

  setStoredValue: function(storagePath, value) {
    if (storagePath === this.path || /\$key$/.test(storagePath)) {
      return Promise.resolve();
    } else if (/\/\$val$/.test(storagePath)) {
      return this._setFirebaseValue(storagePath.replace(/\/\$val$/, ''), value);
    } else {
      return this._setFirebaseValue(storagePath, value);
    }
  },

  _propertyToKey: function(property) {
    var index = window.parseInt(property, 10);
    if (index != null && !isNaN(index)) {
      return this.data[index].$key;
    }
  },

  __computeQuery: function(ref, orderByChild, orderByValue, limitToFirst, limitToLast, startAt, endAt, equalTo) {
    if (ref == null) {
      return null;
    }

    var query;

    if (orderByChild) {
      query = ref.orderByChild(orderByChild);
    } else if (orderByValue) {
      query = ref.orderByValue();
    } else {
      query = ref.orderByKey();
    }

    if (limitToFirst) {
      query = query.limitToFirst(limitToFirst);
    } else if (limitToLast) {
      query = query.limitToLast(limitToLast);
    }

    if (startAt) {
      query = query.startAt(startAt);
    }

    if (endAt) {
      query = query.endAt(endAt);
    }

    if (equalTo !== null) {
      query = query.equalTo(equalTo);
    }

    return query;
  },

  __pathChanged: function(path, oldPath) {
    // we only need to reset the data if the path is null (will also trigged when this element initiates)
    // When path changes and is not null, it triggers a ref change (via __computeRef(db,path)), which then triggers a __queryChanged setting data to zeroValue

    if (path == null) {
      this.syncToMemory(function() {
        this.data = this.zeroValue;
      });
    }
  },

  __queryChanged: function(query, oldQuery) {
    if (oldQuery) {
      oldQuery.off('value', this.__onFirebaseValue, this);
      oldQuery.off('child_added', this.__onFirebaseChildAdded, this);
      oldQuery.off('child_removed', this.__onFirebaseChildRemoved, this);
      oldQuery.off('child_changed', this.__onFirebaseChildChanged, this);
      oldQuery.off('child_moved', this.__onFirebaseChildMoved, this);

      this.syncToMemory(function() {
        this.__map = {};
        this.set('data', this.zeroValue);
      });
    }

    // this allows us to just call the addition of event listeners only once.
    // __queryChanged is being called thrice when firebase-query is created
    // 1 - 2. query property computed (null, undefined)
    // 3. when attached is called (this.query, this.query)
    // need help to fix this so that this function is only called once

    if (query) {
      if(this._onOnce){ // remove handlers before adding again. Otherwise we get data multiplying
        query.off('child_added', this.__onFirebaseChildAdded, this);
        query.off('child_removed', this.__onFirebaseChildRemoved, this);
        query.off('child_changed', this.__onFirebaseChildChanged, this);
        query.off('child_moved', this.__onFirebaseChildMoved, this);
      }

      this._onOnce = true;
      this._query = query

      // does the on-value first
      query.off('value', this.__onFirebaseValue, this)
      query.on('value', this.__onFirebaseValue, this.__onError, this)
    }
  },

  __indexFromKey: function(key) {
    if (key != null) {
      for (var i = 0; i < this.data.length; i++) {
        if (this.data[i].$key === key) {
          return i;
        }
      }
    }
    return -1;
  },

  __onFirebaseValue: function(snapshot) {
    if (snapshot.hasChildren()) {
      var data = [];
      snapshot.forEach(function(childSnapshot) {
        var key = childSnapshot.key;
        var value = this.__valueWithKey(key, childSnapshot.val())

        this.__map[key] = value;
        data.push(value)
      }.bind(this))

      this.set('data', data);
    }

    const query = this.query

    query.off('value', this.__onFirebaseValue, this)

    // ensures that all events are called once
    query.off('child_added', this.__onFirebaseChildAdded, this);
    query.off('child_removed', this.__onFirebaseChildRemoved, this);
    query.off('child_changed', this.__onFirebaseChildChanged, this);
    query.off('child_moved', this.__onFirebaseChildMoved, this);

    query.on('child_added', this.__onFirebaseChildAdded, this.__onError, this);
    query.on('child_removed', this.__onFirebaseChildRemoved, this.__onError, this);
    query.on('child_changed', this.__onFirebaseChildChanged, this.__onError, this);
    query.on('child_moved', this.__onFirebaseChildMoved, this.__onError, this);
  },

  __onFirebaseChildAdded: function(snapshot, previousChildKey) {
    var key = snapshot.key;

    // check if the key-value pair already exists
    if (this.__indexFromKey(key) >= 0) return

    var value = snapshot.val();
    var previousChildIndex = this.__indexFromKey(previousChildKey);

    this._log('Firebase child_added:', key, value);

    value = this.__snapshotToValue(snapshot);

    this.__map[key] = value;
    this.splice('data', previousChildIndex + 1, 0, value);
  },

  __onFirebaseChildRemoved: function(snapshot) {

    var key = snapshot.key;
    var value = this.__map[key];

    this._log('Firebase child_removed:', key, value);

    if (value) {
      this.__map[key] = null;
      this.async(function() {
        this.syncToMemory(function() {
          // this only catches already deleted keys (which will return -1)
          // at least it will not delete the last element from the array (this.splice('data', -1, 1))
          if (this.__indexFromKey(key) >= 0) {
            this.splice('data', this.__indexFromKey(key), 1);
          }
        });
      });
    }
  },

  __onFirebaseChildChanged: function(snapshot) {
    var key = snapshot.key;
    var prev = this.__map[key];

    this._log('Firebase child_changed:', key, prev);

    if (prev) {
      this.async(function() {
        var index = this.__indexFromKey(key);
        var value = this.__snapshotToValue(snapshot);

        this.__map[key] = value;

        this.syncToMemory(function() {
          // TODO(cdata): Update this as appropriate when dom-repeat
          // supports custom object key indices.
          if (value instanceof Object) {
            for (var property in value) {
              this.set(['data', index, property], value[property]);
            }
            for (var property in prev) {
              if(!value.hasOwnProperty(property)) {
                this.set(['data', index, property], null);
              }
            }
          } else {
            this.set(['data', index], value);
          }
        });
      });
    }
  },

  __onFirebaseChildMoved: function(snapshot, previousChildKey) {
    var key = snapshot.key;
    var value = this.__map[key];
    var targetIndex = previousChildKey ? this.__indexFromKey(previousChildKey) + 1 : 0;

    this._log('Firebase child_moved:', key, value,
        'to index', targetIndex);

    if (value) {
      var index = this.__indexFromKey(key);
      value = this.__snapshotToValue(snapshot);

      this.__map[key] = value;

      this.async(function() {
        this.syncToMemory(function() {
          this.splice('data', index, 1);
          this.splice('data', targetIndex, 0, value);
        });
      });
    }
  },

  __valueWithKey: function(key, value) {
    var leaf = typeof value !== 'object';

    if (leaf) {
      value = {$key: key, $val: value};
    } else {
      value.$key = key;
    }
    return value;
  },

  __snapshotToValue: function(snapshot) {
    var key = snapshot.key;
    var value = snapshot.val();

    return this.__valueWithKey(key, value);
  }
});
