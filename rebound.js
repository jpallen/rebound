define(["base", "raphael-min.js"], function(Base) {
    var Rebound = {};

    Rebound.EventChain = Base.extend({
        constructor : function() {
            this.previouslyCalled = [];
        }
    });

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
            var argv = Array.prototype.slice.call(arguments, 1);
            
            if (!(argv[0] instanceof Rebound.EventChain)) {
                argv.unshift(new Rebound.EventChain());
            }
            var e = argv[0];

            var callbacks = this.eventCallbacks[event];
            if (callbacks) {
                for (var i = 0; i < callbacks.length; i++ ) {   
                    var callback = callbacks[i];
                    // Check callback hasn't already been called
                    if (e.previouslyCalled.indexOf(callback) == -1) {
                        // We only keep track of callbacks called on the way down
                        // one branch of the callback tree. The same callback may
                        // need calling multiple times if called by different parent
                        // callbacks. 
                        // THIS WILL NOT WORK ASYNCHRONOUSLY!
                        e.previouslyCalled.push(callback);
                        callback.apply(this, argv);
                        e.previouslyCalled.pop();
                    }
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

        setAttribute : function(name, value, eventChain) {
            var oldValue = this[name];
            if (typeof value === "string" ) {
                this.$bindings[name] = new Rebound.Binding(this, name, value);
                this[name] = this.$bindings[name].evaluate();
            } else {
                this[name] = value;
            }

            if (!eventChain) {
                eventChain = new Rebound.EventChain();
            }
            this.emit("attribute:" + name + ":update", eventChain, oldValue, value);

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

            if (typeof this.registerEventListeners === "function") {
                this.registerEventListeners();
            }
        },

        $attributeHandlers : {}
    });

    Rebound.Drawable = Rebound.Object.extend({
        setAttribute : function(name, value, e) {
            Rebound.Object.prototype.setAttribute.call(this, name, value, e);

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

        // SVG draws from the top left, with x going right and y going down
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
        },

        getPhysicalXOffset : function(x) {
            return x;
        },
        getPhysicalYOffset : function(y) {
            return -y;
        }
    });

    Rebound.Point = Rebound.Drawable.extend({
        registerEventListeners : function(attributes) {
            var self = this;
            this.on("attribute:x:update", function(e, oldValue, newValue) {
                self.setAttribute("position", [newValue, self.y], e);
                self.$updatePosition();
            });
            this.on("attribute:y:update", function(e, oldValue, newValue) {
                self.setAttribute("position", [self.x, newValue], e);
                self.$updatePosition();
            });
            this.on("attribute:position:update", function(e, oldValue, newValue) {
                self.setAttribute("x", newValue[0], e);
                self.setAttribute("y", newValue[1], e);
                self.$updatePosition();
            })
        },

        $draw : function() {
            this.$element = this.$canvas.$element.circle(
                this.$canvas.getCanvasX(this.getAttribute("x")),
                this.$canvas.getCanvasY(this.getAttribute("y")),
                4
            );
            this.$element.attr({
                fill   : "#245D70",
                stroke : "#1D2224"
            });
        },

        $attributeHandlers : {
            x : function(value) {
                this.setAttribute("position", [value, this.y], false);
                this.$updatePosition();
            },

            y : function(value) {
                this.setAttribute("position", [this.x, value], false);
                this.$updatePosition();
            },
        
            position : function(value) {
                this.setAttribute("x", value[0], false);
                this.setAttribute("y", value[1], false);
                this.$updatePosition();
            }
        },

        $updatePosition : function() {
            if (this.$element) {
                this.setElementAttribute("cx", this.$canvas.getCanvasX(this.x));
                this.setElementAttribute("cy", this.$canvas.getCanvasY(this.y));
            }
        }
    });

    /* TODO:
     * A line can be specified in multiple ways:
     * 1) Exactly two of `begin`, `end`, `midpoint`,
     * 2) `gradient`, `length` and one of `begin`, `end`, or `midpoint`,
     * 3) `direction`, `length` and one of `begin`, `end`, or `midpoint`.
     * 
     * In the case of (1), any further update to one of the points will move
     * only that point while leaving the other fixed.
     * In the case of (2) or (3), any further updates to the specified point
     * will translate the line, thus leaving `length` and `gradient` or `direction`
     * fixed.
     * END TODO
     */
    Rebound.Line = Rebound.Drawable.extend({
        registerEventListeners : function() {
            var self = this;
            this.on("attribute:begin:update", function(e, oldValue, newValue) {
                self.$updateDirection(e);
                self.$updateLength(e);
                self.$updatePath(e);
            });
            this.on("attribute:end:update", function(e, oldValue, newValue) {
                self.$updateDirection(e);
                self.$updateLength(e);
                self.$updatePath(e);
            });
            this.on("attribute:direction:update", function(e, oldValue, newValue) {
                self.$updatePath(e);
            });
            this.on("attribute:length:update", function(e, oldValue, newValue) {
                self.$updatePath(e);
            });
        },

        $draw : function() {
            this.$element = this.$canvas.$element.path(this.$getPathString());
        },

        $getPathString : function() {
            var begin = this.$canvas.getCanvasCoord(this.getAttribute("begin")),
                end   = this.$canvas.getCanvasCoord(this.getAttribute("end"));
            return "M" + begin[0] + " " + begin[1] + 
                   "L" + end[0]   + " " + end[1];
        },

        $isInitialized : function () {
            return typeof this.begin !== "undefined" && typeof this.end !== "undefined";
        },

        $updatePath : function(e) {
            if (this.$element) {
                this.setElementAttribute("path", this.$getPathString(), e);
            }
        },

        $updateDirection : function(e) {
            if (this.$isInitialized()) {
                var direction     = [this.end[0] - this.begin[0], this.end[1] - this.begin[1]];
                var magnitude     = Math.sqrt(direction[0] * direction[0] + direction[1] * direction[1]);
                var unitDirection = [direction[0] / magnitude, direction[1] / magnitude];
                this.setAttribute("direction", unitDirection, e);
            }
        },

        $updateLength : function (e) {
            if (this.$isInitialized()) {
                var length = Math.sqrt(
                    Math.pow(this.end[0] - this.begin[0], 2) +
                    Math.pow(this.end[1] - this.begin[1], 2)
                );
                this.setAttribute("length", length, e);
            }
        },

        $updateEnd : function (e) {
            if (this.$isInitialized()) {
                this.setAttribute("end", [
                    this.begin[0] + this.direction[0] * this.length,
                    this.begin[1] + this.direction[1] * this.length
                ], e);
            }
        }
    });

    Rebound.Plot = Rebound.Drawable.extend({
        registerEventListeners : function() {
            var self = this;
            this.on("attribute:function:update", function(e, oldValue, newValue) {
                self.$draw();
            })
        },

        $draw : function() {
            if (this.$canvas) {
                if (this.$element) {
                    this.setElementAttribute("path", this.$getPathString());
                } else {
                    this.$element = this.$canvas.$element.path(this.$getPathString());
                }
            }
        },

        $getPathString : function() {
            var path  = "";
            var range = this.getAttribute("range");

            var steps = (range[1] - range[0]) * 1.0;
            for (var i = 0; i <= steps; i++ ) {
                var x = range[0] + i/steps * (range[1] - range[0]);
                if (i == 0) {
                    path += "M";
                } else {
                    path += "L";
                }
                path += this.$canvas.getCanvasX(x) + " " + this.$canvas.getCanvasY(this.getAttribute("function")(x));
            }

            return path
        }
    });

    Rebound.Draggable = Base.extend({
        constructor : function(object) {
            this.object = object;

            this.object.$element.drag(
                function(dx, dy) {
                    object.setAttribute("x", this.ox + object.$canvas.getPhysicalXOffset(dx));
                    //object.setAttribute("y", this.oy + object.$canvas.getPhysicalYOffset(dy));
                },
                function() {
                    this.ox = object.getAttribute("x");
                    this.oy = object.getAttribute("y");
                },
                function () {}
            );
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
            var m = expression.match(/\{![^\}]*\}/g) || [];
            var referenceStrings = [];
            for (var i = 0; i < m.length; i++) {
                // Get reference without {! and }
                var reference = m[i].slice(2, -1);

                // Avoid duplicates
                if (referenceStrings.indexOf(reference) == -1) {
                    referenceStrings.push(reference);

                    this.expression = this.expression.replace(
                        RegExp("{!" + reference + "}", "g"),
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
                var watchObject    = this.references[i].object;
                var watchAttribute = this.references[i].attribute;
                var self      = this;
                if (typeof watchObject.on === "function") {
                    watchObject.on("attribute:" + watchAttribute + ":update", function(e, oldValue, newValue) {
                        self.object.setAttribute(self.attribute, self.evaluate(), e);
                    });
                }
            }
        },

        evaluate : function() {
            var value;
            eval("value = (" + this.expression + ")");
            return value;
        }
    });

    return Rebound;
});
