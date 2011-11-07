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
            if (typeof value === "string" ) {
                this.$bindings[name] = new Rebound.Binding(this, name, value);
                this[name] = this.$bindings[name].evaluate();
            } else {
                this[name] = value;
            }
            this.emit("change:" + name, oldValue, value);
            return this[name];
        },

        getAttribute : function(name) {
            return this[name];
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
                this.$attributeHandlers[name].call(this, this.getAttribute(name));
            }
        },

        $attributeHandlers : {}
    });

    Rebound.Drawable = Rebound.Object.extend({
        setAttribute : function(name, value) {
            Rebound.Object.prototype.setAttribute.call(this, name, value);

            // If it's a style attribute pass it on to the Raphael element.
            if (Rebound.Drawable.styleAttributes.indexOf(name) != -1) {
                this.setElementAttribute(name, this.getAttribute(name));
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
                // TODO: But we need to to trigger x and y event handlers!
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

    // Binds an objects attribute to some expression which can depend on
    // other objects and values. Whenever these other objects are updated,
    // the bound attribute is also updated. Bindings should be passed as 
    // a javascript expression with external attributes wrapped in { and }:
    //     {point.x} + 5
    // or
    //     distance({line.begin}, {line.end})
    Rebound.Binding = Base.extend({
        constructor: function(object, attribute, expression) {
            this.object     = object;
            this.attribute  = attribute;
            this.expression = expression;
            this.references = [];

            // Find any references to outside values
            var m = expression.match(/\{[^\}]*\}/g) || [];
            var referenceStrings = [];
            for (var i = 0; i < m.length; i++) {
                // Get reference without { and }
                var reference = m[i].slice(1, -1);

                // Avoid duplicates
                if (referenceStrings.indexOf(reference) == -1) {
                    referenceStrings.push(reference);

                    this.expression = this.expression.replace(
                        RegExp("{" + reference + "}", "g"),
                        reference
                    );
                }
            }

            // Get each reference and find the object it refers to
            for (i = 0; i < referenceStrings.length; i++) {
                var reference      = referenceStrings[i];
                var attributeChain = reference.split(".");

                var object = window;
                var attribute;
                while (attributeChain.length > 1) {
                    attribute = attributeChain.shift();
                    object = object[attribute];
                    // TODO: Handle null objects
                }
                attribute = attributeChain.shift();

                this.references.push({
                    object    : object,
                    attribute : attribute
                })
            }

            // Listen for updates to any of the references
            for (i = 0; i < this.references.length; i++) {
                var object    = this.references[i].object;
                var attribute = this.references[i].attribute;
                var self      = this;
                if (typeof object.on === "function") {
                    object.on("change:" + attribute, function(oldValue, newValue) {
                        self.object.setAttribute(attribute, self.evaluate());
                    });
                }
            }
        },

        evaluate : function() {
            return eval(this.expression);
        }
    });
});
