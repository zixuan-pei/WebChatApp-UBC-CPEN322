let profile = {username: "Alice"};

let Service = {
    origin: window.location.origin,
    getAllRooms: () => {
        return new Promise((resolve, reject) => {
            let x = new XMLHttpRequest();
            x.open("GET", Service.origin + "/chat");
            x.onload = () => {
                if(x.status === 200)
                    resolve(JSON.parse(x.responseText));
                else
                    reject(new Error(x.responseText));
            }
            x.onerror = () => { reject(new Error("Client Error.")); };
            x.send();
        });
    },
    addRoom: data => {
        return new Promise((resolve, reject) => {
            let x = new XMLHttpRequest();
            x.open("POST", Service.origin + "/chat");
            x.onload = () => {
                if(x.status === 200)
                    resolve(JSON.parse(x.responseText));
                else
                    reject (new Error(x.responseText));
            }
            x.onerror = () => { reject(new Error("Client Error.")); };
            x.setRequestHeader("Content-Type", "application/json");
            x.send(JSON.stringify(data));
        });
    },

    getLastConversation: (roomId, before) => {
        return new Promise((resolve, reject) => {
            let x = new XMLHttpRequest();
            x.open("GET", Service.origin + "/chat/" + roomId + "/messages?before=" + before.toString());
            x.onload = () => {
                if(x.status === 200)
                    resolve(JSON.parse(x.responseText));
                else
                    reject(new Error(x.responseText));
            }
            x.onerror = () => { reject(new Error("Client Error.")); };
            x.send();
        })
    },

    getProfile: () => {
        return new Promise((resolve, reject) => {
            let x = new XMLHttpRequest();
            x.open("GET", Service.origin + "/profile");
            x.onload = () => {
                if(x.status === 200)
                    resolve(JSON.parse(x.responseText));
                else
                    reject(new Error(x.responseText));
            }
            x.onerror = () => { reject(new Error("Client Error.")); };
            x.send();
        });
    }
}

function* makeConversationLoader(room) {
    let last_timestamp = room.timestamp;
    let conversation;
    while (last_timestamp > 0 && room.canLoadConversation) {
        room.canLoadConversation = false;
        Service.getLastConversation(room.id, last_timestamp).then(conv => {
                if (conv) {
                    room.canLoadConversation = true;
                    last_timestamp = conv.timestamp;
                    room.addConversation(conv);
                    conversation = conv;
                }
            }, error => { console.log(error); });
        yield(conversation);
    }
}

class LobbyView {
    constructor(lobby) {
        this.lobby = lobby;
        this.elem = createDOM(`<div class = "content"> <ul class = "room-list"></ul> <div class = "page-control"> <input type="text" placeholder="Room title"/> <button>Create Room</button> </div> </div>`);
        this.listElem = this.elem.querySelector("ul.room-list")
        this.inputElem = this.elem.querySelector("input");
        this.buttonElem = this.elem.querySelector("button");

        this.lobby.onNewRoom = (room) => {
            let a, img, span, li;
            a = document.createElement('a');
            a.setAttribute('href', '#/chat/' + room.id);
            img = document.createElement('img');
            img.setAttribute('src', room.image);
            img.setAttribute('alt', "chat");
            span = document.createElement('span');
            span.innerText = room.name;
            a.appendChild(img);
            a.appendChild(span);
            li = document.createElement('li');
            li.appendChild(a);
            this.listElem.appendChild(li);
            this.listElem.scrollTop = this.listElem.scrollHeight;
        };

        this.buttonElem.addEventListener("click", () => {
            let value = this.inputElem.value;
            Service.addRoom({name: value, image: "assets/everyone-icon.png"})
                .then((room) => { this.lobby.addRoom(room._id, room.name, room.image); })
                .catch(error => error);
            this.inputElem.value = "";
        });

        this.redrawList();
    }

    redrawList() {
        emptyDOM(this.listElem);

        let room, a, img, span, li;
        for (let id in this.lobby.rooms) {
            room = this.lobby.rooms[id];
            a = document.createElement('a');
            a.setAttribute('href', '#/chat/' + room.id);
            img = document.createElement('img');
            img.setAttribute('src', room.image);
            img.setAttribute('alt', "chat");
            span = document.createElement('span');
            span.innerText = room.name;
            a.appendChild(img);
            a.appendChild(span);
            li = document.createElement('li');
            li.appendChild(a);
            this.listElem.appendChild(li);
        }
    }
}

class ChatView {
    constructor(socket) {
        this.room = null;
        this.elem = createDOM(`<div class = "content"><h4 class = "room-name"></h4><div class = "message-list"></div><div class = "page-control"><textarea wrap="off"></textarea><button>Send</button></div></div>`);
        this.titleElem = this.elem.querySelector("h4");
        this.chatElem = this.elem.querySelector("div.message-list");
        this.inputElem = this.elem.querySelector("textarea");
        this.buttonElem = this.elem.querySelector("button");
        this.socket = socket;

        this.buttonElem.addEventListener("click", () => {
            this.sendMessage();
        });
        this.inputElem.addEventListener("keyup", (e) => {
            if(!e.shiftKey && e.keyCode === 13) {
                this.sendMessage();
            }
        });
        this.chatElem.addEventListener("wheel", (e) => {
            if (this.chatElem.scrollTop === 0 && e.deltaY < 0 && this.room.canLoadConversation)
                this.room.getLastConversation.next();
        });
    }

    sendMessage() {
        this.room.addMessage(profile.username, this.inputElem.value.toString());
        this.socket.send(JSON.stringify({
            roomId: this.room.id,
            username: profile.username,
            text: this.inputElem.value
        }));
        this.inputElem.value = "";
    }

    setRoom(room) {
        if(room) {
            room.onNewMessage = (message) => {
                let span_1, span_2, div;
                span_1 = document.createElement('span');
                span_2 = document.createElement('span');
                span_1.className = "message-user";
                span_2.className = "message-text";
                span_1.innerText = message.username;
                span_2.innerText = message.text;
                div = document.createElement('div');
                if (message.username === profile.username)
                    div.className = "message my-message";
                else
                    div.className = "message";
                div.appendChild(span_1);
                div.appendChild(span_2);
                this.chatElem.appendChild(div);
                this.chatElem.scrollTop = this.chatElem.scrollHeight;
            };
            this.titleElem.innerText = room.name;
            emptyDOM(this.chatElem);
            let span_1, span_2, div;
            for (let i = 0; i < room.messages.length; i++) {
                span_1 = document.createElement('span');
                span_2 = document.createElement('span');
                span_1.className = "message-user";
                span_2.className = "message-text";
                span_1.innerText = room.messages[i].username;
                span_2.innerText = room.messages[i].text;
                div = document.createElement('div');
                if (room.messages[i].username === profile.username)
                    div.className = "message my-message";
                else
                    div.className = "message";
                div.appendChild(span_1);
                div.appendChild(span_2);
                this.chatElem.appendChild(div);
            }
        }
        this.room = room;
        this.room.onFetchConversation = conv => {
            let span_1, span_2, div;
            let hb = this.chatElem.scrollHeight;
            for (let i = 0; i < conv.messages.length; i++) {
                let index = conv.messages.length - 1 - i;
                span_1 = document.createElement('span');
                span_2 = document.createElement('span');
                span_1.className = "message-user";
                span_2.className = "message-text";
                span_1.innerText = conv.messages[index].username;
                span_2.innerText = conv.messages[index].text.replace(/&amp;/g, '&').replace(/&gt;/g, '>').replace(/&lt;/g, '<');
                div = document.createElement('div');
                if (conv.messages[index].username === profile.username)
                    div.className = "message my-message";
                else
                    div.className = "message";
                div.appendChild(span_1);
                div.appendChild(span_2);
                this.chatElem.prepend(div);
            }
            let ha = this.chatElem.scrollHeight;
            this.chatElem.scrollTop = ha - hb;
        }
    }
}

class ProfileView {
    constructor() {
        this.elem = createDOM(`
        <div class = "content">
            <div class = profile-form>
                <div class = "form-field" id = "profile-form-username">
                    <label for = "Username">Username:</label>
                    <input id = "Username" type="text"/>
                </div>
                <div class = "form-field" id = "profile-form-password">
                    <label for = "Password">Password:</label>
                    <input id = "Password" type="password"/>
                </div>
                <div class = "form-field" id = "profile-form-avatar">
                    <label for = "Avatar Image">Avatar Image:</label>
                    <img alt="profile" src = "/assets/profile-icon.png"/>
                    <input id = "Avatar Image" type="file"/>
                </div>
                <div class = "form-field" id = "profile-form-about">
                    <label for = "About">About:</label>
                    <textarea id = "About"></textarea>
                </div>
            </div>
            <div class = page-control>
                <button>Save</button>
            </div>
        </div>`);
    }
}

class Room {
    constructor(id, name, image="assets/everyone-icon.png", messages=[]) {
        this.id = id;
        this.name = name;
        this.image = image;
        this.messages = messages;
        this.timestamp = Date.now();
        this.canLoadConversation = true;
        this.getLastConversation = makeConversationLoader(this);
    };

    addMessage(username, text) {
        if(text.trim() !== "") {
            this.messages.push({username: username, text: text});
            if (this.onNewMessage !== undefined)
                this.onNewMessage({username: username, text: text});
        }
    };

    addConversation(conversation) {
        this.messages = conversation.messages.concat(this.messages);
        if (this.onFetchConversation !== undefined)
            this.onFetchConversation(conversation);
    }
}

class Lobby {
    constructor() {
        this.rooms = {};
    };
    getRoom(roomId) {
        return this.rooms[roomId];
    }
    addRoom(id, name, image, messages) {
        let newRoom = new Room(id, name, image, messages);
        this.rooms[newRoom.id] = newRoom;
        if(this.onNewRoom !== undefined)
            this.onNewRoom(newRoom);
    }
}


function main() {
    let lobby = new Lobby();
    let lobbyView = new LobbyView(lobby);
    let socket = new WebSocket("ws://localhost:8000");
    let chatView = new ChatView(socket);
    let profileView = new ProfileView();
    socket.addEventListener("message", (e) => {
        let msg = JSON.parse(e.data);
        let room = lobby.getRoom(msg.roomId);
        if(room)
            room.addMessage(msg.username, msg.text);
    });
    Service.getProfile().then(result => { profile = result; });
    let renderRoute = function() {
        let url = window.location.hash;
        let pageView;
        if(url === '#/') {
            pageView = document.getElementById("page-view");
            emptyDOM(pageView);
            pageView.appendChild(lobbyView.elem);
        } else if(url.includes('chat')) {
            let path = url.split("/");
            let roomId = path[path.length-1];
            let room = lobby.getRoom(roomId);
            chatView.setRoom(room, chatView);
            pageView = document.getElementById("page-view");
            emptyDOM(pageView);
            pageView.appendChild(chatView.elem);
        } else if(url.includes('profile')) {
            pageView = document.getElementById("page-view");
            emptyDOM(pageView);
            pageView.appendChild(profileView.elem);
        }
    };
    let refreshLobby = () => {
        Service.getAllRooms().then((serverRooms) => {
            for(let i = 0; i < serverRooms.length; i++) {
                let room = lobby.getRoom(serverRooms[i]._id);
                if(!room)
                    lobby.addRoom(serverRooms[i]._id, serverRooms[i].name, serverRooms[i].image, serverRooms[i].messages);
                else {
                    room.name = serverRooms[i].name;
                    room.image = serverRooms[i].image;
                }
            }
        },
        err => err);
    };

    window.addEventListener("popstate", renderRoute);
    renderRoute();
    refreshLobby();
    setInterval(refreshLobby, 5000);

}

window.addEventListener("load", main);

// Removes the contents of the given DOM element (equivalent to elem.innerHTML = '' but faster)
function emptyDOM (elem){
    while (elem.firstChild) elem.removeChild(elem.firstChild);
}

// Creates a DOM element from the given HTML string
function createDOM (htmlString){
    let template = document.createElement('template');
    template.innerHTML = htmlString.trim();
    return template.content.firstChild;
}
