const MongoClient = require('mongodb').MongoClient;
const assert = require('assert');
const { inspect } = require('util');

const DATA = [{
  _id: 0,
  name: 'A',
  posts: [],
}, {
  _id: 1,
  name: 'B',
  posts: [{
    _id: 0,
    when: new Date('January 2, 2018 00:00:00'),
    msg: 'Happy New Year from B',
    comments: [],
  }, {
    _id: 0,
    when: new Date('Feburary 2, 2018 00:00:00'),
    msg: 'Hello from B',
    comments: [{
      _id: 0,
      when: new Date('Feburary 3, 2018 00:00:00'),
      msg: 'Howdy B',
    }, {
      _id: 1,
      when: new Date('Feburary 4, 2018 00:00:00'),
      msg: 'Back at you B',
    }, {
      _id: 2,
      when: new Date('Feburary 5, 2018 00:00:00'),
      msg: 'Random on B',
    }],
  }, {
    _id: 1,
    when: new Date('Feburary 3, 2018 00:00:00'),
    msg: 'Another from B',
    comments: [{
      _id: 0,
      when: new Date('January 3, 2018 00:00:00'),
      msg: 'Back at you B another',
    }],
  }],
}, {
  _id: 2,
  name: 'C',
  posts: [{
    _id: 0,
    when: new Date('Feburary 2, 2018 00:00:00'),
    msg: 'Hello from C',
    comments: [],
  }],
}];
const url = 'mongodb://localhost:27017';
const dbName = 'test';
MongoClient.connect(url, function(err, client) {
  assert.equal(null, err);
  const db = client.db(dbName);
  const accounts = db.collection('accounts');
  accounts.createIndex({ 'name': 1 })
    .then(() => accounts.createIndex({ 'posts.when': -1 }))
    .then(() => accounts.insertMany(DATA))
    .then(() => accounts.aggregate([
      // UNWINDING POSTS
      { $unwind: {
          path: '$posts',
          preserveNullAndEmptyArrays: true,
      } },
      // ONLY THOSE POSTS IN FEBURARY
      { $match: {
        $or: [
          { 'posts': undefined, }, // CASE NO POSTS
          { $and: [
              { 'posts.when': { $gte: new Date('Feburary 1, 2018 00:00:00') } },
              { 'posts.when': { $lt: new Date('March 1, 2018 00:00:00') } },
            ],
          },
        ],
      } },
      // UNWINDING COMMENTS
      { $unwind: {
          path: '$posts.comments',
          preserveNullAndEmptyArrays: true,
      } },
      // REASSEMBLE COMMENTS WITH FIRST COMMENT ONLY
      { $group: {
        _id: {
          _id: '$_id',
          name: '$name',
          posts: {
            _id: '$posts._id',
            when: '$posts.when',
            msg: '$posts.msg',
          },
        },
        comments: {
          $first: '$posts.comments',
        },
      } },
      // FIX EMPTY COMMENTS
      { $project: {
        comments: {
          $cond: {
            if: {
              $eq: [ '$comments', null ],
            },
            then: [],
            else: [ '$comments' ],
          },
        },
      } }, 
      // REASSEMBLE POSTS
      { $group: {
        _id: '$_id._id',
        name: { $first: '$_id.name' },
        posts: {
          $push: {
            _id: '$_id.posts._id',
            when: '$_id.posts.when',
            msg: '$_id.posts.msg',
            comments: '$comments',
          },
        },
      } },
      // FIX EMPTY POSTS
      { $project: {
        name: true,
        posts: {
          $cond: {
            if: {
              $eq: [ '$posts', [{ comments: [] }] ],
            },
            then: [],
            else: [ '$posts' ],
          },
        },
      } }, 
    ]).toArray())
    .then(results => {
      console.log(inspect(results, false, null));
    })
    .then(() => accounts.deleteMany({}))
    .then(() => client.close());
});
