require(["base", "raphael-min.js"], function(Base) {
    window.Rebound = {};

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

        setAttribute : function(name, value) {
            var oldValue = this[name];
            this[name] = value;
            this.emit("change:" + name, oldValue, value);
            return this[name];
        },

        getAttribute : function(name) {
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
                        object.setAttribute(attributeName, self.evaluate());
                    }
                )
            }
        },

        evaluate : function() {
            return this.expression.evaluate();
        }
    });

    Rebound.Object = Rebound.ValueWatcher.extend({
        constructor : function(attributes) {
            this.base();

            for (name in attributes) {
                if (attributes.hasOwnProperty(name)) {
                    this.setAttribute(name, attributes[name]);
                }
            }
        },

        setAttribute : function(name, value) {
            Rebound.ValueWatcher.prototype.setAttribute.call(this, name, value);

            // If it has a special attribute handler, call it.
            if (this.$attributeHandlers[name]) {
                this.$attributeHandlers[name].call(this, value);
            }
        },

        $attributeHandlers : {}
    });

    Rebound.Drawable = Rebound.Object.extend({
        setAttribute : function(name, value) {
            Rebound.Object.prototype.setAttribute.call(this, name, value);

            // If it's a style attribute pass it on to the Raphael element.
            if (Rebound.Drawable.styleAttributes.indexOf(name) != -1) {
                this.setElementAttribute(name, value);
            }
        },

        setElementAttribute : function() {
            if (this.$element) {
                this.$element.attr.apply(this.$element, arguments)
            }
        },

        draw : function() {
            this.$draw();
            this.applyStyle();
        },

        applyStyle : function() {
            for (i in Rebound.Drawable.styleAttributes) {
                attribute = Rebound.Drawable.styleAttributes[i];
                if (this.getAttribute(attribute)) {
                    this.setElementAttribute(attribute, this.getAttribute(attribute))
                }
            }
        }

    },{
        styleAttributes : [
            "stroke", "fill"
        ]
    });

    Rebound.Canvas = Rebound.Object.extend({
        constructor : function(x,y,width,height) {
            this.width = width;
            this.height = height;
            this.$element = new Raphael(x,y,width,height);
        },

        appendChild : function(child) {
            if (child instanceof Rebound.Drawable) {
                child.$canvas = this;
                child.draw();
            }

            return this;
        },

        // SVG draws from the top left, with x goign right and ty going down
        // but we want to draw from the center with x going right and y going up.
        getCanvasX : function(x) {
            return x + this.width / 2;
        },
        getCanvasY : function(y) {
            return -y + this.height / 2; 
        },
        getCanvasCoord : function(coord) {
            return [
                this.getCanvasX(coord[0]),
                this.getCanvasY(coord[1])
            ];
        }
    });

    Rebound.Point = Rebound.Drawable.extend({
        $draw : function() {
            this.$element = this.$canvas.$element.circle(
                this.$canvas.getCanvasX(this.getAttribute("x")),
                this.$canvas.getCanvasY(this.getAttribute("y")),
                4
            );
        },

        $attributeHandlers : {
            x : function(value) {
                this.setAttribute("position", [
                    value,
                    this.getAttribute("y")
                ]);
            },

            y : function(value) {
                this.setAttribute("position", [
                    this.getAttribute("x"),
                    value
                ]);
            },
        
            position : function(value) {
                // Don't use setAttribute here otherwise we'll end up in a loop;
                this.x = value[0];
                this.y = value[1];

                if (this.$element) {
                    this.setElementAttribute("cx", this.$canvas.getCanvasX(this.x));
                    this.setElementAttribute("cy", this.$canvas.getCanvasY(this.y));
                }
            }
        }
    });

    Rebound.Line = Rebound.Drawable.extend({
        $draw : function() {
            this.$element = this.$canvas.$element.path(this.$getPathString());
        },

        $getPathString : function() {
            var begin = this.$canvas.getCanvasCoord(this.getAttribute("begin")),
                end   = this.$canvas.getCanvasCoord(this.getAttribute("end"));
            return "M" + begin[0] + " " + begin[1] + 
                   "L" + end[0]   + " " + end[1];
        },

        $attributeHandlers : {
            begin : function(value) {
                if (this.$element) {
                    this.setElementAttribute("path", this.$getPathString());
                }
            },

            end : function(value) {
                if (this.$element) {
                    this.setElementAttribute("path", this.$getPathString());
                }
            }
        } 
    });

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
});
