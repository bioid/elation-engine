elation.require(['engine.things.generic', 'engine.things.camera', 'ui.progressbar', 'engine.things.ball'], function() {
  elation.component.add('engine.things.player', function() {
    this.targetrange = 1.8;
    this.postinit = function() {
      this.defineProperties({
        height: { type: 'float', default: 2.0 },
        fatness: { type: 'float', default: .25 },
        mass: { type: 'float', default: 10.0 },
        movespeed: { type: 'float', default: 300.0 },
        runspeed: { type: 'float', default: 600.0 },
        crouchspeed: { type: 'float', default: 150.0 },
        turnspeed: { type: 'float', default: 2.0 },
        movefriction: { type: 'float', default: 4.0 },
        defaultplayer: { type: 'boolean', default: true },
        startposition: { type: 'vector3', default: new THREE.Vector3() },
        startorientation: { type: 'quaternion', default: new THREE.Quaternion() },
        startcameraorientation: { type: 'quaternion', default: new THREE.Quaternion() }
      });
      this.controlstate = this.engine.systems.controls.addContext('player', {
        'move_forward': ['keyboard_w,keyboard_shift_w', elation.bind(this, this.updateControls)],
        'move_backward': ['keyboard_s,keyboard_shift_s,gamepad_0_axis_1', elation.bind(this, this.updateControls)],
        'move_left': ['keyboard_a,keyboard_shift_a', elation.bind(this, this.updateControls)],
        'move_right': ['keyboard_d,keyboard_shift_d,gamepad_0_axis_0', elation.bind(this, this.updateControls)],
        'move_up': ['keyboard_r,keyboard_shift_r', elation.bind(this, this.updateControls)],
        'move_down': ['keyboard_f,keyboard_shift_f', elation.bind(this, this.updateControls)],
        'turn_left': ['keyboard_left,keyboard_shift_left', elation.bind(this, this.updateControls)],
        'turn_right': ['keyboard_right,keyboard_shift_right,mouse_delta_x,gamepad_0_axis_2', elation.bind(this, this.updateControls)],
        'look_up': ['keyboard_up,keyboard_shift_up', elation.bind(this, this.updateControls)],
        'look_down': ['keyboard_down,keyboard_shift_down,mouse_delta_y,gamepad_0_axis_3', elation.bind(this, this.updateControls)],
        'run': ['keyboard_shift,gamepad_0_button_10', elation.bind(this, this.updateControls)],
        'crouch': ['keyboard_c,keyboard_shift_c', elation.bind(this, this.updateControls)],
        //'jump': ['keyboard_space,keyboard_shift_space,gamepad_0_button_1', elation.bind(this, this.updateControls)],
        //'toss': ['keyboard_space,keyboard_shift_space,gamepad_0_button_0,mouse_button_0', elation.bind(this, this.toss)],
        //'toss_cube': ['keyboard_shift_space,gamepad_0_button_1', elation.bind(this, this.toss_cube)],
        'use': ['keyboard_space,keyboard_e,gamepad_0_button_0,mouse_button_0', elation.bind(this, this.handleUse)],
        'toggle_flying': ['keyboard_f,keyboard_shift_f', elation.bind(this, this.toggle_flying)],
        'reset_position': ['keyboard_backspace', elation.bind(this, this.reset_position)],
        'pointerlock': ['mouse_0', elation.bind(this, this.updateControls)],
      });
      // Separate HMD context so it can remain active when player controls are disabled
      this.hmdstate = this.engine.systems.controls.addContext('playerhmd', {
        'hmd': ['hmd_0', elation.bind(this, this.refresh)],
        'orientation': ['orientation', elation.bind(this, this.refresh)],
      });
      this.moveVector = new THREE.Vector3();
      this.turnVector = new THREE.Euler(0, 0, 0);
      this.lookVector = new THREE.Euler(0, 0, 0);
      //this.engine.systems.controls.activateContext('player');
      this.engine.systems.controls.activateContext('playerhmd');
      this.charging = false;
      this.usegravity = false;
      this.flying = true;

      this.lights = [];
      this.lightnum = 0;

      this.target = false;
      this.addTag('player');

      //elation.events.add(this.engine, 'engine_frame', elation.bind(this, this.updateHUD));
      elation.events.add(this.objects.dynamics, 'physics_update', elation.bind(this, this.handleTargeting));
      elation.events.add(this, 'thing_create', elation.bind(this, this.handleCreate));
    }
    this.createForces = function() {
      this.objects.dynamics.setDamping(1,1);
    }
    this.createObjectDOM = function() {
      this.strengthmeter = elation.ui.progressbar(null, elation.html.create({append: document.body, classname: 'player_strengthmeter'}), {orientation: 'vertical'});
    }
    this.getCharge = function() {
      return Math.max(0, Math.min(100, Math.pow((new Date().getTime() - this.charging) / 1000 * 5, 2)));
    }
    this.updateHUD = function(ev) {
      if (this.charging !== false) {
        var charge = this.getCharge();
        this.strengthmeter.set(charge);
      } else if (this.strengthmeter.value != 0) {
        this.strengthmeter.set(0);
      }
    }
    this.toss = function(ev) {
      if (this.holding) {
        if (ev.value == 1) {
          this.charging = new Date().getTime();
        } else if (this.charging) {
          var bounds = this.holding.getBoundingSphere();
          var campos = this.camera.localToWorld(new THREE.Vector3(0,0,-bounds.radius));
          var camdir = this.camera.localToWorld(new THREE.Vector3(0,0,-2)).sub(campos).normalize();
          var velocity = 0 + this.getCharge() / 10;
          camdir.multiplyScalar(velocity);
          camdir.add(this.objects.dynamics.velocity);
    //console.log('pew!', velocity);
          //var foo = this.spawn('ball', 'ball_' + Math.round(Math.random() * 100000), { radius: .125, mass: 1, position: campos, velocity: camdir, lifetime: 30, gravity: true, player_id: this.properties.player_id, tags: 'local_sync' }, true);
          //var foo = this.spawn('ball', 'ball_' + Math.round(Math.random() * 100000), { radius: .08, mass: 1, position: campos, velocity: camdir, lifetime: 30, gravity: this.usegravity, player_id: this.properties.player_id, tags: 'local_sync' }, true);

          //foo.addTag('enemy');
          this.holding.reparent(this.engine.client.world);
          //this.holding.properties.position.copy(campos);
          this.holding.objects.dynamics.setVelocity(camdir);
          console.log('throw it!', this.holding, campos, camdir);
          this.holding = false;
          this.charging = false;
        }
      } else {
        if (ev.value == 1) {
          this.charging = new Date().getTime();
        } else if (this.charging) {
          var campos = this.camera.localToWorld(new THREE.Vector3(0,0,-1));
          var camdir = this.camera.localToWorld(new THREE.Vector3(0,0,-2)).sub(campos).normalize();
          var velocity = 1 + this.getCharge() / 10;
          camdir.multiplyScalar(velocity);
          camdir.add(this.objects.dynamics.velocity);
          var foo = this.spawn('ball', 'ball_' + Math.round(Math.random() * 100000), { radius: .125, mass: 1, position: campos, velocity: camdir, lifetime: 120, gravity: false, player_id: this.properties.player_id, tags: 'local_sync' }, true);
        }
      }
    }
    this.toss_cube = function(ev) {
      if (ev.value == 1) {
        this.charging = new Date().getTime();
      } else {
        var cam = this.engine.systems.render.views['main'].camera;
        var campos = cam.localToWorld(new THREE.Vector3(0,0,-2));
        var camdir = cam.localToWorld(new THREE.Vector3(0,0,-3)).sub(campos).normalize();
        var velocity = 5 + this.getCharge();
        camdir.multiplyScalar(velocity);
        camdir.add(this.objects.dynamics.velocity);
  //console.log('pew!', velocity);
        var foo = this.spawn('crate', 'crate_' + Math.round(Math.random() * 100000), { mass: 1, position: campos, velocity: camdir, angular: this.getspin(), lifetime: 30, gravity: this.usegravity }, true);
        this.charging = false;
      }
    }
    this.toggle_flying = function(ev) {
      if (ev.value == 1) {
        this.flying = !this.flying;
        this.usegravity = !this.flying;
        this.gravityForce.update(new THREE.Vector3(0,this.usegravity * -9.8, 0));
      }
    }
    this.reset_position = function(ev) {
      if (!ev || ev.value == 1) {
        this.properties.position.copy(this.properties.startposition);
        this.properties.orientation.copy(this.properties.startorientation);
        this.camera.properties.orientation.copy(this.properties.startcameraorientation);
        this.properties.velocity.set(0,0,0);
        this.objects.dynamics.angular.set(0,0,0);
        this.engine.systems.controls.calibrateHMDs();
        this.refresh();
      }
    }
    this.getspin = function() {
      //return new THREE.Vector3();
      return new THREE.Vector3((Math.random() - .5) * 4 * Math.PI, (Math.random() - .5) * 4 * Math.PI, (Math.random() - .5) * 4 * Math.PI);
    }
    this.createObject3D = function() {
      this.objects['3d'] = new THREE.Object3D();
      this.ears = new THREE.Object3D();
      //this.camera.rotation.set(-Math.PI/16, 0, 0);

      //var camhelper = new THREE.CameraHelper(this.camera);
      //this.camera.add(camhelper);
      return this.objects['3d'];
    }
    this.createChildren = function() {
      // place camera at head height
      this.camera.objects.dynamics.addConstraint('axis', { axis: new THREE.Vector3(1,0,0), min: -Math.PI/2, max: Math.PI/2 });
      this.reset_position();
    }
    this.createForces = function() {
      this.frictionForce = this.objects.dynamics.addForce("friction", this.properties.movefriction);
      this.gravityForce = this.objects.dynamics.addForce("gravity", new THREE.Vector3(0,0,0));
      this.moveForce = this.objects.dynamics.addForce("static", {});
      this.objects.dynamics.restitution = 0.1;
      this.objects.dynamics.setCollider('sphere', {radius: this.properties.fatness});
      this.objects.dynamics.addConstraint('axis', { axis: new THREE.Vector3(0,1,0) });
      // FIXME - should be in createChildren
      this.camera = this.spawn('camera', this.name + '_camera', { position: [0,this.properties.height * .8 - this.properties.fatness,0], mass: 0.1, player_id: this.properties.player_id } );
      this.camera.objects['3d'].add(this.ears);
    }
    this.getGroundHeight = function() {
      
    }
    this.enable = function() {
      this.gravityForce.update(new THREE.Vector3(0,this.usegravity * -9.8));
      this.engine.systems.controls.activateContext('player');
      this.engine.systems.controls.enablePointerLock(true);
      if (this.engine.systems.render.views.main) {
        //this.engine.systems.render.views.main.disablePicking();
      }
      this.controlstate._reset();
      this.lookVector.set(0,0,0);
      this.turnVector.set(0,0,0);
      this.enableuse = true;
      this.enabled = true;
      this.engine.systems.controls.requestPointerLock();

      // FIXME - quick hack to ensure we don't refresh before everything is initialized
      if (this.objects.dynamics) {
        this.refresh();
      }
    }
    this.disable = function() {
      this.engine.systems.controls.deactivateContext('player');
      this.engine.systems.controls.enablePointerLock(false);
      if (this.engine.systems.render.views.main) {
        //this.engine.systems.render.views.main.enablePicking();
      }
      this.enableuse = false;
      if (this.objects.dynamics) {
        this.moveForce.update(this.moveVector.set(0,0,0));
        this.gravityForce.update(new THREE.Vector3(0,0,0));
        this.objects.dynamics.angular.set(0,0,0);
        this.objects.dynamics.velocity.set(0,0,0);
        this.objects.dynamics.updateState();
        this.camera.objects.dynamics.velocity.set(0,0,0);
        this.camera.objects.dynamics.angular.set(0,0,0);
        this.camera.objects.dynamics.updateState();
      }
      this.lookVector.set(0,0,0);
      this.turnVector.set(0,0,0);
      this.hideUseDialog();
      this.controlstate._reset();
      this.enabled = false;
      this.refresh();
    }
    this.refresh = (function() {
      var _dir = new THREE.Euler(); // Closure scratch variable
      var _moveforce = new THREE.Vector3();
      return function() {
        if (this.camera && this.enabled) {
          this.moveVector.x = (this.controlstate.move_right - this.controlstate.move_left);
          this.moveVector.y = (this.controlstate.move_up - this.controlstate.move_down);
          this.moveVector.z = -(this.controlstate.move_forward - this.controlstate.move_backward);

          if (this.engine.systems.controls.pointerLockActive) {
            this.turnVector.y = (this.controlstate.turn_left - this.controlstate.turn_right) * this.properties.turnspeed;
            this.lookVector.x = (this.controlstate.look_up - this.controlstate.look_down) * this.properties.turnspeed;
          }

          if (this.controlstate.jump) this.objects.dynamics.velocity.y = 5;
          if (this.controlstate.crouch) {
            if (this.flying) {
              this.moveVector.y -= 1;
            } else {
              this.camera.properties.position.y = this.properties.height * .4 - this.properties.fatness;
            }
          } else {
            if (!this.flying) {
              this.camera.properties.position.y = this.properties.height * .8 - this.properties.fatness;
            }
          }

          if (this.moveForce) {
            var moveSpeed = Math.min(1.0, this.moveVector.length());
            if (this.controlstate.crouch) moveSpeed *= this.properties.crouchspeed;
            else if (this.controlstate.run) moveSpeed *= this.properties.runspeed;
            else moveSpeed *= this.properties.movespeed;
            
            _moveforce.copy(this.moveVector).normalize().multiplyScalar(moveSpeed);
            if (this.flying) {
              _moveforce.applyQuaternion(this.camera.properties.orientation);
            }
            this.moveForce.update(_moveforce);
            this.objects.dynamics.setAngularVelocity(this.turnVector);

            if (this.hmdstate.hmd && this.hmdstate.hmd.timeStamp !== 0) {
              var scale = 1;///.3048;
              if (this.hmdstate.hmd.position) {
                this.camera.objects.dynamics.position.copy(this.hmdstate.hmd.position).multiplyScalar(scale);
                this.camera.objects.dynamics.position.y += this.properties.height * .8 - this.properties.fatness;
              }
              if (this.hmdstate.hmd.linearVelocity) {
                this.camera.objects.dynamics.velocity.copy(this.hmdstate.hmd.linearVelocity).multiplyScalar(scale);
              }

              var o = this.hmdstate.hmd.orientation;
              if (o) {
                this.camera.objects.dynamics.orientation.set(o.x, o.y, o.z, o.w);
              }
              if (this.hmdstate.hmd.angularVelocity) {
                this.camera.objects.dynamics.angular.copy(this.hmdstate.hmd.angularVelocity);
              }

              this.camera.objects.dynamics.updateState();
            } else if (this.hmdstate.orientation) {
              //this.camera.objects.dynamics.orientation.setFromEuler(new THREE.Euler(this.hmdstate.orientation.beta, this.hmdstate.orientation.gamma, this.hmdstate.orientation.alpha, 'ZYX'));
            }

            if (true) {
/*
              _dir.setFromQuaternion(this.camera.properties.orientation);
              // Constrain camera angle to +/- 90 degrees
              // Only zero-out look velocity if it's the same sign as our rotation
              if (Math.abs(_dir.x) > Math.PI/2 && _dir.x * this.lookVector.x > 0) {
                this.lookVector.x = 0;
              }
*/
              this.camera.objects.dynamics.setAngularVelocity(this.lookVector);
              //this.camera.objects.dynamics.processConstraints([]);
              this.camera.objects.dynamics.updateState();
            }
            this.camera.refresh();
          }

        }

        elation.events.fire({type: 'thing_change', element: this});
      }
    })();
    this.updateControls = function() {
      this.refresh();
    }
    this.handleCreate = function(ev) {
      console.log('player is new', ev);
      if (this.properties.defaultplayer) {
        this.engine.client.setActiveThing(this);
        this.enable();
      }
    }
    this.handleTargeting = function() {
      if (this.enableuse) {
        var targetinfo = this.getUsableTarget();
        if (targetinfo) {
          var target = this.getThingByObject(targetinfo.object);
          if (target !== this.target) {
            this.setUseTarget(target);
          }
        } else if (this.target != false || this.distanceTo(this.target) > this.targetrange) {
          this.setUseTarget(false);
        }
      }
    }
    this.setUseTarget = function(target) {
      if (!target && this.target) {
        // deselect current target
        elation.events.fire({type: 'thing_use_blur', element: this.target, data: this});
        this.target = target;
        this.hideUseDialog();
      } else if (target && !this.target) {
        elation.events.fire({type: 'thing_use_focus', element: target, data: this});
        this.target = target;
        this.showUseDialog('play', target.properties.gamename); // FIXME - hardcoded for arcade games...
      }
    }
    this.handleUse = function(ev) {
      if (this.holding && !(this.target && this.target.canUse(this))) {
        this.toss(ev);
      } else {
        if (ev.value == 1) {
          this.activateUseTarget();
        }
      }
    }
    this.activateUseTarget = function() {
      if (this.target && this.target.canUse(this)) {
        elation.events.fire({type: 'thing_use_activate', element: this.target, data: this});
        //this.disable(); // FIXME - temporary
      }
    }
    this.getUsableTarget = (function() {
      // closure scratch variables
      var _pos = new THREE.Vector3(),
          _dir = new THREE.Vector3(),
          _caster = new THREE.Raycaster(_pos, _dir, .01, this.targetrange);
      return function() {
        if (!this.camera) return; // FIXME - hack to make sure we don't try to execute if our camera isn't initialized
        var things = this.engine.getThingsByTag('usable');
        if (things.length > 0) {
          var objects = things.map(function(t) { return t.objects['3d']; });
          // Get my position and direction in world space
          var pos = this.camera.localToWorld(_pos.set(0,0,0));
          var dir = this.camera.localToWorld(_dir.set(0,0,-1)).sub(pos).normalize(); 

          var intersects = _caster.intersectObjects(objects, true);
          if (intersects.length > 0) {
            for (var i = 0; i < intersects.length; i++) {
              if (intersects[i].object.visible)
                return intersects[i];
            }
          }
        }
        return false;
      }
    }.bind(this))();

    this.showUseDialog = function(verb, noun) {
      if (!this.usedialog) {
        this.usedialog = elation.ui.window({append: document.body, bottom: true, center: true});
      }

      var useable = this.target.canUse(this);

      if (useable) {
        var verb = useable.verb || 'use';
        var noun = useable.noun || '';
        this.usedialog.show();
        var content = 'Press E or click to ' + verb + ' ' + noun;
        this.usedialog.setcontent(content);
      }

/*
      // FIXME - hack for arcade games
      if (this.target && !this.target.properties.working) {
        content = 'Sorry, ' + (this.target.properties.gamename || 'this machine') + ' is temporarily out of order!';
      }
*/

    }
    this.hideUseDialog = function() {
      if (this.usedialog) {
        this.usedialog.hide();
      }
    }
    this.pickup = function(object, force) {
      if (this.holding) {
        //this.holding.reparent(this.engine.systems.world);
        this.charging = 0.0001; // fixme - hardcoded value is silly here, this lets us just drop the item
        this.toss({value: 0});
      }
      this.holding = object;
      object.reparent(this.camera);
      object.properties.position.set(0,-.075,-.15);
      object.properties.velocity.set(0,0,0);
      object.properties.angular.set(0,0,0);
      object.properties.orientation.setFromEuler(new THREE.Euler(Math.PI/2,0,0)); // FIXME - probably not the best way to do this
    }
  }, elation.engine.things.generic);
});
