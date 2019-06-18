module.exports = (function(){
    var services = {};
    return {
        get: function(name){
            return services[name]
        },
        set: function(name, obj){
            services[name] = obj;
            return obj;
        },
        getNames: function (){
            var names = [];
            for (var i in services){
                names.push(i);
            }
            return names;
        },
        getAll: function(){
            return services;
        }
    }
}());