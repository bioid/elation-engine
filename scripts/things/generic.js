elation.require([
  // "engine.external.three.ColladaLoader",
  //"engine.external.three.JSONLoader"
  //"engine.external.three.glTFLoader-combined"
  "engine.things.trigger"
]);

elation.component.add("engine.things.generic", function() {
  this.init = function() {
    this._thingdef = {
      properties: {},
      events: {},
      actions: {}
    };
    this.parentname = this.args.parentname || '';
    this.name = this.args.name || '';
    this.type = this.args.type || 'generic';
    this.engine = this.args.engine;
    this.client = this.args.client;
    this.properties = {};
    this.objects = {};
    this.parts = {};
    this.triggers = {};
    this.parttypes = {};
    this.children = {};
    this.tags = [];
    
    this.tmpvec = new THREE.Vector3();
    
    this.interp = {
      rate: 20,
      lastTime: 0,
      time: 0,
      endpoint: new THREE.Vector3(),
      spline: [],
      active: false,
      fn: this.applyInterp
    };

    //elation.events.add(this, 'thing_create', this);
    elation.events.add(this, 'thing_use_activate', this);
    this.defineActions({
      'spawn': this.spawn,
      'move': this.move
    });
    this.defineProperties({
      'position':       { type: 'vector3', default: [0, 0, 0], comment: 'Object position, relative to parent' },
      'orientation':    { type: 'quaternion', default: [0, 0, 0, 1], comment: 'Object orientation, relative to parent' },
      'scale':          { type: 'vector3', default: [1, 1, 1], comment: 'Object scale, relative to parent' },
      'velocity':       { type: 'vector3', default: [0, 0, 0], comment: 'Object velocity (m/s)' },
      'acceleration':   { type: 'vector3', default: [0, 0, 0], comment: 'Object acceleration (m/s^2)' },
      'angular':        { type: 'vector3', default: [0, 0, 0], comment: 'Object angular velocity (radians/sec)' },
      'angularacceleration': { type: 'vector3', default: [0, 0, 0], comment: 'Object angular acceleration (radians/sec^2)' },
      'mass':           { type: 'float', default: 0.0, comment: 'Object mass (kg)' },
      'exists':         { type: 'bool', default: true, comment: 'Exists' },
      'visible':        { type: 'bool', default: true, comment: 'Is visible' },
      'physical':       { type: 'bool', default: true, comment: 'Simulate physically' },
      'collidable':     { type: 'bool', default: true, comment: 'Can crash into other things' },
      //'fog':            { type: 'bool', default: true, comment: 'Affected by fog' },
      'shadow':         { type: 'bool', default: true, comment: 'Casts and receives shadows' },
      'wireframe':      { type: 'bool', default: false, comment: 'Render this object as a wireframe' },
      'forcereload':    { type: 'bool', default: false, comment: 'Force a full reload of all files' },
      'mouseevents':    { type: 'bool', default: true, comment: 'Respond to mouse/touch events' },
      'persist':        { type: 'bool', default: false, comment: 'Continues existing across world saves' },
      'pickable':       { type: 'bool', default: true, comment: 'Selectable via mouse/touch events' },
      'render.mesh':    { type: 'string', comment: 'URL for JSON model file' },
      'render.meshname':{ type: 'string' },
      'render.scene':   { type: 'string', comment: 'URL for JSON scene file' },
      'render.collada': { type: 'string', comment: 'URL for Collada scene file' },
      'render.model':   { type: 'string', comment: 'Name of model asset' },
      'render.gltf':    { type: 'string', comment: 'URL for glTF file' },
      'render.materialname': { type: 'string', comment: 'Material library name' },
      'render.texturepath': { type: 'string', comment: 'Texture location' },
      'player_id':      { type: 'float', default: null, comment: 'Network id of the creator' },
      'tags': { type: 'string', comment: 'Default tags to add to this object' }
    });
    this.defineEvents({
      'thing_create': [],
      'thing_add': ['child'],
      'thing_load': ['mesh'],
      'thing_remove': [],
      'thing_destroy': [],
      'thing_tick': ['delta'],
      'thing_think': ['delta'],
      'thing_move': [],
      'mouseover': ['clientX', 'clientY', 'position'],
      'mouseout': [],
      'mousedown': [],
      'mouseup': [],
      'click': []
    });

    if (typeof this.preinit == 'function') {
      this.preinit();
    }

    if (typeof this.postinit == 'function') {
      this.postinit();
    }
    //this.migrateProperties();
    this.init3D();
    this.initDOM();
    this.initPhysics();

    setTimeout(elation.bind(this, function() {
      // Fire create event next frame
      this.createChildren();
      this.refresh();
      elation.events.fire({type: 'thing_create', element: this});
    }), 0);
  }
  this.preinit = function() {
  }
  this.postinit = function() {
  }
  this.initProperties = function() {
    if (!this.properties) {
      this.properties = {};
    }

    var props = this.migrateProperties(this.args.properties);
    for (var propname in this._thingdef.properties) {
      var prop = this._thingdef.properties[propname];
      var propval = elation.utils.arrayget(this.properties, propname, null);
      if (propval === null) {
        if (!elation.utils.isNull(props[propname])) {
          propval = props[propname] 
        } else if (!elation.utils.isNull(prop.default)) {
          propval = prop.default;
        }
        this.set(propname, propval);
      }
    }
  }
  this.migrateProperties = function(props) {
    return (props && props.generic ? props.generic : props || {});
    // FIXME - once all entries in the db have been updated, this is no longer necessary
    if (!this.propargs) {
      var newprops = {};
      if (this.args.properties && !this.args.properties.generic) {
        //this.args.properties = { physical: this.args.properties };
      }
      var squash = ['physical', 'generic'];
      for (var propgroup in this.args.properties) {
        if (!elation.utils.isArray(this.args.properties[propgroup]) && this.args.properties[propgroup] instanceof Object) {
          for (var propname in this.args.properties[propgroup]) {
            var fullpropname = (squash.indexOf(propgroup) != -1 ? propname : propgroup + '.' + propname);
            newprops[fullpropname] = this.args.properties[propgroup][propname];
          }
        } else {
          newprops[propgroup] = this.args.properties[propgroup];
        }
      }
      this.propargs = newprops;
    }
    return this.propargs;
  }
  this.getPropertyValue = function(type, value) {
    if (value === null) {
      return;
    }
    switch (type) {
      case 'vector2':
        if (elation.utils.isArray(value)) {
          value = new THREE.Vector2(+value[0], +value[1]);
        } else if (elation.utils.isString(value)) {
          var split = value.split(',');
          value = new THREE.Vector2(+split[0], +split[1]);
        }
        break;
      case 'vector3':
        if (elation.utils.isArray(value)) {
          value = new THREE.Vector3(+value[0], +value[1], +value[2]);
        } else if (elation.utils.isString(value)) {
          var split = value.split(',');
          value = new THREE.Vector3(+split[0], +split[1], +split[2]);
        }
        break;
      case 'quaternion':
        if (elation.utils.isArray(value)) {
          value = new THREE.Quaternion(+value[0], +value[1], +value[2], +value[3]);
        } else if (elation.utils.isString(value)) {
          var split = value.split(',');
          value = new THREE.Quaternion(+split[0], +split[1], +split[2], +split[3]);
        }
        break;
      case 'bool':
        value = !(value === false || value === 'false' || value === 0 || value === '0' || value === '' || value === null || typeof value == 'undefined');
        break;
      case 'float':
        value = +value;
        break;
      case 'int':
        value = value | 0;
        break;
      case 'texture':
        if (value !== false) {
          value = (value instanceof THREE.Texture ? value : elation.engine.materials.getTexture(value));
        }
        break;
      case 'json':
        if (value !== false) {
          value = (elation.utils.isString(value) ? JSON.parse(value) : value);
        }
        break;
      case 'component':
        if (value) {
          var component = elation.component.fetch(value[0], value[1]);
          if (component) {
            value = component;
          }
        }
        break;
    }
    return value;
  }
  this.defineProperties = function(properties) {
    elation.utils.merge(properties, this._thingdef.properties);
    this.initProperties();
  }
  this.defineActions = function(actions) {
    elation.utils.merge(actions, this._thingdef.actions);
  }
  this.defineEvents = function(events) {
    elation.utils.merge(events, this._thingdef.events);
  }

  this.set = function(property, value, forcerefresh) {
    if (!this._thingdef.properties[property]) {
      console.warn('Tried to set unknown property', property, value, this);
      return;
    }
    var propval = this.getPropertyValue(this._thingdef.properties[property].type, value);
    var currval = this.get(property);
    //if (currval !== null) {
      switch (this._thingdef.properties[property].type) {
        case 'vector2':
        case 'vector3':
        case 'vector4':
        case 'quaternion':
          if (currval === null)  {
            elation.utils.arrayset(this.properties, property, propval);
          } else {
            currval.copy(propval);
          }
          break;
        case 'texture':
          //console.log('TRY TO SET NEW TEX', property, value, forcerefresh);
        default:
          elation.utils.arrayset(this.properties, property, propval);
      }
    //} else {
    //  elation.utils.arrayset(this.properties, property, propval);
    //}
    if (forcerefresh && this.objects['3d']) {
      this.initProperties();
      var parent = this.objects['3d'].parent;
      parent.remove(this.objects['3d']);
      this.objects['3d'] = false;
      this.init3D();
      parent.add(this.objects['3d']);
    }
    if (this.objects.dynamics) {
      if (forcerefresh) {
        this.removeDynamics();
        this.initPhysics();
      } else {
        this.objects.dynamics.mass = this.properties.mass;
        this.objects.dynamics.updateState();
        if (this.objects.dynamics.collider) {
          this.objects.dynamics.collider.getInertialMoment();
        }
      }
    }
    this.refresh();
  }
  this.setProperties = function(properties, interpolate) {
    for (var prop in properties) {
      if (prop == 'position' && interpolate == true )
      {
          if ( this.tmpvec.fromArray(properties[prop]).distanceToSquared(this.get('position')) > 1 )
          {
            // call interpolate function 
            // TODO: fix magic number 0.001
            this.interpolateTo(properties[prop]);
          }
      }
      else {
        this.set(prop, properties[prop], false);
      }
    }
    this.refresh();
  }
  
  this.interpolateTo = function(newPos) {
    this.interp.time = 0;
    this.interp.endpoint.fromArray(newPos);
    this.interp.spline = new THREE.SplineCurve3([this.get('position'), this.interp.endpoint]).getPoints(10);
    // console.log(this.interp.spline);
    elation.events.add(this.engine, 'engine_frame', elation.bind(this, this.applyInterp));
  }
  
  this.applyInterp = function(ev) {
    this.interp.time += ev.data.delta * this.engine.systems.physics.timescale;
    if (this.interp.time >= this.interp.rate) {
      elation.events.remove(this, 'engine_frame', elation.bind(this, this.applyInterp));
      return;
    }
    console.log("DEBUG: interpolating, time:", this.interp.time);
    if (this.interp.time - this.interp.lastTime >= 2) 
    {
    this.set('position', this.interp.spline[Math.floor((this.interp.time * 10) / this.interp.rate)], false);
    this.refresh();
    }
  };
  
  this.get = function(property, defval) {
    if (typeof defval == 'undefined') defval = null;
    return elation.utils.arrayget(this.properties, property, defval);
  }
  this.init3D = function() {
    if (this.objects['3d']) {
      if (this.objects['3d'].parent) { this.objects['3d'].parent.remove(this.objects['3d']); }
    }
    if (this.properties.tags) {
      var tags = this.properties.tags.split(',');
      for (var i = 0; i < tags.length; i++) { 
        this.addTag(tags[i].trim());
      }
    }
    this.objects['3d'] = this.createObject3D();
    if (this.objects['3d']) {
      this.objects['3d'].bindPosition(this.properties.position);
      this.objects['3d'].bindQuaternion(this.properties.orientation);
      this.objects['3d'].bindScale(this.properties.scale);
      //this.objects['3d'].useQuaternion = true;
      this.objects['3d'].userData.thing = this;
    }
    if (!this.colliders) {
      this.colliders = new THREE.Object3D();
      this.colliders.bindPosition(this.properties.position);
      this.colliders.bindQuaternion(this.properties.orientation);
      this.colliders.bindScale(this.properties.scale);
      //this.colliders.scale.set(1/this.properties.scale.x, 1/this.properties.scale.y, 1/this.properties.scale.z);
      this.colliders.userData.thing = this;
    }

    var childkeys = Object.keys(this.children);
    if (childkeys.length > 0) {
      // Things were added during initialization, so make sure they're added to the scene
      for (var i = 0; i < childkeys.length; i++) {
        var k = childkeys[i];
        if (this.children[k].objects['3d']) {
          this.objects['3d'].add(this.children[k].objects['3d']);
        }
      }
    }
    if (!this.properties.visible) {
      this.hide();
    }
    this.refresh();
  }
  this.initDOM = function() {
    if (ENV_IS_BROWSER) {
      this.objects['dom'] = this.createObjectDOM();
      elation.html.addclass(this.container, "space.thing");
      elation.html.addclass(this.container, "space.things." + this.type);
      //this.updateDOM();
    }
  }
  this.initPhysics = function() {
    if (this.properties.physical) {
      this.createDynamics();
      this.createForces();
    }
  }
  this.createObject3D = function() {
    // if (this.properties.exists === false || !ENV_IS_BROWSER) return;
    if (this.properties.exists === false) return;

    var object = null, geometry = null, material = null;
    var cachebust = '';
    if (this.properties.forcereload) cachebust = '?n=' + (Math.floor(Math.random() * 10000));
    if (this.properties.render) {
      if (this.properties.render.scene) {
        this.loadJSONScene(this.properties.render.scene, this.properties.render.texturepath + cachebust);
      } else if (this.properties.render.mesh) {
        this.loadJSON(this.properties.render.mesh, this.properties.render.texturepath + cachebust);
      } else if (this.properties.render.collada) {
        this.loadCollada(this.properties.render.collada + cachebust);
      } else if (this.properties.render.model) {
        object = elation.engine.assets.find('model', this.properties.render.model);
      } else if (this.properties.render.gltf) {
        this.loadglTF(this.properties.render.gltf + cachebust);
      } else if (this.properties.render.meshname) {
        object = new THREE.Object3D();
        setTimeout(elation.bind(this, this.loadMeshName, this.properties.render.meshname), 0);
      }
    }

    var geomparams = elation.utils.arrayget(this.properties, "generic.geometry") || {};
    switch (geomparams.type) {
      case 'sphere':
        geometry = new THREE.SphereGeometry(geomparams.radius || geomparams.size, geomparams.segmentsWidth, geomparams.segmentsHeight);
        break;
      case 'cube':
        geometry = new THREE.BoxGeometry(
          geomparams.width || geomparams.size,
          geomparams.height || geomparams.size,
          geomparams.depth || geomparams.size, 
          geomparams.segmentsWidth || 1, 
          geomparams.segmentsHeight || 1, 
          geomparams.segmentsDepth || 1);
        break;
      case 'cylinder':
        geometry = new THREE.CylinderGeometry(
          geomparams.radiusTop || geomparams.radius,
          geomparams.radiusBottom || geomparams.radius,
          geomparams.height,
          geomparams.segmentsRadius,
          geomparams.segmentsHeight,
          geomparams.openEnded);
        break;
      case 'torus':
        geometry = new THREE.TorusGeometry(geomparams.radius, geomparams.tube, geomparams.segmentsR, geomparams.segmentsT, geomparams.arc);
        break;
    }
    if (geometry) {
      var materialparams = elation.utils.arrayget(this.properties, "generic.material") || {};
      if (materialparams instanceof THREE.Material) {
        material = materialparams;
      } else {
        switch (materialparams.type) {
          case 'phong':
            material = new THREE.MeshPhongMaterial(materialparams);
            break;
          case 'lambert':
            material = new THREE.MeshLambertMaterial(materialparams);
            break;
          case 'face':
            material = new THREE.MeshFaceMaterial();
            break;
          case 'depth':
            material = new THREE.MeshDepthMaterial();
            break;
          case 'normal':
            material = new THREE.MeshNormalMaterial();
            break;
          case 'basic':
          default:
            material = new THREE.MeshBasicMaterial(materialparams);
        }
      }
    }

    if (!geometry && !material) {
      //geometry = new THREE.BoxGeometry(1, 1, 1);
      //material = new THREE.MeshPhongMaterial({color: 0xcccccc, opacity: .2, emissive: 0x333333, transparent: true});
      //console.log('made placeholder thing', geometry, material);
    }

    if (!object) {
      object = (geometry && material ? new THREE.Mesh(geometry, material) : new THREE.Object3D());
    }
    if (geometry && material) {
      if (geomparams.flipSided) material.side = THREE.BackSide;
      if (geomparams.doubleSided) material.side = THREE.DoubleSide;
    }
    this.objects['3d'] = object;
    //this.spawn('gridhelper', {persist: false});
    return object;
  }
  this.createObjectDOM = function() {
    return;
  }
  this.createChildren = function() {
    return;
  }
  this.add = function(thing) {
    if (!this.children[thing.id]) {
      this.children[thing.id] = thing;
      thing.parent = this;
      if (this.objects && thing.objects && this.objects['3d'] && thing.objects['3d']) {
        this.objects['3d'].add(thing.objects['3d']);
      } else if (thing instanceof THREE.Object3D) {
        this.objects['3d'].add(thing);
      }
      if (this.objects && thing.objects && this.objects['dynamics'] && thing.objects['dynamics']) {
        this.objects['dynamics'].add(thing.objects['dynamics']);
      }
      if (this.container && thing.container) {
        this.container.appendChild(thing.container);
      }
      if (this.colliders && thing.colliders) {
        this.colliders.add(thing.colliders);
      }
      elation.events.fire({type: 'thing_add', element: this, data: {thing: thing}});
      return true;
    } else {
      console.log("Couldn't add ", thing.name, " already exists in ", this.name);
    }
    return false;
  }
  this.remove = function(thing) {
    if (thing && this.children[thing.id]) {
      if (this.objects['3d'] && thing.objects['3d']) {
        this.objects['3d'].remove(thing.objects['3d']);
      }
      if (thing.container && thing.container.parentNode) {
        thing.container.parentNode.removeChild(thing.container);
      }
      if (thing.objects['dynamics'] && thing.objects['dynamics'].parent) {
        thing.objects['dynamics'].parent.remove(thing.objects['dynamics']);
      }
      if (this.colliders && thing.colliders) {
        this.colliders.remove(thing.colliders);
      }
      if (thing.colliderhelper) {
        this.engine.systems.world.scene['colliders'].remove(thing.colliderhelper);
      }
      elation.events.fire({type: 'thing_remove', element: this, data: {thing: thing}});
      delete this.children[thing.id];
    } else {
      console.log("Couldn't remove ", thing.name, " doesn't exist in ", this.name);
    }
  }
  this.reparent = function(newparent) {
    if (newparent) {
      if (this.parent) {
        newparent.worldToLocal(this.parent.localToWorld(this.properties.position));
        this.properties.orientation.copy(newparent.worldToLocalOrientation(this.parent.localToWorldOrientation()));
        this.parent.remove(this);
        //newparent.worldToLocalDir(this.parent.localToWorldDir(this.properties.orientation));
      }
      var success = newparent.add(this);
      this.refresh();
      return success;
    }
    return false;
  }
  this.show = function() {
    this.objects['3d'].visible = true;
  }
  this.hide = function() {
    this.objects['3d'].visible = false;
  }
  this.createDynamics = function() {
    if (!this.objects['dynamics'] && this.engine.systems.physics) {
      this.objects['dynamics'] = new elation.physics.rigidbody({
        position: this.properties.position,
        orientation: this.properties.orientation,
        mass: this.properties.mass,
        velocity: this.properties.velocity,
        acceleration: this.properties.acceleration,
        angular: this.properties.angular,
        angularacceleration: this.properties.angularacceleration,
        object: this
      });
      //this.engine.systems.physics.add(this.objects['dynamics']);

      if ((this.properties.collidable || this.properties.pickable) && this.objects['3d'] && this.objects['3d'].geometry) {
        setTimeout(elation.bind(this, this.updateColliderFromGeometry), 0);
      }

      elation.events.add(this.objects['dynamics'], "physics_update,physics_collide", this);
      elation.events.add(this.objects['dynamics'], "physics_update", elation.bind(this, this.refresh));
    }
  }
  this.removeDynamics = function() {
    if (this.objects.dynamics) {
      if (this.objects.dynamics.parent) {
        this.objects.dynamics.parent.remove(this.objects.dynamics);
      } else {
        this.engine.systems.physics.remove(this.objects.dynamics);
      }
      delete this.objects.dynamics;
    }
  }
  this.createForces = function() {
  }
  this.updateColliderFromGeometry = function(geom) {
      if (!geom) geom = this.objects['3d'].geometry;
      var collidergeom = false;
      // Determine appropriate collider for the geometry associated with this thing
      var dyn = this.objects['dynamics'];
      if (geom && dyn) {
        if (geom instanceof THREE.SphereGeometry ||
            geom instanceof THREE.SphereBufferGeometry) {
          if (!geom.boundingSphere) geom.computeBoundingSphere();
          this.setCollider('sphere', {radius: geom.boundingSphere.radius});
        } else if (geom instanceof THREE.PlaneGeometry || geom instanceof THREE.PlaneBufferGeometry) {
          if (!geom.boundingBox) geom.computeBoundingBox();
          var size = new THREE.Vector3().subVectors(geom.boundingBox.max, geom.boundingBox.min);

          // Ensure minimum size
          if (size.x < 1e-6) size.x = .25;
          if (size.y < 1e-6) size.y = .25;
          if (size.z < 1e-6) size.z = .25;

          this.setCollider('box', geom.boundingBox);
        } else if (geom instanceof THREE.CylinderGeometry) {
          if (geom.radiusTop == geom.radiusBottom) {
            this.setCollider('cylinder', {height: geom.height, radius: geom.radiusTop});
          } else {
            console.log('FIXME - cylinder collider only supports uniform cylinders for now');
          }
        } else if (!dyn.collider) {
          if (!geom.boundingBox) geom.computeBoundingBox();
          this.setCollider('box', geom.boundingBox);
        }
      }
  }
  this.setCollider = function(type, args, rigidbody) {
    if (!rigidbody) rigidbody = this.objects['dynamics'];
    if (this.properties.collidable) {
      rigidbody.setCollider(type, args);
    }
    if (this.properties.collidable || this.properties.pickable) {
      var collidergeom = false;
      if (type == 'sphere') {
        collidergeom = elation.engine.geometries.generate('sphere', { 
          radius: args.radius
        });
      } else if (type == 'box') {
        var size = new THREE.Vector3().subVectors(args.max, args.min);
        var offset = new THREE.Vector3().addVectors(args.max, args.min).multiplyScalar(.5);
        collidergeom = elation.engine.geometries.generate('box', { 
          size: size,
          offset: offset
        });
      } else if (type == 'cylinder') {
        collidergeom = elation.engine.geometries.generate('cylinder', {
          radius: args.radius,
          height: args.height,
          radialSegments: 12
        });
      } else if (type == 'capsule') {
        collidergeom = elation.engine.geometries.generate('capsule', {
          radius: args.radius,
          length: args.length,
          radialSegments: 8,
          offset: args.offset,
        });
      }
      /*
      if (this.collidermesh) {
        this.colliders.remove(this.collidermesh);
        this.engine.systems.world.scene['colliders'].remove(this.colliderhelper);
        this.collidermesh = false;
      }
      */
      if (collidergeom) {
        var collidermat = new THREE.MeshLambertMaterial({color: 0x999900, opacity: .2, transparent: true, emissive: 0x444400, alphaTest: .1, depthTest: false, depthWrite: false});

        var collidermesh = new THREE.Mesh(collidergeom, collidermat);
        if (rigidbody.position !== this.properties.position) {
          collidermesh.bindPosition(rigidbody.position);
          collidermesh.bindQuaternion(rigidbody.orientation);
          //collidermesh.bindScale(this.properties.scale);
        }
        collidermesh.userData.thing = this;
        this.colliders.add(collidermesh);
        collidermesh.updateMatrixWorld();
        var colliderhelper = new THREE.EdgesHelper(collidermesh, 0x999900);
        this.engine.systems.world.scene['colliders'].add(colliderhelper);

        // TODO - integrate this with the physics debug system
        /*
        elation.events.add(rigidbody, 'physics_collide', function() { 
          collidermat.color.setHex(0x990000); 
          colliderhelper.material.color.setHex(0x990000); 
          setTimeout(function() { 
            collidermat.color.setHex(0x999900); 
            colliderhelper.material.color.setHex(0x999900); 
          }, 100); 
        });
        elation.events.add(this, 'mouseover,mouseout', elation.bind(this, function(ev) { 
          var color = 0xffff00;
          if (ev.type == 'mouseover' && ev.data.object === collidermesh) {
            color = 0x00ff00;
          }
          collidermat.color.setHex(0xffff00); 
          colliderhelper.material.color.setHex(color); 
          this.refresh();
        }));
        */
      }
    }
  }
  this.physics_collide = function(ev) {
    var obj1 = ev.data.bodies[0].object, obj2 = ev.data.bodies[1].object;

    elation.events.fire({type: 'collide', element: this, data: {
      other: (obj1 == this ? obj2 : obj1)
    } });
  }
  this.loadJSON = function(url, texturepath) {
    if (typeof texturepath == 'undefined') {
      texturepath = '/media/space/textures/';
    }
    var loader = new THREE.JSONLoader();
    loader.load(url, elation.bind(this, this.processJSON), texturepath);
  }
  this.processJSON = function(geometry, materials) {
    geometry.computeFaceNormals();
    geometry.computeVertexNormals();
    var mesh = new THREE.Mesh(geometry, new THREE.MeshFaceMaterial(materials));
    mesh.doubleSided = false;
    mesh.castShadow = false;
    mesh.receiveShadow = false;
    //this.objects['3d'].updateCollisionSize();
    elation.events.fire({type: "thing_load", element: this, data: mesh});
    this.objects['3d'].add(mesh);
    this.refresh();
  }
  this.loadJSONScene = function(url, texturepath) {
    if (typeof texturepath == 'undefined') {
      texturepath = '/media/space/textures';
    }
    var loader = new THREE.ObjectLoader();
    loader.load(url, elation.bind(this, this.processJSONScene, url));
  }
  this.processJSONScene = function(url, scene) {
    this.extractEntities(scene);
    this.objects['3d'].add(scene);

    this.extractColliders(scene);
    var textures = this.extractTextures(scene, true);
    this.loadTextures(textures);
    elation.events.fire({ type: 'resource_load_finish', element: this, data: { type: 'model', url: url } });

    this.refresh();
  }
  this.loadCollada = function(url) {
    if (ENV_IS_NODE) return;
    if (!THREE.ColladaLoader) {
      // If the loader hasn't been initialized yet, fetch it!
      elation.require('engine.external.three.ColladaLoader', elation.bind(this, this.loadCollada, url));
    } else {
      var loader = new THREE.ColladaLoader();
      loader.options.convertUpAxis = true;
      var xhr = loader.load(url, elation.bind(this, this.processCollada, url));
      elation.events.fire({ type: 'resource_load_start', element: this, data: { type: 'model', url: url } });
    }
  }
  this.processCollada = function(url, collada) {
   //collada.scene.rotation.x = -Math.PI / 2;
   //collada.scene.rotation.z = Math.PI;
    this.extractEntities(collada.scene);
/*
    collada.scene.computeBoundingSphere();
    collada.scene.computeBoundingBox();
    //this.updateCollisionSize();
*/
    this.objects['3d'].add(collada.scene);

    this.extractColliders(collada.scene, true);
    var textures = this.extractTextures(collada.scene, true);
    this.loadTextures(textures);
    elation.events.fire({ type: 'resource_load_finish', element: this, data: { type: 'model', url: url } });

    this.refresh();
  }
  this.loadglTF = function(url) {
    if (!THREE.glTFLoader) {
      // If the loader hasn't been initialized yet, fetch it!
      elation.require('engine.external.three.glTFLoader-combined', elation.bind(this, this.loadglTF, url));
    } else {
      var loader = new THREE.glTFLoader();
      loader.useBufferGeometry = true;
      loader.load(url, elation.bind(this, this.processglTF, url));
      elation.events.fire({ type: 'resource_load_start', data: { type: 'model', url: url } });
    }
  }
  this.processglTF = function(url, scenedata) {
    this.extractEntities(scenedata.scene);
    //this.updateCollisionSize();
    //this.objects['3d'].add(scenedata.scene);
    var parent = this.objects['3d'].parent;
    parent.remove(this.objects['3d']);
    this.objects['3d'] = new THREE.Object3D();
    this.objects['3d'].bindPosition(this.properties.position);
    this.objects['3d'].bindQuaternion(this.properties.orientation);
    this.objects['3d'].bindScale(this.properties.scale);
    this.objects['3d'].userData.thing = this;

    // Correct coordinate space from various modelling programs
    // FIXME - hardcoded for blender's settings for now, this should come from a property
    var scene = scenedata.scene;
    scene.rotation.x = -Math.PI/2;

    // FIXME - enable shadows for all non-transparent materials.  This should be coming from the model file...
    scene.traverse(function(n) {
      if (n instanceof THREE.Mesh) {
        if (n.material && !(n.material.transparent || n.material.opacity < 1.0)) {
          n.castShadow = true;
          n.receiveShadow = true;
        } else {
          n.castShadow = false;
          n.receiveShadow = false;
        }
      }
    });

/*
    while (scenedata.scene.children.length > 0) {
      var obj = scenedata.scene.children[0];
      scenedata.scene.remove(obj);
      coordspace.add(obj);
    }
    this.objects['3d'].add(coordspace);
*/
    this.objects['3d'].add(scene);

    //this.objects['3d'].quaternion.setFromEuler(scenedata.scene.rotation);

    var textures = this.extractTextures(scene, true);
    this.loadTextures(textures);

    parent.add(this.objects['3d']);

    // If no pending textures, we're already loaded, so fire the event
    if (this.pendingtextures == 0) {
      elation.events.fire({type: "thing_load", element: this, data: scenedata.scene});
    }

    elation.events.fire({ type: 'resource_load_finish', data: { type: 'model', url: url } });

    this.refresh();
  }
  this.loadMeshName = function(meshname) {
    var subobj = elation.engine.geometries.getMesh(meshname);
    subobj.rotation.x = -Math.PI/2;
    subobj.rotation.y = 0;
    subobj.rotation.z = Math.PI;
    this.extractEntities(subobj);
    this.objects['3d'].add(subobj);
    this.extractColliders(subobj);

    elation.events.add(null, 'resource_load_complete', elation.bind(this, this.extractColliders, subobj));

    if (ENV_IS_BROWSER){
      var textures = this.extractTextures(subobj, true);
      this.loadTextures(textures);
    }
  }
  this.extractEntities = function(scene) {
    this.cameras = [];
    this.parts = {};
    scene.traverse(elation.bind(this, function ( node ) { 
      if ( node instanceof THREE.Camera ) {
        this.cameras.push(node);
      //} else if (node instanceof THREE.Mesh) {
      } else if (node.name !== '') {
        this.parts[node.name] = node;
        node.castShadow = this.properties.shadow;
        node.receiveShadow = this.properties.shadow;
      }
      if (node.material) {
        node.material.fog = this.properties.fog;
        node.material.wireframe = this.properties.wireframe;
      }
    }));
    //console.log('Collada loaded: ', this.parts, this.cameras, this); 
    if (this.cameras.length > 0) {
      this.camera = this.cameras[0];
    }
    //this.updateCollisionSize();
  }
  this.extractColliders = function(obj, useParentPosition) {
    if (!(this.properties.collidable || this.properties.pickable)) return;
    var meshes = [];
    if (!obj) obj = this.objects['3d'];
    var re = new RegExp(/^[_\*](collider|trigger)-(.*)$/);

    obj.traverse(function(n) { 
      if (n instanceof THREE.Mesh && n.material && n.material.name && n.material.name.match(re)) { 
        n.geometry.computeBoundingBox(); 
        n.geometry.computeBoundingSphere(); 
        meshes.push(n); 
      } 
    });

    // FIXME - hack to make demo work
    //this.colliders.bindPosition(this.localToWorld(new THREE.Vector3()));

    //var flip = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, Math.PI, 0));
    var flip = new THREE.Quaternion();
    var root = new elation.physics.rigidbody({orientation: flip});// orientation: obj.quaternion.clone() });
    //root.orientation.multiply(flip);

    for (var i = 0; i < meshes.length; i++) {
      var m = meshes[i].material.name.match(re),
          type = m[1],
          shape = m[2];

      var rigid = new elation.physics.rigidbody();
      var min = meshes[i].geometry.boundingBox.min,
          max = meshes[i].geometry.boundingBox.max;
      //console.log('type is', type, min, max);

      var position = meshes[i].position,
          orientation = meshes[i].quaternion;
      if (useParentPosition) {
        position = meshes[i].parent.position;
        orientation = meshes[i].parent.quaternion;
      }
 
      rigid.position.copy(position);
      rigid.orientation.copy(orientation);

      min.x *= this.properties.scale.x;
      min.y *= this.properties.scale.y;
      min.z *= this.properties.scale.z;
      max.x *= this.properties.scale.x;
      max.y *= this.properties.scale.y;
      max.z *= this.properties.scale.z;

      rigid.position.x *= this.properties.scale.x;
      rigid.position.y *= this.properties.scale.y;
      rigid.position.z *= this.properties.scale.z;

      if (shape == 'box') {
        this.setCollider('box', {min: min, max: max}, rigid);
      } else if (shape == 'sphere') {
        this.setCollider('sphere', {radius: Math.max(max.x, max.y, max.z)}, rigid);
      } else if (shape == 'cylinder') {
        var radius = Math.max(max.x - min.x, max.z - min.z) / 2,
            height = max.y - min.y;
        this.setCollider('cylinder', {radius: radius, height: height}, rigid);

        // FIXME - rotate everything by 90 degrees on x axis to match default orientation
        var rot = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, -Math.PI/2, 0));
        rigid.orientation.multiply(rot);
      }

      if (type == 'collider') {
        //console.log('add collider:', rigid, rigid.position.toArray(), rigid.orientation.toArray());
        root.add(rigid);
      } else if (type == 'trigger') {
        var triggername = meshes[i].parent.name;

        var size = new THREE.Vector3().subVectors(max, min);
/*
        size.x /= this.properties.scale.x;
        size.y /= this.properties.scale.y;
        size.z /= this.properties.scale.z;
*/

        var quat = new THREE.Quaternion().multiplyQuaternions(obj.quaternion, rigid.orientation); 
        var pos = rigid.position.clone().applyQuaternion(quat);
/*
        pos.x /= this.properties.scale.x;
        pos.y /= this.properties.scale.y;
        pos.z /= this.properties.scale.z;
*/

        this.triggers[triggername] = this.spawn('trigger', 'trigger_' + this.name + '_' + triggername, {
          position: pos, 
          orientation: quat,
          shape: shape,
          size: size,
          scale: new THREE.Vector3(1 / this.properties.scale.x, 1 / this.properties.scale.y, 1 / this.properties.scale.z)
        });
      }
      meshes[i].parent.remove(meshes[i]);
/*
      meshes[i].bindPosition(rigid.position);
      meshes[i].bindQuaternion(rigid.orientation);
      //meshes[i].bindScale(this.properties.scale);
      meshes[i].userData.thing = this;
      meshes[i].updateMatrixWorld();
      meshes[i].material = new THREE.MeshPhongMaterial({color: 0x999900, emissive: 0x666666, opacity: .5, transparent: true});
      this.colliders.add(meshes[i]);
      meshes[i].material = new THREE.MeshLambertMaterial({color: 0x999900, opacity: .2, transparent: true, emissive: 0x444400, alphaTest: .1, depthTest: false, depthWrite: false});
      this.colliderhelper = new THREE.EdgesHelper(meshes[i], 0x00ff00);
      this.colliders.add(this.colliderhelper);
      this.engine.systems.world.scene['colliders'].add(this.colliderhelper);
      meshes[i].updateMatrixWorld();
*/
    }
    if (this.objects.dynamics) {
      this.objects.dynamics.add(root);
    }

    /*
    new3d.scale.copy(obj.scale);
    new3d.position.copy(obj.position);
    new3d.quaternion.copy(obj.quaternion);
    this.objects['3d'].add(new3d);
    */
    //this.colliders.bindScale(this.properties.scale);
    //this.colliders.updateMatrixWorld();
    return this.colliders;
  }
  this.extractTextures = function(object, useloadhandler) {
    if (!object) object = this.objects['3d'];

    // Extract the unique texture images out of the specified object
    var unique = {};
    var ret = [];
    var mapnames = ['map', 'lightMap', 'bumpMap', 'normalMap', 'specularMap', 'envMap'];
    object.traverse(function(n) {
      if (n instanceof THREE.Mesh) {
        var materials = [n.material];
        if (n.material instanceof THREE.MeshFaceMaterial) {
          materials = n.material.materials;
        }
        
        for (var materialidx = 0; materialidx < materials.length; materialidx++) {
          var m = materials[materialidx];
          for (var mapidx = 0; mapidx < mapnames.length; mapidx++) {
            var tex = m[mapnames[mapidx]];
            if (tex) {
              if (tex.image && !unique[tex.image.src]) {
                unique[tex.image.src] = true;
                ret.push(tex);
              } else if (!tex.image && tex.sourceFile != '') {  
                if (!unique[tex.sourceFile]) {
                  unique[tex.sourceFile] = true;
                  ret.push(tex);
                }
              } else if (!tex.image) {
                ret.push(tex);
              }
            }
          }
        }
      }
    });
    return ret;
  }
  this.loadTextures = function(textures) {
    this.pendingtextures = 0;
    for (var i = 0; i < textures.length; i++) {
      if (textures[i].image) {
        if (!textures[i].image.complete) {
          elation.events.fire({ type: 'resource_load_start', data: { type: 'image', image: textures[i].image } });
          this.pendingtextures++;
          elation.events.add(textures[i].image, 'load', elation.bind(this, this.textureLoadComplete));
        }
      }
    }

    // Everything was already loaded, so fire the event immediately
    if (this.pendingtextures === 0) {
      this.refresh();
      elation.events.fire({type: "thing_load", element: this, data: this.objects['3d']});
    }
  }
  this.textureLoadComplete = function(ev) {
    this.refresh();
    if (--this.pendingtextures == 0) {
      // Fire the thing_load event once all textures are loaded
      elation.events.fire({type: "thing_load", element: this, data: this.objects['3d']});
    }
  }
  this.spawn = function(type, name, spawnargs, orphan) {
    var newspawn = this.engine.systems.world.spawn(type, name, spawnargs, (orphan ? null : this));
    return newspawn;
  }
  this.die = function() {
    this.removeDynamics();
    if (this.parent) {
      this.parent.remove(this);
    }
    if (this.children) {
      var keys = Object.keys(this.children);
      for (var i = 0; i < keys.length; i++) {
        this.children[keys[i]].die();
      }
    }
    elation.events.fire({element: this, type: 'thing_destroy'});
    this.destroy();
  }
  this.refresh = function() {
    elation.events.fire({type: 'thing_change', element: this});
  }
  this.reload = function() {
    this.set('forcereload', true, true);
  }
  this.worldToLocal = function(worldpos) {
    if (this.objects['3d'].matrixWorldNeedsUpdate) this.objects['3d'].updateMatrixWorld();
    return this.objects['3d'].worldToLocal(worldpos);
  }
  this.localToWorld = function(localpos) {
    if (this.objects['3d'].matrixWorldNeedsUpdate) this.objects['3d'].updateMatrixWorld();
    return this.objects['3d'].localToWorld(localpos);
  }
  this.worldToParent = function(worldpos) {
    if (this.objects['3d'].matrixWorldNeedsUpdate) this.objects['3d'].updateMatrixWorld();
    return this.objects['3d'].parent.worldToLocal(worldpos);
  }
  this.localToParent = function(localpos) {
    if (this.objects['3d'].matrixWorldNeedsUpdate) this.objects['3d'].updateMatrixWorld();
    return localpos.applyMatrix4(this.objects['3d'].matrix);
  }
  this.localToWorldOrientation = function(orient) {
    if (!orient) orient = new THREE.Quaternion();
    var n = this;
    while (n && n.properties) {
      orient.multiply(n.properties.orientation);
      n = n.parent;
    }
    return orient;
  }
  this.worldToLocalOrientation = function(orient) {
    if (!orient) orient = new THREE.Quaternion();
/*
    var n = this.parent;
    var worldorient = new THREE.Quaternion();
    while (n && n.properties) {
      worldorient.multiply(inverse.copy(n.properties.orientation).inverse());
      n = n.parent;
    }
    return orient.multiply(worldorient);
*/
    // FIXME - this is cheating!
    var tmpquat = new THREE.Quaternion();
    return orient.multiply(tmpquat.copy(this.objects.dynamics.orientationWorld).inverse());
    
  }
  this.lookAt = function(other, up) {
    if (!up) up = new THREE.Vector3(0,1,0);
    var otherpos = false;
    if (other.properties && other.properties.position) {
      otherpos = other.localToWorld(new THREE.Vector3());
    } else if (other instanceof THREE.Vector3) {
      otherpos = other.clone();
    }
    var thispos = this.localToWorld(new THREE.Vector3());

    if (otherpos) {
      var dir = thispos.clone().sub(otherpos).normalize();
      var axis = new THREE.Vector3().crossVectors(up, dir);
      var angle = dir.dot(up);
      //this.properties.orientation.setFromAxisAngle(axis, -angle);
console.log(thispos.toArray(), otherpos.toArray(), dir.toArray(), axis.toArray(), angle, this.properties.orientation.toArray());
    }
  }
  this.serialize = function(serializeAll) {
    var ret = {
      name: this.name,
      parentname: this.parentname,
      type: this.type,
      properties: {},
      things: {}
    };
    var numprops = 0,
        numthings = 0;

    for (var k in this._thingdef.properties) {
      var propdef = this._thingdef.properties[k];
      var propval = this.get(k);
      if (propval !== null) {
        switch (propdef.type) {
          case 'vector2':
          case 'vector3':
          case 'vector4':
            propval = propval.toArray();
            for (var i = 0; i < propval.length; i++) propval[i] = +propval[i]; // FIXME - force to float 
            break;
          case 'quaternion':
            propval = [propval.x, propval.y, propval.z, propval.w];
            break;
          case 'texture':
            propval = propval.sourceFile;
            break;
/*
          case 'color':
            propval = propval.getHexString();
            break;
*/
          case 'component':
            var ref = propval;
            propval = [ ref.type, ref.id ];
            break;

        }
        try {
          if (propval !== null && !elation.utils.isIdentical(propval, propdef.default)) {
            //elation.utils.arrayset(ret.properties, k, propval);
            ret.properties[k] = propval;
            numprops++;
          }
        } catch (e) {
          console.log("Error serializing property: " + k, this, e); 
        }
      }
    }
    if (numprops == 0) delete ret.properties;

    for (var k in this.children) {
      if (this.children[k].properties) {
        if (!serializeAll) {
          if (this.children[k].properties.persist) {
            ret.things[k] = this.children[k].serialize();
            numthings++;
          }
        }
        else {
          ret.things[k] = this.children[k].serialize();
          numthings++;
        }
      } else {
        console.log('huh what', k, this.children[k]);
      }
    }
    if (numthings == 0) delete ret.things;

    return ret;
  }
  //this.thing_add = function(ev) {
  //  elation.events.fire({type: 'thing_add', element: this, data: ev.data});
  //}

/*
  this.createCamera = function(offset, rotation) {
    //var viewsize = this.engine.systems.render.views['main'].size;
    var viewsize = [640, 480]; // FIXME - hardcoded hack!
    this.cameras.push(new THREE.PerspectiveCamera(50, viewsize[0] / viewsize[1], .01, 1e15));
    this.camera = this.cameras[this.cameras.length-1];
    if (offset) {
      this.camera.position.copy(offset)
    }
    if (rotation) {
      //this.camera.eulerOrder = "YZX";
      this.camera.rotation.copy(rotation);
    }
    this.objects['3d'].add(this.camera);
  }
*/

  // Sound functions
  this.playSound = function(sound, volume, position, velocity) {
    if (this.sounds[sound] && this.engine.systems.sound.enabled) {
      this.updateSound(sound, volume, position, velocity);
      this.sounds[sound].play();
    }
  }
  this.stopSound = function(sound) {
    if (this.sounds[sound] && this.sounds[sound].playing) {
      this.sounds[sound].stop();
    }
  }
  this.updateSound = function(sound, volume, position, velocity) {
    if (this.sounds[sound]) {
      if (!volume) volume = 100;
      this.sounds[sound].setVolume(volume);
      if (position) {
        this.sounds[sound].setPan([position.x, position.y, position.z], (velocity ? [velocity.x, velocity.y, velocity.z] : [0,0,0]));
      }
    }
  }
  this.addTag = function(tag) {
    if (!this.hasTag(tag)) {
      this.tags.push(tag);
      return true;
    }
    return false;
  }
  this.hasTag = function(tag) {
    return (this.tags.indexOf(tag) !== -1);
  }
  this.removeTag = function(tag) {
    var idx = this.tags.indexOf(tag);
    if (idx !== -1) {
      this.tags.splice(idx, 1);
      return true;
    }
    return false;
  }
  this.getPlayer = function() {
    console.log('player id:', this.get('player_id'));
    return this.get('player_id');
  }
  this.addPart = function(name, part) {
    if (this.parts[name] === undefined) {
      this.parts[name] = part;
      var type = part.componentname;
      if (this.parttypes[type] === undefined) {
        this.parttypes[type] = [];
      }
      this.parttypes[type].push(part);
      return true;
    }
    return false;
  }
  this.hasPart = function(name) {
    return (this.parts[name] !== undefined);
  }
  this.hasPartOfType = function(type) {
    return (this.parttypes[type] !== undefined && this.parttypes[type].length > 0);
  }
  this.getPart = function(name) {
    return this.parts[name];
  }
  this.getPartsByType = function(type) {
    return this.parttypes[type] || [];
  }
  this.getThingByObject = function(obj) {
    while (obj) {
      if (obj.userData.thing) return obj.userData.thing;
      obj = obj.parent;
    }
    return null;
  }
  this.getObjectsByTag = function(tag) {
  }
  this.getChildrenByPlayer = function(player, collection) {
    if (typeof collection == 'undefined') collection = [];
    for (var k in this.children) {
      if (this.children[k].getPlayer() == player) {
        collection.push(this.children[k]);
      }
      this.children[k].getChildrenByPlayer(player, collection);
    }
    return collection;
  }
  this.getChildrenByTag = function(tag, collection) {
    if (typeof collection == 'undefined') collection = [];
    for (var k in this.children) {
      if (this.children[k].hasTag(tag)) {
        collection.push(this.children[k]);
      }
      this.children[k].getChildrenByTag(tag, collection);
    }
    return collection;
  }
  this.getChildrenByType = function(type, collection) {
    if (typeof collection == 'undefined') collection = [];
    for (var k in this.children) {
      if (this.children[k].type == type) {
        collection.push(this.children[k]);
      }
      this.children[k].getChildrenByType(type, collection);
    }
    return collection;
  }
  this.distanceTo = (function() {
    // closure scratch variables
    var _v1 = new THREE.Vector3(),
        _v2 = new THREE.Vector3();
    return function(obj) {
      var mypos = this.localToWorld(_v1.set(0,0,0));
      if (obj && obj.localToWorld) {
        return mypos.distanceTo(obj.localToWorld(_v2.set(0,0,0)));
      } else if (obj instanceof THREE.Vector3) {
        return mypos.distanceTo(obj);
      }
      return Infinity;
    } 
  });
  this.canUse = function(object) {
    return false;
  }
  this.thing_use_activate = function(ev) {
    var player = ev.data;
    var canuse = this.canUse(player);
    if (canuse && canuse.action) {
      canuse.action(player);
    }
  }
  this.getBoundingSphere = function() {
    // Iterate over all children and expand our bounding sphere to encompass them.  
    // This gives us the total size of the whole thing

    var bounds = new THREE.Sphere();
    var worldpos = this.localToWorld(new THREE.Vector3());
    var childworldpos = new THREE.Vector3();
    this.objects['3d'].traverse(function(n) {
      childworldpos.set(0,0,0).applyMatrix4(n.matrixWorld);
      if (n.boundingSphere) {
        var newradius = worldpos.distanceTo(childworldpos) + n.boundingSphere.radius;
        if (newradius > bounds.radius) {
          bounds.radius = newradius;
        }
      }
    });
    return bounds; 
  }
});
