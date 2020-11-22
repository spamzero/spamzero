/**
 * Spam Zero 0.0.2
 *
 * https://github.com/spamzero/spamzero
 */

/**
 * The threads you want to process. A thread (GmailThread) consists
 * of multiple messages (GmailMessage).
 *
 * @type {GmailThread[]}
 *
 * @see https://developers.google.com/apps-script/reference/gmail/
 */
var threads = GmailApp.search('in:spam label:unread');

/**
 * The action(s) to take on the threads matching your rules.
 *
 * Possible values are: READ, MOVE_TO_TRASH, LABEL(name).
 * You can also use multiple actions ["READ", "LABEL(Some label)"].
 */
var actions = ["READ"];

/**
 * Your custom rules that are going to be tested against your messages.
 *
 * Each item in the rules array should be a function that takes two parameters.
 *
 * The first parameter is a GmailMessage, the second is an Object which contains the message's raw content.
 *
 * It has the following structure:
 *
 * {
 *   headers: {
 *     "from": "From <from@address.com>"
 *     "to": "to@address.com",
 *     "subject: "Subject"
 *     "received": "from some.domain.com ([42.42.42.42]) by mx.google.com...",
 *     "content-type: "text/html; charset=UTF-8",
 *     // etc. all other headers are available here that you can see opening up "Show original"
 *   },
 *
 *   body: {
 *     "<html><body>The body of the message</body></html>"
 *   }
 * }
 *
 * Return true from your function if you want your selected action(s) to be run on the entire thread.
 *
 * You can also add a one line description that will show up in the logs (provided isDebug is true, see below).
 *
 * Make sure the description is on the first line between double quotes. No need for trailing semicolons.
 *
 * Sample rules are provided below.
 *
 * @type {Function[]}
 */
var rules = [
    /**
     * @param {GmailMessage} m
     * @param {Object} raw
     *
     * @return {Boolean}
     */
    function(m, raw) {
        "Goomoji + name in subject"
        return StringHelper.containsGoomoji(raw.headers.subject) && raw.headers.subject.match(/john.doe/i);
    },

    function(m, raw) {
        "From *.ru + image attachment"
        var ruSender = m.getFrom().match(/\.ru>?$/);
        var withImageAttachment = MessageHelper.hasImageAttachment(m);

        return ruSender && withImageAttachment;
    },

    function(m, raw) {
        "Profanity filter"
        var matchers = [/slut/i, /f.ck/i, /s.ck/i, /c.ck/i, /lady/i, /h..kup/i, /cum/i, /babe/i, /p.rn/i, /s[e3\*\.]xy?/i, /house\s?wife/i];

        for (var i = 0; i < matchers.length; i++) {
            if (raw.headers.subject.match(matchers[i]) || raw.body.match(matchers[i]) || raw.headers.from.match(matchers[i])) {
                return true;
            }
        }

        return false;
    },

    function(m, raw) {
        "Has link to dropbox in body"
        return raw.body.match(/dl\.dropboxusercontent\.com/i)
    },

    function(m, raw) {
        "Shortened url in body"
        var matchers = [/bit\.ly/i, /tinyurl\.com/i, /goo\.gl/];

        for (var i = 0; i < matchers.length; i++) {
            if (raw.body.match(matchers[i])) {
                return true;
            }
        }

        return false;
    },

    function(m, raw) {
        "From: *.club, *.date, *.top, etc."
        return m.getFrom().match(/(\.club|\.date|\.top|\.xyz|\.trade|\.party)>?$/i);
    },

    function(m, raw) {
        "URL to *.club, *.date, *.top, etc."
        return raw.body.match(/(https?|www).+(\.club|\.date|\.top|\.xyz|\.trade|\.party)/i);
    },

    function(m, raw) {
        "URL to a .php site & 'confidential' / 'broken' words in body"
        return raw.body.match(/(https?|www).+\.php/i) && raw.body.match(/(confidential|broken)/i);
    }
];

// Debug mode (will log events, use the log viewer [View / Show logs] to view them)
var isDebug = true;

// Use these helper methods in your rules
var MessageHelper = {
    /**
     * @param {GmailMessage} message
     *
     * @return {Boolean}
     */
    hasImageAttachment: function(message) {
        var attachments = message.getAttachments();
        for (var i = 0; i < attachments.length; i++) {
            if (attachments[i].getContentType().match(/image/)) {
                return true;
            }
        }

        return false;
    }
};

var StringHelper = {
    /**
     * Checks whether the given string contains a goomoji.
     *
     * What's a goomoji? http://stackoverflow.com/questions/28095387/animated-icon-in-email-subject
     *
     * Goomojis in the subject field are perfect indicators of a message being spam.
     * Hopefully they will keep using it.
     *
     * @param {String} string
     *
     * @return {Boolean}
     */
    containsGoomoji: function(string) {
        // FIXME. This will return true for any non ASCII text
        return string.match(/=\?UTF-8\?B\?[^\?]+\?=/i);
    }
};

// Probably you won't need to edit the code below

var getLogger = function() {
    if (isDebug) {
        return Logger;
    } else {
        return {
            clear: function () {},
            log: function () {},
            getLog: function () {}
        }
    }
};

// Logger function for Google SpreadSheets

var getSpreadsheetLogger = function() {
  // put the URL of your Google Sheet below:
    const SheetURL = "https://docs.google.com/spreadsheets/d/XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX/edit";
    var SpreadSheet = SpreadsheetApp.openByUrl(SheetURL);

    SpreadSheet.appendRow([Logger.getLog()])
}

/**
 * Checks whether the given thread's messages matches any of your rules.
 * Only one message needs to be matched by your rules for this function to return true.
 *
 * @param {GmailThread} thread
 *
 * @return {Boolean}
 */
var anyMessageMatchesAnyRuleInThread = function(thread) {
    var messages = thread.getMessages();

    for (var i = 0; i < messages.length; i++) {
        var raw = parseRawContent(messages[i].getRawContent());

        for (j = 0; j < rules.length; j++) {
            if (rules[j](messages[i], raw)) {
                var ruleDescription = parseRuleDescription(rules[j]);
                getLogger().log('"' + messages[i].getSubject() + '" matched rule "' + (ruleDescription ? ruleDescription : j) + '"');
                return true;
            }
        }
    }

    return false;
};

/**
 * Parses the raw message into an object. For the returned object's format see the rule array's description.
 *
 * @param {String} rawContent
 *
 * @return {Object}
 */
var parseRawContent = function(rawContent) {
    var lines = rawContent.split("\n");
    var result = {};
    var headers = {};
    var body = "";

    var currentHeaderKey = null;
    var headerParsed = false;

    for (var i = 0; i < lines.length; i++) {
        if (lines[i].trim() === "") {
            if (headers.date === undefined) {
                continue;
            }

            headerParsed = true;
            continue;
        }

        if (!headerParsed) {
            var headerParts = lines[i].match(/^([-a-z]+):(.*)/i);

            if (headerParts) {
                currentHeaderKey = headerParts[1].toLowerCase();
                headers[currentHeaderKey] = headerParts[2].trim();
            } else {
                // Header continues on new line
                headers[currentHeaderKey] += " " + lines[i].trim();
            }
        } else {
            body += lines[i];
        }
    }

    if (headers["content-transfer-encoding"] === "base64") {
        try {
            body = Utilities.newBlob(Utilities.base64Decode(body)).getDataAsString();
        } catch (err) {
            getLogger().log("Could not base64 decode body.")
        }
    }

    result.headers = headers;
    result.body = body;

    return result;
};

/**
 * Extracts the description from a rule.
 *
 * @param {Function} func
 *
 * @return {String}
 */
var parseRuleDescription = function(func) {
    var lines = func.toString().split("\n");

    for (var i = 0; i < lines.length; i++) {
        var matches = lines[i].trim().match(/^"([^"]+)";?$/)
        if (matches) {
            return matches[1];
        }
    }

    return "";
};

var ReadAction = function () {
    this.run = function (thread) {
        thread.markRead();
    }
};

var MoveToTrashAction = function () {
    this.run = function (thread) {
        thread.moveToTrash();
    }
};

var LabelAction = function (labelName) {
    this.run = function (thread) {
        var label = GmailApp.getUserLabelByName(labelName);

        if (!label) {
            label = GmailApp.createLabel(labelName);
        }

        thread.addLabel(label);
    }
};

var ActionFactory = {
    create: function(actionName) {
        if (actionName === "READ") {
            return new ReadAction();
        }

        if (actionName === "MOVE_TO_TRASH") {
            return new MoveToTrashAction();
        }

        var labelParts = actionName.match(/LABEL\((.+)\)/i)
        if (labelParts) {
            return new LabelAction(labelParts[1]);
        }

        throw "Unknown action: " + actionName;
    }
};

var runActionsOnThread = function(thread) {
    for (var i = 0; i < actions.length; i++) {
        var action = ActionFactory.create(actions[i]);
        getLogger().log('Running action "' + actions[i] + '"');
        action.run(thread);
//Record the event to the Spreadsheet:
        getSpreadsheetLogger()
    }
};

/**
 * The main function. This should be the function chosen in the execute dropdown
 * in the script editor toolbar above.
 */
function main() {
    getLogger().clear();

    for (var i = 0; i < threads.length; i++) {
        if (i > 0) {
            getLogger().log("---");
        }

        getLogger().log("Processing thread number " + i);

        if (anyMessageMatchesAnyRuleInThread(threads[i])) {
            runActionsOnThread(threads[i]);
        } else {
            getLogger().log("No action taken because none of your rules were matching this thread.");
        }
    }
}
