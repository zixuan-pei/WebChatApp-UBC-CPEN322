const crypto = require('crypto');

class SessionError extends Error {}

function SessionManager (){
    // default session length - you might want to
    // set this to something small during development
    const CookieMaxAgeMs = 600000;

    // keeping the session data inside a closure to keep them protected
    const sessions = {};

    // might be worth thinking about why we create these functions
    // as anonymous functions (per each instance) and not as prototype methods
    this.createSession = (response, username, maxAge = CookieMaxAgeMs) => {
        /* To be implemented */
        let key = crypto.randomBytes(30).toString("hex");
        sessions[key] = {username: username, timestamp: Date.now()};
        response.cookie("cpen322-session", key, {maxAge: maxAge});
        setTimeout(() => { delete sessions[key]; }, maxAge);
    };

    this.deleteSession = (request) => {
        /* To be implemented */
        delete request.username;
        delete sessions[request.session];
        delete request.session;
    };

    this.middleware = (request, response, next) => {
        /* To be implemented */
        /* I referred to http://www.satya-weblog.com/2007/05/php-and-javascript-cookie.html for help */
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
            if (!cookie) next(new SessionError("No cpen322-session cookie."));
            let session = sessions[cookie];
            if (!session) next(new SessionError("Session not found."));
            else {
                request.username = session.username;
                request.session = cookie;
                next();
            }
        } else next(new SessionError("No cookie field."));
    };

    // this function is used by the test script.
    // you can use it if you want.
    this.getUsername = (token) => {
        return (token in sessions) ? sessions[token].username : null;
    }
}

// SessionError class is available to other modules as "SessionManager.Error"
SessionManager.Error = SessionError;

module.exports = SessionManager;