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
  Array of rules provided by rules.gs add rules as needed.
 */
var rules = [ goomoji, idInSubject ];

// Debug mode (will log events, use the log viewer [View / Show logs] to view them)
var isDebug = true;

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
