const { MongoClient, ObjectID } = require('mongodb');	// require the mongodb driver

/**
 * Uses mongodb v3.6+ - [API Documentation](http://mongodb.github.io/node-mongodb-native/3.6/api/)
 * Database wraps a mongoDB connection to provide a higher-level abstraction layer
 * for manipulating the objects in our cpen322 app.
 */
function Database(mongoUrl, dbName){
    if (!(this instanceof Database)) return new Database(mongoUrl, dbName);
    this.connected = new Promise((resolve, reject) => {
        MongoClient.connect(
            mongoUrl,
            {
                useNewUrlParser: true
            },
            (err, client) => {
                if (err) reject(err);
                else {
                    console.log('[MongoClient] Connected to ' + mongoUrl + '/' + dbName);
                    resolve(client.db(dbName));
                }
            }
        )
    });
    this.status = () => this.connected.then(
        db => ({ error: null, url: mongoUrl, db: dbName }),
        err => ({ error: err })
    );
}

Database.prototype.getRooms = function(){
    return this.connected.then(db =>
        new Promise((resolve, reject) => {
            /* TODO: read the chatrooms from `db`
             * and resolve an array of chatrooms */
            db.collection('chatrooms').find({}).toArray((err, rooms) => {
                if (err)
                    reject(err);
                else
                    resolve(rooms);
            })
        })
    )
}

Database.prototype.getRoom = function(room_id){
    return this.connected.then(db =>
        new Promise((resolve, reject) => {
            /* TODO: read the chatroom from `db`
             * and resolve the result */
            if (ObjectID.isValid(room_id)) {
                db.collection('chatrooms')
                    .findOne({_id: ObjectID(room_id)})
                    .then((result) => { resolve(result); }, (err) => { reject(err); });
            }
            else if (typeof room_id === 'string') {
                db.collection('chatrooms')
                    .findOne({_id: room_id})
                    .then((result) => { resolve(result); }, (err) => { reject(err); });
            }
            else reject(new Error("room_id is not valid."));
        })
    )
}

Database.prototype.addRoom = function(room){
    return this.connected.then(db =>
        new Promise((resolve, reject) => {
            /* TODO: insert a room in the "chatrooms" collection in `db`
             * and resolve the newly added room */
            if (!room.name) reject(new Error("No name field."));
            else {
                if (!room._id) room._id = ObjectID();
                db.collection("chatrooms").insertOne(room, function (err) {
                    if (err) reject(err);
                    else resolve(room);
                });
            }
        })
    )
}

Database.prototype.getLastConversation = function(room_id, before){
    return this.connected.then(db =>
        new Promise((resolve, reject) => {
            /* TODO: read a conversation from `db` based on the given arguments
             * and resolve if found */
            if (!before) before = Date.now();
            db.collection("conversations")
                .find({ room_id: room_id })
                .toArray((err, conversations) => {
                    if (err) reject(err);
                    else if (!conversations) resolve(null);
                    else {
                        let conv = conversations.sort((a, b) => b.timestamp - a.timestamp).filter(c => {
                            if (c.timestamp) return c.timestamp < before;
                            else return false;
                        });
                        if (conv) resolve(conv[0]);
                        else resolve(null);
                    }
            })
        })
    )
}


Database.prototype.addConversation = function(conversation){
    return this.connected.then(db =>
        new Promise((resolve, reject) => {
            /* TODO: insert a conversation in the "conversations" collection in `db`
             * and resolve the newly added conversation */
            if (!conversation.timestamp || !conversation.room_id || !conversation.messages)
                reject(new Error("Invalid conversation."));
            else {
                db.collection("conversations").insertOne(conversation, function (err) {
                if (err) reject(err);
                else resolve(conversation);
            });

            }
        })
    )
}

Database.prototype.getUser = function(username){
    return this.connected.then(db =>
        new Promise((resolve, reject) => {
            /* TODO: insert a conversation in the "conversations" collection in `db`
             * and resolve the newly added conversation */
            db.collection('users')
                .findOne({username: username})
                .then((result) => { resolve(result); }, (err) => { reject(err); });
        })
    )
}
module.exports = Database;