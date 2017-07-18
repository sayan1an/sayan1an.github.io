#version 300 es

in vec3 in_vertexPosition;
in vec3 in_vertexNormal;
in vec2 in_vertexTextureCoord;
in mat4 in_MMatrix; //instanced input, model matrix

out vec2 vertexTextureCoord;
out vec3 vertexNormal;
out vec3 vertexPosition;

uniform mat4 uVMatrix;
uniform mat4 uPMatrix;
void main(void) {
    vec4 modelCoordPos =  in_MMatrix * vec4(in_vertexPosition, 1);
    gl_Position = uPMatrix * uVMatrix * modelCoordPos;
    vertexTextureCoord = in_vertexTextureCoord;
    vertexNormal = (transpose(inverse(in_MMatrix)) * vec4(in_vertexNormal, 0)).rgb;
    vertexPosition = modelCoordPos.rgb;
}