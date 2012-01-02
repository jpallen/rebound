define(["test/qunit/qunit", "interact/interact"], function(_, Interact) {
    module("Element - Point");

    test("Validate options", function() {
        raises(function() {
            Interact.point({})
        }, /Expected either x and y attribute or position attribute \(array of length 2\)/, "")
    });

    test("Updates x and y with position", function() {
        var point = Interact.point({
            position : [1,2]
        });
        equal(point.x, 1);
        equal(point.y, 2);

        Interact.setAttribute(point, "position", [3,4]);
        equal(point.x, 3);
        equal(point.y, 4);
    });
    
    test("Updates position with x and y", function() {
        var point = Interact.point({
            x : 1,
            y : 2
        });
        deepEqual(point.position, [1,2]);

        Interact.setAttribute(point, "x", 3);
        deepEqual(point.position, [3,2]);

        Interact.setAttribute(point, "y", 4);
        deepEqual(point.position, [3,4]);
    });

    module("Element - Line");

    test("Validate options", function() {
        raises(function() {
            Interact.line({});
        }, /Expected at least one of begin, midpoint or end/);

        raises(function() {
            Interact.line({
                begin : [0,0]
            });
        }, /Expected either two points or a point, length and graident or direction/);
    });

    function lineIsBetween(line, begin, end) {
        deepEqual(line.begin, begin);
        deepEqual(line.end, end);
    };

    test("Updates line based on fixed points", function() {
        var line = Interact.line({
            begin : [0,0],
            end   : [2,4]
        });
        lineIsBetween(line, [0,0], [2,4]);
        
        var line = Interact.line({
            begin    : [0,0],
            midpoint : [1,2]
        });
        lineIsBetween(line, [0,0], [2,4]);

        var line = Interact.line({
            midpoint : [1,2],
            end      : [2,4]
        });
        lineIsBetween(line, [0,0], [2,4]);
    });
});
