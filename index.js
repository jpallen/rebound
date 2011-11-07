require(["rebound"], function(Rebound) {
    c = new Rebound.Canvas(0,0,1000,400);
    p = new Rebound.Point({x : 10, y: 100});
    q = new Rebound.Point({x : 100, y: 0});
    c.appendChild(q); c.appendChild(p); 
    new Rebound.Draggable(p); new Rebound.Draggable(q); 
    l = new Rebound.Line({begin : "[{q.x}, {q.y}]", end : "{p.position}"});
    c.appendChild(l);
});
