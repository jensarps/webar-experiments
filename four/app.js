var container, scene, camera, renderer;

var videoScene, videoCamera, videoTex;

var SCREEN_X, SCREEN_Y;

var manager;
var effect;
var detector;

var cube;

var arController, markerRoot;

var deviceConfig = {
    planeDistance: 1400
};

var video = ARController.getUserMedia({
    maxARVideoSize: 320, // do AR processing on scaled down video of this size
    facing: "environment",
    onSuccess: function(video) {
        console.log('got video', video);
        setupScene();
    }
});

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

    renderer = new THREE.WebGLRenderer({antialias: true});
    renderer.setSize(SCREEN_X, SCREEN_Y);
    //renderer.autoClear = false;

    container = document.getElementById('scene');
    container.appendChild(renderer.domElement);

    //effect = new THREE.VREffect(renderer);
    //effect.setSize(SCREEN_X, SCREEN_Y);


    effect = new THREE.StereoEffect(renderer);
    effect.eyeSeparation = 2;
    effect.setSize(SCREEN_X, SCREEN_Y);

    manager = new WebVRManager(renderer, effect, {hideButton: false});


    var light = new THREE.PointLight(0xffffff);
    light.position.set(0, 250, 0);
    scene.add(light);


    var light = new THREE.PointLight(0xffffff);
    light.position.set(400, 500, 100);
    scene.add(light);

    var light = new THREE.PointLight(0xffffff);
    light.position.set(-400, -500, -100);
    scene.add(light);


    markerRoot = new THREE.Object3D();
    scene.add(markerRoot);

    markerRoot.wasVisible = false;
    markerRoot.markerMatrix = new Float64Array(12);
    markerRoot.matrixAutoUpdate = false;
    camera.matrixAutoUpdate = false;

    videoTex = new THREE.Texture(video);
    videoTex.minFilter = THREE.LinearFilter;
    videoTex.flipY = false;

    var plane = new THREE.Mesh(
        new THREE.PlaneBufferGeometry(2, 2),
        new THREE.MeshBasicMaterial({map: videoTex, side: THREE.DoubleSide})
    );

    plane.material.depthTest = false;
    plane.material.depthWrite = false;

    videoScene = new THREE.Scene();
    videoCamera = new THREE.OrthographicCamera(-1, 1, -1, 1, -1, 1);
    videoScene.add(videoCamera);
    videoScene.add(plane);

    var loader = new THREE.ColladaLoader();
    loader.options.convertUpAxis = true;
    loader.load('../models/WoodenBox02/WoodenBox02.dae', function (collada) {

        cube = collada.scene;

        cube.name = 'Box';

        cube.scale.x = 1;
        cube.scale.y = 1;
        cube.scale.z = 1;

        markerRoot.add(cube);
    });

    var cameraParam = new ARCameraParam();
    cameraParam.onload = function() {

        arController = new ARController(320, 240, cameraParam);
        arController.debugSetup();

        var camera_mat = arController.getCameraMatrix();
        camera.projectionMatrix.elements.set(camera_mat);

        animate();
    };
    cameraParam.load('camera_para.dat');
}


function animate(timestamp) {
    requestAnimationFrame(animate);
    render(timestamp);
}

function render(timestamp) {

    if (!arController) {
        return;
    }

    arController.detectMarker(video);
    var markerNum = arController.getMarkerNum();
    if (markerNum > 0) {
        if (markerRoot.visible) {
            arController.getTransMatSquareCont(0, 1, markerRoot.markerMatrix, markerRoot.markerMatrix);
        } else {
            arController.getTransMatSquare(0 /* Marker index */, 1 /* Marker width */, markerRoot.markerMatrix);
        }
        markerRoot.visible = true;
        arController.transMatToGLMat(markerRoot.markerMatrix, markerRoot.matrix.elements);

    } else {
        markerRoot.visible = false;
    }

    videoTex.needsUpdate = true;


    //renderer.autoClear = false;
    //renderer.clear();
    renderer.render(videoScene, videoCamera);
    renderer.render(scene, camera);

    arController.debugDraw();

    //manager.render(scene, camera, timestamp);
}
