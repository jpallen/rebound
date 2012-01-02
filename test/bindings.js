define(["test/qunit/qunit", "interact/interact"], function(_, Interact) {
    module("Binding construction")

    test("Validate arguments", function() {
        var foo = {
            bar : 42
        };
        var baz = {
            bar : 43
        };

        raises(function() {
            Interact.bind(foo, "bar");
        }, /Expected an object, attribute and binding function as arguments/, "")

        raises(function() {
            Interact.bind(foo, 1, function() { return 1; });
        }, /Expected the name of an attribute as the second argument/, "");

        raises(function() {
            Interact.bind(foo, "bar", 1);
        }, /Expected a binding function as the third argument/, "");

        raises(function() {
            Interact.bind(foo, "bar", function(a) { return a*2; }, baz);
        }, /Expected a list of pairs of object and attribute names as dependencies/, ""); 
    });

    module("Binding behaviour");

    test("Simple Binding", function() {
        var measure = {
            cms    : 10,
            metres : 0.1
        }
        Interact.bind(
            measure, "metres",
            function(cms) {
                return cms * 0.01;
            },
            measure, "cms"
        );
        Interact.setAttribute(measure, "cms", 25);

        equal(measure.metres, 0.25, "Bound attribute should be updated");
    });

    test("Network", function() {
        var values = {
            t   : 0,
            sin : 0,
            cos : 1,
            tan : 0
        };

        Interact.bind(values, "sin", function(t) { return Math.sin(t) }, values, "t");
        Interact.bind(values, "cos", function(t) { return Math.cos(t) }, values, "t");
        Interact.bind(values, "tan", function(c, s) { return s/c; }, values, "cos", values, "sin");

        Interact.setAttribute(values, "t", Math.PI/4);

        equal(values.sin, Math.sin(Math.PI/4))
        equal(values.cos, Math.cos(Math.PI/4))
        equal(values.tan, Math.tan(Math.PI/4))
    });

    test("Circular", function() {
        var values = {
            "mm" : 1,
            "m"  : 0.01,
            "km" : 0.01 / 1000
        };

        Interact.bind(values, "mm", function(m) { return m * 1000.0 }, values, "m");
        Interact.bind(values, "mm", function(km) { return km * 1000.0 * 1000.0 }, values, "km");
        Interact.bind(values, "m", function(mm) { return mm / 1000.0 }, values, "mm");
        Interact.bind(values, "m", function(km) { return km * 1000.0 }, values, "km");
        Interact.bind(values, "km", function(m) { return m / 1000.0 }, values, "m");
        Interact.bind(values, "km", function(mm) { return mm / 1000.0 / 1000.0 }, values, "mm");

        Interact.setAttribute(values, "km", 1);
        equal(values.mm, 1 * 1000.0 * 1000.0);
        equal(values.m, 1 * 1000.0);
        equal(values.km, 1);

        Interact.setAttribute(values, "m", 1);
        equal(values.mm, 1 * 1000.0);
        equal(values.m, 1);
        equal(values.km, 1/ 1000);

        Interact.setAttribute(values, "mm", 1);
        equal(values.mm, 1);
        equal(values.m, 1 / 1000.0);
        equal(values.km, 1 / 1000.0 / 1000.0);
    });

    test("Multiple updates", function() {
        var values = {
            a : 5,
            b : 2,
            diff : 3
        };

        Interact.bind(values, "diff", function(a,b) { return a - b; }, values, "a", values, "b");

        Interact.setAttributes(
            values, "a", 10,
            values, "b", 3
        );
        equal(values.diff, 7);
    });
});
