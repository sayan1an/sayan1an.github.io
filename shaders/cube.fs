#version 300 es

precision mediump float;
in vec2 vertexTextureCoord; // from vertex shader
in vec3 vertexNormal; // normalize before use. from vertex shader
in vec3 vertexPosition; // from vertex shader

uniform sampler2D uSampler;
uniform vec3 in_color; // from API

out vec4 fragColor;

void main(void) {
    vec4 texCol = texture(uSampler, vec2(vertexTextureCoord.s, vertexTextureCoord.t));
    fragColor = texCol * vec4(in_color, 1);
}