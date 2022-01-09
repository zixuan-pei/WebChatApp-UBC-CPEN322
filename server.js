const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const express = require('express');
const ws = require('ws');
const Database = require('./Database');
const SessionManager = require('./SessionManager');

/* I refer to https://stackoverflow.com/a/48226843 for help. */
function sanitize(string) {
	const map = {
		'&': '&amp;',
		'<': '&lt;',
		'>': '&gt;',
		// '"': '&quot;',
		// "'": '&#x27;',
		// "/": '&#x2F;',
	};
	// const reg = /[&<>"'/]/ig;
	const reg = /[&<>]/ig;
	return string.replace(reg, (match)=>(map[match]));
}

function logRequest(req, res, next) {
	console.log(`${new Date()}  ${req.ip} : ${req.method} ${req.path}`);
	next();
}

function isCorrectPassword(password, saltedHash) {
	return saltedHash.substring(20) === crypto.createHash('sha256').update(password + saltedHash.substring(0, 20)).digest('base64');
}

const host = 'localhost';
const port = 3000;
const clientApp = path.join(__dirname, 'client');
const broker = new ws.Server({port: 8000});
const db = new Database("mongodb://localhost:27017", "cpen322-messenger");
const sessionManager = new SessionManager();

let messages = {};
db.getRooms().then((rooms) => {
		for(let i = 0; i < rooms.length; i++)
			messages[rooms[i]._id.toString()] = [];
	}, (err) => {
		console.log(err);
	});

let messageBlockSize = 10;

broker.on("connection", (curClient, request) => {
	function readCookie(name, cookies) {
		let cookieName = name + "=";
		let ca = cookies.split(';');
		for (let i = 0; i < ca.length; i++) {
			let c = ca[i];
			while (c.charAt(0) === ' ') c = c.substring(1,c.length);
			if (c.indexOf(cookieName) === 0) return c.substring(cookieName.length,c.length);
		}
		return null;
	}

	let cookies = request.headers.cookie;
	if (cookies) {
		let cookie = readCookie("cpen322-session", cookies);
		if (!cookie) curClient.close();
		else if (!sessionManager.getUsername(cookie)) curClient.close();
		else {
			curClient.on("message", (data) => {
				let msg = JSON.parse(data);
				let roomId = msg.roomId;
				msg.username = sessionManager.getUsername(cookie);
				msg.text = sanitize(msg.text);
				let message = {
					username: msg.username,
					text: msg.text
				}
				broker.clients.forEach((client) => {
					if (client !== curClient) {
						client.send(JSON.stringify(msg));
					}
				});
				if (messages[roomId]) {
					messages[roomId].push(message);
				} else {
					messages[roomId] = [];
					messages[roomId].push(message);
				}
				if (messages[roomId].length === messageBlockSize) {
					let conversation = {};
					conversation.messages = messages[roomId];
					conversation.room_id = roomId;
					conversation.timestamp = Date.now();
					db.addConversation(conversation);
					messages[roomId] = [];

				}
			});
		}
	} else curClient.close();

});

// express app
let app = express();

app.use(express.json()) 						// to parse application/json
app.use(express.urlencoded({ extended: true })) // to parse application/x-www-form-urlencoded
app.use(logRequest);							// logging for debug

app.use("/index.html", sessionManager.middleware, express.static(clientApp + "/index.html"));
app.use("/index", sessionManager.middleware, express.static(clientApp + "/index"));
app.use("/app.js", sessionManager.middleware, express.static(clientApp + "/app.js"));
app.use("/+", sessionManager.middleware, express.static(clientApp + "/index.html"))

app.route('/chat')
	.get(sessionManager.middleware, (req, res, next) => {
		db.getRooms().then((rooms) => {
			let roomsWithMessage = rooms.map((room) => Object.assign({messages: messages[room._id.toString()]}, room));
			res.status(200).send(JSON.stringify(roomsWithMessage));
			res.end();
		});
	})
	.post(sessionManager.middleware, (req, res, next) => {
		if(!req.body.name)
			res.status(400).send(JSON.stringify(new Error("No name field.")));
		else {
			let uid = 'id-' + (new Date()).getTime();
			let room = {
				_id: uid,
				name: req.body.name,
				image: req.body.image
			}
			messages[uid] = [];
			db.addRoom(room);
			res.status(200).send(JSON.stringify(room));
		}
		res.end();
	});




app.route('/chat/:room_id').get(sessionManager.middleware, (req, res) => {
	db.getRoom(req.params.room_id).then(room => {
		if (room) res.status(200).send(JSON.stringify(room));
		else res.status(404).send();
	}, err => {
		console.log(err);
	})
});

app.route('/chat/:room_id/messages').get(sessionManager.middleware, (req, res) => {
	db.getLastConversation(req.params.room_id, req.query.before).then(conversation => {
		if (conversation) res.status(200).send(JSON.stringify(conversation));
		else res.status(404).send();
	}, err => {
		console.log(err);
	})
});

app.route('/login').post((req, res) => {
	db.getUser(req.body.username).then(user => {
		if (!user) res.redirect('/login').send();
		else {
			if (isCorrectPassword(req.body.password, user.password)) {
				sessionManager.createSession(res, user.username, 600000);
				res.redirect('/').send();
			}
			else res.redirect('/login').send();
		}
	}, err => {
		console.log(err);
	})
});

app.route('/profile').get(sessionManager.middleware, (req, res) => {
	res.status(200).send(JSON.stringify({username: req.username}));
});

app.route('/logout').get(sessionManager.middleware, (req, res) => {
	sessionManager.deleteSession(req);
	res.redirect('/login').send();
});

// serve static files (client-side)
app.use('/', express.static(clientApp, { extensions: ['html'] }));
app.listen(port, () => {
	console.log(`${new Date()}  App Started. Listening on ${host}:${port}, serving ${clientApp}`);
});

app.use((err, req, res, next) => {
	if (err instanceof SessionManager.Error) {
		if (req.headers.accept === "application/json")
			res.status(401).send();
		else
			res.redirect('/login').send();
	} else res.status(500).send();
});


