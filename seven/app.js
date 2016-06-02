var container, scene, camera, renderer;

var video;

var SCREEN_X, SCREEN_Y;

var arController;

var positionMarker;

var frameCount = 0;

// left to right: 1-2-0
var existingMarkers = {
    1: {
        matrix: new THREE.Matrix4(),
        object: new THREE.Object3D(),
        spectator: new THREE.Object3D(),
        initialPosition: new THREE.Vector3(-2, 0, 10)
    },
    2: {
        matrix: new THREE.Matrix4(),
        object: new THREE.Object3D(),
        spectator: new THREE.Object3D(),
        initialPosition: new THREE.Vector3(0, 0, 10)
    },
    0: {
        matrix: new THREE.Matrix4(),
        object: new THREE.Object3D(),
        spectator: new THREE.Object3D(),
        initialPosition: new THREE.Vector3(+2, 0, 10)
    }
};


var axisMap = ['x', 'y', 'z'];

var estimatedPosition = new THREE.Vector3();
var sensorMedium = new THREE.Vector3();

var matrix = new THREE.Matrix4();

var sensorData = [];
var markersVisible = [];


function init() {
    'use strict';

    positionMarker = document.getElementById('position');

    video = document.querySelector('video');

    setupScene();

}

function setupScene() {
    'use strict';

    SCREEN_X = 960 / 2;
    SCREEN_Y = 540 / 2;

    scene = new THREE.Scene();

    for (var id in existingMarkers) {

        var markerObject = existingMarkers[id].object;

        markerObject.wasVisible = false;
        markerObject.markerMatrix = new Float64Array(12);
        markerObject.matrixAutoUpdate = false;

        scene.add(markerObject);
        scene.add(existingMarkers[id].spectator);
    }

    camera = new THREE.PerspectiveCamera(45, SCREEN_X / SCREEN_Y, 0.5, 1000);
    scene.add(camera);

    renderer = new THREE.WebGLRenderer({antialias: true});
    renderer.setSize(SCREEN_X, SCREEN_Y);

    container = document.getElementById('scene');
    container.appendChild(renderer.domElement);

    // room

    var geometry = new THREE.PlaneGeometry(30, 20);
    var material = new THREE.MeshBasicMaterial({color: 0xf0f000, side: THREE.DoubleSide});
    var floor = new THREE.Mesh(geometry, material);

    floor.rotateX(Math.PI / 2);
    floor.position.x = 5;
    floor.position.y = -5;
    floor.position.z = -5;

    scene.add(floor);


    geometry = new THREE.PlaneGeometry(30, 10);
    material = new THREE.MeshBasicMaterial({color: 0x00f000, side: THREE.DoubleSide});
    var back = new THREE.Mesh(geometry, material);

    back.position.x = 5;
    back.position.y = 0;
    back.position.z = -15;

    scene.add(back);

    geometry = new THREE.PlaneGeometry(30, 10);
    material = new THREE.MeshBasicMaterial({color: 0xf00000, side: THREE.DoubleSide});
    var left = new THREE.Mesh(geometry, material);

    left.rotateY(Math.PI / 2);
    left.position.x = -7.5;
    left.position.y = 0;
    left.position.z = 0;

    scene.add(left);

    // spheres

    var boxGeo = new THREE.SphereGeometry(1, 16, 16);
    var boxMat = new THREE.MeshBasicMaterial({
        color: 0x0099ff,
        wireframe: true
    });
    var boxMesh = new THREE.Mesh(boxGeo, boxMat);
    boxMesh.position.y = -2;
    boxMesh.position.z = -10;

    for (var i = 0, m = 7; i < m; i++) {
        var box = boxMesh.clone();
        box.position.x = -10 + i * 4;
        scene.add(box);
    }

    // start ARController
    var cameraParam = new ARCameraParam();
    cameraParam.onload = function () {
        arController = new ARController(320, 240, cameraParam);

        // arSetPatternDetectionMode(arHandle, AR_MATRIX_CODE_DETECTION);
        arController.setPatternDetectionMode(artoolkit.AR_MATRIX_CODE_DETECTION);

        // arSetMatrixCodeType(arHandle, AR_MATRIX_CODE_3x3_HAMMING63);
        arController.setMatrixCodeType(artoolkit.AR_MATRIX_CODE_3x3_HAMMING63);

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

    frameCount++;

    arController.detectMarker(video);
    var markerCount = arController.getMarkerNum();

    markersVisible.length = 0;
    sensorData.length = 0;

    if (markerCount > 0) {

        for (var i = 0; i < markerCount; i++) {
            var markerInfo = arController.getMarker(i);
            var id = markerInfo.id;

            markersVisible.push(id);

            var markerItem = existingMarkers[id];

            if (!markerItem) {
                return;
            }

            var markerRoot = markerItem.object;

            if (markerRoot.visible) {
                arController.getTransMatSquareCont(i, 1, markerRoot.markerMatrix, markerRoot.markerMatrix);
            } else {
                arController.getTransMatSquare(i, 1, markerRoot.markerMatrix);
            }
            markerRoot.visible = true;
            arController.transMatToGLMat(markerRoot.markerMatrix, markerRoot.matrix.elements);


            markerItem.matrix.getInverse(markerRoot.matrix);

            markerItem.spectator.matrix.identity();

            markerItem.spectator.matrix.setPosition(markerItem.initialPosition);

            markerItem.spectator.applyMatrix(markerItem.matrix);

            var pos = markerItem.spectator.position;

            sensorData.push({
                x: pos.x,
                y: pos.y,
                z: pos.z
            });

            document.getElementById('marker_pos_' + id).innerHTML =
                pos.x.toFixed(2) + ' X<br>' +
                pos.y.toFixed(2) + ' Y<br>' +
                pos.z.toFixed(2) + ' Z';

        }

        for (var _id in existingMarkers) {
            if (markersVisible.indexOf(_id) === -1) {
                var markerObject = existingMarkers[_id].object;
                markerObject.visible = false;
            }
        }

        for (var axisIndex = 0; axisIndex < 3; axisIndex++) {

            var axis = axisMap[axisIndex];

            // artifact rejection
            if (frameCount > 120) {
                var artifactThreshold = 1.9; // 1.7;
                for (var sensor = 0, sensorCount = sensorData.length; sensor < sensorCount; sensor++) {

                    var sensorValue = sensorData[sensor][axis];
                    var lastValue = estimatedPosition[axis];

                    if (Math.abs(lastValue - sensorValue) > artifactThreshold) {
                        sensorData[sensor][axis] = lastValue;
                    }
                }
            }

            // obtain medium
            sensorMedium[axis] = 0;
            for (sensor = 0, sensorCount = sensorData.length; sensor < sensorCount; sensor++) {
                sensorMedium[axis] += sensorData[sensor][axis];
            }
            sensorMedium[axis] /= sensorData.length;

            // apply filter
            estimatedPosition[axis] = smoothen(sensorMedium[axis], estimatedPosition[axis]);
        }
    }

    document.getElementById('pos').innerHTML =
        estimatedPosition.x.toFixed(2) + ' X<br>' +
        estimatedPosition.y.toFixed(2) + ' Y<br>' +
        estimatedPosition.z.toFixed(2) + ' Z';


    positionMarker.style.left = 50 + (estimatedPosition.x * 5) + 'px';
    positionMarker.style.top = 50 + (estimatedPosition.z * 5) + 'px';

    camera.position.x = estimatedPosition.x;
    camera.position.y = estimatedPosition.y;
    camera.position.z = estimatedPosition.z;

    renderer.render(scene, camera);
}

function smoothen(newValue, oldValue) {

    var ALPHA = 0.07; //0.05;

    oldValue = oldValue + ALPHA * (newValue - oldValue);

    return oldValue;
}

init();
