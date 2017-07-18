var gl;

function initGL(canvas) {
    try {
        gl = canvas.getContext("webgl2");
        //gl.canvas.width = document.getElementById("canvas-001").offsetWidth;
        //gl.canvas.height = document.getElementById("canvas-001").offsetHeight;
        gl.canvas.width = window.innerWidth * 0.75;
        gl.canvas.height = window.innerHeight * 1.1;
        gl.viewportWidth = canvas.width;
        gl.viewportHeight = canvas.height;
    } catch (e) {
    }
    if (!gl) {
        alert("Could not initialise WebGL2, sorry :-(");
    }
}

function getShader(gl, fileName, cache) {
    var str = $.ajax({
        url: fileName,
        async: false,
        dataType: "text",
        mimeType: "text/plain",
        cache: cache,
    }).responseText;

    if (!str) {
        alert('Could not read shader file!!');
        return null;
    }

    var shader;
    if (fileName.endsWith("fs")) {
        shader = gl.createShader(gl.FRAGMENT_SHADER);
    } else if (fileName.endsWith("vs")) {
        shader = gl.createShader(gl.VERTEX_SHADER);
    } else {
        alert('Unidentified shader type!!');
        return null;
    }
    gl.shaderSource(shader, str);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        alert(gl.getShaderInfoLog(shader));
        return null;
    }
    return shader;
}

var tesseractShader; // Coloring the tesseract cubes.
var modelShader; // Coloring the Floor

function initShaders() {
    var fragmentShaderCube = getShader(gl, "shaders/cube.fs", false);
    var vertexShader = getShader(gl, "shaders/instance.vs", false);
    var fragmentShaderFloor = getShader(gl, "shaders/model.fs", false);

    tesseractShader = gl.createProgram();
    gl.attachShader(tesseractShader, vertexShader);
    gl.attachShader(tesseractShader, fragmentShaderCube);
    gl.linkProgram(tesseractShader);
    if (!gl.getProgramParameter(tesseractShader, gl.LINK_STATUS)) {
        alert("Could not initialise shaders");
    }

    tesseractShader.vertexPositionAttribute = gl.getAttribLocation(tesseractShader, "in_vertexPosition");
    tesseractShader.vertexTexCoordAttribute = gl.getAttribLocation(tesseractShader, "in_vertexTextureCoord");
    tesseractShader.instanceModelMatAttribute = gl.getAttribLocation(tesseractShader, "in_MMatrix"); // Model transformation for each instance of cube.
    tesseractShader.pMatrixUniform = gl.getUniformLocation(tesseractShader, "uPMatrix"); // Persepective transformation
    tesseractShader.vMatrixUniform = gl.getUniformLocation(tesseractShader, "uVMatrix"); // Viewing transformation
    tesseractShader.samplerUniform = gl.getUniformLocation(tesseractShader, "uSampler"); // Sampler or the image
    tesseractShader.colorUniform = gl.getUniformLocation(tesseractShader, "in_color");
    
    modelShader = gl.createProgram();
    var vertexShader = getShader(gl, "shaders/instance.vs", false);
    gl.attachShader(modelShader, vertexShader);
    gl.attachShader(modelShader, fragmentShaderFloor);
    gl.linkProgram(modelShader);
    if (!gl.getProgramParameter(modelShader, gl.LINK_STATUS)) {
        alert("Could not initialise shaders");
    }
    modelShader.vertexPositionAttribute = gl.getAttribLocation(modelShader, "in_vertexPosition");
    modelShader.vertexTexCoordAttribute = gl.getAttribLocation(modelShader, "in_vertexTextureCoord");
    modelShader.vertexNormalAttribute = gl.getAttribLocation(modelShader, "in_vertexNormal");
    modelShader.instanceModelMatAttribute = gl.getAttribLocation(modelShader, "in_MMatrix"); // Model transformation for each instance of cube.
    modelShader.pMatrixUniform = gl.getUniformLocation(modelShader, "uPMatrix"); // Persepective transformation
    modelShader.vMatrixUniform = gl.getUniformLocation(modelShader, "uVMatrix"); // Viewing transformation
    modelShader.samplerUniform = gl.getUniformLocation(modelShader, "uSampler"); // Sampler or the image of texture
    modelShader.lightPositionSamplerUniform = gl.getUniformLocation(modelShader, "uLightSampler"); // Contains light positions as texture.
    modelShader.bufferUniform = gl.getUniformLocation(modelShader, "in_buffer"); // A buffer containing miscellaneous values.
}

var mMatrix = mat4.create();
var pMatrix = mat4.create();
var vMatrix = mat4.create();

var cubeVAO;
var maxInstances = 20000;

var floorVAO;

// Create a texture to store light positions.
var lightPositionTexture;
var lightPositionTextureSize = 80; // size^2 Should be more than number of lights. 

function initBuffers() {
    // Create Vertex Array Object - records the configuration of VS input.
    cubeVAO = gl.createVertexArray();
    // Start recording the current configuration.
    gl.bindVertexArray(cubeVAO);

    // Create generic buffer handle
    cubeVAO.positionBuffer = gl.createBuffer();
    // Bind buffer handle with target ARRAY_BUFFER
    gl.bindBuffer(gl.ARRAY_BUFFER, cubeVAO.positionBuffer);
    // Position (3 elements) + Tex Coord (2 elements).
    cubeVAO.vertices = // Front face
        [-1.0, -1.0, 1.0, 0.0, 0.0,
            1.0, -1.0, 1.0, 1.0, 0.0,
            1.0, 1.0, 1.0, 1.0, 1.0,
        -1.0, 1.0, 1.0, 0.0, 1.0,

        // Back face
        -1.0, -1.0, -1.0, 1.0, 0.0,
        -1.0, 1.0, -1.0, 1.0, 1.0,
            1.0, 1.0, -1.0, 0.0, 1.0,
            1.0, -1.0, -1.0, 0.0, 0.0,

        // Top face
        -1.0, 1.0, -1.0, 0.0, 1.0,
        -1.0, 1.0, 1.0, 0.0, 0.0,
            1.0, 1.0, 1.0, 1.0, 0.0,
            1.0, 1.0, -1.0, 1.0, 1.0,

        // Bottom face
        -1.0, -1.0, -1.0, 1.0, 1.0,
            1.0, -1.0, -1.0, 0.0, 1.0,
            1.0, -1.0, 1.0, 0.0, 0.0,
        -1.0, -1.0, 1.0, 1.0, 0.0,

            // Right face
            1.0, -1.0, -1.0, 1.0, 0.0,
            1.0, 1.0, -1.0, 1.0, 1.0,
            1.0, 1.0, 1.0, 0.0, 1.0,
            1.0, -1.0, 1.0, 0.0, 0.0,

        // Left face
        -1.0, -1.0, -1.0, 0.0, 0.0,
        -1.0, -1.0, 1.0, 1.0, 0.0,
        -1.0, 1.0, 1.0, 1.0, 1.0,
        -1.0, 1.0, -1.0, 0.0, 1.0];
    // Transfer data to the buffer currently attached with the target gl.ARRAY_BUFFER
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(cubeVAO.vertices), gl.STATIC_DRAW);
    // Record Format of the buffer
    gl.vertexAttribPointer(tesseractShader.vertexPositionAttribute, 3, gl.FLOAT, false, 5 * 4, 0); // 20byte stride, each vertex has 6 element of size 4 bytes.
    gl.vertexAttribPointer(tesseractShader.vertexTexCoordAttribute, 2, gl.FLOAT, false, 5 * 4, 3 * 4); // 24byte stride, 12 byte offset.

    cubeVAO.indexBuffer = gl.createBuffer();
    // Bind buffer handle with target ELEMENT_ARRAY_BUFFER
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, cubeVAO.indexBuffer);
    // Traingel fins
    cubeVAO.indices = [
        0, 1, 2, 0, 2, 3,    // Front face
        4, 5, 6, 4, 6, 7,    // Back face
        8, 9, 10, 8, 10, 11,  // Top face
        12, 13, 14, 12, 14, 15, // Bottom face
        16, 17, 18, 16, 18, 19, // Right face
        20, 21, 22, 20, 22, 23  // Left face
    ];
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint8Array(cubeVAO.indices), gl.STATIC_DRAW);

    cubeVAO.instanceBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, cubeVAO.instanceBuffer);
    // Dynamic since Model transformations are updated multiple times.
    gl.bufferData(gl.ARRAY_BUFFER, maxInstances * 16 * 4, gl.DYNAMIC_DRAW);
    // Send mat4 as 4 vec4.
    gl.vertexAttribPointer(tesseractShader.instanceModelMatAttribute, 4, gl.FLOAT, false, 64, 0);
    gl.vertexAttribPointer(tesseractShader.instanceModelMatAttribute + 1, 4, gl.FLOAT, false, 64, 16);
    gl.vertexAttribPointer(tesseractShader.instanceModelMatAttribute + 2, 4, gl.FLOAT, false, 64, 32);
    gl.vertexAttribPointer(tesseractShader.instanceModelMatAttribute + 3, 4, gl.FLOAT, false, 64, 48);
    // tell OpenGL this is an instanced vertex attribute.  Instance attributes are update per instance insted of per vertex.
    gl.vertexAttribDivisor(tesseractShader.instanceModelMatAttribute, 1);
    gl.vertexAttribDivisor(tesseractShader.instanceModelMatAttribute + 1, 1);
    gl.vertexAttribDivisor(tesseractShader.instanceModelMatAttribute + 2, 1);
    gl.vertexAttribDivisor(tesseractShader.instanceModelMatAttribute + 3, 1);

    // Store the number of verices
    cubeVAO.numItems = 36;

    // Record the attribute location.
    gl.enableVertexAttribArray(tesseractShader.vertexPositionAttribute);
    gl.enableVertexAttribArray(tesseractShader.vertexTexCoordAttribute);
    gl.enableVertexAttribArray(tesseractShader.instanceModelMatAttribute);
    gl.enableVertexAttribArray(tesseractShader.instanceModelMatAttribute + 1);
    gl.enableVertexAttribArray(tesseractShader.instanceModelMatAttribute + 2);
    gl.enableVertexAttribArray(tesseractShader.instanceModelMatAttribute + 3);

    // Stop Recording
    gl.bindVertexArray(null);

    // Floor object
    floorVAO = gl.createVertexArray();
    gl.bindVertexArray(floorVAO);

    floorVAO.positionBuffer = gl.createBuffer();
    // Bind buffer handle with target ARRAY_BUFFER
    gl.bindBuffer(gl.ARRAY_BUFFER, floorVAO.positionBuffer);
    // Position (3), Vertex Normal (3), texture coord(2)
    floorVAO.vertices = [
        -1, 1, 0, 0, 0, 1, 0, 1,
        -1, -1, 0, 0, 0, 1, 0, 0,
        1, 1, 0, 0, 0, 1, 1, 1,
        1, -1, 0, 0, 0, 1, 1, 0];
    // Transfer data to the buffer currently attached with the target gl.ARRAY_BUFFER
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(floorVAO.vertices), gl.STATIC_DRAW);
    // Record Format of the buffer
    gl.vertexAttribPointer(modelShader.vertexPositionAttribute, 3, gl.FLOAT, false, 8 * 4, 0);
    gl.vertexAttribPointer(modelShader.vertexNormalAttribute, 3, gl.FLOAT, false, 8 * 4, 3 * 4);
    gl.vertexAttribPointer(modelShader.vertexTexCoordAttribute, 2, gl.FLOAT, false, 8 * 4, 6 * 4);

    floorVAO.instanceBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, floorVAO.instanceBuffer);
    // Dynamic since Model transformations are updated multiple times.
    gl.bufferData(gl.ARRAY_BUFFER, maxInstances * 16 * 4, gl.DYNAMIC_DRAW);
    // Send mat4 as 4 vec4.
    gl.vertexAttribPointer(modelShader.instanceModelMatAttribute, 4, gl.FLOAT, false, 64, 0);
    gl.vertexAttribPointer(modelShader.instanceModelMatAttribute + 1, 4, gl.FLOAT, false, 64, 16);
    gl.vertexAttribPointer(modelShader.instanceModelMatAttribute + 2, 4, gl.FLOAT, false, 64, 32);
    gl.vertexAttribPointer(modelShader.instanceModelMatAttribute + 3, 4, gl.FLOAT, false, 64, 48);
    // tell OpenGL this is an instanced vertex attribute.  Instance attributes are update per instance insted of per vertex.
    gl.vertexAttribDivisor(modelShader.instanceModelMatAttribute, 1);
    gl.vertexAttribDivisor(modelShader.instanceModelMatAttribute + 1, 1);
    gl.vertexAttribDivisor(modelShader.instanceModelMatAttribute + 2, 1);
    gl.vertexAttribDivisor(modelShader.instanceModelMatAttribute + 3, 1);

    // Store the number of verices
    floorVAO.numItems = 4;

    // Record the attribute location.
    gl.enableVertexAttribArray(modelShader.vertexPositionAttribute);
    gl.enableVertexAttribArray(modelShader.vertexNormalAttribute);
    gl.enableVertexAttribArray(modelShader.vertexTexCoordAttribute);
    gl.enableVertexAttribArray(modelShader.instanceModelMatAttribute);
    gl.enableVertexAttribArray(modelShader.instanceModelMatAttribute + 1);
    gl.enableVertexAttribArray(modelShader.instanceModelMatAttribute + 2);
    gl.enableVertexAttribArray(modelShader.instanceModelMatAttribute + 3);

    // Stop Recording
    gl.bindVertexArray(null);

    // Setup texture for storing light positions.
    lightPositionTexture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, lightPositionTexture);
    gl.texStorage2D(gl.TEXTURE_2D, 1, gl.RGB32F, lightPositionTextureSize, lightPositionTextureSize);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.bindTexture(gl.TEXTURE_2D, null);
}

function handleLoadedTexture(texture) {
    // Bind the texture handle with its target. 
    gl.bindTexture(gl.TEXTURE_2D, texture);
    // Change how the texture is read. We flip the vertical axis. 
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
    // Allocate and Fill the texture buffer with image. 0 means use the orignal image. 1 would mean use 1 mipmap level lower of the gven image. 
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, texture.image);
    // Setup how the image is scaled up. Linear means the color of a pixel between two pixels in the original image is given by the linear combination of two pixels in original image.
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    // Setup how image is scaled down. Find the closest mip level and do a linear filter on that to get the pixel.
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_NEAREST);
    // Generate mipmap levels- orignal, 1/2, 1/4, 1/8 all the way upto 1 pixel image. Original would depend on mipmap level specified on texImage2D.
    gl.generateMipmap(gl.TEXTURE_2D);
    // Stop anymore changes to the handle.
    gl.bindTexture(gl.TEXTURE_2D, null);
}

// Create texture handle
var blueTexture;
var whiteTexture;
var starTexture;
var floorTexture;

function initTexture(texture, fileName) {
    // Add a new field image for storing rgb image.
    texture.image = new Image();
    texture.image.onload = function () {
        handleLoadedTexture(texture)
    }
    // Load the image and call the above callback.
    texture.image.src = fileName;
}

var randomX = new Float32Array(100);
var randomY = new Float32Array(100);
var randomZ = new Float32Array(100);
for (var i = 0; i < 100; i++) {
    randomX[i] = Math.random() - 0.5;
    randomY[i] = Math.random() - 0.5;
    randomZ[i] = Math.random() - 0.5;
}

var elevation = 0.7;
var azimuth = 1.514;
var cameraDistance = 10;
var cameraPan = false;

function camera(focus) {
    mat4.identity(vMatrix);

    // Camera type 1
    /*theta = -mousePos.y / gl.viewportHeight;
    phi = -2 * (mousePos.x - gl.viewportWidth / 2) / gl.viewportWidth;

    centerZ = Math.cos(phi) * Math.sin(theta);
    centerX = Math.sin(phi) * Math.sin(theta);
    centerY = Math.cos(theta);
    cameraPosition = [0, 1, 0];
    mat4.lookAt(vMatrix, cameraPosition, [centerX, centerY, centerZ], [0, 1, 0]);*/

    // Camera type 2
    var theta = (1.51 - elevation);
    var phi = azimuth;
    if (cameraPan) {
      azimuth += 0.005;
    }

    cameraPosition = [cameraDistance * Math.cos(phi) * Math.sin(theta) + focus[0], cameraDistance * Math.cos(theta) + focus[1], cameraDistance * Math.sin(phi) * Math.sin(theta) + focus[2]];
    mat4.lookAt(vMatrix, cameraPosition, focus, [0, 1, 0]);
   
    return cameraPosition;
}

timeStep = 0;
instanceMMatrix = new Float32Array(maxInstances * 16); // Store model transform of each light cube.

function drawTesseract(pMatrix, vMatrix, mMatrix, color, lightPos) {
    gl.useProgram(tesseractShader);

    // Activate hardware texture unit 0 
    gl.activeTexture(gl.TEXTURE0);
    // Tell the shader that the sampler(or the texture) variable is associated with unit 0. 
    gl.uniform1i(tesseractShader.samplerUniform, 0);

    gl.uniformMatrix4fv(tesseractShader.pMatrixUniform, false, pMatrix);
    gl.uniformMatrix4fv(tesseractShader.vMatrixUniform, false, vMatrix);

    gl.blendFunc(gl.SRC_ALPHA, gl.ONE);
    gl.enable(gl.BLEND);
    gl.disable(gl.DEPTH_TEST);
    gl.bindVertexArray(cubeVAO);

    gl.bindTexture(gl.TEXTURE_2D, blueTexture);

    mat4.rotateY(mMatrix, mMatrix, timeStep / 10);
    mat4.rotateX(mMatrix, mMatrix, timeStep / 10);
    gl.uniform3f(tesseractShader.colorUniform, color[0] * .1, color[1] * 0.1, color[2] * 0.1);
    gl.bindBuffer(gl.ARRAY_BUFFER, cubeVAO.instanceBuffer);
    gl.bufferSubData(gl.ARRAY_BUFFER, 0, mMatrix, 0);
    gl.drawElementsInstanced(gl.TRIANGLES, cubeVAO.numItems, gl.UNSIGNED_BYTE, 0, 1);

    gl.bindTexture(gl.TEXTURE_2D, whiteTexture);
    mat4.scale(mMatrix, mMatrix, [0.95, 0.95, 0.95]);
    gl.uniform3f(tesseractShader.colorUniform, color[0] * 0.3, color[1] * 0.3, color[2] * 0.3);
    gl.bindBuffer(gl.ARRAY_BUFFER, cubeVAO.instanceBuffer);
    gl.bufferSubData(gl.ARRAY_BUFFER, 0, mMatrix, 0);
    gl.drawElementsInstanced(gl.TRIANGLES, cubeVAO.numItems, gl.UNSIGNED_BYTE, 0, 1);

    var modelMat = mat4.clone(mMatrix);
    var index = 0;
    for (var i = 0; i < 100; i++) {
        for (var j = 0; j < 20; j++) {
            mat4.copy(mMatrix, modelMat);
            var x = 0.9 * Math.exp(-j / 20) * Math.cos(0.3 * randomX[i] * (timeStep + j) + 0.4);
            var y = 0.9 * Math.exp(-j / 20) * Math.cos(0.3 * randomY[i] * (timeStep + j) + 0.1);
            var z = 0.9 * Math.exp(-j / 20) * Math.cos(0.3 * randomZ[i] * (timeStep + j) + 0.2);
            mat4.translate(mMatrix, mMatrix, [x, y, z]);
            mat4.rotateX(mMatrix, mMatrix, timeStep / 10);
            mat4.rotateY(mMatrix, mMatrix, -timeStep / 10);
            mat4.scale(mMatrix, mMatrix, [0.1, 0.1, 0.1]);
            lightPos[3 * index + lightPos.nextOffset] = mMatrix[12];
            lightPos[3 * index + 1 + lightPos.nextOffset] = mMatrix[13];
            lightPos[3 * index + 2 + lightPos.nextOffset] = mMatrix[14];
            instanceMMatrix.set(mMatrix, index * 16);
            index++;
        }
    }

    gl.bindTexture(gl.TEXTURE_2D, starTexture);
    gl.uniform3f(tesseractShader.colorUniform, color[0] * 0.2, color[1] * 0.2, color[2] * 0.2);
    gl.bindBuffer(gl.ARRAY_BUFFER, cubeVAO.instanceBuffer);
    gl.bufferSubData(gl.ARRAY_BUFFER, 0, instanceMMatrix, 0);
    gl.drawElementsInstanced(gl.TRIANGLES, cubeVAO.numItems, gl.UNSIGNED_BYTE, 0, index);

    gl.enable(gl.DEPTH_TEST);
    gl.disable(gl.BLEND);

    lightPos.nextOffset += 3 * index;

    return index; // Return number of lights.
}

function drawFloor(pMatrix, vMatrix, mMatrix, lightPos, buffer) {
    gl.useProgram(modelShader);

    gl.uniform1i(modelShader.samplerUniform, 0);
    gl.uniform1i(modelShader.lightPositionSamplerUniform, 1);

    // Trnsfer light positions
    gl.bindTexture(gl.TEXTURE_2D, lightPositionTexture);
    //for (var i =0; i < 256 * 256; i++) {
    //  lightPos[3*i] = 5; lightPos[3*i + 1] = 0; lightPos[3*i + 2] = -8;
    // }
    gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, lightPositionTextureSize, lightPositionTextureSize, gl.RGB, gl.FLOAT, lightPos, 0);
    gl.bindTexture(gl.TEXTURE_2D, null);

    // Transfer light colors.
    gl.uniform3fv(modelShader.bufferUniform, buffer);

    gl.uniformMatrix4fv(modelShader.pMatrixUniform, false, pMatrix);
    gl.uniformMatrix4fv(modelShader.vMatrixUniform, false, vMatrix);

    gl.bindVertexArray(floorVAO);

    var modelMat = mat4.clone(mMatrix);
    var index = 0;
    var scale = 1;
    for (var i = -10; i < 25; i++) {
        for (var j = -10; j < 25; j++) {
            mat4.copy(mMatrix, modelMat);
            mat4.translate(mMatrix, mMatrix, [i * 2 * scale, j * 2 * scale, 0]);
            mat4.scale(mMatrix, mMatrix, [scale, scale, scale]);
            instanceMMatrix.set(mMatrix, index * 16);
            index++;
        }
    }

    // Activate hardware texture unit 0 
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, floorTexture);
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, lightPositionTexture);
    gl.bindBuffer(gl.ARRAY_BUFFER, floorVAO.instanceBuffer);
    gl.bufferSubData(gl.ARRAY_BUFFER, 0, instanceMMatrix, 0);
    gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, floorVAO.numItems, index);
}

// Store light locations in these arrays. Create seperate arrays for three sources.
var lightPositions = new Float32Array(lightPositionTextureSize * lightPositionTextureSize * 3);
lightPositions.nextOffset = 0;

var miscBuffer = new Float32Array(8 * 3);

function drawScene() {
    gl.viewport(0, 0, gl.viewportWidth, gl.viewportHeight);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    mat4.identity(pMatrix);
    mat4.perspective(pMatrix, 45, gl.viewportWidth / gl.viewportHeight, 2, 300.0);
   
   // if light positions are changed, then mean light postion field in miscBuffer[] must be updated. 
    miscBuffer.set(camera([0, 0, -15], 10), 12);
    mat4.identity(mMatrix);
    mat4.translate(mMatrix, mMatrix, [-5, 0, -15]);
    mat4.scale(mMatrix, mMatrix, [1, 1, 1]);
    color = [1, 0.33, 0.33];
    miscBuffer.set(color, 0);
    // Save number of lights
    miscBuffer[21] = drawTesseract(pMatrix, vMatrix, mMatrix, color, lightPositions);

    mat4.identity(mMatrix);
    mat4.translate(mMatrix, mMatrix, [5, 0, -15]);
    mat4.scale(mMatrix, mMatrix, [1, 1, 1]);
    color = [0.42, 0.67, 1];
    miscBuffer.set(color, 3);
    drawTesseract(pMatrix, vMatrix, mMatrix, color, lightPositions);

    mat4.identity(mMatrix);
    mat4.translate(mMatrix, mMatrix, [0, 0, -15]);
    mat4.scale(mMatrix, mMatrix, [1, 1, 1]);
    color = [0.42, 1, 0.67];
    miscBuffer.set(color, 6);
    drawTesseract(pMatrix, vMatrix, mMatrix, color, lightPositions);
    
    // Save the mean light position.
    miscBuffer[15] = 0;
    miscBuffer[16] = 0;
    miscBuffer[17] = -15;

    mat4.identity(mMatrix);
    mat4.translate(mMatrix, mMatrix, [0, -3, 0]);
    mat4.rotateX(mMatrix, mMatrix, -1.570796);
    gl.enable(gl.BLEND);
    drawFloor(pMatrix, vMatrix, mMatrix, lightPositions, miscBuffer);
    lightPositions.nextOffset = 0;
}

function tick() {
    requestAnimFrame(tick);
    drawScene();
    timeStep += 0.05;
}


var mousePos = { 'x': 0, 'y': 0 };
var isMouseDown = false;

function webGLStart() {
    var canvas = document.getElementById("canvas-001");
    canvas.addEventListener('mousemove', function (evt) {
        var rect = canvas.getBoundingClientRect();
        if (isMouseDown) {
            azimuth -=  (mousePos.x - evt.clientX + rect.left) / 100;
            elevation -= (mousePos.y - evt.clientY + rect.top) / 100;
            if (elevation > 1.50)
                elevation = 1.50;
            else if (elevation < 0.01)
                elevation = 0.01;    
        }
        mousePos.x = evt.clientX - rect.left;
        mousePos.y = evt.clientY - rect.top;
       
    }, false);
    canvas.addEventListener('mousedown', function (evt) {
       isMouseDown = true;
    }, false);
    canvas.addEventListener('mouseup', function (evt) {
       isMouseDown = false;
    }, false);
    window.addEventListener('resize', function () {
       gl.canvas.width = window.innerWidth * 0.75;
        gl.canvas.height = window.innerHeight * 1.1;
        gl.viewportWidth = canvas.width;
        gl.viewportHeight = canvas.height;
    }, false);

    canvas.addEventListener('mousewheel', function (evt) {
       cameraDistance -= event.wheelDelta / 120;
    }, false);
    initGL(canvas);
    initShaders();

    // Create texture handle
    blueTexture = gl.createTexture();
    whiteTexture = gl.createTexture();
    starTexture = gl.createTexture();
    floorTexture = gl.createTexture();
    initTexture(blueTexture, "blue.png");
    initTexture(whiteTexture, "textureGrey.jpg");
    initTexture(starTexture, "star.gif");
    initTexture(floorTexture, "floor.jpg");
    initBuffers();

    gl.clearColor(0.0, 0.0, 0.0, 1.0);
    gl.enable(gl.DEPTH_TEST);

    tick();
}