require(["rebound"], function(Rebound) {
    c = new Rebound.Canvas(0,0,1000,600);
    window.q = new Rebound.Point({
        x : 100,
        y : 100
    });
    c.appendChild(q);
    p = new Rebound.Plot({
        "function" : "function(x) { return {!q.y} * Math.sin( x * (Math.PI/2/{!q.x}) ) }",
        "range"    : [-400,400]
    });
    c.appendChild(p);
    new Rebound.Draggable(q);
    window.r = new Rebound.Point({
        x : 50,
        y : 100
    });
    r.setAttribute("y", "{!q.y}*Math.sin({!r.x} * (Math.PI/2/{!q.x}))");
    c.appendChild(r);
    new Rebound.Draggable(r);

    l = new Rebound.Line({
        begin : "[{!r.x} - 50, {!r.y} - 50 * (Math.PI/2/{!q.x}) * {!q.y}*Math.cos({!r.x} * (Math.PI/2/{!q.x}))]",
        end : "[{!r.x} + 50, {!r.y} + 50 * (Math.PI/2/{!q.x})  * {!q.y}*Math.cos({!r.x} * (Math.PI/2/{!q.x}))]"
    })
    c.appendChild(l);
    p.setAttribute("range", "[-100, Math.max({!p.range}[1], {!q.x})]"); 
});
