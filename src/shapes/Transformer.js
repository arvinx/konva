(function(Konva) {
  'use strict';

  var ATTR_CHANGE_LIST = [
    'resizeEnabledChange',
    'rotateHandlerOffsetChange'
  ].join(' ');

  var TRANSFORM_CHANGE_STR = [
    'xChange.resizer',
    'yChange.resizer',
    'widthChange.resizer',
    'heightChange.resizer',
    'scaleXChange.resizer',
    'scaleYChange.resizer',
    'skewXChange.resizer',
    'skewYChange.resizer',
    'rotationChange.resizer',
    'offsetXChange.resizer',
    'offsetYChange.resizer',
    'transformsEnabledChange.resizer'
  ].join(' ');

  Konva.Transformer = function(config) {
    this.____init(config);
  };

  var RESIZERS_NAMES = [
    'top-left',
    'top-center',
    'top-right',
    'middle-right',
    'middle-left',
    'bottom-left',
    'bottom-center',
    'bottom-right'
  ];

  var warningShowed = false;

  Konva.Transformer.prototype = {
    _centroid: false,
    ____init: function(config) {
      // call super constructor
      Konva.Group.call(this, config);
      this.className = 'Transformer';
      this._createElements();

      // bindings
      this.handleMouseMove = this.handleMouseMove.bind(this);
      this.handleMouseUp = this.handleMouseUp.bind(this);
      this._update = this._update.bind(this);

      // update transformer data for certain attr changes
      this.on(ATTR_CHANGE_LIST, this._update);

      if (!warningShowed) {
        Konva.Util.warn(
          'Konva.Transformer is currently experimental and may have bugs. Please report any issues to GitHub repo.'
        );
        warningShowed = true;
      }
    },

    attachTo: function(node) {
      if (this.node()) {
        this.detach();
      }
      this.setNode(node);
      node.on('dragmove.resizer', this._update);
      node.on(TRANSFORM_CHANGE_STR, this._update);

      this._update();
    },

    detach: function() {
      this.getNode().off('.resizer');
    },

    _getNodeRect: function() {
      var node = this.getNode();
      var rect = node.getClientRect({ skipTransform: true });
      var rotation = Konva.getAngle(node.rotation());

      var dx = rect.x * node.scaleX() - node.offsetX();
      var dy = rect.y * node.scaleY() - node.offsetY();

      return {
        x: node.x() + dx * Math.cos(rotation) + dy * Math.sin(-rotation),
        y: node.y() + dy * Math.cos(rotation) + dx * Math.sin(rotation),
        width: rect.width * node.scaleX(),
        height: rect.height * node.scaleY(),
        rotation: node.rotation()
      };
    },

    getX: function() {
      return this._getNodeRect().x;
    },

    getY: function() {
      return this._getNodeRect().y;
    },

    getRotation: function() {
      return this._getNodeRect().rotation;
    },

    getWidth: function() {
      return this._getNodeRect().width;
    },

    getHeight: function() {
      return this._getNodeRect().height;
    },

    _createElements: function() {
      this._createBack();

      RESIZERS_NAMES.forEach(
        function(name) {
          this._createAnchor(name);
        }.bind(this)
      );

      this._createAnchor('rotater');
    },

    _createAnchor: function(name) {
      var anchor = new Konva.Rect({
        stroke: 'rgb(0, 161, 255)',
        fill: 'white',
        strokeWidth: 1,
        name: name,
        width: 10,
        height: 10,
        offsetX: 5,
        offsetY: 5,
        draggable: true,
        dragDistance: 0
      });
      var self = this;
      anchor.on('mousedown touchstart', function(e) {
        self.handleResizerMouseDown(e);
      });

      // add hover styling
      anchor.on('mouseenter', function() {
        var layer = this.getLayer();
        anchor.getStage().getContainer().style.cursor = 'pointer';
        this.strokeWidth(this.strokeWidth() * 4);
        layer.draw();
      });
      anchor.on('mouseout', function() {
        var layer = this.getLayer();
        if (!layer) {
          return;
        }
        anchor.getStage().getContainer().style.cursor = '';
        this.strokeWidth(this.strokeWidth() / 4);
        layer.draw();
      });
      this.add(anchor);
    },

    _createBack: function() {
      var back = new Konva.Shape({
        stroke: 'rgb(0, 161, 255)',
        name: 'back',
        width: 0,
        height: 0,
        listening: false,
        sceneFunc: function(ctx) {
          ctx.beginPath();
          ctx.rect(0, 0, this.width(), this.height());
          ctx.moveTo(this.width() / 2, 0);
          if (this.getParent().rotateEnabled()) {
            ctx.lineTo(
              this.width() / 2,
              -this.getParent().rotateHandlerOffset()
            );
          }

          ctx.fillStrokeShape(this);
        }
      });
      this.add(back);
    },

    handleResizerMouseDown: function(e) {
      this.movingResizer = e.target.name();

      // var node = this.getNode();
      var attrs = this._getNodeRect();
      var width = attrs.width;
      var height = attrs.height;
      var hypotenuse = Math.sqrt(Math.pow(width, 2) + Math.pow(height, 2));
      this.sin = height / hypotenuse;
      this.cos = width / hypotenuse;

      window.addEventListener('mousemove', this.handleMouseMove);
      window.addEventListener('touchmove', this.handleMouseMove);
      window.addEventListener('mouseup', this.handleMouseUp);
      window.addEventListener('touchend', this.handleMouseUp);

      this._transforming = true;
    },

    handleMouseMove: function(e) {
      var x, y, newHypotenuse;
      var resizerNode = this.findOne('.' + this.movingResizer);
      var stage = resizerNode.getStage();

      var box = stage.getContent().getBoundingClientRect();
      var zeroPoint = {
        x: box.left,
        y: box.top
      };
      var pointerPos = {
        left: e.clientX !== undefined ? e.clientX : e.touches[0].clientX,
        top: e.clientX !== undefined ? e.clientY : e.touches[0].clientY
      };
      var newAbsPos = {
        x: pointerPos.left - zeroPoint.x,
        y: pointerPos.top - zeroPoint.y
      };

      resizerNode.setAbsolutePosition(newAbsPos);

      if (this.movingResizer === 'top-left') {
        newHypotenuse = Math.sqrt(
          Math.pow(this.findOne('.bottom-right').x() - resizerNode.x(), 2) +
            Math.pow(this.findOne('.bottom-right').y() - resizerNode.y(), 2)
        );

        x = newHypotenuse * this.cos;
        y = newHypotenuse * this.sin;

        this.findOne('.top-left').x(this.findOne('.bottom-right').x() - x);
        this.findOne('.top-left').y(this.findOne('.bottom-right').y() - y);
      } else if (this.movingResizer === 'top-center') {
        this.findOne('.top-left').y(resizerNode.y());
      } else if (this.movingResizer === 'top-right') {
        newHypotenuse = Math.sqrt(
          Math.pow(this.findOne('.bottom-left').x() - resizerNode.x(), 2) +
            Math.pow(this.findOne('.bottom-left').y() - resizerNode.y(), 2)
        );

        x = newHypotenuse * this.cos;
        y = newHypotenuse * this.sin;

        this.findOne('.top-right').x(x);
        this.findOne('.top-right').y(this.findOne('.bottom-left').y() - y);
        var pos = resizerNode.position();

        this.findOne('.top-left').y(pos.y);
        this.findOne('.bottom-right').x(pos.x);
      } else if (this.movingResizer === 'middle-left') {
        this.findOne('.top-left').x(resizerNode.x());
      } else if (this.movingResizer === 'middle-right') {
        this.findOne('.bottom-right').x(resizerNode.x());
      } else if (this.movingResizer === 'bottom-left') {
        newHypotenuse = Math.sqrt(
          Math.pow(this.findOne('.top-right').x() - resizerNode.x(), 2) +
            Math.pow(this.findOne('.top-right').y() - resizerNode.y(), 2)
        );

        x = newHypotenuse * this.cos;
        y = newHypotenuse * this.sin;

        this.findOne('.bottom-left').x(this.findOne('.top-right').x() - x);
        this.findOne('.bottom-left').y(y);

        pos = resizerNode.position();

        this.findOne('.top-left').x(pos.x);
        this.findOne('.bottom-right').y(pos.y);
      } else if (this.movingResizer === 'bottom-center') {
        this.findOne('.bottom-right').y(resizerNode.y());
      } else if (this.movingResizer === 'bottom-right') {
        newHypotenuse = Math.sqrt(
          Math.pow(this.findOne('.bottom-right').x(), 2) +
            Math.pow(this.findOne('.bottom-right').y(), 2)
        );

        x = newHypotenuse * this.cos;
        y = newHypotenuse * this.sin;

        this.findOne('.bottom-right').x(x);
        this.findOne('.bottom-right').y(y);
      } else if (this.movingResizer === 'rotater') {
        var attrs = this._getNodeRect();
        x = resizerNode.x() - attrs.width / 2;
        y = -resizerNode.y() + attrs.height / 2;

        var dAlpha = Math.atan2(-y, x) + Math.PI / 2;
        // var attrs = this._getAttrs();

        var rot = Konva.getAngle(this.rotation());

        var newRotation =
          Konva.Util._radToDeg(rot) + Konva.Util._radToDeg(dAlpha);

        var alpha = Konva.getAngle(this.getNode().rotation());
        var newAlpha = Konva.Util._degToRad(newRotation);

        var snaps = this.rotationSnaps();
        var offset = 0.1;
        for (var i = 0; i < snaps.length; i++) {
          var angle = Konva.getAngle(snaps[i]);

          var dif =
            Math.abs(angle - Konva.Util._degToRad(newRotation)) % (Math.PI * 2);

          if (dif < offset) {
            newRotation = Konva.Util._radToDeg(angle);
            newAlpha = Konva.Util._degToRad(newRotation);
          }
        }

        this._fitNodeInto(
          Object.assign(attrs, {
            rotation: Konva.angleDeg
              ? newRotation
              : Konva.Util._degToRad(newRotation),
            x:
              attrs.x +
              attrs.width / 2 * (Math.cos(alpha) - Math.cos(newAlpha)) +
              attrs.height / 2 * (Math.sin(-alpha) - Math.sin(-newAlpha)),
            y:
              attrs.y +
              attrs.height / 2 * (Math.cos(alpha) - Math.cos(newAlpha)) +
              attrs.width / 2 * (Math.sin(alpha) - Math.sin(newAlpha)),
            width: attrs.width,
            height: attrs.height
          })
        );
      } else {
        console.error(
          new Error(
            'Wrong position argument of selection resizer: ',
            this.movingResizer
          )
        );
      }

      if (this.movingResizer === 'rotater') {
        return;
      }

      var absPos = this.findOne('.top-left').getAbsolutePosition();

      x = absPos.x;
      y = absPos.y;
      var width =
        this.findOne('.bottom-right').x() - this.findOne('.top-left').x();

      var height =
        this.findOne('.bottom-right').y() - this.findOne('.top-left').y();

      this._fitNodeInto({
        x: x + this.offsetX(),
        y: y + this.offsetY(),
        width: width,
        height: height
      });
    },

    handleMouseUp: function() {
      this._removeEvents();
    },

    _removeEvents: function() {
      if (this._transforming) {
        this._transforming = false;
        window.removeEventListener('mousemove', this.handleMouseMove);
        window.removeEventListener('touchmove', this.handleMouseMove);
        window.removeEventListener('mouseup', this.handleMouseUp);
        window.removeEventListener('touchend', this.handleMouseUp);
        this.fire('transformend');
        this.getNode().fire('transformend');
      }
    },

    _fitNodeInto: function(attrs) {
      this._settings = true;
      var node = this.getNode();
      if (attrs.rotation !== undefined) {
        this.getNode().rotation(attrs.rotation);
      }
      var pure = node.getClientRect({ skipTransform: true });
      var scaleX = attrs.width / pure.width;
      var scaleY = attrs.height / pure.height;

      var rotation = Konva.getAngle(node.getRotation());
      // debugger;
      var dx = pure.x * scaleX;
      var dy = pure.y * scaleY;

      // var dxo = node.offsetX() * scaleX;
      // var dyo = node.offsetY() * scaleY;

      this.getNode().setAttrs({
        scaleX: scaleX,
        scaleY: scaleY,
        x: attrs.x - (dx * Math.cos(rotation) + dy * Math.sin(-rotation)),
        y: attrs.y - (dy * Math.cos(rotation) + dx * Math.sin(rotation))
      });
      this._settings = false;

      this.fire('transform');
      this.getNode().fire('transform');
      this._update();
      this.getLayer().batchDraw();
    },
    _update: function() {
      var attrs = this._getNodeRect();
      var x = attrs.x;
      var y = attrs.y;
      var width = attrs.width;
      var height = attrs.height;
      this.x(x);
      this.y(y);
      this.rotation(attrs.rotation);

      var enabledResizers = this.enabledResizers();
      var resizeEnabled = this.resizeEnabled();

      this.findOne('.top-left').setAttrs({
        x: 0,
        y: 0,
        visible: resizeEnabled && enabledResizers.indexOf('top-left') >= 0
      });
      this.findOne('.top-center').setAttrs({
        x: width / 2,
        y: 0,
        visible: resizeEnabled && enabledResizers.indexOf('top-center') >= 0
      });
      this.findOne('.top-right').setAttrs({
        x: width,
        y: 0,
        visible: resizeEnabled && enabledResizers.indexOf('top-right') >= 0
      });
      this.findOne('.middle-left').setAttrs({
        x: 0,
        y: height / 2,
        visible: resizeEnabled && enabledResizers.indexOf('middle-left') >= 0
      });
      this.findOne('.middle-right').setAttrs({
        x: width,
        y: height / 2,
        visible: resizeEnabled && enabledResizers.indexOf('middle-right') >= 0
      });
      this.findOne('.bottom-left').setAttrs({
        x: 0,
        y: height,
        visible: resizeEnabled && enabledResizers.indexOf('bottom-left') >= 0
      });
      this.findOne('.bottom-center').setAttrs({
        x: width / 2,
        y: height,
        visible: resizeEnabled && enabledResizers.indexOf('bottom-center') >= 0
      });
      this.findOne('.bottom-right').setAttrs({
        x: width,
        y: height,
        visible: resizeEnabled && enabledResizers.indexOf('bottom-right') >= 0
      });

      this.findOne('.rotater').setAttrs({
        x: width / 2,
        y: -this.rotateHandlerOffset(),
        visible: false
      });

      this.findOne('.back').setAttrs({
        width: width,
        height: height,
        visible: this.lineEnabled()
      });
    },
    destroy: function() {
      Konva.Group.prototype.destroy.call(this);
      this.getNode().off('.resizer');
      this._removeEvents();
    }
  };
  Konva.Util.extend(Konva.Transformer, Konva.Group);

  function validateResizers(val) {
    if (!(val instanceof Array)) {
      Konva.Util.warn('enabledResizers value should be an array');
    }
    if (val instanceof Array) {
      val.forEach(function(name) {
        if (RESIZERS_NAMES.indexOf(name) === -1) {
          Konva.Util.warn(
            'Unknown resizer name: ' +
              name +
              '. Available names are: ' +
              RESIZERS_NAMES.join(', ')
          );
        }
      });
    }
    return val || [];
  }
  Konva.Factory.addGetterSetter(
    Konva.Transformer,
    'enabledResizers',
    RESIZERS_NAMES
  );
  Konva.Factory.addGetterSetter(
    Konva.Transformer,
    'enabledResizers',
    RESIZERS_NAMES,
    validateResizers
  );
  Konva.Factory.addGetterSetter(Konva.Transformer, 'resizeEnabled', true);
  Konva.Factory.addGetterSetter(Konva.Transformer, 'rotateEnabled', true);
  Konva.Factory.addGetterSetter(Konva.Transformer, 'rotationSnaps', []);
  Konva.Factory.addGetterSetter(Konva.Transformer, 'rotateHandlerOffset', 50);
  Konva.Factory.addGetterSetter(Konva.Transformer, 'lineEnabled', true);
  Konva.Factory.addGetterSetter(Konva.Transformer, 'node');

  Konva.Collection.mapMethods(Konva.Transformer);
})(Konva);
