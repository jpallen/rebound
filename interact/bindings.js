define(function() {

var Bindings = {};

Bindings.valueCache = [];

Bindings.Value = function(object, attribute) {
    this.object     = object;
    this.attribute  = attribute;
    this.bindings   = []; // Bindings which set the value of this
    this.requiredBy = []; // Bindings which depend on this
};

Bindings.Value.find = function(object, attribute) {
    var values = Bindings.valueCache;

    for(var i = 0; i < values.length; i++) {
        if (values[i].object === object && values[i].attribute === attribute) {
            return values[i];
        }
    }
};

Bindings.Value.findOrCreate = function(object, attribute) {
    var value = Bindings.Value.find(object, attribute);

    if (!value) {
       value = new Bindings.Value(object, attribute);
       Bindings.valueCache.push(value);
    }

    return value;
};

Bindings.Binding = function(/* ... */) {
    if (arguments.length < 3) {
        throw "Expected an object, attribute and binding function as arguments"
    }
    if (typeof arguments[1] != "string") {
        throw "Expected the name of an attribute as the second argument"
    }
    if (typeof arguments[2] != "function") {
        throw "Expected a binding function as the third argument"
    }

    this.target = Bindings.Value.findOrCreate(arguments[0], arguments[1]);
    this.target.bindings.push(this);

    this.binding = arguments[2];

    // Dependencies are provided in (object, attribute) pairs
    this.dependencies = [];
    var argv = Array.prototype.slice.call(arguments, 3); 
    for (var i = 0; i < argv.length; i = i + 2) {
        var object = argv[i];
        var attribute = argv[i+1];
        if (typeof attribute != "string") {
            throw "Expected a list of pairs of object and attribute names as dependencies";
        }

        var value = Bindings.Value.findOrCreate(object, attribute);
        this.dependencies.push(value);
        value.requiredBy.push(this);
    }
};

(function() {
    this.evaluate = function() {
        var argv = [];
        for (var i = 0; i < this.dependencies.length; i++) {
            var value = this.dependencies[i];
            argv.push(value.object[value.attribute]);
        }
        return this.binding.apply(this, argv);
    };
}).call(Bindings.Binding.prototype);

Bindings.setAttributes = function(/* ... */) {
    var updatedNodes = [];
    for (var i = 0; i < arguments.length; i = i + 3) {
        var object = arguments[i];
        var attribute = arguments[i + 1];
        var value = arguments[i + 2];

        object[attribute] = value;
        
        var node = Bindings.Value.find(object, attribute);
        if (node) {
            updatedNodes.push(node);
        }
    }

    if (updatedNodes.length == 0)
        return;

    // Find all nodes (values) in the bindings graph which may be affected by this update.
    // I.e. any values which have a binding to this value, and then any values which
    // have a binding to them.
    var nodesNeedingUpdate = [];
    var bindingsToUse = [];
    var bindingsToConsider = []
    for (i = 0; i < updatedNodes.length; i++) {
        bindingsToConsider.push.apply(bindingsToConsider, updatedNodes[i].requiredBy); // Copy it since we will modify it in place.
    }
    var consideredBindings = [];
    while (bindingsToConsider.length > 0) {
        var nextBinding = bindingsToConsider.pop();
        var nextNode    = nextBinding.target;

        // Don't let ourselves get stuck circling through nodes. Only add nodes
        // that haven't yet been seen
        if (nodesNeedingUpdate.indexOf(nextNode) == -1 &&
            updatedNodes.indexOf(nextNode) == -1)
        {
            nodesNeedingUpdate.push(nextNode);
            bindingsToUse.push(nextBinding);
        }

        // Add bindings which haven't yet be processed or marked as needing
        // processed.
        for (i = 0; i < nextNode.requiredBy.length; i++) {
            var potentialBinding = nextNode.requiredBy[i];
            if (bindingsToConsider.indexOf(potentialBinding) == -1 &&
                consideredBindings.indexOf(potentialBinding) == -1)
            {
                bindingsToConsider.push(potentialBinding);
            }
        }

        consideredBindings.push(nextBinding);
    }

    function updateNode(node, binding) {
        // Remove this node from the list of nodes needing update (before we
        // recursively call this function again)
        var k = nodesNeedingUpdate.indexOf(node);
        nodesNeedingUpdate.splice(k, 1);
        bindingsToUse.splice(k, 1);
        
        // Go through and check that all the values this depends on have been updated
        for(i = 0; i < binding.dependencies.length; i++) {
            var dependentNode = binding.dependencies[i];

            var j = nodesNeedingUpdate.indexOf(dependentNode)
            if (j != -1) {
                updateNode(dependentNode, bindingsToUse[j]);
            }
        }

        // Recalculate the attribute of this node. 
        node.object[node.attribute] = binding.evaluate();
    }

    while(nodesNeedingUpdate.length > 0) {
        updateNode(nodesNeedingUpdate[0], bindingsToUse[0]);
    }
};

Bindings.setAttribute = function(object, attribute, value) {
    return Bindings.setAttributes(object, attribute, value);
};

Bindings.bind = function(argv) {
    // Do a little bit of object hackery to construct an object
    // with variable arguments.
    var binding = {};
    binding.__proto__ = Bindings.Binding.prototype;
    Bindings.Binding.apply(binding, arguments);
    return binding;
};

return Bindings;

});
