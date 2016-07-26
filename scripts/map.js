var map;
var theme_colors = ["#fcec74", "#f7df05", "#f2bd0b", "#fff030", "#95D5D2", "#1F3050"];

var MapModel = Backbone.Model.extend({});

var MapData = Backbone.Collection.extend({
    url:"http://transformap.co/json/sample-data.json",
    parse: function(response){
        return response.features;
    },
    toJSON : function() {
      return this.map(function(model){ return model.toJSON(); });
    }
 });

/* Creates map and popup template */
var MapView = Backbone.View.extend({
    el: '#map-template',
    template: _.template($('#mapTemplate').html()),
    templatePopUp: _.template($('#popUpTemplate').html()),
    initialize: function(){
        this.$el.html(this.template());

        map = L.map(this.$('#map-tiles')[0], { scrollWheelZoom: false }).setView ([51.1657, 10.4515], 6);
        L.tileLayer('http://{s}.tile.osm.org/{z}/{x}/{y}.png', {
          attribution: 'Map data &copy; <a href="http://openstreetmap.org">OpenStreetMap</a> contributors, <a href="http://creativecommons.org/licenses/by-sa/2.0/">CC-BY-SA</a>',
        }).addTo(map);
        map.searchCtrl = L.control.fuseSearch({
            position: 'topleft',
            showResultFct: function(feature, container) {
              props = feature.properties;
              var name = L.DomUtil.create('b', null, container);
              name.innerHTML = props.name;
              container.appendChild(L.DomUtil.create('br', null, container));
            }
        }).addTo(map);

        //this.listenTo(this.collection, 'reset add change remove', this.renderItem);
        this.listenToOnce(this.collection, 'add', this.renderAll);
        this.listenTo(this.collection, 'update', this.renderAll);
        this.collection.fetch();
    },
    renderAll: function () {
        if (map.dataLayer) map.removeLayer(map.dataLayer);

        var features = this.collection.map(function(model) {
            return model.toJSON();
        });

        map.searchCtrl.indexFeatures(features, ['name', 'free_keywords', 'description']);

        map.dataLayer = L.geoJson(features, {
            pointToLayer: function(feature, latlng) {
                return L.circleMarker(latlng, {
                    color: theme_colors[(Math.floor(Math.random() * 6) + 1)],
                    radius: 8,
                    weight: 7,
                    opacity: .5,
                    fillOpacity: 1,
                });
            },
            onEachFeature: (function(feature, layer) {
                layer.bindPopup(this.templatePopUp(feature));
                layer.getPopup = function() { return layer._popup }; // circlemarker doesn't have getPopup().. hmm
                feature.layer = layer; // needed for leaflet-fusesearch
            }).bind(this)
        }).addTo(map);
    },
});

/* Initialises map */
var mapData = new MapData();
var mapView = new MapView({ collection: mapData });
var baseTaxonomyUrl = 'https://base.transformap.co/entity/';

// Collects taxonomy data
var FilterData = Backbone.Collection.extend({
    url:"http://transformap.co/json/susy-taxonomy.json",
    parse: function(response){
        return response.results.bindings;
    },
    toJSON : function() {
      return this.map(function(model){ return model.toJSON(); });
    }
 });

var categories = [];
var subcategories = [];

var MenuView = Backbone.View.extend({
    el: '#map-menu',
    template: _.template($('#mapMenuTemplate').html()),
    initialize: function(){
        this.listenTo(this.collection,"add", this.renderItem);
        this.collection.fetch();
    },
    events: {
        "click .toggle": "clicked",
        "click .subcategory": "displayTypes"
    },
    clicked: function(e){
        // Shows subcategories
        e.preventDefault();
        $(e.currentTarget).parent().find('ul.subcategories').slideToggle(400);
    },
    displayTypes: function(e){
        // Hides previously open types of initiatives
        e.preventDefault();
        $( "ul.type-of-initiative" ).each(function() {
          $( this ).hide( );
        });
        $( ".subcategory" ).each(function() {
          $( this ).removeClass("active-filter");
        });
        // Shows type of intiatives below this subcategory
        $(e.currentTarget).addClass("active-filter");
        $(e.currentTarget).find('ul.type-of-initiative').slideToggle(400).addClass("active-filter");
    },
    renderItem: function(model) {
        var filter = model.toJSON();
        // Finds categories
        if(filter.subclass_of) {
            if(filter.subclass_of.value == 'https://base.transformap.co/entity/Q1234#SSEDAS_TAX_UUID') {
                var str = filter.item.value;
                var category = str.split('/');
                category = category[category.length - 1].split('#');
                categories.push(category[0]);
                filter.id = category[0];
                this.$el.append(this.template(filter));
            }
        }
        // Finds categories' subcategories
        for(i = 0; i < categories.length; i++) {
            if(filter.subclass_of.value == baseTaxonomyUrl + categories[i]) {
                var catId = '#' + categories[i];
                var str = filter.item.value;
                var subcategory = str.split('/');
                subcategory = subcategory[subcategory.length - 1];
                subcategories.push(subcategory);
                $(catId).append('<li class="subcategory list-group-item"><span class="toggle-subcategories">' + filter.itemLabel.value + '</span><ul id="' + subcategory + '" class="type-of-initiative"></ul></li>');
            }
        }
        // Finds subcategories' types of initiatives
        for(i = 0; i < subcategories.length; i++) {
            if(filter.subclass_of.value == baseTaxonomyUrl + subcategories[i]) {
                var catId = '#' + subcategories[i];
                var str = filter.item.value;
                var typeOfInitiative = str.split('/');
                typeOfInitiative = typeOfInitiative[typeOfInitiative.length - 1];
                $(catId).append('<li class="list-group-item">' + filter.itemLabel.value + '</li>');
            }
        }
    }
});

// Initializes templates and fetches data
var filterData = new FilterData();
var filterView = new MenuView({ collection: filterData });
