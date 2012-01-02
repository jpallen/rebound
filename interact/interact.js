define(["interact/bindings", "interact/elements"], function(Bindings, Elements) {

var Interact = {
    Bindings : Bindings,
    Elements : Elements
};

Interact.setAttribute  = Interact.Bindings.setAttribute;
Interact.setAttributes = Interact.Bindings.setAttributes;
Interact.bind = Interact.Bindings.bind;

Interact.point = function(options) {
    return new Elements.Point(options);
};
Interact.line = function(options) {
    return new Elements.Line(options);
};

return Interact;

})
