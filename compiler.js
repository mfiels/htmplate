/**
 * A pre-processor responsible for cleaning up input formatting before compilation.
 **/
function PreProcessor(content) {
  this.lines = content.split('\n');
}

PreProcessor.INDENTED_WITH_SPACES = 1;
PreProcessor.INDENTED_WITH_TABS = 2;

/**
 * Replace all empty lines and replace all spaces with tabs for easier compilation.
 **/
PreProcessor.prototype.process = function() {
  this._removeEmptyLines();
  var indentationType = this._getIndentationType();
  if (indentationType == PreProcessor.INDENTED_WITH_SPACES) {
    var spacesPerTab = this._getSpacesPerTab();
    this._replaceSpacesWithTabs(spacesPerTab);
  }
  return this.lines.join('\n');
};

/**
 * Make shift way of determining if the input is indented with spaces or tabs.
 **/
PreProcessor.prototype._getIndentationType = function() {
  for (var i = 0; i < this.lines.length; i++) {
    if (this.lines[i][0] == ' ') {
      return PreProcessor.INDENTED_WITH_SPACES;
    } else if (this.lines[i][0] == '\t') {
      return PreProcessor.INDENTED_WITH_TABS;
    }
  }
  return PreProcessor.INDENTED_WITH_TABS;
};

/**
 * Make shift way of determining the number of spaces used to indent the input.
 **/
PreProcessor.prototype._getSpacesPerTab = function() {
  for (var i = 0; i < this.lines.length; i++) {
    if (this.lines[i][0] == ' ') {
      var spacesPerTab = 0;
      for (var j = 0; j < this.lines[i].length; j++) {
        if (this.lines[i][j] == ' ') {
          spacesPerTab++;
        } else {
          return spacesPerTab;
        }
      }
    }
  }

  return 0;
};

/**
 * Remove all empty lines.
 **/
PreProcessor.prototype._removeEmptyLines = function() {
  for (var i = 0; i < this.lines.length; i++) {
    if (this.lines[i].trim().length == 0) {
      this.lines.splice(i, 1);
      i--;
      continue;
    }
  }
};

/**
 * Splice out spaces and replace with tabs.
 **/
PreProcessor.prototype._replaceSpacesWithTabs = function(spacesPerTab) {
  for (var i = 0; i < this.lines.length; i++) {
    var spacesEndAt = -1;
    for (var j = 0; j < this.lines[i].length; j++) {
      if (this.lines[i][j] != ' ') {
        spacesEndAt = j;
        break;
      }
    }

    if (spacesEndAt != -1) {
      var numTabs = spacesEndAt / spacesPerTab
      var tabs = '';
      for (var j = 0; j < numTabs; j++) {
        tabs += '\t';
      }
      this.lines[i] = tabs + this.lines[i].substring(spacesEndAt);
    }
  }
};

function Compiler(content) {
  this.content = content;
  this.lines = this._getLineObjects();

  this._expandSingleLineStatements();
  this._parseLines();
}

Compiler.STATE_TAG = 1;
Compiler.STATE_ID = 2;
Compiler.STATE_CLASS = 4;
Compiler.STATE_PROPS = 8;

Compiler.Line = function(line, level) {
  this.line = line;
  this.level = level;

  this.tag = null;
  this.props = {};
};

Compiler.Line.NO_TAG = 1;

Compiler.prototype.compile = function() {
  var compiled = '';
  var lineStack = [];

  for (var i = 0; i < this.lines.length; i++) {
    while (lineStack.length > 0 && lineStack[lineStack.length - 1].level >= this.lines[i].level) {
      var top = lineStack.pop();
      compiled += this._getClosingTag(top);
    }
    lineStack.push(this.lines[i]);
    compiled += this._getOpeningTag(this.lines[i]);
  }

  while (lineStack.length > 0) {
    compiled += this._getClosingTag(lineStack.pop());
  }

  return compiled;
};

Compiler.prototype._getOpeningTag = function(line) {
  var tabs = '';
  for (var i = 0; i < line.level; i++) {
    tabs += '\t';
  }

  if (line.tag == Compiler.Line.NO_TAG) {
    return tabs + line.line + '\n';
  }

  var tag = tabs + '<' + line.tag;
  for (var key in line.props) {
    tag += ' ' + key + '=' + '"' + line.props[key] + '"';
  }
  tag += '>';

  return tag + '\n';
};

Compiler.prototype._getClosingTag = function(line) {
  if (line.tag == Compiler.Line.NO_TAG) {
    return '';
  }

  var tabs = '';
  for (var i = 0; i < line.level; i++) {
    tabs += '\t';
  }
  return tabs + '</' + line.tag + '>' + '\n';
};

Compiler.prototype._getLineObjects = function() {
  var lineObjects = [];
  var lines = this.content.split('\n');

  for (var i = 0; i < lines.length; i++) {
    var numTabs = 0;
    for (var j = 0; j < lines[i].length; j++) {
      if (lines[i][j] == '\t') {
        numTabs++;
      } else {
        break;
      }
    }
    var line = lines[i].substring(numTabs).trim();
    lineObjects.push(new Compiler.Line(line, numTabs));
  }

  return lineObjects;
};

Compiler.prototype._expandSingleLineStatements = function() {
  for (var i = 0; i < this.lines.length; i++) {
    var line = this.lines[i].line;
    var level = this.lines[i].level;
    var inParens = false;
    for (var j = 0; j < line.length; j++) {
      if (line[j] == '(') {
        inParens = true;
      } else if (line[j] == ')') {
        inParens = false;
      } else if (!inParens && line[j] == ':') {
        var nextLine = line.substring(j + 1).trim();
        if (nextLine.length != 0) {
          this.lines.splice(i + 1, 0, new Compiler.Line(nextLine, level + 1));
          this.lines[i].line = line.substring(0, j + 1);
        }
        break;
      }
    }
  }
};

Compiler.prototype._parseLines = function() {
  for (var i = 0; i < this.lines.length; i++) {
    this.lines[i].tag = this._parseTag(this.lines[i].line);

    var id = this._parseId(this.lines[i].line);
    if (id) {
      this.lines[i].props['id'] = id;
    }

    var classes = this._parseClasses(this.lines[i].line);
    if (classes) {
      this.lines[i].props['class'] = classes;
    }

    var props = this._parseProps(this.lines[i].line);
    for (var key in props) {
      this.lines[i].props[key] = props[key];
    }
  }
};

Compiler.prototype._parseTag = function(line) {
  for (var i = 0; i < line.length; i++) {
    if (line[i] == '#' || line[i] == '.' || line[i] == '(' || line[i] == ':') {
      return line.substring(0, i);
    }
  }
  return Compiler.Line.NO_TAG;
};

Compiler.prototype._parseId = function(line) {
  for (var i = 0; i < line.length; i++) {
    if (line[i] == '#') {
      var startsAt = i + 1;
      for (var j = i + 1; j < line.length; j++) {
        if (line[j] == '.' || line[j] == '(' || line[j] == ':') {
          return line.substring(startsAt, j);
        }
      }
    }
  }
  return undefined;
};

Compiler.prototype._parseClasses = function(line) {
  var classes = [];
  var inParens = false;
  for (var i = 0; i < line.length; i++) {
    if (line[i] == '(') {
      inParens = true;
    } else if (line[i] == ')') {
      inParens = false;
    } else if (!inParens && line[i] == '.') {
      var startsAt = i + 1;
      for (var j = i + 1; j < line.length; j++) {
        if (line[j] == '.' || line[j] == '(' || line[j] == ':' || line[j] == '#') {
          classes.push(line.substring(startsAt, j));
          break;
        }
      }
    }
  }
  return classes.length > 0 ? classes.join(' ') : undefined;
};

Compiler.prototype._parseProps = function(line) {
  var inParens = false;
  var parensStartAt = -1;
  var parensEndAt = -1;

  for (var i = 0; i < line.length; i++) {
    if (!inParens && line[i] == '(') {
      inParens = true;
      parensStartAt = i;
    } else if (inParens && line[i] == ')') {
      parensEndAt = i;
      break;
    }
  }

  if (parensEndAt == -1) {
    return {};
  }

  var parenContents = line.substring(parensStartAt + 1, parensEndAt).trim();

  var props = {};
  var propName = null;
  var propStartsAt = -1;
  for (var i = 0; i < parenContents.length; i++) {
    if (propStartsAt == -1) {
      propStartsAt = i;
    } else if (parenContents[i] == ':') {
      propName = parenContents.substring(propStartsAt, i);
      i++;
      while (parenContents[i] == ' ') {
        i++;
      }
      propStartsAt = i;
      while (i < parenContents.length && parenContents[i] != ' ') {
        i++;
      }
      props[propName] = parenContents.substring(propStartsAt, i);
      propStartsAt = -1;
      while (parenContents[i] == ' ') {
        i++;
      }
    }
  }

  return props;
};

var fs = require('fs');
var fileBuffer = fs.readFileSync('test.tmpl').toString('ascii');
var content = fileBuffer.toString('ascii');

var SPACES_PER_TAB = 2;

var pp = new PreProcessor(content);
content = pp.process();

var cc = new Compiler(content);
console.log(cc.lines);
content = cc.compile();

fs.writeFileSync('test.html', content, 'ascii');
