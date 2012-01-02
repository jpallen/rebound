define(["interact/class", "interact/bindings"], function(Class, Bindings) {

var Elements = {};

Elements.Point = Class.extend({
    init : function(options) {
        if (options.x && options.y) {
            this.x = options.x;
            this.y = options.y;
            this.position = [this.x, this.y];
        } else if (options.position && options.position.length == 2) {
            this.position = options.position;
            this.x = this.position[0];
            this.y = this.position[1];
        } else {
            throw "Expected either x and y attribute or position attribute (array of length 2)"
        }

        Bindings.bind(
            this, "position",
            function(x,y) {
                return [x,y];
            },
            this, "x", this, "y"
        );
        Bindings.bind(
            this, "x",
            function(position) {
                return position[0];
            },
            this, "position"
        );
        Bindings.bind(
            this, "y",
            function(position) {
                return position[1];
            },
            this, "position"
        );
    }
});

function vectorBetween(p1, p2) {
    return [p2[0] - p1[0], p2[1] - p1[1]];
};
function addVector(p1, v1) {
    return [p1[0] + v1[0], p1[1] + v1[1]];
};
function multiplyVector(v, s) {
    return [v[0] * s, v[1] * s];
}

Elements.Line = Class.extend({
    init : function(options) {
        var fixedPoints = ["begin", "midpoint", "end"];
        var firstFixedPoint;
        for (var i = 0; i < fixedPoints.length; i++) {
            var position = options[fixedPoints[i]];
            if (position && position.length) {
                firstFixedPoint = fixedPoints[i];
                this[firstFixedPoint] = position;
                delete options[fixedPoints[i]];
                break;
            }
        }

        if (!firstFixedPoint) {
            throw "Expected at least one of begin, midpoint or end";
        }

        var secondFixedPoint;
        for (i = 0; i < fixedPoints.length; i++) {
            var position = options[fixedPoints[i]];
            if (position && position.length) {
                secondFixedPoint = fixedPoints[i];
                this[secondFixedPoint] = position;
                delete options[fixedPoints[i]];
                break;
            }
        }

        if (secondFixedPoint) {
            if (!this.begin) {
                this.begin = addVector(this.midpoint, vectorBetween(this.end, this.midpoint));
            }
            if (!this.midpoint) {
                this.midpoint = addVector(this.begin, multiplyVector(vectorBetween(this.begin, this.end), 0.5));
            }
            if (!this.end) {
                this.end = addVector(this.midpoint, vectorBetween(this.begin, this.midpoint));
            }
        } else {
            if (!options.gradient && !options.direction) {
                throw "Expected either two points or a point, length and graident or direction";
            }
        }
    }
});

return Elements;

});
