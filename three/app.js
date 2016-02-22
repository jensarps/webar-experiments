var scene,
    camera, effect,
    renderer;

var video, videoTexture,
    canvas, context,
    canvasLeft, contextLeft,
    canvasRight, contextRight;

var SCREEN_X, SCREEN_Y;

var detector;
var posit;

var modelSize = 50.0; //millimeters
var cube;

var deviceConfig = {
    planeDistance: 1400
};

var center = -598 / 2 / 2;
var offsetValue = 20;
var eyeSeparation = offsetValue / 10;
var offsetLeft = -offsetValue;
var offsetRight = offsetValue;


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

    //SCREEN_X = 598;
    //SCREEN_Y = 335;

    //SCREEN_X = 640;
    //SCREEN_Y = 360;

    var nodes = document.querySelectorAll('.needsSize');
    for (var i=0, m=nodes.length; i<m; i++) {
        var node = nodes[i];
        node.setAttribute('height', SCREEN_Y);
        var width = node.classList.contains('halfWidth') ? SCREEN_X : SCREEN_X / 2;
        node.setAttribute('width', width);
    }

    scene = new THREE.Scene();

    camera = new THREE.PerspectiveCamera(45, SCREEN_X / SCREEN_Y, 0.5, deviceConfig.planeDistance + 100);
    scene.add(camera);
    camera.lookAt(scene.position);

    renderer = new THREE.WebGLRenderer({antialias: true, alpha: true});
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(SCREEN_X, SCREEN_Y);
    renderer.setClearColor(0xffffff, 0);
    var container = document.getElementById('scene');
    container.appendChild(renderer.domElement);


    effect = new THREE.StereoEffect(renderer);
    effect.eyeSeparation = eyeSeparation;
    effect.setSize(window.innerWidth, window.innerHeight);

    detector = new AR.Detector();

    var light = new THREE.PointLight(0xffffff);
    light.position.set(0, 250, 0);
    scene.add(light);


    cube = new THREE.Object3D();

    var loader = new THREE.ColladaLoader();
    loader.options.convertUpAxis = true;
    loader.load('../models/wooden-box/WoodenBox02.dae', function (collada) {
        cube = collada.scene;
        cube.name = 'Box';
        cube.visible = false;
        scene.add(cube);
    }, function onProgress(xhr) {
        if (xhr.lengthComputable) {
            var percentComplete = xhr.loaded / xhr.total * 100;
            console.log(Math.round(percentComplete) + '% downloaded');
        }
    }, function onError(xhr) {
        console.log('Could not load model.');
    });

    document.documentElement.addEventListener('click', function () {
        toggleFullScreen();
    });
}


function getStream() {
    window.URL = window.URL || window.webkitURL;

    return new Promise(function (resolve, reject) {

        MediaStreamTrack.getSources(function (sources) {

            var videoSources = sources.filter(function (source) {
                return source.kind == 'video' && source.facing == 'environment';
            });

            if (!videoSources.length) {
                console.log('No back facing camera reported by the browser.');
                videoSources = sources.filter(function (source) {
                    return source.kind == 'video';
                });
            }

            var constraints = {
                video: {
                    facingMode: 'environment',
                    sourceId: videoSources[0].id
                }
            };

            navigator.mediaDevices.getUserMedia(constraints)
                .then(resolve, reject);
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

    ['Left', 'Right'].forEach(function (side) {
        console.log('Setup side', side);
        var canvas = window['canvas' + side] = document.getElementById('bg' + side);
        var context = window['context' + side] = canvas.getContext('2d');
        context.fillStyle = '#000000';
        context.fillRect(0, 0, canvas.width, canvas.height);
    });

    canvas = document.getElementById('videoImage');
    context = canvas.getContext('2d');

    // TODO: wrong place...
    posit = new POS.Posit(modelSize, SCREEN_X);
}

function animate(timestamp) {
    requestAnimationFrame(animate);
    render(timestamp);
}

function render(timestamp) {

    if (video.readyState === video.HAVE_ENOUGH_DATA) {

        contextLeft.drawImage(video, center + offsetLeft, 0);
        contextRight.drawImage(video, center + offsetRight, 0);

        context.drawImage(video, 0, 0);
        var imageData = context.getImageData(0, 0, canvas.width, canvas.height);

        var markers = detector.detect(imageData);
        updateScenes(markers);
    }

    effect.render(scene, camera);
}

/* --------------------------------------------------------------- */

function updateScenes(markers) {
    var corners, corner, pose, i;

    if (false && markers.length > 0) {
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
    object.scale.x =
    object.scale.y =
    object.scale.z = modelSize * 2;

    object.rotation.x = -Math.asin(-rotation[1][2]);
    object.rotation.y = -Math.atan2(rotation[0][2], rotation[2][2]);
    object.rotation.z = Math.atan2(rotation[1][0], rotation[1][1]);

    object.position.x = translation[0];
    object.position.y = translation[1];
    object.position.z = -translation[2];
}
function toggleFullScreen() {
    if (!document.fullscreenElement &&    // alternative standard method
        !document.mozFullScreenElement && !document.webkitFullscreenElement && !document.msFullscreenElement ) {  // current working methods
        if (document.documentElement.requestFullscreen) {
            document.documentElement.requestFullscreen();
        } else if (document.documentElement.msRequestFullscreen) {
            document.documentElement.msRequestFullscreen();
        } else if (document.documentElement.mozRequestFullScreen) {
            document.documentElement.mozRequestFullScreen();
        } else if (document.documentElement.webkitRequestFullscreen) {
            document.documentElement.webkitRequestFullscreen(Element.ALLOW_KEYBOARD_INPUT);
        }
    } else {
        if (document.exitFullscreen) {
            document.exitFullscreen();
        } else if (document.msExitFullscreen) {
            document.msExitFullscreen();
        } else if (document.mozCancelFullScreen) {
            document.mozCancelFullScreen();
        } else if (document.webkitExitFullscreen) {
            document.webkitExitFullscreen();
        }
    }
}

window.onload = init;
