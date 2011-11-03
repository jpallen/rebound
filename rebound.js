var Base = require("./base");

var Rebound = module.exports = {};

Rebound.extend = function(base) {
    var extensions = Array.prototype.slice.call(arguments, 1);
    for (var i = 0; i < extensions.length; i++) {
        var extension = extensions[i];
        for (attribute in extension) {
            if (extension.hasOwnProperty(attribute)) {
                base[attribute] = extension[attribute];
            }
        }
    }
    return base;
}

Rebound.EventEmitter = Base.extend({
    constructor : function() {
        this.eventCallbacks = {};
    },

    on : function(event, callback) {
        this.eventCallbacks[event] = this.eventCallbacks[event] || [];
        this.eventCallbacks[event].push(callback);
        return this;
    },

    emit : function(event) {
        var argv = Array.prototype.slice.call(arguments, 1)

        var callbacks = this.eventCallbacks[event];
        if (callbacks) {
            for (var i = 0; i < callbacks.length; i++ ) {
                callbacks[i].apply(this, argv);
            }
        }
        return this;
    }
});

Rebound.ValueWatcher = Rebound.EventEmitter.extend({
    constructor : function() {
        this.base();
        this.$bindings = {};
    },

    setValue : function(name, value) {
        var oldValue = this[name];
        
        if (typeof value === "string") {
            this.$bindings[name] = new Rebound.Binding(value, this, name);
            this[name] = this.$bindings[name].evaluate();
        } else {
            this[name] = value;
        }

        this.emit("change:" + name, oldValue, value);
        return this[name];
    },

    getValue : function(name) {
        return this[name];
    }
});

Rebound.Binding = Base.extend({
    constructor : function(expression, object, attributeName) {
        this.expression     = Rebound.Expressions.Parser.parse(expression);
        this.object         = object;
        this.attributeName  = attributeName;

        // Get all the references in the expression
        var uncheckedExpressions = [this.expression];
        var references = [];
        while (uncheckedExpressions.length > 0) {
            var expression = uncheckedExpressions.pop();
            if (expression instanceof Rebound.Expressions.Reference) {
                references.push(expression);
            } else {
                uncheckedExpressions = uncheckedExpressions.concat(expression.getChildren());
            }
        }

        // Update the attribute whenever any of its references change
        for (var i = 0; i < references.length; i++) {
            var reference = references[i];
            var self = this;
            reference.getObject().on(
                "change:" + reference.getAttributeName(),
                function() {
                    object.setValue(attributeName, self.evaluate());
                }
            )
        }
    },

    evaluate : function() {
        return this.expression.evaluate();
    }
});

Rebound.Point = Rebound.ValueWatcher.extend();

Rebound.Expressions = {};
Rebound.Expressions.Addition = Base.extend({
    constructor : function(terms) {
        this.$terms = terms;
    },

    toString : function() {
        var stringTerms = [];
        for (var i = 0; i < this.$terms.length; i++) {
            stringTerms.push(this.$terms[i].toString());
        }
        return "(" + stringTerms.join(" + ") + ")";
    },

    evaluate : function() {
        var total = 0;
        for (var i = 0; i < this.$terms.length; i++ ) {
            total += this.$terms[i].evaluate();
        }
        return total;
    },

    getChildren : function() {
        return this.$terms;
    }
});

Rebound.Expressions.Multiplication = Base.extend({
    constructor : function(terms) {
        this.$terms = terms;
    },

    toString : function() {
        var stringTerms = [];
        for (var i = 0; i < this.$terms.length; i++) {
            stringTerms.push(this.$terms[i].toString());
        }
        return "(" + stringTerms.join(" * ") + ")";
    },

    evaluate : function() {
        var product = 1;
        for (var i = 0; i < this.$terms.length; i++) {
            product *= this.$terms[i].evaluate();
        }
        return product;
    },

    getChildren : function() {
        return this.$terms;
    }
});

Rebound.Expressions.Exponential = Base.extend({
    constructor : function(base, exponent) {
        this.$base     = base;
        this.$exponent = exponent;
    },

    toString : function() {
        return "(" + this.$base.toString() + "^" + this.$exponent.toString() + ")";
    },

    evaluate : function() {
        return Math.pow(this.$base.evaluate(), this.$exponent.evaluate());
    },

    getChildren : function() {
        return [this.$base, this.$exponent];
    }
});

Rebound.Expressions.Number = Base.extend({
    constructor : function(value) {
        this.$value = value;
    },

    toString : function() {
        return this.$value + "";
    },

    evaluate : function() {
        return this.$value;
    },

    getChildren : function() {
        return [];
    }
});

// Reference is passed in from the parser as an array of 
// attributes names. The array ["window", "point", "x"] would
// correspond to the object window.point and the attribute x.
Rebound.Expressions.Reference = Base.extend({
    constructor: function(reference) {
        this.$name = reference.join(".");

        this.$attributeName = reference.pop();

        // Hack for now since we don't have any global objects
        var window = require("./window");
        this.$object = window;
        for (var i = 0; i < reference.length; i++) {
            this.$object = this.$object[reference[i]];
        }
    },

    toString : function() {
        return "{" + this.$name + "}";
    },

    evaluate : function() {
        return this.$object[this.$attributeName];
    },

    getChildren : function() {
        return [];
    },

    getObject : function() {
        return this.$object;
    },

    getAttributeName : function() {
        return this.$attributeName;
    }
});

Rebound.Expressions.Parser = require("./expression");
