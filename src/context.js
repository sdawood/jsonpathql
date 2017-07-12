const _ = require('lodash');
const transition = require('./transition');

const ResourceNode = function () {
    this.initialize();
}

ResourceNode.prototype.initialize = function (branch) {
    this.origin = branch || 'master';
    this.version = -1;
    this.revision = -1; // alias for branch
    this.commit = 0;
    this.versionTags = [];
    this.revisionTags = [];
    this.commitMessages = []; // every new revision or version carries all the history, consider data structure sharing
    this.options = {};
}

ResourceNode.prototype.$quoteAll = $quoteAll;
ResourceNode.prototype.$escapeAll = $escapeAll;

const ContextManager = function () {
    this._branches = {master: [new ResourceNode()]};
    this._currentBranch = 'master';
}

ContextManager.prototype.initialize = function () {
}

ContextManager.prototype.transition = transition.transition;
ContextManager.prototype.tags = transition.tags;

ContextManager.prototype.node = function (hunks, message, branch) { //sugar for bulk push and head
    if (hunks === undefined) return this.head();

    // normalize arguments, single arg can be an array, or an object
    const nodeList = (hunks instanceof Array) ? hunks : [hunks];
    nodeList.forEach(function (hunk) {
        const head = this.head(branch); // get a fresh copy
        head.version += 1;
        head.versionTags.push(message || '');
        this.commit(hunk, message, branch, head);
    }.bind(this));
    return this.head(branch);
}

ContextManager.prototype.branch = function (hunks, message, name) { //sugar for bulk branch push and head (head alias is by convention used by branching code only)
    if (hunks === undefined) return this.head();

    // normalize arguments, hunks argument can be an array or an object
    const nodeList = (hunks instanceof Array) ? hunks : [hunks];
    nodeList.forEach(function (hunk) {
        const head = this.head(); // get a fresh copy of current branch head
        head.revision += 1;
        head.revisionTags.push(message || '');
        this.commit(hunk, message, name, head);
    }.bind(this));
    return this.head(name);
}

ContextManager.prototype._push = function (node, branch) {
    branch = branch ? branch : this._currentBranch;
    node.origin = this._currentBranch;
    this._currentBranch = branch;
    if (this._branches[branch]) {
        this._branches[branch].push(node);
    } else {
        this._branches[branch] = [node];
    }
    return this.head(branch);
}

ContextManager.prototype.commit = function (hunk, message, branch, headRef, force) {
    force = force || true;
    const head = headRef || this.head(branch);
    head.commit += 1;
    head.commitMessages.push(message || '');
    const merged = hunk ? this.merge(head, hunk, force) : head;
    return this._push(merged, branch);
}

ContextManager.prototype.merge = function (target, sources, force) {
    function latest(before, after) {
        return after; // overwrite {x: {value0: 0}} by {x: {value1: 1}}, destructive for existing keys (~lines)
    }

    return _.merge(target, sources, force ? latest : null);
}

ContextManager.prototype.head = function (branch) {
    const head = this.merge(new ResourceNode(), this._branches[branch || this._currentBranch].slice(-1)[0]); // get a fresh copy, no reference attached to user code
    return head;
}

ContextManager.prototype.switch = function (branch) {
    this._currentBranch = branch || 'master';
    return this.head(this._currentBranch);
}

function $escape(string) {
    return (String(string)).replace(/["'\\\n\r\u2028\u2029]/g, character => {
        // Escape all characters not included in SingleStringCharacters and
        // DoubleStringCharacters on
        // http://www.ecma-international.org/ecma-262/5.1/#sec-7.8.4
        switch (character) {
            case '"':
            case "'":
            case '\\':
                return '\\' + character;
            // Four possible LineTerminator characters need to be escaped:
            case '\n':
                return '\\n';
            case '\r':
                return '\\r';
            case '\u2028':
                return '\\u2028';
            case '\u2029':
                return '\\u2029';
            default:
                return character;
        }
    });
}

function $escapeAll(...hunks) {
    return hunks.map($escape).join(',');
}

function $quoteAll(...hunks) {
    // hunks = (hunks instanceof Array ? hunks : [hunks]).concat(Array.prototype.slice.call(arguments, 1));
    return hunks.map(value => `"${value}"`).join(',');
}

module.exports = {
    ContextManager: ContextManager,
    ResourceNode: ResourceNode
};