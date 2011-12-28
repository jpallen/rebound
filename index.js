require(["rebound"], function(Rebound) {
    c = new Rebound.Canvas(0,0,1000,600);
    p = new Rebound.Plot({
        "function" : function(x) { return 100*Math.sin(0.035*x) },
        "range"    : [-200,200]
    });
    c.appendChild(p);
});
