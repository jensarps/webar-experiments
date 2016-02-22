var container, scene, camera, renderer;

var video, canvas, context, videoTexture;

var bgPlane;
var imageData;

var SCREEN_X, SCREEN_Y;

var manager;
var effect;
var detector;
var posit;

var modelSize = 50.0; //millimeters
var cube;

var deviceConfig = {
  planeDistance: 1400
};


function init() {
  setupScene();
  getStream().then(function (cameraData) {
    'use strict';
    addBackgroundPlane(cameraData);
    animate();
  });
}

function setupScene() {
  "use strict";


  SCREEN_X = screen.width;
  SCREEN_Y = screen.height;

  if (SCREEN_Y > SCREEN_X) {
    SCREEN_X = screen.height;
    SCREEN_Y = screen.width;
  }

  console.log(SCREEN_X, SCREEN_Y);


  SCREEN_X = 598;
  SCREEN_Y = 335;

  //SCREEN_X = 640;
  //SCREEN_Y = 360;

  scene = new THREE.Scene();

  camera = new THREE.PerspectiveCamera(45, SCREEN_X / SCREEN_Y, 0.5, deviceConfig.planeDistance + 100);
  scene.add(camera);
  camera.lookAt(scene.position);

  renderer = new THREE.WebGLRenderer({antialias: true});
  renderer.setSize(SCREEN_X, SCREEN_Y);
  container = document.getElementById('scene');
  container.appendChild(renderer.domElement);

  effect = new THREE.VREffect(renderer);
  effect.setSize(SCREEN_X, SCREEN_Y);

  manager = new WebVRManager(renderer, effect, {hideButton: false});
  detector = new AR.Detector();

  var light = new THREE.PointLight(0xffffff);
  light.position.set(0, 250, 0);
  scene.add(light);


  cube = new THREE.Object3D();

  var loader = new THREE.ColladaLoader();
  loader.options.convertUpAxis = true;
  loader.load('../models/WoodenBox02/WoodenBox02.dae', function (collada) {

    cube = collada.scene;

    cube.name = 'Box';

    cube.scale.x = 10;
    cube.scale.y = 10;
    cube.scale.z = 10;

    cube.visible = false;

    scene.add(cube);
  });
}

function getStream() {

  navigator.getUserMedia = navigator.getUserMedia || navigator.webkitGetUserMedia || navigator.mozGetUserMedia;
  window.URL = window.URL || window.webkitURL;

  return new Promise(function (resolve, reject) {

    function onError(msg) {
      var reason = new Error('Sorry, something needed for this to work is missing on your device: ' + msg);
      reject(reason);
    }

    // capabilities
    if (!navigator.getUserMedia) {
      onError('navigator.getUserMedia() is not available.');
    }

    if (!window.URL) {
      onError('window.URL is not available.');
    }

    if (!window.MediaStreamTrack) {
      onError('window.MediaStreamTrack is not available.');
    }

    function onStreamError(e) {
      var msg = 'No camera available.';
      if (e.code == 1) {
        msg = 'User denied access to use camera.';
      }
      onError(msg);
    }

    MediaStreamTrack.getSources(function (sources) {
      var videoSources = sources.filter(function (source) {
        return source.kind == 'video' && source.facing == 'environment';
      });

      if (!videoSources.length) {
        //onError('No back facing camera reported by the browser.');
        videoSources = sources.filter(function (source) {
          return source.kind == 'video';
        });
      }

      navigator.getUserMedia({
        video: {
          mandatory: {
            minWidth: 640,
            minHeight: 480,
            minAspectRatio: 0,
            maxAspectRatio: 100
          },
          optional: [{
            sourceId: videoSources[0].id
          }]
        }
      }, resolve, onStreamError);
    });

  });
}

function addBackgroundPlane(stream) {
  "use strict";

  video = document.getElementById('monitor');
  video.src = URL.createObjectURL(stream);
  video.onerror = function () {
    stream.stop();
  };
  stream.onended = function () {
    console.error('Camera input ended!');
  };


  canvas = document.getElementById('videoImage');
  context = canvas.getContext('2d');
  context.fillStyle = '#000000';
  context.fillRect(0, 0, canvas.width, canvas.height);

  videoTexture = new THREE.Texture(canvas);
  videoTexture.minFilter = THREE.LinearFilter;
  videoTexture.magFilter = THREE.LinearFilter;

  var textureMaterial = new THREE.MeshBasicMaterial({
    map: videoTexture,
    overdraw: true
  });

  var plane = new THREE.PlaneGeometry(2048, 2048, 1, 1);
  bgPlane = new THREE.Mesh(plane, textureMaterial);
  bgPlane.position.set(0, 0, -deviceConfig.planeDistance);

  scene.add(bgPlane);

  // TODO: wrong place...
  posit = new POS.Posit(modelSize, canvas.width);
}

function animate(timestamp) {
  requestAnimationFrame(animate);
  render(timestamp);
}

function render(timestamp) {

  if (video.readyState === video.HAVE_ENOUGH_DATA) {
    context.drawImage(video, 0, 0, canvas.width, canvas.height);
    imageData = context.getImageData(0, 0, canvas.width, canvas.height);

    videoTexture.needsUpdate = true;

    var markers = detector.detect(imageData);
    updateScenes(markers);
    //drawCorners(markers);
    //drawId(markers);
  }

  bgPlane.position.set(0, 0, -deviceConfig.planeDistance);
  manager.render(scene, camera, timestamp);
}


/* --------------------------------------------------------------- */

function drawCorners(markers) {
  var corners, corner, i, j;

  context.lineWidth = 3;

  for (i = 0; i !== markers.length; ++i) {
    corners = markers[i].corners;

    context.strokeStyle = "red";
    context.beginPath();

    for (j = 0; j !== corners.length; ++j) {
      corner = corners[j];
      context.moveTo(corner.x, corner.y);
      corner = corners[(j + 1) % corners.length];
      context.lineTo(corner.x, corner.y);
    }

    context.stroke();
    context.closePath();

    context.strokeStyle = "green";
    context.strokeRect(corners[0].x - 2, corners[0].y - 2, 4, 4);
  }
}

function drawId(markers) {
  var corners, corner, x, y, i, j;

  context.strokeStyle = "blue";
  context.lineWidth = 1;

  for (i = 0; i !== markers.length; ++i) {
    corners = markers[i].corners;

    x = Infinity;
    y = Infinity;

    for (j = 0; j !== corners.length; ++j) {
      corner = corners[j];

      x = Math.min(x, corner.x);
      y = Math.min(y, corner.y);
    }

    context.strokeText(markers[i].id, x, y)
  }
}


/* --------------------------------------------------------------- */

function updateScenes(markers) {
  var corners, corner, pose, i;

  if (markers.length > 0) {
    corners = markers[0].corners;

    for (i = 0; i < corners.length; ++i) {
      corner = corners[i];

      corner.x = corner.x - (canvas.width / 2);
      corner.y = (canvas.height / 2) - corner.y;
    }

    pose = posit.pose(corners);

    updateObject(cube, pose.bestRotation, pose.bestTranslation);
    cube.visible = true;
  } else {
    cube.visible = false;
  }
}

function updateObject(object, rotation, translation) {
  object.scale.x = modelSize;
  object.scale.y = modelSize;
  object.scale.z = modelSize;

  object.rotation.x = -Math.asin(-rotation[1][2]);
  object.rotation.y = -Math.atan2(rotation[0][2], rotation[2][2]);
  object.rotation.z = Math.atan2(rotation[1][0], rotation[1][1]);

  object.position.x = translation[0];
  object.position.y = translation[1];
  object.position.z = -translation[2];
}


window.onload = init;
